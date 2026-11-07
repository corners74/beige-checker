// Builds the final report. Uses Claude when ANTHROPIC_API_KEY (or another
// Anthropic credential) is configured, otherwise falls back to rule-based output.
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { REPORT_JSON_SCHEMA, SYSTEM_PROMPT, SCORE_KEYS, buildUserMessage } from './reviewPrompt.js';
import { ruleBasedReport, finaliseReport } from './ruleReport.js';

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-5-5';

const ReportSchema = z.object({
  fiveSecondTake: z.string(),
  whatTheyThinkYouDo: z.string(),
  customerNeedsToKnow: z.object({
    headline: z.string(),
    subheadline: z.string(),
    points: z.array(z.string()),
    services: z.array(z.object({ name: z.string(), line: z.string() })),
    callToAction: z.string(),
  }),
  scores: z.object(Object.fromEntries(SCORE_KEYS.map((k) => [k, z.object({ score: z.number(), comment: z.string() })]))),
  beigeScore: z.number(),
  flagged: z.array(
    z.object({
      quote: z.string(),
      problem: z.enum(['beige', 'waffle', 'repetition', 'vague promise', 'filler', 'jargon', 'complexity', 'we-focused', 'unproven claim']),
      why: z.string(),
      tryInstead: z.string(),
    }),
  ),
  improvements: z.array(z.object({ title: z.string(), detail: z.string(), example: z.string() })),
  doingWell: z.string(),
});

let client;
function getClient() {
  if (!client) client = new Anthropic({ maxRetries: 2, timeout: 120_000 });
  return client;
}

export function aiAvailable() {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN) && process.env.DISABLE_AI !== '1';
}

async function aiReview(content, findings, audience) {
  const useFallbacks = process.env.ANTHROPIC_FALLBACKS !== '0';
  const response = await getClient().beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    ...(useFallbacks ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' } : {}),
    output_config: {
      effort: process.env.ANTHROPIC_EFFORT || 'medium',
      format: { type: 'json_schema', schema: REPORT_JSON_SCHEMA },
    },
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildUserMessage(content, findings, audience) }],
  });

  if (response.stop_reason === 'refusal') throw new Error('The AI reviewer declined this page.');
  if (response.stop_reason === 'max_tokens') throw new Error('The AI review was cut off.');
  const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  const parsed = ReportSchema.parse(JSON.parse(text));
  return parsed;
}

export async function buildReport(content, findings, audience) {
  let report;
  let mode = 'rules';
  let aiError = null;
  if (aiAvailable()) {
    try {
      report = await aiReview(content, findings, audience);
      mode = 'ai';
    } catch (err) {
      aiError = err.message;
      console.error('[review] AI review failed, using rule-based report:', err.message);
    }
  }
  if (!report) report = ruleBasedReport(content, findings, audience);

  return finaliseReport(report, findings, content, mode, aiError);
}

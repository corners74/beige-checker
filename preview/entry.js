// Bundle entry for the claude.ai preview: the shim first (it answers /api/* calls), then the normal front end.
import './shim.js';
import '../public/app.js';

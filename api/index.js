// Vercel serverless function: every /api/* request is rewritten here (see vercel.json) and
// handled by the same Express app the local server runs.
module.exports = require("../backend/app");

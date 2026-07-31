// Applied at the top of every /api handler. Same-origin requests (the normal
// case, when VITE_API_URL is left unset) never need this — but it's a safety
// net if the app is ever opened from a different Vercel URL/alias than the
// one baked into VITE_API_URL, or hit from another domain entirely.
export function applyCors(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return true; // caller should return immediately
  }
  return false;
}

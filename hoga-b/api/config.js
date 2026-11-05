// GET /api/config
// Memberi frontend URL dan anon key Supabase (keduanya memang publik).
// Service role key TIDAK pernah dikirim ke sini.
const { handle, send, requireMethod, HttpError } = require('./_lib/http');

module.exports = handle(async (req, res) => {
  requireMethod(req, ['GET']);

  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new HttpError(500, 'SUPABASE_URL / SUPABASE_ANON_KEY belum diatur di environment.');
  }
  send(res, 200, { url, anonKey });
});

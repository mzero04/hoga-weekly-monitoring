const { createClient } = require('@supabase/supabase-js');
const { HttpError } = require('./http');

function env(name) {
  const v = process.env[name];
  if (!v) throw new HttpError(500, `Environment variable ${name} belum diatur.`);
  return v;
}

// Client dengan service role key: melewati RLS. HANYA dipakai di server, jangan pernah dikirim ke browser.
function adminClient() {
  return createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

// Memastikan pemanggil login dan berperan admin. Mengembalikan { user, admin }.
async function requireAdmin(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) throw new HttpError(401, 'Anda belum login.');

  const admin = adminClient();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data || !data.user) throw new HttpError(401, 'Sesi tidak valid. Silakan login ulang.');

  const { data: profile, error: pErr } = await admin
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .maybeSingle();
  if (pErr) throw new HttpError(500, 'Gagal memeriksa hak akses.');
  if (!profile || profile.role !== 'admin') throw new HttpError(403, 'Hanya admin yang boleh melakukan ini.');

  return { user: data.user, admin };
}

module.exports = { env, adminClient, requireAdmin };

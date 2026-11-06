// /api/users  (khusus admin)
//   GET                      -> daftar user
//   POST   {full_name,email,password,role} -> tambah user
//   PATCH  {id, role}        -> ubah role
//   DELETE ?id=<uuid>        -> hapus user
const { handle, send, requireMethod, HttpError } = require('./_lib/http');
const { requireAdmin } = require('./_lib/supabase');

const ROLES = ['user', 'admin'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function bodyOf(req) {
  const b = req.body;
  if (!b) return {};
  if (typeof b === 'string') {
    try { return JSON.parse(b); } catch { throw new HttpError(400, 'Body bukan JSON yang valid.'); }
  }
  return b;
}

module.exports = handle(async (req, res) => {
  requireMethod(req, ['GET', 'POST', 'PATCH', 'DELETE']);
  const { user: me, admin } = await requireAdmin(req);

  // ---------- GET ----------
  if (req.method === 'GET') {
    const { data, error } = await admin
      .from('profiles')
      .select('id, email, full_name, role')
      .order('email', { ascending: true });
    if (error) throw new HttpError(500, 'Gagal memuat daftar user: ' + error.message);
    return send(res, 200, data || []);
  }

  // ---------- POST ----------
  if (req.method === 'POST') {
    const b = bodyOf(req);
    const email = String(b.email || '').trim().toLowerCase();
    const password = String(b.password || '');
    const fullName = String(b.full_name || '').trim().slice(0, 120);
    const role = b.role || 'user';

    if (!EMAIL_RE.test(email)) throw new HttpError(400, 'Format email tidak valid.');
    if (password.length < 6) throw new HttpError(400, 'Password minimal 6 karakter.');
    if (!ROLES.includes(role)) throw new HttpError(400, 'Role harus "user" atau "admin".');

    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName }
    });
    if (error) {
      const dup = /already|registered|exists/i.test(error.message || '');
      throw new HttpError(dup ? 409 : 400, dup ? 'Email sudah terdaftar.' : error.message);
    }

    const { error: pErr } = await admin
      .from('profiles')
      .upsert({ id: created.user.id, email, full_name: fullName, role });
    if (pErr) {
      await admin.auth.admin.deleteUser(created.user.id); // batalkan agar tidak ada akun tanpa profil
      throw new HttpError(500, 'Gagal menyimpan profil: ' + pErr.message);
    }
    return send(res, 201, { id: created.user.id, email, full_name: fullName, role });
  }

  // ---------- PATCH ----------
  if (req.method === 'PATCH') {
    const b = bodyOf(req);
    if (!UUID_RE.test(String(b.id || ''))) throw new HttpError(400, 'ID user tidak valid.');
    if (!ROLES.includes(b.role)) throw new HttpError(400, 'Role harus "user" atau "admin".');
    if (b.id === me.id) throw new HttpError(400, 'Anda tidak dapat mengubah role akun sendiri.');

    const { error } = await admin.from('profiles').update({ role: b.role }).eq('id', b.id);
    if (error) throw new HttpError(500, 'Gagal mengubah role: ' + error.message);
    return send(res, 200, { ok: true });
  }

  // ---------- DELETE ----------
  const id = String((req.query && req.query.id) || '');
  if (!UUID_RE.test(id)) throw new HttpError(400, 'ID user tidak valid.');
  if (id === me.id) throw new HttpError(400, 'Anda tidak dapat menghapus akun sendiri.');

  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) throw new HttpError(500, 'Gagal menghapus user: ' + error.message);
  await admin.from('profiles').delete().eq('id', id); // aman bila sudah terhapus lewat cascade
  return send(res, 200, { ok: true });
});

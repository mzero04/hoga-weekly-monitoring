/* Inisialisasi Supabase, login, logout, start aplikasi */

async function initSupabase() {
    try {
        if (!window.supabase || !window.supabase.createClient) throw new Error('Library Supabase gagal dimuat. Periksa koneksi internet / ad blocker lalu refresh.');
        const res = await fetch('/api/config');
        const cfg = await res.json();
        if (!cfg.url || !cfg.anonKey) throw new Error('Konfigurasi Supabase belum diatur (SUPABASE_URL / SUPABASE_ANON_KEY).');
        sb = window.supabase.createClient(cfg.url, cfg.anonKey);
    } catch (err) {
        showLoginError(err.message || 'Gagal memuat konfigurasi.');
        return;
    }

    const { data } = await sb.auth.getSession();
    currentSession = data.session;
    if (currentSession) await startApp();

    sb.auth.onAuthStateChange(async (event, session) => {
        currentSession = session;
        if (event === 'SIGNED_OUT') {
            appStarted = false;
            showLogin();
        }
    });
}

// ---------- LOGIN / LOGOUT ----------
function showLoginError(msg) {
    const el = document.getElementById('loginError');
    el.innerText = msg;
    el.classList.remove('hidden');
}

function showLogin() {
    stopRealtime();
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('appHeader').classList.add('hidden');
    document.getElementById('appMain').classList.add('hidden');
    document.getElementById('loginPassword').value = '';
    monitoringList = [];
    overlineList = [];
    currentProfile = null;
}

async function handleLogin(e) {
    e.preventDefault();
    if (!sb) return showLoginError('Supabase belum siap. Periksa konfigurasi environment.');
    const btn = document.getElementById('loginBtn');
    btn.disabled = true;
    document.getElementById('loginError').classList.add('hidden');

    const { data, error } = await sb.auth.signInWithPassword({
        email: document.getElementById('loginEmail').value.trim(),
        password: document.getElementById('loginPassword').value
    });
    btn.disabled = false;

    if (error) {
        const m = (error.message || '').toLowerCase();
        showLoginError(m.includes('invalid login') ? 'Login gagal: email atau password salah.' : 'Login gagal: ' + error.message);
        return;
    }
    currentSession = data.session;
    try {
        await startApp();
    } catch (err) {
        console.error(err);
        appStarted = false;
        showLogin();
        showLoginError('Berhasil login, tetapi gagal memuat aplikasi: ' + (err.message || err));
    }
}

async function handleLogout() {
    if (sb) await sb.auth.signOut();
    showLogin();
}

async function startApp() {
    if (appStarted) return;
    appStarted = true;

    // ambil profile / role
    const uid = currentSession.user.id;
    const { data: prof } = await sb.from('profiles').select('*').eq('id', uid).maybeSingle();
    currentProfile = prof || { id: uid, email: currentSession.user.email, role: 'user' };

    applyDefaultEngineer();
    document.getElementById('currentUserLabel').innerText = `${currentProfile.full_name || currentProfile.email} (${currentProfile.role})`;

    // elemen khusus admin
    ['nav-users', 'mob-nav-users', 'btnResetDemo'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.toggle('hidden', !isAdmin());
    });

    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('appHeader').classList.remove('hidden');
    document.getElementById('appMain').classList.remove('hidden');

    await loadData();
    startRealtime();
    switchTab('dashboard');
    safeIcons();
}

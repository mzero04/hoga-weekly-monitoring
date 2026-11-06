/* Manajemen user (admin) */

// ---------- USER MANAGEMENT (ADMIN) ----------
async function callUsersApi(method, body, query = '') {
    const { data } = await sb.auth.getSession();
    const token = data.session ? data.session.access_token : '';
    const res = await fetch('/api/users' + query, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: body ? JSON.stringify(body) : undefined
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || 'Permintaan gagal.');
    return json;
}

async function loadUsers() {
    const tbody = document.getElementById('tableUsersBody');
    try {
        const users = await callUsersApi('GET');
        document.getElementById('userCountText').innerText = `Total: ${users.length} User`;
        if (!users.length) {
            tbody.innerHTML = `<tr><td colspan="4" class="text-center py-6 text-slate-400">Belum ada user</td></tr>`;
            return;
        }
        tbody.innerHTML = users.map(u => {
            const self = u.id === currentSession.user.id;
            const roleBadge = u.role === 'admin'
                ? `<span class="px-2 py-0.5 text-xs font-semibold rounded bg-indigo-100 text-indigo-700">Admin</span>`
                : `<span class="px-2 py-0.5 text-xs font-semibold rounded bg-slate-100 text-slate-600">User</span>`;
            return `
                <tr class="hover:bg-slate-50 transition">
                    <td class="p-3 font-medium text-slate-700">${esc(u.full_name || '-')}</td>
                    <td class="p-3">${esc(u.email)}</td>
                    <td class="p-3">${roleBadge}</td>
                    <td class="p-3 text-center">
                        ${self ? '<span class="text-slate-400">Akun Anda</span>' : `
                        <div class="flex items-center justify-center space-x-2">
                            <button onclick="toggleUserRole('${esc(u.id)}','${u.role === 'admin' ? 'user' : 'admin'}')" class="px-2 py-1 text-blue-600 hover:bg-blue-50 rounded text-[11px] font-medium">Jadikan ${u.role === 'admin' ? 'User' : 'Admin'}</button>
                            <button onclick="deleteUser('${esc(u.id)}')" class="p-1 text-rose-600 hover:bg-rose-50 rounded" title="Hapus"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                        </div>`}
                    </td>
                </tr>`;
        }).join('');
        safeIcons();
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center py-6 text-rose-500">${esc(err.message)}</td></tr>`;
    }
}

async function handleCreateUser(e) {
    e.preventDefault();
    try {
        await callUsersApi('POST', {
            full_name: document.getElementById('newUserName').value.trim(),
            email: document.getElementById('newUserEmail').value.trim(),
            password: document.getElementById('newUserPassword').value,
            role: document.getElementById('newUserRole').value
        });
        document.getElementById('formUser').reset();
        showToast("User baru berhasil ditambahkan.");
        loadUsers();
    } catch (err) {
        showToast(err.message);
    }
}

async function toggleUserRole(id, role) {
    try {
        await callUsersApi('PATCH', { id, role });
        showToast("Role user diperbarui.");
        loadUsers();
    } catch (err) { showToast(err.message); }
}

async function deleteUser(id) {
    if (!confirm("Hapus user ini? Aksi tidak dapat dibatalkan.")) return;
    try {
        await callUsersApi('DELETE', null, '?id=' + encodeURIComponent(id));
        showToast("User berhasil dihapus.");
        loadUsers();
    } catch (err) { showToast(err.message); }
}

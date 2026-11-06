/* Pop-up (modal) untuk mengedit data Monitoring dan Overline */

// Definisi field per tabel. Dipakai untuk membangun form di dalam modal.
//  read : nilai awal dari data (default item[key])
//  write: ubah nilai form menjadi nilai yang disimpan (default apa adanya)
//  dash : jika kosong disimpan sebagai "-" (sama seperti form input)
const EDIT_SCHEMA = {
    monitoring: {
        title: 'Edit Data Monitoring',
        table: 'monitoring',
        list: () => monitoringList,
        toDb: monToDb,
        sections: [
            {
                cols: 2,
                fields: [
                    { key: 'reportDate', label: 'Report Date', type: 'date', required: true },
                    { key: 'engineer', label: 'Engineer PIC', type: 'select', options: () => MASTER_ENGINEERS, required: true },
                    { key: 'line', label: 'Line', type: 'select', options: () => MASTER_LINES, required: true },
                    { key: 'plannedStartDate', label: 'Planned Start Date', type: 'date', required: true },
                    { key: 'currentStyle', label: 'Current Style', type: 'text', dash: true, placeholder: 'Contoh: Style #A102' },
                    { key: 'nextStyle', label: 'Next Style', type: 'text', dash: true, placeholder: 'Contoh: Style #B205' }
                ]
            },
            { custom: 'daysBadge' },
            {
                title: 'Status Tahapan Kesiapan', cols: 3,
                fields: [
                    { key: 'preLayoutStatus', label: 'Pre-layout', type: 'select', options: () => MASTER_STATUS },
                    { key: 'ppApprovalStatus', label: 'PP Approval', type: 'select', options: () => MASTER_STATUS },
                    {
                        key: 'chiefSampleStatus', label: 'Chief Sample', type: 'select', options: () => ['X', 'O'],
                        read: item => chiefLabel(item.chiefSampleStatus), write: v => chiefToDb(v)
                    }
                ]
            },
            { cols: 1, fields: [{ key: 'remark', label: 'Catatan / Remark', type: 'textarea', dash: true, placeholder: 'Catatan tambahan...' }] }
        ],
        subtitle: item => `Line ${item.line} · ${item.engineer}`
    },
    overline: {
        title: 'Edit Data Overline',
        table: 'overline',
        list: () => overlineList,
        toDb: ovrToDb,
        sections: [
            {
                cols: 2,
                fields: [
                    { key: 'reportWeekStart', label: 'Week Start', type: 'date', required: true },
                    { key: 'engineer', label: 'Engineer PIC', type: 'select', options: () => MASTER_ENGINEERS, required: true },
                    { key: 'line', label: 'Line', type: 'select', options: () => MASTER_LINES, required: true },
                    { key: 'plannedOverlineDate', label: 'Planned Overline Date', type: 'date', required: true },
                    { key: 'currentStyle', label: 'Current Style', type: 'text', dash: true },
                    { key: 'nextStyle', label: 'Next Style', type: 'text', dash: true },
                    { key: 'status', label: 'Overline Status', type: 'select', options: () => MASTER_STATUS }
                ]
            },
            { cols: 1, fields: [{ key: 'remark', label: 'Remark / Cause of Delay', type: 'textarea', dash: true, placeholder: 'Penyebab / catatan...' }] }
        ],
        subtitle: item => `Line ${item.line} · ${item.engineer}`
    }
};

const editModal = { table: null, id: null, snapshot: '', saving: false, lastFocus: null };
const EDIT_INPUT_CLASS = 'w-full bg-slate-50 border border-slate-300 text-slate-800 text-sm rounded-lg p-2.5 focus:ring-indigo-500 focus:border-indigo-500';

function editFieldHtml(f, item) {
    const raw = f.read ? f.read(item) : item[f.key];
    const val = raw == null ? '' : String(raw);
    const shown = (f.dash && val === '-') ? '' : val;
    const id = 'edit_' + f.key;
    const req = f.required ? 'required' : '';
    let control;
    if (f.type === 'select') {
        const opts = f.options().slice();
        if (val && !opts.includes(val)) opts.push(val);   // nilai lama yang tidak ada di daftar tetap bisa dipilih
        control = `<select id="${id}" ${req} class="${EDIT_INPUT_CLASS}">` +
            (f.required ? `<option value="">-- Pilih --</option>` : '') +
            opts.map(o => `<option value="${esc(o)}"${o === val ? ' selected' : ''}>${esc(o)}</option>`).join('') + `</select>`;
    } else if (f.type === 'textarea') {
        control = `<textarea id="${id}" rows="3" placeholder="${esc(f.placeholder || '')}" class="${EDIT_INPUT_CLASS}">${esc(shown)}</textarea>`;
    } else {
        control = `<input type="${f.type}" id="${id}" ${req} value="${esc(shown)}" placeholder="${esc(f.placeholder || '')}" class="${EDIT_INPUT_CLASS}">`;
    }
    return `<div><label for="${id}" class="block text-xs font-semibold text-slate-700 uppercase mb-1">${esc(f.label)}${f.required ? ' *' : ''}</label>${control}</div>`;
}

function editFormHtml(schema, item) {
    return schema.sections.map(sec => {
        if (sec.custom === 'daysBadge') {
            return `<div class="bg-indigo-50 p-3 rounded-lg border border-indigo-100 flex items-center justify-between">` +
                `<span class="text-xs font-medium text-indigo-700">Days to Start (dihitung otomatis):</span>` +
                `<span id="editDaysDisplay" class="font-bold text-sm text-indigo-900">0 Hari</span></div>`;
        }
        const grid = sec.cols === 3 ? 'md:grid-cols-3' : sec.cols === 2 ? 'md:grid-cols-2' : '';
        return `<div class="${sec.title ? 'border-t border-slate-100 pt-4 ' : ''}space-y-3">` +
            (sec.title ? `<h3 class="text-sm font-semibold text-slate-800">${esc(sec.title)}</h3>` : '') +
            `<div class="grid grid-cols-1 ${grid} gap-4">${sec.fields.map(f => editFieldHtml(f, item)).join('')}</div></div>`;
    }).join('');
}

function editFields(schema) {
    return schema.sections.flatMap(s => s.fields || []);
}

function readEditValues(schema) {
    const out = {};
    editFields(schema).forEach(f => {
        const el = document.getElementById('edit_' + f.key);
        let v = el ? el.value.trim() : '';
        if (f.dash && !v) v = '-';
        out[f.key] = f.write ? f.write(v) : v;
    });
    return out;
}

function snapshotEditForm(schema) {
    return JSON.stringify(editFields(schema).map(f => (document.getElementById('edit_' + f.key) || {}).value));
}

function updateEditDays() {
    const out = document.getElementById('editDaysDisplay');
    const a = document.getElementById('edit_reportDate');
    const b = document.getElementById('edit_plannedStartDate');
    if (!out || !a || !b) return;
    const d = calculateDaysToStart(a.value, b.value);
    out.textContent = d <= 0 ? '0 Hari' : `${d} Hari lagi`;
}

function openEditModal(table, id) {
    const schema = EDIT_SCHEMA[table];
    const item = schema && schema.list().find(r => r.id === id);
    if (!item) return showToast('Data tidak ditemukan. Mungkin sudah dihapus pengguna lain.');

    editModal.table = table;
    editModal.id = id;
    editModal.saving = false;
    editModal.lastFocus = document.activeElement;

    document.getElementById('editModalTitle').textContent = schema.title;
    document.getElementById('editModalSubtitle').textContent = schema.subtitle(item);
    document.getElementById('editModalFields').innerHTML = editFormHtml(schema, item);
    const btn = document.getElementById('editModalSave');
    btn.disabled = false;
    btn.textContent = 'Simpan Perubahan';

    ['edit_reportDate', 'edit_plannedStartDate'].forEach(i => {
        const el = document.getElementById(i);
        if (el && table === 'monitoring') el.addEventListener('change', updateEditDays);
    });
    updateEditDays();
    editModal.snapshot = snapshotEditForm(schema);

    const root = document.getElementById('editModal');
    root.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', editModalKeydown);
    requestAnimationFrame(() => root.classList.add('modal-open'));
    const first = root.querySelector('input, select, textarea');
    if (first) setTimeout(() => first.focus(), 50);
}

function closeEditModal() {
    const root = document.getElementById('editModal');
    root.classList.remove('modal-open');
    document.removeEventListener('keydown', editModalKeydown);
    document.body.style.overflow = '';
    setTimeout(() => { if (!root.classList.contains('modal-open')) root.classList.add('hidden'); }, 180);
    const back = editModal.lastFocus;
    editModal.table = null;
    editModal.id = null;
    if (back && typeof back.focus === 'function') { try { back.focus(); } catch (e) {} }
}

// Tutup lewat tombol X / Batal / klik latar / Esc. Jika ada perubahan, tanya dulu.
function requestCloseEditModal() {
    if (editModal.saving || !editModal.table) return;
    const schema = EDIT_SCHEMA[editModal.table];
    if (snapshotEditForm(schema) !== editModal.snapshot && !confirm('Perubahan belum disimpan. Tutup tanpa menyimpan?')) return;
    closeEditModal();
}

function editModalKeydown(e) {
    if (e.key === 'Escape') { e.preventDefault(); requestCloseEditModal(); return; }
    if (e.key !== 'Tab') return;
    // Fokus tetap berputar di dalam modal
    const nodes = [...document.getElementById('editModalPanel').querySelectorAll('button, input, select, textarea, [href]')]
        .filter(n => !n.disabled && n.offsetParent !== null);
    if (!nodes.length) return;
    const first = nodes[0], last = nodes[nodes.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

async function submitEditModal() {
    if (editModal.saving || !editModal.table) return;
    const schema = EDIT_SCHEMA[editModal.table];
    const id = editModal.id;
    const values = readEditValues(schema);
    const btn = document.getElementById('editModalSave');

    editModal.saving = true;
    btn.disabled = true;
    btn.textContent = 'Menyimpan...';
    markOwnAction();

    try {
        const { data, error } = await sb.from(schema.table).update(schema.toDb({ id, ...values })).eq('id', id).select('id');
        if (error) throw new Error(error.message);
        if (!data || !data.length) throw new Error('Data tidak ditemukan atau Anda tidak punya izin mengubahnya.');
    } catch (err) {
        editModal.saving = false;
        btn.disabled = false;
        btn.textContent = 'Simpan Perubahan';
        showToast('Gagal menyimpan: ' + (err.message || err));   // modal tetap terbuka agar isian tidak hilang
        return;
    }

    editModal.saving = false;
    showToast(editModal.table === 'monitoring' ? 'Data Monitoring berhasil diperbarui.' : 'Data Overline berhasil diperbarui.');
    closeEditModal();
    await loadData();
}

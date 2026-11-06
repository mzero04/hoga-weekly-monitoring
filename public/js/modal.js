/* Pop-up (modal): Update Progress dan Koreksi Data.
   Keduanya disimpan lewat fungsi database save_with_history sehingga selalu tercatat di riwayat. */

// ---------- Definisi field ----------
//  meta : bukan kolom data (tanggal update, catatan, alasan) - dikirim terpisah
//  read : nilai awal dari data (default item[key]); write: ubah nilai form -> nilai simpan
//  dash : jika kosong disimpan sebagai "-"
const F_ENGINEER = { key: 'engineer', label: 'Engineer PIC', type: 'select', options: () => MASTER_ENGINEERS, required: true };
const F_LINE = { key: 'line', label: 'Line', type: 'select', options: () => MASTER_LINES, required: true };
const F_CUR = { key: 'currentStyle', label: 'Current Style', type: 'text', dash: true, placeholder: 'Contoh: Style #A102' };
const F_NEXT = { key: 'nextStyle', label: 'Next Style', type: 'text', dash: true, placeholder: 'Contoh: Style #B205' };
const F_PRE = { key: 'preLayoutStatus', label: 'Pre-layout', type: 'select', options: () => MASTER_STATUS };
const F_PP = { key: 'ppApprovalStatus', label: 'PP Approval', type: 'select', options: () => MASTER_STATUS };
const F_CHIEF = {
    key: 'chiefSampleStatus', label: 'Chief Sample', type: 'select', options: () => ['X', 'O'],
    read: item => chiefLabel(item.chiefSampleStatus), write: v => chiefToDb(v)
};
const F_DATE_UPDATE = { key: 'effectiveDate', label: 'Tanggal Update', type: 'date', meta: true, required: true };
const F_NOTE = { key: 'note', label: 'Catatan Update', type: 'textarea', meta: true, placeholder: 'Apa yang terjadi? Mis. sample sudah di-approve buyer' };
const F_REASON = { key: 'reason', label: 'Alasan Koreksi (opsional)', type: 'textarea', meta: true, placeholder: 'Mis. salah ketik nomor style' };

const EDIT_SCHEMA = {
    monitoring: {
        table: 'monitoring',
        list: () => monitoringList,
        toDb: monToDb,
        progress: [
            { cols: 2, fields: [F_DATE_UPDATE, { key: 'plannedStartDate', label: 'Planned Start Date', type: 'date', required: true }] },
            { custom: 'daysBadge' },
            { title: 'Status Tahapan Kesiapan', cols: 3, fields: [F_PRE, F_PP, F_CHIEF] },
            { cols: 1, fields: [F_NOTE] }
        ],
        correction: [
            {
                cols: 2, fields: [
                    { key: 'reportDate', label: 'Report Date', type: 'date', required: true },
                    F_ENGINEER, F_LINE,
                    { key: 'plannedStartDate', label: 'Planned Start Date', type: 'date', required: true },
                    F_CUR, F_NEXT
                ]
            },
            { custom: 'daysBadge' },
            { title: 'Status Tahapan Kesiapan', cols: 3, fields: [F_PRE, F_PP, F_CHIEF] },
            { cols: 1, fields: [{ key: 'remark', label: 'Catatan / Remark', type: 'textarea', dash: true, placeholder: 'Catatan tambahan...' }, F_REASON] }
        ]
    },
    overline: {
        table: 'overline',
        list: () => overlineList,
        toDb: ovrToDb,
        progress: [
            {
                cols: 2, fields: [
                    F_DATE_UPDATE,
                    { key: 'plannedOverlineDate', label: 'Planned Overline Date', type: 'date', required: true },
                    { key: 'status', label: 'Overline Status', type: 'select', options: () => MASTER_STATUS }
                ]
            },
            { cols: 1, fields: [F_NOTE] }
        ],
        correction: [
            {
                cols: 2, fields: [
                    { key: 'reportWeekStart', label: 'Week Start', type: 'date', required: true },
                    F_ENGINEER, F_LINE,
                    { key: 'plannedOverlineDate', label: 'Planned Overline Date', type: 'date', required: true },
                    F_CUR, F_NEXT,
                    { key: 'status', label: 'Overline Status', type: 'select', options: () => MASTER_STATUS }
                ]
            },
            { cols: 1, fields: [{ key: 'remark', label: 'Remark / Cause of Delay', type: 'textarea', dash: true, placeholder: 'Penyebab / catatan...' }, F_REASON] }
        ]
    }
};

const EDIT_MODES = {
    progress: {
        title: 'Update Progress', badge: 'Progress', save: 'Simpan Update',
        info: 'Catat perkembangan di lapangan. Perubahan masuk ke Riwayat dan grafik timeline pada tanggal yang Anda pilih.'
    },
    correction: {
        title: 'Koreksi Data', badge: 'Koreksi', save: 'Simpan Koreksi',
        info: 'Gunakan hanya untuk memperbaiki salah input. Untuk perkembangan di lapangan, pakai Update Progress.'
    }
};

const editModal = { table: null, id: null, mode: null, item: null, snapshot: '', saving: false, lastFocus: null };
const EDIT_INPUT_CLASS = 'w-full bg-slate-50 border border-slate-300 text-slate-800 text-sm rounded-lg p-2.5 focus:ring-indigo-500 focus:border-indigo-500';

// ---------- Hak akses ----------
// Koreksi: admin atau pembuat data (dicek juga di server). Update Progress: semua user login.
function canCorrect(item) {
    if (isAdmin()) return true;
    return !!(item && item.createdBy && currentProfile && item.createdBy === currentProfile.id);
}

function todayIso() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ---------- Pembangun form ----------
function editSections() {
    return EDIT_SCHEMA[editModal.table][editModal.mode];
}

function editFields() {
    return editSections().flatMap(s => s.fields || []);
}

function editFieldHtml(f, item) {
    let raw;
    if (f.key === 'effectiveDate') {
        const last = typeof lastEffectiveDate === 'function' ? lastEffectiveDate(editModal.table, editModal.id) : '';
        raw = (last && last > todayIso()) ? last : todayIso();    // tidak boleh lebih awal dari update terakhir
    }
    else if (f.meta) raw = '';
    else raw = f.read ? f.read(item) : item[f.key];
    const val = raw == null ? '' : String(raw);
    const shown = (f.dash && val === '-') ? '' : val;
    const id = 'edit_' + f.key;
    const req = f.required ? 'required' : '';
    let control;
    if (f.type === 'select') {
        const opts = f.options().slice();
        if (val && !opts.includes(val)) opts.push(val);   // nilai lama di luar daftar tetap bisa dipilih
        control = `<select id="${id}" ${req} class="${EDIT_INPUT_CLASS}">` +
            (f.required ? `<option value="">-- Pilih --</option>` : '') +
            opts.map(o => `<option value="${esc(o)}"${o === val ? ' selected' : ''}>${esc(o)}</option>`).join('') + `</select>`;
    } else if (f.type === 'textarea') {
        control = `<textarea id="${id}" rows="${f.meta ? 2 : 3}" placeholder="${esc(f.placeholder || '')}" class="${EDIT_INPUT_CLASS}">${esc(shown)}</textarea>`;
    } else {
        let extra = '';
        if (f.key === 'effectiveDate') {
            const d = new Date(); d.setDate(d.getDate() + 1);
            const max = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            const last = typeof lastEffectiveDate === 'function' ? lastEffectiveDate(editModal.table, editModal.id) : '';
            extra = ` max="${max}"` + (last ? ` min="${last}"` : '');
        }
        control = `<input type="${f.type}" id="${id}" ${req}${extra} value="${esc(shown)}" placeholder="${esc(f.placeholder || '')}" class="${EDIT_INPUT_CLASS}">`;
    }
    return `<div><label for="${id}" class="block text-xs font-semibold text-slate-700 uppercase mb-1">${esc(f.label)}${f.required ? ' *' : ''}</label>${control}</div>`;
}

function editFormHtml(item) {
    const html = editSections().map(sec => {
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
    return html + `<div id="editChangeSummary" class="hidden rounded-lg border border-indigo-100 bg-indigo-50/60 p-3"></div>`;
}

// ---------- Membaca nilai & ringkasan perubahan ----------
function formValue(f) {
    const el = document.getElementById('edit_' + f.key);
    return el ? el.value.trim() : '';
}

function readEditValues() {
    const data = {}, meta = {};
    editFields().forEach(f => {
        let v = formValue(f);
        if (f.meta) { meta[f.key] = v; return; }
        if (f.dash && !v) v = '-';
        data[f.key] = f.write ? f.write(v) : v;
    });
    return { data, meta };
}

function snapshotEditForm() {
    return JSON.stringify(editFields().map(f => formValue(f)));
}

// Daftar perubahan dibanding data saat ini: [{ label, from, to, field }]
function pendingChanges() {
    const item = editModal.item;
    const out = [];
    editFields().filter(f => !f.meta).forEach(f => {
        const raw = f.read ? f.read(item) : item[f.key];
        const before = raw == null ? '' : String(raw);
        let now = formValue(f);
        if (f.dash && !now) now = '-';
        if (now !== before && !(f.dash && before === '-' && now === '-')) out.push({ field: f, label: f.label, from: before || '-', to: now || '-' });
    });
    return out;
}

function changeValueHtml(f, v) {
    if (f.key === 'chiefSampleStatus') return formatChiefBadge(v === 'O' ? 'Done' : 'Not Started');
    if (['preLayoutStatus', 'ppApprovalStatus', 'status'].includes(f.key)) return formatMiniBadge(v);
    return `<span class="font-medium text-slate-800">${esc(v)}</span>`;
}

function updateEditSummary() {
    const box = document.getElementById('editChangeSummary');
    if (!box) return;
    const ch = pendingChanges();
    const hasNote = !!(formValue({ key: 'note' }) || formValue({ key: 'reason' }));
    if (!ch.length) {
        box.classList.add('hidden');
        box.innerHTML = '';
    } else {
        box.classList.remove('hidden');
        box.innerHTML = `<p class="text-xs font-semibold text-indigo-800 mb-2">Ringkasan perubahan (${ch.length})</p>` +
            ch.map(c => `<div class="flex flex-wrap items-center gap-2 text-xs text-slate-600 py-0.5"><span class="w-32 shrink-0">${esc(c.label)}</span>` +
                `${changeValueHtml(c.field, c.from)}<span class="text-slate-400">&rarr;</span>${changeValueHtml(c.field, c.to)}</div>`).join('');
    }
    // tandai kolom yang berubah
    const changed = new Set(ch.map(c => c.field.key));
    editFields().filter(f => !f.meta).forEach(f => {
        const el = document.getElementById('edit_' + f.key);
        if (el) el.classList.toggle('field-changed', changed.has(f.key));
    });
    editModal.hasNote = hasNote;
}

function updateEditDays() {
    const out = document.getElementById('editDaysDisplay');
    const a = document.getElementById('edit_reportDate');
    const b = document.getElementById('edit_plannedStartDate');
    if (!out || !b) return;
    const from = a ? a.value : editModal.item.reportDate;
    const d = calculateDaysToStart(from, b.value);
    out.textContent = d <= 0 ? '0 Hari' : `${d} Hari lagi`;
}

function onEditInput() {
    if (!editModal.table) return;   // modal sudah ditutup (mis. 'change' susulan saat fokus berpindah)
    updateEditSummary();
    updateEditDays();
}

// ---------- Buka / tutup ----------
function openEditModal(table, id, mode) {
    const schema = EDIT_SCHEMA[table];
    const item = schema && schema.list().find(r => r.id === id);
    if (!item) return showToast('Data tidak ditemukan. Mungkin sudah dihapus pengguna lain.');
    if (mode === 'correction' && !canCorrect(item)) {
        return showToast('Koreksi hanya untuk admin atau pembuat data. Gunakan Update Progress untuk mencatat perkembangan.');
    }

    Object.assign(editModal, { table, id, mode, item, saving: false, hasNote: false, lastFocus: document.activeElement });
    const m = EDIT_MODES[mode];
    const root = document.getElementById('editModal');
    root.dataset.mode = mode;

    document.getElementById('editModalTitle').textContent = m.title;
    document.getElementById('editModalBadge').textContent = m.badge;
    document.getElementById('editModalSubtitle').textContent = `Line ${item.line} · ${item.engineer}`;
    document.getElementById('editModalInfo').textContent = m.info;
    document.getElementById('editModalFields').innerHTML = editFormHtml(item);
    const btn = document.getElementById('editModalSave');
    btn.disabled = false;
    btn.textContent = m.save;

    const box = document.getElementById('editModalFields');
    box.oninput = onEditInput;
    box.onchange = onEditInput;
    updateEditDays();
    updateEditSummary();
    editModal.snapshot = snapshotEditForm();

    root.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', editModalKeydown);
    requestAnimationFrame(() => root.classList.add('modal-open'));
    const first = root.querySelector('input:not([type=hidden]), select, textarea');
    if (first) setTimeout(() => first.focus(), 50);
}

function closeEditModal() {
    const root = document.getElementById('editModal');
    root.classList.remove('modal-open');
    document.removeEventListener('keydown', editModalKeydown);
    document.body.style.overflow = '';
    setTimeout(() => { if (!root.classList.contains('modal-open')) root.classList.add('hidden'); }, 180);
    const back = editModal.lastFocus;
    const box = document.getElementById('editModalFields');
    box.oninput = null;
    box.onchange = null;
    editModal.table = null;
    editModal.id = null;
    if (back && typeof back.focus === 'function') { try { back.focus(); } catch (e) {} }
}

// Tutup lewat X / Batal / klik latar / Esc. Jika ada isian yang diubah, tanya dulu.
function requestCloseEditModal() {
    if (editModal.saving || !editModal.table) return;
    if (snapshotEditForm() !== editModal.snapshot && !confirm('Perubahan belum disimpan. Tutup tanpa menyimpan?')) return;
    closeEditModal();
}

function editModalKeydown(e) {
    if (e.key === 'Escape') { e.preventDefault(); requestCloseEditModal(); return; }
    if (e.key !== 'Tab') return;
    const nodes = [...document.getElementById('editModalPanel').querySelectorAll('button, input, select, textarea')]
        .filter(n => !n.disabled && n.offsetParent !== null);
    if (!nodes.length) return;
    const first = nodes[0], last = nodes[nodes.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

// ---------- Simpan ----------
function friendlySaveError(err) {
    const msg = (err && err.message) || String(err);
    if ((err && err.code === 'PGRST202') || /could not find the function|save_with_history/i.test(msg)) {
        return 'Fitur riwayat belum aktif di database. Jalankan supabase/history.sql di Supabase SQL Editor, lalu coba lagi.';
    }
    return msg;
}

async function submitEditModal() {
    if (editModal.saving || !editModal.table) return;
    const schema = EDIT_SCHEMA[editModal.table];
    const { table, id, mode } = editModal;
    const { data, meta } = readEditValues();
    const note = (mode === 'progress' ? meta.note : meta.reason) || '';
    const btn = document.getElementById('editModalSave');

    // Tidak ada yang berubah & tidak ada catatan: jangan buat riwayat kosong
    if (!pendingChanges().length && !(mode === 'progress' && note)) {
        return showToast('Belum ada perubahan untuk disimpan.');
    }

    editModal.saving = true;
    btn.disabled = true;
    btn.textContent = 'Menyimpan...';
    markOwnAction();

    try {
        const payload = schema.toDb({ id, ...data });
        delete payload.id;
        const { data: res, error } = await sb.rpc('save_with_history', {
            p_table: table,
            p_id: id,
            p_kind: mode,
            p_data: payload,
            p_note: note || null,
            p_effective: mode === 'progress' ? (meta.effectiveDate || null) : null
        });
        if (error) throw error;
        if (res && res.changed === false) showToast('Tidak ada perubahan yang tersimpan.');
        else showToast(mode === 'progress' ? 'Update progress tersimpan di riwayat.' : 'Koreksi data tersimpan di riwayat.');
    } catch (err) {
        editModal.saving = false;
        btn.disabled = false;
        btn.textContent = EDIT_MODES[mode].save;
        showToast('Gagal menyimpan: ' + friendlySaveError(err), 6000);   // modal tetap terbuka agar isian tidak hilang
        return;
    }

    editModal.saving = false;
    closeEditModal();
    await loadData();
}

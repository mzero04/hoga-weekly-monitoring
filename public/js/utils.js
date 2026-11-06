/* Fungsi bantu: escape HTML, mapping DB, perhitungan status, badge, toast */

// ---------- HELPERS ----------
function safeIcons() {
    try { if (window.lucide) lucide.createIcons(); } catch (e) { console.warn('lucide gagal:', e); }
}

function esc(v) {
    return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function isAdmin() {
    return currentProfile && currentProfile.role === 'admin';
}

// Cocokkan nama akun yang login dengan daftar Engineer.
// 1) nama lengkap sama persis (tanpa peduli huruf besar/kecil), 2) nama depan unik.
function getMyEngineer() {
    if (!currentProfile || !currentProfile.full_name) return '';
    const name = currentProfile.full_name.trim().toLowerCase();
    if (!name) return '';
    const exact = MASTER_ENGINEERS.find(e => e.toLowerCase() === name);
    if (exact) return exact;
    const first = name.split(/\s+/)[0];
    const byFirst = MASTER_ENGINEERS.filter(e => e.toLowerCase().split(' ')[0] === first);
    return byFirst.length === 1 ? byFirst[0] : '';
}

// Isi otomatis Engineer PIC sesuai akun. User biasa dikunci ke namanya sendiri; admin tetap bisa memilih.
function applyDefaultEngineer() {
    const mine = getMyEngineer();
    const lock = !!mine && !isAdmin();
    ['monEngineer', 'ovrEngineer'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.disabled = lock;
        el.classList.toggle('opacity-70', lock);
        el.classList.toggle('cursor-not-allowed', lock);
        el.value = mine || '';
    });
}

// DB <-> APP MAPPING
function monFromDb(r) {
    return {
        id: r.id,
        reportDate: r.report_date,
        engineer: r.engineer,
        line: r.line,
        currentStyle: r.current_style || '-',
        nextStyle: r.next_style || '-',
        plannedStartDate: r.planned_start_date,
        preLayoutStatus: r.pre_layout_status,
        ppApprovalStatus: r.pp_approval_status,
        chiefSampleStatus: r.chief_sample_status,
        remark: r.remark || '-',
        createdBy: r.created_by || null
    };
}

function monToDb(m) {
    const o = {
        report_date: m.reportDate,
        engineer: m.engineer,
        line: m.line,
        current_style: m.currentStyle,
        next_style: m.nextStyle,
        planned_start_date: m.plannedStartDate,
        pre_layout_status: m.preLayoutStatus,
        pp_approval_status: m.ppApprovalStatus,
        chief_sample_status: m.chiefSampleStatus,
        remark: m.remark
    };
    if (m.id && !String(m.id).startsWith('mon-')) o.id = m.id;
    return o;
}

function ovrFromDb(r) {
    return {
        id: r.id,
        reportWeekStart: r.report_week_start,
        engineer: r.engineer,
        line: r.line,
        currentStyle: r.current_style || '-',
        nextStyle: r.next_style || '-',
        plannedOverlineDate: r.planned_overline_date,
        status: r.status,
        remark: r.remark || '-',
        createdBy: r.created_by || null
    };
}

function ovrToDb(o) {
    const x = {
        report_week_start: o.reportWeekStart,
        engineer: o.engineer,
        line: o.line,
        current_style: o.currentStyle,
        next_style: o.nextStyle,
        planned_overline_date: o.plannedOverlineDate,
        status: o.status,
        remark: o.remark
    };
    if (o.id && !String(o.id).startsWith('ovr-')) x.id = o.id;
    return x;
}

// HELPER FUNCTIONS FOR CALCULATIONS & STATUS
function calculateSummaryStatus(item) {
    const statuses = [item.preLayoutStatus, item.ppApprovalStatus, item.chiefSampleStatus];
    if (statuses.every(s => s === 'Done' || s === 'N/A')) {
        return 'Ready';
    } else if (SHOW_AT_RISK && (statuses.includes('Pending') || statuses.includes('Not Started'))) {
        return 'At Risk';
    } else {
        return 'In Progress';
    }
}

function calculateDaysToStart(reportDateStr, plannedDateStr) {
    if (!reportDateStr || !plannedDateStr) return 0;
    const start = new Date(reportDateStr);
    const planned = new Date(plannedDateStr);
    const diffTime = planned - start;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function calcDaysToStart() {
    const rep = document.getElementById('monReportDate').value;
    const plan = document.getElementById('monPlannedStartDate').value;
    const days = calculateDaysToStart(rep, plan);
    const display = document.getElementById('monDaysToStartDisplay');
    if (isNaN(days)) {
        display.innerText = "0 Hari";
    } else {
        display.innerText = `${days} Hari lagi`;
    }
}

// Chief Sample ditampilkan sebagai O / X (di database tetap disimpan Done / Not Started)
function chiefLabel(status) {
    return (status === 'Done' || status === 'N/A') ? 'O' : 'X';
}

function chiefToDb(v) {
    return String(v).trim().toUpperCase() === 'O' ? 'Done' : 'Not Started';
}

function formatChiefBadge(status) {
    return chiefLabel(status) === 'O'
        ? `<span class="text-xs px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold rounded">O</span>`
        : `<span class="text-xs px-2 py-0.5 bg-rose-100 text-rose-800 font-bold rounded">X</span>`;
}

function formatMiniBadge(status) {
    switch(status) {
        case 'Done': return `<span class="text-[10px] px-1.5 py-0.5 bg-emerald-100 text-emerald-800 font-medium rounded">Done</span>`;
        case 'In Progress': return `<span class="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-800 font-medium rounded">In Progress</span>`;
        case 'Pending': return `<span class="text-[10px] px-1.5 py-0.5 bg-rose-100 text-rose-800 font-medium rounded">Pending</span>`;
        case 'Not Started': return `<span class="text-[10px] px-1.5 py-0.5 bg-slate-200 text-slate-700 font-medium rounded">Not Started</span>`;
        default: return `<span class="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 font-medium rounded">N/A</span>`;
    }
}

// NOTIFICATION TOAST
function showToast(message, ms) {
    const toast = document.getElementById('toastNotification');
    const toastText = document.getElementById('toastText');
    toastText.innerText = message;
    toast.classList.remove('translate-y-20', 'opacity-0');
    toast.classList.add('translate-y-0', 'opacity-100');

    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => {
        toast.classList.remove('translate-y-0', 'opacity-100');
        toast.classList.add('translate-y-20', 'opacity-0');
    }, ms || 3000);
}

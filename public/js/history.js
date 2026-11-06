/* Riwayat perubahan: pemuatan data riwayat (untuk grafik) dan panel Riwayat per data */

const FIELD_LABELS = {
    report_date: 'Report Date', engineer: 'Engineer', line: 'Line', current_style: 'Current Style', next_style: 'Next Style',
    planned_start_date: 'Planned Start', pre_layout_status: 'Pre-layout', pp_approval_status: 'PP Approval',
    chief_sample_status: 'Chief Sample', remark: 'Remark',
    report_week_start: 'Week Start', planned_overline_date: 'Planned Overline', status: 'Overline Status'
};
const HISTORY_STATUS_FIELDS = new Set(['pre_layout_status', 'pp_approval_status', 'status']);
const HISTORY_DATE_FIELDS = new Set(['report_date', 'planned_start_date', 'report_week_start', 'planned_overline_date']);

const HISTORY_KINDS = {
    create: { label: 'Data dibuat', chip: 'bg-emerald-100 text-emerald-700', dot: '#10b981' },
    progress: { label: 'Update progress', chip: 'bg-indigo-100 text-indigo-700', dot: '#6366f1' },
    correction: { label: 'Koreksi data', chip: 'bg-amber-100 text-amber-700', dot: '#f59e0b' },
    delete: { label: 'Data dihapus', chip: 'bg-rose-100 text-rose-700', dot: '#f43f5e' }
};

const HISTORY_NOT_READY = 'Riwayat belum aktif. Jalankan supabase/history.sql di Supabase SQL Editor.';

function historyErrorText(e) {
    const m = (e && e.message) || String(e);
    return /record_history|does not exist|schema cache/i.test(m) ? HISTORY_NOT_READY : 'Gagal memuat riwayat: ' + m;
}

// Memuat seluruh riwayat (bertahap per 1000 baris) untuk grafik timeline & aktivitas terbaru.
async function loadHistory() {
    if (!sb) return;
    const rows = [];
    const PAGE = 1000;
    try {
        for (let from = 0; ; from += PAGE) {
            const { data, error } = await sb.from('record_history')
                .select('record_table,record_id,kind,changes,note,effective_date,created_at,snapshot,line,engineer,changed_by_name')
                .order('created_at', { ascending: true })
                .range(from, from + PAGE - 1);
            if (error) throw error;
            rows.push(...(data || []));
            if (!data || data.length < PAGE) break;
        }
        historyRows = rows;
        historyAvailable = true;
        historyError = '';
    } catch (e) {
        historyRows = [];
        historyAvailable = false;
        historyError = historyErrorText(e);
    }
}

// Tanggal berlaku terakhir sebuah data (batas paling awal untuk Update Progress berikutnya)
function lastEffectiveDate(table, id) {
    let m = '';
    historyRows.forEach(h => {
        if (h.record_table === table && h.record_id === id && h.kind !== 'delete' && h.effective_date > m) m = h.effective_date;
    });
    return m;
}

// ---------- Format tampilan ----------
function fmtDateId(iso) {
    if (!iso) return '-';
    const d = new Date(String(iso).slice(0, 10) + 'T00:00:00');
    return isNaN(d) ? esc(iso) : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtDateTimeId(iso) {
    const d = new Date(iso);
    return isNaN(d) ? '' : d.toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function historyValueHtml(field, v) {
    if (v === null || v === undefined || v === '') return `<span class="text-slate-400">-</span>`;
    if (field === 'chief_sample_status') return formatChiefBadge(v);
    if (HISTORY_STATUS_FIELDS.has(field)) return formatMiniBadge(v);
    if (HISTORY_DATE_FIELDS.has(field)) return `<span class="font-medium text-slate-800">${esc(fmtDateId(v))}</span>`;
    return `<span class="font-medium text-slate-800">${esc(v)}</span>`;
}

function snapshotSummaryHtml(snap) {
    if (!snap) return '';
    const parts = [];
    if (snap.pre_layout_status !== undefined) {
        parts.push(`Pre-layout ${formatMiniBadge(snap.pre_layout_status)}`, `PP ${formatMiniBadge(snap.pp_approval_status)}`, `Chief ${formatChiefBadge(snap.chief_sample_status)}`);
    } else if (snap.status !== undefined) {
        parts.push(`Status ${formatMiniBadge(snap.status)}`);
    }
    return `<div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 mt-1">${parts.join('')}</div>`;
}

// ---------- Panel Riwayat ----------
const historyView = { table: null, id: null, rows: [], showCorrections: true };

function historyItem(table, id) {
    return (table === 'monitoring' ? monitoringList : overlineList).find(r => r.id === id);
}

function historySummaryHtml(table, item) {
    if (!item) return `<p class="text-xs text-slate-500">Data ini sudah dihapus. Riwayat tetap tersimpan.</p>`;
    if (table === 'monitoring') {
        const days = calculateDaysToStart(item.reportDate, item.plannedStartDate);
        return `<div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">` +
            `<span>Pre-layout ${formatMiniBadge(item.preLayoutStatus)}</span><span>PP ${formatMiniBadge(item.ppApprovalStatus)}</span><span>Chief ${formatChiefBadge(item.chiefSampleStatus)}</span>` +
            `<span>Planned Start <b>${esc(fmtDateId(item.plannedStartDate))}</b> (${days} hr)</span></div>`;
    }
    return `<div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600"><span>Status ${formatMiniBadge(item.status)}</span>` +
        `<span>Planned Overline <b>${esc(fmtDateId(item.plannedOverlineDate))}</b></span></div>`;
}

function historyEntryHtml(h) {
    const k = HISTORY_KINDS[h.kind] || HISTORY_KINDS.progress;
    const changes = (h.changes || []).map(c =>
        `<div class="flex flex-wrap items-center gap-2 text-xs py-0.5"><span class="w-28 shrink-0 text-slate-500">${esc(FIELD_LABELS[c.field] || c.field)}</span>` +
        `${historyValueHtml(c.field, c.from)}<span class="text-slate-400">&rarr;</span>${historyValueHtml(c.field, c.to)}</div>`).join('');
    const body = (h.kind === 'create' || h.kind === 'delete') ? snapshotSummaryHtml(h.snapshot) : changes;
    const note = h.note
        ? `<blockquote class="mt-2 text-xs text-slate-700 bg-slate-50 border-l-2 border-slate-300 rounded-r px-2.5 py-1.5">${esc(h.note)}</blockquote>` : '';
    return `<li class="hist-item">
        <span class="hist-dot" style="background:${k.dot}"></span>
        <div class="flex flex-wrap items-center gap-2">
            <span class="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${k.chip}">${k.label}</span>
            <span class="text-xs font-semibold text-slate-700">${esc(fmtDateId(h.effective_date))}</span>
        </div>
        <div class="text-[11px] text-slate-400 mt-0.5">oleh ${esc(h.changed_by_name || '-')} &middot; dicatat ${esc(fmtDateTimeId(h.created_at))}</div>
        <div class="mt-1.5">${body}</div>${note}
    </li>`;
}

function renderHistoryBody() {
    const body = document.getElementById('historyBody');
    const rows = historyView.rows.filter(h => historyView.showCorrections || h.kind !== 'correction');
    document.getElementById('historyCount').textContent = `${rows.length} entri`;
    if (!rows.length) {
        body.innerHTML = `<p class="text-sm text-slate-400 text-center py-10">Belum ada riwayat.</p>`;
        return;
    }
    body.innerHTML = `<ol class="hist-list">${rows.map(historyEntryHtml).join('')}</ol>`;
}

async function openHistory(table, id) {
    const item = historyItem(table, id);
    Object.assign(historyView, { table, id, rows: [], showCorrections: true });
    document.getElementById('historyShowCorrections').checked = true;
    document.getElementById('historyTitle').textContent = item ? `Riwayat · Line ${item.line}` : 'Riwayat';
    document.getElementById('historySubtitle').textContent = item ? item.engineer : '';
    document.getElementById('historySummary').innerHTML = historySummaryHtml(table, item);
    document.getElementById('historyCount').textContent = '';
    document.getElementById('historyBody').innerHTML = `<p class="text-sm text-slate-400 text-center py-10">Memuat riwayat...</p>`;

    const root = document.getElementById('historyDrawer');
    root.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', historyKeydown);
    requestAnimationFrame(() => root.classList.add('modal-open'));

    try {
        const { data, error } = await sb.from('record_history').select('*')
            .eq('record_table', table).eq('record_id', id).order('created_at', { ascending: false });
        if (error) throw error;
        if (historyView.id !== id) return;   // panel sudah dibuka untuk data lain
        historyView.rows = data || [];
        renderHistoryBody();
    } catch (e) {
        document.getElementById('historyBody').innerHTML = `<p class="text-sm text-rose-600 text-center py-10 px-4">${esc(historyErrorText(e))}</p>`;
    }
}

function toggleHistoryCorrections(on) {
    historyView.showCorrections = !!on;
    renderHistoryBody();
}

function historyKeydown(e) {
    if (e.key === 'Escape') { e.preventDefault(); closeHistory(); }
}

function closeHistory() {
    const root = document.getElementById('historyDrawer');
    root.classList.remove('modal-open');
    document.removeEventListener('keydown', historyKeydown);
    document.body.style.overflow = '';
    historyView.id = null;
    setTimeout(() => { if (!root.classList.contains('modal-open')) root.classList.add('hidden'); }, 200);
}

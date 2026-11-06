/* Grafik timeline progress harian (dibangun dari riwayat perubahan di record_history).
   Cara kerja: untuk tiap data Monitoring, status tahapan diputar ulang dari riwayat (data awal + perubahan
   per tanggal berlaku), lalu dihitung per hari. Hari ini selalu memakai kondisi data saat ini. */

let timelineRange = 30;   // jumlah hari; 0 = semua

const STAGE_KEYS = ['pre_layout_status', 'pp_approval_status', 'chief_sample_status'];

function isoOfDate(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDaysIso(iso, n) {
    const d = new Date(iso + 'T00:00:00');
    d.setDate(d.getDate() + n);
    return isoOfDate(d);
}

function daysBetweenIso(a, b) {
    return Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000);
}

function stageDone(v) {
    return v === 'Done' || v === 'N/A';
}

// Membangun lintasan (track) status tiap data Monitoring dari riwayat.
//  Hasil: [{ id, engineer, line, from, until, points: [{ date, vals }] }]  until = tanggal dihapus (eksklusif) atau null
function buildMonitoringTracks(todayIso) {
    const curById = new Map(monitoringList.map(r => [r.id, r]));
    const byId = new Map();
    historyRows.forEach(h => {
        if (h.record_table !== 'monitoring') return;
        if (!byId.has(h.record_id)) byId.set(h.record_id, []);
        byId.get(h.record_id).push(h);
    });

    const tracks = [];
    byId.forEach((evs, id) => {
        evs.sort((a, b) => (a.effective_date === b.effective_date)
            ? (a.created_at < b.created_at ? -1 : 1)
            : (a.effective_date < b.effective_date ? -1 : 1));
        const create = evs.find(e => e.kind === 'create' && e.snapshot);
        const del = evs.find(e => e.kind === 'delete');
        const cur = curById.get(id);
        if (!create || (!cur && !del)) return;           // tanpa data awal / tidak jelas nasibnya: lewati

        const vals = {};
        STAGE_KEYS.forEach(k => { vals[k] = create.snapshot[k]; });
        const points = [{ date: create.effective_date, vals: { ...vals } }];
        evs.forEach(e => {
            if (e.kind !== 'progress' && e.kind !== 'correction') return;
            let touched = false;
            (e.changes || []).forEach(c => { if (STAGE_KEYS.includes(c.field)) { vals[c.field] = c.to; touched = true; } });
            if (!touched) return;
            const last = points[points.length - 1];
            if (last.date === e.effective_date) last.vals = { ...vals };
            else points.push({ date: e.effective_date, vals: { ...vals } });
        });

        const src = cur ? { engineer: cur.engineer, line: cur.line } : (del && del.snapshot ? del.snapshot : { engineer: create.engineer, line: create.line });
        tracks.push({ id, engineer: src.engineer, line: src.line, from: create.effective_date, until: del ? del.effective_date : null, points, cur });
    });

    // Data yang ada sekarang tetapi belum punya riwayat awal: dianggap mulai hari ini
    monitoringList.forEach(r => {
        if (byId.has(r.id) && byId.get(r.id).some(e => e.kind === 'create')) return;
        tracks.push({
            id: r.id, engineer: r.engineer, line: r.line, from: todayIso, until: null, cur: r,
            points: [{ date: todayIso, vals: { pre_layout_status: r.preLayoutStatus, pp_approval_status: r.ppApprovalStatus, chief_sample_status: r.chiefSampleStatus } }]
        });
    });
    return tracks;
}

// Deret harian: { days, ready, progress, risk, total, pre, pp, chief (persen), firstDate }
function buildTimelineSeries(rangeDays, engineer, line) {
    const today = isoOfDate(new Date());
    const tracks = buildMonitoringTracks(today)
        .filter(t => (engineer === 'ALL' || t.engineer === engineer) && (line === 'ALL' || t.line === line));

    const firstDate = tracks.reduce((m, t) => (!m || t.from < m ? t.from : m), '');
    let start;
    if (rangeDays > 0) start = addDaysIso(today, -(rangeDays - 1));
    else start = firstDate || today;
    if (daysBetweenIso(start, today) > 365) start = addDaysIso(today, -365);
    if (firstDate && firstDate > start) start = firstDate;            // jangan tampilkan hari sebelum ada data
    const minStart = addDaysIso(today, -6);                           // tapi tampilkan minimal 7 hari
    if (start > minStart) start = minStart;

    const out = { days: [], ready: [], progress: [], risk: [], total: [], pre: [], pp: [], chief: [], firstDate };
    for (let d = start; d <= today; d = addDaysIso(d, 1)) {
        let ready = 0, progress = 0, risk = 0, total = 0, pre = 0, pp = 0, chief = 0;
        tracks.forEach(t => {
            if (d < t.from) return;
            if (t.until && d >= t.until) return;
            let vals;
            if (d === today && t.cur) {
                vals = { pre_layout_status: t.cur.preLayoutStatus, pp_approval_status: t.cur.ppApprovalStatus, chief_sample_status: t.cur.chiefSampleStatus };
            } else {
                vals = t.points[0].vals;
                for (let i = 0; i < t.points.length && t.points[i].date <= d; i++) vals = t.points[i].vals;
            }
            total++;
            const st = calculateSummaryStatus({ preLayoutStatus: vals.pre_layout_status, ppApprovalStatus: vals.pp_approval_status, chiefSampleStatus: vals.chief_sample_status });
            if (st === 'Ready') ready++; else if (st === 'At Risk') risk++; else progress++;
            if (stageDone(vals.pre_layout_status)) pre++;
            if (stageDone(vals.pp_approval_status)) pp++;
            if (stageDone(vals.chief_sample_status)) chief++;
        });
        const pct = n => total ? Math.round(n / total * 100) : 0;
        out.days.push(d);
        out.ready.push(ready); out.progress.push(progress); out.risk.push(risk); out.total.push(total);
        out.pre.push(pct(pre)); out.pp.push(pct(pp)); out.chief.push(pct(chief));
    }
    return out;
}

function shortDateLabel(iso) {
    return new Date(iso + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

function setTimelineRange(n) {
    timelineRange = n;
    renderTimeline();
}

function updateTimelineRangeButtons() {
    document.querySelectorAll('[data-range-btn]').forEach(b => {
        const on = Number(b.dataset.rangeBtn) === timelineRange;
        b.className = 'px-3 py-1.5 text-xs font-medium rounded-lg border ' +
            (on ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'text-slate-600 border-slate-200 hover:bg-slate-50');
    });
}

function timelineNotice(text) {
    const el = document.getElementById('timelineNotice');
    if (!el) return;
    el.textContent = text || '';
    el.classList.toggle('hidden', !text);
}

// Aktivitas terbaru: update progress terakhir sesuai filter dashboard
function renderRecentActivity(engineer, line) {
    const el = document.getElementById('timelineActivity');
    if (!el) return;
    const rows = historyRows
        .filter(h => h.record_table === 'monitoring' && h.kind === 'progress')
        .filter(h => (engineer === 'ALL' || h.engineer === engineer) && (line === 'ALL' || h.line === line))
        .slice(-6).reverse();
    if (!rows.length) { el.innerHTML = ''; return; }
    el.innerHTML = `<h4 class="text-sm font-semibold text-slate-700 mb-2">Update Progress Terbaru</h4><ul class="divide-y divide-slate-100">` +
        rows.map(h => {
            const ch = (h.changes || []).filter(c => STAGE_KEYS.includes(c.field))
                .map(c => `${esc(FIELD_LABELS[c.field])} ${historyValueHtml(c.field, c.from)}<span class="text-slate-400"> &rarr; </span>${historyValueHtml(c.field, c.to)}`).join('<span class="mx-2 text-slate-300">|</span>');
            return `<li class="py-2 text-xs text-slate-600 flex flex-wrap items-center gap-x-3 gap-y-1">` +
                `<span class="font-semibold text-slate-800">Line ${esc(h.line || '-')}</span><span>${esc(h.engineer || '')}</span>` +
                `<span class="text-slate-400">${esc(fmtDateId(h.effective_date))}</span>${ch ? `<span>${ch}</span>` : ''}` +
                `${h.note ? `<span class="italic text-slate-500">&ldquo;${esc(h.note)}&rdquo;</span>` : ''}</li>`;
        }).join('') + `</ul>`;
}

function renderTimeline() {
    const wrap = document.getElementById('timelineCharts');
    if (!wrap) return;
    updateTimelineRangeButtons();
    const engineer = document.getElementById('filterEngineer').value;
    const line = document.getElementById('filterLine').value;

    if (chartTimelineInstance) { chartTimelineInstance.destroy(); chartTimelineInstance = null; }
    if (chartStageInstance) { chartStageInstance.destroy(); chartStageInstance = null; }

    if (historyAvailable === false) {
        wrap.classList.add('hidden');
        timelineNotice(historyError || HISTORY_NOT_READY);
        renderRecentActivity(engineer, line);
        return;
    }
    wrap.classList.remove('hidden');

    const s = buildTimelineSeries(timelineRange, engineer, line);
    const today = isoOfDate(new Date());
    timelineNotice(s.firstDate && daysBetweenIso(s.firstDate, today) < 2
        ? `Riwayat baru dimulai ${fmtDateId(s.firstDate)}. Grafik akan terisi seiring Update Progress dicatat dari hari ke hari.` : '');

    const labels = s.days.map(shortDateLabel);
    const common = {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        elements: { point: { radius: 0, hoverRadius: 4 }, line: { tension: 0.2, borderWidth: 2 } },
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } } }
    };
    const xScale = { grid: { display: false }, ticks: { maxTicksLimit: 10, autoSkip: true, maxRotation: 0, font: { size: 10 } } };

    const sets = [
        { label: 'Ready', data: s.ready, borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.35)', fill: 'origin' },
        { label: 'In Progress', data: s.progress, borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.35)', fill: '-1' }
    ];
    if (SHOW_AT_RISK) sets.push({ label: 'At Risk', data: s.risk, borderColor: '#f43f5e', backgroundColor: 'rgba(244,63,94,0.35)', fill: '-1' });

    chartTimelineInstance = new Chart(document.getElementById('chartTimeline').getContext('2d'), {
        type: 'line',
        data: { labels, datasets: sets },
        options: {
            ...common,
            scales: { x: xScale, y: { stacked: true, beginAtZero: true, ticks: { precision: 0 }, title: { display: true, text: 'Jumlah line', font: { size: 10 } } } },
            plugins: {
                ...common.plugins,
                tooltip: { callbacks: { footer: items => `Total: ${s.total[items[0].dataIndex]} line` } }
            }
        }
    });

    chartStageInstance = new Chart(document.getElementById('chartStage').getContext('2d'), {
        type: 'line',
        data: {
            labels,
            datasets: [
                { label: 'Pre-layout', data: s.pre, borderColor: '#3b82f6', backgroundColor: '#3b82f6' },
                { label: 'PP Approval', data: s.pp, borderColor: '#8b5cf6', backgroundColor: '#8b5cf6' },
                { label: 'Chief Sample', data: s.chief, borderColor: '#14b8a6', backgroundColor: '#14b8a6' }
            ]
        },
        options: {
            ...common,
            scales: {
                x: xScale,
                y: { min: 0, max: 100, ticks: { callback: v => v + '%' }, title: { display: true, text: '% line selesai (Done / N/A)', font: { size: 10 } } }
            },
            plugins: { ...common.plugins, tooltip: { callbacks: { label: c => `${c.dataset.label}: ${c.parsed.y}%` } } }
        }
    });

    renderRecentActivity(engineer, line);
}

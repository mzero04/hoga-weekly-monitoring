/* Filter per kolom, pencarian global, dan urutan untuk tabel Data Records */

// Pengelompokan sisa hari sebelum start
const DAYS_BUCKETS = [
    { value: 'late', label: 'Terlambat (< 0 hari)', test: d => d < 0 },
    { value: 'crit', label: 'Kritis (0-2 hari)', test: d => d >= 0 && d < 3 },
    { value: 'week', label: '3-7 hari', test: d => d >= 3 && d <= 7 },
    { value: 'long', label: 'Lebih dari 7 hari', test: d => d > 7 }
];

const SUMMARY_OPTIONS = ['Ready', 'In Progress', 'At Risk'];

function daysLeftOf(item) {
    return calculateDaysToStart(item.reportDate, item.plannedStartDate);
}

// Definisi kolom: dipakai untuk header tabel, baris filter, pencarian, pengurutan, dan laporan PDF.
//  type : 'text' (mengandung), 'date' (tanggal persis), 'select' (pilihan persis)
//  base : daftar pilihan dasar (digabung dengan nilai yang ada di data)
//  fixed: pilihan tetap [{ value, label }]
const RECORD_COLUMNS = {
    monitoring: [
        { key: 'reportDate', label: 'Report Date', type: 'date', get: i => i.reportDate },
        { key: 'engineer', label: 'Engineer', type: 'select', base: () => MASTER_ENGINEERS, get: i => i.engineer },
        { key: 'line', label: 'Line', type: 'select', base: () => MASTER_LINES, get: i => i.line },
        { key: 'currentStyle', label: 'Current Style', type: 'text', get: i => i.currentStyle },
        { key: 'nextStyle', label: 'Next Style', type: 'text', get: i => i.nextStyle },
        { key: 'plannedStartDate', label: 'Planned Start', type: 'date', get: i => i.plannedStartDate },
        {
            key: 'daysLeft', label: 'Days Left', type: 'select', get: daysLeftOf,
            fixed: DAYS_BUCKETS.map(b => ({ value: b.value, label: b.label })),
            match: (i, v) => { const b = DAYS_BUCKETS.find(x => x.value === v); return b ? b.test(daysLeftOf(i)) : true; }
        },
        { key: 'preLayoutStatus', label: 'Pre-Layout', type: 'select', base: () => MASTER_STATUS, get: i => i.preLayoutStatus },
        { key: 'ppApprovalStatus', label: 'PP Approval', type: 'select', base: () => MASTER_STATUS, get: i => i.ppApprovalStatus },
        {
            key: 'chiefSampleStatus', label: 'Chief Sample', type: 'select',
            fixed: [{ value: 'O', label: 'O' }, { value: 'X', label: 'X' }],
            get: i => chiefLabel(i.chiefSampleStatus)
        },
        {
            key: 'summary', label: 'Status Line', type: 'select',
            fixed: SUMMARY_OPTIONS.map(v => ({ value: v, label: v })),
            get: i => calculateSummaryStatus(i)
        },
        { key: 'remark', label: 'Catatan / Remark', type: 'text', get: i => i.remark }
    ],
    overline: [
        { key: 'reportWeekStart', label: 'Week Start', type: 'date', get: i => i.reportWeekStart },
        { key: 'engineer', label: 'Engineer', type: 'select', base: () => MASTER_ENGINEERS, get: i => i.engineer },
        { key: 'line', label: 'Line', type: 'select', base: () => MASTER_LINES, get: i => i.line },
        { key: 'currentStyle', label: 'Current Style', type: 'text', get: i => i.currentStyle },
        { key: 'nextStyle', label: 'Next Style', type: 'text', get: i => i.nextStyle },
        { key: 'plannedOverlineDate', label: 'Planned Overline Date', type: 'date', get: i => i.plannedOverlineDate },
        { key: 'status', label: 'Overline Status', type: 'select', base: () => MASTER_STATUS, get: i => i.status },
        { key: 'remark', label: 'Remark / Cause', type: 'text', get: i => i.remark }
    ]
};

// STATE filter & urutan (per tabel). Disimpan di memori, tidak hilang saat data diperbarui realtime.
const recordFilters = { monitoring: {}, overline: {} };
const recordSort = { monitoring: null, overline: null };   // { key, dir: 'asc' | 'desc' } atau null
let recordRenderTimer = null;

const recordCollator = new Intl.Collator('id', { numeric: true, sensitivity: 'base' });

function recordList(table) {
    return table === 'monitoring' ? monitoringList : overlineList;
}

function recordSuffix(table) {
    return table === 'monitoring' ? 'Monitoring' : 'Overline';
}

function getRecordSearch() {
    const el = document.getElementById('recordSearchInput');
    return el ? el.value.trim() : '';
}

function columnOf(table, key) {
    return RECORD_COLUMNS[table].find(c => c.key === key);
}

function optionLabel(col, value) {
    if (col.fixed) {
        const o = col.fixed.find(x => x.value === value);
        if (o) return o.label;
    }
    return value;
}

// Daftar filter yang sedang aktif (termasuk pencarian) - dipakai untuk chip di layar dan teks di PDF.
function getActiveFilters(table) {
    const out = [];
    const q = getRecordSearch();
    if (q) out.push({ key: '__search', label: 'Pencarian', text: q });
    RECORD_COLUMNS[table].forEach(col => {
        const v = recordFilters[table][col.key];
        if (v) out.push({ key: col.key, label: col.label, text: optionLabel(col, v) });
    });
    return out;
}

function describeRecordSort(table) {
    const s = recordSort[table];
    if (!s) return '';
    const col = columnOf(table, s.key);
    return col ? `${col.label} (${s.dir === 'asc' ? 'A-Z / terlama' : 'Z-A / terbaru'})` : '';
}

// Data yang tampil: sudah disaring (pencarian + filter kolom) dan diurutkan.
function getFilteredRecords(table) {
    const cols = RECORD_COLUMNS[table];
    const f = recordFilters[table];
    const q = getRecordSearch().toLowerCase();

    let list = recordList(table).filter(item => {
        if (q) {
            const hay = cols.map(c => String(c.get(item) ?? '')).join(' ').toLowerCase();
            if (!hay.includes(q)) return false;
        }
        return cols.every(c => {
            const v = f[c.key];
            if (!v) return true;
            if (c.match) return c.match(item, v);
            const val = String(c.get(item) ?? '');
            return c.type === 'text' ? val.toLowerCase().includes(v.toLowerCase()) : val === v;
        });
    });

    const s = recordSort[table];
    const col = s && columnOf(table, s.key);
    if (col) {
        const dir = s.dir === 'desc' ? -1 : 1;
        list = list.slice().sort((a, b) => {
            const x = col.get(a), y = col.get(b);
            const r = (typeof x === 'number' && typeof y === 'number') ? x - y : recordCollator.compare(String(x ?? ''), String(y ?? ''));
            return r * dir;
        });
    }
    return list;
}

// ---------- Header tabel + baris filter ----------
function filterControlHtml(table, col) {
    const attrs = `class="rec-filter" data-filter-key="${col.key}" aria-label="Filter ${esc(col.label)}"`;
    if (col.type === 'text') {
        return `<input type="text" ${attrs} placeholder="Cari..." oninput="setRecordFilter('${table}','${col.key}',this)">`;
    }
    if (col.type === 'date') {
        return `<input type="date" ${attrs} onchange="setRecordFilter('${table}','${col.key}',this)">`;
    }
    return `<select ${attrs} onchange="setRecordFilter('${table}','${col.key}',this)"></select>`;
}

function buildRecordHeaders() {
    ['monitoring', 'overline'].forEach(table => {
        const thead = document.getElementById('thead' + recordSuffix(table));
        if (!thead) return;
        const cols = RECORD_COLUMNS[table];
        const head = cols.map(c =>
            `<th class="p-3 pb-2 whitespace-nowrap uppercase cursor-pointer select-none hover:bg-slate-200" data-sort-key="${c.key}" onclick="toggleRecordSort('${table}','${c.key}')" title="Klik untuk mengurutkan">${esc(c.label)} <span class="sort-ind text-indigo-600"></span></th>`
        ).join('');
        const filters = cols.map(c => `<th class="px-2 pb-2 pt-0 font-normal normal-case">${filterControlHtml(table, c)}</th>`).join('');
        thead.innerHTML =
            `<tr>${head}<th class="p-3 pb-2 text-center uppercase">Aksi</th></tr>` +
            `<tr>${filters}<th class="px-2 pb-2 pt-0 text-center"><button onclick="clearRecordFilters('${table}')" class="text-xs text-indigo-600 hover:underline whitespace-nowrap" title="Hapus semua filter">Reset</button></th></tr>`;
    });
    syncFilterOptions();
    updateSortIndicators('monitoring');
    updateSortIndicators('overline');
}

// Isi pilihan dropdown dari master + nilai yang ada di data. Hanya dibangun ulang jika berubah,
// supaya dropdown yang sedang dibuka tidak tertutup saat data realtime masuk.
function syncFilterOptions() {
    ['monitoring', 'overline'].forEach(table => {
        const thead = document.getElementById('thead' + recordSuffix(table));
        if (!thead) return;
        const list = recordList(table);
        RECORD_COLUMNS[table].filter(c => c.type === 'select').forEach(col => {
            const el = thead.querySelector(`select[data-filter-key="${col.key}"]`);
            if (!el) return;
            let opts;
            if (col.fixed) {
                opts = col.fixed;
            } else {
                const base = col.base ? col.base() : [];
                const extra = new Set();
                list.forEach(i => { const v = col.get(i); if (v && !base.includes(v)) extra.add(v); });
                const cur = recordFilters[table][col.key];
                if (cur && !base.includes(cur)) extra.add(cur);
                opts = base.concat([...extra].sort(recordCollator.compare)).map(v => ({ value: v, label: v }));
            }
            const sig = opts.map(o => o.value).join('|');
            if (el.dataset.sig === sig) return;
            el.dataset.sig = sig;
            el.innerHTML = `<option value="">Semua</option>` + opts.map(o => `<option value="${esc(o.value)}">${esc(o.label)}</option>`).join('');
            el.value = recordFilters[table][col.key] || '';
        });
    });
}

function updateSortIndicators(table) {
    const thead = document.getElementById('thead' + recordSuffix(table));
    if (!thead) return;
    const s = recordSort[table];
    thead.querySelectorAll('th[data-sort-key]').forEach(th => {
        const ind = th.querySelector('.sort-ind');
        if (!ind) return;
        ind.textContent = (s && s.key === th.dataset.sortKey) ? (s.dir === 'asc' ? '▲' : '▼') : '';
    });
}

// ---------- Aksi ----------
function scheduleRecordRender() {
    clearTimeout(recordRenderTimer);
    recordRenderTimer = setTimeout(renderTables, 120);
}

function setRecordFilter(table, key, el) {
    const v = (el.value || '').trim();
    if (v) recordFilters[table][key] = v; else delete recordFilters[table][key];
    el.classList.toggle('active', !!v);
    scheduleRecordRender();
}

function toggleRecordSort(table, key) {
    const s = recordSort[table];
    if (!s || s.key !== key) recordSort[table] = { key, dir: 'asc' };
    else if (s.dir === 'asc') recordSort[table] = { key, dir: 'desc' };
    else recordSort[table] = null;
    updateSortIndicators(table);
    renderTables();
}

function resetFilterControl(table, key) {
    const thead = document.getElementById('thead' + recordSuffix(table));
    const el = thead && thead.querySelector(`[data-filter-key="${key}"]`);
    if (el) { el.value = ''; el.classList.remove('active'); }
}

function removeRecordFilter(table, key) {
    if (key === '__search') {
        const s = document.getElementById('recordSearchInput');
        if (s) s.value = '';
    } else {
        delete recordFilters[table][key];
        resetFilterControl(table, key);
    }
    renderTables();
}

function clearRecordFilters(table) {
    Object.keys(recordFilters[table]).forEach(k => resetFilterControl(table, k));
    recordFilters[table] = {};
    const s = document.getElementById('recordSearchInput');
    if (s) s.value = '';
    renderTables();
}

// Bar ringkasan filter aktif di atas tabel: "Menampilkan X dari Y data" + chip yang bisa dihapus satu per satu.
function renderFilterBar(table, shown, total) {
    const el = document.getElementById('filterBar' + recordSuffix(table));
    if (!el) return;
    const active = getActiveFilters(table);
    if (!active.length) {
        el.innerHTML = '';
        el.classList.add('hidden');
        return;
    }
    el.classList.remove('hidden');
    const chips = active.map(a =>
        `<span class="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs">` +
        `${esc(a.label)}: <b>${esc(a.text)}</b>` +
        `<button onclick="removeRecordFilter('${table}','${a.key}')" class="w-4 h-4 leading-none rounded-full hover:bg-indigo-200" title="Hapus filter ini" aria-label="Hapus filter ${esc(a.label)}">&times;</button></span>`
    ).join('');
    el.innerHTML =
        `<span class="text-xs text-slate-600">Menampilkan <b>${shown}</b> dari <b>${total}</b> data</span>` +
        chips +
        `<button onclick="clearRecordFilters('${table}')" class="text-xs text-rose-600 hover:underline">Reset semua filter</button>`;
}

function initRecordFilters() {
    buildRecordHeaders();
}

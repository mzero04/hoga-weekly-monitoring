/* Export dan Import Excel */

// EXPORT / IMPORT EXCEL
const MON_HEADERS = ['Report Date', 'Engineer', 'Line', 'Current Style', 'Next Style', 'Planned Start Date', 'Pre-layout Status', 'PP Approval Status', 'Chief Sample Status', 'Remark'];

const OVR_HEADERS = ['Report Week Start', 'Engineer', 'Line', 'Current Style', 'Next Style', 'Planned Overline Date', 'Overline Status', 'Remark'];

function makeSheet(headers, rows) {
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws['!cols'] = headers.map(h => ({ wch: Math.max(16, h.length + 2) }));
    return ws;
}

function exportToExcel() {
    if (typeof XLSX === 'undefined') return showToast('Library Excel gagal dimuat. Matikan ad blocker lalu refresh.');

    const monRows = monitoringList.map(m => [
        m.reportDate, m.engineer, m.line, m.currentStyle, m.nextStyle, m.plannedStartDate,
        m.preLayoutStatus, m.ppApprovalStatus, chiefLabel(m.chiefSampleStatus), m.remark
    ]);
    const ovrRows = overlineList.map(o => [
        o.reportWeekStart, o.engineer, o.line, o.currentStyle, o.nextStyle,
        o.plannedOverlineDate, o.status, o.remark
    ]);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, makeSheet(MON_HEADERS, monRows), 'Monitoring');
    XLSX.utils.book_append_sheet(wb, makeSheet(OVR_HEADERS, ovrRows), 'Overline');
    XLSX.writeFile(wb, `HOGA_B_Monitoring_${new Date().toISOString().split('T')[0]}.xlsx`);
    showToast("Export Excel berhasil diunduh.");
}

// Ambil nilai kolom tanpa peduli besar/kecil huruf & spasi pada header
function getCol(row, name) {
    const target = name.toLowerCase().replace(/\s+/g, '');
    for (const key of Object.keys(row)) {
        if (key.toLowerCase().replace(/\s+/g, '') === target) return row[key];
    }
    return '';
}

function excelDateToIso(v) {
    if (v === undefined || v === null || v === '') return '';
    if (typeof v === 'number') {
        const d = XLSX.SSF.parse_date_code(v);
        if (!d) return '';
        return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
    }
    const str = String(v).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
    const m = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/); // dd/mm/yyyy
    if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    return '';
}

function normStatus(v, fallback) {
    const str = String(v ?? '').trim().toLowerCase();
    return MASTER_STATUS.find(x => x.toLowerCase() === str) || fallback;
}

function normLine(v) {
    let str = String(v ?? '').trim().toUpperCase();
    if (/^\d+$/.test(str)) str = 'B' + str;
    return MASTER_LINES.includes(str) ? str : '';
}

function importFromExcel(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (typeof XLSX === 'undefined') {
        event.target.value = '';
        return showToast('Library Excel gagal dimuat. Matikan ad blocker lalu refresh.');
    }

    const fileReader = new FileReader();
    fileReader.onload = async function(e) {
        try {
            const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
            const findSheet = (name) => {
                const n = wb.SheetNames.find(x => x.toLowerCase() === name);
                return n ? wb.Sheets[n] : null;
            };
            const wsMon = findSheet('monitoring');
            const wsOvr = findSheet('overline');
            if (!wsMon && !wsOvr) throw new Error('Sheet "Monitoring" atau "Overline" tidak ditemukan. Gunakan file hasil Export Excel sebagai template.');

            const monRows = [];
            const ovrRows = [];
            let skipped = 0;

            if (wsMon) {
                XLSX.utils.sheet_to_json(wsMon, { defval: '' }).forEach(r => {
                    const line = normLine(getCol(r, 'Line'));
                    const engineer = String(getCol(r, 'Engineer')).trim();
                    const reportDate = excelDateToIso(getCol(r, 'Report Date'));
                    const plannedStartDate = excelDateToIso(getCol(r, 'Planned Start Date'));
                    if (!line || !engineer || !reportDate || !plannedStartDate) { skipped++; return; }
                    monRows.push(monToDb({
                        reportDate, engineer, line,
                        currentStyle: String(getCol(r, 'Current Style')).trim() || '-',
                        nextStyle: String(getCol(r, 'Next Style')).trim() || '-',
                        plannedStartDate,
                        preLayoutStatus: normStatus(getCol(r, 'Pre-layout Status'), 'Not Started'),
                        ppApprovalStatus: normStatus(getCol(r, 'PP Approval Status'), 'Not Started'),
                        chiefSampleStatus: chiefToDb(['o','done','n/a'].includes(String(getCol(r, 'Chief Sample Status')).trim().toLowerCase()) ? 'O' : 'X'),
                        remark: String(getCol(r, 'Remark')).trim() || '-'
                    }));
                });
            }

            if (wsOvr) {
                XLSX.utils.sheet_to_json(wsOvr, { defval: '' }).forEach(r => {
                    const line = normLine(getCol(r, 'Line'));
                    const engineer = String(getCol(r, 'Engineer')).trim();
                    const reportWeekStart = excelDateToIso(getCol(r, 'Report Week Start'));
                    const plannedOverlineDate = excelDateToIso(getCol(r, 'Planned Overline Date'));
                    if (!line || !engineer || !reportWeekStart || !plannedOverlineDate) { skipped++; return; }
                    ovrRows.push(ovrToDb({
                        reportWeekStart, engineer, line,
                        currentStyle: String(getCol(r, 'Current Style')).trim() || '-',
                        nextStyle: String(getCol(r, 'Next Style')).trim() || '-',
                        plannedOverlineDate,
                        status: normStatus(getCol(r, 'Overline Status'), 'Pending'),
                        remark: String(getCol(r, 'Remark')).trim() || '-'
                    }));
                });
            }

            if (!monRows.length && !ovrRows.length) throw new Error('Tidak ada baris valid untuk diimpor. Pastikan kolom Report Date, Engineer, Line, dan tanggal terisi.');

            const msg = `Impor ${monRows.length} data monitoring dan ${ovrRows.length} data overline?` + (skipped ? `\n(${skipped} baris tidak valid akan dilewati)` : '');
            if (!confirm(msg)) return;
            markOwnAction();

            if (monRows.length) {
                const r = await sb.from('monitoring').insert(monRows);
                if (r.error) throw r.error;
            }
            if (ovrRows.length) {
                const r = await sb.from('overline').insert(ovrRows);
                if (r.error) throw r.error;
            }

            await loadData();
            showToast(`Import Excel berhasil: ${monRows.length} monitoring, ${ovrRows.length} overline` + (skipped ? `, ${skipped} dilewati.` : '.'));
        } catch (err) {
            alert("Gagal mengimpor file: " + (err.message || "Format file tidak valid."));
        }
    };
    fileReader.readAsArrayBuffer(file);
    event.target.value = '';
}

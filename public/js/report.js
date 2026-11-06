/* Laporan PDF: (1) laporan dashboard lengkap, (2) Data Records sesuai filter & urutan di layar */

const PDF_M = 12;            // margin kiri/kanan (mm)
const PDF_TOP = 15;          // margin atas halaman lanjutan (di bawah header tipis)
const PDF_BOTTOM = 14;       // margin bawah (ruang footer)

// Warna sel status: [latar, teks]
const PDF_TONE = {
    good: { fill: [209, 250, 229], text: [4, 120, 87] },
    warn: { fill: [254, 243, 199], text: [180, 83, 9] },
    bad:  { fill: [255, 228, 230], text: [190, 18, 60] },
    idle: { fill: [226, 232, 240], text: [71, 85, 105] },
    none: { fill: [241, 245, 249], text: [100, 116, 139] }
};
const PDF_STATUS_TONE = {
    'Done': 'good', 'Ready': 'good', 'O': 'good',
    'In Progress': 'warn',
    'Pending': 'bad', 'At Risk': 'bad', 'X': 'bad',
    'Not Started': 'idle',
    'N/A': 'none'
};

// Kolom tabel PDF. w = lebar (mm), kolom 'rest' mengisi sisa lebar halaman.
const PDF_MON_COLS = [
    { h: 'Report Date', w: 21, get: m => m.reportDate },
    { h: 'Engineer', w: 35, get: m => m.engineer },
    { h: 'Line', w: 11, center: true, bold: true, get: m => m.line },
    { h: 'Current Style', w: 28, get: m => m.currentStyle },
    { h: 'Next Style', w: 28, get: m => m.nextStyle },
    { h: 'Planned Start', w: 21, get: m => m.plannedStartDate },
    { h: 'Days Left', w: 14, center: true, days: true, get: m => `${daysLeftOf(m)} hr` , raw: m => daysLeftOf(m) },
    { h: 'Pre-Layout', w: 19, center: true, badge: true, get: m => m.preLayoutStatus },
    { h: 'PP Approval', w: 19, center: true, badge: true, get: m => m.ppApprovalStatus },
    { h: 'Chief Sample', w: 15, center: true, badge: true, get: m => chiefLabel(m.chiefSampleStatus) },
    { h: 'Status', w: 19, center: true, badge: true, get: m => calculateSummaryStatus(m) },
    { h: 'Remark', w: 'rest', get: m => m.remark }
];
const PDF_OVR_COLS = [
    { h: 'Week Start', w: 24, get: o => o.reportWeekStart },
    { h: 'Engineer', w: 40, get: o => o.engineer },
    { h: 'Line', w: 13, center: true, bold: true, get: o => o.line },
    { h: 'Current Style', w: 34, get: o => o.currentStyle },
    { h: 'Next Style', w: 34, get: o => o.nextStyle },
    { h: 'Planned Overline', w: 28, get: o => o.plannedOverlineDate },
    { h: 'Status', w: 22, center: true, badge: true, get: o => o.status },
    { h: 'Remark / Cause', w: 'rest', get: o => o.remark }
];

// ---------- Helper umum ----------
function newPdf() {
    if (!window.jspdf || !window.jspdf.jsPDF) { showToast('Library PDF gagal dimuat. Matikan ad blocker lalu refresh.'); return null; }
    const doc = new window.jspdf.jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    if (typeof doc.autoTable !== 'function') { showToast('Plugin tabel PDF gagal dimuat. Matikan ad blocker lalu refresh.'); return null; }
    return doc;
}

function pdfWho() {
    return currentProfile ? (currentProfile.full_name || currentProfile.email || '-') : '-';
}

function pdfNow() {
    return new Date().toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' });
}

// Grafik diubah ke gambar di atas latar putih (canvas Chart.js transparan, di PDF bisa tampak hitam).
function addCanvasToPdf(doc, canvasId, x, y, maxW, maxH) {
    const c = document.getElementById(canvasId);
    if (!c || !c.width || !c.height) return;
    const off = document.createElement('canvas');
    off.width = c.width;
    off.height = c.height;
    const ctx = off.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, off.width, off.height);
    ctx.drawImage(c, 0, 0);
    const ratio = c.width / c.height;
    let w = maxW, h = w / ratio;
    if (h > maxH) { h = maxH; w = h * ratio; }
    doc.addImage(off.toDataURL('image/jpeg', 0.95), 'JPEG', x + (maxW - w) / 2, y, w, h);
}

// Banner besar di halaman pertama
function drawPdfBanner(doc, title, rightLines) {
    const W = doc.internal.pageSize.getWidth();
    doc.setFillColor(49, 46, 129);
    doc.rect(0, 0, W, 20, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text(title, PDF_M, 12.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(199, 210, 254);
    rightLines.forEach((t, i) => doc.text(t, W - PDF_M, 9 + i * 5.5, { align: 'right' }));
}

// Header tipis di halaman lanjutan
function drawPdfSlimHeader(doc, title) {
    const W = doc.internal.pageSize.getWidth();
    doc.setFillColor(49, 46, 129);
    doc.rect(0, 0, W, 9, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(255, 255, 255);
    doc.text(title, PDF_M, 6);
}

function drawPdfFooters(doc) {
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const total = doc.internal.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
        doc.setPage(i);
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.2);
        doc.line(PDF_M, H - 9.5, W - PDF_M, H - 9.5);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184);
        doc.text('HOGA B - Weekly Line Monitoring System', PDF_M, H - 5.5);
        doc.text(`Halaman ${i} dari ${total}`, W - PDF_M, H - 5.5, { align: 'right' });
    }
}

// Kotak ringkasan (KPI). kpis: [{ label, value, color }]
function drawPdfKpis(doc, y, h, kpis) {
    const W = doc.internal.pageSize.getWidth();
    const gap = 4;
    const bw = (W - 2 * PDF_M - gap * (kpis.length - 1)) / kpis.length;
    kpis.forEach((k, i) => {
        const x = PDF_M + i * (bw + gap);
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(x, y, bw, h, 2, 2, 'FD');
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        doc.text(k.label, x + 4, y + 5.5);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(h > 15 ? 14 : 12);
        doc.setTextColor(...k.color);
        doc.text(k.value, x + 4, y + h - 3.5);
    });
}

// Tabel data. cols = PDF_MON_COLS / PDF_OVR_COLS, rows = daftar objek.
function drawPdfTable(doc, cols, rows, startY, slimTitle) {
    const W = doc.internal.pageSize.getWidth();
    const usable = W - 2 * PDF_M;
    const fixed = cols.reduce((s, c) => s + (typeof c.w === 'number' ? c.w : 0), 0);
    const columnStyles = {};
    cols.forEach((c, i) => {
        columnStyles[i] = {
            cellWidth: typeof c.w === 'number' ? c.w : usable - fixed,
            halign: c.center ? 'center' : 'left',
            fontStyle: c.bold ? 'bold' : 'normal'
        };
    });

    doc.autoTable({
        startY,
        margin: { top: PDF_TOP, left: PDF_M, right: PDF_M, bottom: PDF_BOTTOM },
        tableWidth: usable,
        theme: 'grid',
        head: [cols.map(c => c.h)],
        body: rows.map(r => cols.map(c => String(c.get(r) ?? ''))),
        columnStyles,
        showHead: 'everyPage',
        rowPageBreak: 'avoid',
        styles: {
            font: 'helvetica', fontSize: 7.5, cellPadding: { top: 1.8, bottom: 1.8, left: 2, right: 2 },
            overflow: 'linebreak', valign: 'middle', textColor: [51, 65, 85],
            lineColor: [226, 232, 240], lineWidth: 0.2
        },
        headStyles: { fillColor: [49, 46, 129], textColor: 255, fontStyle: 'bold', halign: 'center', valign: 'middle' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        didParseCell: (d) => {
            if (d.section === 'head') {
                const c = cols[d.column.index];
                d.cell.styles.halign = c && c.center ? 'center' : 'left';
                return;
            }
            const c = cols[d.column.index];
            if (!c) return;
            const v = d.cell.raw;
            if (c.badge) {
                const tone = PDF_TONE[PDF_STATUS_TONE[v] || 'none'];
                d.cell.styles.fillColor = tone.fill;
                d.cell.styles.textColor = tone.text;
                d.cell.styles.fontStyle = 'bold';
            } else if (c.days) {
                const n = c.raw(rows[d.row.index]);
                if (n < 3) { d.cell.styles.textColor = [190, 18, 60]; d.cell.styles.fontStyle = 'bold'; }
            }
        },
        didDrawPage: (d) => { if (d.pageNumber > 1) drawPdfSlimHeader(doc, slimTitle); }
    });
    return doc.lastAutoTable.finalY;
}

function pdfSectionTitle(doc, text, y) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text(text, PDF_M, y);
}

function pdfEmptyNote(doc, text, y) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(text, PDF_M, y);
}

function monitoringCounts(list) {
    let ready = 0, prog = 0, risk = 0;
    list.forEach(m => {
        const st = calculateSummaryStatus(m);
        if (st === 'Ready') ready++; else if (st === 'At Risk') risk++; else prog++;
    });
    return { ready, prog, risk };
}

// ================= 1) LAPORAN DASHBOARD LENGKAP =================
function downloadReportPdf() {
    const doc = newPdf();
    if (!doc) return;

    const eng = document.getElementById('filterEngineer').value;
    const line = document.getElementById('filterLine').value;
    const mon = monitoringList
        .filter(i => (eng === 'ALL' || i.engineer === eng) && (line === 'ALL' || i.line === line))
        .sort((a, b) => String(a.plannedStartDate).localeCompare(String(b.plannedStartDate)));
    const ovr = overlineList
        .filter(i => (eng === 'ALL' || i.engineer === eng) && (line === 'ALL' || i.line === line))
        .sort((a, b) => String(a.plannedOverlineDate).localeCompare(String(b.plannedOverlineDate)));

    const { ready, prog, risk } = monitoringCounts(mon);
    const readyPct = mon.length ? Math.round(ready / mon.length * 100) : 0;
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const slim = 'HOGA B - Weekly Line Monitoring Report';

    drawPdfBanner(doc, slim, [
        `Dibuat: ${pdfNow()}   |   Oleh: ${pdfWho()}`,
        `Filter: Engineer = ${eng === 'ALL' ? 'Semua' : eng}, Line = ${line === 'ALL' ? 'Semua' : line}`
    ]);

    drawPdfKpis(doc, 25, 17, [
        { label: 'TOTAL LINE', value: String(mon.length), color: [30, 64, 175] },
        { label: 'LINE READY', value: `${ready} (${readyPct}%)`, color: [5, 150, 105] },
        { label: 'IN PROGRESS', value: String(prog), color: [217, 119, 6] },
        ...(SHOW_AT_RISK ? [{ label: 'AT RISK / DELAY', value: String(risk), color: [225, 29, 72] }] : []),
        { label: 'TOTAL OVERLINE', value: String(ovr.length), color: [126, 34, 206] }
    ]);

    // Grafik (kondisi akhir tanpa animasi)
    [chartReadinessInstance, chartEngineerInstance, chartLineStatusInstance].forEach(c => { try { if (c) c.update('none'); } catch (e) {} });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    doc.text('Status Kesiapan Line', PDF_M, 50);
    doc.text('Status Kesiapan per Engineer', PDF_M + 85, 50);
    addCanvasToPdf(doc, 'chartReadiness', PDF_M, 53, 75, 66);
    addCanvasToPdf(doc, 'chartEngineer', PDF_M + 85, 53, W - 2 * PDF_M - 85, 66);
    doc.text(`Status Tahapan per Line (B1 - B${LINE_COUNT})`, PDF_M, 125);
    addCanvasToPdf(doc, 'chartLineStatus', PDF_M, 128, W - 2 * PDF_M, 66);

    // Tabel Monitoring
    doc.addPage();
    drawPdfSlimHeader(doc, slim);
    pdfSectionTitle(doc, `Data Monitoring Mingguan (${mon.length} data)`, 20);
    let y;
    if (!mon.length) {
        pdfEmptyNote(doc, 'Tidak ada data monitoring.', 27);
        y = 27;
    } else {
        y = drawPdfTable(doc, PDF_MON_COLS, mon, 23, slim);
    }

    // Tabel Overline
    y += 12;
    if (y > H - 45) { doc.addPage(); drawPdfSlimHeader(doc, slim); y = 20; }
    pdfSectionTitle(doc, `Data Overline Mingguan (${ovr.length} data)`, y);
    if (!ovr.length) pdfEmptyNote(doc, 'Tidak ada data overline.', y + 7);
    else drawPdfTable(doc, PDF_OVR_COLS, ovr, y + 3, slim);

    drawPdfFooters(doc);
    doc.save(`HOGA_B_Laporan_${new Date().toISOString().split('T')[0]}.pdf`);
    showToast('Laporan PDF berhasil diunduh.');
}

// ================= 2) DATA RECORDS (mengikuti filter & urutan di layar) =================
function downloadRecordsPdf() {
    const doc = newPdf();
    if (!doc) return;

    const table = activeRecordSubTab;                 // tab yang sedang dibuka
    const isMon = table === 'monitoring';
    const all = recordList(table);
    const rows = getFilteredRecords(table);
    const active = getActiveFilters(table);
    const sortText = describeRecordSort(table);
    const W = doc.internal.pageSize.getWidth();
    const title = isMon ? 'HOGA B - Data Records: Weekly Monitoring' : 'HOGA B - Data Records: Weekly Overline';

    drawPdfBanner(doc, title, [
        `Dibuat: ${pdfNow()}   |   Oleh: ${pdfWho()}`,
        `Menampilkan ${rows.length} dari ${all.length} data`
    ]);

    // Keterangan filter & urutan
    let y = 27;
    doc.setFontSize(8.5);
    const filterText = active.length ? active.map(a => `${a.label} = ${a.text}`).join('   |   ') : 'Tidak ada (semua data ditampilkan)';
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('Filter aktif:', PDF_M, y);
    const labelW = doc.getTextWidth('Filter aktif: ') + 1;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    const body = doc.splitTextToSize(filterText, W - 2 * PDF_M - labelW);
    doc.text(body, PDF_M + labelW, y);
    y += body.length * 4.2;
    if (sortText) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 41, 59);
        doc.text('Diurutkan:', PDF_M, y);
        const labelW2 = doc.getTextWidth('Diurutkan: ') + 1;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(71, 85, 105);
        doc.text(sortText, PDF_M + labelW2, y);
        y += 4.2;
    }
    y += 2;

    // Ringkasan
    let kpis;
    if (isMon) {
        const c = monitoringCounts(rows);
        kpis = [
            { label: 'TOTAL DATA', value: String(rows.length), color: [30, 64, 175] },
            { label: 'READY', value: String(c.ready), color: [5, 150, 105] },
            { label: 'IN PROGRESS', value: String(c.prog), color: [217, 119, 6] },
            ...(SHOW_AT_RISK ? [{ label: 'AT RISK', value: String(c.risk), color: [225, 29, 72] }] : [])
        ];
    } else {
        const n = s => String(rows.filter(r => r.status === s).length);
        kpis = [
            { label: 'TOTAL DATA', value: String(rows.length), color: [30, 64, 175] },
            { label: 'DONE', value: n('Done'), color: [5, 150, 105] },
            { label: 'IN PROGRESS', value: n('In Progress'), color: [217, 119, 6] },
            { label: 'PENDING / NOT STARTED', value: String(rows.filter(r => r.status === 'Pending' || r.status === 'Not Started').length), color: [225, 29, 72] }
        ];
    }
    drawPdfKpis(doc, y, 14, kpis);
    y += 14 + 5;

    if (!rows.length) {
        pdfEmptyNote(doc, 'Tidak ada data yang cocok dengan filter.', y + 4);
    } else {
        drawPdfTable(doc, isMon ? PDF_MON_COLS : PDF_OVR_COLS, rows, y, title);
    }

    drawPdfFooters(doc);
    doc.save(`HOGA_B_Records_${isMon ? 'Monitoring' : 'Overline'}_${new Date().toISOString().split('T')[0]}.pdf`);
    showToast('PDF Data Records berhasil diunduh.');
}

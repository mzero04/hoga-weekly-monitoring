/* Laporan PDF */

// ================= LAPORAN PDF =================
function addCanvasToPdf(doc, canvasId, x, y, maxW, maxH) {
    const c = document.getElementById(canvasId);
    if (!c || !c.width || !c.height) return;
    const ratio = c.width / c.height;
    let w = maxW, h = w / ratio;
    if (h > maxH) { h = maxH; w = h * ratio; }
    doc.addImage(c.toDataURL('image/png'), 'PNG', x + (maxW - w) / 2, y, w, h);
}

function downloadReportPdf() {
    if (!window.jspdf || !window.jspdf.jsPDF) return showToast('Library PDF gagal dimuat. Matikan ad blocker lalu refresh.');
    const doc = new window.jspdf.jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    if (typeof doc.autoTable !== 'function') return showToast('Plugin tabel PDF gagal dimuat. Matikan ad blocker lalu refresh.');

    const eng = document.getElementById('filterEngineer').value;
    const line = document.getElementById('filterLine').value;
    const mon = monitoringList
        .filter(i => (eng === 'ALL' || i.engineer === eng) && (line === 'ALL' || i.line === line))
        .sort((a, b) => String(a.plannedStartDate).localeCompare(String(b.plannedStartDate)));
    const ovr = overlineList
        .filter(i => (eng === 'ALL' || i.engineer === eng) && (line === 'ALL' || i.line === line))
        .sort((a, b) => String(a.plannedOverlineDate).localeCompare(String(b.plannedOverlineDate)));

    let ready = 0, prog = 0, risk = 0;
    mon.forEach(m => {
        const st = calculateSummaryStatus(m);
        if (st === 'Ready') ready++; else if (st === 'At Risk') risk++; else prog++;
    });
    const readyPct = mon.length ? Math.round(ready / mon.length * 100) : 0;

    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const M = 12;
    const who = currentProfile ? (currentProfile.full_name || currentProfile.email || '-') : '-';
    const now = new Date().toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' });

    // --- Header
    doc.setFillColor(49, 46, 129);
    doc.rect(0, 0, W, 20, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text('HOGA B - Weekly Line Monitoring Report', M, 12.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(199, 210, 254);
    doc.text(`Dibuat: ${now}   |   Oleh: ${who}`, W - M, 9, { align: 'right' });
    doc.text(`Filter: Engineer = ${eng === 'ALL' ? 'Semua' : eng}, Line = ${line === 'ALL' ? 'Semua' : line}`, W - M, 14.5, { align: 'right' });

    // --- KPI boxes
    const kpis = [
        { label: 'TOTAL LINE', value: String(mon.length), color: [30, 64, 175] },
        { label: 'LINE READY', value: `${ready} (${readyPct}%)`, color: [5, 150, 105] },
        { label: 'IN PROGRESS', value: String(prog), color: [217, 119, 6] },
        { label: 'AT RISK / DELAY', value: String(risk), color: [225, 29, 72] },
        { label: 'TOTAL OVERLINE', value: String(ovr.length), color: [126, 34, 206] }
    ];
    const gap = 4;
    const bw = (W - 2 * M - gap * (kpis.length - 1)) / kpis.length;
    kpis.forEach((k, i) => {
        const x = M + i * (bw + gap);
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(x, 25, bw, 17, 2, 2, 'FD');
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        doc.text(k.label, x + 4, 31);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(...k.color);
        doc.text(k.value, x + 4, 39);
    });

    // --- Charts (pakai kondisi akhir grafik, tanpa animasi)
    [chartReadinessInstance, chartEngineerInstance, chartLineStatusInstance].forEach(c => { try { if (c) c.update('none'); } catch (e) {} });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    doc.text('Status Kesiapan Line', M, 50);
    doc.text('Status Kesiapan per Engineer', M + 85, 50);
    addCanvasToPdf(doc, 'chartReadiness', M, 53, 75, 66);
    addCanvasToPdf(doc, 'chartEngineer', M + 85, 53, W - 2 * M - 85, 66);
    doc.text('Status Tahapan per Line (B1 - B31)', M, 125);
    addCanvasToPdf(doc, 'chartLineStatus', M, 128, W - 2 * M, 66);

    // --- Tabel Monitoring
    const tableBase = {
        margin: { left: M, right: M },
        styles: { fontSize: 7.5, cellPadding: 1.8, overflow: 'linebreak', textColor: [51, 65, 85] },
        headStyles: { fillColor: [49, 46, 129], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] }
    };

    doc.addPage();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text(`Data Monitoring Mingguan (${mon.length} data)`, M, 16);

    if (!mon.length) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        doc.text('Tidak ada data monitoring.', M, 24);
    } else {
        doc.autoTable({
            ...tableBase,
            startY: 20,
            head: [['Report Date', 'Engineer', 'Line', 'Current Style', 'Next Style', 'Planned Start', 'Days Left', 'Pre-Layout', 'PP Approval', 'Chief Sample', 'Status', 'Remark']],
            body: mon.map(m => [
                m.reportDate, m.engineer, m.line, m.currentStyle, m.nextStyle, m.plannedStartDate,
                `${calculateDaysToStart(m.reportDate, m.plannedStartDate)} hr`,
                m.preLayoutStatus, m.ppApprovalStatus, chiefLabel(m.chiefSampleStatus),
                calculateSummaryStatus(m), m.remark
            ]),
            columnStyles: { 11: { cellWidth: 48 } },
            didParseCell: (d) => {
                if (d.section !== 'body') return;
                const v = d.cell.raw;
                if (d.column.index === 10) {
                    d.cell.styles.fontStyle = 'bold';
                    d.cell.styles.textColor = v === 'Ready' ? [5, 150, 105] : v === 'At Risk' ? [225, 29, 72] : [217, 119, 6];
                } else if (d.column.index === 9) {
                    d.cell.styles.fontStyle = 'bold';
                    d.cell.styles.halign = 'center';
                    d.cell.styles.textColor = v === 'O' ? [5, 150, 105] : [225, 29, 72];
                } else if (d.column.index === 6) {
                    const n = parseInt(v, 10);
                    if (!isNaN(n) && n < 3) { d.cell.styles.textColor = [225, 29, 72]; d.cell.styles.fontStyle = 'bold'; }
                }
            }
        });
    }

    // --- Tabel Overline
    let y = mon.length ? doc.lastAutoTable.finalY + 12 : 34;
    if (y > H - 45) { doc.addPage(); y = 16; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text(`Data Overline Mingguan (${ovr.length} data)`, M, y);

    if (!ovr.length) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        doc.text('Tidak ada data overline.', M, y + 8);
    } else {
        doc.autoTable({
            ...tableBase,
            startY: y + 4,
            head: [['Week Start', 'Engineer', 'Line', 'Current Style', 'Next Style', 'Planned Overline', 'Status', 'Remark / Cause']],
            body: ovr.map(o => [o.reportWeekStart, o.engineer, o.line, o.currentStyle, o.nextStyle, o.plannedOverlineDate, o.status, o.remark]),
            columnStyles: { 7: { cellWidth: 70 } },
            didParseCell: (d) => {
                if (d.section === 'body' && d.column.index === 6) {
                    d.cell.styles.fontStyle = 'bold';
                    const v = d.cell.raw;
                    d.cell.styles.textColor = v === 'Done' ? [5, 150, 105] : v === 'In Progress' ? [217, 119, 6] : v === 'Pending' ? [225, 29, 72] : [100, 116, 139];
                }
            }
        });
    }

    // --- Footer semua halaman
    const total = doc.internal.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
        doc.setPage(i);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184);
        doc.text('HOGA B - Weekly Line Monitoring System', M, H - 6);
        doc.text(`Halaman ${i} dari ${total}`, W - M, H - 6, { align: 'right' });
    }

    doc.save(`HOGA_B_Laporan_${new Date().toISOString().split('T')[0]}.pdf`);
    showToast('Laporan PDF berhasil diunduh.');
}

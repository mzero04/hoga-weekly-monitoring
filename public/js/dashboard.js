/* Dashboard: KPI dan grafik */

// RENDER DASHBOARD & VISUALIZATIONS
function clearDashboardFilters() {
    document.getElementById('filterEngineer').value = 'ALL';
    document.getElementById('filterLine').value = 'ALL';
    renderDashboard();
}

function renderDashboard() {
    const selectedEng = document.getElementById('filterEngineer').value;
    const selectedLine = document.getElementById('filterLine').value;

    // Filter datasets
    let filteredMon = monitoringList.filter(item => {
        const matchEng = (selectedEng === 'ALL' || item.engineer === selectedEng);
        const matchLine = (selectedLine === 'ALL' || item.line === selectedLine);
        return matchEng && matchLine;
    });

    let filteredOvr = overlineList.filter(item => {
        const matchEng = (selectedEng === 'ALL' || item.engineer === selectedEng);
        const matchLine = (selectedLine === 'ALL' || item.line === selectedLine);
        return matchEng && matchLine;
    });

    // Calculate Metrics
    let readyCount = 0;
    let inProgressCount = 0;
    let atRiskCount = 0;

    filteredMon.forEach(m => {
        const summary = calculateSummaryStatus(m);
        if (summary === 'Ready') readyCount++;
        else if (summary === 'At Risk') atRiskCount++;
        else inProgressCount++;
    });

    const totalLinesMonitored = filteredMon.length;
    const readyPct = totalLinesMonitored > 0 ? Math.round((readyCount / totalLinesMonitored) * 100) : 0;

    // Set KPI Values
    document.getElementById('kpi-total-lines').innerText = totalLinesMonitored;
    document.getElementById('kpi-ready').innerText = readyCount;
    document.getElementById('kpi-ready-pct').innerText = `${readyPct}% dari Terjadwal`;
    document.getElementById('kpi-in-progress').innerText = inProgressCount;
    document.getElementById('kpi-at-risk').innerText = atRiskCount;
    document.getElementById('kpi-overlines').innerText = filteredOvr.length;

    // Render Charts
    renderReadinessChart(readyCount, inProgressCount, atRiskCount);
    renderEngineerChart(filteredMon);
    renderLineStatusChart(filteredMon);
}

// CHART 1: Readiness Doughnut
function renderReadinessChart(ready, progress, risk) {
    const ctx = document.getElementById('chartReadiness').getContext('2d');
    if (chartReadinessInstance) chartReadinessInstance.destroy();

    const labels = ['Ready', 'In Progress'];
    const values = [ready, progress];
    const colors = ['#10b981', '#f59e0b'];
    if (SHOW_AT_RISK) { labels.push('At Risk'); values.push(risk); colors.push('#f43f5e'); }

    chartReadinessInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: colors,
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } }
            },
            cutout: '70%'
        }
    });
}

// CHART 2: Engineer Performance Stacked Bar
function renderEngineerChart(monData) {
    const ctx = document.getElementById('chartEngineer').getContext('2d');
    if (chartEngineerInstance) chartEngineerInstance.destroy();

    const engStats = {};
    MASTER_ENGINEERS.forEach(eng => {
        engStats[eng] = { ready: 0, progress: 0, risk: 0 };
    });

    monData.forEach(item => {
        if (engStats[item.engineer]) {
            const st = calculateSummaryStatus(item);
            if (st === 'Ready') engStats[item.engineer].ready++;
            else if (st === 'At Risk') engStats[item.engineer].risk++;
            else engStats[item.engineer].progress++;
        }
    });

    const labels = MASTER_ENGINEERS.map(name => name.split(' ')[0]); // Display first name for clean layout
    const readyData = MASTER_ENGINEERS.map(e => engStats[e].ready);
    const progressData = MASTER_ENGINEERS.map(e => engStats[e].progress);
    const riskData = MASTER_ENGINEERS.map(e => engStats[e].risk);

    chartEngineerInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                { label: 'Ready', data: readyData, backgroundColor: '#10b981' },
                { label: 'In Progress', data: progressData, backgroundColor: '#f59e0b' },
                ...(SHOW_AT_RISK ? [{ label: 'At Risk', data: riskData, backgroundColor: '#f43f5e' }] : [])
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { stacked: true, grid: { display: false } },
                y: { stacked: true, ticks: { stepSize: 1 } }
            },
            plugins: {
                legend: { position: 'top', labels: { boxWidth: 10, font: { size: 10 } } }
            }
        }
    });
}

// CHART 3: Line Status Grid Overview (B1 - B<LINE_COUNT>)
function renderLineStatusChart(monData) {
    const ctx = document.getElementById('chartLineStatus').getContext('2d');
    if (chartLineStatusInstance) chartLineStatusInstance.destroy();

    // Prepare B1 to B<LINE_COUNT> scores
    // Score values for visual bar height: Pre-layout (1), PP Approval (1), Chief Sample (1) -> Max 3
    const lineLabels = MASTER_LINES;
    const lineScores = lineLabels.map(lineId => {
        const match = monData.find(m => m.line === lineId);
        if (!match) return 0;
        
        let score = 0;
        if (match.preLayoutStatus === 'Done' || match.preLayoutStatus === 'N/A') score += 1;
        if (match.ppApprovalStatus === 'Done' || match.ppApprovalStatus === 'N/A') score += 1;
        if (match.chiefSampleStatus === 'Done' || match.chiefSampleStatus === 'N/A') score += 1;
        return score;
    });

    const backgroundColors = lineScores.map(score => {
        if (score === 3) return '#10b981'; // Green Ready
        if (score === 0) return '#e2e8f0'; // Gray No Data
        if (score === 1) return '#f43f5e'; // Red Critical
        return '#f59e0b'; // Yellow In progress
    });

    chartLineStatusInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: lineLabels,
            datasets: [{
                label: 'Tahapan Selesai (Max 3)',
                data: lineScores,
                backgroundColor: backgroundColors,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { min: 0, max: 3, ticks: { stepSize: 1 } },
                x: { grid: { display: false } }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
}

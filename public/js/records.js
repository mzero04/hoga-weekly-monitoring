/* Tabel Data Records */

// RENDER TABLES
function renderTables() {
    syncFilterOptions();

    // Render Monitoring Table (sudah disaring + diurutkan oleh filters.js)
    const filteredMon = getFilteredRecords('monitoring');
    renderFilterBar('monitoring', filteredMon.length, monitoringList.length);

    document.getElementById('monitoringCountText').innerText = `Total: ${filteredMon.length} Data`;
    const tbodyMon = document.getElementById('tableMonitoringBody');
    
    if (filteredMon.length === 0) {
        tbodyMon.innerHTML = `<tr><td colspan="13" class="text-center py-6 text-slate-400">Tidak ada data monitoring yang cocok dengan filter</td></tr>`;
    } else {
        tbodyMon.innerHTML = filteredMon.map(item => {
            const daysLeft = calculateDaysToStart(item.reportDate, item.plannedStartDate);
            const overall = calculateSummaryStatus(item);

            let statusBadge = '';
            if (overall === 'Ready') statusBadge = `<span class="px-2 py-0.5 text-xs font-semibold rounded bg-emerald-100 text-emerald-700">Ready</span>`;
            else if (overall === 'At Risk') statusBadge = `<span class="px-2 py-0.5 text-xs font-semibold rounded bg-rose-100 text-rose-700">At Risk</span>`;
            else statusBadge = `<span class="px-2 py-0.5 text-xs font-semibold rounded bg-amber-100 text-amber-700">In Progress</span>`;

            return `
                <tr class="hover:bg-slate-50 transition">
                    <td class="p-3 font-medium text-slate-700">${esc(item.reportDate)}</td>
                    <td class="p-3 font-medium">${esc(item.engineer)}</td>
                    <td class="p-3"><span class="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-bold">${esc(item.line)}</span></td>
                    <td class="p-3 text-slate-600">${esc(item.currentStyle)}</td>
                    <td class="p-3 text-slate-800 font-semibold">${esc(item.nextStyle)}</td>
                    <td class="p-3">${esc(item.plannedStartDate)}</td>
                    <td class="p-3 font-semibold ${daysLeft < 3 ? 'text-rose-600' : 'text-slate-700'}">${daysLeft} hr</td>
                    <td class="p-3">${formatMiniBadge(item.preLayoutStatus)}</td>
                    <td class="p-3">${formatMiniBadge(item.ppApprovalStatus)}</td>
                    <td class="p-3">${formatChiefBadge(item.chiefSampleStatus)}</td>
                    <td class="p-3">${statusBadge}</td>
                    <td class="p-3 text-slate-600 max-w-xs truncate" title="${esc(item.remark)}">${esc(item.remark)}</td>
                    <td class="p-3 text-center">
                        <div class="flex items-center justify-center space-x-2">
                            <button onclick="editMonitoring('${esc(item.id)}')" class="p-1 text-blue-600 hover:bg-blue-50 rounded" title="Edit"><i data-lucide="edit-3" class="w-4 h-4"></i></button>
                            <button onclick="deleteMonitoring('${esc(item.id)}')" class="p-1 text-rose-600 hover:bg-rose-50 rounded" title="Hapus"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    // Render Overline Table
    const filteredOvr = getFilteredRecords('overline');
    renderFilterBar('overline', filteredOvr.length, overlineList.length);

    document.getElementById('overlineCountText').innerText = `Total: ${filteredOvr.length} Data`;
    const tbodyOvr = document.getElementById('tableOverlineBody');

    if (filteredOvr.length === 0) {
        tbodyOvr.innerHTML = `<tr><td colspan="9" class="text-center py-6 text-slate-400">Tidak ada data overline yang cocok dengan filter</td></tr>`;
    } else {
        tbodyOvr.innerHTML = filteredOvr.map(item => {
            return `
                <tr class="hover:bg-slate-50 transition">
                    <td class="p-3 font-medium text-slate-700">${esc(item.reportWeekStart)}</td>
                    <td class="p-3 font-medium">${esc(item.engineer)}</td>
                    <td class="p-3"><span class="px-2 py-0.5 rounded bg-purple-100 text-purple-800 font-bold">${esc(item.line)}</span></td>
                    <td class="p-3 text-slate-600">${esc(item.currentStyle)}</td>
                    <td class="p-3 text-slate-800 font-semibold">${esc(item.nextStyle)}</td>
                    <td class="p-3">${esc(item.plannedOverlineDate)}</td>
                    <td class="p-3">${formatMiniBadge(item.status)}</td>
                    <td class="p-3 text-slate-600 max-w-xs truncate">${esc(item.remark)}</td>
                    <td class="p-3 text-center">
                        <div class="flex items-center justify-center space-x-2">
                            <button onclick="editOverline('${esc(item.id)}')" class="p-1 text-blue-600 hover:bg-blue-50 rounded" title="Edit"><i data-lucide="edit-3" class="w-4 h-4"></i></button>
                            <button onclick="deleteOverline('${esc(item.id)}')" class="p-1 text-rose-600 hover:bg-rose-50 rounded" title="Hapus"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    safeIcons();
}

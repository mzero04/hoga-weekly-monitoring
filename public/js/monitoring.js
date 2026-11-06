/* Form dan aksi Input Monitoring */

// FORM HANDLERS
async function handleSaveMonitoring(e) {
    e.preventDefault();
    markOwnAction();
    const newData = {
        reportDate: document.getElementById('monReportDate').value,
        engineer: document.getElementById('monEngineer').value,
        line: document.getElementById('monLine').value,
        currentStyle: document.getElementById('monCurrentStyle').value || '-',
        nextStyle: document.getElementById('monNextStyle').value || '-',
        plannedStartDate: document.getElementById('monPlannedStartDate').value,
        preLayoutStatus: document.getElementById('monPreLayoutStatus').value,
        ppApprovalStatus: document.getElementById('monPpApprovalStatus').value,
        chiefSampleStatus: chiefToDb(document.getElementById('monChiefSampleStatus').value),
        remark: document.getElementById('monRemark').value || '-'
    };

    // Data baru saja. Perubahan data yang sudah ada dilakukan lewat Update Progress / Koreksi Data (modal).
    const { error } = await sb.from('monitoring').insert(monToDb(newData));
    if (error) return showToast("Gagal menyimpan: " + error.message);

    showToast("Data Monitoring baru berhasil ditambahkan.");
    await loadData();
    resetMonitoringForm();
    switchTab('records');
    switchRecordSubTab('monitoring');
}

function resetMonitoringForm() {
    document.getElementById('formMonitoring').reset();
    document.getElementById('monId').value = '';
    setDefaultDates();
    document.getElementById('monDaysToStartDisplay').innerText = "0 Hari";
}

// Update Progress (semua user) dan Koreksi Data (admin / pembuat data) lewat modal
function progressMonitoring(id) { openEditModal('monitoring', id, 'progress'); }
function correctMonitoring(id) { openEditModal('monitoring', id, 'correction'); }

async function deleteMonitoring(id) {
    markOwnAction();
    if (confirm("Apakah Anda yakin ingin menghapus data monitoring ini?")) {
        const { error } = await sb.from('monitoring').delete().eq('id', id);
        if (error) return showToast("Gagal menghapus: " + error.message);
        await loadData();
        showToast("Data Monitoring berhasil dihapus.");
    }
}

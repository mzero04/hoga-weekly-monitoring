/* Form dan aksi Input Monitoring */

// FORM HANDLERS
async function handleSaveMonitoring(e) {
    e.preventDefault();
    markOwnAction();
    const existingId = document.getElementById('monId').value;
    const newData = {
        id: existingId || undefined,
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

    let error;
    if (existingId) {
        ({ error } = await sb.from('monitoring').update(monToDb(newData)).eq('id', existingId));
    } else {
        ({ error } = await sb.from('monitoring').insert(monToDb(newData)));
    }
    if (error) return showToast("Gagal menyimpan: " + error.message);

    showToast(existingId ? "Data Monitoring berhasil diperbarui." : "Data Monitoring baru berhasil ditambahkan.");
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

function editMonitoring(id) {
    const item = monitoringList.find(m => m.id === id);
    if(!item) return;

    document.getElementById('monId').value = item.id;
    document.getElementById('monReportDate').value = item.reportDate;
    document.getElementById('monEngineer').value = item.engineer;
    document.getElementById('monLine').value = item.line;
    document.getElementById('monCurrentStyle').value = item.currentStyle;
    document.getElementById('monNextStyle').value = item.nextStyle;
    document.getElementById('monPlannedStartDate').value = item.plannedStartDate;
    document.getElementById('monPreLayoutStatus').value = item.preLayoutStatus;
    document.getElementById('monPpApprovalStatus').value = item.ppApprovalStatus;
    document.getElementById('monChiefSampleStatus').value = chiefLabel(item.chiefSampleStatus);
    document.getElementById('monRemark').value = item.remark;

    calcDaysToStart();
    switchTab('monitoring');
}

async function deleteMonitoring(id) {
    markOwnAction();
    if (confirm("Apakah Anda yakin ingin menghapus data monitoring ini?")) {
        const { error } = await sb.from('monitoring').delete().eq('id', id);
        if (error) return showToast("Gagal menghapus: " + error.message);
        await loadData();
        showToast("Data Monitoring berhasil dihapus.");
    }
}

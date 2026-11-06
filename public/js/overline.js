/* Form dan aksi Input Overline */

async function handleSaveOverline(e) {
    e.preventDefault();
    markOwnAction();
    const existingId = document.getElementById('ovrId').value;
    const newData = {
        id: existingId || undefined,
        reportWeekStart: document.getElementById('ovrReportWeekStart').value,
        engineer: document.getElementById('ovrEngineer').value,
        line: document.getElementById('ovrLine').value,
        currentStyle: document.getElementById('ovrCurrentStyle').value || '-',
        nextStyle: document.getElementById('ovrNextStyle').value || '-',
        plannedOverlineDate: document.getElementById('ovrPlannedOverlineDate').value,
        status: document.getElementById('ovrStatus').value,
        remark: document.getElementById('ovrRemark').value || '-'
    };

    let error;
    if (existingId) {
        ({ error } = await sb.from('overline').update(ovrToDb(newData)).eq('id', existingId));
    } else {
        ({ error } = await sb.from('overline').insert(ovrToDb(newData)));
    }
    if (error) return showToast("Gagal menyimpan: " + error.message);

    showToast(existingId ? "Data Overline berhasil diperbarui." : "Data Overline baru berhasil ditambahkan.");
    await loadData();
    resetOverlineForm();
    switchTab('records');
    switchRecordSubTab('overline');
}

function resetOverlineForm() {
    document.getElementById('formOverline').reset();
    document.getElementById('ovrId').value = '';
    setDefaultDates();
}

function editOverline(id) {
    openEditModal('overline', id);
}

async function deleteOverline(id) {
    markOwnAction();
    if (confirm("Apakah Anda yakin ingin menghapus data overline ini?")) {
        const { error } = await sb.from('overline').delete().eq('id', id);
        if (error) return showToast("Gagal menghapus: " + error.message);
        await loadData();
        showToast("Data Overline berhasil dihapus.");
    }
}

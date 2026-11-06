/* Form dan aksi Input Overline */

async function handleSaveOverline(e) {
    e.preventDefault();
    markOwnAction();
    const newData = {
        reportWeekStart: document.getElementById('ovrReportWeekStart').value,
        engineer: document.getElementById('ovrEngineer').value,
        line: document.getElementById('ovrLine').value,
        currentStyle: document.getElementById('ovrCurrentStyle').value || '-',
        nextStyle: document.getElementById('ovrNextStyle').value || '-',
        plannedOverlineDate: document.getElementById('ovrPlannedOverlineDate').value,
        status: document.getElementById('ovrStatus').value,
        remark: document.getElementById('ovrRemark').value || '-'
    };

    // Data baru saja. Perubahan data yang sudah ada dilakukan lewat Update Progress / Koreksi Data (modal).
    const { error } = await sb.from('overline').insert(ovrToDb(newData));
    if (error) return showToast("Gagal menyimpan: " + error.message);

    showToast("Data Overline baru berhasil ditambahkan.");
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

// Update Progress (semua user) dan Koreksi Data (admin / pembuat data) lewat modal
function progressOverline(id) { openEditModal('overline', id, 'progress'); }
function correctOverline(id) { openEditModal('overline', id, 'correction'); }

async function deleteOverline(id) {
    markOwnAction();
    if (confirm("Apakah Anda yakin ingin menghapus data overline ini?")) {
        const { error } = await sb.from('overline').delete().eq('id', id);
        if (error) return showToast("Gagal menghapus: " + error.message);
        await loadData();
        showToast("Data Overline berhasil dihapus.");
    }
}

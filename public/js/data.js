/* Memuat data dari Supabase dan reset data demo */

// SUPABASE DATA HANDLING
async function loadData() {
    const [mon, ovr] = await Promise.all([
        sb.from('monitoring').select('*').order('created_at', { ascending: false }),
        sb.from('overline').select('*').order('created_at', { ascending: false })
    ]);
    if (mon.error) showToast('Gagal memuat data monitoring: ' + mon.error.message);
    if (ovr.error) showToast('Gagal memuat data overline: ' + ovr.error.message);
    monitoringList = (mon.data || []).map(monFromDb);
    overlineList = (ovr.data || []).map(ovrFromDb);
    renderDashboard();
    renderTables();
}

async function resetToDefaultData() {
    markOwnAction();
    if (!isAdmin()) return;
    if (!confirm("Reset akan MENGHAPUS SEMUA data di database dan menggantinya dengan data sampel. Lanjutkan?")) return;

    const d1 = await sb.from('monitoring').delete().neq('id', '');
    const d2 = await sb.from('overline').delete().neq('id', '');
    if (d1.error || d2.error) return showToast("Gagal reset: " + ((d1.error || d2.error).message));

    const i1 = await sb.from('monitoring').insert(INITIAL_MONITORING_DATA.map(monToDb));
    const i2 = await sb.from('overline').insert(INITIAL_OVERLINE_DATA.map(ovrToDb));
    if (i1.error || i2.error) return showToast("Gagal mengisi data sampel: " + ((i1.error || i2.error).message));

    await loadData();
    showToast("Data telah di-reset ke data sampel awal.");
}

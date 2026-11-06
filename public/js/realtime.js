/* Sinkronisasi realtime (Supabase Realtime + polling cadangan) */

// ================= REALTIME (tanpa refresh) =================
let realtimeChannel = null;

let realtimeTimer = null;

let lastOwnActionAt = 0;

let pollTimer = null;

function markOwnAction() { lastOwnActionAt = Date.now(); }

function setLiveStatus(on, text) {
    const dot = document.getElementById('liveDot');
    const label = document.getElementById('liveText');
    if (!dot || !label) return;
    dot.className = 'w-2 h-2 rounded-full ' + (on ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400');
    label.innerText = text || (on ? 'Live' : 'Offline');
}

async function refreshQuiet() {
    if (!sb || !appStarted) return;
    try {
        const [mon, ovr] = await Promise.all([
            sb.from('monitoring').select('*').order('created_at', { ascending: false }),
            sb.from('overline').select('*').order('created_at', { ascending: false })
        ]);
        if (mon.error || ovr.error) return;
        monitoringList = (mon.data || []).map(monFromDb);
        overlineList = (ovr.data || []).map(ovrFromDb);
        renderDashboard();
        renderTables();
    } catch (e) { console.warn('Refresh gagal:', e); }
}

function onRealtimeChange() {
    clearTimeout(realtimeTimer);
    realtimeTimer = setTimeout(async () => {
        const external = Date.now() - lastOwnActionAt > 4000;
        await refreshQuiet();
        if (external) showToast('Data diperbarui otomatis oleh pengguna lain.');
    }, 400);
}

function startRealtime() {
    if (!sb) return;
    if (!realtimeChannel) {
        realtimeChannel = sb.channel('hoga-b-live')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'monitoring' }, onRealtimeChange)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'overline' }, onRealtimeChange)
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') setLiveStatus(true);
                else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') setLiveStatus(false, 'Offline');
            });
    }
    // Cadangan: segarkan tiap 60 detik & saat tab kembali aktif (jaga-jaga koneksi realtime terputus)
    if (!pollTimer) {
        pollTimer = setInterval(() => { if (!document.hidden) refreshQuiet(); }, 60000);
        document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshQuiet(); });
    }
}

function stopRealtime() {
    clearTimeout(realtimeTimer);
    if (realtimeChannel && sb) { try { sb.removeChannel(realtimeChannel); } catch (e) {} }
    realtimeChannel = null;
    setLiveStatus(false, 'Offline');
}

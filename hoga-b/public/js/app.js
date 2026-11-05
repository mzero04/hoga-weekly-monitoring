/* Navigasi tab, dropdown form, dan titik masuk aplikasi (window.onload) */

// INIT APP
window.onload = async function() {
    safeIcons();
    try { initFormDropdowns(); setDefaultDates(); } catch (e) { console.error(e); }
    try { await initSupabase(); } catch (e) { console.error(e); showLoginError('Gagal memulai aplikasi: ' + (e.message || e)); }
};

// DROPDOWN SETUP
function initFormDropdowns() {
    const engOptionsHtml = MASTER_ENGINEERS.map(e => `<option value="${e}">${e}</option>`).join('');
    const lineOptionsHtml = MASTER_LINES.map(l => `<option value="${l}">${l}</option>`).join('');
    const statusOptionsHtml = MASTER_STATUS.map(s => `<option value="${s}">${s}</option>`).join('');

    // Monitoring Dropdowns
    document.getElementById('monEngineer').innerHTML += engOptionsHtml;
    document.getElementById('monLine').innerHTML += lineOptionsHtml;
    document.getElementById('monPreLayoutStatus').innerHTML = statusOptionsHtml;
    document.getElementById('monPpApprovalStatus').innerHTML = statusOptionsHtml;
    document.getElementById('monChiefSampleStatus').innerHTML = '<option value="X">X</option><option value="O">O</option>';

    // Overline Dropdowns
    document.getElementById('ovrEngineer').innerHTML += engOptionsHtml;
    document.getElementById('ovrLine').innerHTML += lineOptionsHtml;
    document.getElementById('ovrStatus').innerHTML = statusOptionsHtml;

    document.getElementById('engineerList').innerHTML = MASTER_ENGINEERS.map(e => `<option value="${e}"></option>`).join('');

    // Filter Dropdowns
    document.getElementById('filterEngineer').innerHTML += engOptionsHtml;
    document.getElementById('filterLine').innerHTML += lineOptionsHtml;
}

function setDefaultDates() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('monReportDate').value = today;
    document.getElementById('ovrReportWeekStart').value = today;
    applyDefaultEngineer();
}

// TAB NAVIGATION
function switchTab(tabId) {
    ['dashboard', 'monitoring', 'overline', 'records', 'users'].forEach(id => {
        const el = document.getElementById(`tab-${id}`);
        const navBtn = document.getElementById(`nav-${id}`);
        const mobNavBtn = document.getElementById(`mob-nav-${id}`);
        const adminHidden = (id === 'users' && !isAdmin());

        if (id === tabId && !adminHidden) {
            el.classList.remove('hidden');
            if(navBtn) {
                navBtn.className = "px-3 py-2 rounded-md text-sm font-medium transition flex items-center space-x-2 bg-indigo-800 text-white";
            }
            if(mobNavBtn) {
                mobNavBtn.className = "flex flex-col items-center p-2 text-white font-semibold";
            }
        } else {
            el.classList.add('hidden');
            if(navBtn) {
                navBtn.className = "px-3 py-2 rounded-md text-sm font-medium transition flex items-center space-x-2 text-indigo-200 hover:bg-indigo-800 hover:text-white" + (adminHidden ? " hidden" : "");
            }
            if(mobNavBtn) {
                mobNavBtn.className = "flex flex-col items-center p-2 text-indigo-300" + (adminHidden ? " hidden" : "");
            }
        }
    });

    if(tabId === 'dashboard') {
        renderDashboard();
    }
    if(tabId === 'users' && isAdmin()) {
        loadUsers();
    }
    safeIcons();
}

function switchRecordSubTab(subTabId) {
    activeRecordSubTab = subTabId;
    const btnMon = document.getElementById('subtab-btn-monitoring');
    const btnOvr = document.getElementById('subtab-btn-overline');
    const contentMon = document.getElementById('subtab-content-monitoring');
    const contentOvr = document.getElementById('subtab-content-overline');

    if(subTabId === 'monitoring') {
        btnMon.className = "px-4 py-2 rounded-lg font-medium text-sm bg-indigo-50 text-indigo-700 border border-indigo-200";
        btnOvr.className = "px-4 py-2 rounded-lg font-medium text-sm text-slate-600 hover:bg-slate-100";
        contentMon.classList.remove('hidden');
        contentOvr.classList.add('hidden');
    } else {
        btnOvr.className = "px-4 py-2 rounded-lg font-medium text-sm bg-purple-50 text-purple-700 border border-purple-200";
        btnMon.className = "px-4 py-2 rounded-lg font-medium text-sm text-slate-600 hover:bg-slate-100";
        contentOvr.classList.remove('hidden');
        contentMon.classList.add('hidden');
    }
}

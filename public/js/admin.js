/* ═══════════════════════════════════════════════════
   Code Puzzle Challenge — Admin Panel Logic
   ═══════════════════════════════════════════════════ */

async function adminLogin() {
    const user = v('a-login-user').trim(), pass = v('a-login-pass');
    const err = document.getElementById('a-login-err');
    err.classList.add('hidden');
    try {
        const data = await api('POST', '/api/admin/login', { username: user, password: pass });
        adminToken = data.token;
        sessionStorage.setItem('adminToken', adminToken);
        enterAdmin();
    } catch (e) { showErr(err, e.message); }
}

async function enterAdmin() {
    initSocket();
    setNavUser('Admin');
    try { adminConfig = await api('GET', '/api/admin/config', null, adminToken); } catch (e) { logout(); return; }
    buildAdminDashboard();
    showSec('s-admin');
    socket.emit('join:admin', adminToken);
    socket.on('leaderboard:update', d => renderLeaderboardData(d));
    socket.on('activePlayers:update', d => renderActivePlayers(d));
    socket.on('participant:joined', d => {
        const toast = document.createElement('div');
        toast.className = 'fixed bottom-4 right-4 glass-strong rounded-2xl p-4 text-sm z-50 toast-anim border border-cyan-400/15 shadow-lg';
        toast.innerHTML = `<i class="fas fa-user-plus text-cyan-400 mr-2"></i><b>${esc(d.displayName)}</b> joined!`;
        document.body.appendChild(toast); setTimeout(() => toast.remove(), 4000);
    });
    adminTab('leaderboard');
}

function buildAdminDashboard() {
    const sec = document.getElementById('s-admin');
    sec.innerHTML = `<div class="flex flex-col lg:flex-row gap-6">
    <div class="lg:w-72 glass-strong rounded-3xl p-6 h-fit sticky top-20">
        <div class="mb-6 px-3 pb-5 border-b border-gray-200">
            <div class="text-[10px] text-gray-500 uppercase tracking-[0.2em] mb-1.5 font-semibold">Admin</div>
            <div class="font-bold gradient-text text-xl">Dashboard</div>
        </div>
        <nav class="space-y-1">
            <button onclick="adminTab('leaderboard')" id="at-leaderboard" class="w-full text-left px-4 py-3 rounded-xl transition-all text-gray-500 hover:bg-gray-100 hover:text-gray-800 flex items-center gap-3 group"><i class="fas fa-trophy w-5 text-yellow-500/70 group-hover:text-yellow-500"></i><span>Leaderboard</span></button>
            <button onclick="adminTab('codesets')" id="at-codesets" class="w-full text-left px-4 py-3 rounded-xl transition-all text-gray-500 hover:bg-gray-100 hover:text-gray-800 flex items-center gap-3 group"><i class="fas fa-layer-group w-5 text-cyan-400/70 group-hover:text-cyan-400"></i><span>Code Sets</span></button>
            <button onclick="adminTab('participants')" id="at-participants" class="w-full text-left px-4 py-3 rounded-xl transition-all text-gray-500 hover:bg-gray-100 hover:text-gray-800 flex items-center gap-3 group"><i class="fas fa-users w-5 text-green-500/70 group-hover:text-green-500"></i><span>Participants</span></button>
            <button onclick="adminTab('settings')" id="at-settings" class="w-full text-left px-4 py-3 rounded-xl transition-all text-gray-500 hover:bg-gray-100 hover:text-gray-800 flex items-center gap-3 group"><i class="fas fa-sliders-h w-5 text-blue-500/70 group-hover:text-blue-500"></i><span>Settings</span></button>
            <button onclick="adminTab('security')" id="at-security" class="w-full text-left px-4 py-3 rounded-xl transition-all text-gray-500 hover:bg-gray-100 hover:text-gray-800 flex items-center gap-3 group"><i class="fas fa-key w-5 text-orange-500/70 group-hover:text-orange-500"></i><span>Security</span></button>
        </nav>
        <div class="mt-6 pt-5 border-t border-gray-200">
            <button onclick="logout()" class="w-full px-4 py-2.5 rounded-xl border border-red-200 text-red-400 hover:bg-red-50 hover:text-red-500 transition-all text-sm flex items-center justify-center gap-2"><i class="fas fa-sign-out-alt"></i><span>Logout</span></button>
        </div>
    </div>
    <div class="flex-1 min-w-0">
        <div id="admin-leaderboard" class="admin-tab hidden"></div>
        <div id="admin-codesets" class="admin-tab hidden"></div>
        <div id="admin-participants" class="admin-tab hidden"></div>
        <div id="admin-settings" class="admin-tab hidden"></div>
        <div id="admin-security" class="admin-tab hidden"></div>
    </div></div>`;
}

function adminTab(tab) {
    document.querySelectorAll('.admin-tab').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('[id^="at-"]').forEach(b => { b.classList.remove('tab-active'); b.classList.add('text-gray-500'); });
    document.getElementById('admin-' + tab).classList.remove('hidden');
    const btn = document.getElementById('at-' + tab);
    btn.classList.add('tab-active'); btn.classList.remove('text-gray-500');
    if (tab === 'leaderboard') loadLeaderboard();
    if (tab === 'codesets') renderCodeSets();
    if (tab === 'participants') loadParticipants();
    if (tab === 'settings') loadSettings();
    if (tab === 'security') buildSecurityTab();
}

// ─── LEADERBOARD ────────────────────────────────────
async function loadLeaderboard() {
    try {
        const data = await api('GET', '/api/admin/leaderboard', null, adminToken);
        renderLeaderboardData(data);
    } catch (e) { console.error(e); }
}

function renderLeaderboardData(data) {
    const container = document.getElementById('admin-leaderboard');
    const { entries, stats } = data;
    container.innerHTML = `
    <div class="flex flex-wrap justify-between items-center mb-8 gap-4">
        <div><h2 class="text-2xl md:text-3xl font-bold flex items-center gap-3"><span class="live-dot"></span><span class="gradient-text">Live Leaderboard</span></h2><p class="text-sm text-gray-500 mt-1">Real-time participant rankings</p></div>
        <div class="flex gap-2">
            <a href="/api/admin/export" class="px-4 py-2.5 rounded-xl bg-green-50 text-green-600 border border-green-200 hover:bg-green-100 text-sm transition-all font-medium" onclick="this.href='/api/admin/export?t='+adminToken"><i class="fas fa-download mr-1.5"></i>Export CSV</a>
            <button onclick="clearResults()" class="px-4 py-2.5 rounded-xl bg-red-50 text-red-500 border border-red-200 hover:bg-red-100 text-sm transition-all font-medium"><i class="fas fa-trash mr-1.5"></i>Clear</button>
        </div>
    </div>
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div class="stat-card rounded-2xl p-5 text-center"><div class="text-3xl font-bold text-cyan-400 mono">${stats.total}</div><div class="text-[11px] text-gray-500 mt-2 uppercase tracking-wider font-semibold">Total Entries</div></div>
        <div class="stat-card rounded-2xl p-5 text-center"><div class="text-3xl font-bold text-green-400 mono">${stats.completed}</div><div class="text-[11px] text-gray-500 mt-2 uppercase tracking-wider font-semibold">Completed</div></div>
        <div class="stat-card rounded-2xl p-5 text-center"><div class="text-3xl font-bold text-yellow-400 mono">${stats.bestTime}</div><div class="text-[11px] text-gray-500 mt-2 uppercase tracking-wider font-semibold">Best Time</div></div>
        <div class="stat-card rounded-2xl p-5 text-center"><div class="text-3xl font-bold text-purple-400 mono">${stats.avgTime}</div><div class="text-[11px] text-gray-500 mt-2 uppercase tracking-wider font-semibold">Avg Time</div></div>
    </div>
    <div id="active-players-area" class="mb-6"></div>
    <div class="glass-strong rounded-2xl overflow-hidden">
        <table class="w-full text-left"><thead class="bg-gray-50 text-gray-500 text-[11px] uppercase tracking-wider"><tr>
            <th class="px-5 py-4 w-16 font-semibold">Rank</th><th class="px-5 py-4 font-semibold">Team</th><th class="px-5 py-4 font-semibold">Details</th><th class="px-5 py-4 font-semibold">Codes</th><th class="px-5 py-4 font-semibold">Time</th><th class="px-5 py-4 font-semibold">Status</th><th class="px-5 py-4 font-semibold">At</th>
        </tr></thead><tbody class="divide-y divide-gray-200 text-sm">${entries.length ? entries.map((r, i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '';
        const rc = i === 0 ? 'lb-gold' : i === 1 ? 'lb-silver' : i === 2 ? 'lb-bronze' : 'text-gray-500';
        const sb = r.completed ? '<span class="px-2.5 py-1 rounded-lg text-xs bg-green-100 text-green-600 font-medium border border-green-200">Completed</span>' : '<span class="px-2.5 py-1 rounded-lg text-xs bg-red-100 text-red-500 font-medium border border-red-200">Failed</span>';
        return `<tr class="lb-row transition-all hover:bg-gray-50"><td class="px-5 py-4 font-bold ${rc}">${medal} #${i + 1}</td><td class="px-5 py-4 font-medium text-gray-800">${esc(r.displayName)}</td><td class="px-5 py-4 text-xs text-gray-500">${esc(r.year || '')}${r.dept ? ' · ' + esc(r.dept) : ''}${r.college ? ' · ' + esc(r.college) : ''}</td><td class="px-5 py-4 mono">${r.codesCompleted}/${adminConfig ? adminConfig.codeSets.length : '?'}</td><td class="px-5 py-4 mono">${r.timeStr}</td><td class="px-5 py-4">${sb}</td><td class="px-5 py-4 text-xs text-gray-600">${new Date(r.timestamp).toLocaleTimeString()}</td></tr>`;
    }).join('') : '<tr><td colspan="7" class="px-5 py-16 text-center text-gray-500"><i class="fas fa-inbox text-4xl mb-3 opacity-20 block"></i>No participants yet</td></tr>'}</tbody></table>
    </div>`;
}

function renderActivePlayers(players) {
    const area = document.getElementById('active-players-area');
    if (!area) return;
    if (!players.length) { area.innerHTML = ''; return; }
    area.innerHTML = `<div class="glass-strong rounded-2xl p-5 mb-3"><h4 class="text-sm font-bold text-green-500 mb-4 flex items-center gap-2"><span class="live-dot"></span>Active Players (${players.length})</h4><div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">${players.map(p => `<div class="p-4 rounded-xl bg-gray-50 border border-gray-200 hover:bg-gray-100 transition-all"><div class="font-medium text-gray-800 text-sm">${esc(p.displayName)}</div><div class="text-xs text-gray-500 mt-1.5">Code ${p.setIdx + 1}/${p.totalSets} · Riddle ${p.riddleIdx + 1}</div><div class="h-1.5 bg-gray-200 rounded-full mt-2.5"><div class="h-full bg-gradient-to-r from-cyan-400 to-purple-500 rounded-full transition-all" style="width:${(p.doneSetsCount / p.totalSets * 100).toFixed(0)}%"></div></div></div>`).join('')}</div></div>`;
}

async function clearResults() {
    if (!confirm('Clear all leaderboard entries?')) return;
    try { await api('DELETE', '/api/admin/results', null, adminToken); loadLeaderboard(); } catch (e) { alert(e.message); }
}

// ─── PARTICIPANTS ───────────────────────────────────
async function loadParticipants() {
    try {
        const data = await api('GET', '/api/admin/participants', null, adminToken);
        const c = document.getElementById('admin-participants');
        const sorted = [...data].sort((a, b) => b.timestamp - a.timestamp);
        c.innerHTML = `<div class="mb-8"><h2 class="text-2xl md:text-3xl font-bold gradient-text">Teams</h2><p class="text-sm text-gray-500 mt-1">All registered participants</p></div><div class="glass-strong rounded-2xl overflow-hidden"><table class="w-full text-left"><thead class="bg-gray-50 text-gray-500 text-[11px] uppercase tracking-wider"><tr><th class="px-5 py-4 font-semibold">#</th><th class="px-5 py-4 font-semibold">Team</th><th class="px-5 py-4 font-semibold">Year</th><th class="px-5 py-4 font-semibold">Dept</th><th class="px-5 py-4 font-semibold">College</th><th class="px-5 py-4 font-semibold">When</th></tr></thead><tbody class="divide-y divide-gray-200 text-sm">${sorted.length ? sorted.map((r, i) => `<tr class="lb-row transition-all hover:bg-gray-50"><td class="px-5 py-4 text-gray-500">${i + 1}</td><td class="px-5 py-4 font-medium text-gray-800">${esc(r.displayName)}</td><td class="px-5 py-4 text-gray-500">${esc(r.year || '–')}</td><td class="px-5 py-4 text-gray-500">${esc(r.dept || '–')}</td><td class="px-5 py-4 text-gray-500">${esc(r.college || '–')}</td><td class="px-5 py-4 text-xs text-gray-500">${new Date(r.timestamp).toLocaleString()}</td></tr>`).join('') : '<tr><td colspan="6" class="px-5 py-16 text-center text-gray-400"><i class="fas fa-users text-4xl mb-3 opacity-20 block"></i>No teams yet</td></tr>'}</tbody></table></div>`;
    } catch (e) { console.error(e); }
}

// ─── SETTINGS ───────────────────────────────────────
function loadSettings() {
    const c = document.getElementById('admin-settings');
    const cfg = adminConfig;
    c.innerHTML = `<div class="mb-8"><h2 class="text-2xl md:text-3xl font-bold gradient-text">Event Settings</h2><p class="text-sm text-gray-500 mt-1">Configure your puzzle challenge</p></div><div class="glass-strong rounded-2xl p-8 max-w-2xl space-y-7">
        <div><label class="block text-xs font-semibold text-gray-500 mb-2.5 uppercase tracking-wider"><i class="fas fa-flag mr-1.5 text-cyan-400/60"></i>Event Name</label><input type="text" id="cfg-event-name" value="${esc(cfg.eventName || '')}"></div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div><label class="block text-xs font-semibold text-gray-500 mb-2.5 uppercase tracking-wider"><i class="fas fa-clock mr-1.5 text-cyan-400/60"></i>Default Riddle Time (sec)</label><input type="number" id="cfg-riddle-time" min="10" max="600" value="${cfg.settings.defaultRiddleTime}"></div>
            <div><label class="block text-xs font-semibold text-gray-500 mb-2.5 uppercase tracking-wider"><i class="fas fa-hourglass-half mr-1.5 text-purple-400/60"></i>Assembly Time (sec)</label><input type="number" id="cfg-assembly-time" min="60" max="3600" value="${cfg.settings.assemblyTime}"></div>
        </div>
        <div class="space-y-4 p-5 rounded-xl bg-gray-50 border border-gray-200">
            <label class="flex items-center gap-3 cursor-pointer group"><input type="checkbox" id="cfg-global-timer" class="w-5 h-5 rounded" ${cfg.settings.enableGlobalTimer ? 'checked' : ''}><span class="text-gray-500 group-hover:text-gray-800 transition-colors">Enable global countdown timer</span></label>
            <label class="flex items-center gap-3 cursor-pointer group"><input type="checkbox" id="cfg-allow-restart" class="w-5 h-5 rounded" ${cfg.settings.allowRestart ? 'checked' : ''}><span class="text-gray-500 group-hover:text-gray-800 transition-colors">Allow restart on wrong answer</span></label>
        </div>
        <button onclick="saveSettings()" class="btn-p px-8 py-3.5 rounded-xl font-bold text-sm"><i class="fas fa-save mr-2"></i>Save Settings</button>
        <div id="settings-msg" class="hidden p-4 rounded-xl text-sm text-center"></div>
    </div>`;
}

async function saveSettings() {
    try {
        await api('PUT', '/api/admin/config', {
            eventName: v('cfg-event-name').trim() || 'Rabbit Coders',
            settings: {
                defaultRiddleTime: parseInt(v('cfg-riddle-time')) || 60,
                assemblyTime: parseInt(v('cfg-assembly-time')) || 300,
                enableGlobalTimer: document.getElementById('cfg-global-timer').checked,
                allowRestart: document.getElementById('cfg-allow-restart').checked
            }
        }, adminToken);
        adminConfig.eventName = v('cfg-event-name').trim() || 'Rabbit Coders';
        adminConfig.settings.defaultRiddleTime = parseInt(v('cfg-riddle-time')) || 60;
        adminConfig.settings.assemblyTime = parseInt(v('cfg-assembly-time')) || 300;
        adminConfig.settings.enableGlobalTimer = document.getElementById('cfg-global-timer').checked;
        adminConfig.settings.allowRestart = document.getElementById('cfg-allow-restart').checked;
        showMsg('settings-msg', 'Settings saved!', 'ok');
    } catch (e) { showMsg('settings-msg', e.message, 'err'); }
}

// ─── SECURITY ───────────────────────────────────────
function buildSecurityTab() {
    document.getElementById('admin-security').innerHTML = `<div class="mb-8"><h2 class="text-2xl md:text-3xl font-bold gradient-text">Security</h2><p class="text-sm text-gray-500 mt-1">Manage admin credentials</p></div><div class="glass-strong rounded-2xl p-8 max-w-lg space-y-6">
        <p class="text-sm text-gray-500 flex items-center gap-2"><i class="fas fa-shield-alt text-orange-400/60"></i>Change admin username and/or password.</p>
        <div><label class="block text-xs font-semibold text-gray-500 mb-2.5 uppercase tracking-wider">Current Password</label><input type="password" id="sec-cur" placeholder="Current password"></div>
        <div><label class="block text-xs font-semibold text-gray-500 mb-2.5 uppercase tracking-wider">New Username <span class="text-gray-600 normal-case tracking-normal">(blank = keep)</span></label><input type="text" id="sec-new-user" placeholder="New username"></div>
        <div><label class="block text-xs font-semibold text-gray-500 mb-2.5 uppercase tracking-wider">New Password <span class="text-gray-600 normal-case tracking-normal">(blank = keep)</span></label><input type="password" id="sec-new-pass" placeholder="New password"></div>
        <div><label class="block text-xs font-semibold text-gray-500 mb-2.5 uppercase tracking-wider">Confirm New Password</label><input type="password" id="sec-conf-pass" placeholder="Confirm"></div>
        <button onclick="changeAdminCreds()" class="btn-p w-full py-3.5 rounded-xl font-bold text-sm"><i class="fas fa-save mr-2"></i>Update Credentials</button>
        <div id="sec-msg" class="hidden p-4 rounded-xl text-sm text-center"></div>
    </div>`;
}

async function changeAdminCreds() {
    const cur = v('sec-cur'), nu = v('sec-new-user').trim(), np = v('sec-new-pass'), cp = v('sec-conf-pass');
    if (np && np !== cp) { showMsg('sec-msg', 'Passwords do not match.', 'err'); return; }
    try {
        await api('PUT', '/api/admin/credentials', { currentPassword: cur, newUsername: nu || undefined, newPassword: np || undefined }, adminToken);
        showMsg('sec-msg', 'Credentials updated!', 'ok');
        sv('sec-cur', ''); sv('sec-new-user', ''); sv('sec-new-pass', ''); sv('sec-conf-pass', '');
    } catch (e) { showMsg('sec-msg', e.message, 'err'); }
}

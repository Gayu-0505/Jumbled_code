/* ═══════════════════════════════════════════════════
   Code Puzzle Challenge — Participant Game Flow
   ═══════════════════════════════════════════════════ */

async function enterChallenge() {
    const teamName = v('e-team').trim(), year = v('e-year'), dept = v('e-dept').trim(), college = v('e-college').trim();
    const err = document.getElementById('e-err'); err.classList.add('hidden');
    if (!teamName) { showErr(err, 'Team name is required.'); return; }
    if (!year) { showErr(err, 'Please select your year.'); return; }
    if (!dept) { showErr(err, 'Department is required.'); return; }
    if (!college) { showErr(err, 'College name is required.'); return; }
    try {
        const data = await api('POST', '/api/participant/join', { teamName, year, dept, college });
        participantToken = data.token;
        sessionStorage.setItem('participantToken', participantToken);
        gs.totalSets = data.totalSets;
        gs.settings = data.settings;
        gs.startTime = Date.now();
        gs.playing = true;
        gs.setIdx = 0; gs.riddleIdx = 0;
        gs.doneSets = []; gs.curParts = [];
        setNavUser(data.displayName);
        initSocket();
        socket.emit('join:participant', participantToken);
        buildGameUI();
        showSec('s-play');
        renderSetIndicators();
        startGlobalTimer();
        showRiddle(data.riddle, data.currentSet);
    } catch (e) { showErr(err, e.message); }
}

function buildGameUI() {
    document.getElementById('s-play').innerHTML = `
    <div class="fixed top-16 left-0 w-full h-1 bg-gray-200 z-40"><div id="g-timer-bar" class="countdown-bar" style="width:100%"></div></div>
    <div class="fixed top-[68px] left-0 right-0 z-40 flex justify-between px-4 py-1.5">
        <div class="glass-strong px-4 py-2 rounded-xl text-sm flex items-center gap-2"><i class="fas fa-hourglass-half text-cyan-400/60 text-xs"></i><span class="text-gray-500">Time</span><span id="g-timer-disp" class="mono text-cyan-400 font-bold">--:--</span></div>
        <div class="glass-strong px-4 py-2 rounded-xl text-sm flex items-center gap-2"><i class="fas fa-code text-purple-400/60 text-xs"></i><span class="text-gray-500">Codes</span><span id="g-sets-prog" class="mono text-purple-400 font-bold">0/${gs.totalSets}</span></div>
    </div>
    <div class="mt-20 max-w-5xl mx-auto">
        <div class="mb-8 text-center"><div class="flex justify-center gap-3 flex-wrap" id="g-set-indicators"></div></div>
        <div id="g-riddle-area" class="max-w-3xl mx-auto">
            <div class="glass-strong rounded-3xl p-8 md:p-10 mb-6 relative overflow-hidden">
                <div class="absolute -top-12 -right-12 w-32 h-32 bg-cyan-400/5 rounded-full blur-3xl pointer-events-none"></div>
                <div class="relative z-10">
                    <div class="flex justify-between items-center mb-6">
                        <div class="flex items-center gap-3 flex-wrap">
                            <span class="px-4 py-1.5 rounded-full bg-gradient-to-r from-cyan-400/10 to-purple-400/10 text-cyan-400 text-xs font-bold border border-cyan-400/15" id="g-set-label">CODE 1</span>
                            <span class="text-xs text-gray-600 font-medium" id="g-riddle-prog">Part 1/5</span>
                        </div>
                        <span class="text-xs text-gray-600 font-medium flex items-center gap-1.5" id="g-riddle-timer"><i class="fas fa-stopwatch text-yellow-400/60"></i>Time: <span class="text-yellow-400">--</span></span>
                    </div>
                    <h3 class="text-xl md:text-2xl font-bold mb-8 leading-relaxed text-gray-800" id="g-question">Loading...</h3>
                    <div class="mb-4" id="g-answer-area">
                        <div class="relative group">
                            <input type="text" id="g-answer-input" placeholder="Type your answer here..." class="w-full text-lg py-4 px-6 pr-36 rounded-2xl bg-white border-2 border-gray-200 focus:border-cyan-400 focus:bg-gray-50 transition-all placeholder-gray-400" autocomplete="off" onkeydown="if(event.key==='Enter')submitAns()">
                            <div class="absolute right-2.5 top-1/2 -translate-y-1/2">
                                <button onclick="submitAns()" class="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-400 to-purple-500 text-black font-bold text-sm hover:shadow-lg hover:shadow-cyan-400/25 transition-all active:scale-95"><i class="fas fa-paper-plane mr-1.5"></i>Submit</button>
                            </div>
                        </div>
                        <p class="text-xs text-gray-600 mt-3 flex items-center gap-1.5"><i class="fas fa-lightbulb text-yellow-400/40"></i>Close answers are accepted — just type what you think!</p>
                    </div>
                    <div id="g-feedback" class="hidden mt-5 p-4 rounded-xl"></div>
                </div>
            </div>
            <div class="glass rounded-2xl p-6 mb-6">
                <h4 class="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2"><i class="fas fa-puzzle-piece text-cyan-400/60"></i>Current Code Parts</h4>
                <div id="g-parts" class="flex flex-wrap gap-2 min-h-[2.5rem]"><p class="text-gray-600 text-sm py-2">Complete riddles to collect code parts</p></div>
                <div class="mt-4 pt-4 border-t border-gray-200">
                    <div class="flex justify-between text-xs text-gray-500 mb-2"><span>Assembly Progress</span><span id="g-parts-cnt" class="mono">0/0 parts</span></div>
                    <div class="h-2 bg-gray-100 rounded-full overflow-hidden"><div id="g-parts-bar" class="h-full bg-gradient-to-r from-cyan-400 to-purple-500 rounded-full transition-all" style="width:0%"></div></div>
                </div>
            </div>
            <div id="g-done-codes" class="hidden glass rounded-2xl p-6">
                <h4 class="text-xs font-bold text-green-400 uppercase tracking-widest mb-4 flex items-center gap-2"><i class="fas fa-check-circle"></i>Completed Codes</h4>
                <div id="g-done-list" class="space-y-2"></div>
            </div>
        </div>
        <div id="g-final" class="hidden max-w-4xl mx-auto anim-slide">
            <div class="glass-strong rounded-3xl p-10 text-center relative overflow-hidden">
                <div class="absolute -top-20 left-1/2 -translate-x-1/2 w-60 h-60 bg-yellow-400/5 rounded-full blur-3xl pointer-events-none"></div>
                <div class="relative z-10">
                    <div class="w-20 h-20 mx-auto bg-gradient-to-br from-yellow-400 to-orange-500 rounded-2xl flex items-center justify-center mb-6 shadow-xl shadow-yellow-400/20 anim-float"><i class="fas fa-trophy text-3xl text-white"></i></div>
                    <h2 class="text-3xl md:text-4xl font-bold mb-3 gradient-text">Final Assembly</h2>
                    <p class="text-gray-400 mb-8 text-lg">Drag and arrange all codes in the <strong class="text-gray-800">correct order</strong></p>
                    <div class="text-left mb-8"><p class="text-xs text-gray-600 mb-3 uppercase tracking-widest font-semibold">Drag to reorder:</p>
                        <div id="g-assembly-list" class="space-y-3 min-h-[200px] p-5 rounded-2xl bg-gray-50 border-2 border-dashed border-gray-300"></div>
                    </div>
                    <button onclick="checkAssembly()" class="btn-p px-10 py-3.5 rounded-xl font-bold text-base"><i class="fas fa-check mr-2"></i>Submit Final Order</button>
                    <div id="g-final-err" class="hidden mt-5 p-4 rounded-xl bg-red-500/8 border border-red-500/20 text-red-400 text-sm"></div>
                </div>
            </div>
        </div>
        <div id="g-result" class="hidden max-w-2xl mx-auto text-center anim-slide py-10"></div>
    </div>`;
}

function renderSetIndicators() {
    const el = document.getElementById('g-set-indicators'); if (!el) return;
    let html = '';
    for (let i = 0; i < gs.totalSets; i++) {
        let cls = 'set-pending', icon = `<span class="text-xs">${i + 1}</span>`;
        if (i < gs.setIdx) { cls = 'set-completed'; icon = '<i class="fas fa-check text-sm"></i>'; }
        else if (i === gs.setIdx) { cls = 'set-current'; icon = `<span class="text-sm">${i + 1}</span>`; }
        html += `<div class="set-indicator ${cls}">${icon}</div>`;
    }
    el.innerHTML = html;
    const prog = document.getElementById('g-sets-prog');
    if (prog) prog.textContent = `${gs.doneSets.length}/${gs.totalSets}`;
}

function startGlobalTimer() {
    if (!gs.settings.enableGlobalTimer) { const tb = document.getElementById('g-timer-bar'); if (tb) tb.style.display = 'none'; return; }
    gs.timeLeft = gs.settings.totalTime;
    const total = gs.timeLeft;
    gs.globalTimer = setInterval(() => {
        gs.timeLeft--;
        const td = document.getElementById('g-timer-disp'); if (td) td.textContent = fmtTime(gs.timeLeft);
        const tb = document.getElementById('g-timer-bar'); if (tb) tb.style.width = (gs.timeLeft / total * 100) + '%';
        if (gs.timeLeft <= 0) endGame(false, "Time's up!");
    }, 1000);
}

function showRiddle(riddle, setInfo) {
    if (!riddle) return;
    const sl = document.getElementById('g-set-label'); if (sl) sl.textContent = `CODE ${gs.setIdx + 1}: ${setInfo ? setInfo.name : ''}`;
    const rp = document.getElementById('g-riddle-prog'); if (rp) rp.textContent = `Part ${gs.riddleIdx + 1}/${setInfo ? setInfo.totalRiddles : '?'}`;
    const gq = document.getElementById('g-question'); if (gq) gq.textContent = riddle.question;
    const fb = document.getElementById('g-feedback'); if (fb) fb.classList.add('hidden');
    gs._currentSetInfo = setInfo;
    // Clear and focus the text input
    const inp = document.getElementById('g-answer-input');
    if (inp) { inp.value = ''; inp.disabled = false; inp.focus(); }
    const submitBtn = document.querySelector('#g-answer-area button');
    if (submitBtn) submitBtn.disabled = false;
    if (gs.settings.enableGlobalTimer) startRiddleTimer(riddle.timeLimit || 60);
}

function startRiddleTimer(secs) {
    if (gs.riddleTimer) clearInterval(gs.riddleTimer);
    let t = secs;
    gs.riddleTimer = setInterval(() => {
        t--;
        const rt = document.getElementById('g-riddle-timer');
        if (rt) rt.innerHTML = `Time: <span class="${t < 10 ? 'text-red-400' : 'text-yellow-400'}">${t}s</span>`;
        if (t <= 0) { clearInterval(gs.riddleTimer); submitAns('__timeout__'); }
    }, 1000);
}

async function submitAns(timeout) {
    if (gs.riddleTimer) clearInterval(gs.riddleTimer);
    // Disable input
    const inp = document.getElementById('g-answer-input');
    const submitBtn = document.querySelector('#g-answer-area button');
    if (inp) inp.disabled = true;
    if (submitBtn) submitBtn.disabled = true;
    const answerText = timeout === '__timeout__' ? '__timeout__' : (inp ? inp.value.trim() : '');
    if (!answerText && timeout !== '__timeout__') {
        if (inp) { inp.disabled = false; inp.focus(); }
        if (submitBtn) submitBtn.disabled = false;
        const fb = document.getElementById('g-feedback');
        fb.className = 'mt-4 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-400';
        fb.innerHTML = '<i class="fas fa-exclamation-circle mr-2"></i>Please type an answer!';
        fb.classList.remove('hidden');
        setTimeout(() => fb.classList.add('hidden'), 2000);
        return;
    }
    try {
        const data = await api('POST', '/api/participant/answer', { answerText }, participantToken);
        if (data.correct) handleCorrectServer(data);
        else handleWrongServer(data);
    } catch (e) { console.error(e); }
}

function handleCorrectServer(data) {
    gs.curParts.push({ part: data.part });
    updParts(data.partsCollected);
    const fb = document.getElementById('g-feedback');
    fb.className = 'mt-4 p-4 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400';
    fb.innerHTML = `<i class="fas fa-check-circle mr-2"></i>Correct! Part unlocked: <code class="ml-2 text-cyan-600 mono">${esc(data.part)}</code>`;
    fb.classList.remove('hidden');

    if (data.setComplete) {
        gs.doneSets.push({ name: 'Code ' + (gs.setIdx + 1) });
        gs.setIdx++;
        gs.riddleIdx = 0;
        gs.curParts = [];
        renderSetIndicators();
        updateDoneCodes(data.doneSets);

        if (data.allSetsComplete) {
            setTimeout(() => showFinalAssembly(data.assemblySets), 2000);
        } else {
            const fb2 = document.getElementById('g-feedback');
            fb2.className = 'mt-4 p-4 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400';
            fb2.innerHTML = `<i class="fas fa-unlock mr-2"></i>Code ${gs.setIdx} complete! Moving to next...`;
            fb2.classList.remove('hidden');
            setTimeout(() => {
                updParts([]);
                showRiddle(data.nextRiddle, data.nextSet);
            }, 2000);
        }
    } else {
        gs.riddleIdx = data.riddleIdx;
        setTimeout(() => showRiddle(data.nextRiddle, gs._currentSetInfo), 1400);
    }
}

function handleWrongServer(data) {
    if (data.gameOver) { endGame(false, data.reason); return; }
    const fb = document.getElementById('g-feedback');
    fb.className = 'mt-4 p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 anim-shake';
    fb.innerHTML = '<i class="fas fa-exclamation-triangle mr-2"></i>' + esc(data.message || 'Wrong! Restarting...');
    fb.classList.remove('hidden');
    gs.riddleIdx = 0; gs.curParts = [];
    setTimeout(() => { updParts([]); showRiddle(data.riddle, gs._currentSetInfo); }, 2000);
}

function updParts(serverParts) {
    const c = document.getElementById('g-parts');
    const parts = serverParts || gs.curParts.map(p => ({ part: p.part }));
    if (!parts.length) { c.innerHTML = '<p class="text-gray-500 text-sm py-2">Complete riddles to collect code parts</p>'; }
    else { c.innerHTML = parts.map((p, i) => `<div class="fragment-part"><span class="part-badge">${i + 1}</span><code class="text-cyan-600 mono text-sm">${esc(p.part)}</code></div>`).join(''); }
    const total = gs._currentSetInfo ? gs._currentSetInfo.totalRiddles : parts.length;
    const cnt = document.getElementById('g-parts-cnt'); if (cnt) cnt.textContent = `${parts.length}/${total} parts`;
    const bar = document.getElementById('g-parts-bar'); if (bar) bar.style.width = (parts.length / total * 100) + '%';
}

function updateDoneCodes(doneSets) {
    if (!doneSets || !doneSets.length) return;
    document.getElementById('g-done-codes').classList.remove('hidden');
    document.getElementById('g-done-list').innerHTML = doneSets.map((s, i) => `<div class="p-3 rounded-lg bg-green-400/10 border border-green-400/30 flex items-center justify-between">
        <div><div class="text-xs text-green-400 mb-0.5">CODE ${i + 1}: ${esc(s.name)}</div><code class="text-cyan-600 mono text-sm">${esc(s.code)}</code></div>
        <i class="fas fa-check-circle text-green-400 ml-3"></i></div>`).join('');
}

function showFinalAssembly(assemblySets) {
    document.getElementById('g-riddle-area').classList.add('hidden');
    document.getElementById('g-final').classList.remove('hidden');
    const list = document.getElementById('g-assembly-list');
    list.innerHTML = '';
    assemblySets.forEach(s => {
        const div = document.createElement('div');
        div.className = 'assembly-item p-4 rounded-lg bg-gray-50 border border-gray-200 cursor-move hover:bg-gray-100 transition-all select-none';
        div.draggable = true; div.dataset.order = s.order;
        div.innerHTML = `<div class="flex items-center gap-4"><i class="fas fa-grip-vertical text-gray-500"></i><div class="flex-1"><div class="text-xs text-gray-400 mb-0.5">${esc(s.name)}</div><code class="mono text-cyan-600">${esc(s.code)}</code></div></div>`;
        div.addEventListener('dragstart', () => { dragEl = div; div.style.opacity = '.4'; });
        div.addEventListener('dragover', e => e.preventDefault());
        div.addEventListener('drop', e => { e.stopPropagation(); if (dragEl && dragEl !== div) { const items = [...list.children], di = items.indexOf(dragEl), ti = items.indexOf(div); if (di < ti) list.insertBefore(dragEl, div.nextSibling); else list.insertBefore(dragEl, div); } });
        div.addEventListener('dragend', () => { div.style.opacity = '1'; dragEl = null; });
        // Touch support
        let touchY = 0;
        div.addEventListener('touchstart', e => { dragEl = div; touchY = e.touches[0].clientY; div.style.opacity = '.6'; }, { passive: true });
        div.addEventListener('touchmove', e => { e.preventDefault(); const touch = e.touches[0]; const el = document.elementFromPoint(touch.clientX, touch.clientY); if (el) { const target = el.closest('.assembly-item'); if (target && target !== dragEl) { const items = [...list.children], di = items.indexOf(dragEl), ti = items.indexOf(target); if (di < ti) list.insertBefore(dragEl, target.nextSibling); else list.insertBefore(dragEl, target); } } }, { passive: false });
        div.addEventListener('touchend', () => { div.style.opacity = '1'; dragEl = null; });
        list.appendChild(div);
    });
}

async function checkAssembly() {
    const items = [...document.getElementById('g-assembly-list').children];
    const order = items.map(el => parseInt(el.dataset.order));
    try {
        const data = await api('POST', '/api/participant/assembly', { order }, participantToken);
        if (data.correct) showVictory(data);
        else { const e = document.getElementById('g-final-err'); e.textContent = data.message; e.classList.remove('hidden'); setTimeout(() => e.classList.add('hidden'), 3500); }
    } catch (e) { console.error(e); }
}

function showVictory(data) {
    stopTimers(); gs.playing = false;
    document.getElementById('g-riddle-area').classList.add('hidden');
    document.getElementById('g-final').classList.add('hidden');
    const r = document.getElementById('g-result'); r.classList.remove('hidden');
    r.innerHTML = `<div class="w-24 h-24 mx-auto bg-gradient-to-br from-cyan-400 to-purple-600 rounded-3xl flex items-center justify-center mb-6 shadow-2xl anim-glow"><i class="fas fa-crown text-4xl text-white"></i></div>
        <h2 class="text-4xl font-bold mb-2 bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">CHALLENGE COMPLETE!</h2>
        <p class="text-xl text-gray-500 mb-6">Well done!</p>
        <div class="glass rounded-xl p-6 mb-6 inline-block"><div class="grid grid-cols-3 gap-8 text-center">
            <div><div class="text-2xl font-bold text-cyan-400 mono">${data.time}</div><div class="text-xs text-gray-400">Time</div></div>
            <div><div class="text-2xl font-bold text-purple-400 mono">${data.codesCompleted}</div><div class="text-xs text-gray-400">Codes</div></div>
            <div><div class="text-2xl font-bold text-yellow-400 mono">#${data.rank}</div><div class="text-xs text-gray-400">Rank</div></div>
        </div></div>
        <div class="space-x-3 mt-4"><button onclick="goHome()" class="px-6 py-3 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50">Home</button></div>`;
    confetti();
}

async function endGame(ok, reason) {
    stopTimers(); gs.playing = false;
    if (!ok) {
        try { await api('POST', '/api/participant/timeout', {}, participantToken); } catch (e) { }
        document.getElementById('g-riddle-area').classList.add('hidden');
        document.getElementById('g-final').classList.add('hidden');
        const r = document.getElementById('g-result'); r.classList.remove('hidden');
        r.innerHTML = `<div class="w-24 h-24 mx-auto bg-red-500/20 rounded-3xl flex items-center justify-center mb-6"><i class="fas fa-times-circle text-4xl text-red-400"></i></div>
            <h2 class="text-4xl font-bold mb-2 text-red-400">Challenge Failed</h2>
            <p class="text-gray-500 mb-6">${esc(reason || 'Challenge failed!')}</p>
            <div class="space-x-3 mt-4"><button onclick="goHome()" class="px-6 py-3 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50">Home</button></div>`;
    }
}

window.addEventListener('beforeunload', e => { if (gs.playing) { e.preventDefault(); e.returnValue = ''; } });

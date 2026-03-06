/* ═══════════════════════════════════════════════════
   Code Puzzle Challenge — Code Sets Admin (CRUD)
   ═══════════════════════════════════════════════════ */

function renderCodeSets() {
    const c = document.getElementById('admin-codesets');
    const sets = [...adminConfig.codeSets].sort((a, b) => a.order - b.order);
    c.innerHTML = `<div class="flex flex-wrap justify-between items-center mb-8 gap-4">
        <div><h2 class="text-2xl md:text-3xl font-bold flex items-center gap-3"><i class="fas fa-layer-group text-cyan-400/80"></i><span class="gradient-text">Code Sets</span></h2><p class="text-sm text-gray-500 mt-2 leading-relaxed">Each set = 1 complete code line built from riddle answers</p></div>
        <button onclick="addCodeSet()" class="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500/15 to-purple-500/15 text-cyan-600 border border-cyan-400/25 hover:border-cyan-400/60 hover:shadow-lg hover:shadow-cyan-400/10 transition-all text-sm font-semibold"><i class="fas fa-plus mr-2"></i>Add Code Set</button>
    </div><div id="codesets-list" class="space-y-7"></div>
    <div class="mt-8 p-5 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 text-sm flex items-start gap-3 leading-relaxed"><i class="fas fa-info-circle mt-0.5 text-blue-400"></i><div>Each <b>Code Set</b> has multiple riddles. Participants type answers (fuzzy matching accepts close answers). Each correct answer reveals a <b>code part</b>. All codes are then arranged in order.</div></div>`;
    const list = document.getElementById('codesets-list');
    sets.forEach((set, idx) => {
        const div = document.createElement('div');
        div.className = 'rs-card';
        div.innerHTML = buildSetHTML(set, idx, sets.length);
        list.appendChild(div);
    });
}

function buildSetHTML(set, idx, total) {
    return `<div class="flex justify-between items-start mb-7">
        <div class="flex items-center gap-5">
            <div class="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-400 to-purple-600 flex items-center justify-center font-bold text-white text-xl shadow-lg shadow-cyan-400/15 flex-shrink-0" style="font-family:'JetBrains Mono',monospace">${idx + 1}</div>
            <div><input type="text" value="${esc(set.name)}" onchange="updSet('${set.id}','name',this.value)" class="bg-transparent border-b-2 border-gray-200 text-xl font-bold text-gray-800 focus:border-cyan-400 focus:outline-none px-0 py-1.5 w-full transition-colors hover:border-gray-400" style="width:auto;min-width:220px;font-family:'Space Grotesk','Inter',sans-serif">
                <div class="text-[11px] text-gray-400 mt-2 font-mono tracking-wide">ID: ${set.id}</div></div>
        </div>
        <div class="flex gap-1.5">
            <button onclick="moveSet('${set.id}',-1)" class="w-9 h-9 rounded-xl bg-gray-100 border border-gray-200 text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-all flex items-center justify-center" ${idx === 0 ? 'disabled style="opacity:.2;pointer-events:none"' : ''}><i class="fas fa-arrow-up text-xs"></i></button>
            <button onclick="moveSet('${set.id}',1)" class="w-9 h-9 rounded-xl bg-gray-100 border border-gray-200 text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-all flex items-center justify-center" ${idx === total - 1 ? 'disabled style="opacity:.2;pointer-events:none"' : ''}><i class="fas fa-arrow-down text-xs"></i></button>
            <button onclick="delSet('${set.id}')" class="w-9 h-9 rounded-xl bg-red-50 border border-red-200 text-red-400 hover:bg-red-100 hover:text-red-500 transition-all flex items-center justify-center"><i class="fas fa-trash text-xs"></i></button>
        </div></div>
    <div class="mb-7 p-5 rounded-2xl bg-gray-50 border border-cyan-200">
        <label class="text-[11px] text-gray-500 uppercase tracking-[0.15em] block mb-3 font-bold">Complete Code (Final Answer)</label>
        <input type="text" value="${esc(set.code)}" onchange="updSet('${set.id}','code',this.value)" class="mono text-cyan-600 bg-white border border-cyan-200 focus:border-cyan-400 focus:outline-none rounded-xl px-5 py-3" style="font-size:0.9rem">
        <p class="text-xs text-gray-400 mt-3 leading-relaxed"><i class="fas fa-info-circle mr-1.5 text-gray-400"></i>Participants must place this line in the correct position</p>
    </div>
    <div class="border-t border-gray-200 pt-7">
        <div class="flex justify-between items-center mb-5">
            <h4 class="text-sm font-bold text-gray-600 flex items-center gap-2.5" style="font-family:'Space Grotesk','Inter',sans-serif"><i class="fas fa-puzzle-piece text-purple-500"></i>Riddles <span class="text-[11px] font-semibold text-gray-500 bg-gray-100 px-2.5 py-0.5 rounded-full ml-1">${set.riddles.length}</span></h4>
            <button onclick="addRiddle('${set.id}')" class="text-xs px-5 py-2.5 rounded-xl bg-purple-500/8 text-purple-400 hover:bg-purple-500/15 border border-purple-400/15 hover:border-purple-400/35 transition-all font-semibold"><i class="fas fa-plus mr-1.5"></i>Add Riddle</button>
        </div>
        <div class="space-y-5">${set.riddles.map((r, ri) => buildRiddleHTML(set.id, r, ri)).join('')}</div>
    </div>`;
}

function buildRiddleHTML(setId, r, ri) {
    return `<div class="rs-sub">
        <div class="flex justify-between items-center mb-5">
            <div class="flex items-center gap-3"><span class="part-badge">${ri + 1}</span><span class="text-xs text-purple-400/90 font-bold uppercase tracking-[0.12em]" style="font-family:'Space Grotesk','Inter',sans-serif">Part ${ri + 1}</span></div>
            <button onclick="delRiddle('${setId}','${r.id}')" class="w-8 h-8 rounded-lg bg-red-500/5 text-red-400/50 hover:text-red-400 hover:bg-red-500/15 transition-all flex items-center justify-center"><i class="fas fa-trash text-xs"></i></button>
        </div>
        <div class="mb-5"><label class="text-[11px] text-gray-500 block mb-2.5 font-bold uppercase tracking-[0.12em]">Question</label>
            <textarea rows="2" class="text-sm leading-relaxed" placeholder="Enter the riddle question..." onchange="updRiddle('${setId}','${r.id}','question',this.value)">${esc(r.question)}</textarea></div>
        <div class="mb-5"><label class="text-[11px] text-green-400/90 block mb-2.5 font-bold uppercase tracking-[0.12em]"><i class="fas fa-check-circle mr-1.5"></i>Correct Answer</label>
            <input type="text" value="${esc(r.answer || '')}" class="text-sm border-green-500/20 focus:border-green-400" placeholder="Type the correct answer (fuzzy matching enabled)" onchange="updRiddle('${setId}','${r.id}','answer',this.value)"></div>
        <div class="grid grid-cols-2 gap-5">
            <div><label class="text-[11px] text-cyan-400/80 block mb-2.5 font-bold uppercase tracking-[0.12em]"><i class="fas fa-code mr-1.5"></i>Code Part (revealed)</label>
                <input type="text" value="${esc(r.part || '')}" class="mono text-cyan-600 text-sm" onchange="updRiddle('${setId}','${r.id}','part',this.value)" placeholder="e.g. function"></div>
            <div><label class="text-[11px] text-gray-500 block mb-2.5 font-bold uppercase tracking-[0.12em]"><i class="fas fa-clock mr-1.5"></i>Time Limit (sec)</label>
                <input type="number" value="${r.timeLimit || 60}" class="text-sm" onchange="updRiddle('${setId}','${r.id}','timeLimit',parseInt(this.value))"></div>
        </div></div>`;
}

async function saveConfig() {
    try { await api('PUT', '/api/admin/config', { codeSets: adminConfig.codeSets }, adminToken); } catch (e) { alert('Save failed: ' + e.message); }
}

function addCodeSet() {
    const newId = 'cs_' + Date.now();
    adminConfig.codeSets.push({
        id: newId, name: 'New Code Set', order: adminConfig.codeSets.length, code: '// your code here',
        riddles: [{ id: 'r_' + Date.now(), question: 'Enter your riddle...', answer: 'answer', part: 'part1', timeLimit: adminConfig.settings.defaultRiddleTime || 60 }]
    });
    saveConfig(); renderCodeSets();
}
function delSet(id) {
    if (adminConfig.codeSets.length <= 1) { alert('Need at least 1 code set.'); return; }
    if (!confirm('Delete this code set?')) return;
    adminConfig.codeSets = adminConfig.codeSets.filter(s => s.id !== id);
    adminConfig.codeSets.sort((a, b) => a.order - b.order).forEach((s, i) => s.order = i);
    saveConfig(); renderCodeSets();
}
function moveSet(id, dir) {
    const s = adminConfig.codeSets.find(x => x.id === id), no = s.order + dir;
    if (no < 0 || no >= adminConfig.codeSets.length) return;
    const o = adminConfig.codeSets.find(x => x.order === no);
    o.order = s.order; s.order = no;
    saveConfig(); renderCodeSets();
}
function updSet(id, field, val) { adminConfig.codeSets.find(x => x.id === id)[field] = val; saveConfig(); }
function addRiddle(setId) {
    const s = adminConfig.codeSets.find(x => x.id === setId);
    s.riddles.push({ id: 'r_' + Date.now(), question: 'New riddle...', answer: 'answer', part: 'newPart', timeLimit: adminConfig.settings.defaultRiddleTime || 60 });
    saveConfig(); renderCodeSets();
}
function delRiddle(setId, rId) {
    const s = adminConfig.codeSets.find(x => x.id === setId);
    if (s.riddles.length <= 1) { alert('Need at least 1 riddle per set.'); return; }
    s.riddles = s.riddles.filter(r => r.id !== rId);
    saveConfig(); renderCodeSets();
}
function updRiddle(setId, rId, field, val) {
    adminConfig.codeSets.find(x => x.id === setId).riddles.find(r => r.id === rId)[field] = val; saveConfig();
}


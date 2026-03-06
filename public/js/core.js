/* ═══════════════════════════════════════════════════
   Code Puzzle Challenge — Client Core (API + State)
   ═══════════════════════════════════════════════════ */
const API = '';
let socket = null;
let adminToken = null;
let participantToken = null;
let adminConfig = null;

// Game state
let gs = {
    setIdx: 0, riddleIdx: 0, doneSets: [], curParts: [], startTime: null,
    globalTimer: null, riddleTimer: null, timeLeft: 0, playing: false, totalSets: 0,
    totalTime: 0, settings: {}
};
let dragEl = null;

// ─── API helpers ────────────────────────────────────
async function api(method, url, body, token) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers[url.includes('/admin') ? 'x-admin-token' : 'x-session-token'] = token;
    try {
        const r = await fetch(API + url, { method, headers, body: body ? JSON.stringify(body) : undefined });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || 'Request failed');
        return data;
    } catch (e) { throw e; }
}

// ─── Socket.IO ──────────────────────────────────────
function initSocket() {
    if (socket) return;
    socket = io();
    socket.on('connect', () => console.log('Socket connected'));
}

// ─── Navigation ─────────────────────────────────────
const ALL_SEC = ['s-landing', 's-p-entry', 's-admin-login', 's-admin', 's-play'];
function showSec(id) {
    ALL_SEC.forEach(s => { const el = document.getElementById(s); if (el) el.classList.add('hidden'); });
    const el = document.getElementById(id);
    if (el) { el.classList.remove('hidden'); el.classList.add('anim-slide'); setTimeout(() => el.classList.remove('anim-slide'), 700); }
}
function goHome() { logout(); }

function setNavUser(name) {
    document.getElementById('nav-user').classList.remove('hidden');
    document.getElementById('nav-user').classList.add('flex');
    document.getElementById('nav-username').textContent = name;
    document.getElementById('nav-logout').classList.remove('hidden');
    document.getElementById('nav-home-btn').classList.remove('hidden');
}
function clearNav() {
    document.getElementById('nav-user').classList.add('hidden');
    document.getElementById('nav-user').classList.remove('flex');
    document.getElementById('nav-logout').classList.add('hidden');
    document.getElementById('nav-home-btn').classList.add('hidden');
}

function logout() {
    if (gs.playing && !confirm('You are mid-challenge. Logout anyway?')) return;
    stopTimers();
    adminToken = null; participantToken = null; adminConfig = null;
    sessionStorage.clear();
    gs = {
        setIdx: 0, riddleIdx: 0, doneSets: [], curParts: [], startTime: null,
        globalTimer: null, riddleTimer: null, timeLeft: 0, playing: false, totalSets: 0, totalTime: 0, settings: {}
    };
    clearNav();
    showSec('s-landing');
}

// ─── Helpers ────────────────────────────────────────
function v(id) { return document.getElementById(id).value; }
function sv(id, val) { document.getElementById(id).value = val; }
function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function fmtTime(s) { return Math.floor(s / 60).toString().padStart(2, '0') + ':' + (s % 60).toString().padStart(2, '0'); }
function showErr(el, msg) { el.textContent = msg; el.classList.remove('hidden'); }
function showMsg(id, msg, type) {
    const el = document.getElementById(id); if (!el) return;
    el.textContent = msg;
    el.className = 'mt-2 p-3 rounded-lg text-sm text-center ' + (type === 'ok' ? 'bg-green-100 border border-green-200 text-green-600' : 'bg-red-100 border border-red-200 text-red-500');
    el.classList.remove('hidden'); setTimeout(() => el.classList.add('hidden'), 4000);
}
function confetti() {
    const cols = ['#0ea5e9', '#8b5cf6', '#ec4899', '#f59e0b'];
    for (let i = 0; i < 60; i++) setTimeout(() => {
        const el = document.createElement('div'); el.className = 'confetti';
        el.style.cssText = `left:${Math.random() * 100}%;background:${cols[Math.floor(Math.random() * cols.length)]};animation-duration:${Math.random() * 2 + 2}s`;
        document.body.appendChild(el); setTimeout(() => el.remove(), 4000);
    }, i * 40);
}
function stopTimers() {
    if (gs.globalTimer) clearInterval(gs.globalTimer);
    if (gs.riddleTimer) clearInterval(gs.riddleTimer);
}

// ─── Init ───────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    initSocket();
    const at = sessionStorage.getItem('adminToken');
    const pt = sessionStorage.getItem('participantToken');
    if (at) { adminToken = at; enterAdmin(); }
    else if (pt) { participantToken = pt; /* can't resume - show landing */ showSec('s-landing'); }
    else showSec('s-landing');
});

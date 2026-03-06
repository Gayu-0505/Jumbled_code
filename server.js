/**
 * Code Puzzle Challenge — Event Server
 * Node.js + Express + Socket.IO
 * Supports 25+ concurrent participants across different networks
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── DATA FILE ──────────────────────────────────────────────
const DATA_FILE = path.join(__dirname, 'data.json');

const DEFAULT_CONFIG = {
    adminUsername: 'admin',
    adminPassword: 'admin123',
    eventName: 'Rabbit Coders',
    codeSets: [
        {
            id: 'cs1', name: 'Initialization', order: 0,
            code: 'function initializeSystem() {',
            riddles: [
                { id: 'r1', question: 'I have cities but no houses, mountains but no trees. What am I?', answer: 'A Map', part: 'function', timeLimit: 60 },
                { id: 'r2', question: 'The more you have of me, the less you see. What am I?', answer: 'Darkness', part: ' initializeSystem', timeLimit: 60 },
                { id: 'r3', question: 'I am taken from a mine and shut in a wooden case. What am I?', answer: 'Pencil Lead', part: '(', timeLimit: 60 },
                { id: 'r4', question: 'I have keys but no locks. What am I?', answer: 'A Keyboard', part: ') ', timeLimit: 60 },
                { id: 'r5', question: 'I can be cracked, made, told, and played. What am I?', answer: 'A Joke', part: '{', timeLimit: 60 }
            ]
        },
        {
            id: 'cs2', name: 'Configuration', order: 1,
            code: '  const config = loadConfig();',
            riddles: [
                { id: 'r6', question: 'I have a neck but no head. What am I?', answer: 'A Bottle', part: '  const', timeLimit: 60 },
                { id: 'r7', question: 'I go up but never come down. What am I?', answer: 'Age', part: ' config', timeLimit: 60 },
                { id: 'r8', question: 'I have hands but cannot clap. What am I?', answer: 'A Clock', part: ' =', timeLimit: 60 },
                { id: 'r9', question: 'I am full of holes but hold water. What am I?', answer: 'A Sponge', part: ' loadConfig()', timeLimit: 60 },
                { id: 'r10', question: 'I have a spine but no bones. What am I?', answer: 'A Book', part: ';', timeLimit: 60 }
            ]
        },
        {
            id: 'cs3', name: 'Authentication', order: 2,
            code: '  if (authenticateUser()) {',
            riddles: [
                { id: 'r11', question: 'I fly without wings. What am I?', answer: 'Time', part: '  if', timeLimit: 60 },
                { id: 'r12', question: 'I am always in front but never seen. What am I?', answer: 'The Future', part: ' (', timeLimit: 60 },
                { id: 'r13', question: 'I get wet while drying. What am I?', answer: 'A Towel', part: 'authenticateUser()', timeLimit: 60 },
                { id: 'r14', question: 'I have branches but no fruit or leaves. What am I?', answer: 'A Bank', part: ')', timeLimit: 60 },
                { id: 'r15', question: 'I have a face but no eyes. What am I?', answer: 'A Clock', part: ' {', timeLimit: 60 }
            ]
        }
    ],
    settings: { defaultRiddleTime: 60, assemblyTime: 300, enableGlobalTimer: true, allowRestart: true }
};

// ─── IN-MEMORY STATE ────────────────────────────────────────
let config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
let results = [];
let sessions = {};    // { token: { type, id, displayName, year, dept, college, gameState } }
let activePlayers = {};  // { token: { socketId, setIdx, riddleIdx, doneSets, curParts, startTime, playing } }

function loadData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
            if (raw.config) config = raw.config;
            if (raw.results) results = raw.results;
        }
    } catch (e) {
        console.log('No existing data file, using defaults.');
    }
}

function saveData() {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify({ config, results }, null, 2), 'utf8');
    } catch (e) {
        console.error('Failed to save data:', e.message);
    }
}

loadData();

// ─── HELPERS ────────────────────────────────────────────────
function fmtTime(s) {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    return m + ':' + (s % 60).toString().padStart(2, '0');
}

function sortedSets() {
    return [...config.codeSets].sort((a, b) => a.order - b.order);
}

function sanitizeRiddle(riddle) {
    // Strip the answer — client should NEVER see this
    return {
        id: riddle.id,
        question: riddle.question,
        timeLimit: riddle.timeLimit || 60
    };
}

// ─── FUZZY ANSWER MATCHING ──────────────────────────────────
function normalize(str) {
    return String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function levenshtein(a, b) {
    const m = a.length, n = b.length;
    const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            dp[i][j] = a[i - 1] === b[j - 1]
                ? dp[i - 1][j - 1]
                : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
        }
    }
    return dp[m][n];
}

function fuzzyMatch(userAnswer, correctAnswer) {
    const ua = normalize(userAnswer);
    const ca = normalize(correctAnswer);
    if (!ua) return false;
    // Exact normalized match
    if (ua === ca) return true;
    // One contains the other
    if (ua.includes(ca) || ca.includes(ua)) return true;
    // Levenshtein distance — allow more tolerance for longer answers
    const maxDist = Math.max(1, Math.floor(ca.length * 0.35));
    if (levenshtein(ua, ca) <= maxDist) return true;
    return false;
}

function getLeaderboardData() {
    const sorted = [...results].sort((a, b) => {
        if (a.completed !== b.completed) return (b.completed ? 1 : 0) - (a.completed ? 1 : 0);
        return a.timeSecs - b.timeSecs;
    });
    const done = results.filter(r => r.completed);
    const bestTime = done.length ? done.sort((a, b) => a.timeSecs - b.timeSecs)[0].timeStr : '--:--';
    const avgTime = done.length ? fmtTime(Math.round(done.reduce((s, r) => s + r.timeSecs, 0) / done.length)) : '--:--';
    return {
        entries: sorted,
        stats: {
            total: results.length,
            completed: done.length,
            bestTime,
            avgTime
        }
    };
}

function broadcastLeaderboard() {
    io.to('admin-room').emit('leaderboard:update', getLeaderboardData());
}

function broadcastActivePlayers() {
    const active = Object.entries(activePlayers).map(([token, p]) => {
        const sess = sessions[token];
        return {
            displayName: sess ? sess.displayName : 'Unknown',
            setIdx: p.setIdx,
            riddleIdx: p.riddleIdx,
            doneSetsCount: p.doneSets.length,
            totalSets: sortedSets().length
        };
    }).filter(p => p);
    io.to('admin-room').emit('activePlayers:update', active);
}

// ─── AUTH MIDDLEWARE ─────────────────────────────────────────
function requireAdmin(req, res, next) {
    const token = req.headers['x-admin-token'];
    if (!token || !sessions[token] || sessions[token].type !== 'admin') {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
}

function requireParticipant(req, res, next) {
    const token = req.headers['x-session-token'];
    if (!token || !sessions[token] || sessions[token].type !== 'participant') {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    req.sessionToken = token;
    req.participant = sessions[token];
    next();
}

// ─── ADMIN ROUTES ───────────────────────────────────────────
app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;
    if (username === config.adminUsername && password === config.adminPassword) {
        const token = 'admin_' + uuidv4();
        sessions[token] = { type: 'admin', displayName: username };
        res.json({ token, displayName: username });
    } else {
        res.status(401).json({ error: 'Incorrect admin credentials.' });
    }
});

app.get('/api/admin/config', requireAdmin, (req, res) => {
    res.json(config);
});

app.put('/api/admin/config', requireAdmin, (req, res) => {
    const { eventName, codeSets, settings } = req.body;
    if (eventName !== undefined) config.eventName = eventName;
    if (codeSets !== undefined) config.codeSets = codeSets;
    if (settings !== undefined) config.settings = { ...config.settings, ...settings };
    saveData();
    res.json({ ok: true });
});

app.put('/api/admin/credentials', requireAdmin, (req, res) => {
    const { currentPassword, newUsername, newPassword } = req.body;
    if (currentPassword !== config.adminPassword) {
        return res.status(400).json({ error: 'Current password is incorrect.' });
    }
    if (newPassword && newPassword.length < 4) {
        return res.status(400).json({ error: 'New password must be at least 4 characters.' });
    }
    if (newUsername) config.adminUsername = newUsername;
    if (newPassword) config.adminPassword = newPassword;
    saveData();
    res.json({ ok: true });
});

app.get('/api/admin/leaderboard', requireAdmin, (req, res) => {
    res.json(getLeaderboardData());
});

app.delete('/api/admin/results', requireAdmin, (req, res) => {
    results = [];
    saveData();
    broadcastLeaderboard();
    res.json({ ok: true });
});

app.get('/api/admin/export', (req, res) => {
    // Accept token from query param for direct download links
    const token = req.headers['x-admin-token'] || req.query.t;
    if (!token || !sessions[token] || sessions[token].type !== 'admin') {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const sorted = [...results].sort((a, b) => a.timeSecs - b.timeSecs);
    const rows = [['Rank', 'Team Name', 'Year', 'Department', 'College', 'Codes Completed', 'Time', 'Status', 'Timestamp']];
    sorted.forEach((r, i) => rows.push([
        i + 1, r.displayName, r.year || '', r.dept || '', r.college || '',
        `${r.codesCompleted}/${config.codeSets.length}`, r.timeStr,
        r.completed ? 'Completed' : 'Failed', new Date(r.timestamp).toISOString()
    ]));
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=leaderboard-${Date.now()}.csv`);
    res.send(csv);
});

app.get('/api/admin/participants', requireAdmin, (req, res) => {
    res.json(results);
});

// ─── PARTICIPANT ROUTES ─────────────────────────────────────
app.post('/api/participant/join', (req, res) => {
    const { teamName, year, dept, college } = req.body;
    if (!teamName || !year || !dept || !college) {
        return res.status(400).json({ error: 'All fields are required.' });
    }
    const token = 'p_' + uuidv4();
    const id = 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    sessions[token] = { type: 'participant', id, displayName: teamName, year, dept, college };

    // Initialize game state
    const sets = sortedSets();
    activePlayers[token] = {
        setIdx: 0, riddleIdx: 0,
        doneSets: [], curParts: [],
        startTime: Date.now(), playing: true
    };

    // Send first riddle info (sanitized)
    const firstSet = sets[0];
    const firstRiddle = firstSet ? sanitizeRiddle(firstSet.riddles[0]) : null;

    broadcastActivePlayers();
    io.to('admin-room').emit('participant:joined', { displayName: teamName, year, dept, college });

    res.json({
        token,
        displayName: teamName,
        totalSets: sets.length,
        currentSet: { name: firstSet.name, totalRiddles: firstSet.riddles.length },
        riddle: firstRiddle,
        settings: {
            enableGlobalTimer: config.settings.enableGlobalTimer,
            assemblyTime: config.settings.assemblyTime,
            allowRestart: config.settings.allowRestart,
            totalTime: sets.reduce((s, set) => s + set.riddles.reduce((a, r) => a + (r.timeLimit || 60), 0), 0) + config.settings.assemblyTime
        }
    });
});

app.post('/api/participant/answer', requireParticipant, (req, res) => {
    const token = req.sessionToken;
    const player = activePlayers[token];
    if (!player || !player.playing) {
        return res.status(400).json({ error: 'No active game session.' });
    }

    const { answerText } = req.body;
    const sets = sortedSets();
    const currentSet = sets[player.setIdx];
    if (!currentSet) return res.status(400).json({ error: 'Invalid game state.' });

    const riddle = currentSet.riddles[player.riddleIdx];
    if (!riddle) return res.status(400).json({ error: 'Invalid riddle index.' });

    const isCorrect = answerText === '__timeout__' ? false : fuzzyMatch(answerText || '', riddle.answer);

    if (isCorrect) {
        player.curParts.push({ idx: player.riddleIdx, part: riddle.part });
        player.riddleIdx++;

        // Check if this set is complete
        if (player.riddleIdx >= currentSet.riddles.length) {
            player.doneSets.push({ setId: currentSet.id, name: currentSet.name, code: currentSet.code, order: currentSet.order });
            player.setIdx++;
            player.riddleIdx = 0;
            player.curParts = [];

            // Check if ALL sets done — move to assembly
            if (player.setIdx >= sets.length) {
                broadcastActivePlayers();
                // Shuffle done sets for assembly
                const shuffledSets = [...player.doneSets].sort(() => Math.random() - 0.5);
                return res.json({
                    correct: true,
                    part: riddle.part,
                    setComplete: true,
                    allSetsComplete: true,
                    assemblySets: shuffledSets.map(s => ({ name: s.name, code: s.code, order: s.order })),
                    doneSets: player.doneSets.map(s => ({ name: s.name, code: s.code }))
                });
            }

            // Move to next set
            const nextSet = sets[player.setIdx];
            const nextRiddle = sanitizeRiddle(nextSet.riddles[0]);
            broadcastActivePlayers();
            return res.json({
                correct: true,
                part: riddle.part,
                setComplete: true,
                allSetsComplete: false,
                nextSet: { name: nextSet.name, totalRiddles: nextSet.riddles.length },
                nextRiddle: nextRiddle,
                doneSets: player.doneSets.map(s => ({ name: s.name, code: s.code })),
                partsCollected: [],
                setIdx: player.setIdx,
                totalSets: sets.length
            });
        }

        // Next riddle in same set
        const nextRiddle = sanitizeRiddle(currentSet.riddles[player.riddleIdx]);
        broadcastActivePlayers();
        return res.json({
            correct: true,
            part: riddle.part,
            setComplete: false,
            nextRiddle,
            partsCollected: player.curParts.map(p => ({ idx: p.idx, part: p.part })),
            riddleIdx: player.riddleIdx,
            totalRiddles: currentSet.riddles.length
        });
    } else {
        // Wrong answer
        if (!config.settings.allowRestart) {
            // Game over
            player.playing = false;
            const elap = Math.floor((Date.now() - player.startTime) / 1000);
            const sess = sessions[token];
            const rec = {
                id: 'res_' + Date.now(),
                participantId: sess.id,
                displayName: sess.displayName,
                year: sess.year || '',
                dept: sess.dept || '',
                college: sess.college || '',
                codesCompleted: player.doneSets.length,
                timeSecs: elap,
                timeStr: fmtTime(elap),
                completed: false,
                timestamp: Date.now()
            };
            results.push(rec);
            saveData();
            broadcastLeaderboard();
            broadcastActivePlayers();
            return res.json({ correct: false, gameOver: true, reason: 'Wrong answer! Game Over.' });
        }

        // Restart current set
        player.riddleIdx = 0;
        player.curParts = [];
        const restartRiddle = sanitizeRiddle(currentSet.riddles[0]);
        broadcastActivePlayers();
        return res.json({
            correct: false,
            gameOver: false,
            restart: true,
            riddle: restartRiddle,
            message: 'Wrong! Restarting this code from the first riddle...'
        });
    }
});

app.post('/api/participant/assembly', requireParticipant, (req, res) => {
    const token = req.sessionToken;
    const player = activePlayers[token];
    if (!player) return res.status(400).json({ error: 'No active game session.' });

    const { order } = req.body;  // Array of order values submitted by participant
    const correct = order.every((v, i) => v === i);

    if (correct) {
        player.playing = false;
        const elap = Math.floor((Date.now() - player.startTime) / 1000);
        const sess = sessions[token];
        const rec = {
            id: 'res_' + Date.now(),
            participantId: sess.id,
            displayName: sess.displayName,
            year: sess.year || '',
            dept: sess.dept || '',
            college: sess.college || '',
            codesCompleted: player.doneSets.length,
            timeSecs: elap,
            timeStr: fmtTime(elap),
            completed: true,
            timestamp: Date.now()
        };
        results.push(rec);
        saveData();
        broadcastLeaderboard();
        broadcastActivePlayers();

        const rank = results.filter(r => r.completed).sort((a, b) => a.timeSecs - b.timeSecs).findIndex(r => r.id === rec.id) + 1;
        return res.json({
            correct: true,
            time: fmtTime(elap),
            timeSecs: elap,
            codesCompleted: player.doneSets.length,
            rank
        });
    } else {
        return res.json({ correct: false, message: 'Incorrect sequence! Arrange codes in the correct order.' });
    }
});

app.post('/api/participant/timeout', requireParticipant, (req, res) => {
    const token = req.sessionToken;
    const player = activePlayers[token];
    if (!player) return res.status(400).json({ error: 'No active game session.' });

    player.playing = false;
    const elap = Math.floor((Date.now() - player.startTime) / 1000);
    const sess = sessions[token];
    const rec = {
        id: 'res_' + Date.now(),
        participantId: sess.id,
        displayName: sess.displayName,
        year: sess.year || '',
        dept: sess.dept || '',
        college: sess.college || '',
        codesCompleted: player.doneSets.length,
        timeSecs: elap,
        timeStr: fmtTime(elap),
        completed: false,
        timestamp: Date.now()
    };
    results.push(rec);
    saveData();
    broadcastLeaderboard();
    broadcastActivePlayers();
    res.json({ ok: true });
});

// ─── SOCKET.IO ──────────────────────────────────────────────
io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    socket.on('join:admin', (token) => {
        if (sessions[token] && sessions[token].type === 'admin') {
            socket.join('admin-room');
            socket.emit('leaderboard:update', getLeaderboardData());
            broadcastActivePlayers();
        }
    });

    socket.on('join:participant', (token) => {
        if (sessions[token] && sessions[token].type === 'participant') {
            socket.join('participant-room');
            if (activePlayers[token]) {
                activePlayers[token].socketId = socket.id;
            }
        }
    });

    socket.on('disconnect', () => {
        console.log(`Socket disconnected: ${socket.id}`);
    });
});

// ─── START SERVER ───────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('╔══════════════════════════════════════════════════╗');
    console.log('║       CODE PUZZLE CHALLENGE — EVENT SERVER       ║');
    console.log('╠══════════════════════════════════════════════════╣');
    console.log(`║  Local:   http://localhost:${PORT}                  ║`);
    console.log('║                                                  ║');
    console.log('║  For remote participants, use a tunnel service:  ║');
    console.log('║    npx localtunnel --port 3000                   ║');
    console.log('║    or ngrok http 3000                            ║');
    console.log('║                                                  ║');
    console.log('║  Admin default:  admin / admin123                ║');
    console.log('╚══════════════════════════════════════════════════╝');
    console.log('');
});

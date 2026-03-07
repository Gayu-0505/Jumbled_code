require('dotenv').config();
const express = require('express');
const path = require('path');
const app = express();

app.use(express.json());

// ─── Admin credentials (from .env or defaults) ─────────
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'rbcd1303';

// ─── Game state (in-memory) ─────────────────────────────
let gameStarted = false;

// Serve Supabase config from environment variables
app.get('/config.js', (req, res) => {
  res.type('application/javascript');
  res.send(
    `window.__SUPABASE_URL__=${JSON.stringify(process.env.SUPABASE_URL || '')};
     window.__SUPABASE_ANON_KEY__=${JSON.stringify(process.env.SUPABASE_ANON_KEY || '')};`
  );
});

// ─── Admin login ────────────────────────────────────────
app.post('/api/admin-login', (req, res) => {
  const { username, password } = req.body || {};
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    res.json({ ok: true });
  } else {
    res.status(401).json({ ok: false, error: 'Invalid credentials' });
  }
});

// ─── Game status ────────────────────────────────────────
app.get('/api/game-status', (req, res) => {
  res.json({ started: gameStarted });
});

app.post('/api/game-start', (req, res) => {
  const { username, password } = req.body || {};
  if (username !== ADMIN_USER || password !== ADMIN_PASS) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
  gameStarted = true;
  res.json({ ok: true, started: true });
});

app.post('/api/game-stop', (req, res) => {
  const { username, password } = req.body || {};
  if (username !== ADMIN_USER || password !== ADMIN_PASS) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
  gameStarted = false;
  res.json({ ok: true, started: false });
});

// ─── Leaderboard API (server-side Supabase proxy) ───────
app.get('/api/leaderboard', async (req, res) => {
  const sbUrl = process.env.SUPABASE_URL;
  const sbKey = process.env.SUPABASE_ANON_KEY;
  if (!sbUrl || !sbKey) {
    return res.status(500).json({ ok: false, error: 'Supabase not configured' });
  }
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const response = await fetch(
      `${sbUrl}/rest/v1/leaderboard?select=*&programs_completed=eq.3&order=time_seconds.asc&limit=${limit}`,
      {
        headers: {
          'apikey': sbKey,
          'Authorization': `Bearer ${sbKey}`
        }
      }
    );
    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({ ok: false, error: text });
    }
    const data = await response.json();
    res.json({ ok: true, data });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/api/leaderboard', async (req, res) => {
  const sbUrl = process.env.SUPABASE_URL;
  const sbKey = process.env.SUPABASE_ANON_KEY;
  if (!sbUrl || !sbKey) {
    return res.status(500).json({ ok: false, error: 'Supabase not configured' });
  }
  const { name, programs_completed, time_seconds } = req.body || {};
  if (!name || typeof time_seconds !== 'number') {
    return res.status(400).json({ ok: false, error: 'Missing name or time_seconds' });
  }
  try {
    const response = await fetch(
      `${sbUrl}/rest/v1/leaderboard`,
      {
        method: 'POST',
        headers: {
          'apikey': sbKey,
          'Authorization': `Bearer ${sbKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({ name, programs_completed: programs_completed || 3, time_seconds })
      }
    );
    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({ ok: false, error: text });
    }
    const data = await response.json();
    res.json({ ok: true, data });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/api/reset-leaderboard', async (req, res) => {
  const { username, password } = req.body || {};
  if (username !== ADMIN_USER || password !== ADMIN_PASS) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
  const sbUrl = process.env.SUPABASE_URL;
  const sbServiceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!sbUrl || !sbServiceKey) {
    return res.json({ ok: false, error: 'No SUPABASE_SERVICE_KEY set in .env — needed for delete operations' });
  }
  try {
    const response = await fetch(
      `${sbUrl}/rest/v1/leaderboard?id=not.is.null`,
      {
        method: 'DELETE',
        headers: {
          'apikey': sbServiceKey,
          'Authorization': `Bearer ${sbServiceKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        }
      }
    );
    if (!response.ok) {
      const text = await response.text();
      return res.json({ ok: false, error: text });
    }
    const data = await response.json();
    gameStarted = false;
    res.json({ ok: true, deleted: data.length });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

app.use(express.static(path.join(__dirname, 'public')));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`http://localhost:${PORT}`));

module.exports = app;
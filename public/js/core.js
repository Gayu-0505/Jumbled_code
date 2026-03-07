// API-based leaderboard (all Supabase calls go through server)

const app = document.getElementById('app');

// State
let participant = null;
let startTime = null;
let unlockedBlocks = 0;
let currentQuestion = 0;
let currentBlock = 0;
let answers = [];
let codeBlocks = [];
let arrangedPrograms = 0;
let jumbledLines = [];
let gamePhase = 'entry'; // 'entry' | 'waiting' | 'questions' | 'unlocked' | 'arrange' | 'intermediate' | 'finished'

// ─── State Persistence ──────────────────────────────────
function saveState() {
  const state = {
    participant, startTime, unlockedBlocks, currentQuestion,
    currentBlock, answers, codeBlocks, arrangedPrograms,
    jumbledLines, gamePhase
  };
  try { localStorage.setItem('jc_state', JSON.stringify(state)); } catch(e) {}
}

function loadState() {
  try {
    const raw = localStorage.getItem('jc_state');
    if (!raw) return false;
    const s = JSON.parse(raw);
    participant = s.participant;
    startTime = s.startTime;
    unlockedBlocks = s.unlockedBlocks;
    currentQuestion = s.currentQuestion;
    currentBlock = s.currentBlock;
    answers = s.answers || [];
    codeBlocks = s.codeBlocks || [];
    arrangedPrograms = s.arrangedPrograms;
    jumbledLines = s.jumbledLines || [];
    gamePhase = s.gamePhase || 'entry';
    return true;
  } catch(e) { return false; }
}

function clearState() {
  try { localStorage.removeItem('jc_state'); } catch(e) {}
}

// 3 programs, each with 5 code blocks and Word Connect questions per block
const PROGRAMS_DATA = [
  {
    name: 'Palindrome Checker (Python)',
    correctOrder: [
      '# Program to check palindrome',
      'num = input("Enter a number: ")',
      'rev = num[::-1]',
      'if num == rev: print("It is a Palindrome")',
      'else: print("It is not a Palindrome")'
    ],
    questions: [
      [
        { q: 'Class + Object', a: ['object oriented programming', 'oop','oops'] },
        { q: 'Push + Pop', a: ['stack'] }
      ],
      [
        { q: 'Row + Column + Table', a: ['database', 'sql','structured query language'] },
        { q: 'HTML + CSS + JavaScript', a: ['web development', 'website building', 'website'] }
      ],
      [
        { q: 'Python + Java + C++', a: ['programming languages','programming language'] },
        { q: 'Google + Bing + Yahoo', a: ['search engine', 'search engines'] }
      ],
      [
        { q: 'Chrome + Firefox + Edge', a: ['web browser', 'browsers', 'browser'] },
        { q: 'Git + Commit + Push', a: ['version control'] }
      ],
      [
        { q: 'Code + Compile + Run', a: ['program execution', 'programming process'] }
      ]
    ]
  },
  {
    name: 'Factorial Calculator (C)',
    correctOrder: [
      '#include <stdio.h>',
      'int n, i, factorial = 1;',
      'printf("Enter a number: "); scanf("%d", &n);',
      'for(i = 1; i <= n; i++) { factorial = factorial * i; }',
      'printf("Factorial of %d is %d", n, factorial);'
    ],
    questions: [
      [
        { q: 'Router + Switch + Cable', a: ['computer network', 'networking','network'] },
        { q: 'Username + Password', a: ['authentication', 'login'] }
      ],
      [
        { q: 'CPU + RAM + Hard Disk', a: ['computer hardware', 'hardware'] },
        { q: 'Spam + Malware + Virus', a: ['cyber security threat','cyber security threat','cyber security','cyber attack','cyber attacks','cybersecurity threats','cybersecurity threat'] }
      ],
      [
        { q: 'Android + iOS', a: ['mobile operating system', 'mobile os','operating system','Mobile operating systems','operating systems'] },
        { q: 'Amazon + Flipkart + Meesho', a: ['e-commerce', 'ecommerce','e commerce','e-commerce website','Online shopping'] }
      ],
      [
        { q: 'Facebook + Instagram + Twitter', a: ['social media','Social media platforms',' social media sites'] }
      ],
      [
        { q: 'Loop + Condition', a: ['control structure','control statement','looping statement'] }
      ]
    ]
  },
  {
    name: 'Prime Number Checker (Java)',
    correctOrder: [
      'import java.util.Scanner;',
      'public class PrimeCheck {',
      'static boolean isPrime(int n) { if(n<=1) return false; for(int i=2; i<=Math.sqrt(n); i++) if(n%i==0) return false; return true; }',
      'Scanner sc = new Scanner(System.in); int num = sc.nextInt();',
      'System.out.println(num + (isPrime(num) ? " is Prime" : " is not Prime")); sc.close();'
    ],
    questions: [
      [
        { q: 'If + Else', a: ['conditional statement'] },
        { q: 'Laptop + Desktop', a: ['computer types','types of computers','Personal computers','computing devices','computer systems','computers','PC'] }
      ],
      [
        { q: 'Domain + Website', a: ['web hosting', 'deployment', 'deploying', 'deploy', 'hosting'] },
        { q: 'Data + Analysis', a: ['data analytics'] }
      ],
      [
        { q: 'Cloud + Storage', a: ['cloud computing'] },
        { q: 'Code + Developer', a: ['software development', 'software developer'] }
      ],
      [
        { q: 'Zoom + Google Meet', a: ['video conferencing', 'online class','online meet','online meeting'] }
      ],
      [
        { q: 'Map + Location', a: ['gps'] }
      ]
    ]
  }
];

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function fmtTime(secs) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return m + ':' + s;
}

// ─── Entry Form ─────────────────────────────────────────
let waitPollId = null;

function renderEntryForm() {
  app.innerHTML = `
    <div style="text-align:center;margin-bottom:24px">
      <img src="/logo.jpg" alt="Rabbit Coders" style="height:90px;border-radius:12px;margin-bottom:8px">
      <h2 style="font-size:1.5rem">Rabbit Coders</h2>
      <p>Choose how you'd like to enter</p>
    </div>
    <div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center">
      <button class="btn" id="btn-participant" style="flex:1;min-width:180px">🎮 Participant</button>
      <button class="btn btn-secondary" id="btn-admin" style="flex:1;min-width:180px">🔐 Admin</button>
    </div>
  `;
  document.getElementById('btn-participant').onclick = renderParticipantForm;
  document.getElementById('btn-admin').onclick = renderAdminLogin;
}

function renderAdminLogin() {
  app.innerHTML = `
    <div style="text-align:center;margin-bottom:24px">
      <img src="/logo.jpg" alt="Rabbit Coders" style="height:80px;border-radius:12px;margin-bottom:8px">
      <h2 style="font-size:1.5rem">Admin Login</h2>
    </div>
    <form id="admin-form">
      <label style="font-size:.8rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#a78bfa;display:block;margin-bottom:8px">Username</label>
      <input type="text" id="admin-user" placeholder="Admin username" required autocomplete="off" />
      <label style="font-size:.8rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#a78bfa;display:block;margin-bottom:8px;margin-top:12px">Password</label>
      <input type="text" id="admin-pass" placeholder="Password" required autocomplete="off" style="-webkit-text-security:disc" />
      <div id="admin-error"></div>
      <button class="btn" type="submit" style="width:100%">Login</button>
      <button class="btn btn-secondary" type="button" id="admin-back" style="width:100%">← Back</button>
    </form>
  `;
  document.getElementById('admin-back').onclick = renderEntryForm;
  document.getElementById('admin-form').onsubmit = async e => {
    e.preventDefault();
    const username = document.getElementById('admin-user').value.trim();
    const password = document.getElementById('admin-pass').value.trim();
    document.getElementById('admin-error').innerHTML = '';
    try {
      const res = await fetch('/api/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (data.ok) {
        sessionStorage.setItem('jc_admin', JSON.stringify({ username, password }));
        window.location.href = '/admin.html';
      } else {
        document.getElementById('admin-error').innerHTML = '<p class="error">Invalid username or password.</p>';
      }
    } catch (err) {
      document.getElementById('admin-error').innerHTML = '<p class="error">Connection error.</p>';
    }
  };
}

function renderParticipantForm() {
  app.innerHTML = `
    <div style="text-align:center;margin-bottom:24px">
      <img src="/logo.jpg" alt="Rabbit Coders" style="height:80px;border-radius:12px;margin-bottom:8px">
      <h2 style="font-size:1.5rem">Ready to Crack the Code?</h2>
      <p>Solve <b style="color:#7c3aed">Word Connect</b> puzzles to unlock code blocks. Unlock 5 blocks, arrange the jumbled code. Complete <b style="color:#7c3aed">3 programs</b> to hit the leaderboard!</p>
    </div>
    <form id="entry-form">
      <label style="font-size:.8rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#a78bfa;display:block;margin-bottom:8px">Team Name</label>
      <input type="text" id="name" placeholder="e.g. Code Breakers" required autocomplete="off" />
      <label style="font-size:.8rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#a78bfa;display:block;margin-bottom:8px;margin-top:12px">Department</label>
      <input type="text" id="dept" placeholder="e.g. Computer Science" required autocomplete="off" />
      <label style="font-size:.8rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#a78bfa;display:block;margin-bottom:8px;margin-top:12px">College Name</label>
      <input type="text" id="college" placeholder="e.g. ABC Engineering College" required autocomplete="off" />
      <div id="entry-error"></div>
      <button class="btn" type="submit" style="width:100%">🚀 Join Challenge</button>
      <button class="btn btn-secondary" type="button" id="entry-back" style="width:100%">← Back</button>
    </form>
  `;
  document.getElementById('entry-back').onclick = renderEntryForm;
  document.getElementById('entry-form').onsubmit = async e => {
    e.preventDefault();
    const name = document.getElementById('name').value.trim();
    const dept = document.getElementById('dept').value.trim();
    const college = document.getElementById('college').value.trim();
    if (!name || !dept || !college) return;
    participant = { name, dept, college };
    startTime = Date.now();
    arrangedPrograms = 0;
    gamePhase = 'waiting';
    saveState();
    renderWaitingRoom();
  };
}

function renderWaitingRoom() {
  if (waitPollId) clearInterval(waitPollId);
  app.innerHTML = `
    <div style="text-align:center">
      <span style="font-size:3rem;display:block;margin-bottom:8px;animation:bounce 1s ease infinite">⏳</span>
      <h2 style="font-size:1.5rem">Waiting for Admin to Start</h2>
      <p>Welcome, <b style="color:var(--purple)">${esc(participant.name)}</b>!</p>
      <p style="color:var(--text-muted);font-size:.85rem">${esc(participant.dept)} · ${esc(participant.college)}</p>
      <div class="progress-bar" style="margin:24px 0"><div class="progress-fill" style="width:100%;animation:pulse 2s ease-in-out infinite"></div></div>
      <p style="color:var(--text-muted);font-size:.85rem">The game will begin once the admin starts it. Hang tight!</p>
      <div id="wait-status" style="margin-top:12px"></div>
    </div>
  `;
  checkGameStatus();
  waitPollId = setInterval(checkGameStatus, 2000);
}

async function checkGameStatus() {
  try {
    const res = await fetch('/api/game-status');
    const data = await res.json();
    if (data.started) {
      if (waitPollId) { clearInterval(waitPollId); waitPollId = null; }
      startProgram();
    }
  } catch (e) {
    const el = document.getElementById('wait-status');
    if (el) el.innerHTML = '<p class="error" style="font-size:.8rem">Connection error — retrying...</p>';
  }
}

// ─── Start a program round ──────────────────────────────
function startProgram() {
  currentBlock = 0;
  unlockedBlocks = 0;
  codeBlocks = [];
  renderQuestions();
}

// ─── Questions ──────────────────────────────────────────
function renderQuestions() {
  currentQuestion = 0;
  answers = [];
  gamePhase = 'questions';
  saveState();
  const prog = PROGRAMS_DATA[arrangedPrograms];
  app.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
      <h2 style="margin-bottom:0">${esc(prog.name)}</h2>
      <span class="badge badge-purple">Block ${currentBlock + 1} of 5</span>
    </div>
    <div class="progress-bar"><div class="progress-fill" style="width:${(unlockedBlocks/5)*100}%"></div></div>
    <div style="display:flex;gap:6px;flex-wrap:wrap">
      <span class="badge">📦 Program ${arrangedPrograms+1}/3</span>
      <span class="badge badge-green">🔓 Blocks ${unlockedBlocks}/5</span>
    </div>
    <div id="question-area"></div>
    <div id="q-feedback"></div>
  `;
  renderQuestion();
}

function renderQuestion() {
  const prog = PROGRAMS_DATA[arrangedPrograms];
  const blockQs = prog.questions[currentBlock];
  const q = blockQs[currentQuestion];
  const words = q.q.split(' + ').map(w => w.trim());
  document.getElementById('question-area').innerHTML = `
    <div class="question-card">
      <div class="q-label">Word Connect ${currentQuestion + 1} of ${blockQs.length}</div>
      <div class="q-text" style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-bottom:18px">
        ${words.map(w => `<span style="background:linear-gradient(135deg,#ede9fe,#fce7f3);padding:8px 18px;border-radius:12px;font-weight:800;border:2px solid #d8b4fe">${esc(w)}</span>`).join('<span style="font-size:1.3rem;color:#a78bfa;font-weight:800">+</span>')}
      </div>
      <p style="font-size:.85rem;color:#a78bfa;margin-bottom:12px">What do these words connect to?</p>
      <input type="text" id="answer" placeholder="Type your answer..." autofocus autocomplete="off" />
      <button class="btn" id="submit-btn" style="width:100%">Submit Answer</button>
    </div>
  `;
  document.getElementById('q-feedback').innerHTML = '';
  document.getElementById('submit-btn').onclick = submitAnswer;
  document.getElementById('answer').onkeydown = e => { if (e.key === 'Enter') submitAnswer(); };
}

function submitAnswer() {
  const prog = PROGRAMS_DATA[arrangedPrograms];
  const blockQs = prog.questions[currentBlock];
  const q = blockQs[currentQuestion];
  const val = document.getElementById('answer').value.trim();
  if (!val) { document.getElementById('q-feedback').innerHTML = '<p class="error">Please enter an answer.</p>'; return; }
  const isCorrect = q.a.some(ans => val.toLowerCase() === ans.toLowerCase());
  if (isCorrect) {
    answers.push(val);
    currentQuestion++;
    if (currentQuestion < blockQs.length) {
      document.getElementById('q-feedback').innerHTML = '<p class="success">Correct! 🎉</p>';
      setTimeout(renderQuestion, 500);
    } else {
      unlockBlock();
    }
  } else {
    document.getElementById('q-feedback').innerHTML = '<p class="error">Incorrect! Try again.</p>';
  }
}

// ─── Unlock Block ───────────────────────────────────────
function unlockBlock() {
  const prog = PROGRAMS_DATA[arrangedPrograms];
  codeBlocks.push(prog.correctOrder[currentBlock]);
  unlockedBlocks++;
  currentBlock++;
  if (unlockedBlocks < 5) {
    gamePhase = 'unlocked';
    saveState();
    renderUnlockedBlocks();
  } else {
    renderArrange();
  }
}

function renderUnlockedBlocks() {
  const prog = PROGRAMS_DATA[arrangedPrograms];
  app.innerHTML = `
    <div style="text-align:center;margin-bottom:16px">
      <span style="font-size:2.5rem;display:block">🔓</span>
      <h2>${esc(prog.name)} — Block Unlocked!</h2>
    </div>
    <div class="progress-bar"><div class="progress-fill" style="width:${(unlockedBlocks/5)*100}%"></div></div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">
      <span class="badge badge-green">🔓 Blocks ${unlockedBlocks}/5</span>
    </div>
    <p class="success" style="font-weight:600">✓ You unlocked a new code block!</p>
    <div class="section-label">Unlocked Code Blocks</div>
    ${codeBlocks.map((c, i) => `<div class="code-block" style="cursor:default;border-left-color:var(--green)"><span style="color:var(--green);font-weight:700;margin-right:8px">${i+1}.</span>${esc(c)}</div>`).join('')}
    <button class="btn" id="next-btn" style="width:100%">Next Word Connect →</button>
  `;
  document.getElementById('next-btn').onclick = renderQuestions;
}

// ─── Arrange ────────────────────────────────────────────
function renderArrange() {
  const prog = PROGRAMS_DATA[arrangedPrograms];
  if (gamePhase !== 'arrange' || jumbledLines.length === 0) {
    jumbledLines = [...prog.correctOrder].sort(() => Math.random() - 0.5);
    if (jumbledLines.every((l, i) => l === prog.correctOrder[i])) {
      jumbledLines.reverse();
    }
  }
  gamePhase = 'arrange';
  saveState();
  let selected = [];
  app.innerHTML = `
    <div style="text-align:center;margin-bottom:16px">
      <span style="font-size:2.5rem;display:block">🧩</span>
      <h2>${esc(prog.name)} — Arrange the Code</h2>
      <p>Click the blocks in the correct order (top to bottom)</p>
    </div>
    <div class="section-label">Jumbled Blocks</div>
    <div id="arrange-area"></div>
    <div class="section-label">Your Arrangement</div>
    <div class="arrange-drop" id="arrange-selected"></div>
    <div style="display:flex;gap:8px">
      <button class="btn btn-success" id="submit-arrange" style="flex:1" disabled>✓ Submit</button>
      <button class="btn btn-secondary" id="reset-arrange" style="flex:1">↺ Reset</button>
    </div>
    <div id="arrange-feedback"></div>
  `;
  const area = document.getElementById('arrange-area');
  jumbledLines.forEach((line, idx) => {
    const btn = document.createElement('div');
    btn.className = 'code-block';
    btn.textContent = line;
    btn.id = 'jb-' + idx;
    btn.onclick = () => {
      if (selected.includes(idx)) return;
      selected.push(idx);
      btn.classList.add('selected');
      updateSelected(selected);
      if (selected.length === 5) document.getElementById('submit-arrange').disabled = false;
    };
    area.appendChild(btn);
  });
  document.getElementById('reset-arrange').onclick = () => {
    selected = [];
    updateSelected(selected);
    document.getElementById('submit-arrange').disabled = true;
    jumbledLines.forEach((_, idx) => {
      document.getElementById('jb-' + idx).classList.remove('selected');
    });
    document.getElementById('arrange-feedback').innerHTML = '';
  };
  document.getElementById('submit-arrange').onclick = () => {
    const userOrder = selected.map(i => jumbledLines[i]);
    const correct = userOrder.every((line, i) => line === prog.correctOrder[i]);
    if (correct) {
      arrangedPrograms++;
      saveState();
      if (arrangedPrograms < 3) {
        showIntermediateResult();
      } else {
        finishChallenge();
      }
    } else {
      document.getElementById('arrange-feedback').innerHTML = '<p class="error">❌ Incorrect order! Click Reset and try again.</p>';
    }
  };
}

function updateSelected(selected) {
  document.getElementById('arrange-selected').innerHTML = selected.length === 0
    ? '<p style="color:#a78bfa;text-align:center;margin:16px 0;font-size:.9rem">Click blocks above in order...</p>'
    : selected.map((i, pos) => `<div class="code-block" style="border-left-color:var(--green);cursor:default"><span style="color:var(--green);font-weight:700;margin-right:8px">${pos+1}.</span>${esc(jumbledLines[i])}</div>`).join('');
}

// ─── Intermediate Result (after each program) ──────────
async function showIntermediateResult() {
  gamePhase = 'intermediate';
  saveState();
  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  app.innerHTML = `
    <div class="celebrate">
      <span class="big-icon">🎉</span>
      <h2 style="color:var(--green)">Program Arranged Correctly!</h2>
      <p>Great job, <b style="color:var(--purple)">${esc(participant.name)}</b>! <b style="color:var(--purple)">${3 - arrangedPrograms}</b> program(s) remaining.</p>
      <p>Your time so far: <span class="timer" style="font-size:1.4rem">${fmtTime(elapsed)}</span></p>
    </div>
    <div id="lb-area"></div>
  `;
  await renderLeaderboard('next');
}

// ─── Finish & Leaderboard ───────────────────────────────
async function finishChallenge() {
  gamePhase = 'finished';
  clearState();
  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  app.innerHTML = `
    <div class="celebrate">
      <span class="big-icon">🏆</span>
      <h2 style="color:var(--orange);font-size:1.6rem">Challenge Complete!</h2>
      <p>Congratulations, <b style="color:var(--purple)">${esc(participant.name)}</b>! You arranged all 3 programs.</p>
      <p>Your time: <span class="timer" style="font-size:1.4rem">${fmtTime(elapsed)}</span></p>
      <p style="font-size:.85rem">Saving to leaderboard...</p>
    </div>
    <div id="lb-area"></div>
  `;
  try {
    await fetch('/api/leaderboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: participant.name, programs_completed: 3, time_seconds: elapsed })
    });
  } catch (e) {
    console.error('Leaderboard save error:', e);
  }
  await renderLeaderboard('restart');
}

async function renderLeaderboard(mode) {
  const lbArea = document.getElementById('lb-area');
  lbArea.innerHTML = '<p style="text-align:center">Loading leaderboard...</p>';
  const btnHtml = mode === 'next'
    ? '<button class="btn" id="next-prog" style="width:100%;margin-top:16px">Next Program →</button>'
    : '<button class="btn" id="restart-btn" style="width:100%;margin-top:16px">🔄 Play Again</button>';
  const attachBtn = () => {
    if (mode === 'next') { document.getElementById('next-prog').onclick = startProgram; }
    else { document.getElementById('restart-btn').onclick = () => { clearState(); renderEntryForm(); }; }
  };
  try {
    const res = await fetch('/api/leaderboard?limit=20');
    const result = await res.json();
    if (!result.ok) throw new Error(result.error || 'Server error');
    const data = result.data;
    if (!data || data.length === 0) {
      lbArea.innerHTML = '<p style="text-align:center">No entries yet. You are the first! 🎉</p>';
    } else {
      lbArea.innerHTML = `
        <div class="section-label" style="margin-top:28px">Leaderboard — Top 20</div>
        <table class="leaderboard-table">
          <thead><tr><th>#</th><th>Name</th><th>Time</th></tr></thead>
          <tbody>
            ${data.map((row, i) => `<tr>
              <td class="${i < 3 ? 'rank-' + (i+1) : ''}">${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}</td>
              <td>${esc(row.name)}</td>
              <td class="timer">${fmtTime(row.time_seconds)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      `;
    }
  } catch (e) {
    console.error(e);
    lbArea.innerHTML = '<p class="error">Could not load leaderboard.</p>';
  }
  lbArea.innerHTML += btnHtml;
  attachBtn();
}

// ─── Start ──────────────────────────────────────────────
function resumeGame() {
  if (!loadState() || !participant || gamePhase === 'entry') {
    renderEntryForm();
    return;
  }
  switch (gamePhase) {
    case 'waiting':     renderWaitingRoom(); break;
    case 'questions':   renderQuestions(); break;
    case 'unlocked':    renderUnlockedBlocks(); break;
    case 'arrange':     renderArrange(); break;
    case 'intermediate': showIntermediateResult(); break;
    default:            renderEntryForm();
  }
}
resumeGame();
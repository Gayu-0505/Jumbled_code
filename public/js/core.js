// Supabase config
const SUPABASE_URL = 'https://qmwkfermfdswpivjzdad.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFtd2tmZXJtZmRzd3Bpdmp6ZGFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4MDM5NDUsImV4cCI6MjA4ODM3OTk0NX0.dPBrztJy6HKVZBJOZEslvijFlvbx9PTuFUdOiuwDlN4';
let sb = null;
try {
  if (window.supabase && window.supabase.createClient) {
    sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
} catch (e) { console.warn('Supabase init failed:', e); }

const app = document.getElementById('app');
const timerEl = document.getElementById('live-timer');
let timerInterval = null;

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

// 3 programs, each with 5 code blocks and 3 questions per block
const PROGRAMS_DATA = [
  {
    name: 'Hello World Program',
    correctOrder: [
      '# Program 1: Hello World',
      'def greet(name):',
      '    message = "Hello, " + name',
      '    print(message)',
      'greet("World")'
    ],
    questions: [
      [
        { q: 'What is 2 + 2?', a: '4' },
        { q: 'What keyword defines a function in Python?', a: 'def' },
        { q: 'What built-in function displays output in Python?', a: 'print' }
      ],
      [
        { q: 'What is 5 * 3?', a: '15' },
        { q: 'What symbol starts a comment in Python?', a: '#' },
        { q: 'What data type is "hello"?', a: 'string' }
      ],
      [
        { q: 'What is 10 - 4?', a: '6' },
        { q: 'What operator joins strings together?', a: '+' },
        { q: 'What is the capital of France?', a: 'Paris' }
      ],
      [
        { q: 'What is 9 / 3?', a: '3' },
        { q: 'What are the () after a function name called?', a: 'parentheses' },
        { q: 'True or False: Python is case-sensitive?', a: 'true' }
      ],
      [
        { q: 'What is 7 + 8?', a: '15' },
        { q: 'What does "def" stand for?', a: 'define' },
        { q: 'What color is the sky?', a: 'blue' }
      ]
    ]
  },
  {
    name: 'Counter Program',
    correctOrder: [
      '# Program 2: Counter',
      'count = 0',
      'for i in range(5):',
      '    count += 1',
      'print("Total:", count)'
    ],
    questions: [
      [
        { q: 'What is 3 + 3?', a: '6' },
        { q: 'What loop keyword iterates over a sequence?', a: 'for' },
        { q: 'What does += do?', a: 'add and assign' }
      ],
      [
        { q: 'What is 4 * 4?', a: '16' },
        { q: 'What function generates numbers 0 to n-1?', a: 'range' },
        { q: 'What is 100 / 10?', a: '10' }
      ],
      [
        { q: 'What is 20 - 7?', a: '13' },
        { q: 'What value does count start at?', a: '0' },
        { q: 'What planet do we live on?', a: 'earth' }
      ],
      [
        { q: 'What is 6 * 2?', a: '12' },
        { q: 'How many times does range(5) loop?', a: '5' },
        { q: 'What is H2O commonly called?', a: 'water' }
      ],
      [
        { q: 'What is 8 - 3?', a: '5' },
        { q: 'What keyword starts a for loop in Python?', a: 'for' },
        { q: 'What is the capital of Japan?', a: 'tokyo' }
      ]
    ]
  },
  {
    name: 'Calculator Program',
    correctOrder: [
      '# Program 3: Calculator',
      'def add(a, b):',
      '    return a + b',
      'result = add(3, 4)',
      'print("Sum:", result)'
    ],
    questions: [
      [
        { q: 'What is 1 + 1?', a: '2' },
        { q: 'What keyword sends a value back from a function?', a: 'return' },
        { q: 'What is 3 + 4?', a: '7' }
      ],
      [
        { q: 'What is 5 + 5?', a: '10' },
        { q: 'What are a and b in def add(a, b) called?', a: 'parameters' },
        { q: 'What is the color of grass?', a: 'green' }
      ],
      [
        { q: 'What is 12 / 4?', a: '3' },
        { q: 'What does the + operator do with numbers?', a: 'add' },
        { q: 'What is the largest ocean?', a: 'pacific' }
      ],
      [
        { q: 'What is 11 - 5?', a: '6' },
        { q: 'What stores the output of add(3,4)?', a: 'result' },
        { q: 'What color is snow?', a: 'white' }
      ],
      [
        { q: 'What is 2 * 9?', a: '18' },
        { q: 'Is Python interpreted or compiled?', a: 'interpreted' },
        { q: 'What is the capital of Germany?', a: 'berlin' }
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

function startLiveTimer() {
  timerEl.style.display = 'block';
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    if (startTime) timerEl.textContent = fmtTime(Math.floor((Date.now() - startTime) / 1000));
  }, 500);
}

function stopLiveTimer() {
  clearInterval(timerInterval);
}

// ─── Entry Form ─────────────────────────────────────────
function renderEntryForm() {
  timerEl.style.display = 'none';
  stopLiveTimer();
  app.innerHTML = `
    <div style="text-align:center;margin-bottom:24px">
      <span style="font-size:3rem;display:block;margin-bottom:8px">🧩</span>
      <h2 style="font-size:1.5rem">Ready to Crack the Code?</h2>
      <p>Answer questions to unlock code blocks. Unlock 5 blocks, arrange the jumbled code. Complete <b style="color:#e2e8f0">3 programs</b> to hit the leaderboard!</p>
    </div>
    <form id="entry-form">
      <label style="font-size:.8rem;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:#94a3b8;display:block;margin-bottom:8px">Your Name</label>
      <input type="text" id="name" placeholder="e.g. Alex" required autocomplete="off" />
      <button class="btn" type="submit" style="width:100%">🚀 Start Challenge</button>
    </form>
  `;
  document.getElementById('entry-form').onsubmit = e => {
    e.preventDefault();
    const name = document.getElementById('name').value.trim();
    if (!name) return;
    participant = { name };
    startTime = Date.now();
    arrangedPrograms = 0;
    startLiveTimer();
    startProgram();
  };
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
  const q = prog.questions[currentBlock][currentQuestion];
  document.getElementById('question-area').innerHTML = `
    <div class="question-card">
      <div class="q-label">Question ${currentQuestion + 1} of 3</div>
      <div class="q-text">${esc(q.q)}</div>
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
  const q = prog.questions[currentBlock][currentQuestion];
  const val = document.getElementById('answer').value.trim();
  if (!val) { document.getElementById('q-feedback').innerHTML = '<p class="error">Please enter an answer.</p>'; return; }
  if (val.toLowerCase() === q.a.toLowerCase()) {
    answers.push(val);
    currentQuestion++;
    if (currentQuestion < 3) {
      document.getElementById('q-feedback').innerHTML = '<p class="success">Correct!</p>';
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
    ${codeBlocks.map((c, i) => `<div class="code-block" style="cursor:default;border-left-color:var(--emerald)"><span style="color:var(--emerald);font-weight:700;margin-right:8px">${i+1}.</span>${esc(c)}</div>`).join('')}
    <button class="btn" id="next-btn" style="width:100%">Answer Next 3 Questions →</button>
  `;
  document.getElementById('next-btn').onclick = renderQuestions;
}

// ─── Arrange ────────────────────────────────────────────
function renderArrange() {
  const prog = PROGRAMS_DATA[arrangedPrograms];
  jumbledLines = [...prog.correctOrder].sort(() => Math.random() - 0.5);
  if (jumbledLines.every((l, i) => l === prog.correctOrder[i])) {
    jumbledLines.reverse();
  }
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
      if (arrangedPrograms < 3) {
        app.innerHTML = `
          <div class="celebrate">
            <span class="big-icon">🎉</span>
            <h2 style="color:var(--emerald)">Program Arranged Correctly!</h2>
            <p>Great job! <b style="color:#e2e8f0">${3 - arrangedPrograms}</b> program(s) remaining.</p>
            <button class="btn" id="next-prog" style="width:100%">Next Program →</button>
          </div>
        `;
        document.getElementById('next-prog').onclick = startProgram;
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
    ? '<p style="color:var(--slate-500);text-align:center;margin:16px 0;font-size:.9rem">Click blocks above in order...</p>'
    : selected.map((i, pos) => `<div class="code-block" style="border-left-color:var(--emerald);cursor:default"><span style="color:var(--emerald);font-weight:700;margin-right:8px">${pos+1}.</span>${esc(jumbledLines[i])}</div>`).join('');
}

// ─── Finish & Leaderboard ───────────────────────────────
async function finishChallenge() {
  stopLiveTimer();
  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  app.innerHTML = `
    <div class="celebrate">
      <span class="big-icon">🏆</span>
      <h2 style="color:var(--amber);font-size:1.6rem">Challenge Complete!</h2>
      <p>Congratulations, <b style="color:#e2e8f0">${esc(participant.name)}</b>! You arranged all 3 programs.</p>
      <p>Your time: <span class="timer" style="font-size:1.4rem">${fmtTime(elapsed)}</span></p>
      <p style="font-size:.85rem">Saving to leaderboard...</p>
    </div>
    <div id="lb-area"></div>
  `;
  try {
    if (sb) await sb.from('leaderboard').insert([{
      name: participant.name,
      programs_completed: 3,
      time_seconds: elapsed
    }]);
  } catch (e) {
    console.error('Leaderboard save error:', e);
  }
  await renderLeaderboard(elapsed);
}

async function renderLeaderboard(myTime) {
  const lbArea = document.getElementById('lb-area');
  lbArea.innerHTML = '<p style="text-align:center">Loading leaderboard...</p>';
  try {
    if (!sb) { lbArea.innerHTML = '<p style="text-align:center;color:var(--slate-500)">Leaderboard unavailable (no database connection).</p>'; lbArea.innerHTML += '<button class="btn" id="restart-btn" style="width:100%;margin-top:16px">🔄 Play Again</button>'; document.getElementById('restart-btn').onclick = renderEntryForm; return; }
    const { data, error } = await sb
      .from('leaderboard')
      .select('*')
      .eq('programs_completed', 3)
      .order('time_seconds', { ascending: true })
      .limit(20);
    if (error) throw error;
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
  lbArea.innerHTML += '<button class="btn" id="restart-btn" style="width:100%;margin-top:16px">🔄 Play Again</button>';
  document.getElementById('restart-btn').onclick = renderEntryForm;
}

// ─── Start ──────────────────────────────────────────────
renderEntryForm();
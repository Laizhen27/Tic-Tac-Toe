// ===========================
// CONSTANTS & STATE
// ===========================
const WIN_LINES = [
  [0,1,2],[3,4,5],[6,7,8],
  [0,3,6],[1,4,7],[2,5,8],
  [0,4,8],[2,4,6]
];

const DOUBLE_WIN_MESSAGES = [
  "Two ways at once?! Absolute legend. 🔥",
  "You set a trap and they walked right in. Mastermind! 🧠",
  "Double threat! Chess-level thinking on a tic-tac-toe board.",
  "They never saw it coming. Neither did we. Brilliant. ✨",
  "Fork achieved! You forced an impossible choice. Genius play.",
  "Two wins, one move. You're playing 4D tic-tac-toe. 🚀",
  "The board had no escape. You owned every corner. 💎"
];

// Persistent scores per difficulty (1P) — stored in localStorage
const STORAGE_KEY = 'ttt_scores_v2';
const SAVE_KEY    = 'ttt_save_v2';

let diffScores = loadDiffScores();   // { easy:{X,O,draw}, medium:{…}, hard:{…} }
let savedGame  = loadSavedGame();    // { difficulty, board, currentPlayer, scores, botMoveCount } | null

let mode = '1p';
let difficulty = null;
let board = Array(9).fill(null);
let currentPlayer = 'X';
let gameActive = false;
let scores = { X: 0, O: 0, draw: 0 };
let botMoveCount = 0;
let p1Name = 'Player X';
let p2Name = 'Player O';

// ===========================
// STORAGE
// ===========================
function loadDiffScores() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch(e) {}
  return {
    easy:   { X: 0, O: 0, draw: 0 },
    medium: { X: 0, O: 0, draw: 0 },
    hard:   { X: 0, O: 0, draw: 0 }
  };
}

function saveDiffScores() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(diffScores));
}

function loadSavedGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) return JSON.parse(raw);
  } catch(e) {}
  return null;
}

function persistCurrentGame() {
  if (mode !== '1p') return;
  const save = { difficulty, board: [...board], currentPlayer, scores: {...scores}, botMoveCount };
  localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  savedGame = save;
}

function clearSavedGame() {
  localStorage.removeItem(SAVE_KEY);
  savedGame = null;
}

// ===========================
// SCREEN NAVIGATION
// ===========================
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ===========================
// MENU CLICKS
// ===========================
function clickOnePlayer() {
  mode = '1p';
  refreshDiffPoints();
  difficulty = null;
  document.querySelectorAll('.diff-card').forEach(c => c.classList.remove('selected'));
  document.getElementById('start-btn').disabled = true;

  // If there's a saved game, ask Continue or New
  if (savedGame) {
    showPrompt(
      '🎮 Continue?',
      `You have a saved ${savedGame.difficulty} game in progress. Continue where you left off or start fresh?`,
      [
        { label: 'Continue Game', cls: 'btn-primary', fn: () => { closePrompt(); resumeSavedGame(); } },
        { label: 'New Game', cls: 'btn-ghost', fn: () => {
          closePrompt();
          showPrompt(
            '⚠️ Delete saved game?',
            'This will permanently delete your saved game. Are you sure?',
            [
              { label: 'Yes, delete', cls: 'btn-danger', fn: () => { clearSavedGame(); closePrompt(); showScreen('screen-diff'); } },
              { label: 'Cancel', cls: 'btn-ghost', fn: () => { closePrompt(); showScreen('screen-diff'); } }
            ]
          );
        }}
      ]
    );
  } else {
    showScreen('screen-diff');
  }
}

function clickTwoPlayer() {
  mode = '2p';
  document.getElementById('name-p1').value = '';
  document.getElementById('name-p2').value = '';
  showScreen('screen-names');
}

function startTwoPlayer() {
  p1Name = document.getElementById('name-p1').value.trim() || 'Player X';
  p2Name = document.getElementById('name-p2').value.trim() || 'Player O';
  scores = { X: 0, O: 0, draw: 0 };
  initGame();
  showScreen('screen-game');
}

// ===========================
// DIFFICULTY SCREEN
// ===========================
function refreshDiffPoints() {
  ['easy','medium','hard'].forEach(d => {
    const s = diffScores[d];
    document.getElementById('pts-' + d).textContent = `You: ${s.X} pts · Bot: ${s.O} pts`;
  });
}

function selectDiff(d) {
  difficulty = d;
  document.querySelectorAll('.diff-card').forEach(c => c.classList.remove('selected'));
  document.getElementById('d-' + d).classList.add('selected');
  document.getElementById('start-btn').disabled = false;
}

function startOnePlayer() {
  if (!difficulty) return;
  scores = { ...diffScores[difficulty] };
  initGame();
  showScreen('screen-game');
}

function resumeSavedGame() {
  difficulty  = savedGame.difficulty;
  board       = [...savedGame.board];
  currentPlayer = savedGame.currentPlayer;
  scores      = { ...savedGame.scores };
  botMoveCount = savedGame.botMoveCount;
  gameActive  = true;
  mode        = '1p';

  setupGameUI();
  showScreen('screen-game');
  renderBoard();
  const turnLabel = currentPlayer === 'O' ? "Bot's turn" : `${currentPlayer}'s turn`;
  setStatus(turnLabel);
  setActiveTurn(currentPlayer);
  if (currentPlayer === 'O') { botMoveCount++; scheduleBotMove(); }
}

// ===========================
// GAME INIT
// ===========================
function initGame() {
  board = Array(9).fill(null);
  currentPlayer = 'X';
  gameActive = true;
  botMoveCount = 0;
  setupGameUI();
  renderBoard();
  setStatus("X's turn");
  setActiveTurn('X');
  if (mode === '1p') persistCurrentGame();
}

function setupGameUI() {
  if (mode === '1p') {
    document.getElementById('label-o').textContent = 'Bot';
    document.getElementById('name-x-display').textContent = 'You';
    document.getElementById('name-o-display').textContent = '🤖';
    document.getElementById('btn-change-diff').style.display = 'inline-block';
  } else {
    document.getElementById('label-o').textContent = p2Name;
    document.getElementById('name-x-display').textContent = p1Name;
    document.getElementById('name-o-display').textContent = p2Name;
    document.getElementById('btn-change-diff').style.display = 'none';
  }
  updateScoreDisplay();
  closeResult();
  stopConfetti();
}

function resetRound() {
  board = Array(9).fill(null);
  currentPlayer = 'X';
  gameActive = true;
  botMoveCount = 0;
  renderBoard();
  setStatus("X's turn");
  setActiveTurn('X');
  document.getElementById('status').className = 'status-bar';
  if (mode === '1p') persistCurrentGame();
  stopConfetti();
}

// ===========================
// MENU / DIFF CHANGE FROM GAME
// ===========================
function clickMenu() {
  if (mode === '1p' && gameActive) {
    persistCurrentGame();
    showPrompt(
      '💾 Save progress?',
      'Your current game will be saved so you can continue later.',
      [
        { label: 'Save & Exit', cls: 'btn-primary', fn: () => { closePrompt(); closeResult(); showScreen('screen-menu'); } },
        { label: "Don't Save", cls: 'btn-ghost', fn: () => { clearSavedGame(); closePrompt(); closeResult(); showScreen('screen-menu'); } }
      ]
    );
  } else {
    closeResult();
    showScreen('screen-menu');
  }
}

function clickChangeDiff() {
  if (gameActive) {
    persistCurrentGame();
    showPrompt(
      '🎯 Change Difficulty?',
      'Your current game will be saved. Pick a different difficulty on the next screen.',
      [
        { label: 'OK', cls: 'btn-primary', fn: () => {
          closePrompt();
          difficulty = null;
          document.querySelectorAll('.diff-card').forEach(c => c.classList.remove('selected'));
          document.getElementById('start-btn').disabled = true;
          refreshDiffPoints();
          showScreen('screen-diff');
        }},
        { label: 'Cancel', cls: 'btn-ghost', fn: () => closePrompt() }
      ]
    );
  } else {
    refreshDiffPoints();
    showScreen('screen-diff');
  }
}

// ===========================
// BOARD RENDER
// ===========================
function renderBoard(winCells = [], doubleWinCells = []) {
  const boardEl = document.getElementById('board');
  boardEl.innerHTML = '';
  board.forEach((val, i) => {
    const cell = document.createElement('div');
    let cls = 'cell';
    if (val) cls += ' taken ' + (val === 'X' ? 'x-mark' : 'o-mark');
    if (doubleWinCells.includes(i)) cls += ' double-win-cell';
    else if (winCells.includes(i)) cls += ' win-cell';
    cell.className = cls;
    cell.textContent = val || '';
    cell.onclick = () => handleClick(i);
    boardEl.appendChild(cell);
  });
}

function setStatus(msg, cls = '') {
  const s = document.getElementById('status');
  s.textContent = msg;
  s.className = 'status-bar ' + cls;
}

function setActiveTurn(player) {
  document.getElementById('score-x').classList.toggle('active-turn', player === 'X');
  document.getElementById('score-o').classList.toggle('active-turn', player === 'O');
}

function updateScoreDisplay() {
  document.getElementById('val-x').textContent = scores.X;
  document.getElementById('val-o').textContent = scores.O;
  document.getElementById('val-draw').textContent = scores.draw;
}

// ===========================
// CLICK & MOVE
// ===========================
function handleClick(i) {
  if (!gameActive) return;
  if (board[i]) return;
  if (mode === '1p' && currentPlayer === 'O') return;
  makeMove(i, currentPlayer);
}

function makeMove(index, player) {
  board[index] = player;
  renderBoard();
  if (mode === '1p') persistCurrentGame();

  const result = checkResult();
  if (result) { handleResult(result); return; }

  currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
  const turnLabel = mode === '1p' && currentPlayer === 'O' ? "Bot's turn" : `${currentPlayer}'s turn`;
  setStatus(turnLabel);
  setActiveTurn(currentPlayer);

  if (mode === '1p' && currentPlayer === 'O') {
    botMoveCount++;
    scheduleBotMove();
  }
}

// ===========================
// RESULT
// ===========================
function checkResult() {
  const winnerLines = {};
  for (const line of WIN_LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      const p = board[a];
      if (!winnerLines[p]) winnerLines[p] = [];
      winnerLines[p].push(line);
    }
  }
  for (const player of ['X', 'O']) {
    if (winnerLines[player]) return { winner: player, lines: winnerLines[player] };
  }
  if (board.every(c => c !== null)) return { winner: null, lines: [] };
  return null;
}

function handleResult(result) {
  gameActive = false;

  if (result.winner) {
    const allWinCells = [...new Set(result.lines.flat())];
    const isDouble = result.lines.length >= 2;
    const pointsGained = isDouble ? 3 : 1;

    scores[result.winner] += pointsGained;

    // Sync back to per-difficulty store
    if (mode === '1p') {
      diffScores[difficulty][result.winner] += pointsGained;
      saveDiffScores();
      clearSavedGame();
    }

    updateScoreDisplay();
    if (isDouble) renderBoard([], allWinCells);
    else renderBoard(allWinCells, []);

    const isBot = mode === '1p' && result.winner === 'O';
    const winnerName = isBot ? 'Bot' : (mode === '1p' ? 'You' : (result.winner === 'X' ? p1Name : p2Name));

    if (isDouble) setStatus(`${winnerName} — DOUBLE WIN! +3 pts 🏆`, 'double-win');
    else setStatus(`${winnerName} wins! +${pointsGained} pt 🎉`, 'win');

    setTimeout(() => {
      const badge = document.getElementById('ov-badge');
      const box = document.getElementById('overlay-box');
      if (isDouble) {
        badge.textContent = '⚡ Double Win — +3 points!';
        badge.classList.add('show');
        box.classList.add('double-win-box');
        document.getElementById('ov-icon').textContent = '🏆';
        document.getElementById('ov-title').textContent = `${winnerName} — Absolute Beast!`;
        document.getElementById('ov-sub').textContent = DOUBLE_WIN_MESSAGES[Math.floor(Math.random() * DOUBLE_WIN_MESSAGES.length)];
        launchConfetti();
      } else {
        badge.classList.remove('show');
        box.classList.remove('double-win-box');
        document.getElementById('ov-icon').textContent = isBot ? '🤖' : (result.winner === 'X' ? '🥳' : '🎉');
        document.getElementById('ov-title').textContent = `${winnerName} Wins!`;
        document.getElementById('ov-sub').textContent = getWinMessage(result.winner);
      }
      document.getElementById('overlay-result').classList.add('show');
    }, 700);

  } else {
    scores.draw++;
    if (mode === '1p') {
      diffScores[difficulty].draw++;
      saveDiffScores();
      clearSavedGame();
    }
    updateScoreDisplay();
    setStatus("It's a draw!", 'draw');
    setTimeout(() => {
      document.getElementById('ov-badge').classList.remove('show');
      document.getElementById('overlay-box').classList.remove('double-win-box');
      document.getElementById('ov-icon').textContent = '🤝';
      document.getElementById('ov-title').textContent = 'Draw!';
      document.getElementById('ov-sub').textContent = 'Nobody wins this round.';
      document.getElementById('overlay-result').classList.add('show');
    }, 500);
  }
}

function getWinMessage(winner) {
  if (mode === '1p') {
    if (winner === 'X') return difficulty === 'easy' ? 'The bot let you win 😉' : 'You beat the bot!';
    return difficulty === 'hard' ? 'The bot is unbeatable.' : 'Better luck next time!';
  }
  return 'Well played!';
}

function closeResult() {
  document.getElementById('overlay-result').classList.remove('show');
}

// ===========================
// GENERIC PROMPT
// ===========================
function showPrompt(title, sub, buttons) {
  document.getElementById('prompt-title').textContent = title;
  document.getElementById('prompt-sub').textContent = sub;
  const btnsEl = document.getElementById('prompt-btns');
  btnsEl.innerHTML = '';
  buttons.forEach(b => {
    const btn = document.createElement('button');
    btn.className = 'btn ' + b.cls;
    btn.textContent = b.label;
    btn.onclick = b.fn;
    btnsEl.appendChild(btn);
  });
  document.getElementById('overlay-prompt').classList.add('show');
}

function closePrompt() {
  document.getElementById('overlay-prompt').classList.remove('show');
}

// ===========================
// BOT AI
// ===========================
function scheduleBotMove() {
  const delay = 400 + Math.random() * 300;
  setTimeout(() => {
    if (!gameActive) return;
    const idx = getBotMove();
    if (idx !== -1) makeMove(idx, 'O');
  }, delay);
}

function getBotMove() {
  const empty = board.map((v,i) => v === null ? i : -1).filter(i => i !== -1);
  if (empty.length === 0) return -1;
  if (difficulty === 'easy')   return getBotEasy(empty);
  if (difficulty === 'medium') return getBotMedium(empty);
  if (difficulty === 'hard')   return minimax(board, 'O').index;
  return empty[Math.floor(Math.random() * empty.length)];
}

function getBotEasy(empty) {
  const shuffled = [...empty].sort(() => Math.random() - 0.5);
  for (const idx of shuffled) {
    const sim = [...board]; sim[idx] = 'O';
    if (!checkWin(sim, 'O')) return idx;
  }
  return shuffled[0];
}

function getBotMedium(empty) {
  if (botMoveCount >= 2) {
    for (const idx of empty) {
      const sim = [...board]; sim[idx] = 'X';
      if (checkWin(sim, 'X')) return idx;
    }
  }
  return empty[Math.floor(Math.random() * empty.length)];
}

function checkWin(b, player) {
  return WIN_LINES.some(([a,c,d]) => b[a] === player && b[c] === player && b[d] === player);
}

function minimax(b, player) {
  const empty = b.map((v,i) => v === null ? i : -1).filter(i => i !== -1);
  if (checkWin(b, 'O')) return { score: 10 };
  if (checkWin(b, 'X')) return { score: -10 };
  if (empty.length === 0) return { score: 0 };
  const moves = [];
  for (const idx of empty) {
    const newB = [...b]; newB[idx] = player;
    const result = minimax(newB, player === 'O' ? 'X' : 'O');
    moves.push({ index: idx, score: result.score });
  }
  return player === 'O'
    ? moves.reduce((a,b) => b.score > a.score ? b : a)
    : moves.reduce((a,b) => b.score < a.score ? b : a);
}

// ===========================
// CONFETTI
// ===========================
let confettiAnimId = null;

function launchConfetti() {
  const canvas = document.getElementById('confetti-canvas');
  canvas.style.display = 'block';
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const ctx = canvas.getContext('2d');
  const colors = ['#a78bfa','#60a5fa','#f0c040','#f472b6','#34d399','#fb923c'];
  const particles = Array.from({length: 160}, () => ({
    x: Math.random() * canvas.width,
    y: -10 - Math.random() * 200,
    r: 4 + Math.random() * 6,
    color: colors[Math.floor(Math.random() * colors.length)],
    tiltAngle: 0,
    tiltAngleInc: 0.05 + Math.random() * 0.1,
    vx: Math.random() * 2 - 1,
    vy: 2 + Math.random() * 3,
    opacity: 1
  }));
  let startTime = null;
  const DURATION = 4000;
  function frame(ts) {
    if (!startTime) startTime = ts;
    const elapsed = ts - startTime;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const p of particles) {
      p.tiltAngle += p.tiltAngleInc;
      p.x += p.vx + Math.sin(p.tiltAngle) * 0.8;
      p.y += p.vy;
      if (elapsed > DURATION - 800) p.opacity = Math.max(0, p.opacity - 0.015);
      ctx.save();
      ctx.globalAlpha = p.opacity;
      ctx.fillStyle = p.color;
      ctx.translate(p.x, p.y);
      ctx.rotate(Math.sin(p.tiltAngle) * 12 * Math.PI / 180);
      ctx.fillRect(-p.r/2, -p.r/2, p.r, p.r * (Math.random() > 0.5 ? 2.5 : 1));
      ctx.restore();
    }
    if (elapsed < DURATION) confettiAnimId = requestAnimationFrame(frame);
    else stopConfetti();
  }
  if (confettiAnimId) cancelAnimationFrame(confettiAnimId);
  confettiAnimId = requestAnimationFrame(frame);
}

function stopConfetti() {
  if (confettiAnimId) { cancelAnimationFrame(confettiAnimId); confettiAnimId = null; }
  const canvas = document.getElementById('confetti-canvas');
  canvas.style.display = 'none';
  canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
}

/* Tic-Tac-Toe — full minimax, so the computer genuinely cannot be beaten. */
(function () {
  'use strict';

  var shell = GameCore.init({ start: start, restart: start });
  if (!shell) return;
  var U = GameCore.util;
  var STATS_KEY = 'opsec-arcade:ttt-stats';

  var LINES = [
    [0,1,2],[3,4,5],[6,7,8],
    [0,3,6],[1,4,7],[2,5,8],
    [0,4,8],[2,4,6]
  ];

  var wrap = document.createElement('div');
  var boardEl = document.createElement('div');
  boardEl.className = 'ttt';
  var cells = [];
  for (var i = 0; i < 9; i++) {
    var b = document.createElement('button');
    b.type = 'button';
    b.dataset.i = i;
    boardEl.appendChild(b);
    cells.push(b);
  }
  wrap.appendChild(boardEl);

  var resetBtn = document.createElement('button');
  resetBtn.type = 'button';
  resetBtn.className = 'btn btn-ghost';
  resetBtn.style.marginTop = '14px';
  resetBtn.textContent = 'Reset scoreboard';
  wrap.appendChild(resetBtn);
  shell.attach(wrap);

  var board, over, stats;

  function loadStats() {
    var s = GameCore.storeGet(STATS_KEY, { you: 0, cpu: 0, draws: 0 });
    if (!s || typeof s !== 'object') s = { you: 0, cpu: 0, draws: 0 };
    return s;
  }
  function saveStats() { GameCore.storeSet(STATS_KEY, stats); }
  function paintStats() {
    shell.set('you', stats.you);
    shell.set('computer', stats.cpu);
    shell.set('draws', stats.draws);
  }

  function winnerOf(b) {
    for (var i = 0; i < LINES.length; i++) {
      var L = LINES[i];
      if (b[L[0]] && b[L[0]] === b[L[1]] && b[L[1]] === b[L[2]]) return b[L[0]];
    }
    return null;
  }

  function minimax(b, turn, depth) {
    var w = winnerOf(b);
    if (w === 'O') return 10 - depth;
    if (w === 'X') return depth - 10;
    if (b.indexOf('') === -1) return 0;

    var best = turn === 'O' ? -Infinity : Infinity;
    for (var i = 0; i < 9; i++) {
      if (b[i]) continue;
      b[i] = turn;
      var s = minimax(b, turn === 'O' ? 'X' : 'O', depth + 1);
      b[i] = '';
      if (turn === 'O') { if (s > best) best = s; }
      else { if (s < best) best = s; }
    }
    return best;
  }

  function bestMove(b) {
    var bestScore = -Infinity, cands = [];
    for (var i = 0; i < 9; i++) {
      if (b[i]) continue;
      b[i] = 'O';
      var s = minimax(b, 'X', 1);
      b[i] = '';
      if (s > bestScore) { bestScore = s; cands = [i]; }
      else if (s === bestScore) cands.push(i);
    }
    return U.pick(cands);
  }

  function paint(winLine) {
    cells.forEach(function (el, i) {
      el.textContent = board[i] || '';
      el.className = board[i] ? (board[i] === 'X' ? 'x' : 'o') : '';
      el.disabled = !!board[i] || over;
      el.setAttribute('aria-label', 'Square ' + (i + 1) + (board[i] ? ', ' + board[i] : ', empty'));
      if (winLine && winLine.indexOf(i) !== -1) el.classList.add('win');
    });
  }

  function winLineFor(b) {
    for (var i = 0; i < LINES.length; i++) {
      var L = LINES[i];
      if (b[L[0]] && b[L[0]] === b[L[1]] && b[L[1]] === b[L[2]]) return L;
    }
    return null;
  }

  function end(message, kind) {
    over = true;
    var winLine = winLineFor(board);
    paint(winLine);
    shell.gameOver({
      kicker: kind === 'you' ? 'Impossible' : (kind === 'draw' ? 'Dead even' : 'Computer wins'),
      title: message,
      text: kind === 'draw'
        ? 'Perfect play from both sides always ends level — this is the best result that exists.'
        : 'The computer searched every position. You are always one mistake away from a draw.',
      action: 'Play again'
    });
  }

  function checkEnd() {
    var w = winnerOf(board);
    if (w === 'X') { stats.you++; saveStats(); paintStats(); end('You actually won', 'you'); return true; }
    if (w === 'O') { stats.cpu++; saveStats(); paintStats(); end('Computer takes it', 'cpu'); return true; }
    if (board.indexOf('') === -1) {
      stats.draws++; saveStats(); paintStats(); end('Draw', 'draw');
      return true;
    }
    return false;
  }

  function play(i) {
    if (over || board[i]) return;
    board[i] = 'X';
    paint();
    if (checkEnd()) return;
    var move = bestMove(board);
    board[move] = 'O';
    paint();
    checkEnd();
  }

  function reset() {
    board = ['', '', '', '', '', '', '', '', ''];
    over = false;
    paint();
  }

  function start() { reset(); }

  boardEl.addEventListener('click', function (e) {
    var el = e.target.closest('button');
    if (!el) return;
    play(+el.dataset.i);
  });

  resetBtn.addEventListener('click', function () {
    stats = { you: 0, cpu: 0, draws: 0 };
    saveStats();
    paintStats();
  });

  stats = loadStats();
  paintStats();
  reset();
})();

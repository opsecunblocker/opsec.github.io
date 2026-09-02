/* Minesweeper — 9x9 / 10 mines, first click always opens an area. */
(function () {
  'use strict';

  var shell = GameCore.init({ start: start, restart: start, key: onKey });
  if (!shell) return;
  var U = GameCore.util;

  var SIZE = 9, MINES = 10;

  var board = document.createElement('div');
  board.className = 'ms-board';
  board.style.gridTemplateColumns = 'repeat(' + SIZE + ', auto)';
  shell.attach(board);

  var cells, mineAt, revealed, flagged, started, ended, seconds, timer, flags;

  function build() {
    board.innerHTML = '';
    cells = [];
    mineAt = [];
    for (var i = 0; i < SIZE * SIZE; i++) mineAt.push(false);
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        var el = document.createElement('button');
        el.type = 'button';
        el.className = 'ms-cell';
        el.dataset.r = r;
        el.dataset.c = c;
        board.appendChild(el);
        cells.push({ r: r, c: c, el: el, open: false, flag: false });
      }
    }
  }

  function idx(r, c) { return r * SIZE + c; }

  function neighbours(r, c) {
    var out = [];
    for (var dr = -1; dr <= 1; dr++) {
      for (var dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        var nr = r + dr, nc = c + dc;
        if (nr < 0 || nc < 0 || nr >= SIZE || nc >= SIZE) continue;
        out.push({ r: nr, c: nc });
      }
    }
    return out;
  }

  function count(r, c) {
    var n = 0;
    neighbours(r, c).forEach(function (p) { if (mineAt[idx(p.r, p.c)]) n++; });
    return n;
  }

  function placeMines(safeR, safeC) {
    var forbidden = {};
    forbidden[idx(safeR, safeC)] = true;
    neighbours(safeR, safeC).forEach(function (p) { forbidden[idx(p.r, p.c)] = true; });

    var pool = [];
    for (var i = 0; i < SIZE * SIZE; i++) if (!forbidden[i]) pool.push(i);
    pool = U.shuffle(pool).slice(0, MINES);
    pool.forEach(function (i) { mineAt[i] = true; });
  }

  function reset() {
    build();
    revealed = 0;
    flagged = 0;
    started = false;
    ended = false;
    seconds = 0;
    flags = MINES;
    clearInterval(timer);
    timer = null;
    shell.set('time', 0);
    shell.set('mines', flags);
    shell.set('best', shell.bestText() || '—');
  }

  function start() { reset(); }

  function tick() {
    seconds++;
    shell.set('time', seconds);
  }

  function beginTimer() {
    if (started) return;
    started = true;
    timer = setInterval(tick, 1000);
  }

  function open(r, c) {
    var cell = cells[idx(r, c)];
    if (ended || cell.open || cell.flag) return;

    if (!started) {
      placeMines(r, c);
      beginTimer();
    }

    cell.open = true;
    cell.el.classList.add('open');
    revealed++;

    if (mineAt[idx(r, c)]) {
      cell.el.classList.add('boom');
      cell.el.textContent = '💥';
      lose();
      return;
    }

    var n = count(r, c);
    if (n > 0) {
      cell.el.textContent = n;
      cell.el.dataset.n = n;
    } else {
      neighbours(r, c).forEach(function (p) {
        var nb = cells[idx(p.r, p.c)];
        if (!nb.open && !nb.flag) open(p.r, p.c);
      });
    }

    if (revealed === SIZE * SIZE - MINES) win();
  }

  /* chord: clicking an open number with all its mines flagged opens the rest */
  function chord(r, c) {
    var cell = cells[idx(r, c)];
    if (ended || !cell.open) return;
    var n = count(r, c);
    if (!n) return;
    var ns = neighbours(r, c);
    var flaggedCount = ns.filter(function (p) { return cells[idx(p.r, p.c)].flag; }).length;
    if (flaggedCount !== n) return;
    ns.forEach(function (p) {
      var nb = cells[idx(p.r, p.c)];
      if (!nb.flag && !nb.open) open(p.r, p.c);
    });
  }

  function toggleFlag(r, c) {
    var cell = cells[idx(r, c)];
    if (ended || cell.open) return;
    cell.flag = !cell.flag;
    flags += cell.flag ? -1 : 1;
    cell.el.classList.toggle('flag', cell.flag);
    cell.el.textContent = cell.flag ? '⚑' : '';
    shell.set('mines', flags);
  }

  function revealAll() {
    for (var i = 0; i < cells.length; i++) {
      var cell = cells[i];
      if (mineAt[i] && !cell.flag) {
        cell.el.classList.add('mine');
        cell.el.textContent = '💣';
      }
    }
  }

  function stop() {
    ended = true;
    clearInterval(timer);
    revealAll();
  }

  function win() {
    stop();
    var best = shell.best();
    var isBest = !best || seconds < best;
    if (isBest) shell.setBestDisplay(seconds, seconds + 's');
    shell.gameOver({
      kicker: 'Grid cleared',
      title: isBest ? 'Fastest clear yet' : 'Cleared',
      text: 'You found all ' + MINES + ' mines in ' + seconds + ' second' +
            (seconds === 1 ? '' : 's') + '.' +
            (isBest ? ' New best time.' : ' Best is ' + best + 's.'),
      action: 'New grid'
    });
  }

  function lose() {
    stop();
    shell.gameOver({
      kicker: 'Boom',
      title: 'That one was a mine',
      text: 'You made it ' + seconds + ' seconds and cleared ' +
            Math.max(0, revealed - 1) + ' squares.',
      action: 'Try again'
    });
  }

  board.addEventListener('click', function (e) {
    var el = e.target.closest('.ms-cell');
    if (!el) return;
    var r = +el.dataset.r, c = +el.dataset.c;
    if (cells[idx(r, c)].open) chord(r, c);
    else open(r, c);
  });

  board.addEventListener('contextmenu', function (e) {
    e.preventDefault();
    var el = e.target.closest('.ms-cell');
    if (!el) return;
    toggleFlag(+el.dataset.r, +el.dataset.c);
  });

  /* long press to flag on touch */
  var pressTimer = null;
  board.addEventListener('touchstart', function (e) {
    var el = e.target.closest('.ms-cell');
    if (!el) return;
    pressTimer = setTimeout(function () {
      pressTimer = null;
      toggleFlag(+el.dataset.r, +el.dataset.c);
    }, 380);
  }, { passive: true });
  board.addEventListener('touchend', function () {
    if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
  });
  board.addEventListener('touchmove', function () {
    if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
  }, { passive: true });

  function onKey(e) {
    if (e.key === 'r' || e.key === 'R') { shell.hideOverlay(); reset(); }
  }

  reset();
})();

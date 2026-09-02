/* 2048 — DOM tiles, absolutely positioned inside the grid. */
(function () {
  'use strict';

  var shell = GameCore.init({ start: start, restart: start, key: onKey });
  if (!shell) return;
  var U = GameCore.util;

  var N = 4, nextId = 1;
  var grid, score, tiles, busy, won, over;

  var wrap = document.createElement('div');
  wrap.className = 'g2048-wrap';
  var board = document.createElement('div');
  board.className = 'g2048';
  for (var i = 0; i < N * N; i++) {
    var cell = document.createElement('div');
    cell.className = 'cell';
    board.appendChild(cell);
  }
  wrap.appendChild(board);
  shell.attach(wrap);

  var COLORS = {
    2:    ['#232323', '#d4d4d8'],
    4:    ['#2b2b2b', '#e4e4e7'],
    8:    ['#fdba74', '#0f0f0f'],
    16:   ['#fcd34d', '#0f0f0f'],
    32:   ['#bef264', '#0f0f0f'],
    64:   ['#86efac', '#0f0f0f'],
    128:  ['#67e8f9', '#0f0f0f'],
    256:  ['#93c5fd', '#0f0f0f'],
    512:  ['#a5b4fc', '#0f0f0f'],
    1024: ['#c4b5fd', '#0f0f0f'],
    2048: ['#f9a8d4', '#0f0f0f']
  };

  function metrics() {
    var s = getComputedStyle(board);
    return {
      cell: parseFloat(s.getPropertyValue('--cell')) || 62,
      gap: parseFloat(s.getPropertyValue('--gap')) || 9
    };
  }

  function styleTile(tile) {
    var c = COLORS[tile.value] || ['#f5f5f5', '#0f0f0f'];
    tile.el.style.background = c[0];
    tile.el.style.color = c[1];
    var digits = String(tile.value).length;
    tile.el.style.fontSize = (digits <= 2 ? 26 : digits === 3 ? 22 : digits === 4 ? 18 : 15) + 'px';
    tile.el.textContent = tile.value;
  }

  function place(tile) {
    var m = metrics();
    var x = m.gap + tile.c * (m.cell + m.gap);
    var y = m.gap + tile.r * (m.cell + m.gap);
    tile.el.style.transform = 'translate(' + x + 'px,' + y + 'px)';
  }

  function addTile(r, c, value) {
    var el = document.createElement('div');
    el.className = 'tile';
    var tile = { id: nextId++, r: r, c: c, value: value, el: el, merged: false, dying: false };
    styleTile(tile);
    board.appendChild(el);
    place(tile);
    tiles.push(tile);
    grid[r][c] = tile;
    el.animate(
      [{ transform: el.style.transform + ' scale(0.2)', opacity: 0 },
       { transform: el.style.transform + ' scale(1)', opacity: 1 }],
      { duration: 130, easing: 'cubic-bezier(.2,.8,.3,1)' }
    );
    return tile;
  }

  function spawn() {
    var free = [];
    for (var r = 0; r < N; r++) {
      for (var c = 0; c < N; c++) if (!grid[r][c]) free.push({ r: r, c: c });
    }
    if (!free.length) return;
    var spot = U.pick(free);
    addTile(spot.r, spot.c, Math.random() < 0.9 ? 2 : 4);
  }

  function reset() {
    Array.prototype.slice.call(board.querySelectorAll('.tile')).forEach(function (el) {
      el.remove();
    });
    grid = [];
    for (var r = 0; r < N; r++) {
      grid.push([]);
      for (var c = 0; c < N; c++) grid[r].push(null);
    }
    tiles = [];
    score = 0;
    busy = false;
    won = false;
    over = false;
    shell.set('score', 0);
    spawn();
    spawn();
  }

  function start() { reset(); }

  function onKey(e) {
    var k = e.key;
    if (k === 'ArrowUp' || k === 'w' || k === 'W') slide(0);
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') slide(1);
    else if (k === 'ArrowDown' || k === 's' || k === 'S') slide(2);
    else if (k === 'ArrowLeft' || k === 'a' || k === 'A') slide(3);
  }

  U.swipe(board, function (d) {
    if (d === 'up') slide(0);
    else if (d === 'right') slide(1);
    else if (d === 'down') slide(2);
    else if (d === 'left') slide(3);
  });

  var VECT = [{ r: -1, c: 0 }, { r: 0, c: 1 }, { r: 1, c: 0 }, { r: 0, c: -1 }];

  function slide(dir) {
    if (busy || over) return;
    var v = VECT[dir];
    var rows = [0, 1, 2, 3], cols = [0, 1, 2, 3];
    if (v.r === 1) rows = [3, 2, 1, 0];
    if (v.c === 1) cols = [3, 2, 1, 0];

    var moved = false, gained = 0, dead = [];

    tiles.forEach(function (t) { t.merged = false; });

    rows.forEach(function (r) {
      cols.forEach(function (c) {
        var tile = grid[r][c];
        if (!tile) return;
        var cr = r, cc = c;
        while (true) {
          var nr = cr + v.r, nc = cc + v.c;
          if (nr < 0 || nr >= N || nc < 0 || nc >= N) break;
          var other = grid[nr][nc];
          if (!other) { cr = nr; cc = nc; continue; }
          if (other.value === tile.value && !other.merged && !tile.merged) {
            other.value *= 2;
            other.merged = true;
            gained += other.value;
            grid[r][c] = null;
            tile.dying = true;
            tile.r = nr; tile.c = nc;
            dead.push(tile);
            moved = true;
            if (other.value === 2048) won = true;
          }
          break;
        }
        if (!tile.dying && (cr !== r || cc !== c)) {
          grid[r][c] = null;
          grid[cr][cc] = tile;
          tile.r = cr; tile.c = cc;
          moved = true;
        }
      });
    });

    if (!moved) return;

    busy = true;
    score += gained;
    shell.set('score', score);

    tiles.forEach(function (t) { if (!t.dying) place(t); });
    dead.forEach(function (t) { place(t); t.el.style.opacity = '0'; });

    setTimeout(function () {
      dead.forEach(function (t) {
        t.el.remove();
        tiles = tiles.filter(function (x) { return x !== t; });
      });
      tiles.forEach(function (t) {
        if (t.merged) {
          styleTile(t);
          t.el.animate(
            [{ transform: t.el.style.transform + ' scale(1)' },
             { transform: t.el.style.transform + ' scale(1.14)' },
             { transform: t.el.style.transform + ' scale(1)' }],
            { duration: 150, easing: 'ease-out' }
          );
        }
      });
      spawn();
      busy = false;
      checkEnd();
    }, 115);
  }

  function checkEnd() {
    for (var r = 0; r < N; r++) {
      for (var c = 0; c < N; c++) {
        var t = grid[r][c];
        if (!t) return;                                     // empty cell → playable
        if (c + 1 < N && grid[r][c + 1] && grid[r][c + 1].value === t.value) return;
        if (r + 1 < N && grid[r + 1][c] && grid[r + 1][c].value === t.value) return;
      }
    }
    over = true;
    var isBest = shell.submitScore(score);
    shell.gameOver({
      kicker: isBest ? 'New personal best' : 'No moves left',
      title: isBest ? 'Best board yet' : 'Board locked',
      text: 'Final score ' + score + '.' + (won ? '' : ' The grid is full and nothing can merge.'),
      action: 'New board'
    });
  }

  if (window.ResizeObserver) {
    new ResizeObserver(function () { tiles.forEach(place); }).observe(board);
  } else {
    window.addEventListener('resize', function () { tiles.forEach(place); });
  }

  reset();
})();

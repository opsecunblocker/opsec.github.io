/* Tetris — 7-bag randomiser, hold piece, ghost preview, soft + hard drop. */
(function () {
  'use strict';

  var shell = GameCore.init({ start: start, restart: start, key: onKey });
  if (!shell) return;
  var U = GameCore.util;

  var COLS = 10, ROWS = 20, CELL = 26;
  var BW = COLS * CELL, BH = ROWS * CELL;
  var PANEL = 118, PAD = 12;
  var W = BW + PANEL, H = BH;
  var g = shell.canvas(W, H);
  var ctx = g.ctx;

  var SHAPES = {
    I: { color: '#67e8f9', cells: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]] },
    J: { color: '#93c5fd', cells: [[1,0,0],[1,1,1],[0,0,0]] },
    L: { color: '#fdba74', cells: [[0,0,1],[1,1,1],[0,0,0]] },
    O: { color: '#fcd34d', cells: [[1,1],[1,1]] },
    S: { color: '#86efac', cells: [[0,1,1],[1,1,0],[0,0,0]] },
    T: { color: '#c4b5fd', cells: [[0,1,0],[1,1,1],[0,0,0]] },
    Z: { color: '#fda4af', cells: [[1,1,0],[0,1,1],[0,0,0]] }
  };
  var TYPES = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'];
  var SCORE_TABLE = [0, 100, 300, 500, 800];

  var board, piece, next, held, canHold, bag, score, lines, level, acc, softDown, gameOn;

  function rr(c, x, y, w, h, r) {
    c.beginPath();
    if (c.roundRect) { c.roundRect(x, y, w, h, r); return; }
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  function emptyBoard() {
    var b = [];
    for (var r = 0; r < ROWS; r++) {
      b.push([]);
      for (var c = 0; c < COLS; c++) b[r].push(null);
    }
    return b;
  }

  function refillBag() { bag = U.shuffle(TYPES); }

  function nextType() {
    if (!bag || !bag.length) refillBag();
    return bag.pop();
  }

  function makePiece(type) {
    var def = SHAPES[type];
    var cells = def.cells.map(function (row) { return row.slice(); });
    return {
      type: type, color: def.color, cells: cells,
      r: 0, c: Math.floor((COLS - cells.length) / 2)
    };
  }

  function gravityInterval() {
    var base = Math.max(0.07, 0.8 - (level - 1) * 0.07);
    return softDown ? Math.min(base, 0.035) : base;
  }

  function reset() {
    board = emptyBoard();
    bag = []; refillBag();
    score = 0; lines = 0; level = 1; acc = 0;
    softDown = false; canHold = true; held = null;
    piece = makePiece(nextType());
    next = makePiece(nextType());
    gameOn = true;
    shell.set('score', 0);
    shell.set('lines', 0);
    shell.set('level', 1);
    draw(0);
  }

  function start() { reset(); }

  function collides(cells, r, c) {
    for (var y = 0; y < cells.length; y++) {
      for (var x = 0; x < cells[y].length; x++) {
        if (!cells[y][x]) continue;
        var br = r + y, bc = c + x;
        if (bc < 0 || bc >= COLS || br >= ROWS) return true;
        if (br >= 0 && board[br][bc]) return true;
      }
    }
    return false;
  }

  function rotate(cells, dir) {
    var n = cells.length;
    var out = [];
    for (var y = 0; y < n; y++) {
      out.push([]);
      for (var x = 0; x < n; x++) {
        out[y].push(dir > 0 ? cells[n - 1 - x][y] : cells[x][n - 1 - y]);
      }
    }
    return out;
  }

  function tryRotate(dir) {
    if (piece.type === 'O') return;
    var cells = rotate(piece.cells, dir);
    var kicks = [0, -1, 1, -2, 2];
    for (var i = 0; i < kicks.length; i++) {
      if (!collides(cells, piece.r, piece.c + kicks[i])) {
        piece.cells = cells;
        piece.c += kicks[i];
        return;
      }
    }
  }

  function move(dc) {
    if (!collides(piece.cells, piece.r, piece.c + dc)) piece.c += dc;
  }

  function stepDown() {
    if (!collides(piece.cells, piece.r + 1, piece.c)) { piece.r += 1; return true; }
    lock();
    return false;
  }

  function hardDrop() {
    var n = 0;
    while (!collides(piece.cells, piece.r + 1, piece.c)) { piece.r += 1; n++; }
    score += n * 2;
    shell.set('score', score);
    lock();
  }

  function holdPiece() {
    if (!canHold) return;
    canHold = false;
    var cur = piece.type;
    if (held) {
      piece = makePiece(held);
      held = cur;
    } else {
      held = cur;
      piece = makePiece(nextType());
    }
    if (collides(piece.cells, piece.r, piece.c)) gameOver();
  }

  function lock() {
    for (var y = 0; y < piece.cells.length; y++) {
      for (var x = 0; x < piece.cells[y].length; x++) {
        if (!piece.cells[y][x]) continue;
        var br = piece.r + y, bc = piece.c + x;
        if (br < 0) { gameOver(); return; }
        board[br][bc] = piece.color;
      }
    }
    clearLines();
    piece = next;
    next = makePiece(nextType());
    canHold = true;
    if (collides(piece.cells, piece.r, piece.c)) gameOver();
  }

  function clearLines() {
    var cleared = 0;
    for (var r = ROWS - 1; r >= 0; r--) {
      var full = true;
      for (var c = 0; c < COLS; c++) if (!board[r][c]) { full = false; break; }
      if (!full) continue;
      board.splice(r, 1);
      var row = [];
      for (var i = 0; i < COLS; i++) row.push(null);
      board.unshift(row);
      cleared++;
      r++;
    }
    if (!cleared) return;

    score += SCORE_TABLE[cleared] * level;
    lines += cleared;
    level = Math.floor(lines / 10) + 1;
    shell.set('score', score);
    shell.set('lines', lines);
    shell.set('level', level);
  }

  function gameOver() {
    gameOn = false;
    var isBest = shell.submitScore(score);
    shell.gameOver({
      kicker: isBest ? 'New personal best' : 'Game over',
      title: isBest ? 'Best stack yet' : 'Stacked out',
      text: 'Score ' + score + ' · ' + lines + ' line' + (lines === 1 ? '' : 's') +
            ' · level ' + level + '.' + (isBest ? ' A new personal best.' : ''),
      action: 'Play again'
    });
  }

  function onKey(e) {
    var k = e.key;
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') move(-1);
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') move(1);
    else if (k === 'ArrowDown' || k === 's' || k === 'S') softDown = true;
    else if (k === 'ArrowUp' || k === 'x' || k === 'X') tryRotate(1);
    else if (k === 'z' || k === 'Z') tryRotate(-1);
    else if (k === ' ' || k === 'Spacebar' || k === 'Enter') hardDrop();
    else if (k === 'c' || k === 'C' || k === 'Shift') holdPiece();
  }
  window.addEventListener('keyup', function (e) {
    if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') softDown = false;
  });

  U.swipe(g.canvas, function (d) {
    if (d === 'left') move(-1);
    else if (d === 'right') move(1);
    else if (d === 'down') hardDrop();
    else if (d === 'up' || d === 'tap') tryRotate(1);
  });

  U.dpad(shell.stage, {
    onDir: function (d) {
      if (d === 'left') move(-1);
      else if (d === 'right') move(1);
      else if (d === 'down') hardDrop();
      else if (d === 'up') tryRotate(1);
    },
    onAction: holdPiece
  });

  function block(x, y, color, alpha, size) {
    var s = size || CELL;
    ctx.globalAlpha = alpha === undefined ? 1 : alpha;
    ctx.fillStyle = color;
    rr(ctx, x + 1.5, y + 1.5, s - 3, s - 3, 4);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    rr(ctx, x + 3, y + 3, s - 6, 4, 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function dropDistance() {
    var d = 0;
    while (!collides(piece.cells, piece.r + d + 1, piece.c)) d++;
    return d;
  }

  function miniPiece(p, x, y, box) {
    var n = p.cells.length;
    var size = Math.min(box / (n + 0.6), 20);
    var filled = 0;
    p.cells.forEach(function (row) { row.forEach(function (v) { if (v) filled++; }); });
    var offX = x + (box - n * size) / 2;
    var offY = y + (box - n * size) / 2;
    for (var r = 0; r < n; r++) {
      for (var c = 0; c < n; c++) {
        if (p.cells[r][c]) block(offX + c * size, offY + r * size, p.color, 1, size);
      }
    }
  }

  function draw() {
    ctx.fillStyle = '#0b0b0b';
    ctx.fillRect(0, 0, W, H);

    // playfield
    ctx.fillStyle = '#0d0d0d';
    ctx.fillRect(0, 0, BW, BH);
    ctx.strokeStyle = 'rgba(255,255,255,0.035)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (var i = 1; i < COLS; i++) { ctx.moveTo(i * CELL + 0.5, 0); ctx.lineTo(i * CELL + 0.5, BH); }
    for (var j = 1; j < ROWS; j++) { ctx.moveTo(0, j * CELL + 0.5); ctx.lineTo(BW, j * CELL + 0.5); }
    ctx.stroke();

    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        if (board[r][c]) block(c * CELL, r * CELL, board[r][c], 1);
      }
    }

    if (gameOn && piece) {
      // ghost
      var d = dropDistance();
      ctx.globalAlpha = 0.16;
      for (var gy = 0; gy < piece.cells.length; gy++) {
        for (var gx = 0; gx < piece.cells[gy].length; gx++) {
          if (!piece.cells[gy][gx]) continue;
          var gr = piece.r + d + gy;
          if (gr < 0) continue;
          block((piece.c + gx) * CELL, gr * CELL, piece.color, 0.18);
        }
      }
      ctx.globalAlpha = 1;

      for (var y = 0; y < piece.cells.length; y++) {
        for (var x = 0; x < piece.cells[y].length; x++) {
          if (!piece.cells[y][x]) continue;
          var pr = piece.r + y;
          if (pr < 0) continue;
          block((piece.c + x) * CELL, pr * CELL, piece.color, 1);
        }
      }
    }

    // panel
    var px = BW + PAD;
    ctx.font = '700 10px ui-monospace, monospace';
    ctx.fillStyle = '#6f6f78';
    ctx.textAlign = 'left';
    ctx.fillText('NEXT', px, 18);

    ctx.fillStyle = '#131313';
    rr(ctx, px, 26, PANEL - PAD * 2, 76, 10);
    ctx.fill();
    if (next) miniPiece(next, px, 26, PANEL - PAD * 2);

    ctx.fillStyle = '#6f6f78';
    ctx.fillText('HOLD', px, 128);
    ctx.fillStyle = '#131313';
    rr(ctx, px, 136, PANEL - PAD * 2, 76, 10);
    ctx.fill();
    if (held) miniPiece(makePiece(held), px, 136, PANEL - PAD * 2);

    ctx.fillStyle = '#6f6f78';
    ctx.fillText('KEYS', px, 238);
    ctx.fillStyle = '#a1a1aa';
    ctx.font = '500 10px ui-monospace, monospace';
    var hints = ['← →  move', '↑     rotate', '↓     soft', '␣      drop', 'C      hold', 'P      pause'];
    hints.forEach(function (h, i) { ctx.fillText(h, px, 256 + i * 15); });
  }

  shell.loop(function (dt) {
    if (gameOn) {
      acc += dt;
      var iv = gravityInterval();
      while (acc >= iv) { acc -= iv; if (!stepDown()) { acc = 0; break; } }
    }
    draw();
  });

  reset();
})();

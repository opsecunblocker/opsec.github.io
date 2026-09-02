/* Snake — grid-stepped with interpolated rendering so it moves smoothly. */
(function () {
  'use strict';

  var shell = GameCore.init({ start: start, restart: start, key: onKey });
  if (!shell) return;
  var U = GameCore.util;

  var COLS = 20, ROWS = 20, CELL = 24;
  var g = shell.canvas(COLS * CELL, ROWS * CELL);
  var ctx = g.ctx, W = g.w, H = g.h;
  var A = GameCore.accent();

  var snake, prev, dir, queue, food, score, acc, interval, alive, dead;

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

  function reset() {
    var cy = Math.floor(ROWS / 2), cx = Math.floor(COLS / 2);
    snake = [];
    for (var i = 0; i < 4; i++) snake.push({ x: cx - i, y: cy });
    prev = snake.map(function (s) { return { x: s.x, y: s.y }; });
    dir = { x: 1, y: 0 };
    queue = [];
    score = 0;
    acc = 0;
    interval = 0.13;
    alive = true;
    dead = null;
    placeFood();
    shell.set('score', 0);
    shell.set('length', snake.length);
    draw(0);
  }

  function placeFood() {
    var free = [];
    for (var y = 0; y < ROWS; y++) {
      for (var x = 0; x < COLS; x++) {
        if (!occupied(x, y)) free.push({ x: x, y: y });
      }
    }
    food = free.length ? U.pick(free) : { x: -1, y: -1 };
  }

  function occupied(x, y) {
    for (var i = 0; i < snake.length; i++) {
      if (snake[i].x === x && snake[i].y === y) return true;
    }
    return false;
  }

  function start() { reset(); }

  function turn(nx, ny) {
    var last = queue.length ? queue[queue.length - 1] : dir;
    if (last.x === -nx && last.y === -ny) return;   // no reversing
    if (last.x === nx && last.y === ny) return;     // already going there
    if (queue.length < 3) queue.push({ x: nx, y: ny });
  }

  function onKey(e) {
    var k = e.key;
    if (k === 'ArrowUp' || k === 'w' || k === 'W') turn(0, -1);
    else if (k === 'ArrowDown' || k === 's' || k === 'S') turn(0, 1);
    else if (k === 'ArrowLeft' || k === 'a' || k === 'A') turn(-1, 0);
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') turn(1, 0);
  }

  U.swipe(g.canvas, function (d) {
    if (d === 'up') turn(0, -1);
    else if (d === 'down') turn(0, 1);
    else if (d === 'left') turn(-1, 0);
    else if (d === 'right') turn(1, 0);
  });

  U.dpad(shell.stage, {
    onDir: function (d) {
      if (d === 'up') turn(0, -1);
      else if (d === 'down') turn(0, 1);
      else if (d === 'left') turn(-1, 0);
      else if (d === 'right') turn(1, 0);
    }
  });

  function step() {
    if (queue.length) dir = queue.shift();
    var head = snake[0];
    var nx = head.x + dir.x, ny = head.y + dir.y;

    if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) { die('wall'); return; }

    // the tail cell frees up on this very step, so it's a legal target
    for (var i = 0; i < snake.length - 1; i++) {
      if (snake[i].x === nx && snake[i].y === ny) { die('self'); return; }
    }

    prev = snake.map(function (s) { return { x: s.x, y: s.y }; });
    snake.unshift({ x: nx, y: ny });

    if (nx === food.x && ny === food.y) {
      score += 10 + Math.floor(snake.length / 2);
      shell.set('score', score);
      shell.set('length', snake.length);
      interval = Math.max(0.055, 0.13 - Math.floor(score / 60) * 0.008);
      placeFood();
    } else {
      snake.pop();
    }
  }

  function die(reason) {
    alive = false;
    dead = reason;
    var isBest = shell.submitScore(score);
    shell.gameOver({
      kicker: isBest ? 'New personal best' : 'Game over',
      title: isBest ? 'Best run yet' : (reason === 'self' ? 'You bit yourself' : 'You hit the wall'),
      text: 'Score ' + score + ' · length ' + snake.length + '.' +
            (isBest ? ' A new personal best.' : ''),
      action: 'Play again'
    });
  }

  function draw(t) {
    ctx.fillStyle = '#0b0b0b';
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = 'rgba(255,255,255,0.032)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (var i = 1; i < COLS; i++) { ctx.moveTo(i * CELL + 0.5, 0); ctx.lineTo(i * CELL + 0.5, H); }
    for (var j = 1; j < ROWS; j++) { ctx.moveTo(0, j * CELL + 0.5); ctx.lineTo(W, j * CELL + 0.5); }
    ctx.stroke();

    // food
    if (food.x >= 0) {
      var pulse = 0.5 + 0.5 * Math.sin(t / 260);
      ctx.fillStyle = '#fcd34d';
      ctx.beginPath();
      ctx.arc(food.x * CELL + CELL / 2, food.y * CELL + CELL / 2, CELL * 0.26 + pulse * 1.6, 0, Math.PI * 2);
      ctx.fill();
    }

    // snake — interpolate between the previous and current grid positions
    var k = alive ? Math.min(acc / interval, 1) : 0;
    for (var s = snake.length - 1; s >= 0; s--) {
      var to = snake[s];
      var from = prev[s] || to;
      var x = U.lerp(from.x, to.x, k) * CELL;
      var y = U.lerp(from.y, to.y, k) * CELL;
      var fade = 1 - (s / (snake.length + 2));

      ctx.globalAlpha = s === 0 ? 1 : 0.35 + 0.5 * fade;
      ctx.fillStyle = s === 0 ? '#ffffff' : A;
      rr(ctx, x + 2, y + 2, CELL - 4, CELL - 4, s === 0 ? 7 : 5);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    if (dead) {
      ctx.fillStyle = 'rgba(253,164,175,0.10)';
      ctx.fillRect(0, 0, W, H);
    }
  }

  shell.loop(function (dt, t) {
    if (alive) {
      acc += dt;
      while (acc >= interval && alive) { acc -= interval; step(); }
    }
    draw(t);
  });

  reset();
})();

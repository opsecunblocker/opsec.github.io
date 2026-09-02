/* Breakout — bricks, one ball, three lives, mouse or keyboard. */
(function () {
  'use strict';

  var shell = GameCore.init({ start: start, restart: start, key: onKey });
  if (!shell) return;
  var U = GameCore.util;

  var W = 600, H = 430;
  var g = shell.canvas(W, H);
  var ctx = g.ctx, canvas = g.canvas;
  var A = GameCore.accent();

  var COLS = 9, ROWS = 6, PAD = 24, GAP = 6, BRICK_H = 18;
  var BRICK_W = (W - PAD * 2 - GAP * (COLS - 1)) / COLS;

  var ROW_STYLE = [
    { points: 7, fill: '#f0abfc' },
    { points: 7, fill: '#c4b5fd' },
    { points: 5, fill: '#93c5fd' },
    { points: 5, fill: '#67e8f9' },
    { points: 3, fill: '#86efac' },
    { points: 1, fill: '#fcd34d' }
  ];

  var paddle, ball, bricks, score, lives, level, stuck, alive, shake, keyDir;

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

  function buildBricks() {
    bricks = [];
    var rows = Math.min(ROWS + Math.floor((level - 1) / 2), 8);
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < COLS; c++) {
        var style = ROW_STYLE[Math.min(r, ROW_STYLE.length - 1)];
        bricks.push({
          x: PAD + c * (BRICK_W + GAP),
          y: 60 + r * (BRICK_H + GAP),
          w: BRICK_W, h: BRICK_H,
          points: style.points, fill: style.fill, alive: true
        });
      }
    }
  }

  function reset(hard) {
    if (hard) { score = 0; lives = 3; level = 1; buildBricks(); }
    paddle = { w: 92, h: 12, x: W / 2, y: H - 34, speed: 620 };
    resetBall();
    alive = true;
    shake = 0;
    shell.set('score', score);
    shell.set('lives', lives);
    shell.set('level', level);
    draw(0);
  }

  function resetBall() {
    ball = { x: paddle.x, y: paddle.y - 12, r: 7, vx: 0, vy: 0, speed: 300 };
    stuck = true;
  }

  function start() { reset(true); }

  function launch() {
    if (!stuck) return;
    stuck = false;
    var angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.6;
    var sp = ball.speed;
    ball.vx = Math.cos(angle) * sp;
    ball.vy = Math.sin(angle) * sp;
  }

  function onKey(e) {
    var k = e.key;
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') keyDir = -1;
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') keyDir = 1;
    else if (k === ' ' || k === 'Spacebar' || k === 'Enter') launch();
  }
  window.addEventListener('keyup', function (e) {
    if (['ArrowLeft', 'ArrowRight', 'a', 'A', 'd', 'D'].indexOf(e.key) !== -1) keyDir = 0;
  });

  function pointerX(e) {
    var rect = canvas.getBoundingClientRect();
    var cx = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    return (cx / rect.width) * W;
  }
  function movePointer(e) {
    if (!alive) return;
    paddle.x = U.clamp(pointerX(e), paddle.w / 2, W - paddle.w / 2);
    if (e.cancelable) e.preventDefault();
  }
  canvas.addEventListener('mousemove', movePointer);
  canvas.addEventListener('touchmove', movePointer, { passive: false });
  canvas.addEventListener('mousedown', function (e) { movePointer(e); launch(); });
  canvas.addEventListener('touchstart', function (e) { movePointer(e); launch(); }, { passive: false });

  function bounceOffPaddle() {
    var rel = (ball.x - paddle.x) / (paddle.w / 2);
    var clamped = U.clamp(rel, -1, 1);
    var angle = -Math.PI / 2 + clamped * (Math.PI / 3);
    var sp = ball.speed;
    ball.vx = Math.cos(angle) * sp;
    ball.vy = Math.sin(angle) * sp;
    ball.y = paddle.y - ball.r - 0.5;
  }

  function hitBrick(b) {
    // work out which side we came from so the bounce is correct
    var cx = U.clamp(ball.x, b.x, b.x + b.w);
    var cy = U.clamp(ball.y, b.y, b.y + b.h);
    var dx = ball.x - cx, dy = ball.y - cy;
    if (Math.abs(dx) > Math.abs(dy)) ball.vx = -ball.vx;
    else ball.vy = -ball.vy;
    b.alive = false;
    score += b.points;
    shell.set('score', score);
    shake = 3;
  }

  function update(dt) {
    if (keyDir) {
      paddle.x = U.clamp(paddle.x + keyDir * paddle.speed * dt, paddle.w / 2, W - paddle.w / 2);
    }

    if (stuck) {
      ball.x = paddle.x;
      ball.y = paddle.y - ball.r - 1;
      return;
    }

    // substep so a fast ball can't tunnel through a brick
    var dist = Math.hypot(ball.vx, ball.vy) * dt;
    var steps = Math.max(1, Math.ceil(dist / 4));
    var sdt = dt / steps;

    for (var s = 0; s < steps; s++) {
      ball.x += ball.vx * sdt;
      ball.y += ball.vy * sdt;

      if (ball.x - ball.r < 0) { ball.x = ball.r; ball.vx = Math.abs(ball.vx); }
      if (ball.x + ball.r > W) { ball.x = W - ball.r; ball.vx = -Math.abs(ball.vx); }
      if (ball.y - ball.r < 0) { ball.y = ball.r; ball.vy = Math.abs(ball.vy); }

      var px = paddle.x - paddle.w / 2;
      if (ball.vy > 0 &&
          ball.y + ball.r >= paddle.y && ball.y - ball.r <= paddle.y + paddle.h &&
          ball.x + ball.r >= px && ball.x - ball.r <= px + paddle.w) {
        bounceOffPaddle();
      }

      for (var i = 0; i < bricks.length; i++) {
        var b = bricks[i];
        if (!b.alive) continue;
        if (ball.x + ball.r > b.x && ball.x - ball.r < b.x + b.w &&
            ball.y + ball.r > b.y && ball.y - ball.r < b.y + b.h) {
          hitBrick(b);
          break;
        }
      }

      if (ball.y - ball.r > H) { loseLife(); return; }
    }

    if (bricks.every(function (b) { return !b.alive; })) nextLevel();
  }

  function nextLevel() {
    level += 1;
    score += 100;
    shell.set('level', level);
    shell.set('score', score);
    shell.submitScore(score);
    buildBricks();
    ball.speed = Math.min(ball.speed * 1.07, 620);
    resetBall();
  }

  function loseLife() {
    lives -= 1;
    shell.set('lives', lives);
    if (lives <= 0) {
      alive = false;
      var isBest = shell.submitScore(score);
      shell.gameOver({
        kicker: isBest ? 'New personal best' : 'Game over',
        title: isBest ? 'Best run yet' : 'Out of lives',
        text: 'Score ' + score + ' · reached level ' + level + '.' +
              (isBest ? ' A new personal best.' : ''),
        action: 'Play again'
      });
      return;
    }
    resetBall();
  }

  function draw(t) {
    ctx.save();
    if (shake > 0) {
      ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
      shake *= 0.85;
      if (shake < 0.2) shake = 0;
    }

    ctx.fillStyle = '#0b0b0b';
    ctx.fillRect(-8, -8, W + 16, H + 16);

    // side rails
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0.5, 0); ctx.lineTo(0.5, H);
    ctx.moveTo(W - 0.5, 0); ctx.lineTo(W - 0.5, H);
    ctx.stroke();

    // bricks
    bricks.forEach(function (b) {
      if (!b.alive) return;
      ctx.fillStyle = b.fill;
      ctx.globalAlpha = 0.9;
      rr(ctx, b.x, b.y, b.w, b.h, 4);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      rr(ctx, b.x, b.y, b.w, 4, 2);
      ctx.fill();
    });

    // paddle
    ctx.fillStyle = A;
    rr(ctx, paddle.x - paddle.w / 2, paddle.y, paddle.w, paddle.h, 6);
    ctx.fill();

    // ball
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fill();

    if (stuck && alive) {
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.font = '600 12px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('CLICK OR PRESS SPACE TO LAUNCH', W / 2, H - 60);
    }

    ctx.restore();
  }

  shell.loop(function (dt, t) {
    if (alive) update(dt);
    draw(t);
  });

  score = 0; lives = 3; level = 1; keyDir = 0;
  reset(true);
})();

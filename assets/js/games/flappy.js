/* Flappy — one button, gravity, pipes. */
(function () {
  'use strict';

  var shell = GameCore.init({ start: start, restart: start, key: onKey });
  if (!shell) return;
  var U = GameCore.util;

  var W = 380, H = 520, GROUND = 58;
  var g = shell.canvas(W, H);
  var ctx = g.ctx, canvas = g.canvas;
  var A = GameCore.accent();

  var GRAVITY = 1500, FLAP = -430;
  var PIPE_W = 62, GAP = 152, SPACING = 236;

  var bird, pipes, score, started, alive, groundOffset, wing;

  function reset() {
    bird = { x: 104, y: H / 2 - 40, vy: 0, r: 13 };
    pipes = [];
    for (var i = 0; i < 3; i++) addPipe(W + 120 + i * SPACING);
    score = 0;
    started = false;
    alive = true;
    groundOffset = 0;
    wing = 0;
    shell.set('score', 0);
    draw(0);
  }

  function start() { reset(); }

  function addPipe(x) {
    var minTop = 60;
    var maxTop = H - GROUND - GAP - 60;
    var top = U.randInt(minTop, maxTop);
    pipes.push({ x: x, top: top, passed: false });
  }

  function flap() {
    if (!alive) return;
    if (!started) started = true;
    bird.vy = FLAP;
    wing = 1;
  }

  function onKey(e) {
    if (e.key === ' ' || e.key === 'Spacebar' || e.key === 'Enter' || e.key === 'ArrowUp') flap();
  }
  canvas.addEventListener('mousedown', function (e) { e.preventDefault(); flap(); });
  canvas.addEventListener('touchstart', function (e) { e.preventDefault(); flap(); }, { passive: false });

  function update(dt) {
    groundOffset = (groundOffset + (started ? 120 * dt : 0)) % 24;

    if (!started) {
      bird.y = H / 2 - 40 + Math.sin(Date.now() / 320) * 8;
      wing = (wing + dt * 3) % 1;
      return;
    }

    bird.vy += GRAVITY * dt;
    bird.y += bird.vy * dt;
    wing += dt * 6;

    if (bird.y - bird.r < 0) { bird.y = bird.r; bird.vy = 0; }

    var speed = Math.min(168 + score * 3.2, 275);

    for (var i = 0; i < pipes.length; i++) {
      var p = pipes[i];
      p.x -= speed * dt;

      if (!p.passed && p.x + PIPE_W < bird.x - bird.r) {
        p.passed = true;
        score++;
        shell.set('score', score);
      }
    }

    if (pipes.length && pipes[0].x + PIPE_W < -20) {
      pipes.shift();
      addPipe(pipes[pipes.length - 1].x + SPACING);
    }

    // collision
    for (var j = 0; j < pipes.length; j++) {
      var q = pipes[j];
      var nearestX = U.clamp(bird.x, q.x, q.x + PIPE_W);
      var topY = q.top, botY = q.top + GAP;
      if (Math.abs(bird.x - nearestX) < bird.r) {
        if (bird.y - bird.r < topY || bird.y + bird.r > botY) { die(); return; }
      }
    }

    if (bird.y + bird.r > H - GROUND) {
      bird.y = H - GROUND - bird.r;
      die();
    }
  }

  function die() {
    alive = false;
    var isBest = shell.submitScore(score);
    shell.gameOver({
      kicker: isBest ? 'New personal best' : 'Game over',
      title: isBest ? 'Best flight yet' : (score === 0 ? 'Straight into a pipe' : 'Down'),
      text: 'You cleared ' + score + ' pipe' + (score === 1 ? '' : 's') + '.' +
            (isBest && score > 0 ? ' A new personal best.' : ''),
      action: 'Play again'
    });
  }

  function pipe(x, top, gapTop, gapBottom) {
    ctx.fillStyle = '#86efac';
    ctx.globalAlpha = 0.9;
    ctx.fillRect(x, gapTop, PIPE_W, top - gapTop);
    ctx.fillRect(x, gapBottom, PIPE_W, H - GROUND - gapBottom);
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(x, top - 22, PIPE_W, 22);
    ctx.fillRect(x, gapBottom, PIPE_W, 22);
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, gapTop + 0.5, PIPE_W - 1, top - gapTop - 1);
    ctx.strokeRect(x + 0.5, gapBottom + 0.5, PIPE_W - 1, H - GROUND - gapBottom - 1);
  }

  function draw(t) {
    // sky
    var grad = ctx.createLinearGradient(0, 0, 0, H - GROUND);
    grad.addColorStop(0, '#101018');
    grad.addColorStop(1, '#0b0b0b');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // distant skyline
    ctx.fillStyle = 'rgba(103,232,249,0.06)';
    for (var i = 0; i < 9; i++) {
      var bx = i * 46 - (groundOffset * 0.25);
      var bh = 40 + ((i * 37) % 90);
      ctx.fillRect(bx, H - GROUND - bh, 34, bh);
    }

    pipes.forEach(function (p) {
      pipe(Math.round(p.x), Math.round(p.top), 0, Math.round(p.top + GAP));
    });

    // ground
    ctx.fillStyle = '#161616';
    ctx.fillRect(0, H - GROUND, W, GROUND);
    ctx.fillStyle = 'rgba(134,239,172,0.5)';
    ctx.fillRect(0, H - GROUND, W, 3);
    ctx.fillStyle = 'rgba(255,255,255,0.045)';
    for (var s = -24; s < W; s += 24) {
      ctx.fillRect(s + groundOffset, H - GROUND + 8, 12, 4);
    }

    // bird
    ctx.save();
    ctx.translate(bird.x, bird.y);
    var tilt = U.clamp(bird.vy / 900, -0.45, 1.1);
    ctx.rotate(tilt);
    ctx.fillStyle = A;
    ctx.beginPath();
    ctx.arc(0, 0, bird.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0f0f0f';
    ctx.beginPath();
    ctx.arc(bird.r * 0.35, -bird.r * 0.25, 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fcd34d';
    ctx.beginPath();
    ctx.moveTo(bird.r * 0.75, 2);
    ctx.lineTo(bird.r * 1.5, 5);
    ctx.lineTo(bird.r * 0.75, 8);
    ctx.closePath();
    ctx.fill();
    // wing
    var flapY = Math.sin(wing * Math.PI * 2) * 5;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.ellipse(-3, 2 + flapY, 7, 4, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (!started) {
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.font = '600 13px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('CLICK OR PRESS SPACE TO FLAP', W / 2, H / 2 - 110);
    }
  }

  shell.loop(function (dt, t) {
    if (alive) update(dt);
    draw(t);
  });

  reset();
})();

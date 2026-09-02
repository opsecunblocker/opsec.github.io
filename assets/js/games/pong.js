/* Pong — first to eleven against an imperfect AI. */
(function () {
  'use strict';

  var shell = GameCore.init({ start: start, restart: start, key: onKey });
  if (!shell) return;
  var U = GameCore.util;

  var W = 640, H = 400;
  var g = shell.canvas(W, H);
  var ctx = g.ctx, canvas = g.canvas;
  var A = GameCore.accent();

  var WIN = 11;
  var PAD_W = 12, PAD_H = 74, PAD_SPEED = 480;
  var AI_SPEED = 340;

  var player, ai, ball, you, cpu, rally, playing, keyUp, keyDown, serveTimer;

  function reset(full) {
    if (full) { you = 0; cpu = 0; }
    player = { x: 34, y: H / 2 - PAD_H / 2 };
    ai = { x: W - 34 - PAD_W, y: H / 2 - PAD_H / 2 };
    rally = 0;
    serveTimer = 0.7;
    ball = { x: W / 2, y: H / 2, r: 6, vx: 0, vy: 0, speed: 320 };
    var dir = Math.random() < 0.5 ? -1 : 1;
    ball.vx = dir * ball.speed * 0.8;
    ball.vy = (Math.random() - 0.5) * ball.speed * 0.6;
    playing = true;
    shell.set('you', you);
    shell.set('computer', cpu);
    shell.set('rally', 0);
    draw(0);
  }

  function start() { reset(true); }

  function onKey(e) {
    var k = e.key;
    if (k === 'ArrowUp' || k === 'w' || k === 'W') keyUp = true;
    else if (k === 'ArrowDown' || k === 's' || k === 'S') keyDown = true;
  }
  window.addEventListener('keyup', function (e) {
    var k = e.key;
    if (k === 'ArrowUp' || k === 'w' || k === 'W') keyUp = false;
    else if (k === 'ArrowDown' || k === 's' || k === 'S') keyDown = false;
  });

  function pointerY(e) {
    var rect = canvas.getBoundingClientRect();
    var cy = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
    return (cy / rect.height) * H;
  }
  function track(e) {
    player.y = U.clamp(pointerY(e) - PAD_H / 2, 0, H - PAD_H);
    if (e.cancelable) e.preventDefault();
  }
  canvas.addEventListener('mousemove', track);
  canvas.addEventListener('touchmove', track, { passive: false });

  function bounce(paddle, dir) {
    var rel = (ball.y - (paddle.y + PAD_H / 2)) / (PAD_H / 2);
    var clamped = U.clamp(rel, -1, 1);
    var angle = clamped * (Math.PI / 3.2);
    ball.speed = Math.min(ball.speed * 1.045, 720);
    ball.vx = Math.cos(angle) * ball.speed * dir;
    ball.vy = Math.sin(angle) * ball.speed;
    rally++;
    shell.set('rally', rally);
  }

  function point(who) {
    if (who === 'you') you++; else cpu++;
    shell.set('you', you);
    shell.set('computer', cpu);
    if (you >= WIN || cpu >= WIN) {
      playing = false;
      shell.gameOver({
        kicker: you >= WIN ? 'Match won' : 'Match lost',
        title: you >= WIN ? 'You took it ' + you + '–' + cpu : 'Computer wins ' + cpu + '–' + you,
        text: 'Longest rally: ' + rally + ' shots.',
        action: 'Rematch'
      });
      return;
    }
    reset(false);
  }

  function update(dt) {
    if (keyUp) player.y = Math.max(0, player.y - PAD_SPEED * dt);
    if (keyDown) player.y = Math.min(H - PAD_H, player.y + PAD_SPEED * dt);

    if (serveTimer > 0) {
      serveTimer -= dt;
      ball.x = W / 2;
      ball.y = H / 2;
      return;
    }

    // AI: only reacts once the ball is on its way, and never quite fast enough
    var target = ball.y - PAD_H / 2;
    if (ball.vx > 0) {
      var diff = target - ai.y;
      var maxStep = AI_SPEED * dt;
      ai.y += U.clamp(diff, -maxStep, maxStep);
    } else {
      var homeStep = 90 * dt;
      ai.y += U.clamp((H / 2 - PAD_H / 2) - ai.y, -homeStep, homeStep);
    }
    ai.y = U.clamp(ai.y, 0, H - PAD_H);

    var steps = Math.max(1, Math.ceil(Math.hypot(ball.vx, ball.vy) * dt / 4));
    var sdt = dt / steps;

    for (var s = 0; s < steps; s++) {
      ball.x += ball.vx * sdt;
      ball.y += ball.vy * sdt;

      if (ball.y - ball.r < 0) { ball.y = ball.r; ball.vy = Math.abs(ball.vy); }
      if (ball.y + ball.r > H) { ball.y = H - ball.r; ball.vy = -Math.abs(ball.vy); }

      if (ball.vx < 0 &&
          ball.x - ball.r <= player.x + PAD_W && ball.x + ball.r >= player.x &&
          ball.y + ball.r >= player.y && ball.y - ball.r <= player.y + PAD_H) {
        ball.x = player.x + PAD_W + ball.r;
        bounce(player, 1);
      }

      if (ball.vx > 0 &&
          ball.x + ball.r >= ai.x && ball.x - ball.r <= ai.x + PAD_W &&
          ball.y + ball.r >= ai.y && ball.y - ball.r <= ai.y + PAD_H) {
        ball.x = ai.x - ball.r;
        bounce(ai, -1);
      }

      if (ball.x + ball.r < -20) { point('cpu'); return; }
      if (ball.x - ball.r > W + 20) { point('you'); return; }
    }
  }

  function draw(t) {
    ctx.fillStyle = '#0b0b0b';
    ctx.fillRect(0, 0, W, H);

    // centre line
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 12]);
    ctx.beginPath();
    ctx.moveTo(W / 2, 8); ctx.lineTo(W / 2, H - 8);
    ctx.stroke();
    ctx.setLineDash([]);

    // big faded scores
    ctx.font = '700 92px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.045)';
    ctx.fillText(String(you), W / 2 - 90, H / 2 + 30);
    ctx.fillText(String(cpu), W / 2 + 90, H / 2 + 30);

    ctx.fillStyle = A;
    ctx.fillRect(player.x, player.y, PAD_W, PAD_H);
    ctx.fillStyle = '#fda4af';
    ctx.fillRect(ai.x, ai.y, PAD_W, PAD_H);

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fill();

    if (serveTimer > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '600 13px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('GET READY', W / 2, H / 2 - 60);
    }
  }

  shell.loop(function (dt, t) {
    if (playing) update(dt);
    draw(t);
  });

  you = 0; cpu = 0; keyUp = false; keyDown = false;
  reset(true);
})();

/* Space Invaders — five descending rows, three crumbling bunkers, one shot at a time. */
(function () {
  'use strict';

  var shell = GameCore.init({ start: start, restart: start, key: onKey });
  if (!shell) return;
  var U = GameCore.util;

  var W = 560, H = 440;
  var g = shell.canvas(W, H);
  var ctx = g.ctx, canvas = g.canvas;
  var A = GameCore.accent();

  var ROWS = 5, COLS = 8;
  var INV_W = 34, INV_H = 24, INV_GAP = 10, MARGIN = (W - (COLS * INV_W + (COLS - 1) * INV_GAP)) / 2;
  var ROW_COLOR = ['#f0abfc', '#c4b5fd', '#a5b4fc', '#93c5fd', '#67e8f9'];
  var ROW_POINTS = [30, 30, 20, 20, 10];

  var PLAYER_W = 40, PLAYER_H = 18, PLAYER_Y = H - 40, PLAYER_SPEED = 300;
  var BUNKER_Y = H - 96, BUNKER_COLS = 14, BUNKER_ROWS = 9, BLOCK = 5;

  var player, aliens, bullet, bombs, bunkers, score, lives, wave, dir, moveTimer, alive, keyL, keyR, firing;

  function buildAliens() {
    aliens = [];
    var startY = 66 + Math.min(wave - 1, 4) * 12;
    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        aliens.push({
          r: r, c: c,
          x: MARGIN + c * (INV_W + INV_GAP),
          y: startY + r * (INV_H + INV_GAP),
          points: ROW_POINTS[Math.min(r, ROW_POINTS.length - 1)],
          color: ROW_COLOR[Math.min(r, ROW_COLOR.length - 1)],
          alive: true
        });
      }
    }
  }

  function buildBunkers() {
    if (!bunkers) bunkers = [];
    for (var i = 0; i < 3; i++) {
      if (bunkers[i] && wave > 1 && bunkers[i].hp > 0) continue;
      var blocks = [];
      for (var r = 0; r < BUNKER_ROWS; r++) {
        blocks.push([]);
        for (var c = 0; c < BUNKER_COLS; c++) {
          // carve the classic arch
          var arch = r > 4 && c > 3 && c < 10;
          var slope = r < 2 && (c < 2 - r || c > BUNKER_COLS - 3 + r);
          blocks[r].push(!(arch || slope));
        }
      }
      bunkers[i] = {
        x: (W / 3) * i + (W / 3 - BUNKER_COLS * BLOCK) / 2,
        y: BUNKER_Y,
        blocks: blocks,
        hp: 1
      };
    }
  }

  function reset(hard) {
    if (hard) {
      score = 0; lives = 3; wave = 1;
      bunkers = [];
      buildBunkers();
      buildAliens();
    } else {
      buildAliens();
      buildBunkers();
    }
    player = { x: W / 2, y: PLAYER_Y };
    bullet = null;
    bombs = [];
    dir = 1;
    moveTimer = 0.6;
    alive = true;
    keyL = keyR = firing = false;
    shell.set('score', score);
    shell.set('lives', lives);
    shell.set('wave', wave);
    draw(0);
  }

  function start() { reset(true); }

  function moveInterval() {
    var live = aliens.filter(function (a) { return a.alive; }).length;
    var ratio = live / (ROWS * COLS);
    return Math.max(0.06, (0.05 + ratio * 0.55) / (1 + (wave - 1) * 0.12));
  }

  function onKey(e) {
    var k = e.key;
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') keyL = true;
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') keyR = true;
    else if (k === ' ' || k === 'Spacebar' || k === 'Enter') fire();
  }
  window.addEventListener('keyup', function (e) {
    var k = e.key;
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') keyL = false;
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') keyR = false;
  });

  function pointerX(e) {
    var rect = canvas.getBoundingClientRect();
    var cx = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    return (cx / rect.width) * W;
  }
  canvas.addEventListener('mousemove', function (e) { player.x = pointerX(e); });
  canvas.addEventListener('mousedown', function (e) { player.x = pointerX(e); fire(); });
  canvas.addEventListener('touchmove', function (e) {
    if (e.cancelable) e.preventDefault();
    player.x = pointerX(e);
  }, { passive: false });
  canvas.addEventListener('touchstart', function (e) {
    if (e.cancelable) e.preventDefault();
    player.x = pointerX(e);
    fire();
  }, { passive: false });

  function fire() {
    if (!alive || bullet) return;
    bullet = { x: player.x, y: player.y - 6, vy: -520 };
  }

  function bunkerHit(x, y, r) {
    var hit = false;
    bunkers.forEach(function (b) {
      if (x < b.x - r || x > b.x + BUNKER_COLS * BLOCK + r) return;
      if (y < b.y - r || y > b.y + BUNKER_ROWS * BLOCK + r) return;
      var col = Math.floor((x - b.x) / BLOCK);
      var row = Math.floor((y - b.y) / BLOCK);
      // punch a small crater
      for (var dr = -2; dr <= 1; dr++) {
        for (var dc = -1; dc <= 1; dc++) {
          var rr = row + dr, cc = col + dc;
          if (rr < 0 || rr >= BUNKER_ROWS || cc < 0 || cc >= BUNKER_COLS) continue;
          if (!b.blocks[rr][cc]) continue;
          b.blocks[rr][cc] = false;
          hit = true;
        }
      }
    });
    return hit;
  }

  function update(dt) {
    if (keyL) player.x -= PLAYER_SPEED * dt;
    if (keyR) player.x += PLAYER_SPEED * dt;
    player.x = U.clamp(player.x, PLAYER_W / 2, W - PLAYER_W / 2);

    // fleet march
    moveTimer -= dt;
    if (moveTimer <= 0) {
      moveTimer = moveInterval();
      var live = aliens.filter(function (a) { return a.alive; });
      if (!live.length) return;

      var minX = Infinity, maxX = -Infinity;
      live.forEach(function (a) { minX = Math.min(minX, a.x); maxX = Math.max(maxX, a.x + INV_W); });
      var stepX = 10;
      if ((dir === 1 && maxX + stepX > W - 8) || (dir === -1 && minX - stepX < 8)) {
        dir *= -1;
        live.forEach(function (a) { a.y += 16; });
      } else {
        live.forEach(function (a) { a.x += stepX * dir; });
      }

      // drop a bomb from a random front-line invader
      if (Math.random() < 0.35 + wave * 0.05) {
        var front = {};
        live.forEach(function (a) {
          if (!front[a.c] || a.y > front[a.c].y) front[a.c] = a;
        });
        var shooters = Object.keys(front).map(function (k) { return front[k]; });
        var s = U.pick(shooters);
        bombs.push({ x: s.x + INV_W / 2, y: s.y + INV_H, vy: 150 + wave * 18 });
      }
    }

    // invaders reached the bunkers
    if (aliens.some(function (a) { return a.alive && a.y + INV_H > BUNKER_Y + 4; })) {
      lose('The fleet got through');
      return;
    }

    // player bullet
    if (bullet) {
      bullet.y += bullet.vy * dt;
      if (bunkerHit(bullet.x, bullet.y, 4)) bullet = null;
      if (bullet && bullet.y < 0) bullet = null;
      if (bullet) {
        for (var i = 0; i < aliens.length; i++) {
          var a = aliens[i];
          if (!a.alive) continue;
          if (bullet.x > a.x && bullet.x < a.x + INV_W &&
              bullet.y > a.y && bullet.y < a.y + INV_H) {
            a.alive = false;
            score += a.points;
            shell.set('score', score);
            bullet = null;
            break;
          }
        }
      }
    }

    // bombs
    bombs = bombs.filter(function (b) {
      b.y += b.vy * dt;
      if (bunkerHit(b.x, b.y, 4)) return false;
      if (b.y > H) return false;
      if (b.y > player.y && b.y < player.y + PLAYER_H &&
          b.x > player.x - PLAYER_W / 2 && b.x < player.x + PLAYER_W / 2) {
        lives--;
        shell.set('lives', lives);
        if (lives <= 0) { lose('Shot down'); return false; }
        return false;
      }
      return true;
    });

    if (!alive) return;

    if (aliens.every(function (a) { return !a.alive; })) {
      wave++;
      score += 200;
      shell.set('wave', wave);
      shell.set('score', score);
      shell.submitScore(score);
      bombs = [];
      bullet = null;
      buildAliens();
      buildBunkers();
      moveTimer = 0.8;
    }
  }

  function lose(reason) {
    alive = false;
    var isBest = shell.submitScore(score);
    shell.gameOver({
      kicker: isBest ? 'New personal best' : 'Game over',
      title: isBest ? 'Best defence yet' : reason,
      text: 'Score ' + score + ' · reached wave ' + wave + '.' +
            (isBest ? ' A new personal best.' : ''),
      action: 'Play again'
    });
  }

  function drawAlien(a, t) {
    var bob = Math.sin((t / 320) + a.c) > 0 ? 0 : 1;
    var x = a.x, y = a.y + bob;
    ctx.fillStyle = a.color;
    ctx.beginPath();
    ctx.moveTo(x + 6, y + 4);
    ctx.lineTo(x + INV_W - 6, y + 4);
    ctx.lineTo(x + INV_W - 2, y + INV_H - 8);
    ctx.lineTo(x + 2, y + INV_H - 8);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(x + 8, y + INV_H - 8, 4, 6);
    ctx.fillRect(x + INV_W - 12, y + INV_H - 8, 4, 6);
    ctx.fillStyle = '#0f0f0f';
    ctx.fillRect(x + 9, y + 9, 5, 5);
    ctx.fillRect(x + INV_W - 14, y + 9, 5, 5);
  }

  function draw(t) {
    ctx.fillStyle = '#0b0b0b';
    ctx.fillRect(0, 0, W, H);

    aliens.forEach(function (a) { if (a.alive) drawAlien(a, t); });

    // bunkers
    bunkers.forEach(function (b) {
      ctx.fillStyle = '#86efac';
      for (var r = 0; r < BUNKER_ROWS; r++) {
        for (var c = 0; c < BUNKER_COLS; c++) {
          if (b.blocks[r][c]) ctx.fillRect(b.x + c * BLOCK, b.y + r * BLOCK, BLOCK, BLOCK);
        }
      }
    });

    // player
    ctx.fillStyle = A;
    ctx.beginPath();
    ctx.moveTo(player.x - PLAYER_W / 2, player.y + PLAYER_H);
    ctx.lineTo(player.x, player.y);
    ctx.lineTo(player.x + PLAYER_W / 2, player.y + PLAYER_H);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(player.x - 3, player.y - 5, 6, 6);

    if (bullet) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(bullet.x - 1.5, bullet.y - 8, 3, 10);
    }

    ctx.fillStyle = '#fda4af';
    bombs.forEach(function (b) { ctx.fillRect(b.x - 1.5, b.y, 3, 9); });

    // ground line
    ctx.strokeStyle = 'rgba(134,239,172,0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, H - 14.5); ctx.lineTo(W, H - 14.5);
    ctx.stroke();
  }

  shell.loop(function (dt, t) {
    if (alive) update(dt);
    draw(t);
  });

  score = 0; lives = 3; wave = 1;
  reset(true);
})();

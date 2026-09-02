/* ==========================================================================
   game-core.js — the tiny shell every game on OPSEC Arcade plugs into.
   Handles: HUD readouts, start/pause/game-over overlay, requestAnimationFrame
   loop, keyboard plumbing, canvas setup (hi-dpi), swipe input and best scores.
   No dependencies. Loaded only on game pages.
   ========================================================================== */
(function (global) {
  'use strict';

  var BEST_PREFIX = 'opsec-arcade:best:';
  var RECENT_KEY  = 'opsec-arcade:recents';

  /* --- storage (never throws, even in private mode) ---------------------- */
  function storeGet(key, fallback) {
    try {
      var v = global.localStorage.getItem(key);
      if (v === null) return fallback;
      try { return JSON.parse(v); } catch (e) { return v; }   // tolerate raw strings
    } catch (e) { return fallback; }
  }
  function storeSet(key, val) {
    try { global.localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }

  /* --- utilities shared by games ----------------------------------------- */
  var util = {
    rand:    function (n) { return Math.floor(Math.random() * n); },
    randInt: function (a, b) { return a + Math.floor(Math.random() * (b - a + 1)); },
    pick:    function (arr) { return arr[Math.floor(Math.random() * arr.length)]; },
    clamp:   function (v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); },
    lerp:    function (a, b, t) { return a + (b - a) * t; },
    shuffle: function (arr) {
      var a = arr.slice();
      for (var i = a.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = a[i]; a[i] = a[j]; a[j] = t;
      }
      return a;
    },
    /* swipe(el, cb) → cb('up'|'down'|'left'|'right'|'tap') */
    swipe: function (el, cb, threshold) {
      var min = threshold || 26, sx = 0, sy = 0, live = false;
      el.addEventListener('touchstart', function (e) {
        var t = e.changedTouches[0]; sx = t.clientX; sy = t.clientY; live = true;
      }, { passive: true });
      el.addEventListener('touchmove', function (e) {
        if (live && e.cancelable) e.preventDefault();
      }, { passive: false });
      el.addEventListener('touchend', function (e) {
        if (!live) return;
        live = false;
        var t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
        if (Math.abs(dx) < min && Math.abs(dy) < min) { cb('tap'); return; }
        if (Math.abs(dx) > Math.abs(dy)) cb(dx > 0 ? 'right' : 'left');
        else cb(dy > 0 ? 'down' : 'up');
      }, { passive: true });
    },
    tap: function (el, cb) {
      el.addEventListener('click', cb);
      if (global.ontouchstart !== undefined) {
        el.addEventListener('touchstart', function () {}, { passive: true });
      }
    },
    /* on-screen d-pad for touch users: util.dpad(stage, {onDir, onAction}) */
    dpad: function (parent, handlers) {
      var wrap = document.createElement('div');
      wrap.className = 'dpad';
      wrap.setAttribute('aria-hidden', 'true');
      var defs = [
        ['left', '◀', 1, 2], ['down', '▼', 2, 1],
        ['up', '▲', 2, 3],   ['right', '▶', 3, 2],
        ['action', '⟳', 5, 3]
      ];
      defs.forEach(function (d) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'dpad-btn dpad-' + d[0];
        b.textContent = d[1];
        b.style.gridColumn = d[2];
        b.style.gridRow = d[3];
        b.addEventListener('click', function (e) {
          e.preventDefault();
          if (d[0] === 'action') { if (handlers.onAction) handlers.onAction(); }
          else if (handlers.onDir) handlers.onDir(d[0]);
        });
        wrap.appendChild(b);
      });
      parent.appendChild(wrap);
      return wrap;
    }
  };

  /* --- the shell --------------------------------------------------------- */
  /* current accent colour, read off the shell's --accent custom property */
  function accentOf() {
    var el = document.querySelector('[data-shell]');
    var v = el ? global.getComputedStyle(el).getPropertyValue('--accent') : '';
    return (v && v.trim()) || '#67e8f9';
  }

  function init(opts) {
    opts = opts || {};
    var shellEl = document.querySelector('[data-shell]');
    if (!shellEl) return null;

    var stage   = shellEl.querySelector('[data-stage]');
    var overlay = shellEl.querySelector('[data-overlay]');
    var slug    = shellEl.getAttribute('data-slug') || 'game';

    var kickerEl = overlay.querySelector('[data-overlay-kicker]');
    var titleEl  = overlay.querySelector('[data-overlay-title]');
    var textEl   = overlay.querySelector('[data-overlay-text]');
    var hintEl   = overlay.querySelector('[data-overlay-hint]');
    var actionEl = overlay.querySelector('[data-overlay-action]');

    var api = {
      el: shellEl,
      stage: stage,
      overlay: overlay,
      slug: slug,
      state: 'ready',      // ready | playing | paused | over
      util: util,
      accent: accentOf
    };

    /* --- HUD ------------------------------------------------------------- */
    api.set = function (key, value) {
      var node = shellEl.querySelector('[data-hud="' + key + '"]');
      if (node) node.textContent = value;
      return api;
    };
    api.get = function (key) {
      var node = shellEl.querySelector('[data-hud="' + key + '"]');
      if (!node) return 0;
      var n = parseFloat(String(node.textContent).replace(/[^0-9.\-]/g, ''));
      return isNaN(n) ? 0 : n;
    };

    /* --- overlay --------------------------------------------------------- */
    api.showOverlay = function (o, state) {
      o = o || {};
      if (o.kicker) kickerEl.textContent = o.kicker;
      if (o.title)  titleEl.textContent  = o.title;
      if (o.text)   textEl.textContent   = o.text;
      if (o.action) actionEl.textContent = o.action;
      hintEl.textContent = o.hint || (o.hint === '' ? '' : 'Press space to continue');
      overlay.hidden = false;
      api.state = state || 'over';
      return api;
    };
    api.hideOverlay = function () {
      overlay.hidden = true;
      api.state = 'playing';
      return api;
    };
    api.gameOver = function (o) { return api.showOverlay(o, 'over'); };

    api.start = function () {
      api.paused = false;
      api.hideOverlay();
      if (opts.start) opts.start();
      return api;
    };

    /* --- pause ----------------------------------------------------------- */
    api.setPaused = function (p) {
      api.paused = !!p;
      if (p) {
        api.showOverlay({
          kicker: 'Paused', title: 'Paused',
          text: 'Take your time. The game is waiting.',
          action: 'Resume', hint: 'Press space or esc to resume'
        }, 'paused');
      } else {
        api.hideOverlay();
      }
      if (opts.pause) opts.pause(api.paused);
      return api;
    };
    api.togglePause = function () {
      if (api.state === 'playing') api.setPaused(true);
      else if (api.state === 'paused') api.setPaused(false);
      return api;
    };

    /* --- best score ------------------------------------------------------ */
    api.best = function () { return Number(storeGet(BEST_PREFIX + slug, 0)) || 0; };
    api.setBest = function (value) {
      storeSet(BEST_PREFIX + slug, Number(value) || 0);
      api.set('best', value);
      return api;
    };
    api.submitScore = function (value) {
      value = Number(value) || 0;
      if (value > api.best()) { api.setBest(value); return true; }
      return false;
    };

    /* For games where lower is better (times, move counts) — stores the raw
       number for the homepage cards plus a ready-made label for the HUD. */
    api.bestText = function () {
      return storeGet(BEST_PREFIX + 'text:' + slug, null);
    };
    api.setBestDisplay = function (value, text) {
      storeSet(BEST_PREFIX + slug, Number(value) || 0);
      storeSet(BEST_PREFIX + 'text:' + slug, text);
      api.set('best', text);
      return api;
    };

    /* --- canvas ---------------------------------------------------------- */
    api.canvas = function (w, h) {
      var c = document.createElement('canvas');
      c.className = 'game-canvas';
      var dpr = Math.min(global.devicePixelRatio || 1, 3);
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
      c.style.maxWidth = w + 'px';
      c.style.aspectRatio = w + ' / ' + h;
      var ctx = c.getContext('2d');
      ctx.scale(dpr, dpr);
      stage.insertBefore(c, overlay);
      return { canvas: c, ctx: ctx, w: w, h: h };
    };

    /* put a DOM-based board inside the stage, under the overlay */
    api.attach = function (node) {
      stage.insertBefore(node, overlay);
      return node;
    };

    /* --- main loop ------------------------------------------------------- */
    api.loop = function (step) {
      var last = 0;
      function frame(t) {
        global.requestAnimationFrame(frame);
        if (!last) last = t;
        var dt = Math.min((t - last) / 1000, 0.05);
        last = t;
        if (api.state === 'playing') step(dt, t);
      }
      global.requestAnimationFrame(frame);
      return api;
    };

    /* --- input ----------------------------------------------------------- */
    var BLOCK = { ArrowUp: 1, ArrowDown: 1, ArrowLeft: 1, ArrowRight: 1, ' ': 1, Spacebar: 1 };

    global.addEventListener('keydown', function (e) {
      var tag = e.target && e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      var k = e.key;

      if (k === ' ' || k === 'Spacebar' || k === 'Enter') {
        if (api.state === 'ready' || api.state === 'over' || api.state === 'paused') {
          e.preventDefault();
          api.start();
          return;
        }
      }
      if (k === 'Escape' || k === 'p' || k === 'P') {
        if (api.state === 'playing' || api.state === 'paused') {
          e.preventDefault();
          api.togglePause();
          return;
        }
      }
      if (BLOCK[k] && api.state === 'playing') e.preventDefault();
      if (opts.key) opts.key(e, api);
    });

    actionEl.addEventListener('click', function () { api.start(); });

    var restartBtn = shellEl.querySelector('[data-action="restart"]');
    if (restartBtn) {
      restartBtn.addEventListener('click', function () {
        api.paused = false;
        api.hideOverlay();
        if (opts.restart) opts.restart();
      });
    }
    var pauseBtn = shellEl.querySelector('[data-action="pause"]');
    if (pauseBtn) pauseBtn.addEventListener('click', api.togglePause);

    var fsBtn = shellEl.querySelector('[data-action="fullscreen"]');
    if (fsBtn) {
      fsBtn.addEventListener('click', function () {
        if (!document.fullscreenElement) {
          if (shellEl.requestFullscreen) shellEl.requestFullscreen();
        } else if (document.exitFullscreen) {
          document.exitFullscreen();
        }
      });
    }

    /* --- seed the HUD ---------------------------------------------------- */
    Array.prototype.forEach.call(shellEl.querySelectorAll('[data-hud]'), function (node) {
      var key = node.getAttribute('data-hud');
      node.textContent = key === 'best' ? String(api.best()) : '0';
    });

    /* remember this visit for the homepage "continue" row */
    var recents = storeGet(RECENT_KEY, []);
    if (!Array.isArray(recents)) recents = [];
    recents = recents.filter(function (r) { return r && r.slug !== slug; });
    recents.unshift({
      slug: slug,
      title: shellEl.getAttribute('data-title') || document.title,
      icon: shellEl.getAttribute('data-icon') || '🎮',
      accent: shellEl.getAttribute('data-accent') || '#67e8f9',
      url: global.location.pathname
    });
    storeSet(RECENT_KEY, recents.slice(0, 4));

    return api;
  }

  global.GameCore = { init: init, util: util, storeGet: storeGet, storeSet: storeSet,
                      accent: accentOf, BEST_PREFIX: BEST_PREFIX, RECENT_KEY: RECENT_KEY };
})(window);

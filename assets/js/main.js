/* ==========================================================================
   main.js — site chrome: mobile nav, game search + category filters,
   "surprise me", and the "pick up where you left off" row.
   Loaded on every page. No dependencies.
   ========================================================================== */
(function () {
  'use strict';

  var RECENT_KEY  = 'opsec-arcade:recents';
  var BEST_PREFIX = 'opsec-arcade:best:';

  function storeGet(key, fallback) {
    try {
      var v = localStorage.getItem(key);
      if (v === null) return fallback;
      try { return JSON.parse(v); } catch (e) { return v; }   // tolerate raw strings
    } catch (e) { return fallback; }
  }
  function storeSet(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  /* --- mobile nav -------------------------------------------------------- */
  (function nav() {
    var header = $('.site-header');
    var toggle = $('.nav-toggle');
    if (!header || !toggle) return;
    toggle.hidden = false;
    toggle.addEventListener('click', function () {
      var open = header.classList.toggle('nav-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  })();

  /* --- best scores on cards ---------------------------------------------- */
  (function bests() {
    $$('[data-best]').forEach(function (node) {
      var slug = node.getAttribute('data-best');
      var v = Number(storeGet(BEST_PREFIX + slug, 0)) || 0;
      var label = storeGet(BEST_PREFIX + 'text:' + slug, null);
      if (!v && !label) return;
      node.textContent = label || ('Best ' + v.toLocaleString());
      node.hidden = false;
    });
  })();

  /* --- recently played ---------------------------------------------------- */
  (function recents() {
    var section = $('[data-continue]');
    var list = $('[data-recents]');
    if (!section || !list) return;

    function render() {
      var items = storeGet(RECENT_KEY, []);
      if (!Array.isArray(items)) items = [];
      items = items.filter(function (i) { return i && i.slug && i.url; });
      if (!items.length) { section.hidden = true; return; }

      list.innerHTML = '';
      items.slice(0, 4).forEach(function (item) {
        var a = document.createElement('a');
        a.className = 'recent';
        a.href = item.url;
        a.setAttribute('style', '--accent:' + (item.accent || '#67e8f9'));
        a.innerHTML =
          '<span class="emoji" aria-hidden="true"></span>' +
          '<span class="meta"><strong></strong><span>Play again</span></span>';
        a.querySelector('.emoji').textContent = item.icon || '🎮';
        a.querySelector('strong').textContent = item.title || item.slug;
        list.appendChild(a);
      });
      section.hidden = false;
    }

    var clear = $('[data-clear-recents]');
    if (clear) {
      clear.addEventListener('click', function () {
        storeSet(RECENT_KEY, []);
        render();
      });
    }
    render();
  })();

  /* --- search + category filters ----------------------------------------- */
  (function filter() {
    var input = $('[data-search]');
    var cards = $$('[data-card]');
    if (!input || !cards.length) return;

    var chips = $$('.chip[data-filter]');
    var sections = $$('section[data-cat]');
    var emptyMsg = $('[data-empty]');
    var current = 'all';

    // chip counters
    chips.forEach(function (chip) {
      var f = chip.getAttribute('data-filter');
      var n = f === 'all'
        ? cards.length
        : cards.filter(function (c) { return c.getAttribute('data-category') === f; }).length;
      var count = chip.querySelector('.count');
      if (count) count.textContent = n;
    });

    function apply() {
      var q = (input.value || '').trim().toLowerCase();
      var visible = 0;

      cards.forEach(function (card) {
        var ok = current === 'all' || card.getAttribute('data-category') === current;
        if (ok && q) {
          ok = (card.getAttribute('data-search') || '').indexOf(q) !== -1;
        }
        card.hidden = !ok;
        if (ok) visible++;
      });

      sections.forEach(function (section) {
        var any = $$('[data-card]', section).some(function (c) { return !c.hidden; });
        section.hidden = !any;
      });

      if (emptyMsg) emptyMsg.hidden = visible > 0;
    }

    input.addEventListener('input', apply);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { input.value = ''; apply(); input.blur(); }
    });

    chips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        current = chip.getAttribute('data-filter');
        chips.forEach(function (c) {
          c.setAttribute('aria-pressed', c === chip ? 'true' : 'false');
        });
        apply();
      });
    });

    /* "/" focuses search */
    document.addEventListener('keydown', function (e) {
      if (e.key !== '/' || e.metaKey || e.ctrlKey) return;
      var tag = e.target && e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      e.preventDefault();
      input.focus();
      input.select();
    });

    /* --- surprise me ----------------------------------------------------- */
    var randomBtn = $('[data-random]');
    if (randomBtn) {
      randomBtn.addEventListener('click', function () {
        var pool = cards.filter(function (c) { return !c.hidden; });
        if (!pool.length) pool = cards;
        var card = pool[Math.floor(Math.random() * pool.length)];
        var link = card.querySelector('.card-link');
        if (link) window.location.href = link.href;
      });
    }

    apply();
  })();
})();

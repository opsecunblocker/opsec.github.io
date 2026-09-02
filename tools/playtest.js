#!/usr/bin/env node
/* DEVELOPMENT ONLY — drives every game with random input and reports any
   uncaught exception or stuck HUD. Requires the preview server on :4000.
   Usage: node tools/playtest.js */
'use strict';

const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const SITE = path.resolve(__dirname, '..', '_site');
const BASE = process.env.BASE || 'http://localhost:4000';

const KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Enter',
              'a', 'd', 'w', 's', 'c', 'z', 'x', '1', '2', '3', '4'];

function stubContext() {
  const noop = function () {};
  return new Proxy({}, {
    get: function (target, prop) {
      if (prop === 'canvas') return { width: 100, height: 100 };
      if (prop === 'measureText') return function () { return { width: 10 }; };
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') {
        return function () { return { addColorStop: noop }; };
      }
      return typeof target[prop] === 'undefined' ? noop : target[prop];
    },
    set: function (t, p, v) { t[p] = v; return true; }
  });
}

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

(async function () {
  const slugs = fs.readdirSync(path.join(SITE, 'games'));
  let failures = 0;

  for (const slug of slugs) {
    const errors = [];
    const virtualConsole = new VirtualConsole();
    virtualConsole.on('jsdomError', function (e) { errors.push(String(e.message).split('\n')[0]); });
    virtualConsole.on('error', function (m) { errors.push('console.error: ' + m); });

    const dom = await JSDOM.fromURL(BASE + '/games/' + slug + '/', {
      runScripts: 'dangerously',
      pretendToBeVisual: true,
      resources: 'usable',
      virtualConsole: virtualConsole,
      beforeParse: function (window) {
        window.HTMLCanvasElement.prototype.getContext = function () { return stubContext(); };
        window.Element.prototype.animate = function () {
          return { finished: Promise.resolve(), cancel: function () {} };
        };
        window.ResizeObserver = function () {
          this.observe = function () {}; this.disconnect = function () {};
        };
      }
    });

    const w = dom.window, doc = w.document;
    await sleep(300);

    const report = { slug: slug, started: false, hudChanges: 0 };

    try {
      const play = doc.querySelector('[data-overlay-action]');
      if (play) { play.click(); report.started = true; }

      const snapshot = function () {
        return Array.prototype.map.call(doc.querySelectorAll('[data-hud]'), function (n) {
          return n.getAttribute('data-hud') + '=' + n.textContent;
        }).join('|');
      };
      const before = snapshot();

      // hammer it
      for (let i = 0; i < 60; i++) {
        const key = KEYS[Math.floor(Math.random() * KEYS.length)];
        w.dispatchEvent(new w.KeyboardEvent('keydown', { key: key, bubbles: true }));
        w.dispatchEvent(new w.KeyboardEvent('keyup', { key: key, bubbles: true }));

        const stage = doc.querySelector('[data-stage]');
        if (stage) {
          const clickable = stage.querySelectorAll('button, .ms-cell, .mem-card, .ttt button, .reaction, canvas');
          if (clickable.length) {
            const el = clickable[Math.floor(Math.random() * clickable.length)];
            el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true }));
          }
        }
        if (i % 12 === 0) await sleep(60);
      }
      await sleep(250);

      const after = snapshot();
      report.hudChanges = before === after ? 0 : 1;

      // pause / resume / restart buttons
      ['pause', 'pause', 'restart', 'fullscreen'].forEach(function (a) {
        const btn = doc.querySelector('[data-action="' + a + '"]');
        if (btn) btn.click();
      });
      await sleep(150);
    } catch (e) {
      errors.push('threw: ' + e.message);
    }

    if (errors.length) {
      failures++;
      console.log('FAIL  ' + slug);
      errors.slice(0, 4).forEach(function (e) { console.log('      ' + e); });
    } else {
      console.log('ok    ' + slug + '  (hud moved: ' + !!report.hudChanges + ')');
    }

    dom.window.close();
  }

  console.log('\n' + (failures ? failures + ' game(s) failed' : 'all games survived random input'));
  process.exit(failures ? 1 : 0);
})();

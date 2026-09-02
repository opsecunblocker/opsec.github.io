#!/usr/bin/env node
/* DEVELOPMENT ONLY — headless smoke test.
   Loads every generated page in jsdom with a stubbed 2D canvas context and
   runs the game modules, so runtime errors surface without a browser.
   Usage: node tools/smoke.js */
'use strict';

const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const ROOT = path.resolve(__dirname, '..');
const SITE = path.join(ROOT, '_site');

function stubContext() {
  const noop = function () { return undefined; };
  const ctx = new Proxy({}, {
    get: function (target, prop) {
      if (prop === 'canvas') return { width: 100, height: 100 };
      if (prop === 'measureText') return function () { return { width: 10 }; };
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') {
        return function () { return { addColorStop: noop }; };
      }
      if (typeof target[prop] === 'undefined') return noop;
      return target[prop];
    },
    set: function (target, prop, value) { target[prop] = value; return true; }
  });
  return ctx;
}

function listPages() {
  const out = [];
  (function walk(dir) {
    fs.readdirSync(dir).forEach(function (name) {
      const full = path.join(dir, name);
      if (fs.statSync(full).isDirectory()) walk(full);
      else if (name.endsWith('.html')) out.push(full);
    });
  })(SITE);
  return out.sort();
}

let failures = 0;

(async function () {
  const pages = listPages();

  for (const file of pages) {
    const rel = path.relative(SITE, file);
    const errors = [];

    const virtualConsole = new VirtualConsole();
    virtualConsole.on('jsdomError', function (e) { errors.push(e.message + '\n' + (e.stack || '')); });
    virtualConsole.on('error', function (msg) { errors.push('console.error: ' + msg); });

    const html = fs.readFileSync(file, 'utf8');
    const dom = new JSDOM(html, {
      url: 'http://localhost:4000/' + rel.replace(/index\.html$/, ''),
      runScripts: 'dangerously',
      pretendToBeVisual: true,
      virtualConsole: virtualConsole,
      resources: 'usable',
      beforeParse: function (window) {
        window.HTMLCanvasElement.prototype.getContext = function () { return stubContext(); };
        window.Element.prototype.animate = function () {
          return { finished: Promise.resolve(), cancel: function () {}, onfinish: null };
        };
        if (!window.ResizeObserver) {
          window.ResizeObserver = function () {
            this.observe = function () {};
            this.disconnect = function () {};
          };
        }
        if (!window.performance) window.performance = { now: function () { return Date.now(); } };
        window.requestAnimationFrame = function (cb) { return setTimeout(function () { cb(Date.now()); }, 16); };
        window.cancelAnimationFrame = function (id) { clearTimeout(id); };
      }
    });

    // let deferred scripts + a few animation frames run
    await new Promise(function (r) { setTimeout(r, 400); });

    const w = dom.window;
    const doc = w.document;

    // basic sanity: did every game page actually mount something?
    const isGame = /[\\/]games[\\/]/.test(file);
    if (isGame) {
      const stage = doc.querySelector('[data-stage]');
      const mounted = stage && (stage.querySelector('canvas') || stage.children.length > 1);
      if (!mounted) errors.push('nothing was mounted into [data-stage]');
      if (!w.GameCore) errors.push('GameCore did not load');
      const hud = doc.querySelectorAll('[data-hud]');
      if (!hud.length) errors.push('no HUD readouts rendered');
      hud.forEach(function (n) {
        if (/undefined|NaN/.test(n.textContent)) {
          errors.push('HUD "' + n.getAttribute('data-hud') + '" shows ' + n.textContent);
        }
      });
    } else if (rel === 'index.html') {
      const cards = doc.querySelectorAll('[data-card]');
      if (cards.length < 12) errors.push('expected 12 cards, found ' + cards.length);
    }

    if (errors.length) {
      failures++;
      console.log('FAIL  ' + rel);
      errors.slice(0, 4).forEach(function (e) { console.log('      ' + String(e).split('\n')[0]); });
    } else {
      console.log('ok    ' + rel);
    }

    dom.window.close();
  }

  console.log('\n' + (failures ? failures + ' page(s) failed' : 'all pages clean'));
  process.exit(failures ? 1 : 0);
})();

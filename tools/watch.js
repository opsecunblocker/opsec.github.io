#!/usr/bin/env node
/* DEVELOPMENT ONLY — rebuild + reload the preview when anything changes.
   Usage: node tools/watch.js */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
let timer = null;
let building = false;

function build() {
  if (building) return;
  building = true;
  const t = Date.now();
  const child = spawn(process.execPath, [path.join(__dirname, 'build.js'), '--out', '_site', '--baseurl', ''], {
    cwd: ROOT, stdio: 'inherit'
  });
  child.on('exit', function (code) {
    building = false;
    if (code === 0) console.log('[watch] rebuilt in ' + (Date.now() - t) + 'ms');
  });
}

function schedule() {
  clearTimeout(timer);
  timer = setTimeout(build, 140);
}

const watchDirs = ['_games', '_layouts', '_includes', 'assets', 'tools'];
watchDirs.forEach(function (dir) {
  const full = path.join(ROOT, dir);
  if (!fs.existsSync(full)) return;
  fs.watch(full, { recursive: true }, function () { schedule(); });
});
fs.watch(ROOT, function (event, filename) {
  if (!filename) return;
  if (/\.(html|md|yml)$/i.test(filename)) schedule();
});

console.log('[watch] watching ' + watchDirs.join(', ') + ' …');
build();

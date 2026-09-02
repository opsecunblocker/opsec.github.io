/* Reaction Test — five attempts, averaged. Lower is better. */
(function () {
  'use strict';

  var shell = GameCore.init({ start: start, restart: start });
  if (!shell) return;
  var U = GameCore.util;

  var TRIES = 5;

  var panel = document.createElement('div');
  panel.className = 'reaction idle';
  panel.setAttribute('role', 'button');
  panel.setAttribute('tabindex', '0');
  panel.innerHTML =
    '<div><div class="big"></div><div class="sub"></div>' +
    '<div class="tries"></div></div>';
  shell.attach(panel);

  var big = panel.querySelector('.big');
  var sub = panel.querySelector('.sub');
  var tries = panel.querySelector('.tries');
  for (var i = 0; i < TRIES; i++) tries.appendChild(document.createElement('i'));

  var results, state, timeout, startedAt;

  function setTries() {
    Array.prototype.forEach.call(tries.children, function (dot, i) {
      dot.classList.toggle('on', i < results.length);
    });
  }

  function setState(next, title, text) {
    state = next;
    panel.className = 'reaction ' + next;
    big.textContent = title;
    sub.textContent = text;
  }

  function reset() {
    results = [];
    clearTimeout(timeout);
    setTries();
    shell.set('last', '—');
    shell.set('average', '—');
    shell.set('best', shell.bestText() || '—');
    setState('idle', 'Ready', 'Click anywhere on this panel to begin.');
  }

  function start() { reset(); }

  function arm() {
    setState('waiting', 'Wait…', 'Click the moment the panel turns green.');
    timeout = setTimeout(function () {
      startedAt = performance.now();
      setState('go', 'CLICK', 'Now.');
    }, 1200 + Math.random() * 2600);
  }

  function tooSoon() {
    clearTimeout(timeout);
    setState('toosoon', 'Too soon', 'That attempt is void. Click to try again.');
  }

  function record(ms) {
    results.push(ms);
    setTries();
    shell.set('last', ms + ' ms');

    if (!shell.best() || ms < shell.best()) shell.setBestDisplay(ms, ms + ' ms');

    if (results.length >= TRIES) {
      var avg = Math.round(results.reduce(function (a, b) { return a + b; }, 0) / results.length);
      shell.set('average', avg + ' ms');
      var verdict = avg < 200 ? 'Genuinely quick.'
                  : avg < 250 ? 'Around typical human average.'
                  : avg < 300 ? 'About average for a trackpad.'
                  : 'Slow — check your display refresh rate before blaming yourself.';
      shell.gameOver({
        kicker: 'Round complete',
        title: avg + ' ms average',
        text: 'Fastest: ' + Math.min.apply(null, results) + ' ms · slowest: ' +
              Math.max.apply(null, results) + ' ms. ' + verdict,
        action: 'Run it again'
      });
      return;
    }

    setState('idle', Math.min.apply(null, results) + ' ms',
             'Best so far. Click for attempt ' + (results.length + 1) + ' of ' + TRIES + '.');
  }

  function press() {
    if (shell.state !== 'playing') return;
    if (state === 'idle' || state === 'toosoon') arm();
    else if (state === 'waiting') tooSoon();
    else if (state === 'go') record(Math.round(performance.now() - startedAt));
  }

  panel.addEventListener('click', press);
  panel.addEventListener('keydown', function (e) {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); press(); }
  });

  reset();
})();

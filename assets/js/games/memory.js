/* Memory Match — 8 pairs, best score is your lowest move count. */
(function () {
  'use strict';

  var shell = GameCore.init({ start: start, restart: start });
  if (!shell) return;
  var U = GameCore.util;

  var EMOJI = ['🚀', '🛸', '🪐', '👾', '⭐', '🌙', '☄️', '🔭'];

  var boardEl = document.createElement('div');
  boardEl.className = 'mem';
  shell.attach(boardEl);

  var deck, first, locked, moves, matched, cards;

  function build() {
    boardEl.innerHTML = '';
    deck = U.shuffle(EMOJI.concat(EMOJI));
    cards = deck.map(function (sym, i) {
      var card = document.createElement('div');
      card.className = 'mem-card';
      card.dataset.i = i;
      card.innerHTML =
        '<div class="mem-face mem-back">?</div>' +
        '<div class="mem-face mem-front"></div>';
      card.querySelector('.mem-front').textContent = sym;
      boardEl.appendChild(card);
      return { el: card, sym: sym, open: false, done: false };
    });
  }

  function reset() {
    build();
    first = null;
    locked = false;
    moves = 0;
    matched = 0;
    shell.set('moves', 0);
    shell.set('pairs', 0);
    shell.set('best', shell.bestText() || '—');
  }

  function start() { reset(); }

  function flip(card) {
    if (locked || card.done || card.open) return;
    card.open = true;
    card.el.classList.add('flipped');

    if (!first) { first = card; return; }

    moves++;
    shell.set('moves', moves);

    if (first.sym === card.sym) {
      first.done = true;
      card.done = true;
      first.el.classList.add('matched');
      card.el.classList.add('matched');
      first = null;
      matched++;
      shell.set('pairs', matched);
      if (matched === EMOJI.length) finish();
      return;
    }

    locked = true;
    var a = first, b = card;
    first = null;
    setTimeout(function () {
      a.open = false; b.open = false;
      a.el.classList.remove('flipped');
      b.el.classList.remove('flipped');
      locked = false;
    }, 700);
  }

  function finish() {
    var best = shell.best();
    var isBest = !best || moves < best;
    if (isBest) shell.setBestDisplay(moves, moves + ' moves');
    var rating = moves <= 14 ? 'Outstanding memory.'
              : moves <= 18 ? 'Well above average.'
              : moves <= 24 ? 'Solid — under the guessing average of 27.'
              : 'Cleared. Try naming each card as you flip it to go faster.';
    shell.gameOver({
      kicker: 'Board cleared',
      title: isBest ? 'Fewest moves yet' : 'All pairs found',
      text: moves + ' moves. ' + rating,
      action: 'Play again'
    });
  }

  boardEl.addEventListener('click', function (e) {
    var el = e.target.closest('.mem-card');
    if (!el) return;
    flip(cards[+el.dataset.i]);
  });

  reset();
})();

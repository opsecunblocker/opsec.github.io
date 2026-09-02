/* Simon — repeat the sequence, one note longer every round. */
(function () {
  'use strict';

  var shell = GameCore.init({ start: start, restart: start, key: onKey });
  if (!shell) return;
  var U = GameCore.util;

  var NOTES = [
    { freq: 329.6, el: null },  // E4
    { freq: 415.3, el: null },  // G#4
    { freq: 277.2, el: null },  // C#4
    { freq: 220.0, el: null }   // A3
  ];

  var boardEl = document.createElement('div');
  boardEl.className = 'simon';
  var pads = [];
  for (var i = 0; i < 4; i++) {
    var b = document.createElement('button');
    b.type = 'button';
    b.dataset.p = i;
    b.innerHTML = '<span></span>';
    b.querySelector('span').textContent = ['1', '2', '3', '4'][i];
    boardEl.appendChild(b);
    pads.push(b);
  }
  shell.attach(boardEl);

  var sequence, step, playing, inputLocked, round;

  var audioCtx = null;
  function beep(freq, ms) {
    try {
      if (!audioCtx) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        audioCtx = new AC();
      }
      if (audioCtx.state === 'suspended') audioCtx.resume();
      var osc = audioCtx.createOscillator();
      var gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.12, audioCtx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + ms / 1000);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + ms / 1000);
    } catch (e) { /* sound is a nice-to-have */ }
  }

  function lit(i, on) { pads[i].classList.toggle('lit', on); }

  function reset() {
    sequence = [];
    step = 0;
    playing = false;
    inputLocked = true;
    round = 0;
    shell.set('round', 0);
    setPadsEnabled(false);
  }

  function start() {
    reset();
    nextRound();
  }

  function setPadsEnabled(on) {
    pads.forEach(function (p) { p.disabled = !on; });
  }

  function tempo() {
    if (round >= 9) return 320;
    if (round >= 5) return 420;
    return 560;
  }

  function nextRound() {
    round = sequence.length + 1;
    shell.set('round', round);
    sequence.push(U.randInt(0, 3));
    playback();
  }

  function playback() {
    playing = true;
    inputLocked = true;
    setPadsEnabled(false);
    var i = 0;
    var t = tempo();

    (function showNext() {
      if (i >= sequence.length) {
        setTimeout(function () {
          playing = false;
          inputLocked = false;
          setPadsEnabled(true);
        }, t * 0.5);
        return;
      }
      var note = sequence[i++];
      lit(note, true);
      beep(NOTES[note].freq, t * 0.7);
      setTimeout(function () {
        lit(note, false);
        setTimeout(showNext, t * 0.28);
      }, t * 0.62);
    })();
  }

  function press(i) {
    if (playing || inputLocked || !round) return;
    lit(i, true);
    beep(NOTES[i].freq, 240);
    setTimeout(function () { lit(i, false); }, 160);

    if (sequence[step] !== i) {
      inputLocked = true;
      setPadsEnabled(false);
      var isBest = shell.submitScore(round - 1);
      beep(110, 700);
      setTimeout(function () {
        shell.gameOver({
          kicker: 'Wrong pad',
          title: 'Sequence broken',
          text: 'You reached round ' + round + ' — a sequence of ' + (round - 1) +
                ' items survived.' + (isBest ? ' New personal best.' : ''),
          action: 'Try again'
        });
      }, 420);
      return;
    }

    step++;
    if (step >= sequence.length) {
      step = 0;
      inputLocked = true;
      setTimeout(nextRound, 520);
    }
  }

  boardEl.addEventListener('click', function (e) {
    var el = e.target.closest('button');
    if (!el) return;
    press(+el.dataset.p);
  });

  function onKey(e) {
    var n = parseInt(e.key, 10);
    if (n >= 1 && n <= 4) press(n - 1);
  }

  reset();
})();

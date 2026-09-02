# OPSEC Arcade

A free, open-source arcade of browser games published with GitHub Pages.

**Live at:** <https://opsecunblocker.github.io/opsec.github.io/>

Twelve games, all hand-written in plain JavaScript. No frameworks, no build step,
no trackers, no network calls — click a game and it plays.

| | | |
| --- | --- | --- |
| 🐍 **Snake** | 🔢 **2048** | 🧱 **Breakout** |
| 🧩 **Tetris** | 💣 **Minesweeper** | 🏓 **Pong** |
| ❎ **Tic-Tac-Toe** | 🃏 **Memory Match** | 👾 **Space Invaders** |
| 🐤 **Flappy** | ⚡ **Reaction Test** | 🎵 **Simon** |

## How it works

GitHub Pages builds this repository with Jekyll. Nothing else is required — there
is no `Gemfile`, no bundler step and no plugin dependency.

```
_config.yml              site config + the `games` collection
index.html               homepage: hero, search, category filters, game grid
404.html                 not-found page
_layouts/
  default.html           page shell, header, footer, script tags
  game.html              the play shell: HUD, stage, overlay, controls, how-to-play
_includes/
  head.html              meta tags
  header.html            sticky nav
  footer.html
  game-card.html         one card in the grid
_games/
  snake.md … simon.md    one file per game (front matter + "how to play" copy)
assets/
  css/style.css
  js/main.js             search, filters, "surprise me", recently-played row
  js/game-core.js        shared shell: HUD, overlay, loop, input, best scores
  js/games/<slug>.js     one self-contained module per game
tools/                   local preview only — not published
```

### The `_games` collection

Every file in `_games/` becomes a page at `/games/<filename>/`. Front matter
drives the whole page:

```yaml
---
title: Snake
slug: snake             # must match the filename — it loads assets/js/games/<slug>.js
icon: 🐍
accent: "#86efac"       # per-game accent colour
category: Arcade        # Arcade | Puzzle | Casual (see note below)
difficulty: Easy        # Easy | Medium | Hard — draws 1–3 dots on the card
players: 1 player
order: 1                # sort order on the homepage
tagline: Eat the pellets, grow the tail, don't bite yourself.
hud: Score=score,Best=best,Length=length
controls: <kbd>↑</kbd> <kbd>↓</kbd> <kbd>←</kbd> <kbd>→</kbd> to turn
---
```

`hud:` is parsed as `Label=key` pairs and rendered into the HUD automatically.
`assets/js/game-core.js` seeds every readout to `0` (or the stored best score for
the key `best`) and gives you `shell.set('score', 10)` to update them.

### Writing a game

Each game is an IIFE that calls `GameCore.init()` and mounts into the stage:

```js
(function () {
  'use strict';
  var shell = GameCore.init({ start: start, restart: start, key: onKey });
  var g = shell.canvas(480, 480);          // or shell.attach(node) for DOM games
  var ctx = g.ctx;

  function start() { /* reset state */ }

  function onKey(e) {
    if (e.key === 'ArrowLeft') /* … */;
  }

  shell.loop(function (dt, t) {            // dt in seconds, paused-aware
    update(dt);
    draw(t);
  });
})();
```

The shell handles the rest: start/pause/game-over overlay, the requestAnimationFrame
loop, arrow-key scroll suppression, hi-DPI canvas setup, swipe input, fullscreen,
and a per-game best score in `localStorage`.

`GameCore.util` gives you `rand`, `randInt`, `pick`, `shuffle`, `clamp`, `lerp`,
`swipe(el, cb)` and `dpad(parent, handlers)`.

## Adding a game

1. Add `_games/<slug>.md` with the front matter shown above.
2. Add `assets/js/games/<slug>.js`.
3. Done — it appears on the homepage automatically.

Two things to know:

- Homepage sections are driven by the category list at the top of `index.html`
  (`assign cats = 'Arcade|Puzzle|Casual' | split: '|'`). A brand-new category
  needs adding there to get its own section.
- The nav links in `_includes/header.html` are hardcoded to the three categories.

## Previewing locally

GitHub Pages builds the real site, so you normally don't need anything installed.
If you want a live preview without Ruby, the `tools/` folder renders the same
Liquid templates with Node:

```bash
npm install                 # dev-only: liquidjs, markdown-it, js-yaml, jsdom
npm run build               # renders the site into _site/
npm run serve               # serves _site/ on http://localhost:4000
npm run watch               # rebuild on change
node tools/smoke.js         # load every page headlessly, fail on JS errors
node tools/playtest.js      # drive every game with random input, fail on errors
```

`tools/` is listed under `exclude` in `_config.yml`, so it never gets published.

## Publishing

Pages builds from the **`main`** branch. Merge into `main` and the site updates
within a minute or two. Check the build under **Settings → Pages**.

## Licence

MIT. Play it, fork it, add a game.

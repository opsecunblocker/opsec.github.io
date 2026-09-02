---
title: Tic-Tac-Toe
slug: tictactoe
icon: ❎
accent: "#67e8f9"
category: Puzzle
difficulty: Easy
players: 1 player vs. computer
order: 7
tagline: Three in a row against an opponent that never makes a mistake.
hud: You=you,Computer=computer,Draws=draws
controls: Click a square to place your mark · runs across a full session
---

## How to play

You're **X** and you go first. Take turns placing marks on the 3 × 3 grid and get
three in a row — horizontally, vertically or diagonally.

### The computer

The AI plays with a full minimax search over every reachable position, so it is
**mathematically unbeatable**. The very best result available to you is a draw.

That sounds discouraging, but it's actually the interesting part: perfect play from
both sides always ends level, so every draw you take is a small win.

### How to force the draw

- **Open in a corner.** The computer has to take the centre to avoid losing.
- Watch for the moment it sets up two threats at once — that's the trap to block.
- Take the centre if it's ever offered to you.

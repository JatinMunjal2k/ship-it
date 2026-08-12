# ship_it

An incremental game about doing a software job.

You have an app. It has no users. You ship features by typing into a prompt
box — and every feature you ship has a chance of carrying a defect you cannot
see. Bugs accumulate silently, production eventually breaks, and users leave
while it is broken.

The way out is process: tests, code review, CI, monitoring, on-call. Each one
makes you slower. Each one is also the only thing standing between you and the
churn. By the endgame you have automated away every chore you started with, and
shipping is a single keypress again — which is the joke.

**Play it:** https://jatinmunjal2k.github.io/ship-it/

## Running it locally

Open `index.html` in a browser. That is the whole setup — no build step, no
dependencies, no server.

## Tuning it

Every balance number lives in [`config.js`](config.js), grouped into seven
commented sections:

| Section | Controls |
| --- | --- |
| `growth` | users per feature, revenue per user, base user cap |
| `quality` | the defect-free rate, risky-diff chance and penalty |
| `testing` | how much of a defect gets caught, per test tier |
| `pipeline` | how long each build stage takes |
| `permissions` | how often commands ask, and how many are destructive |
| `agents` | automation throughput |
| `incidents` | how often production breaks and what it costs |

Edit a value, save, refresh. The sections are for readability — the game
flattens them at boot and validates as it goes, so a typo, a missing key or a
key duplicated across two sections produces a readable error on screen instead
of a broken economy.

Browsers cache `config.js`, so hard-refresh (`Cmd+Shift+R`) if a change seems to
do nothing.

The two numbers most worth pushing on:

- `INCIDENT_BLEED` — churn per second while production is down. The most
  punishing value in the game. A stubborn incident can cost close to half your
  users at the default.
- `THINK_TIME_START` — the main dial for early-game pace.

## Two ideas the design rests on

**Quality and detection are different things.** Code quality is the chance a
change is defect-free. Detection is the chance you find out before users do,
and it is zero until you buy Unit tests. Tests do not make the code better —
they make defects visible before deploy. So the early game is fast and blind,
and buying tests makes you slower on purpose.

**Upgrades delete chores, they don't add percentages.** Shipping starts as five
separate interactions — answer a permission prompt, review a diff, deal with a
red build, deploy. Each Workflow skill removes exactly one of them, so the
count falls 5 → 4 → 3 → 2 → 1. The end state is pressing Enter, which is where
the game started, except now you earned it.

## Status

Playable prototype. No save system and no prestige layer, both deliberately —
the point is to find out whether the core loop is fun before building around it.

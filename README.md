# ship_it

An incremental game about doing a software job.

You have an app. It has no users. You ship features by typing into a prompt
box — and every feature you ship has a chance of carrying a defect you cannot
see. Bugs accumulate silently, production eventually breaks, and users leave
while it is broken.

The way out is process: tests, code review, CI, monitoring, on-call. Each one
makes you slower. Each one is also the only thing standing between you and the
churn. By the end you have automated away every chore you started with, and
shipping is a single keypress again — which is the joke.

**Play it:** https://jatinmunjal2k.github.io/ship-it/

The demo ends at 1,700 features shipped, roughly 30–35 minutes in.

## Running it locally

The game uses ES modules, which browsers refuse to load from `file://`. Serve
the folder instead — from this directory:

```
python3 -m http.server 8000
```

Then open http://localhost:8000. Opening `index.html` directly shows a banner
with this command rather than failing silently. The published version needs
none of this.

## Tuning it

Every balance number lives in [`config.js`](config.js), grouped into commented
sections:

| Section | Controls |
| --- | --- |
| `growth` | users per feature, revenue per user, base user cap |
| `quality` | the defect-free rate, risky-diff chance and penalty |
| `testing` | how much of a defect gets caught, per test tier |
| `pipeline` | how long each build stage takes |
| `permissions` | how often commands ask, and how many are destructive |
| `agents` | automation throughput |
| `incidents` | outage frequency, churn, bug clearing, remediation |
| `ending` | the features-shipped goal |
| `saving` | autosave interval |

Edit a value, save, refresh. Sections are for readability — the game flattens
them at boot and validates as it goes, so a typo, a missing key or a key
duplicated across two sections produces a readable error on screen instead of
a broken economy. Browsers cache `config.js`, so hard-refresh
(`Cmd+Shift+R`) if a change seems to do nothing.

The three numbers most worth pushing on:

- `INCIDENT_BUG_CLEAR_FRACTION` — how much of the backlog an outage clears.
  This is load-bearing. Shipping creates ~0.4 defects per feature while an
  incident removes one, so at 0 the bug count grows without bound from the
  first minute and production ends up down two thirds of the time.
- `INCIDENT_BLEED` — churn per second while production is down. The most
  punishing value in the game.
- `THINK_TIME_START` — the main dial for early-game pace.

## Code layout

| File | Holds |
| --- | --- |
| `index.html` | markup and styles only |
| `config.js` | balance values, sectioned |
| `src/config.js` | flattens and validates the above |
| `src/state.js` | run state and every derived value |
| `src/tree.js` | the skill tree |
| `src/flavor.js` | text pools |
| `src/pipeline.js` | the build machine, agents, remediation |
| `src/incidents.js` | outages and their repair |
| `src/ending.js` | the demo goal |
| `src/save.js` | save, load, validate |
| `src/log.js` | the two feeds |
| `src/render.js` | all DOM output |
| `src/main.js` | boot, input, game loop |

Two conventions worth keeping:

- **Skills only write modifiers to state, never absolute values.** That is what
  lets a `config.js` change re-derive everything already unlocked.
- **`state` is mutated in place, never reassigned**, because ES modules export
  live bindings importers cannot reassign.

To add a skill, drop a node into a branch in `src/tree.js` with a unique id,
`cost`, `desc()` and `apply()`. Set `req` to gate it — locked nodes are not
drawn at all, so it stays hidden until its prerequisites are owned.

## Three ideas the design rests on

**Quality and detection are different things.** Code quality is the chance a
change is defect-free. Detection is the chance you find out before users do, and
it is zero until you buy Unit tests. Tests do not make the code better — they
make defects visible before deploy. So the early game is fast and blind, and
buying tests makes you slower on purpose.

**Upgrades delete chores, they don't add percentages.** Shipping starts as
several separate interactions — answer a permission prompt, review a diff, deal
with a red build, deploy. Each Workflow skill removes exactly one, so the count
falls to a single Enter. The end state is where the game started, except now you
earned it.

**Process is what lets automation scale.** Agents bypass your pipeline
entirely, so their defects are unscreened until Continuous integration is
owned. Without it, buying agents buries you.

## Status

Playable prototype with a save system and an ending. No offline progress by
design — time pauses when you close the tab. No prestige layer yet.

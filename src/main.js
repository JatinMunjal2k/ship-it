/* ==========================================================================
   Boot, input wiring and the game loop.
   ========================================================================== */

import { CONFIG, configProblems } from './config.js';
import { state, resetState, money, fmt, esc, $ } from './state.js';
import { tree, resetTree, allNodes, buyable, costOf, visible, isMaxed, owned } from './tree.js';
import { log, clearLog, clearHistory } from './log.js';
import {
  advance, advancePipeline, runAgents, runRemediation,
  resolvePermission, approveDiff, rejectDiff, fixRedBuild, shipAnyway,
  startDeploy, fixBug,
} from './pipeline.js';
import { bleedUsers, rollForIncident } from './incidents.js';
import { checkEnding } from './ending.js';
import {
  render, renderTree, resetStageKey, setView, view,
  hideTip, renderEnding, hideEnding, renderRules, hideRules,
  recenterTree, setZoom, getZoom, panBy, setGrabbing, treeFramed,
} from './render.js';
import { layoutProblems } from './layout.js';
import { saveGame, loadGame, wipeSave, hasSave, autosaveTick, describeAge, storageOK } from './save.js';

window.__booted = true;
const bootfail = $('bootfail');
if (bootfail) bootfail.style.display = 'none';

/* `running` is false on the menu and while the ending is up. */
let running = false;

function reportConfigProblems() {
  const problems = configProblems.concat(layoutProblems(allNodes().map(n => n.id)));
  if (!problems.length) return false;
  const el = $('configerr');
  el.style.display = 'block';
  el.innerHTML = '<b>Config needs fixing</b>, the game is not running.<ul>' +
    problems.map(p => '<li>' + esc(p) + '</li>').join('') + '</ul>';
  return true;
}

/* ==========================================================================
   Purchases
   ========================================================================== */
function buy(n) {
  if (!buyable(n)) return;
  const c = costOf(n);
  state.cash -= c;
  n.count = (n.count || 0) + 1;
  n.apply();
  log('Unlocked <b>' + n.name + '</b> for ' + money(c) + '.', 'buy');
  hideTip();
  renderTree(buy);
  saveGame();
}

function onStageAction(act) {
  if (act === 'allow')   resolvePermission(true);
  if (act === 'deny')    resolvePermission(false);
  if (act === 'approve') approveDiff();
  if (act === 'reject')  rejectDiff();
  if (act === 'fixred')  fixRedBuild();
  if (act === 'shipany') shipAnyway();
  if (act === 'deploy')  startDeploy();
  if (act === 'rules')   { renderRules(); return; }
  $('prompt').focus();
}

/* ==========================================================================
   Game loop. Time passes only while this ticks, so closing the tab, opening
   the menu, or reading the skill tree all pause the run.
   ========================================================================== */
function tick(dt) {
  if (!running || state.ended) return;

  state.elapsed += dt;
  state.cash += state.users * CONFIG.REVENUE_PER_USER * state.valueMult * dt;

  bleedUsers(dt);
  advancePipeline(dt);
  runAgents(dt);
  runRemediation(dt);
  rollForIncident(dt);

  if (checkEnding()) {
    saveGame();
    log('<b>A million users.</b> That is the demo.', 'note');
    renderEnding();
    return;
  }

  autosaveTick(dt, CONFIG.AUTOSAVE_INTERVAL);
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.25, (now - last) / 1000);
  last = now;
  tick(dt);
  unlockWatch();
  render(onStageAction);
  requestAnimationFrame(frame);
}

let lastKey = '';
function unlockWatch() {
  let key = '';
  for (const n of allNodes()) {
    key += (n.count || 0) + (visible(n) ? 'v' : '') + (isMaxed(n) ? 'm' : '') + ',';
  }
  if (key !== lastKey) { lastKey = key; renderTree(buy); }
}

/* ==========================================================================
   Input
   ========================================================================== */
const promptEl = $('prompt');

$('tab-game').onclick   = () => setView('game');
$('tab-skills').onclick = () => setView('skills');

document.addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;

  if ($('rules').style.display === 'flex') {          // reference card is modal
    if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); hideRules(); }
    return;
  }
  if (introOpen()) {
    if (e.key === 'Enter') { e.preventDefault(); advanceIntro(); }
    if (e.key === 'Escape') { e.preventDefault(); endIntro(); }
    return;
  }
  /* Escape on the menu resumes, Escape in play opens it. */
  if ($('menu').style.display === 'flex') {
    if (e.key === 'Escape' && $('menu-continue').style.display !== 'none') {
      e.preventDefault(); $('menu-continue').click();
    }
    return;
  }
  if (!running) return;

  if (e.key === 'Escape') {
    e.preventDefault();
    saveGame();
    showMenu(true);
    return;
  }

  const inPrompt = document.activeElement === promptEl;

  if ((e.key === '1' || e.key === '2') && !(inPrompt && promptEl.value.length)) {
    e.preventDefault();
    setView(e.key === '1' ? 'game' : 'skills');
    return;
  }

  if (state.ended || view !== 'game') return;

  const b = state.build;
  const waiting = b && ['perm', 'review', 'red', 'deploy', 'fixready'].includes(b.stage);

  if (e.key === 'Enter') { e.preventDefault(); advance(); return; }
  if (!waiting) return;

  const k = e.key.toLowerCase();
  if (b.stage === 'perm'   && k === 'y') { e.preventDefault(); resolvePermission(true);  }
  if (b.stage === 'perm'   && k === 'n') { e.preventDefault(); resolvePermission(false); }
  if (b.stage === 'review' && k === 'r') { e.preventDefault(); rejectDiff(); }
  if (b.stage === 'red'    && k === 's') { e.preventDefault(); shipAnyway(); }
});

window.addEventListener('scroll', hideTip, { passive: true });

/* ---- map: drag to pan, scroll to zoom ------------------------------------
   Pointer capture is taken only once a drag has begun; taking it on
   pointerdown retargets the following click to the panel and nothing can be
   bought. "Did we drag" is straight line distance from the press, not summed
   path length, or the jitter in a careful click swallows it. */
const wrap = $('treewrap');
const DRAG_SLOP = 6;
let pressing = false, dragging = false, didDrag = false;
let startX = 0, startY = 0, lastX = 0, lastY = 0, pointerId = null;

wrap.addEventListener('pointerdown', e => {
  if (e.button !== undefined && e.button !== 0) return;
  if (e.target.closest && e.target.closest('#treectl')) return;
  pressing = true; dragging = false; didDrag = false;
  pointerId = e.pointerId;
  startX = lastX = e.clientX;
  startY = lastY = e.clientY;
});

wrap.addEventListener('pointermove', e => {
  if (!pressing || e.pointerId !== pointerId) return;
  if (!dragging) {
    if (Math.hypot(e.clientX - startX, e.clientY - startY) < DRAG_SLOP) return;
    dragging = true; didDrag = true;
    setGrabbing(true);
    hideTip();
    try { wrap.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  }
  const dx = e.clientX - lastX, dy = e.clientY - lastY;
  lastX = e.clientX; lastY = e.clientY;
  panBy(dx, dy);
});

function endDrag() {
  if (!pressing) return;
  if (dragging && pointerId !== null) {
    try { wrap.releasePointerCapture(pointerId); } catch (err) { /* ignore */ }
  }
  pressing = false; dragging = false;
  setGrabbing(false);
  pointerId = null;
}
wrap.addEventListener('pointerup', endDrag);
wrap.addEventListener('pointercancel', endDrag);

wrap.addEventListener('click', e => {
  if (e.target.closest && e.target.closest('#treectl')) return;
  if (didDrag) { e.stopPropagation(); e.preventDefault(); didDrag = false; }
}, true);

wrap.addEventListener('wheel', e => {
  e.preventDefault();
  const r = wrap.getBoundingClientRect();
  const delta = Math.max(-40, Math.min(40, e.deltaY));
  setZoom(getZoom() * Math.exp(-delta * 0.0011), e.clientX - r.left, e.clientY - r.top);
}, { passive: false });

$('zoomin').onclick   = () => setZoom(getZoom() * 1.12);
$('zoomout').onclick  = () => setZoom(getZoom() / 1.12);
$('recenter').onclick = () => recenterTree(true);

if (typeof ResizeObserver !== 'undefined') {
  new ResizeObserver(() => { if (!treeFramed()) recenterTree(); }).observe(wrap);
}
window.addEventListener('resize', () => { if (!treeFramed()) recenterTree(); });

$('fixbtn').onclick   = () => { fixBug(); promptEl.focus(); };
$('rules-close').onclick = hideRules;
$('rules').addEventListener('click', e => { if (e.target === $('rules')) hideRules(); });

$('copybtn').onclick = async () => {
  if (!state.incident) return;
  const text = state.incident.text;
  const btn = $('copybtn');
  const done = () => {
    btn.textContent = 'Copied, now paste it';
    setTimeout(() => { btn.textContent = 'Copy error'; }, 1600);
  };
  try { await navigator.clipboard.writeText(text); done(); return; }
  catch (err) { /* fall through */ }

  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;opacity:0';
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
  ta.remove();
  if (ok) done();
  else {
    btn.textContent = 'Select the text and copy it';
    setTimeout(() => { btn.textContent = 'Copy error'; }, 2200);
  }
  promptEl.focus();
};

/* ---- ending -------------------------------------------------------------- */
$('end-continue').onclick = () => {
  state.ended = false;
  hideEnding();
  saveGame();
  log('Sandbox mode. The goal is behind you, keep going as long as you like.', 'note');
  promptEl.focus();
};
$('end-restart').onclick = () => { hideEnding(); newRun(); showMenu(false); };

/* ---- reset --------------------------------------------------------------- */
const resetBtn = $('reset');
let resetArmed = false, resetTimer = null;
function disarmReset() {
  resetArmed = false;
  resetBtn.classList.remove('armed');
  resetBtn.textContent = 'reset';
  if (resetTimer) { clearTimeout(resetTimer); resetTimer = null; }
}
resetBtn.onclick = () => {
  if (!resetArmed) {
    resetArmed = true;
    resetBtn.classList.add('armed');
    resetBtn.textContent = 'click again to confirm';
    resetTimer = setTimeout(disarmReset, 3000);
    return;
  }
  disarmReset();
  newRun();
};

function newRun() {
  resetState();
  resetTree();
  wipeSave();
  clearLog();
  clearHistory();
  lastKey = '';
  resetStageKey();
  hideTip();
  hideEnding();
  renderTree(buy);
  render(onStageAction);
  log('Fresh repo. Good luck.', 'note');
  promptEl.focus();
}

/* ==========================================================================
   Intro. Three beats, shown once when a new run starts. It exists because a
   new player otherwise lands on a prompt reading "/ship" with no idea why.
   ========================================================================== */
const INTRO = [
  { title: 'You have an app.',
    body: 'Nobody uses it yet. Type /ship and press Enter to build a feature. ' +
          'Every feature you ship brings users, and users pay you.' },
  { title: 'Spend what they pay you.',
    body: 'Cash buys skills on the skill tree, on tab 2. Skills make you ship ' +
          'faster, reach more people, and eventually do the boring parts for you.' },
  { title: 'Everything you ship can break.',
    body: 'Some changes carry a defect. Enough defects and production goes down, ' +
          'and users leave while it is broken. When that happens, copy the error ' +
          'into the prompt and deploy the fix.' },
];
let introStep = 0;

function showIntro() {
  introStep = 0;
  paintIntro();
  $('intro').style.display = 'flex';
}
function paintIntro() {
  const b = INTRO[introStep];
  $('intro-step').textContent  = (introStep + 1) + ' of ' + INTRO.length;
  $('intro-title').textContent = b.title;
  $('intro-body').textContent  = b.body;
  $('intro-next').textContent  = introStep === INTRO.length - 1 ? 'Start' : 'Next';
  $('intro-skip').style.display = introStep === INTRO.length - 1 ? 'none' : '';
}
function advanceIntro() {
  if (introStep < INTRO.length - 1) { introStep++; paintIntro(); return; }
  endIntro();
}
function endIntro() {
  $('intro').style.display = 'none';
  running = true;
  last = performance.now();
  promptEl.focus();
}
const introOpen = () => $('intro').style.display === 'flex';

$('intro-next').onclick = advanceIntro;
$('intro-skip').onclick = endIntro;

/* ==========================================================================
   Main menu
   ========================================================================== */
/* fromGame: the run is already in memory and merely paused, so do NOT reload
   it from disk, that would throw away everything since the last autosave. */
function showMenu(fromGame) {
  running = false;
  const save = fromGame
    ? { ok: true, savedAt: Date.now() }
    : (hasSave() ? loadGame() : { ok: false });
  const cont = $('menu-continue');

  if (save.ok) {
    cont.style.display = '';
    $('menu-save').style.display = '';
    $('menu-save').innerHTML =
      '<b>' + fmt(state.users) + '</b> users, <b>' + fmt(state.features) + '</b> features shipped' +
      (fromGame ? ', paused' : save.savedAt ? ', last played ' + describeAge(save.savedAt) : '');
  } else {
    cont.style.display = 'none';
    $('menu-save').style.display = 'none';
    resetState(); resetTree();
  }

  renderTree(buy);
  render(onStageAction);
  $('menu').style.display = 'flex';
}

function startPlaying() {
  $('menu').style.display = 'none';
  running = true;
  last = performance.now();
  setView('game');
  promptEl.focus();
}

$('menu-continue').onclick = () => {
  startPlaying();
  if (state.incident) log('You left with production down. It still is.', 'incident');
  else log('Welcome back. Time did not pass while you were away.', 'note');
};

$('menu-new').onclick = () => {
  newRun();
  $('menu').style.display = 'none';
  setView('game');
  log('You have an app. It has no users. Type <b>/ship</b> to build something.', 'note');
  showIntro();                      // running stays false until the intro ends
};

$('menu-rules').onclick = () => renderRules();

/* ==========================================================================
   Saving on the way out
   ========================================================================== */
window.addEventListener('beforeunload', () => { if (running && !state.ended) saveGame(); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { if (running) saveGame(); }
  else last = performance.now();
});

/* ==========================================================================
   Boot
   ========================================================================== */
if (!reportConfigProblems()) {
  if (!storageOK) log('This browser blocks local storage, your run will not be saved.', 'note');
  showMenu(false);
  requestAnimationFrame(frame);
}

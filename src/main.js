/* ==========================================================================
   Boot, input wiring and the game loop.
   ========================================================================== */

import { CONFIG, configProblems } from './config.js';
import { state, resetState, money, esc, $ } from './state.js';
import { tree, resetTree, allNodes, nodeById, buyable, costOf, visible, isMaxed } from './tree.js';
import { log, clearLog, clearHistory, histPrompt, histResolve } from './log.js';
import {
  advance, advancePipeline, runAgents, runRemediation,
  resolvePermission, approveDiff, rejectDiff, fixRedBuild, shipAnyway,
  startDeploy, fixBug,
} from './pipeline.js';
import { bleedUsers, rollForIncident } from './incidents.js';
import { checkEnding } from './ending.js';
import {
  render, renderTree, renderStage, resetStageKey, setView, view,
  hideTip, renderEnding, hideEnding,
  recenterTree, setZoom, getZoom, panBy, setGrabbing, treeFramed,
} from './render.js';
import { layoutProblems } from './layout.js';
import { saveGame, loadGame, wipeSave, hasSave, autosaveTick, describeAge, storageOK } from './save.js';

/* Clear the file:// fallback notice. The timer in index.html may already have
   shown it if the modules were slow to arrive over the network, so hide it
   here rather than relying on the timer never firing. */
window.__booted = true;
const bootfail = document.getElementById('bootfail');
if (bootfail) bootfail.style.display = 'none';

/* ==========================================================================
   Config problems are a hard stop — a readable list beats a NaN economy
   ========================================================================== */
function reportConfigProblems() {
  /* Layout gaps are the same class of mistake as a config typo — a skill with
     no coordinates would silently vanish from the map — so they report here. */
  const problems = configProblems.concat(layoutProblems(allNodes().map(n => n.id)));
  if (!problems.length) return false;
  const el = $('configerr');
  el.style.display = 'block';
  el.innerHTML = '<b>Config needs fixing</b> — the game is not running.<ul>' +
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

/* ==========================================================================
   Stage card buttons
   ========================================================================== */
function onStageAction(act) {
  if (act === 'allow')   resolvePermission(true);
  if (act === 'deny')    resolvePermission(false);
  if (act === 'approve') approveDiff();
  if (act === 'reject')  rejectDiff();
  if (act === 'fixred')  fixRedBuild();
  if (act === 'shipany') shipAnyway();
  if (act === 'deploy')  startDeploy();
  $('prompt').focus();
}

/* ==========================================================================
   Game loop. Time only passes while this runs, so closing the tab pauses the
   run — there is no offline progress by design.
   ========================================================================== */
function tick(dt) {
  if (state.ended) return;

  state.elapsed += dt;
  state.cash += state.users * CONFIG.REVENUE_PER_USER * dt;

  bleedUsers(dt);
  advancePipeline(dt);
  runAgents(dt);
  runRemediation(dt);
  rollForIncident(dt);

  if (checkEnding()) {
    saveGame();
    log('<b>Demo goal reached.</b> ' + CONFIG.ENDING_FEATURES + ' features shipped.', 'note');
    renderEnding();
    return;
  }

  if (autosaveTick(dt, CONFIG.AUTOSAVE_INTERVAL)) { /* saved */ }
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.25, (now - last) / 1000);   // clamp so a hidden tab cannot jump
  last = now;
  tick(dt);
  unlockWatch();
  render(onStageAction);
  requestAnimationFrame(frame);
}

/* Rebuild the tree only when the visible shape changes. */
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
  const inPrompt = document.activeElement === promptEl;

  /* 1 / 2 switch pages — ignored mid-typing so they can still be typed. */
  if ((e.key === '1' || e.key === '2') && !(inPrompt && promptEl.value.length)) {
    e.preventDefault();
    setView(e.key === '1' ? 'game' : 'skills');
    return;
  }

  if (e.key === 'Escape' && inPrompt) { promptEl.blur(); return; }
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

/* ---- map: drag to pan, scroll to zoom -------------------------------------
   Pointer events, so a finger drag behaves like a mouse.

   Two things here are load-bearing for clicking to keep working:

   1. Pointer capture is taken only once a drag has actually started. Capturing
      on pointerdown retargets the following click to the panel, so a tile's
      own handler never fires and nothing can be bought.
   2. "Did we drag" is straight-line distance from where the press began, not
      accumulated path length. Summing every jitter of a slow, careful click
      trips a small threshold and swallows the click.
*/
const wrap = $('treewrap');
const DRAG_SLOP = 6;                  // px of travel before a press becomes a pan
let pressing = false, dragging = false, didDrag = false;
let startX = 0, startY = 0, lastX = 0, lastY = 0, pointerId = null;

wrap.addEventListener('pointerdown', e => {
  if (e.button !== undefined && e.button !== 0) return;
  /* The zoom/recenter buttons live inside the pan surface. */
  if (e.target.closest && e.target.closest('#treectl')) return;
  pressing = true; dragging = false; didDrag = false;
  pointerId = e.pointerId;
  startX = lastX = e.clientX;
  startY = lastY = e.clientY;
});

wrap.addEventListener('pointermove', e => {
  if (!pressing || e.pointerId !== pointerId) return;

  if (!dragging) {
    const travelled = Math.hypot(e.clientX - startX, e.clientY - startY);
    if (travelled < DRAG_SLOP) return;          // still a click, not a pan
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

/* Swallow only the click that ends a genuine pan. Capture phase so it lands
   before the tile's handler; controls exempt so they never lose a click. */
wrap.addEventListener('click', e => {
  if (e.target.closest && e.target.closest('#treectl')) return;
  if (didDrag) { e.stopPropagation(); e.preventDefault(); didDrag = false; }
}, true);

/* Zoom scales with how hard the wheel was turned, but gently, and each event
   is capped — trackpads fire a stream of them per gesture and a per-event
   factor compounds into a jump. */
wrap.addEventListener('wheel', e => {
  e.preventDefault();
  const r = wrap.getBoundingClientRect();
  const delta = Math.max(-40, Math.min(40, e.deltaY));
  const factor = Math.exp(-delta * 0.0011);
  setZoom(getZoom() * factor, e.clientX - r.left, e.clientY - r.top);
}, { passive: false });

$('zoomin').onclick    = () => setZoom(getZoom() * 1.12);
$('zoomout').onclick   = () => setZoom(getZoom() / 1.12);
$('recenter').onclick  = () => recenterTree(true);   // reset framing AND zoom

/* The map cannot be framed until it has a measurable width, which may be a
   frame or two after the panel first becomes visible. Watch for that rather
   than guessing when it happens. */
if (typeof ResizeObserver !== 'undefined') {
  new ResizeObserver(() => { if (!treeFramed()) recenterTree(); }).observe(wrap);
}
window.addEventListener('resize', () => { if (!treeFramed()) recenterTree(); });

$('fixbtn').onclick = () => { fixBug(); promptEl.focus(); };

$('copybtn').onclick = async () => {
  if (!state.incident) return;
  const text = state.incident.text;
  const btn = $('copybtn');
  const done = () => {
    btn.textContent = 'Copied — now paste it';
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

/* ---- ending buttons ----------------------------------------------------- */
$('end-continue').onclick = () => {
  state.ended = false;
  hideEnding();
  saveGame();
  log('Sandbox mode — the goal is behind you, keep going as long as you like.', 'note');
  promptEl.focus();
};
$('end-restart').onclick = () => { hideEnding(); newRun(); };

/* ---- reset (two-step; confirm() is auto-dismissed in some embedded views) -- */
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
   Save on the way out. Time pauses when you leave, so this is only about not
   losing the last few seconds of progress.
   ========================================================================== */
window.addEventListener('beforeunload', () => { if (!state.ended) saveGame(); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) saveGame();
  else last = performance.now();      // no dt jump on return
});

/* ==========================================================================
   Boot
   ========================================================================== */
if (!reportConfigProblems()) {
  const had = hasSave();
  const res = had ? loadGame() : { ok: false };

  renderTree(buy);
  setView('game');
  render(onStageAction);

  if (res.ok) {
    log('Run restored — last played ' + describeAge(res.savedAt) + '. ' +
        'Time does not pass while you are away.', 'note');
    if (state.incident) log('You left with production down. It still is.', 'incident');
    if (state.ended) renderEnding();
  } else {
    if (had) log('Saved run could not be read (' + esc(res.reason) + ') — starting fresh.', 'note');
    log('You have an app. It has no users. Type <b>/add</b> to ship something.', 'note');
  }

  if (!storageOK) log('This browser blocks local storage — your run will not be saved.', 'note');

  promptEl.focus();
  requestAnimationFrame(frame);
}

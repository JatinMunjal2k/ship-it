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
   Pointer events so a finger drag works the same as a mouse. A drag that moves
   more than a few pixels swallows the click, so panning across the map never
   buys the skill you happened to start on. */
const wrap = $('treewrap');
let dragging = false, dragMoved = 0, lastX = 0, lastY = 0, pointerId = null;

wrap.addEventListener('pointerdown', e => {
  if (e.button !== undefined && e.button !== 0) return;
  /* The zoom/recenter buttons live inside the pan surface, so pressing one
     would otherwise start a drag and then have its click swallowed. */
  if (e.target.closest && e.target.closest('#treectl')) return;
  dragging = true; dragMoved = 0; pointerId = e.pointerId;
  lastX = e.clientX; lastY = e.clientY;
  setGrabbing(true);
  /* Capture keeps a fast drag from escaping the panel. It can throw if the
     pointer is already gone, and losing it only costs us capture, not panning. */
  try { wrap.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
});

wrap.addEventListener('pointermove', e => {
  if (!dragging || e.pointerId !== pointerId) return;
  const dx = e.clientX - lastX, dy = e.clientY - lastY;
  lastX = e.clientX; lastY = e.clientY;
  dragMoved += Math.abs(dx) + Math.abs(dy);
  if (dragMoved > 3) hideTip();
  panBy(dx, dy);
});

function endDrag() {
  if (!dragging) return;
  dragging = false;
  setGrabbing(false);
  if (pointerId !== null) {
    try { wrap.releasePointerCapture(pointerId); } catch (err) { /* ignore */ }
  }
  pointerId = null;
}
wrap.addEventListener('pointerup', endDrag);
wrap.addEventListener('pointercancel', endDrag);

/* Suppress the click that ends a real drag, so panning across the map never
   buys a skill. Capture phase, so it lands before the tile's own handler.
   The controls are exempt: they never start a drag, so they never reset the
   counter, and would otherwise eat their first click after every pan. */
wrap.addEventListener('click', e => {
  if (e.target.closest && e.target.closest('#treectl')) return;
  if (dragMoved > 4) { e.stopPropagation(); e.preventDefault(); dragMoved = 0; }
}, true);

wrap.addEventListener('wheel', e => {
  e.preventDefault();
  const r = wrap.getBoundingClientRect();
  const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
  setZoom(getZoom() * factor, e.clientX - r.left, e.clientY - r.top);
}, { passive: false });

$('zoomin').onclick    = () => setZoom(getZoom() * 1.18);
$('zoomout').onclick   = () => setZoom(getZoom() / 1.18);
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

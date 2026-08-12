/* ==========================================================================
   The build pipeline — the thing the player actually operates.

     /add → think → [perm] → [review] → [test → [red] → [autofix]]
                  → [deploy] → deploying → shipped

   Bracketed stages are chores the Workflow branch deletes. `test` only exists
   once Unit tests is owned; before that a defect goes straight to production
   and you never see it happen. `deploying` is always a timer, so Continuous
   delivery removes the click but never the wait.

   To add a stage: add it to the machine in advancePipeline (timed) or give it
   a button in render.js (waits on the player), and add a card for it.
   ========================================================================== */

import { CONFIG } from './config.js';
import {
  state, quality, hasTests, catchRate, usersPerFeature, userCap, agentInterval,
  thinkTime, testTime, autofixTime, deployTime, repairTime, fmt, esc, $,
} from './state.js';
import { FEATURES, FILES, RISKS, SAFE_CMDS, DANGER_CMDS, BUGS, pick, rint } from './flavor.js';
import { log, flash, histPrompt, histPending, histResolve } from './log.js';
import { completeFixDeploy, errorMatches } from './incidents.js';

/* Stages that run on a clock. Anything else is waiting on the player. */
export const TIMED_STAGES = ['think', 'test', 'autofix', 'work', 'deploying'];

let buildSeq = 0;

/* ---- starting work ------------------------------------------------------- */
export function startBuild(text) {
  const entry = histPrompt(text);
  const total = thinkTime();

  let perm = null;
  if (Math.random() < CONFIG.PERMISSION_CHANCE) {
    const danger = Math.random() < CONFIG.DANGEROUS_SHARE;
    perm = { cmd: danger ? pick(DANGER_CMDS) : pick(SAFE_CMDS), danger, done: false };
  }

  state.build = {
    id: ++buildSeq, kind: 'feature', stage: 'think', timer: total, total,
    entry, perm, diff: null, defective: null,
  };
}

function makeDiff() {
  const risky = Math.random() < CONFIG.RISKY_DIFF_CHANCE;
  return {
    file: pick(FILES), add: rint(8, 240), del: rint(0, 90),
    risky, reason: risky ? pick(RISKS) : null, name: pick(FEATURES),
  };
}

const diffQuality = d => d && d.risky ? quality() * CONFIG.RISKY_QUALITY_MULT : quality();

/* ---- stage transitions -------------------------------------------------- */
export function resolvePermission(allow) {
  const b = state.build;
  if (!b || b.stage !== 'perm') return;
  const p = b.perm;
  p.done = true;

  if (!allow) {
    if (p.danger) {
      histResolve(b.entry, '<span class="ok">Denied <code>' + esc(p.cmd) +
                           '</code>. Good catch.</span>');
      log('Denied <b>' + esc(p.cmd) + '</b> — disaster averted.', 'fix');
    } else {
      histResolve(b.entry, '<span class="warn">Denied <code>' + esc(p.cmd) +
                           '</code>. Claude could not continue.</span>');
    }
    state.build = null;
    return;
  }

  if (p.danger) {
    state.disasters++;
    const lost = Math.floor(state.users * CONFIG.DANGEROUS_USER_LOSS);
    state.users -= lost;
    state.usersLost += lost;
    log('You approved <b>' + esc(p.cmd) + '</b>. <span style="color:var(--warn)">−' +
        fmt(lost) + ' users.</span> It ran instantly and completely.', 'oops');
    flash('oops');
  }
  b.stage = 'think';
}

function afterThink() {
  const b = state.build;
  b.diff = makeDiff();
  /* the defect roll happens once, here, and is hidden from the player */
  b.defective = Math.random() >= diffQuality(b.diff);
  if (state.autoAccept) afterReview();
  else { b.stage = 'review'; histPending(b.entry, 'diff ready — waiting for review'); }
}

function afterReview() {
  const b = state.build;
  if (!hasTests()) return toDeployGate();
  b.stage = 'test';
  b.timer = b.total = testTime();
  histPending(b.entry, 'running tests…');
}

function afterTest() {
  const b = state.build;
  const caught = b.defective && Math.random() < catchRate();
  if (!caught) return toDeployGate();      // green, or a defect that slipped past

  if (state.ci) {
    b.stage = 'autofix';
    b.timer = b.total = autofixTime();
    histPending(b.entry, 'CI is repairing the build…');
    return;
  }
  b.stage = 'red';
  b.failing = rint(1, 6);
  histPending(b.entry, b.failing + ' tests failing — waiting on you');
}

/* Move to the deploy gate. The stage is set FIRST because startDeploy() only
   accepts a build already sitting at its gate — calling it from the previous
   stage silently does nothing and the build hangs forever. */
function toDeployGate() {
  const b = state.build;
  b.stage = 'deploy';
  histPending(b.entry, 'waiting for deploy');
  if (state.cd) startDeploy();
}

export function startDeploy() {
  const b = state.build;
  if (!b) return;
  if (b.kind === 'feature' && b.stage !== 'deploy') return;
  if (b.kind === 'repair'  && b.stage !== 'fixready') return;
  b.stage = 'deploying';
  b.timer = b.total = deployTime();
  histPending(b.entry, b.kind === 'repair' ? 'deploying the fix…' : 'deploying…');
}

function completeBuild(b) {
  state.build = null;
  state.features++;

  const room   = Math.max(0, userCap() - state.users);
  const gained = Math.min(usersPerFeature(), room);
  state.users += gained;
  if (b.defective) state.bugs++;

  const tail = gained > 0
    ? '<span class="ok">deployed · +' + gained + ' users</span>'
    : '<span class="warn">deployed · at capacity, no new users</span>';
  /* only mention the defect if monitoring would have shown it anyway */
  const flag = b.defective && state.monitoring ? ' <span class="bad">(defect shipped)</span>' : '';
  histResolve(b.entry, esc(b.diff.name) + ' <span style="color:var(--dimmer)">·</span> ' +
              tail + flag);
}

function finishBugfix(b) {
  state.bugs = Math.max(0, state.bugs - 1);
  state.build = null;
  histResolve(b.entry, '<span class="ok">Fixed: ' + esc(pick(BUGS)) + '.</span>');
}

/* ---- player verbs ------------------------------------------------------- */
export function advance() {
  const b = state.build;
  if (!b) { if (state.incident) submitRepair(); else submitCommand(); return; }
  if (b.stage === 'perm')     return resolvePermission(true);
  if (b.stage === 'review')   return approveDiff();
  if (b.stage === 'red')      return fixRedBuild();
  if (b.stage === 'deploy')   return startDeploy();
  if (b.stage === 'fixready') return startDeploy();
}

export function approveDiff() {
  const b = state.build;
  if (!b || b.stage !== 'review') return;
  afterReview();
}

export function rejectDiff() {
  const b = state.build;
  if (!b || b.stage !== 'review') return;
  histResolve(b.entry, '<span class="warn">Rejected the diff. Nothing shipped.</span>');
  state.build = null;
}

export function fixRedBuild() {
  const b = state.build;
  if (!b || b.stage !== 'red') return;
  b.stage = 'autofix';
  b.timer = b.total = autofixTime();
  histPending(b.entry, 'fixing the failing tests…');
}

export function shipAnyway() {
  const b = state.build;
  if (!b || b.stage !== 'red') return;
  toDeployGate();                    // defective stays true
}

/* /add builds a feature, until Enter-to-build is owned */
export function submitCommand() {
  const raw = $('prompt').value.trim();
  if (state.build || state.incident) return;

  if (!raw) {
    if (state.quickAdd) { startBuild('/add'); $('prompt').value = ''; return; }
    histResolve(histPrompt(''), '<span class="warn">Type <code>/add</code> to build a feature.</span>');
    return;
  }

  const m = raw.match(/^\/add\b\s*(.*)$/i);
  if (!m) {
    histResolve(histPrompt(raw), '<span class="bad">Unknown command. Use <code>/add</code>' +
                (state.quickAdd ? ', or just press Enter' : '') + '.</span>');
    $('prompt').value = '';
    return;
  }

  startBuild(m[1] ? '/add ' + m[1] : '/add');
  $('prompt').value = '';
}

export function submitRepair() {
  const text = $('prompt').value.trim();
  if (!state.incident || state.build || !text) return;
  if (errorMatches(text, state.incident)) {
    const entry = histPrompt(text);
    state.build = { id: ++buildSeq, kind: 'repair', stage: 'work',
                    timer: repairTime(), total: repairTime(), entry };
  } else {
    histResolve(histPrompt(text), '<span class="bad">Production is on fire. Paste the ' +
                'error message above — exactly as written — to fix it.</span>');
  }
  $('prompt').value = '';
}

export function fixBug() {
  if (state.build || state.incident || state.bugs <= 0) return;
  const entry = histPrompt('/fix');
  state.build = { id: ++buildSeq, kind: 'bugfix', stage: 'work',
                  timer: autofixTime(), total: autofixTime(), entry };
}

/* ---- the clock ---------------------------------------------------------- */
export function advancePipeline(dt) {
  let b = state.build;
  if (!b) return;
  if (state.incident && b.kind === 'feature') return;   // frozen while prod is down
  if (!TIMED_STAGES.includes(b.stage)) return;          // waiting on a decision

  b.timer -= dt;

  // the permission ask interrupts thinking halfway through
  if (b.stage === 'think' && b.perm && !b.perm.done && b.timer <= b.total * 0.5) {
    if (state.skipPerms) {
      b.stage = 'perm';                                 // resolvePermission expects this
      resolvePermission(true);
    } else if (state.allowlist && !b.perm.danger) {
      b.perm.done = true;
    } else {
      b.stage = 'perm';
      histPending(b.entry, 'waiting for permission');
      return;
    }
    b = state.build;
    if (!b || b.stage !== 'think') return;
  }

  if (b.timer > 0) return;

  if (b.stage === 'deploying') {
    if (b.kind === 'repair') return completeFixDeploy(b);
    return completeBuild(b);
  }
  if (b.kind === 'bugfix') return finishBugfix(b);
  if (b.kind === 'repair') {                            // fix written, needs deploying
    b.stage = 'fixready';                               // set the gate before deploying
    histPending(b.entry, 'fix written — waiting for deploy');
    if (state.cd) startDeploy();
    return;
  }
  if (b.stage === 'think')   return afterThink();
  if (b.stage === 'test')    return afterTest();
  if (b.stage === 'autofix') { b.defective = false; return toDeployGate(); }
}

/* ---- agents ------------------------------------------------------------- */
/* Agents bypass the pipeline entirely. Their defects are only screened once CI
   is owned — without it, automation buries you, which is the whole point of
   the Workflow/Testing investment. */
export function runAgents(dt) {
  if (state.agents <= 0) return;
  state.agentTimer += dt * state.agents;

  let guard = 0;
  while (state.agentTimer >= agentInterval() && guard++ < 500) {
    state.agentTimer -= agentInterval();

    state.features++;
    state.agentFeatures++;

    const room = Math.max(0, userCap() - state.users);
    state.users += Math.min(usersPerFeature(), room);

    if (Math.random() >= quality()) {
      const screened = state.ci && hasTests() && Math.random() < catchRate();
      if (screened) state.agentCaught++;
      else { state.bugs++; state.agentBugs++; }
    }
  }
}

/* Auto-remediation: the only bug sink that scales with investment. */
export function runRemediation(dt) {
  if (state.remediation <= 0 || state.bugs <= 0) return;
  state.remediationTimer += dt * state.remediation;
  let guard = 0;
  while (state.remediationTimer >= CONFIG.REMEDIATION_INTERVAL && state.bugs > 0 && guard++ < 500) {
    state.remediationTimer -= CONFIG.REMEDIATION_INTERVAL;
    state.bugs--;
    state.autoFixed++;
  }
}

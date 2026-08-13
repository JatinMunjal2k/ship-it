/* ==========================================================================
   Production incidents.

   An incident freezes all feature work and bleeds users until a fix has been
   written AND deployed. A rare few are non-reproducible: they survive their
   first deploy and come back wearing a different error, so the next attempt
   needs a fresh copy paste.

   How many deploys a non-reproducible bug will take is never shown. The player
   finds out the way you actually find out, by deploying a fix and watching
   production stay down.

   Imports nothing from pipeline.js, only state, so the two stay free of a cycle.
   ========================================================================== */

import { CONFIG } from './config.js';
import { state, fmt, esc, bleedRate } from './state.js';
import { drawError, drawNotHeld, rint } from './flavor.js';
import { log, flash, histPending, histResolve } from './log.js';

export function triggerIncident() {
  if (state.incident) return;
  state.incidents++;

  /* Park any feature work. Leaving it in state.build would block the repair
     prompt, which is the only way out of an incident, a hard deadlock. */
  if (state.build && state.build.kind === 'feature') {
    state.stashed = state.build;
    state.build = null;
    histPending(state.stashed.entry, 'paused, production is down');
  }

  const nonRepro = Math.random() < CONFIG.NON_REPRO_CHANCE;
  const lo = Math.max(1, Math.floor(CONFIG.NON_REPRO_DEPLOYS_MIN));
  const hi = Math.max(lo, Math.floor(CONFIG.NON_REPRO_DEPLOYS_MAX));
  const code = 'ERR-' + rint(1000, 9999);
  const msg  = drawError();

  state.incident = {
    msg, code, text: msg + ' [' + code + ']',
    deploysNeeded: nonRepro ? rint(lo, hi) : 1,
    deploysMade: 0,
    /* only true once the player has seen a fix fail, never before */
    revealed: false,
  };

  const l = Math.min(CONFIG.INCIDENT_MIN_LOSS, CONFIG.INCIDENT_MAX_LOSS);
  const h = Math.max(CONFIG.INCIDENT_MIN_LOSS, CONFIG.INCIDENT_MAX_LOSS);
  const lost = Math.min(state.users, Math.ceil(state.users * (l + Math.random() * (h - l))));
  state.users -= lost;
  state.usersLost += lost;

  log('INCIDENT ' + code + ', <span style="color:var(--bad)">' + fmt(lost) +
      ' users gone</span>, and bleeding until a fix is deployed.', 'incident');
  flash('incident');

  if (state.incidents === 1) {
    log('Paste the error to write a fix, then <b>deploy it</b>. Nothing else moves until you do.',
        'note');
  }
}

/* Lenient on purpose: the ERR code alone counts, and extra text around a full
   paste is fine. You still have to copy something. */
export function errorMatches(input, inc) {
  const norm = s => s.toLowerCase().replace(/\s+/g, ' ').trim();
  const a = norm(input);
  if (!a) return false;
  if (a.includes(inc.code.toLowerCase())) return true;
  return a.includes(norm(inc.msg));
}

/* A deployed fix, which may not be enough. */
export function completeFixDeploy(b) {
  const inc = state.incident;
  state.build = null;
  if (!inc) return;

  inc.deploysMade++;
  if (inc.deploysMade < inc.deploysNeeded) {
    /* Now the player knows. The alert changes character from here on. */
    inc.revealed = true;
    inc.code = 'ERR-' + rint(1000, 9999);
    inc.msg  = drawError();
    inc.text = inc.msg + ' [' + inc.code + ']';

    histResolve(b.entry, '<span class="bad">' + drawNotHeld() + '</span>');
    log('Fix deployed. <b>Still down.</b> This one is not reproducible.', 'incident');
    flash('incident');
    return;                         // stash stays parked, incident stays live
  }

  state.incident = null;

  /* An outage forces a proper fix, so it clears a share of the backlog rather
     than a single symptom. This is what keeps bug count from growing without
     bound before the late game sinks are affordable. */
  const cleared = Math.min(state.bugs,
                           Math.max(1, Math.floor(state.bugs * CONFIG.INCIDENT_BUG_CLEAR_FRACTION)));
  state.bugs -= cleared;

  // pick the parked feature work back up, exactly where it stopped
  state.build = state.stashed || null;
  state.stashed = null;
  if (state.build) histPending(state.build.entry, 'resumed');

  histResolve(b.entry, '<span class="ok">Deployed. ' + esc(inc.code) +
                       ' resolved, service restored.</span>');
  log('Incident ' + inc.code + ' resolved after ' + inc.deploysMade +
      ' deploy' + (inc.deploysMade === 1 ? '' : 's') +
      (state.seeBugs ? ', <b>' + cleared + '</b> bug' + (cleared === 1 ? '' : 's') +
       ' cleared' : '') + '.', 'fix');
}

/* Continuous churn while production is broken. */
export function bleedUsers(dt) {
  if (!state.incident || state.users <= 0) return;
  const before = state.users;
  state.users = Math.max(0, state.users * (1 - bleedRate() * dt));
  state.usersLost += before - state.users;
}

export function rollForIncident(dt) {
  if (state.bugs <= 0 || state.users <= 0 || state.incident) return;
  const p = 1 - Math.pow(1 - CONFIG.INCIDENT_CHANCE_PER_BUG, state.bugs * dt);
  if (Math.random() < p) triggerIncident();
}

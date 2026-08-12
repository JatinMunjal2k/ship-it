/* ==========================================================================
   Run state, and every number derived from it.

   `state` is a mutable singleton rather than a reassigned binding, because ES
   modules export live bindings that importers cannot reassign. Reset mutates
   it in place so every module keeps pointing at the same object.

   Skills only ever write *modifiers* here (buildMult, qualityBonus, ...), never
   absolute values. That is what lets config.js changes re-derive everything
   already unlocked.
   ========================================================================== */

import { CONFIG } from './config.js';

export function freshState() {
  return {
    users: 0, cash: 0, features: 0, bugs: 0,

    qualityBonus: 0, capBonus: 0,
    buildMult: 1, buildFlat: 0, repairMult: 1,
    agentIntervalMult: 1, bleedMult: 1,
    agents: 0, monitoring: false,

    quickAdd: false, autoAccept: false, allowlist: false,
    skipPerms: false, ci: false, cd: false,
    testLevel: 0,            // 0 none, 1 unit, 2 integration, 3 e2e
    remediation: 0,          // Auto-remediation levels — the only scaling bug sink

    agentTimer: 0, agentFeatures: 0, agentBugs: 0, agentCaught: 0,
    remediationTimer: 0, autoFixed: 0,

    build: null,             // active pipeline run (holds a DOM ref — never saved)
    stashed: null,           // feature work parked while an incident is live
    incident: null,

    incidents: 0, usersLost: 0, disasters: 0, elapsed: 0,
    ended: false,            // demo goal reached
    saveTimer: 0,
  };
}

export const state = freshState();

export function resetState() {
  for (const k in state) delete state[k];
  Object.assign(state, freshState());
}

/* ---- derived values, recomputed on demand so config edits stay live ------- */
export const quality       = () => Math.max(0, Math.min(0.99, CONFIG.BASE_QUALITY + state.qualityBonus));
export const userCap       = () => Math.max(1, CONFIG.BASE_USER_CAP + state.capBonus);
export const agentInterval = () => Math.max(0.05, CONFIG.AGENT_INTERVAL * state.agentIntervalMult);
export const thinkTime     = () => Math.max(CONFIG.THINK_TIME_MIN,
                                            CONFIG.THINK_TIME_START * state.buildMult) + state.buildFlat;
export const testTime      = () => Math.max(0.1, CONFIG.TEST_TIME    * state.buildMult);
export const autofixTime   = () => Math.max(0.1, CONFIG.AUTOFIX_TIME * state.buildMult);
export const deployTime    = () => Math.max(0.1, CONFIG.DEPLOY_TIME  * state.buildMult);
export const repairTime    = () => Math.max(CONFIG.REPAIR_TIME_MIN,
                                            CONFIG.REPAIR_TIME_START * state.repairMult);
export const bleedRate     = () => Math.max(0, CONFIG.INCIDENT_BLEED * state.bleedMult);

export const hasTests  = () => state.testLevel > 0;
export const catchRate = () => [0, CONFIG.CATCH_RATE_UNIT, CONFIG.CATCH_RATE_INTEGRATION,
                                CONFIG.CATCH_RATE_E2E][state.testLevel] || 0;

export const atThinkFloor  = () => CONFIG.THINK_TIME_START  * state.buildMult  <= CONFIG.THINK_TIME_MIN  + 1e-9;
export const atRepairFloor = () => CONFIG.REPAIR_TIME_START * state.repairMult <= CONFIG.REPAIR_TIME_MIN + 1e-9;

export function usersPerFeature() {
  const a = Math.floor(CONFIG.USERS_PER_FEATURE_MIN), b = Math.floor(CONFIG.USERS_PER_FEATURE_MAX);
  const lo = Math.max(0, Math.min(a, b)), hi = Math.max(0, Math.max(a, b));
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

export function phaseName() {
  if (state.users < 100)   return 'Garage';
  if (state.users < 1000)  return 'Traction';
  if (state.users < 10000) return 'Scale';
  return 'Enterprise';
}

/* ---- formatting ---------------------------------------------------------- */
export function fmt(n) {
  n = Math.floor(n);
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(n);
}
export function money(n) {
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
  return '$' + Math.floor(n);
}
export const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
export const $ = id => document.getElementById(id);

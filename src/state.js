/* ==========================================================================
   Run state, and every number derived from it.

   `state` is a mutable singleton rather than a reassigned binding, because ES
   modules export live bindings that importers cannot reassign. Reset mutates
   it in place so every module keeps pointing at the same object.

   Skills only ever write *modifiers* here (buildMult, userGainMult, ...), never
   absolute values. That is what lets a config.js change re-derive everything
   already unlocked.
   ========================================================================== */

import { CONFIG } from './config.js';

export function freshState() {
  return {
    users: 0, cash: 0, features: 0, bugs: 0,

    /* modifiers, all written only by skills */
    qualityBonus: 0,          // + to BASE_QUALITY
    capBonus: 0,              // + flat capacity
    capMult: 1,               // x capacity, from the percentage skills
    valueMult: 1,             // x revenue per user
    userGainMult: 1,          // x users per shipped feature
    viralRate: 0,             // share of your existing users a feature brings back
    minUsersBonus: 0,         // + to the low end of the users-per-feature roll
    buildMult: 1, buildFlat: 0,
    repairMult: 1,
    agentIntervalMult: 1,     // x agent seconds per feature
    agentShareMult: 1,        // x how much an agent feature is worth
    bleedMult: 1,

    agents: 0,
    testLevel: 0,             // 0 none, 1 unit, 2 integration, 3 e2e
    remediation: 0,

    /* unlocked capabilities */
    quickShip: false,         // Enter alone runs /ship
    autoAccept: false, allowlist: false, skipPerms: false,
    ci: false, cd: false,
    seeBugs: false,           // the open bug count is visible
    canFixBugs: false,        // the manual fix action exists
    seeQuality: false,        // the code quality stat is visible

    agentTimer: 0, agentFeatures: 0, agentBugs: 0, agentCaught: 0,
    remediationTimer: 0, autoFixed: 0,

    build: null,              // active pipeline run (holds a DOM ref, never saved)
    stashed: null,            // feature work parked while an incident is live
    incident: null,

    incidents: 0, usersLost: 0, disasters: 0, elapsed: 0,
    ended: false,
    saveTimer: 0,
  };
}

export const state = freshState();

export function resetState() {
  for (const k in state) delete state[k];
  Object.assign(state, freshState());
}

/* ---- derived values, recomputed on demand so config edits stay live ------- */
export const quality        = () => Math.max(0, Math.min(0.99, CONFIG.BASE_QUALITY + state.qualityBonus));
export const userCap        = () => Math.max(1, Math.floor((CONFIG.BASE_USER_CAP + state.capBonus) * state.capMult));
export const revenuePerUser = () => CONFIG.REVENUE_PER_USER * state.valueMult;
export const income         = () => state.users * revenuePerUser();

export const agentInterval  = () => Math.max(0.2, CONFIG.AGENT_INTERVAL * state.agentIntervalMult);
/* An agent feature is worth less than one you shipped by hand. The Agents
   branch raises this toward parity but never past it. */
export const agentShare     = () => Math.min(1, CONFIG.AGENT_USER_MULT * state.agentShareMult);

export const thinkTime   = () => Math.max(CONFIG.THINK_TIME_MIN,
                                          CONFIG.THINK_TIME_START * state.buildMult) + state.buildFlat;
export const testTime    = () => Math.max(0.1, CONFIG.TEST_TIME    * state.buildMult);
export const autofixTime = () => Math.max(0.1, CONFIG.AUTOFIX_TIME * state.buildMult);
export const deployTime  = () => Math.max(0.1, CONFIG.DEPLOY_TIME  * state.buildMult);
export const repairTime  = () => Math.max(CONFIG.REPAIR_TIME_MIN,
                                          CONFIG.REPAIR_TIME_START * state.repairMult);
export const bleedRate   = () => Math.max(0, CONFIG.INCIDENT_BLEED * state.bleedMult);

export const hasTests  = () => state.testLevel > 0;
export const catchRate = () => [0, CONFIG.CATCH_RATE_UNIT, CONFIG.CATCH_RATE_INTEGRATION,
                                CONFIG.CATCH_RATE_E2E][state.testLevel] || 0;

export const atThinkFloor  = () => CONFIG.THINK_TIME_START  * state.buildMult  <= CONFIG.THINK_TIME_MIN  + 1e-9;
export const atRepairFloor = () => CONFIG.REPAIR_TIME_START * state.repairMult <= CONFIG.REPAIR_TIME_MIN + 1e-9;

/* Users a feature attracts.
 *
 * Two parts, and the second is what makes the game finishable. A flat roll
 * alone is linear growth, while churn takes a percentage of the base, so the
 * two meet at an equilibrium of a few hundred users no matter how fast you
 * ship. The viral share makes each feature bring in a fraction of the users
 * you already have, which compounds and can outrun churn.
 *
 * Agent output is worth a fraction of yours, on both parts.
 */
export function usersPerFeature(byAgent) {
  const lo = Math.floor(CONFIG.USERS_PER_FEATURE_MIN) + state.minUsersBonus;
  const hi = Math.max(lo, Math.floor(CONFIG.USERS_PER_FEATURE_MAX) + state.minUsersBonus);
  const roll = lo + Math.floor(Math.random() * (hi - lo + 1));

  const flat  = roll * state.userGainMult;
  const viral = state.users * state.viralRate;
  const total = (flat + viral) * (byAgent ? agentShare() : 1);
  return Math.max(byAgent ? 0 : 1, Math.round(total));
}

export function phaseName() {
  if (state.users < 1000)    return 'Garage';
  if (state.users < 25000)   return 'Traction';
  if (state.users < 250000)  return 'Scale';
  return 'Enterprise';
}

/* Fraction of capacity in use, for the colour of the users readout. */
export const capacityUse = () => state.users / userCap();

/* ---- formatting ---------------------------------------------------------- */
export function fmt(n) {
  n = Math.floor(n);
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(n);
}
export function money(n) {
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
  return '$' + Math.floor(n);
}

/* Cash and income need decimals at the bottom of the range. Early income is a
   few users times a few cents, so flooring it reports a healthy trickle as a
   flat $0/s and the whole economy looks broken. Skill costs keep money(). */
export function moneyFine(n) {
  if (n >= 1000) return money(n);
  if (n >= 10)   return '$' + n.toFixed(0);
  if (n >= 1)    return '$' + n.toFixed(1);
  return '$' + n.toFixed(2);
}
/* "20% less time" reads better than "x0.8" for anyone who is not tuning it. */
export const lessTime = mult => Math.round((1 - mult) * 100) + '% less time';
export const morePct  = mult => '+' + Math.round((mult - 1) * 100) + '%';

export const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
export const $ = id => document.getElementById(id);

/* ==========================================================================
   Flattens the sectioned config file into the single object the game reads,
   and validates it on the way through. A typo in config.js should produce a
   readable list on screen, not a NaN economy.
   ========================================================================== */

import GAME_CONFIG from '../config.js';

export const REQUIRED_KEYS = [
  'USERS_PER_FEATURE_MIN', 'USERS_PER_FEATURE_MAX', 'REVENUE_PER_USER', 'BASE_USER_CAP',
  'BASE_QUALITY', 'RISKY_DIFF_CHANCE', 'RISKY_QUALITY_MULT',
  'CATCH_RATE_UNIT', 'CATCH_RATE_INTEGRATION', 'CATCH_RATE_E2E',
  'THINK_TIME_START', 'THINK_TIME_MIN', 'TEST_TIME', 'AUTOFIX_TIME', 'DEPLOY_TIME',
  'PERMISSION_CHANCE', 'DANGEROUS_SHARE', 'DANGEROUS_USER_LOSS',
  'AGENT_INTERVAL',
  'INCIDENT_CHANCE_PER_BUG', 'INCIDENT_MIN_LOSS', 'INCIDENT_MAX_LOSS', 'INCIDENT_BLEED',
  'REPAIR_TIME_START', 'REPAIR_TIME_MIN',
  'STUBBORN_CHANCE', 'STUBBORN_DEPLOYS_MIN', 'STUBBORN_DEPLOYS_MAX',
  'INCIDENT_BUG_CLEAR_FRACTION', 'REMEDIATION_INTERVAL',
  'ENDING_FEATURES',
  'AUTOSAVE_INTERVAL',
];

/* Collects every problem rather than stopping at the first, so one refresh
   tells you everything to fix. */
export function loadConfigFrom(src) {
  const config = {}, problems = [], seenIn = {};

  if (!src || typeof src !== 'object') {
    return { config, problems: ['config.js did not load. It must sit next to index.html.'] };
  }

  for (const section in src) {
    const group = src[section];
    if (!group || typeof group !== 'object') {
      problems.push(`Section "${section}" is not an object.`);
      continue;
    }
    for (const key in group) {
      if (key in config) {
        problems.push(`"${key}" appears in both "${seenIn[key]}" and "${section}". ` +
                      'Keep it in one section.');
        continue;
      }
      const v = group[key];
      if (typeof v !== 'number' || !Number.isFinite(v)) {
        problems.push(`"${key}" in "${section}" is not a finite number: ${v}`);
        continue;
      }
      config[key] = v;
      seenIn[key] = section;
    }
  }

  for (const k of REQUIRED_KEYS) {
    if (!(k in config)) problems.push(`"${k}" is missing from config.js.`);
  }
  for (const k in config) {
    if (!REQUIRED_KEYS.includes(k)) {
      problems.push(`"${k}" in config.js is not a setting the game reads.`);
    }
  }

  return { config, problems };
}

const loaded = loadConfigFrom(GAME_CONFIG);

export const CONFIG = loaded.config;
export const configProblems = loaded.problems;

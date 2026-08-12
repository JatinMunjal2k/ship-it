/* ==========================================================================
   Saving a run to this browser.

   There is no offline progress by design: time pauses when you leave. Nothing
   here reads a wall clock to award anything — the timestamp is stored only so
   the UI can say when you last played.

   In-flight pipeline work is deliberately not saved. `build` holds a live DOM
   reference, and a half-finished build is not worth the serialisation dance.
   A live incident IS saved, so quitting mid-outage means coming back to it.
   ========================================================================== */

import { state, freshState, resetState } from './state.js';
import { tree, allNodes, resetTree } from './tree.js';

const KEY = 'shipit.save.v1';

/* Only these are restored, so a stale or hand-edited save cannot inject keys. */
const SAVED_FIELDS = Object.keys(freshState()).filter(
  k => !['build', 'stashed', 'saveTimer'].includes(k)
);

export let storageOK = true;

export function saveGame() {
  try {
    const snapshot = {};
    for (const k of SAVED_FIELDS) snapshot[k] = state[k];

    const skills = {};
    for (const n of allNodes()) if (n.count) skills[n.id] = n.count;

    localStorage.setItem(KEY, JSON.stringify({ v: 1, savedAt: Date.now(), state: snapshot, skills }));
    return true;
  } catch (e) {
    storageOK = false;
    return false;
  }
}

export function hasSave() {
  try { return !!localStorage.getItem(KEY); }
  catch (e) { storageOK = false; return false; }
}

/* Returns { ok, savedAt, skills } — or { ok: false, reason }. */
export function loadGame() {
  let raw;
  try { raw = localStorage.getItem(KEY); }
  catch (e) { storageOK = false; return { ok: false, reason: 'storage unavailable' }; }
  if (!raw) return { ok: false, reason: 'no save' };

  let data;
  try { data = JSON.parse(raw); }
  catch (e) { return { ok: false, reason: 'corrupt save' }; }

  if (!data || data.v !== 1 || typeof data.state !== 'object' || data.state === null) {
    return { ok: false, reason: 'unrecognised save format' };
  }

  resetState();
  resetTree();

  const fresh = freshState();
  for (const k of SAVED_FIELDS) {
    const v = data.state[k];
    if (v === undefined || v === null) continue;
    // only accept the type the field is meant to be
    if (typeof fresh[k] === 'number'  && typeof v === 'number'  && Number.isFinite(v)) state[k] = v;
    else if (typeof fresh[k] === 'boolean' && typeof v === 'boolean') state[k] = v;
    else if (k === 'incident' && typeof v === 'object') state[k] = v;
  }

  /* Skill effects are already baked into the restored state, so counts are set
     directly — calling apply() again would double every bonus. */
  const skills = data.skills && typeof data.skills === 'object' ? data.skills : {};
  let restored = 0;
  for (const n of allNodes()) {
    const c = skills[n.id];
    if (typeof c === 'number' && Number.isFinite(c) && c > 0) { n.count = Math.floor(c); restored++; }
  }

  return { ok: true, savedAt: data.savedAt || null, skills: restored };
}

export function wipeSave() {
  try { localStorage.removeItem(KEY); }
  catch (e) { storageOK = false; }
}

/* Called by the game loop; writes at most once per interval. */
export function autosaveTick(dt, intervalSeconds) {
  state.saveTimer = (state.saveTimer || 0) + dt;
  if (state.saveTimer < intervalSeconds) return false;
  state.saveTimer = 0;
  return saveGame();
}

export function describeAge(savedAt) {
  if (!savedAt) return '';
  const secs = Math.max(0, Math.floor((Date.now() - savedAt) / 1000));
  if (secs < 60) return 'moments ago';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return mins + (mins === 1 ? ' minute ago' : ' minutes ago');
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + (hrs === 1 ? ' hour ago' : ' hours ago');
  const days = Math.floor(hrs / 24);
  return days + (days === 1 ? ' day ago' : ' days ago');
}

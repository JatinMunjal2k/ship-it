/* ==========================================================================
   The demo goal: a million users.

   Users rather than features, because a million users is a number anyone
   recognises as an ending, and growth is multiplicative so it is a few hundred
   well-multiplied features rather than a grind.

   Lives in its own module so the rule is testable without driving the render
   loop, and so main.js stays wiring rather than game rules.
   ========================================================================== */

import { CONFIG } from './config.js';
import { state } from './state.js';

export const goalReached = () => state.users >= CONFIG.ENDING_USERS;

export const goalProgress = () =>
  Math.min(1, state.users / Math.max(1, CONFIG.ENDING_USERS));

/* True on the single tick the goal is first crossed, so the caller shows the
   ending once rather than every frame. */
export function checkEnding() {
  if (state.ended) return false;
  if (!goalReached()) return false;
  state.ended = true;
  return true;
}

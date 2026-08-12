/* ==========================================================================
   The demo goal.

   Features shipped is the target because it only ever goes up — users churn,
   so a user-count goal could be reached and then un-reached.

   Lives in its own module so the rule is testable without driving the render
   loop, and so main.js stays wiring rather than game rules.
   ========================================================================== */

import { CONFIG } from './config.js';
import { state } from './state.js';

export const goalReached = () => state.features >= CONFIG.ENDING_FEATURES;

export const goalProgress = () =>
  Math.min(1, state.features / Math.max(1, CONFIG.ENDING_FEATURES));

/* Returns true the single tick the goal is first crossed, so the caller can
   show the ending once rather than every frame. */
export function checkEnding() {
  if (state.ended) return false;
  if (!goalReached()) return false;
  state.ended = true;
  return true;
}

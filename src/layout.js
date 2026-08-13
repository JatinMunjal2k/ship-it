/* ==========================================================================
   Where each skill sits on the map.

   Kept out of tree.js on purpose: this is a rendering concern, so you can drag
   the map around without touching game rules.

   Revenue sits at the origin and is the first thing bought. The four other
   sections radiate from it: Workflow up and left, Quality up and right, Scale
   down and left, Agents down and right. Chains step about one cell at a time
   with slight offsets, because perfectly straight chains read as a list.

   To move a node: change its pair here. To add one: add its id here too, or
   the map will tell you it is missing.
   ========================================================================== */

export const BRANCH_COLORS = {
  Revenue:  '#e8b339',   // amber, the centre
  Workflow: '#d97757',   // coral
  Quality:  '#6fcf7f',   // green
  Scale:    '#b07de0',   // violet
  Agents:   '#4fd1c5',   // teal
};

export const POSITIONS = {
  /* Revenue, straight up from the centre */
  m1:  { x:  0.0, y:  0.0 },
  m2:  { x:  0.0, y: -1.2 },
  m3:  { x:  0.1, y: -2.4 },
  m4:  { x:  0.0, y: -3.6 },

  /* Workflow, out to the upper left */
  w0:  { x: -1.7, y:  0.2 },
  w1:  { x: -2.7, y: -0.4 },
  w2:  { x: -3.5, y: -1.3 },
  w3:  { x: -4.5, y: -1.9 },
  w4:  { x: -5.3, y: -2.8 },
  w5:  { x: -6.3, y: -3.4 },
  w6:  { x: -7.1, y: -4.3 },
  w7:  { x: -8.1, y: -4.9 },
  w8:  { x: -8.9, y: -5.8 },

  /* Quality, out to the upper right, branching three ways at monitoring */
  q0:  { x:  1.7, y:  0.2 },
  q1:  { x:  2.7, y: -0.4 },
  q2:  { x:  3.5, y: -1.3 },
  q3:  { x:  4.5, y: -1.9 },
  q4:  { x:  5.5, y: -2.7 },   // deeper testing
  q5:  { x:  4.6, y: -0.6 },   // hands on fixing
  q6:  { x:  6.0, y: -1.5 },   // faster response
  q7:  { x:  6.6, y: -3.5 },
  q8:  { x:  4.6, y: -3.6 },
  q9:  { x:  7.5, y: -2.7 },
  q10: { x:  7.1, y: -1.0 },
  q11: { x:  6.5, y: -0.1 },
  q12: { x:  8.2, y: -0.5 },
  q13: { x:  7.6, y: -4.3 },

  /* Scale, out to the lower left */
  s0:  { x: -1.5, y:  1.6 },
  s1:  { x: -2.6, y:  2.3 },
  s2:  { x: -0.8, y:  2.7 },
  s3:  { x: -3.5, y:  3.1 },
  s4:  { x: -4.6, y:  3.8 },
  s5:  { x: -2.9, y:  4.3 },
  s6:  { x: -1.3, y:  3.8 },
  s7:  { x:  0.1, y:  3.4 },
  s8:  { x: -3.3, y:  5.5 },
  s9:  { x: -1.5, y:  5.0 },
  s10: { x: -3.7, y:  6.7 },

  /* Agents, out to the lower right */
  a0:  { x:  1.6, y:  1.7 },
  a1:  { x:  2.7, y:  2.4 },
  a2:  { x:  3.9, y:  2.9 },
  a3:  { x:  2.5, y:  3.6 },
  a4:  { x:  2.7, y:  4.8 },
};

/* Cell size in pixels, sized against the tile in index.html (104x68). */
export const CELL_X = 124;
export const CELL_Y = 82;

export const ZOOM_MIN = 0.35;
export const ZOOM_MAX = 1.5;
export const ZOOM_START = 0.9;

/* Reports ids missing a position, or positions naming an unknown id. */
export function layoutProblems(nodeIds) {
  const problems = [];
  for (const id of nodeIds) {
    if (!POSITIONS[id]) problems.push(`"${id}" has no position in layout.js.`);
  }
  for (const id in POSITIONS) {
    if (!nodeIds.includes(id)) problems.push(`layout.js positions "${id}", which is not a skill.`);
  }
  return problems;
}

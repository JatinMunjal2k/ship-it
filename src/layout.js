/* ==========================================================================
   Where each skill sits on the map.

   Kept out of tree.js on purpose: this is a rendering concern, so you can move
   the map around without touching game rules.

   Every coordinate is a whole number and the cell is square, so the map is a
   real grid with rows and columns rather than a scatter. Revenue occupies the
   centre column and runs upward; the four sections leave m1 in four directions
   and stay in their own quadrant:

              m4 m3 m2                (Revenue, up)
     Workflow  <-  m1  ->  Quality
              Scale  Agents           (down left, down right)

   Chains step one cell at a time wherever possible, so most edges are a clean
   horizontal or vertical line and forks read as short diagonals.

   To move a node: change its pair. To add one: add its id here too, or the map
   will tell you it is missing.
   ========================================================================== */

export const BRANCH_COLORS = {
  Revenue:  '#e8b339',
  Workflow: '#d97757',
  Quality:  '#6fcf7f',
  Scale:    '#b07de0',
  Agents:   '#4fd1c5',
};

export const POSITIONS = {
  /* Revenue: the centre column, running up */
  m1:  { x:  0, y:  0 },
  m2:  { x:  0, y: -1 },
  m3:  { x:  0, y: -2 },
  m4:  { x:  0, y: -3 },

  /* Workflow: a 3x3 block to the left, filled in a serpentine so every step
     of the chain lands next to the one before it */
  w0:  { x: -1, y:  0 },
  w1:  { x: -1, y: -1 },
  w2:  { x: -1, y: -2 },
  w3:  { x: -2, y: -2 },
  w4:  { x: -2, y: -1 },
  w5:  { x: -2, y:  0 },
  w6:  { x: -3, y:  0 },
  w7:  { x: -3, y: -1 },
  w8:  { x: -3, y: -2 },

  /* Quality: a trunk running right, forking into its own row bands */
  q0:  { x:  1, y:  0 },
  q1:  { x:  2, y:  0 },
  q2:  { x:  3, y:  0 },
  q3:  { x:  4, y:  0 },
  q4:  { x:  5, y: -1 },   // testing arm, upper band
  q8:  { x:  6, y: -2 },
  q9:  { x:  6, y: -1 },
  q7:  { x:  6, y:  0 },
  q13: { x:  7, y:  0 },
  q5:  { x:  5, y:  1 },   // triage, on its own
  q6:  { x:  5, y:  2 },   // response arm, lower band
  q10: { x:  6, y:  2 },
  q12: { x:  7, y:  2 },
  q11: { x:  6, y:  3 },

  /* Scale: down and to the left, capacity running out along row 2 */
  s0:  { x: -1, y:  1 },
  s1:  { x: -2, y:  1 },
  s3:  { x: -3, y:  1 },
  s4:  { x: -4, y:  1 },
  s5:  { x: -3, y:  2 },
  s8:  { x: -4, y:  2 },
  s10: { x: -5, y:  2 },
  s2:  { x: -1, y:  2 },   // growth arm
  s6:  { x: -2, y:  2 },
  s9:  { x: -2, y:  3 },
  s7:  { x: -1, y:  3 },

  /* Agents: down and to the right */
  a0:  { x:  1, y:  1 },
  a1:  { x:  2, y:  1 },
  a2:  { x:  3, y:  1 },
  a3:  { x:  2, y:  2 },
  a4:  { x:  3, y:  2 },
};

/* Square cells, so a row step and a column step look the same. */
export const CELL_X = 112;
export const CELL_Y = 112;

export const ZOOM_MIN = 0.35;
export const ZOOM_MAX = 1.5;
export const ZOOM_START = 0.85;

/* Reports ids missing a position, positions naming an unknown id, or two
   skills sharing a cell. */
export function layoutProblems(nodeIds) {
  const problems = [];
  for (const id of nodeIds) {
    if (!POSITIONS[id]) problems.push(`"${id}" has no position in layout.js.`);
  }
  for (const id in POSITIONS) {
    if (!nodeIds.includes(id)) problems.push(`layout.js positions "${id}", which is not a skill.`);
  }
  const seen = {};
  for (const id in POSITIONS) {
    const key = POSITIONS[id].x + ',' + POSITIONS[id].y;
    if (seen[key]) problems.push(`"${id}" and "${seen[key]}" share cell ${key}.`);
    else seen[key] = id;
  }
  return problems;
}

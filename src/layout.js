/* ==========================================================================
   Where each skill sits on the map.

   Kept out of tree.js on purpose: this is a rendering concern, so you can drag
   the map around without touching game rules, and tree.js stays about what
   skills do.

   Coordinates are in cells, origin at the centre of the map. render.js scales
   them to pixels. The seven branch roots sit in a ring roughly two cells from
   the origin and each chain radiates outward from its own root, so the graph
   grows away from the middle as skills are bought.

   Fractional values are deliberate — perfectly straight chains look like a
   list, slight offsets read as a graph.

   To move a node: change its pair here. To add one: add its id here too, or
   the map will tell you it is missing.
   ========================================================================== */

export const BRANCH_COLORS = {
  Workflow:   '#d97757',   // coral — the accent, since it is the spine of the game
  Quality:    '#6fcf7f',   // green
  Testing:    '#58a6ff',   // blue
  Velocity:   '#e8b339',   // amber
  Capacity:   '#b07de0',   // violet
  Automation: '#4fd1c5',   // teal
  Reliability:'#e5484d',   // red
};

export const POSITIONS = {
  /* Workflow — climbs up and to the right, meeting Testing at CI */
  w0: { x:  0.0, y: -2.0 },
  w1: { x:  0.1, y: -3.2 },
  w2: { x:  1.1, y: -4.2 },
  w3: { x:  2.3, y: -5.2 },   // needs w2 + t1: the map's one real convergence
  w4: { x:  2.4, y: -6.4 },
  w5: { x:  3.5, y: -7.4 },

  /* Testing — up and right, deliberately near Workflow so the CI link is short */
  t1: { x:  2.1, y: -2.1 },
  t2: { x:  3.5, y: -3.0 },
  t3: { x:  4.8, y: -3.9 },

  /* Quality — up and left */
  q1: { x: -2.0, y: -2.0 },
  q2: { x: -3.0, y: -3.0 },
  q3: { x: -3.3, y: -4.2 },
  q4: { x: -4.4, y: -5.2 },

  /* Velocity — straight out to the left */
  v1: { x: -3.0, y:  0.1 },
  v2: { x: -4.3, y: -0.6 },
  v3: { x: -5.6, y: -1.3 },
  v4: { x: -6.9, y: -2.0 },

  /* Capacity — down and left */
  c1: { x: -2.0, y:  2.0 },
  c2: { x: -3.1, y:  3.0 },
  c3: { x: -4.2, y:  4.0 },
  c4: { x: -5.3, y:  5.0 },

  /* Automation — straight down */
  a1: { x:  0.5, y:  2.1 },
  a2: { x:  0.6, y:  3.3 },
  a3: { x:  1.7, y:  4.3 },
  a4: { x:  1.8, y:  5.5 },

  /* Reliability — down and right, forking at Alerting */
  r1: { x:  3.0, y:  0.5 },
  r2: { x:  4.3, y:  1.2 },
  r3: { x:  5.6, y:  1.9 },
  r4: { x:  4.2, y:  3.0 },   // fork off r2
  r5: { x:  6.8, y:  3.0 },   // fork off r3
};

/* Cell size in pixels. Wide because nodes carry text rather than icons, and
   tight vertically so a useful slice of the map fits without panning. */
export const CELL_X = 158;
export const CELL_Y = 76;

export const ZOOM_MIN = 0.45;
export const ZOOM_MAX = 1.4;
/* Slightly out, so the first look shows the shape rather than three nodes. */
export const ZOOM_START = 0.8;

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

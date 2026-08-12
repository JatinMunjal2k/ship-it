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
  w0: { x:  0.0, y: -1.6 },
  w1: { x:  0.1, y: -2.6 },
  w2: { x:  1.0, y: -3.4 },
  w3: { x:  2.0, y: -4.2 },   // needs w2 + t1: the map's one real convergence
  w4: { x:  2.1, y: -5.2 },
  w5: { x:  3.0, y: -6.0 },

  /* Testing — up and right, deliberately near Workflow so the CI link is short */
  t1: { x:  1.8, y: -1.7 },
  t2: { x:  2.9, y: -2.4 },
  t3: { x:  4.0, y: -3.1 },

  /* Quality — up and left */
  q1: { x: -1.8, y: -1.6 },
  q2: { x: -2.7, y: -2.4 },
  q3: { x: -2.9, y: -3.4 },
  q4: { x: -3.8, y: -4.2 },

  /* Velocity — straight out to the left */
  v1: { x: -2.6, y:  0.1 },
  v2: { x: -3.7, y: -0.5 },
  v3: { x: -4.8, y: -1.0 },
  v4: { x: -5.9, y: -1.6 },

  /* Capacity — down and left */
  c1: { x: -1.8, y:  1.7 },
  c2: { x: -2.7, y:  2.5 },
  c3: { x: -3.6, y:  3.3 },
  c4: { x: -4.5, y:  4.1 },

  /* Automation — straight down */
  a1: { x:  0.4, y:  1.8 },
  a2: { x:  0.5, y:  2.8 },
  a3: { x:  1.5, y:  3.6 },
  a4: { x:  1.6, y:  4.6 },

  /* Reliability — down and right, forking at Alerting */
  r1: { x:  2.6, y:  0.5 },
  r2: { x:  3.7, y:  1.1 },
  r3: { x:  4.8, y:  1.7 },
  r4: { x:  3.6, y:  2.4 },   // fork off r2
  r5: { x:  5.9, y:  2.6 },   // fork off r3
};

/* Cell size in pixels, sized against the tile in index.html (104x68). Tight
   gaps so the map reads as a connected board rather than scattered cards —
   nodes are near-square and names wrap onto two lines. */
export const CELL_X = 124;
export const CELL_Y = 82;

export const ZOOM_MIN = 0.45;
export const ZOOM_MAX = 1.5;
/* Slightly out, so the first look shows the shape rather than three nodes. */
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

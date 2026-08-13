/* ==========================================================================
   All DOM output. Nothing here mutates game state except through the callbacks
   wired in main.js.
   ========================================================================== */

import { CONFIG } from './config.js';
import {
  state, quality, userCap, agentInterval, hasTests, catchRate, income,
  thinkTime, autofixTime, deployTime, repairTime, bleedRate, capacityUse,
  phaseName, fmt, money, moneyFine, esc, $,
} from './state.js';
import { TIMED_STAGES } from './pipeline.js';
import { goalProgress } from './ending.js';
import {
  tree, allNodes, nodeById, reqsOf, owned, isMaxed, spent, costOf, buyable,
  visible, missing,
} from './tree.js';
import {
  POSITIONS, BRANCH_COLORS, CELL_X, CELL_Y, ZOOM_MIN, ZOOM_MAX, ZOOM_START,
} from './layout.js';
import { SAFETY_RULES, ruleById } from './flavor.js';

export let view = 'game';

export function setView(v) {
  view = v;
  $('view-game').style.display   = v === 'game'   ? '' : 'none';
  $('view-skills').style.display = v === 'skills' ? '' : 'none';
  $('tab-game').classList.toggle('on', v === 'game');
  $('tab-skills').classList.toggle('on', v === 'skills');
  hideTip();
  if (v === 'game') $('prompt').focus();
  if (v === 'skills' && !viewInit) recenterTree();
}

/* ==========================================================================
   Stage card
   ========================================================================== */
let stageKey = '';
export function resetStageKey() { stageKey = ''; }

export function renderStage(onAction) {
  const b = state.build;
  const box = $('stage');

  const key = !b ? 'none'
    : [b.id, b.kind, b.stage,
       b.perm ? b.perm.cmd + b.perm.danger + b.perm.done : '-',
       b.diff ? b.diff.file + b.diff.add + b.diff.del + b.diff.risky : '-',
       b.failing || 0].join('|');

  if (key === stageKey) {
    const bar = box.querySelector('.cbar');
    if (bar && b && b.total) {
      bar.style.width = (100 * (1 - Math.max(0, b.timer) / b.total)).toFixed(1) + '%';
    }
    return;
  }
  stageKey = key;
  box.innerHTML = '';
  if (!b) return;

  const card = document.createElement('div');
  const parts = [];
  if (TIMED_STAGES.includes(b.stage)) parts.push('<div class="cbar"></div>');

  if (b.kind === 'repair' && b.stage === 'work') {
    card.className = 'card fail';
    parts.push('<div class="chead">writing the fix</div>',
               '<div class="cbody">Patching the failure.</div>');
  } else if (b.kind === 'repair' && b.stage === 'fixready') {
    card.className = 'card fail';
    parts.push('<div class="chead">fix ready, not live yet</div>',
               '<div class="cbody">The patch is written. Production is still down.</div>',
               '<div class="crow"><button class="btn ok" data-act="deploy">' +
                 'Deploy the fix<kbd>Enter</kbd></button></div>',
               '<div class="csub">Deploying takes ' + deployTime().toFixed(1) +
                 's. You are still losing users.</div>');
  } else if (b.kind === 'repair' && b.stage === 'deploying') {
    card.className = 'card fail';
    parts.push('<div class="chead">deploying the fix</div>',
               '<div class="cbody">Rolling out to production.</div>');
  } else if (b.kind === 'bugfix') {
    card.className = 'card wait';
    parts.push('<div class="chead">fixing a known bug</div>',
               '<div class="cbody">Working through the backlog.</div>');
  } else if (b.stage === 'think') {
    card.className = 'card wait';
    parts.push('<div class="chead">claude is working</div>',
               '<div class="cbody">Writing the change.</div>');
  } else if (b.stage === 'perm') {
    /* Both kinds of command look identical on purpose. Reading the command is
       the whole mechanic, so the card must never colour in the answer. */
    card.className = 'card ask';
    parts.push('<div class="chead">permission required</div>',
               '<div class="cbody">Claude wants to run:</div>',
               '<div class="cmd">' + esc(b.perm.cmd) + '</div>',
               '<div class="crow">' +
                 '<button class="btn pri" data-act="allow">Allow<kbd>y</kbd></button>' +
                 '<button class="btn no" data-act="deny">Deny<kbd>n</kbd></button>' +
                 '<button class="btn no" data-act="rules">What is safe?</button></div>',
               '<div class="csub">Read it before you answer. Most are harmless. ' +
                 'A few are not.</div>');
  } else if (b.stage === 'review') {
    card.className = 'card diff';
    parts.push('<div class="chead">review the diff</div>',
               '<div class="cbody">' + esc(b.diff.file) +
                 ' <span style="color:var(--good)">+' + b.diff.add + '</span>' +
                 ' <span style="color:var(--bad)">-' + b.diff.del + '</span></div>',
               b.diff.risky ? '<div class="crisk">Risky: ' + esc(b.diff.reason) + '</div>'
                            : '<div class="csub">Looks routine.</div>',
               '<div class="crow">' +
                 '<button class="btn pri" data-act="approve">Approve<kbd>Enter</kbd></button>' +
                 '<button class="btn no" data-act="reject">Reject<kbd>r</kbd></button></div>',
               hasTests() ? '' : '<div class="csub">No tests. Nothing will check this.</div>');
  } else if (b.stage === 'test') {
    card.className = 'card wait';
    parts.push('<div class="chead">running tests</div>',
               '<div class="cbody">' + esc(b.diff.file) + '</div>');
  } else if (b.stage === 'red') {
    card.className = 'card fail';
    parts.push('<div class="chead">tests caught a defect</div>',
               '<div class="cbody">' + b.failing + ' test' + (b.failing === 1 ? '' : 's') +
                 ' failing on ' + esc(b.diff.file) + '.</div>',
               '<div class="crow">' +
                 '<button class="btn ok" data-act="fixred">Fix it<kbd>Enter</kbd></button>' +
                 '<button class="btn no" data-act="shipany">Ship anyway<kbd>s</kbd></button></div>',
               '<div class="csub">Shipping it saves ' + autofixTime().toFixed(1) +
                 's and buys you a bug.</div>');
  } else if (b.stage === 'autofix') {
    card.className = 'card wait';
    parts.push('<div class="chead">repairing the build</div>',
               '<div class="cbody">Patching the failing tests.</div>');
  } else if (b.stage === 'deploy') {
    card.className = 'card ready';
    parts.push('<div class="chead">ready to deploy</div>',
               '<div class="cbody">' + esc(b.diff.name) +
                 (hasTests() ? ', tests green.' : ', untested.') + '</div>',
               '<div class="crow"><button class="btn ok" data-act="deploy">' +
                 'Deploy<kbd>Enter</kbd></button></div>',
               '<div class="csub">Takes ' + deployTime().toFixed(1) +
                 's. Users arrive when it lands.</div>');
  } else if (b.stage === 'deploying') {
    card.className = 'card ready';
    parts.push('<div class="chead">deploying</div>',
               '<div class="cbody">' + esc(b.diff ? b.diff.name : 'change') + '</div>');
  }

  card.innerHTML = parts.join('');
  box.appendChild(card);
  card.querySelectorAll('button[data-act]').forEach(btn => {
    btn.onclick = () => onAction(btn.dataset.act);
  });
}

/* ==========================================================================
   The safety reference. The permission mechanic is unreadable to someone who
   has never used a terminal unless the rules are written down somewhere.
   ========================================================================== */
export function renderRules() {
  const safe = SAFETY_RULES.filter(r => r.safe);
  const bad  = SAFETY_RULES.filter(r => !r.safe);
  const row = r => '<div class="rrow"><b>' + esc(r.title) + '</b>' +
                   '<span>' + esc(r.body) + '</span></div>';
  $('rules-body').innerHTML =
    '<div class="rgroup ok"><h4>Safe to allow</h4>' + safe.map(row).join('') + '</div>' +
    '<div class="rgroup bad"><h4>Never allow</h4>' + bad.map(row).join('') + '</div>';
  $('rules').style.display = 'flex';
}
export function hideRules() { $('rules').style.display = 'none'; }

/* ==========================================================================
   The map
   ========================================================================== */
const PAD_X = 1600, PAD_Y = 1200;
let panX = 0, panY = 0, zoom = ZOOM_START, viewInit = false;

export const treeFramed = () => viewInit;

const cellToPx = p => ({ x: PAD_X + p.x * CELL_X, y: PAD_Y + p.y * CELL_Y });
const branchOf  = n => tree.find(b => b.nodes.includes(n));
const colorOf   = n => BRANCH_COLORS[branchOf(n).branch] || 'var(--accent)';

function applyTransform() {
  $('treecanvas').style.transform =
    'translate(' + panX.toFixed(1) + 'px,' + panY.toFixed(1) + 'px) scale(' + zoom.toFixed(3) + ')';
}

export function recenterTree(resetZoom = false) {
  const wrap = $('treewrap');
  if (!wrap.clientWidth) return false;
  if (resetZoom) zoom = ZOOM_START;

  const shown = allNodes().filter(visible).map(n => cellToPx(POSITIONS[n.id]));
  const pts = shown.length ? shown : [{ x: PAD_X, y: PAD_Y }];
  pts.push({ x: PAD_X, y: PAD_Y });
  const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  panX = wrap.clientWidth  / 2 - cx * zoom;
  panY = wrap.clientHeight / 2 - cy * zoom;
  applyTransform();
  viewInit = true;
  return true;
}

export function setZoom(z, originX, originY) {
  const wrap = $('treewrap');
  const ox = originX === undefined ? wrap.clientWidth  / 2 : originX;
  const oy = originY === undefined ? wrap.clientHeight / 2 : originY;
  const next = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));
  panX = ox - (ox - panX) * (next / zoom);
  panY = oy - (oy - panY) * (next / zoom);
  zoom = next;
  applyTransform();
}

export const getZoom = () => zoom;
export function panBy(dx, dy) { panX += dx; panY += dy; applyTransform(); }
export function setGrabbing(on) { $('treewrap').classList.toggle('grabbing', on); }

let tipFor = null;

export function showTip(n, el) {
  const tipEl = $('tip');
  tipFor = n.id;
  const c = costOf(n);
  const lock = missing(n);
  const badge = spent(n) ? 'owned'
              : isMaxed(n) ? (owned(n) ? 'maxed, owned x' + n.count : 'maxed out')
              : n.repeat && n.count ? 'owned x' + n.count + ', repeatable'
              : n.repeat ? 'repeatable' : '';

  tipEl.innerHTML =
    '<span class="tt">' + esc(n.name) + '</span>' +
    (spent(n) || isMaxed(n) ? '' : '<span class="tc">' + money(c) +
      (state.cash < c ? ', you have ' + money(state.cash) : '') + '</span>') +
    '<div class="td">' + esc(n.desc()) + '</div>' +
    (n.warn && !spent(n) ? '<div class="tw">' + esc(n.warn) + '</div>' : '') +
    (lock.length ? '<div class="tw">Needs ' + esc(lock.join(' and ')) + '</div>' : '') +
    (badge ? '<div class="to">' + badge + '</div>' : '');
  positionTip(el);
}

export function showLockedTip(n, el) {
  tipFor = 'stub-' + n.id;
  const lock = missing(n);
  $('tip').innerHTML = '<span class="tt">Locked</span>' +
    '<div class="td">Something unlocks here.</div>' +
    (lock.length ? '<div class="tw">Needs ' + esc(lock.join(' and ')) + '</div>' : '');
  positionTip(el);
}

function positionTip(el) {
  const tipEl = $('tip');
  tipEl.classList.add('on');
  const r = el.getBoundingClientRect();
  const t = tipEl.getBoundingClientRect();
  let left = r.left, top = r.bottom + 8;
  if (left + t.width > window.innerWidth - 12) left = window.innerWidth - t.width - 12;
  if (top + t.height > window.innerHeight - 12) top = r.top - t.height - 8;
  tipEl.style.left = Math.max(12, left) + 'px';
  tipEl.style.top  = Math.max(12, top) + 'px';
}

export function hideTip() { tipFor = null; $('tip').classList.remove('on'); }

export function renderTree(onBuy) {
  const nodesBox = $('treenodes');
  const svg = $('treeedges');
  nodesBox.innerHTML = '';
  svg.innerHTML = '';
  svg.setAttribute('width', PAD_X * 2);
  svg.setAttribute('height', PAD_Y * 2);

  for (const n of allNodes()) {
    if (!visible(n)) continue;
    const to = cellToPx(POSITIONS[n.id]);
    for (const rid of reqsOf(n)) {
      const parent = nodeById(rid);
      if (!parent || !visible(parent)) continue;
      const from = cellToPx(POSITIONS[rid]);
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', from.x); line.setAttribute('y1', from.y);
      line.setAttribute('x2', to.x);   line.setAttribute('y2', to.y);
      line.setAttribute('stroke', colorOf(n));
      line.setAttribute('stroke-width', owned(n) ? 2 : 1.5);
      line.setAttribute('stroke-opacity', owned(n) ? 0.7 : 0.22);
      if (!owned(n)) line.setAttribute('stroke-dasharray', '5 5');
      svg.appendChild(line);
    }
  }

  /* No decorative hub: the centre skill sits at the origin, so a marker there
     just showed through from behind it, bought or not. */

  for (const n of allNodes()) {
    const pos = POSITIONS[n.id];
    if (!pos) continue;
    const px = cellToPx(pos);

    if (!visible(n)) {
      const anyParentOwned = reqsOf(n).some(id => owned(nodeById(id)));
      if (!anyParentOwned) continue;

      const stub = document.createElement('button');
      stub.className = 'stub';
      stub.id = 'stub-' + n.id;
      stub.textContent = '?';
      stub.style.left = px.x + 'px';
      stub.style.top  = px.y + 'px';
      stub.addEventListener('mouseenter', () => showLockedTip(n, stub));
      stub.addEventListener('mouseleave', hideTip);
      nodesBox.appendChild(stub);

      for (const rid of reqsOf(n)) {
        const parent = nodeById(rid);
        if (!parent || !owned(parent)) continue;
        const from = cellToPx(POSITIONS[rid]);
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', from.x); line.setAttribute('y1', from.y);
        line.setAttribute('x2', px.x);   line.setAttribute('y2', px.y);
        line.setAttribute('stroke', '#3d3d46');
        line.setAttribute('stroke-width', 1);
        line.setAttribute('stroke-dasharray', '3 6');
        svg.appendChild(line);
      }
      continue;
    }

    /* `done` means nothing more can be bought here. A repeatable you already
       own is NOT done, it must keep reading as clickable. */
    const done = spent(n) || isMaxed(n);
    const el = document.createElement(done ? 'div' : 'button');
    const color = colorOf(n);
    el.className = 'tile' + (done ? ' own' : '') +
      (!done && owned(n) ? ' stacked' : '') +
      (!done && state.cash < costOf(n) ? ' poor' : ' ready') +
      (n.warn && !owned(n) ? ' warnish' : '');
    el.id = 'tile-' + n.id;
    el.style.left = px.x + 'px';
    el.style.top  = px.y + 'px';
    el.style.borderColor = color;
    el.style.color = color;

    const right = spent(n) ? 'owned'
                : isMaxed(n) ? (owned(n) ? 'maxed x' + n.count : 'maxed')
                : money(costOf(n)) + (n.repeat && n.count ? '  x' + n.count : '');

    el.innerHTML = '<span class="tname" style="color:var(--text)">' + esc(n.name) + '</span>' +
                   '<span class="tcost">' + right + '</span>';

    el.addEventListener('mouseenter', () => showTip(n, el));
    el.addEventListener('mouseleave', hideTip);
    el.addEventListener('focus',      () => showTip(n, el));
    el.addEventListener('blur',       hideTip);
    if (!done) el.onclick = () => onBuy(n);

    nodesBox.appendChild(el);
  }

  if (!viewInit) recenterTree();
  else applyTransform();
}

/* ==========================================================================
   Everything else
   ========================================================================== */
export function render(onAction) {
  const cap = userCap();
  const b = state.build;

  /* Users against capacity, coloured by how close the ceiling is. Amber and
     red rather than green, because green is already the colour of money. */
  $('s-users').innerHTML = fmt(state.users) +
    '<span class="capof"> / ' + fmt(cap) + '</span>';
  const use = capacityUse();
  const usersEl = $('s-users');
  usersEl.classList.toggle('warn', use >= 0.6 && use < 0.9);
  usersEl.classList.toggle('bad',  use >= 0.9);
  $('s-cap').textContent = use >= 0.995 ? 'at capacity, ship nothing new'
                         : Math.round(use * 100) + '% of capacity';

  $('s-cash').textContent     = moneyFine(state.cash);
  $('s-rate').textContent     = moneyFine(income()) + '/s';
  $('s-features').textContent = fmt(state.features);
  $('s-goal').textContent     = state.agentFeatures > 0
    ? fmt(state.agentFeatures) + ' by agents'
    : 'all by hand';

  /* The goal belongs to the whole run, not to the features tile. */
  const prog = goalProgress();
  $('goalfill').style.width = (prog * 100).toFixed(2) + '%';
  $('goaltext').textContent = fmt(state.users) + ' of ' + fmt(CONFIG.ENDING_USERS) + ' users';

  /* Code quality stays hidden until a skill reveals it. */
  $('tile-quality').style.display = state.seeQuality ? '' : 'none';
  if (state.seeQuality) {
    $('s-quality').textContent = Math.round(quality() * 100) + '%';
    $('s-detect').textContent  = hasTests()
      ? Math.round(catchRate() * 100) + '% of defects caught'
      : 'no tests, nothing is caught';
  }

  $('tile-bugs').style.display = state.seeBugs ? '' : 'none';
  if (state.seeBugs) $('s-bugs').textContent = fmt(state.bugs);

  $('phase').textContent   = phaseName();
  $('f-stats').textContent = state.incidents + ' incident' + (state.incidents === 1 ? '' : 's') +
                             ', ' + fmt(state.usersLost) + ' users lost' +
                             (state.disasters ? ', ' + state.disasters + ' self inflicted' : '');

  const strip = $('agentstrip');
  if (state.agents > 0) {
    strip.style.display = '';
    strip.innerHTML =
      '<span><b>' + state.agents + '</b> agent' + (state.agents === 1 ? '' : 's') +
        ', one feature every ' + agentInterval().toFixed(0) + 's each</span>' +
      '<span><b>' + fmt(state.agentFeatures) + '</b> features shipped</span>' +
      (state.remediation > 0 && state.seeBugs
        ? '<span class="ok">' + fmt(state.autoFixed) + ' auto remediated</span>' : '');
  } else strip.style.display = 'none';

  renderStage(onAction);

  const p = $('prompt');
  $('promptrow').classList.toggle('alarm', !!state.incident && !b);
  $('promptrow').classList.toggle('idle', !!b);
  p.placeholder = b               ? 'the pipeline is busy, use the card above'
                : state.incident  ? 'paste the error message above, then press Enter'
                : state.quickShip ? 'press Enter, or type /ship'
                                  : '/ship';

  let enterDoes = state.quickShip ? 'ship a feature' : 'run /ship';
  if (b && b.stage === 'perm')          enterDoes = 'allow';
  else if (b && b.stage === 'review')   enterDoes = 'approve';
  else if (b && b.stage === 'red')      enterDoes = 'fix the build';
  else if (b && b.stage === 'deploy')   enterDoes = 'deploy';
  else if (b && b.stage === 'fixready') enterDoes = 'deploy the fix';
  else if (b)                           enterDoes = 'wait';
  else if (state.incident)              enterDoes = 'submit the fix';

  $('hintlabel').innerHTML = (state.incident && !b)
    ? '<span style="color:var(--bad)">Production is down.</span> A fix must be written and deployed.'
    : (b || state.quickShip)
      ? '<kbd>Enter</kbd> ' + enterDoes
      : 'Type <code>/ship</code> and press <kbd>Enter</kbd> to build a feature.';

  const manual = [!state.autoAccept && 'review', hasTests() && !state.ci && 'red build',
                  !state.cd && 'deploy'].filter(Boolean).length;
  $('statuslabel').textContent = 'think ' + thinkTime().toFixed(1) + 's, deploy ' +
    deployTime().toFixed(1) + 's, ' +
    (manual ? manual + ' manual stage' + (manual === 1 ? '' : 's') : 'fully automated');

  $('h-meta').textContent = state.features > 0 ? fmt(state.features) + ' shipped' : '';

  /* The alert changes character once a fix has failed. The player never sees a
     count of how many deploys are left, only that this one is not behaving. */
  const al = $('alert');
  if (state.incident) {
    const inc = state.incident;
    al.style.display = '';
    al.classList.toggle('repro', inc.revealed);
    $('alert-head').textContent = inc.revealed
      ? 'Non-reproducible bug, the last fix did not hold'
      : 'Production incident, paste the error into the prompt';
    if ($('alert-err').textContent !== inc.text) $('alert-err').textContent = inc.text;
    $('attempt').textContent = inc.revealed ? 'it came back different' : '';
    $('bleedlabel').textContent = 'losing ' + (bleedRate() * 100).toFixed(1) +
                                  '% of users per second';
  } else al.style.display = 'none';

  const fb = $('fixbtn');
  fb.style.display = state.canFixBugs ? '' : 'none';
  fb.disabled = !!b || !!state.incident || state.bugs <= 0;
  fb.textContent = state.bugs > 0 ? 'Fix a bug (' + fmt(state.bugs) + ' open)' : 'No known bugs';

  let affordable = 0;
  for (const n of allNodes()) if (buyable(n)) affordable++;
  const badge = $('tab-badge');
  if (affordable > 0 && view !== 'skills') {
    badge.style.display = ''; badge.textContent = affordable;
  } else badge.style.display = 'none';

  if (view === 'skills') {
    for (const n of allNodes()) {
      const el = $('tile-' + n.id);
      if (!el) continue;
      if (!(spent(n) || isMaxed(n))) {
        const broke = state.cash < costOf(n);
        el.classList.toggle('poor', broke);
        el.classList.toggle('ready', !broke);
        const c = el.querySelector('.tcost');
        if (c) c.textContent = money(costOf(n)) + (n.repeat && n.count ? '  x' + n.count : '');
      }
      if (tipFor === n.id) showTip(n, el);
    }
    const own = allNodes().filter(owned).length;
    $('tree-meta').textContent = own + ' of ' + allNodes().length + ' unlocked';
  }
}

/* ==========================================================================
   Ending
   ========================================================================== */
export function renderEnding() {
  const mins = Math.floor(state.elapsed / 60);
  const secs = Math.floor(state.elapsed % 60);
  $('end-stats').innerHTML = [
    ['Users',              fmt(state.users)],
    ['Features shipped',   fmt(state.features)],
    ['Time played',        mins + 'm ' + secs + 's'],
    ['Incidents survived', String(state.incidents)],
    ['Users lost',         fmt(state.usersLost)],
    ['Self inflicted',     state.disasters + (state.disasters === 1 ? ' disaster' : ' disasters')],
    ['Shipped by agents',  fmt(state.agentFeatures)],
    ['Skills unlocked',    allNodes().filter(owned).length + ' of ' + allNodes().length],
  ].map(([k, v]) => '<div class="erow"><span>' + k + '</span><b>' + v + '</b></div>').join('');
  $('ending').style.display = 'flex';
}

export function hideEnding() { $('ending').style.display = 'none'; }

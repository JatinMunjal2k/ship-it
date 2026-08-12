/* ==========================================================================
   All DOM output. Nothing here mutates game state except through the callbacks
   wired in main.js.
   ========================================================================== */

import { CONFIG } from './config.js';
import {
  state, quality, userCap, agentInterval, hasTests, catchRate,
  thinkTime, autofixTime, deployTime, repairTime, bleedRate,
  phaseName, fmt, money, esc, $,
} from './state.js';
import { TIMED_STAGES } from './pipeline.js';
import { goalProgress } from './ending.js';
import {
  tree, allNodes, owned, isMaxed, spent, costOf, buyable, visible, missing,
} from './tree.js';

export let view = 'game';

export function setView(v) {
  view = v;
  $('view-game').style.display   = v === 'game'   ? '' : 'none';
  $('view-skills').style.display = v === 'skills' ? '' : 'none';
  $('tab-game').classList.toggle('on', v === 'game');
  $('tab-skills').classList.toggle('on', v === 'skills');
  hideTip();
  if (v === 'game') $('prompt').focus();
}

/* ==========================================================================
   Stage card — rebuilt only when its shape changes, so buttons survive and the
   progress bar animates smoothly. Keyed per build id so a new run can never
   reuse a previous one's card (which once showed the wrong command).
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
               '<div class="cbody">Patching the failure…</div>');
  } else if (b.kind === 'repair' && b.stage === 'fixready') {
    card.className = 'card fail';
    parts.push('<div class="chead">fix ready — not live yet</div>',
               '<div class="cbody">The patch is written. Production is still down.</div>',
               '<div class="crow"><button class="btn ok" data-act="deploy">' +
                 'Deploy the fix<kbd>↵</kbd></button></div>',
               '<div class="csub">Deploying takes ' + deployTime().toFixed(1) +
                 's. You are still losing users.</div>');
  } else if (b.kind === 'repair' && b.stage === 'deploying') {
    card.className = 'card fail';
    parts.push('<div class="chead">deploying the fix</div>',
               '<div class="cbody">Rolling out to production…</div>');
  } else if (b.kind === 'bugfix') {
    card.className = 'card wait';
    parts.push('<div class="chead">fixing a known bug</div>',
               '<div class="cbody">Working through the backlog…</div>');
  } else if (b.stage === 'think') {
    card.className = 'card wait';
    parts.push('<div class="chead">claude is working</div>',
               '<div class="cbody">Writing the change…</div>');
  } else if (b.stage === 'perm') {
    card.className = 'card ask';
    parts.push('<div class="chead">permission required</div>',
               '<div class="cbody">Claude wants to run:</div>',
               '<div class="cmd' + (b.perm.danger ? ' danger' : '') + '">' + esc(b.perm.cmd) + '</div>',
               '<div class="crow">' +
                 '<button class="btn pri" data-act="allow">Allow<kbd>y</kbd></button>' +
                 '<button class="btn no" data-act="deny">Deny<kbd>n</kbd></button></div>',
               '<div class="csub">Read it before you answer.</div>');
  } else if (b.stage === 'review') {
    card.className = 'card diff';
    parts.push('<div class="chead">review the diff</div>',
               '<div class="cbody">' + esc(b.diff.file) +
                 ' <span style="color:var(--good)">+' + b.diff.add + '</span>' +
                 ' <span style="color:var(--bad)">−' + b.diff.del + '</span></div>',
               b.diff.risky ? '<div class="crisk">⚠ ' + esc(b.diff.reason) + '</div>'
                            : '<div class="csub">Looks routine.</div>',
               '<div class="crow">' +
                 '<button class="btn pri" data-act="approve">Approve<kbd>↵</kbd></button>' +
                 '<button class="btn no" data-act="reject">Reject<kbd>r</kbd></button></div>',
               hasTests() ? '' : '<div class="csub">No tests. Nothing will check this.</div>');
  } else if (b.stage === 'test') {
    card.className = 'card wait';
    parts.push('<div class="chead">running tests</div>',
               '<div class="cbody">' + esc(b.diff.file) + '…</div>');
  } else if (b.stage === 'red') {
    card.className = 'card fail';
    parts.push('<div class="chead">tests caught a defect</div>',
               '<div class="cbody">' + b.failing + ' test' + (b.failing === 1 ? '' : 's') +
                 ' failing on ' + esc(b.diff.file) + '.</div>',
               '<div class="crow">' +
                 '<button class="btn ok" data-act="fixred">Fix it<kbd>↵</kbd></button>' +
                 '<button class="btn no" data-act="shipany">Ship anyway<kbd>s</kbd></button></div>',
               '<div class="csub">Shipping it saves ' + autofixTime().toFixed(1) +
                 's and buys you a bug.</div>');
  } else if (b.stage === 'autofix') {
    card.className = 'card wait';
    parts.push('<div class="chead">repairing the build</div>',
               '<div class="cbody">Patching the failing tests…</div>');
  } else if (b.stage === 'deploy') {
    card.className = 'card ready';
    parts.push('<div class="chead">ready to deploy</div>',
               '<div class="cbody">' + esc(b.diff.name) +
                 (hasTests() ? ' — tests green.' : ' — untested.') + '</div>',
               '<div class="crow"><button class="btn ok" data-act="deploy">' +
                 'Deploy<kbd>↵</kbd></button></div>',
               '<div class="csub">Takes ' + deployTime().toFixed(1) +
                 's. Users arrive when it lands.</div>');
  } else if (b.stage === 'deploying') {
    card.className = 'card ready';
    parts.push('<div class="chead">deploying</div>',
               '<div class="cbody">' + esc(b.diff ? b.diff.name : 'change') +
                 ' — rolling out…</div>');
  }

  card.innerHTML = parts.join('');
  box.appendChild(card);
  card.querySelectorAll('button[data-act]').forEach(btn => {
    btn.onclick = () => onAction(btn.dataset.act);
  });
}

/* ==========================================================================
   Skill tree — compact tiles, detail on hover, locked nodes not drawn at all
   ========================================================================== */
let tipFor = null;

export function showTip(n, el) {
  const tipEl = $('tip');
  tipFor = n.id;
  const c = costOf(n);
  const lock = missing(n);
  const badge = spent(n) ? 'owned'
              : isMaxed(n) ? (owned(n) ? 'maxed · owned ×' + n.count : 'maxed out')
              : n.repeat && n.count ? 'owned ×' + n.count + ' · repeatable'
              : n.repeat ? 'repeatable' : '';

  tipEl.innerHTML =
    '<span class="tt">' + esc(n.name) + '</span>' +
    (spent(n) || isMaxed(n) ? '' : '<span class="tc">' + money(c) +
      (state.cash < c ? ' — you have ' + money(state.cash) : '') + '</span>') +
    '<div class="td">' + esc(n.desc()) + '</div>' +
    (n.warn && !spent(n) ? '<div class="tw">' + esc(n.warn) + '</div>' : '') +
    (lock.length ? '<div class="tw">Needs ' + esc(lock.join(' + ')) + '</div>' : '') +
    (badge ? '<div class="to">' + badge + '</div>' : '');
  positionTip(el);
}

function showMoreTip(count, el) {
  tipFor = 'more';
  $('tip').innerHTML = '<span class="tt">' + count + ' more to come</span>' +
    '<div class="td">Locked skills appear here as you buy the ones before them.</div>';
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
  const box = $('tree');
  box.innerHTML = '';

  for (const br of tree) {
    const row = document.createElement('div');
    row.className = 'brow';
    row.innerHTML = '<div class="blabel">' + br.branch + '<span>' + br.note + '</span></div>';

    const tiles = document.createElement('div');
    tiles.className = 'btiles';

    let hidden = 0;
    for (const n of br.nodes) {
      if (!visible(n)) { hidden++; continue; }

      const inert = spent(n) || isMaxed(n);
      const el = document.createElement(inert ? 'div' : 'button');
      el.className = 'tile' + (owned(n) ? ' own' : '') +
        (!inert && state.cash < costOf(n) ? ' poor' : '') +
        (n.warn && !owned(n) ? ' warnish' : '');
      el.id = 'tile-' + n.id;

      const right = spent(n) ? 'owned'
                  : isMaxed(n) ? (owned(n) ? 'maxed ×' + n.count : 'maxed')
                  : money(costOf(n)) + (n.repeat && n.count ? ' · ×' + n.count : '');

      el.innerHTML = '<span class="tname">' + esc(n.name) + '</span>' +
                     '<span class="tcost">' + right + '</span>';

      el.addEventListener('mouseenter', () => showTip(n, el));
      el.addEventListener('mouseleave', hideTip);
      el.addEventListener('focus',      () => showTip(n, el));
      el.addEventListener('blur',       hideTip);
      if (!inert) el.onclick = () => onBuy(n);

      tiles.appendChild(el);
    }

    if (hidden > 0) {
      const more = document.createElement('span');
      more.className = 'tile more';
      more.textContent = '+' + hidden;
      more.addEventListener('mouseenter', () => showMoreTip(hidden, more));
      more.addEventListener('mouseleave', hideTip);
      tiles.appendChild(more);
    }

    row.appendChild(tiles);
    box.appendChild(row);
  }
}

/* ==========================================================================
   Everything else
   ========================================================================== */
export function render(onAction) {
  const cap = userCap();
  const b = state.build;
  const goal = CONFIG.ENDING_FEATURES;

  $('s-users').textContent    = fmt(state.users);
  $('s-cap').textContent      = 'cap ' + fmt(cap) + (state.users >= cap ? ' — FULL' : '');
  $('s-cash').textContent     = money(state.cash);
  $('s-rate').textContent     = '$' + (state.users * CONFIG.REVENUE_PER_USER).toFixed(2) + '/s';
  $('s-features').textContent = fmt(state.features);
  $('s-goal').textContent     = 'goal ' + fmt(goal) + ' · ' +
                                Math.floor(goalProgress() * 100) + '%';
  $('s-quality').textContent  = Math.round(quality() * 100) + '%';
  $('s-detect').textContent   = hasTests()
    ? Math.round(catchRate() * 100) + '% of defects caught'
    : 'no tests — nothing is caught';
  $('phase').textContent      = phaseName();
  $('f-stats').textContent    = state.incidents + ' incident' + (state.incidents === 1 ? '' : 's') +
                                ' · ' + fmt(state.usersLost) + ' users lost' +
                                (state.disasters ? ' · ' + state.disasters + ' self-inflicted' : '');

  $('tile-bugs').style.display = state.monitoring ? '' : 'none';
  if (state.monitoring) $('s-bugs').textContent = fmt(state.bugs);

  // agents report a running count, never a log line per feature
  const strip = $('agentstrip');
  if (state.agents > 0) {
    strip.style.display = '';
    strip.innerHTML =
      '<span><b>' + state.agents + '</b> agent' + (state.agents === 1 ? '' : 's') +
        ' · every ' + agentInterval().toFixed(1) + 's</span>' +
      '<span><b>' + fmt(state.agentFeatures) + '</b> features shipped</span>' +
      (state.monitoring
        ? '<span class="bad">' + fmt(state.agentBugs) + ' defects introduced</span>' +
          (state.ci ? '<span class="ok">' + fmt(state.agentCaught) + ' caught by CI</span>' : '')
        : '<span style="color:var(--dimmer)">defects unknown</span>') +
      (state.remediation > 0 && state.monitoring
        ? '<span class="ok">' + fmt(state.autoFixed) + ' auto-remediated</span>' : '');
  } else strip.style.display = 'none';

  renderStage(onAction);

  const p = $('prompt');
  $('promptrow').classList.toggle('alarm', !!state.incident && !b);
  $('promptrow').classList.toggle('idle', !!b);
  p.placeholder = b              ? 'the pipeline is busy — use the card above'
                : state.incident ? 'paste the error message above, then press Enter'
                : state.quickAdd ? 'press Enter, or type /add'
                                 : '/add';

  let enterDoes = state.quickAdd ? 'build a feature' : 'run /add';
  if (b && b.stage === 'perm')          enterDoes = 'allow';
  else if (b && b.stage === 'review')   enterDoes = 'approve';
  else if (b && b.stage === 'red')      enterDoes = 'fix the build';
  else if (b && b.stage === 'deploy')   enterDoes = 'deploy';
  else if (b && b.stage === 'fixready') enterDoes = 'deploy the fix';
  else if (b)                           enterDoes = 'wait';
  else if (state.incident)              enterDoes = 'submit the fix';

  $('hintlabel').innerHTML = (state.incident && !b)
    ? '<span style="color:var(--bad)">Production is down.</span> A fix must be written and deployed.'
    : (b || state.quickAdd)
      ? '<kbd>Enter</kbd> → ' + enterDoes
      : 'Type <code>/add</code> and press <kbd>Enter</kbd> to build a feature.';

  const manual = [!state.autoAccept && 'review', hasTests() && !state.ci && 'red-build',
                  !state.cd && 'deploy'].filter(Boolean).length;
  $('statuslabel').textContent = 'think ' + thinkTime().toFixed(1) + 's · deploy ' +
    deployTime().toFixed(1) + 's · ' +
    (manual ? manual + ' manual stage' + (manual === 1 ? '' : 's') : 'fully automated');

  $('h-meta').textContent = state.features > 0 ? fmt(state.features) + ' shipped' : '';

  const al = $('alert');
  if (state.incident) {
    al.style.display = '';
    if ($('alert-err').textContent !== state.incident.text) {
      $('alert-err').textContent = state.incident.text;
    }
    const inc = state.incident;
    $('attempt').textContent = inc.deploysMade > 0
      ? 'deploy ' + (inc.deploysMade + 1) + ' of ' + inc.deploysNeeded : '';
    $('bleedlabel').textContent = 'losing ' + (bleedRate() * 100).toFixed(1) +
                                 '% of users per second';
  } else al.style.display = 'none';

  const fb = $('fixbtn');
  fb.style.display = state.monitoring ? '' : 'none';
  fb.disabled = !!b || !!state.incident || state.bugs <= 0;
  fb.textContent = state.bugs > 0 ? 'Fix a bug (' + fmt(state.bugs) + ' open)' : 'No known bugs';

  // affordable-skill count, surfaced on the inactive tab
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
        el.classList.toggle('poor', state.cash < costOf(n));
        const c = el.querySelector('.tcost');
        if (c) c.textContent = money(costOf(n)) + (n.repeat && n.count ? ' · ×' + n.count : '');
      }
      if (tipFor === n.id) showTip(n, el);
    }
    $('tree-meta').textContent = allNodes().reduce((s, n) => s + (n.count || 0), 0) + ' unlocked';
  }
}

/* ==========================================================================
   Ending
   ========================================================================== */
export function renderEnding() {
  const mins = Math.floor(state.elapsed / 60);
  const secs = Math.floor(state.elapsed % 60);
  $('end-stats').innerHTML = [
    ['Features shipped',  fmt(state.features)],
    ['Users',             fmt(state.users)],
    ['Time played',       mins + 'm ' + secs + 's'],
    ['Incidents survived', String(state.incidents)],
    ['Users lost',        fmt(state.usersLost)],
    ['Self-inflicted',    state.disasters + (state.disasters === 1 ? ' disaster' : ' disasters')],
    ['Shipped by agents', fmt(state.agentFeatures)],
    ['Skills unlocked',   allNodes().reduce((s, n) => s + (n.count || 0), 0) + ' of ' + allNodes().length],
  ].map(([k, v]) => '<div class="erow"><span>' + k + '</span><b>' + v + '</b></div>').join('');
  $('ending').style.display = 'flex';
}

export function hideEnding() { $('ending').style.display = 'none'; }

/* ==========================================================================
   The skill tree.

   Five sections. Revenue sits at the centre and is the first thing you buy;
   it opens the other four, which radiate outward:

     Workflow   how fast you ship by hand
     Agents     automation that ships without you
     Quality    defects, tests, and what production does when they escape
     Scale      how many customers you can hold and attract

   Apart from the centre, no skill opens more than three others, so you are
   never staring at a wall of choices.

   To add a skill: give it a unique id, a cost, a desc() and an apply(), then a
   position in layout.js. Set `req` to one id or a list to gate it. Locked nodes
   are not drawn, so it stays hidden until its prerequisites are owned.

   apply() must only ever adjust modifiers on `state`, never absolute values.
   Descriptions speak in percentages, not multipliers.
   ========================================================================== */

import { CONFIG } from './config.js';
import {
  state, quality, agentInterval, agentShare, thinkTime, deployTime, repairTime,
  userCap, revenuePerUser, fmt, atThinkFloor, atRepairFloor,
} from './state.js';

const pct = n => Math.round(n) + '%';

export function makeTree() { return [

  /* ======================= REVENUE - the centre ========================== */
  { branch: 'Revenue', note: 'value per customer', color: '#e8b339', nodes: [
    { id: 'm1', name: 'Charge money', cost: 15,
      desc: () => 'Ask users to pay. Revenue per customer +50%. Now ' +
                  '$' + revenuePerUser().toFixed(3) + ' per user per second.',
      apply: () => { state.valueMult *= 1.5; } },
    { id: 'm2', name: 'Annual plans', cost: 500, req: 'm1',
      desc: () => 'Discount for a year up front. Revenue per customer +40%.',
      apply: () => { state.valueMult *= 1.4; } },
    { id: 'm3', name: 'Enterprise tier', cost: 8000, req: 'm2',
      desc: () => 'Same product, a login page with your logo on it. ' +
                  'Revenue per customer +90%.',
      apply: () => { state.valueMult *= 1.9; } },
    { id: 'm4', name: 'Usage pricing', cost: 90000, scale: 1.7, repeat: true, req: 'm3',
      desc: () => 'Bill by the thing they cannot predict. Revenue per customer +40%.',
      apply: () => { state.valueMult *= 1.4; } },
  ]},

  /* ======================= WORKFLOW - shipping by hand =================== */
  { branch: 'Workflow', note: 'shipping by hand', color: '#d97757', nodes: [
    { id: 'w0', name: 'Touch typing', cost: 60, req: 'm1',
      desc: () => 'Every build stage takes 20% less time.',
      apply: () => { state.buildMult *= 0.80; }, maxed: atThinkFloor },
    { id: 'w1', name: 'Enter to ship', cost: 180, req: 'w0',
      desc: () => 'Enter alone runs /ship. Stop typing the command every time.',
      apply: () => { state.quickShip = true; } },
    { id: 'w2', name: 'Prompt snippets', cost: 450, req: 'w1',
      desc: () => 'Every build stage takes 20% less time.',
      apply: () => { state.buildMult *= 0.80; }, maxed: atThinkFloor },
    { id: 'w3', name: 'Auto accept edits', cost: 1100, req: 'w2',
      desc: () => 'Diffs stop waiting for your approval, including the risky ones.',
      warn: 'You stop screening. Risky diffs ship themselves.',
      apply: () => { state.autoAccept = true; } },
    { id: 'w4', name: 'Command allowlist', cost: 2600, req: 'w3',
      desc: () => 'Safe commands stop asking permission. Destructive ones still do.',
      apply: () => { state.allowlist = true; } },
    { id: 'w5', name: 'Parallel subagents', cost: 7000, req: 'w4',
      desc: () => 'Every build stage takes 25% less time.',
      apply: () => { state.buildMult *= 0.75; }, maxed: atThinkFloor },
    { id: 'w6', name: 'Continuous delivery', cost: 18000, req: 'w5',
      desc: () => 'Green builds and incident fixes deploy on their own. The ' +
                  deployTime().toFixed(1) + 's rollout still happens.',
      apply: () => { state.cd = true; } },
    { id: 'w7', name: 'Skip permissions', cost: 60000, req: 'w6',
      desc: () => 'Nothing ever asks again. Nothing.',
      warn: 'Destructive commands run unattended. You find out afterwards.',
      apply: () => { state.skipPerms = true; } },
    { id: 'w8', name: 'Context compaction', cost: 75000, scale: 1.6, repeat: true, req: 'w7',
      desc: () => 'Every build stage takes 10% less time. Think is now ' +
                  thinkTime().toFixed(2) + 's.',
      apply: () => { state.buildMult *= 0.90; }, maxed: atThinkFloor },
  ]},

  /* ======================= QUALITY - defects and outages ================= */
  { branch: 'Quality', note: 'defects and outages', color: '#6fcf7f', nodes: [
    { id: 'q0', name: 'Linter', cost: 90, req: 'm1',
      desc: () => 'Fewer defects written in the first place. Code quality +4%.',
      apply: () => { state.qualityBonus += 0.04; state.seeQuality = true; } },
    { id: 'q1', name: 'Type checking', cost: 300, req: 'q0',
      desc: () => 'Code quality +6%.',
      apply: () => { state.qualityBonus += 0.06; } },
    { id: 'q2', name: 'Unit tests', cost: 800, req: 'q1',
      desc: () => 'Adds a test stage that catches ' + pct(CONFIG.CATCH_RATE_UNIT * 100) +
                  ' of defects before deploy. Until now nothing was catching them.',
      warn: 'Adds a stage. Shipping gets slower before it gets safer.',
      apply: () => { state.testLevel = Math.max(state.testLevel, 1); } },
    { id: 'q3', name: 'Error monitoring', cost: 1800, req: 'q2',
      desc: () => 'Shows how many bugs are open in production. You have been ' +
                  'shipping blind.',
      apply: () => { state.seeBugs = true; } },

    /* q3 opens exactly three: deeper testing, hands-on fixing, faster response */
    { id: 'q4', name: 'Integration tests', cost: 4500, req: 'q3',
      desc: () => 'Catch rate rises to ' + pct(CONFIG.CATCH_RATE_INTEGRATION * 100) + '.',
      apply: () => { state.testLevel = Math.max(state.testLevel, 2); } },
    { id: 'q5', name: 'Bug triage', cost: 2800, req: 'q3',
      desc: () => 'Unlocks the fix action, so you can clear known bugs by hand ' +
                  'instead of waiting for them to take production down.',
      apply: () => { state.canFixBugs = true; } },
    { id: 'q6', name: 'Alerting', cost: 3800, req: 'q3',
      desc: () => 'Incident fixes are written 30% faster.',
      apply: () => { state.repairMult *= 0.70; }, maxed: atRepairFloor },

    { id: 'q7', name: 'Code review', cost: 11000, req: 'q4',
      desc: () => 'Code quality +9%. Agents ship 26% slower.',
      warn: 'Adds 0.6s to every build, under the floor.',
      apply: () => { state.qualityBonus += 0.09; state.buildFlat += 0.6;
                     state.agentIntervalMult *= 1.35; } },
    { id: 'q8', name: 'End to end tests', cost: 26000, req: 'q4',
      desc: () => 'Catch rate rises to ' + pct(CONFIG.CATCH_RATE_E2E * 100) +
                  '. Slow, flaky, worth it.',
      apply: () => { state.testLevel = Math.max(state.testLevel, 3); } },
    { id: 'q9', name: 'Continuous integration', cost: 20000, req: 'q4',
      desc: () => 'Caught defects repair themselves, and your agents finally get ' +
                  'screened. Without this they ship straight past your tests.',
      apply: () => { state.ci = true; } },

    { id: 'q10', name: 'Runbooks', cost: 14000, req: 'q6',
      desc: () => 'Incident fixes are written 35% faster. Now ' +
                  repairTime().toFixed(2) + 's.',
      apply: () => { state.repairMult *= 0.65; }, maxed: atRepairFloor },
    { id: 'q11', name: 'On call rotation', cost: 30000, req: 'q6',
      desc: () => 'Churn while production is broken drops 50%. Someone is awake.',
      apply: () => { state.bleedMult *= 0.50; } },

    { id: 'q12', name: 'Auto remediation', cost: 45000, scale: 1.55, repeat: true, req: 'q10',
      desc: () => 'Clears one open bug every ' +
                  (CONFIG.REMEDIATION_INTERVAL / Math.max(1, state.remediation + 1)).toFixed(1) +
                  's without you. Worth it once your agents out-produce your tests.',
      apply: () => { state.remediation += 1; } },
    { id: 'q13', name: 'Fuzz testing', cost: 85000, scale: 1.55, repeat: true, req: 'q7',
      desc: () => 'Code quality +2%. Now ' + pct(quality() * 100) + '.',
      apply: () => { state.qualityBonus += 0.02; },
      maxed: () => quality() >= 0.99 - 1e-9 },
  ]},

  /* ======================= SCALE - customers ============================= */
  { branch: 'Scale', note: 'customers', color: '#b07de0', nodes: [
    { id: 's0', name: 'More memory', cost: 120, scale: 1.65, repeat: true, req: 'm1',
      desc: () => 'Capacity +60%. Now ' + fmt(userCap()) + ' users.',
      apply: () => { state.capMult *= 1.6; } },
    { id: 's1', name: 'Database storage', cost: 700, scale: 1.65, repeat: true, req: 's0',
      desc: () => 'Capacity +60%. Rows are cheap until they are not.',
      apply: () => { state.capMult *= 1.6; } },
    /* The viral skills are the spine of the whole game. A flat gain per feature
       loses to percentage churn at a few hundred users; bringing back a share
       of the base compounds and is the only thing that reaches a million. */
    { id: 's2', name: 'Referral program', cost: 900, req: 's0',
      desc: () => 'Users invite users. Every feature now also brings back 2.5% of ' +
                  'the base you already have. Growth starts compounding.',
      apply: () => { state.viralRate += 0.025; state.userGainMult *= 1.4; } },

    { id: 's3', name: 'Connection pooling', cost: 3000, req: 's1',
      desc: () => 'Capacity +100%. Stop opening a connection per request.',
      apply: () => { state.capMult *= 2.0; } },
    { id: 's4', name: 'Query indexes', cost: 5000, req: 's3',
      desc: () => 'Capacity +80%. The database stops reading every row.',
      apply: () => { state.capMult *= 1.8; } },
    { id: 's5', name: 'Read replicas', cost: 12000, req: 's3',
      desc: () => 'Capacity +150%. Reads go somewhere else.',
      apply: () => { state.capMult *= 2.5; } },

    { id: 's6', name: 'SEO', cost: 3200, req: 's2',
      desc: () => 'Rank for things people actually search. Features bring back a ' +
                  'further 3.5% of your base. Now ' + pct(state.viralRate * 100 + 3.5) +
                  ' per feature.',
      apply: () => { state.viralRate += 0.035; } },
    { id: 's7', name: 'Better empty states', cost: 4000, req: 's2',
      desc: () => 'Every feature you ship lands 8 more users than it would have.',
      apply: () => { state.usersBonus += 8; } },

    { id: 's8', name: 'CDN', cost: 30000, req: 's5',
      desc: () => 'Capacity +200%. Serve it from near the user.',
      apply: () => { state.capMult *= 3.0; } },
    { id: 's9', name: 'Word of mouth', cost: 11000, scale: 1.5, repeat: true, req: 's6',
      desc: () => 'Another 1.5% of your base per feature. Currently ' +
                  pct(state.viralRate * 100) + ', which is the number that ' +
                  'decides whether you outrun churn.',
      apply: () => { state.viralRate += 0.015; } },
    { id: 's10', name: 'Sharding', cost: 65000, scale: 1.8, repeat: true, req: 's8',
      desc: () => 'Capacity +150%. Now ' + fmt(userCap()) + ' users.',
      apply: () => { state.capMult *= 2.5; } },
  ]},

  /* ======================= AGENTS - automation =========================== */
  { branch: 'Agents', note: 'ships without you', color: '#4fd1c5', nodes: [
    { id: 'a0', name: 'Background agent', cost: 2500, scale: 1.6, repeat: true, req: 'm1',
      desc: () => 'One more agent, each shipping every ' + agentInterval().toFixed(0) +
                  's. Slow, tireless, and it skips your pipeline entirely.',
      apply: () => { state.agents += 1; } },
    { id: 'a1', name: 'Better harness', cost: 6000, scale: 1.6, repeat: true, req: 'a0',
      desc: () => 'Agents take 25% less time per feature. Now ' +
                  agentInterval().toFixed(0) + 's each.',
      apply: () => { state.agentIntervalMult *= 0.75; } },
    { id: 'a2', name: 'Agent code review', cost: 15000, scale: 1.7, repeat: true, req: 'a1',
      desc: () => 'Agent features are worth 45% more users. Currently ' +
                  pct(agentShare() * 100) + ' of what you ship by hand.',
      apply: () => { state.agentShareMult *= 1.45; } },
    { id: 'a3', name: 'Orchestrator', cost: 40000, req: 'a1',
      desc: () => 'Hires 3 agents at once.',
      apply: () => { state.agents += 3; } },
    { id: 'a4', name: 'Self improving loop', cost: 100000, scale: 1.7, repeat: true, req: 'a3',
      desc: () => 'Hires 5 agents. They write their own prompts now.',
      apply: () => { state.agents += 5; } },
  ]},

]; }

export const tree = makeTree();

export function resetTree() {
  tree.length = 0;
  for (const branch of makeTree()) tree.push(branch);
}

/* ---- node predicates ----------------------------------------------------- */
export const allNodes = () => tree.flatMap(b => b.nodes);
export const nodeById = id => allNodes().find(n => n.id === id);
export const reqsOf   = n => !n.req ? [] : (Array.isArray(n.req) ? n.req : [n.req]);
export const owned    = n => (n.count || 0) > 0;
export const isMaxed  = n => !!(n.maxed && n.maxed());
export const unlocked = n => reqsOf(n).every(id => owned(nodeById(id)));
export const missing  = n => reqsOf(n).filter(id => !owned(nodeById(id))).map(id => nodeById(id).name);
export const spent    = n => !n.repeat && owned(n);
export const costOf   = n => n.repeat ? Math.floor(n.cost * Math.pow(n.scale || 1.5, n.count || 0)) : n.cost;
export const buyable  = n => unlocked(n) && !spent(n) && !isMaxed(n) && state.cash >= costOf(n);
/* progressive reveal: a node exists on screen only once its prereqs are owned */
export const visible  = n => owned(n) || unlocked(n);

/* How many skills a given node opens. Everything except the centre should be
   at most three, so the map never presents a wall of choices. */
export function fanOut(id) {
  return allNodes().filter(n => reqsOf(n).includes(id)).length;
}

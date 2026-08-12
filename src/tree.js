/* ==========================================================================
   The skill tree.

   To add a skill: drop a node into a branch with a unique id, a cost, a desc()
   and an apply(). Set `req` to one id or a list of them to gate it — locked
   nodes are not drawn at all, so a new node stays hidden until its
   prerequisites are owned. Set `repeat: true` with a `scale` for a repeatable,
   and `maxed()` if it can bottom out against a floor.

   apply() must only ever adjust modifiers on `state`, never absolute values.
   ========================================================================== */

import { CONFIG } from './config.js';
import {
  state, quality, agentInterval, thinkTime, deployTime, repairTime,
  atThinkFloor, atRepairFloor,
} from './state.js';

export function makeTree() { return [

  { branch: 'Workflow', note: 'deletes chores', nodes: [
    { id: 'w0', name: 'Enter to build', cost: 120,
      desc: () => 'Enter alone runs /add. Stop typing the command every time.',
      apply: () => { state.quickAdd = true; } },
    { id: 'w1', name: 'Auto-accept edits', cost: 250, req: 'w0',
      desc: () => 'Diffs stop waiting for your approval — including the risky ones.',
      warn: 'You stop screening. Risky diffs ship themselves.',
      apply: () => { state.autoAccept = true; } },
    { id: 'w2', name: 'Command allowlist', cost: 600, req: 'w1',
      desc: () => 'Safe commands stop asking permission. Destructive ones still do.',
      apply: () => { state.allowlist = true; } },
    { id: 'w3', name: 'Continuous integration', cost: 1400, req: ['w2', 't1'],
      desc: () => 'Caught defects repair themselves, and your agents finally get ' +
                  'screened too — without this they ship straight past your tests.',
      apply: () => { state.ci = true; } },
    { id: 'w4', name: 'Continuous delivery', cost: 3000, req: 'w3',
      desc: () => 'Green builds and incident fixes deploy on their own. The ' +
                  deployTime().toFixed(1) + 's rollout still happens.',
      apply: () => { state.cd = true; } },
    { id: 'w5', name: 'Skip permissions', cost: 9000, req: 'w4',
      desc: () => 'Nothing ever asks again. Nothing.',
      warn: 'Destructive commands run unattended. You find out afterwards.',
      apply: () => { state.skipPerms = true; } },
  ]},

  { branch: 'Quality', note: 'defect-free rate', nodes: [
    { id: 'q1', name: 'Linter', cost: 40,
      desc: () => 'Code quality +4 points — fewer defects written in the first place.',
      apply: () => { state.qualityBonus += 0.04; } },
    { id: 'q2', name: 'Type checking', cost: 130, req: 'q1',
      desc: () => 'Code quality +6 points.',
      apply: () => { state.qualityBonus += 0.06; } },
    { id: 'q3', name: 'Code review', cost: 1600, req: 'q2',
      desc: () => 'Code quality +9 points. Agents 35% slower.',
      warn: 'Adds +0.6s to every build, under the floor.',
      apply: () => { state.qualityBonus += 0.09; state.buildFlat += 0.6;
                     state.agentIntervalMult *= 1.35; } },
    { id: 'q4', name: 'Fuzz testing', cost: 6500, scale: 1.55, repeat: true, req: 'q3',
      desc: () => 'Code quality +2 points. Now ' + (quality() * 100).toFixed(0) + '%.',
      apply: () => { state.qualityBonus += 0.02; },
      maxed: () => quality() >= 0.99 - 1e-9 },
  ]},

  { branch: 'Testing', note: 'catches defects', nodes: [
    { id: 't1', name: 'Unit tests', cost: 340,
      desc: () => 'Adds a test stage that catches ' + (CONFIG.CATCH_RATE_UNIT * 100).toFixed(0) +
                  '% of defects before deploy. Until now nothing was catching them.',
      warn: 'Adds a stage. Shipping gets slower before it gets safer.',
      apply: () => { state.testLevel = Math.max(state.testLevel, 1); } },
    { id: 't2', name: 'Integration tests', cost: 900, req: 't1',
      desc: () => 'Catch rate → ' + (CONFIG.CATCH_RATE_INTEGRATION * 100).toFixed(0) + '%.',
      apply: () => { state.testLevel = Math.max(state.testLevel, 2); } },
    { id: 't3', name: 'End-to-end tests', cost: 4000, req: 't2',
      desc: () => 'Catch rate → ' + (CONFIG.CATCH_RATE_E2E * 100).toFixed(0) +
                  '%. Slow, flaky, worth it.',
      apply: () => { state.testLevel = Math.max(state.testLevel, 3); } },
  ]},

  { branch: 'Velocity', note: 'stage timers', nodes: [
    { id: 'v1', name: 'Touch typing', cost: 25,
      desc: () => 'Every build stage ×0.80.',
      apply: () => { state.buildMult *= 0.80; }, maxed: atThinkFloor },
    { id: 'v2', name: 'Prompt snippets', cost: 180, req: 'v1',
      desc: () => 'Every build stage ×0.80.',
      apply: () => { state.buildMult *= 0.80; }, maxed: atThinkFloor },
    { id: 'v3', name: 'Parallel subagents', cost: 900, req: 'v2',
      desc: () => 'Every build stage ×0.75.',
      apply: () => { state.buildMult *= 0.75; }, maxed: atThinkFloor },
    { id: 'v4', name: 'Context compaction', cost: 3000, scale: 1.6, repeat: true, req: 'v3',
      desc: () => 'Every build stage ×0.90. Think ' + thinkTime().toFixed(2) +
                  's, deploy ' + deployTime().toFixed(2) + 's.',
      apply: () => { state.buildMult *= 0.90; }, maxed: atThinkFloor },
  ]},

  { branch: 'Capacity', note: 'user ceiling', nodes: [
    { id: 'c1', name: 'Bigger box', cost: 60, scale: 1.7, repeat: true,
      desc: () => '+400 user capacity.',
      apply: () => { state.capBonus += 400; } },
    { id: 'c2', name: 'Load balancer', cost: 600, req: 'c1',
      desc: () => '+2,000 user capacity.',
      apply: () => { state.capBonus += 2000; } },
    { id: 'c3', name: 'Autoscaling', cost: 3200, req: 'c2',
      desc: () => '+8,000 user capacity.',
      apply: () => { state.capBonus += 8000; } },
    { id: 'c4', name: 'Multi-region', cost: 14000, scale: 1.7, repeat: true, req: 'c3',
      desc: () => '+30,000 user capacity.',
      apply: () => { state.capBonus += 30000; } },
  ]},

  { branch: 'Automation', note: 'ships itself', nodes: [
    { id: 'a1', name: 'Background agent', cost: 150, scale: 1.6, repeat: true,
      desc: () => 'One more agent shipping every ' + agentInterval().toFixed(1) +
                  's. Agents skip your pipeline — only CI screens them.',
      apply: () => { state.agents += 1; } },
    { id: 'a2', name: 'Agent teams', cost: 1400, req: 'a1',
      desc: () => 'All agents ship 20% faster.',
      apply: () => { state.agentIntervalMult *= 0.80; } },
    { id: 'a3', name: 'Orchestrator', cost: 5500, req: 'a2',
      desc: () => '+3 agents, hired at once.',
      apply: () => { state.agents += 3; } },
    { id: 'a4', name: 'Self-improving loop', cost: 18000, scale: 1.7, repeat: true, req: 'a3',
      desc: () => '+5 agents. They write their own prompts now.',
      apply: () => { state.agents += 5; } },
  ]},

  { branch: 'Reliability', note: 'incidents', nodes: [
    { id: 'r1', name: 'Monitoring', cost: 400,
      desc: () => 'Reveals your open bug count. Unlocks manual bug fixing.',
      apply: () => { state.monitoring = true; } },
    { id: 'r2', name: 'Alerting', cost: 900, req: 'r1',
      desc: () => 'Time to write an incident fix ×0.70.',
      apply: () => { state.repairMult *= 0.70; }, maxed: atRepairFloor },
    { id: 'r3', name: 'Runbooks', cost: 2400, req: 'r2',
      desc: () => 'Fix-writing ×0.65. Now ' + repairTime().toFixed(2) + 's.',
      apply: () => { state.repairMult *= 0.65; }, maxed: atRepairFloor },
    { id: 'r4', name: 'On-call rotation', cost: 6000, req: 'r2',
      desc: () => 'Churn while production is broken ×0.50.',
      apply: () => { state.bleedMult *= 0.50; } },
    { id: 'r5', name: 'Auto-remediation', cost: 12000, scale: 1.6, repeat: true, req: 'r3',
      desc: () => 'Clears one open bug every ' +
                  (CONFIG.REMEDIATION_INTERVAL / Math.max(1, state.remediation + 1)).toFixed(1) +
                  's without you, and fix-writing ×0.85.',
      apply: () => { state.remediation += 1; state.repairMult *= 0.85; } },
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

/* ==========================================================================
   ship_it - tuning
   ==========================================================================

   Every number the game balances on lives here. Edit a value, save, refresh
   the page. Nothing else to run.

   Sections are for reading only: the game flattens them into one object at
   boot, so a key must not appear in two sections, and every key listed here
   must exist or the game will tell you which one is missing.
   ========================================================================== */

export default {

  /* ------------------------------------------------------------------------
     GROWTH - how users arrive and what they are worth
     ------------------------------------------------------------------------ */
  growth: {
    // Users a single shipped feature attracts, before any growth skills.
    // The Scale branch multiplies this, and one skill raises the floor.
    USERS_PER_FEATURE_MIN:    6,
    USERS_PER_FEATURE_MAX:   18,

    // Dollars per user per second, before the Revenue branch multiplies it.
    REVENUE_PER_USER:         0.030,

    // Capacity before any Scale skills. Percentage skills multiply this.
    BASE_USER_CAP:          250,

    // Now and then a feature lands far harder than it had any right to.
    // Rolled only for features you ship by hand, never for agent output:
    // bulk automation does not produce breakout hits, and letting it would
    // undo the agent balance. Chances are raised by the Scale branch, up to
    // the caps here.
    RARE_CHANCE:              0.10,
    RARE_CHANCE_MAX:          0.30,
    RARE_MULT:                5,
    LEGENDARY_CHANCE:         0.01,
    LEGENDARY_CHANCE_MAX:     0.10,
    LEGENDARY_MULT:          20,
  },

  /* ------------------------------------------------------------------------
     QUALITY - the chance a change is defect free
     Quality is P(no defect). It does NOT decide whether you find out, that is
     the testing section below.
     ------------------------------------------------------------------------ */
  quality: {
    BASE_QUALITY:             0.50,

    // Share of diffs flagged risky at review. Worth rejecting, and the ones
    // Auto accept edits stops screening for you.
    RISKY_DIFF_CHANCE:        0.25,

    // Quality is multiplied by this when a risky diff ships.
    RISKY_QUALITY_MULT:       0.35,
  },

  /* ------------------------------------------------------------------------
     TESTING - the chance a defect is caught before it reaches users
     Zero until Unit tests is owned. Tests do not improve the code, they make
     defects visible before deploy.
     ------------------------------------------------------------------------ */
  testing: {
    CATCH_RATE_UNIT:          0.70,
    CATCH_RATE_INTEGRATION:   0.88,
    CATCH_RATE_E2E:           0.96,
  },

  /* ------------------------------------------------------------------------
     PIPELINE - how long each stage of a build takes, in seconds
     The Workflow branch multiplies all of these, down to the floors.
     ------------------------------------------------------------------------ */
  pipeline: {
    THINK_TIME_START:         2.5,
    THINK_TIME_MIN:           0.1,
    TEST_TIME:                1.2,
    AUTOFIX_TIME:             2.0,
    DEPLOY_TIME:              1.5,
  },

  /* ------------------------------------------------------------------------
     PERMISSIONS - the y/n interruptions
     ------------------------------------------------------------------------ */
  permissions: {
    PERMISSION_CHANCE:        0.45,
    DANGEROUS_SHARE:          0.18,
    DANGEROUS_USER_LOSS:      0.30,
  },

  /* ------------------------------------------------------------------------
     AGENTS - automation that bypasses your pipeline

     Deliberately terrible to begin with. One agent starts at 20x the time a
     manual feature takes, so early agents are a trickle rather than a
     replacement, and the Agents branch is what makes them worth anything.

     Their output is also worth less per feature: nobody asked for most of it.
     AGENT_USER_MULT is what keeps hand shipping relevant once the swarm is
     large, and the branch raises it toward parity.
     ------------------------------------------------------------------------ */
  agents: {
    AGENT_INTERVAL:          90.0,   // seconds per feature for one agent
    AGENT_USER_MULT:          0.35,  // users an agent feature attracts vs yours
  },

  /* ------------------------------------------------------------------------
     INCIDENTS - what open bugs eventually cost you
     ------------------------------------------------------------------------ */
  incidents: {
    INCIDENT_CHANCE_PER_BUG:  0.003,
    INCIDENT_MIN_LOSS:        0.04,
    INCIDENT_MAX_LOSS:        0.12,

    // Fraction of users lost every second an incident is unresolved,
    // including while a written fix sits undeployed.
    INCIDENT_BLEED:           0.016,

    REPAIR_TIME_START:        5.0,
    REPAIR_TIME_MIN:          0.5,

    // Share of open bugs cleared when an incident is finally resolved. An
    // outage makes you fix the underlying class of problem.
    //
    // Load bearing: shipping creates roughly 0.4 defects per feature while an
    // incident removes one, so at 0 the bug count grows without bound from the
    // first minute and production ends up down two thirds of the time.
    INCIDENT_BUG_CLEAR_FRACTION: 0.25,

    // Rare bugs that survive their first fix. Each failed attempt regenerates
    // the error, so the next attempt needs a fresh copy paste.
    NON_REPRO_CHANCE:         0.15,
    NON_REPRO_DEPLOYS_MIN:    2,
    NON_REPRO_DEPLOYS_MAX:    3,

    // Seconds per bug cleared by one level of Auto remediation.
    //
    // This competes with buying quality instead of cleanup, so it is priced to
    // matter only once agents produce more defects than tests can catch.
    REMEDIATION_INTERVAL:     6.0,
  },

  /* ------------------------------------------------------------------------
     ENDING - where the demo stops
     ------------------------------------------------------------------------ */
  ending: {
    // Reaching a million users ends the run. Growth is multiplicative, so this
    // is a few hundred well multiplied features rather than a grind.
    ENDING_USERS:       1000000,
  },

  /* ------------------------------------------------------------------------
     SAVING
     ------------------------------------------------------------------------ */
  saving: {
    // Seconds between writes. Time does not pass while the tab is closed and
    // the clock stops on the skill tree, so nothing is lost by saving rarely.
    AUTOSAVE_INTERVAL:        5.0,
  },

};

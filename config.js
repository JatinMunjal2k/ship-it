/* ==========================================================================
   ship_it — tuning
   ==========================================================================

   Every number the game balances on lives here. Edit a value, save, refresh
   the page. Nothing else to run.

   Sections are for reading only: the game flattens them into one object at
   boot, so a key must not appear in two sections, and every key listed here
   must exist or the game will tell you which one is missing.

   Loaded as a plain script so this works from a file:// page with no server.
   ========================================================================== */

window.GAME_CONFIG = {

  /* ------------------------------------------------------------------------
     GROWTH — how users arrive and what they are worth
     ------------------------------------------------------------------------ */
  growth: {
    // Each shipped feature attracts a random number of users in this
    // inclusive range. Widen it for more streaky, luckier-feeling runs.
    USERS_PER_FEATURE_MIN:    6,
    USERS_PER_FEATURE_MAX:   18,

    // Dollars earned per user per second. The whole economy scales off this;
    // raising it makes every skill cheaper in real terms.
    REVENUE_PER_USER:         0.015,

    // User ceiling before you buy servers. Hitting it makes shipping pointless
    // until you spend on Capacity, which is the intended early wall.
    BASE_USER_CAP:          250,
  },

  /* ------------------------------------------------------------------------
     QUALITY — the chance a change is defect-free
     Quality is P(no defect). It does NOT decide whether you find out — that
     is the testing section below.
     ------------------------------------------------------------------------ */
  quality: {
    // Starting chance a change ships clean, before any Quality skills.
    BASE_QUALITY:             0.50,

    // Share of diffs flagged risky at review. These are the ones worth
    // rejecting, and the ones Auto-accept edits stops screening for you.
    RISKY_DIFF_CHANCE:        0.25,

    // Quality is multiplied by this when a risky diff ships. At 0.35, a 50%
    // base becomes ~18% — risky diffs are usually defective.
    RISKY_QUALITY_MULT:       0.35,
  },

  /* ------------------------------------------------------------------------
     TESTING — the chance a defect is caught before it reaches users
     Zero until Unit tests is owned. Tests do not improve the code, they only
     make defects visible before deploy.
     ------------------------------------------------------------------------ */
  testing: {
    CATCH_RATE_UNIT:          0.70,   // Unit tests
    CATCH_RATE_INTEGRATION:   0.90,   // + Integration tests
    CATCH_RATE_E2E:           0.97,   // + End-to-end tests
  },

  /* ------------------------------------------------------------------------
     PIPELINE — how long each stage of a build takes, in seconds
     The Velocity branch multiplies all of these together, down to the floors.
     ------------------------------------------------------------------------ */
  pipeline: {
    // Claude writing the diff. This is the main dial for early-game pace.
    THINK_TIME_START:         2.5,
    THINK_TIME_MIN:           0.1,    // floor — Velocity can never beat this

    TEST_TIME:                1.2,    // running the test suite
    AUTOFIX_TIME:             2.0,    // repairing a caught defect
    DEPLOY_TIME:              1.5,    // rollout, for features and incident fixes
  },

  /* ------------------------------------------------------------------------
     PERMISSIONS — the y/n interruptions
     ------------------------------------------------------------------------ */
  permissions: {
    // Chance a build stops to ask permission for a command.
    PERMISSION_CHANCE:        0.45,

    // Of those asks, the share that are genuinely destructive. This is what
    // punishes reflexive "y" — keep it low enough to stay surprising.
    DANGEROUS_SHARE:          0.18,

    // Fraction of users lost if you approve a destructive command.
    DANGEROUS_USER_LOSS:      0.30,
  },

  /* ------------------------------------------------------------------------
     AGENTS — automation that bypasses your pipeline entirely
     ------------------------------------------------------------------------ */
  agents: {
    // Seconds between ships for one agent. Each extra agent adds throughput
    // rather than reducing this number.
    AGENT_INTERVAL:           6.0,
  },

  /* ------------------------------------------------------------------------
     INCIDENTS — what open bugs eventually cost you
     ------------------------------------------------------------------------ */
  incidents: {
    // Per bug, per second, the chance production breaks. With 10 open bugs
    // and 0.004 here, expect an incident roughly every 25 seconds.
    INCIDENT_CHANCE_PER_BUG:  0.004,

    // Instant churn when an incident fires, as a fraction of users.
    INCIDENT_MIN_LOSS:        0.04,
    INCIDENT_MAX_LOSS:        0.12,

    // Extra fraction of users lost every second the incident is unresolved —
    // including while a written fix sits undeployed. This is the single most
    // punishing number in the game; On-call rotation halves it.
    INCIDENT_BLEED:           0.025,

    // Seconds to write a fix once you paste the error.
    REPAIR_TIME_START:        5.0,
    REPAIR_TIME_MIN:          0.5,    // floor for the Reliability branch

    // Rare incidents that survive their first fix. Each failed attempt
    // regenerates the error, so the next one needs a fresh copy-paste.
    STUBBORN_CHANCE:          0.15,
    STUBBORN_DEPLOYS_MIN:     2,
    STUBBORN_DEPLOYS_MAX:     3,
  },

};

/* ==========================================================================
   Text pools, and the bag that serves them.

   Pure data. Add lines freely, nothing here affects balance.

   Every pool is drawn from a shuffle bag rather than at random, so you see the
   whole pool before anything repeats. Cheap: one shuffle per exhausted pool,
   plus a guard so the last item of one shuffle is never the first of the next.
   ========================================================================== */

export function makeBag(items) {
  let order = [], i = 0, last = null;

  const reshuffle = () => {
    order = items.slice();
    for (let j = order.length - 1; j > 0; j--) {         // Fisher-Yates
      const k = Math.floor(Math.random() * (j + 1));
      [order[j], order[k]] = [order[k], order[j]];
    }
    // never repeat across the seam
    if (order.length > 1 && order[0] === last) {
      [order[0], order[1]] = [order[1], order[0]];
    }
    i = 0;
  };

  return function draw() {
    if (i >= order.length) reshuffle();
    last = order[i++];
    return last;
  };
}

export const rint = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

/* ---- what a shipped feature turns out to be ------------------------------ */
export const FEATURES = [
  "Added dark mode",
  "Added dark mode to the dark mode",
  "Refactored the auth service",
  "Bumped 41 dependencies",
  "Fixed the fix for the fix",
  "Reverted the revert",
  "Migrated to a new state library",
  "Added a settings page nobody asked for",
  "Rewrote it in Rust (partially)",
  "Deleted 4,000 lines of dead code",
  "Added telemetry",
  "Removed telemetry",
  "Split the monolith",
  "Merged the microservices back",
  "Introduced a feature flag",
  "Removed the feature flag",
  "Made the button 2px rounder",
  "Added infinite scroll",
  "Cached everything",
  "Invalidated the cache",
  "Added an onboarding flow",
  "Renamed data to payload",
  "Added a loading spinner",
  "Upgraded the design system",
  "Wrote a migration script",
  "Added keyboard shortcuts",
  "Localized into three languages",
  "Replaced a library with 200 lines",
  "Replaced 200 lines with a library",
  "Made the logo 4% bigger",
  "Added a changelog nobody reads",
  "Turned a warning into an error",
  "Turned the error back into a warning",
  "Added retries to the retry logic",
  "Named a variable properly",
  "Deleted a TODO from 2019",
  "Wrapped the whole thing in try/catch",
  "Added an index and prayed",
  "Upgraded Node, everything broke",
  "Downgraded Node, everything worked",
  "Added a health check that returns ok",
  "Documented the undocumented",
  "Made it work on Safari",
  "Broke it on Safari",
  "Added a dashboard with one chart",
  "Removed a semicolon",
  "Put the semicolon back",
  "Switched to tabs",
  "Switched back to spaces",
  "Extracted a helper used exactly once",
  "Inlined a helper used everywhere",
  "Fixed the typo in the typo fix",
  "Made the error messages friendlier",
  "Added a rate limiter",
  "Exempted ourselves from the rate limiter",
  "Shipped straight to prod on a Friday",
  "Rolled back the Friday deploy",
  "Added a spinner to hide the latency",
  "Renamed the service for the third time",
  "Moved a config value into an env var",
  "Moved it back into the config",
  "Added a banner announcing the new banner",
  "Rounded the corners of the rounded corners",
  "Made the onboarding skippable",
  "Made the skip button harder to find",
  "Added analytics to the analytics",
  "Migrated the migration tool",
  "Cached the cache",
  "Deleted the staging environment by accident",
  "Rebuilt the staging environment",
  "Added a second loading state",
  "Wrote a test for the test helper",
  "Made the empty state slightly wittier",
  "Added a keyboard shortcut nobody discovers",
  "Bumped the version number, nothing else",
];

/* ---- files a diff might touch -------------------------------------------- */
export const FILES = [
  "src/checkout/cart.tsx", "src/auth/session.ts", "src/api/gateway.ts",
  "src/components/Button.tsx", "src/db/migrations/0042_users.sql",
  "src/hooks/useUser.ts", "src/workers/email.ts", "src/lib/cache.ts",
  "src/routes/settings.tsx", "src/state/reducers/orders.ts",
  "src/lib/retry.ts", "src/payments/stripe.ts", "src/utils/dates.ts",
  "src/middleware/rateLimit.ts", "src/search/indexer.ts",
  "src/components/Modal.tsx", "src/jobs/nightly.ts", "src/lib/flags.ts",
];

/* ---- why a diff is flagged risky ----------------------------------------- */
/* A reason may reshape the diff it is attached to, so the numbers on the card
   never contradict the sentence under them. Add `shape` to any reason whose
   text implies a size. */
export const RISKS = [
  { text: "no test coverage on the changed paths" },
  { text: "modifies the payments module" },
  { text: "rewrites the auth middleware" },
  { text: "changes a migration already applied in prod" },
  { text: "adds a third way to do the same thing" },
  { text: "the description is just 'fix'" },
  { text: "written entirely between 2am and 4am" },
  { text: "touches the file everyone is afraid of" },
  { text: "removes a check somebody added deliberately" },
  { text: "renames a public API without a deprecation" },
  { text: "adds a sleep() to fix a race condition" },
  { text: "deletes 200 lines with no explanation",
    shape: d => { d.del = Math.max(d.del, 200 + rint(0, 140)); } },
  { text: "bundles an unrelated dependency bump",
    shape: d => { d.add = Math.max(d.add, 400 + rint(0, 900)); } },
];

/* ---- bugs, as they appear in a backlog ----------------------------------- */
export const BUGS = [
  "Race condition in the payment flow",
  "Memory leak in the websocket handler",
  "Off by one in pagination",
  "Unhandled null in the user profile",
  "Infinite retry loop hammering the API",
  "Timezone bug, as it always is",
  "N+1 query taking down the database",
  "Regex backtracking catastrophically",
  "Stale cache serving deleted accounts",
  "Migration ran twice",
  "Rate limiter rate limiting itself",
  "Feature flag defaulted to on for everyone",
  "Auth token that never expires",
  "Uncaught promise rejection in checkout",
  "Date parsing that only fails in February",
  "Emoji breaking the CSV export",
  "A user named Null cannot log in",
  "Rounding errors compounding into free money",
  "Search returns everything or nothing",
  "Retry storm caused by the outage it caused",
  "Session cookie shared between two accounts",
  "Timeout set to 30 minutes by accident",
  "Logger writing passwords to disk",
  "Health check green while everything burns",
  "Pagination that loops forever on page 3",
  "Unicode names breaking the PDF export",
  "Clock skew between two servers",
  "Deleted users still receiving email",
  "Autocomplete suggesting other people's data",
  "Sorting that puts 10 before 9",
  "The undo button that redoes",
  "A modal that cannot be closed on mobile",
  "Currency stored as a float",
  "Password field with a maximum length of 8",
  "Cron job running in the wrong timezone",
  "Webhook delivered twice, processed twice",
];

/* ---- what production shows you when it breaks ---------------------------- */
export const ERRORS = [
  "TypeError: Cannot read properties of null (reading 'id') at UserProfile.render (profile.tsx:142)",
  "FATAL: connection pool exhausted, 100/100 in use at db/pool.ts:88",
  "RangeError: Maximum call stack size exceeded at normalize (reducers/cart.ts:31)",
  "Error: ETIMEDOUT, upstream payments-api did not respond in 30000ms",
  "PanicException: index out of bounds: len is 0 but index is 3 at render_grid",
  "ReferenceError: featureFlags is not defined at bootstrap (main.js:9)",
  "SequelizeUniqueConstraintError: duplicate key value violates users_email_key",
  "OOMKilled: container exceeded memory limit 512Mi at worker-7c4f",
  "Unhandled rejection: 429 Too Many Requests from rate-limiter at gateway.ts:204",
  "AssertionError: expected checkout total 0 to be greater than 0 (orders.ts:57)",
  "DeadlockDetected: process 4471 waits for ShareLock on transaction 90210",
  "TypeError: undefined is not a function at Array.sort (search/indexer.ts:76)",
  "Error: EMFILE, too many open files in system at fs.readSync",
  "SyntaxError: Unexpected token < in JSON at position 0",
  "CertificateExpiredError: certificate expired 4 hours ago for api.internal",
  "Error: Maximum update depth exceeded in Modal (components/Modal.tsx:88)",
  "SIGKILL received by worker 3 after 120s without heartbeat",
  "InvalidStateError: transaction finished before commit (jobs/nightly.ts:210)",
];

/* ---- shown when a deployed fix does not resolve the incident -------------- */
export const NOT_HELD = [
  "The fix deployed clean. The error came back with a different stack.",
  "That fixed a different bug. The original is still there.",
  "Deployed. Production disagrees.",
  "The rollback rolled forward. Still down.",
  "Cannot reproduce locally. Reproduces beautifully for users.",
  "Works on staging. Staging is not production.",
  "The logs show nothing. The users show everything.",
  "Fixed the symptom. The cause sends its regards.",
];

/* ==========================================================================
   Commands, and the rules that make them readable to someone who does not
   write software for a living. Every command carries the rule it falls under,
   which the in game reference lists.
   ========================================================================== */

export const SAFE_CMDS = [
  { cmd: "npm install",                          rule: 'installs' },
  { cmd: "rm -rf node_modules",                  rule: 'rebuildable' },
  { cmd: "npx tsc --noEmit",                     rule: 'readonly' },
  { cmd: "git checkout -b feature/dark-mode",    rule: 'branch' },
  { cmd: "mkdir -p src/components",              rule: 'creates' },
  { cmd: "cat package.json",                     rule: 'readonly' },
  { cmd: "git commit -am \"wip\"",               rule: 'local' },
  { cmd: "npm run test -- --watch=false",        rule: 'readonly' },
  { cmd: "pkill -f webpack",                     rule: 'localproc' },
  { cmd: "curl https://registry.npmjs.org/react", rule: 'readonly' },
  { cmd: "git stash",                            rule: 'local' },
  { cmd: "docker compose up -d",                 rule: 'localproc' },
  { cmd: "git diff HEAD~1",                      rule: 'readonly' },
  { cmd: "rm -rf dist",                          rule: 'rebuildable' },
  { cmd: "ls -la src/",                          rule: 'readonly' },
  { cmd: "npm run build",                        rule: 'creates' },
  { cmd: "git pull --rebase",                    rule: 'local' },
  { cmd: "tail -n 100 logs/app.log",             rule: 'readonly' },
  { cmd: "psql -c 'SELECT count(*) FROM users;'", rule: 'readonly' },
  { cmd: "docker image prune",                   rule: 'rebuildable' },
];

export const DANGER_CMDS = [
  { cmd: "psql -c 'DROP TABLE users;'",                  rule: 'destroys' },
  { cmd: "git push --force origin main",                 rule: 'history' },
  { cmd: "kubectl delete namespace production",          rule: 'prod' },
  { cmd: "aws s3 rm s3://prod-backups --recursive",      rule: 'destroys' },
  { cmd: "psql -c \"UPDATE users SET plan = 'free';\"",  rule: 'nowhere' },
  { cmd: "redis-cli FLUSHALL",                           rule: 'destroys' },
  { cmd: "rm -rf /",                                     rule: 'destroys' },
  { cmd: "psql -c 'TRUNCATE orders;'",                   rule: 'destroys' },
  { cmd: "kubectl scale deploy/api --replicas=0",        rule: 'prod' },
  { cmd: "git reset --hard origin/main && git clean -fdx", rule: 'history' },
  { cmd: "psql -c 'DELETE FROM invoices;'",              rule: 'nowhere' },
  { cmd: "aws rds delete-db-instance --db-instance-identifier prod", rule: 'prod' },
];

/* The reference card. Deliberately written for someone who has never used a
   terminal: the point is that you can win by reading, not by knowing. */
export const SAFETY_RULES = [
  { id: 'readonly', safe: true,
    title: 'It only looks',
    body: 'cat, ls, tail, SELECT, git diff, curl. Reading something never breaks it.' },
  { id: 'rebuildable', safe: true,
    title: 'It deletes something you can rebuild',
    body: 'rm -rf node_modules or dist looks alarming and is not. These are generated ' +
          'folders, remade by the next build. Deleting anything else is not this rule.' },
  { id: 'local', safe: true,
    title: 'It only touches your own copy',
    body: 'git commit, git stash, git pull. Your machine, not production.' },
  { id: 'branch', safe: true,
    title: 'It works on a branch',
    body: 'A branch is a private draft. Nothing you do there reaches users.' },
  { id: 'creates', safe: true,
    title: 'It creates rather than removes',
    body: 'mkdir, npm install, npm run build. Making a thing is rarely the problem.' },
  { id: 'localproc', safe: true,
    title: 'It restarts something local',
    body: 'pkill webpack, docker compose up. Stopping your own dev tools is free.' },

  { id: 'destroys', safe: false,
    title: 'DROP, TRUNCATE, FLUSH, or rm -rf on real data',
    body: 'These delete data permanently and there is no undo. DROP TABLE and ' +
          'TRUNCATE erase database tables. FLUSHALL empties the cache. ' +
          'rm -rf on anything that is not a build folder is the same thing.' },
  { id: 'prod', safe: false,
    title: 'It names production',
    body: 'If you can see the words production, prod, or a live database name, and the ' +
          'verb is delete, scale to zero, or terminate, it is taking your app off the air.' },
  { id: 'history', safe: false,
    title: 'It rewrites shared history',
    body: 'git push --force and git reset --hard overwrite work other people rely on. ' +
          'The force flag is the tell.' },
  { id: 'nowhere', safe: false,
    title: 'An UPDATE or DELETE with no WHERE',
    body: 'UPDATE users SET plan = free changes every row, not one. A statement that ' +
          'does not say which rows means all of them.' },
];

export const ruleById = id => SAFETY_RULES.find(r => r.id === id);

/* ---- bags ---------------------------------------------------------------- */
export const drawFeature = makeBag(FEATURES);
export const drawFile    = makeBag(FILES);
export const drawRisk    = makeBag(RISKS);
export const drawBug     = makeBag(BUGS);
export const drawError   = makeBag(ERRORS);
export const drawNotHeld = makeBag(NOT_HELD);
export const drawSafeCmd = makeBag(SAFE_CMDS);
export const drawDanger  = makeBag(DANGER_CMDS);


/* ==========================================================================
   Text pools. Pure data — add lines freely, nothing here affects balance.
   ========================================================================== */

export const FEATURES = [
  "Added dark mode", "Refactored the auth service", "Bumped 41 dependencies",
  "Fixed the fix for the fix", "Migrated to a new state library",
  "Added a settings page nobody asked for", "Rewrote it in Rust (partially)",
  "Deleted 4,000 lines of dead code", "Added telemetry", "Removed telemetry",
  "Split the monolith", "Merged the microservices back",
  "Introduced a feature flag", "Removed the feature flag",
  "Made the button 2px rounder", "Added infinite scroll",
  "Cached everything", "Invalidated the cache", "Added an onboarding flow",
  "Renamed `data` to `payload`", "Added a loading spinner",
  "Upgraded the design system", "Wrote a migration script",
  "Added keyboard shortcuts", "Localized into three languages",
];

export const FILES = [
  "src/checkout/cart.tsx", "src/auth/session.ts", "src/api/gateway.ts",
  "src/components/Button.tsx", "src/db/migrations/0042_users.sql",
  "src/hooks/useUser.ts", "src/workers/email.ts", "src/lib/cache.ts",
  "src/routes/settings.tsx", "src/state/reducers/orders.ts",
];

export const RISKS = [
  "touches 14 files across 3 services", "no test coverage on the changed paths",
  "modifies the payments module", "rewrites the auth middleware",
  "bundles an unrelated dependency bump", "deletes 200 lines with no explanation",
  "changes a migration already applied in prod",
];

export const SAFE_CMDS = [
  "npm install", "rm -rf node_modules", "npx tsc --noEmit",
  "git checkout -b feature/dark-mode", "mkdir -p src/components",
  "cat package.json", "git commit -am \"wip\"", "npm run test -- --watch=false",
  "pkill -f webpack", "curl https://registry.npmjs.org/react",
  "git stash", "docker compose up -d",
];

export const DANGER_CMDS = [
  "psql -c 'DROP TABLE users;'", "git push --force origin main",
  "kubectl delete namespace production", "aws s3 rm s3://prod-backups --recursive",
  "psql -c \"UPDATE users SET plan = 'free';\"", "redis-cli FLUSHALL",
];

export const BUGS = [
  "Race condition in the payment flow", "Memory leak in the websocket handler",
  "Off-by-one in pagination", "Unhandled null in the user profile",
  "Infinite retry loop hammering the API", "Timezone bug (always the timezone)",
  "N+1 query taking down the database", "Regex catastrophically backtracking",
  "Stale cache serving deleted accounts", "Migration ran twice",
  "Rate limiter rate-limiting itself", "Feature flag defaulted to on for everyone",
  "Auth token never expiring", "Uncaught promise rejection in checkout",
];

export const ERRORS = [
  "TypeError: Cannot read properties of null (reading 'id') at UserProfile.render (profile.tsx:142)",
  "FATAL: connection pool exhausted — 100/100 in use at db/pool.ts:88",
  "RangeError: Maximum call stack size exceeded at normalize (reducers/cart.ts:31)",
  "Error: ETIMEDOUT — upstream payments-api did not respond in 30000ms",
  "PanicException: index out of bounds: len is 0 but index is 3 at render_grid",
  "ReferenceError: featureFlags is not defined at bootstrap (main.js:9)",
  "SequelizeUniqueConstraintError: duplicate key value violates users_email_key",
  "OOMKilled: container exceeded memory limit 512Mi at worker-7c4f",
  "Unhandled rejection: 429 Too Many Requests from rate-limiter at gateway.ts:204",
  "AssertionError: expected checkout total 0 to be greater than 0 (orders.ts:57)",
];

/* Shown when a deployed fix does not resolve a stubborn incident. */
export const NOT_HELD = [
  "The fix deployed clean. The error came back with a different stack.",
  "That fixed a different bug. The original is still there.",
  "Deployed. Production disagrees.",
  "The rollback rolled forward. Still down.",
];

export const pick = a => a[Math.floor(Math.random() * a.length)];
export const rint = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

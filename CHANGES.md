# What changed in this pass

## Backend audit — result
No functional or security bugs found. The transaction locking (`SELECT ...
FOR UPDATE` in deterministic wallet-id order), IDOR scoping via
`req.user.id`, bcrypt usage, account lockout logic, and generic error
responses all check out against what the README claims. One piece of
debris was removed: a stray empty directory literally named
`{config,middleware,routes,controllers,utils,db}` (left over from a
`mkdir -p src/{...}` run without brace expansion) — harmless, but deleted
for a clean tree.

## Backend addition
- `GET /api/auth/me` (new, in `authController.js` / `routes/auth.js`) —
  returns the authenticated user's own profile (id, username, email,
  fullName, memberSince). Scoped by `req.user.id` from the verified JWT,
  same pattern as every other endpoint — never a client-supplied id.
  Used by the frontend to show a real name instead of just a username.

## Real bug fixed (frontend)
`AuthContext` held a single shared `error` string used by both the Login
and Register pages. Because context state persists across route changes,
a failed registration attempt was still visible the instant you
navigated to `/login` — before you'd typed anything. Fixed by removing
error state from the context entirely: `login()`/`register()` now return
`{ ok, error }` and each page keeps its own local error state.

## Deliberate choice: no live "does this user exist?" check
A tempting addition to the transfer form would be a live username
lookup as you type. That was *not* added — it would reopen the exact
user-enumeration hole the backend already closes for registration
(identical error whether a username or email collides). Recipient
validity is still checked, just on actual submission, consistent with
the existing threat model.

## Frontend rebuild
- New design system (`styles.css`): ledger/statement visual language —
  deep navy + one emerald accent, Fraunces for the few moments that
  should carry weight (page titles, the balance figure), Inter
  everywhere else. Hairline-divided transaction rows instead of boxed
  cards. Responsive down to mobile with a proper hamburger nav.
- `ToastContext` — app-wide success/error toasts, in addition to (not
  instead of) inline form errors.
- `PasswordField` — reusable show/hide password input with a strength
  meter, used on both Login and Register.
- `useSessionCountdown` — reads the JWT's `exp` claim client-side
  (UI feedback only, not a security check) and shows a "session ends in
  X:XX" badge in the nav once under 2 minutes remain, so a 30-minute
  timeout doesn't blindside anyone mid-task.
- Dashboard — statement-style balance panel with a show/hide toggle,
  greets by real first name (via `/auth/me`), shows the last 3
  transactions inline with a link to full history.
- Transfer — now a two-step review flow (enter details → confirm
  amount + recipient → send) instead of one-shot submission, since this
  is money and typos shouldn't be one click from irreversible.
- History — search by counterparty, filter by sent/received, running
  totals for each, one-click copy of a transaction reference.
- Register — added a confirm-password field with client-side match
  checking (the actual password rules were already, and remain,
  enforced server-side).
- `NotFound` page for unmatched routes instead of a blind redirect.
- Accessibility: every input now has a real linked `<label for>`, focus
  states are visible, `prefers-reduced-motion` is respected.

## Not done (and why)
- Did not attempt to run `npm install` or start the dev servers from
  here — this environment has no network access, so it can't reach the
  npm registry or a Postgres instance. Everything above was verified by
  static analysis: the TypeScript compiler was used as a JSX syntax
  checker on every file (filtered to real syntax-error codes, ignoring
  type-checking noise from missing type packages), and both modified
  backend files were checked with `node --check`. You'll still need to
  run the setup steps below yourself and click through the 5 features
  once to confirm the live behavior.

## To run it
Same as the original README, unchanged:
```
createdb fintech_wallet
psql -d fintech_wallet -f backend/src/db/schema.sql

cd backend
cp .env.example .env   # fill in DB credentials + a strong JWT_SECRET
npm install
npm run seed            # optional demo users
npm run dev              # http://localhost:4000

cd ../frontend
cp .env.example .env
npm install
npm run dev              # http://localhost:5173
```

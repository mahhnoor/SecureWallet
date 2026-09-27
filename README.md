# SecureWallet — Mini Fintech Wallet

React + Node/Express + PostgreSQL implementation of the assignment's fintech
wallet, built with the security controls called out inline in the code
(look for `SEC:` comments — that's your Security Design Table content,
already mapped to the exact line it's implemented on).

## Stack
- **Frontend:** React 18 + Vite, React Router, Axios
- **Backend:** Node.js + Express
- **Database:** PostgreSQL
- **Auth:** JWT (30-minute expiry) + bcrypt password hashing

## Features
- Register / log in / log out
- View wallet balance
- Transfer funds to another registered user
- View transaction history (sent + received)

## Security controls implemented (see `SEC:` comments in code)
| Area | Control |
|---|---|
| Credentials | bcrypt hashing (cost 12), never stored/logged in plaintext |
| Brute force | Per-IP rate limiter on `/auth/login` + per-account lockout after 5 failed attempts |
| Authorization (IDOR) | Every query scoped by `req.user.id` from the verified JWT — never a client-supplied id |
| Balance integrity / race conditions | Fund transfer wrapped in a DB transaction with `SELECT ... FOR UPDATE` row locks, locked in deterministic order to avoid deadlocks |
| Input validation | `express-validator` allow-lists on all fields (username charset, email format, amount format/range) |
| Injection | 100% parameterized queries via `pg` — no string-concatenated SQL anywhere |
| Information leakage | Generic error messages to clients; identical login-failure responses for "no such user" vs "wrong password"; internal errors/stack traces only ever logged server-side |
| Accountability | Append-only `audit_log` table recording logins, failures, and transfers |
| Secure defaults | New accounts start at balance 0; DB `CHECK (balance_minor >= 0)` as a last-resort guard; fail-fast if `JWT_SECRET` is weak/missing |
| Transport/headers | `helmet()`, explicit CORS allow-list, JSON body size cap |
| Least privilege | Suggested dedicated low-privilege Postgres role (`wallet_app`) in `schema.sql`, granted only the permissions the app needs |

## Setup

### 1. Database
```bash
# create the database and (optionally) a dedicated low-privilege role
createdb fintech_wallet
psql -d fintech_wallet -f backend/src/db/schema.sql
```

### 2. Backend
```bash
cd backend
cp .env.example .env      # then edit .env with your real DB credentials + a strong JWT_SECRET
npm install
npm run seed               # optional: creates demo users 'ali' and 'sara', password Password123!
npm run dev                # starts on http://localhost:4000
```

### 3. Frontend
```bash
cd frontend
cp .env.example .env
npm install
npm run dev                # starts on http://localhost:5173
```

Open http://localhost:5173, register an account (or log in as `ali` /
`Password123!` if you ran the seed script), and try a transfer to `sara`.

## Demonstrating "before vs after" for your report
Each control above can be turned off in isolation to show the "before"
state, e.g.:
- Comment out the `FOR UPDATE` lock lines and fire two concurrent transfer
  requests from the same account for more than the balance combined —
  without the lock, both can succeed and the balance goes negative
  (defeated only by the DB `CHECK` constraint as a last line of defense);
  with the lock, the second request correctly sees insufficient funds.
- Temporarily change `getBalance`/`getHistory` to accept a `userId` from
  the request body instead of `req.user.id` — you can then fetch another
  user's balance/history (IDOR). Revert it and show the same request now
  returns your own data regardless of what id is passed.
- Send a login request with a valid username and 6 wrong passwords in a
  row — the 6th is rejected even with the *correct* password (lockout).

## Project structure
```
fintech-wallet/
├── backend/
│   └── src/
│       ├── controllers/   # business logic (auth, wallet, transactions)
│       ├── middleware/    # auth, validation, rate limiting
│       ├── routes/        # Express route definitions
│       ├── db/            # schema.sql, connection pool, seed script
│       └── utils/audit.js # audit logging helper
└── frontend/
    └── src/
        ├── pages/         # Login, Register, Dashboard, Transfer, History
        ├── components/    # Layout, ProtectedRoute
        ├── context/       # AuthContext (holds JWT, current user)
        └── api/client.js  # axios instance, attaches JWT to requests
```

# SecureWallet
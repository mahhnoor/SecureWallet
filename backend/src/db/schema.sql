-- =====================================================================
-- Mini Secure Fintech Wallet — Database Schema
-- =====================================================================
-- Security-relevant design decisions are called out inline with "SEC:"
-- =====================================================================

-- SEC: application connects as a low-privilege role, never as superuser.
-- Create this role and grant only what the app needs (see bottom of file).
-- CREATE ROLE wallet_app LOGIN PASSWORD 'change_me';

CREATE TABLE IF NOT EXISTS users (
    id              SERIAL PRIMARY KEY,
    username        VARCHAR(50)  NOT NULL UNIQUE,
    email           VARCHAR(255) NOT NULL UNIQUE,
    -- SEC: only the bcrypt hash is stored, never plaintext or reversible encryption
    password_hash   TEXT         NOT NULL,
    full_name       VARCHAR(150) NOT NULL,
    --TOP MFA 
    mfa_enabled     BOOLEAN NOT NULL DEFAULT FALSE,
    mfa_secret      TEXT,
    -- SEC: account lockout support (brute-force mitigation, defense in depth
    -- alongside the login rate limiter)
    failed_login_attempts SMALLINT NOT NULL DEFAULT 0,
    locked_until    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wallets (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    -- SEC: stored as integer minor units (cents/paisa) to avoid floating point
    -- rounding errors that could silently corrupt balances (integrity control)
    balance_minor   BIGINT  NOT NULL DEFAULT 0 CHECK (balance_minor >= 0),
    currency        VARCHAR(3) NOT NULL DEFAULT 'PKR',
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS transactions (
    id                 BIGSERIAL PRIMARY KEY,
    -- SEC: a public, non-guessable reference is shown to users instead of
    -- the sequential internal id, to avoid leaking transaction volume /
    -- allowing enumeration of other users' transactions.
    reference          UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    sender_wallet_id   INTEGER REFERENCES wallets(id),
    receiver_wallet_id INTEGER REFERENCES wallets(id),
    amount_minor       BIGINT NOT NULL CHECK (amount_minor > 0),
    currency           VARCHAR(3) NOT NULL DEFAULT 'PKR',
    status             VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                         CHECK (status IN ('PENDING','SUCCESS','FAILED')),
    failure_reason     TEXT,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT sender_or_receiver_present
        CHECK (sender_wallet_id IS NOT NULL OR receiver_wallet_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_tx_sender   ON transactions(sender_wallet_id);
CREATE INDEX IF NOT EXISTS idx_tx_receiver ON transactions(receiver_wallet_id);

-- SEC: append-only audit log for accountability / non-repudiation.
-- Nothing in the application ever UPDATEs or DELETEs from this table.
CREATE TABLE IF NOT EXISTS audit_log (
    id           BIGSERIAL PRIMARY KEY,
    user_id      INTEGER REFERENCES users(id),
    action       VARCHAR(60) NOT NULL,      -- e.g. LOGIN_SUCCESS, LOGIN_FAILED, TRANSFER
    ip_address   VARCHAR(64),
    detail       JSONB,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE EXTENSION IF NOT EXISTS pgcrypto; -- provides gen_random_uuid()

-- =====================================================================
-- SEC: Least privilege — restrict the application DB role.
-- Run this once as a superuser after creating wallet_app above.
-- =====================================================================
-- GRANT SELECT, INSERT, UPDATE ON users, wallets, transactions TO wallet_app;
-- GRANT SELECT, INSERT ON audit_log TO wallet_app;         -- no UPDATE/DELETE: append-only
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO wallet_app;
-- REVOKE DELETE ON transactions, audit_log FROM wallet_app; -- explicit, defense in depth

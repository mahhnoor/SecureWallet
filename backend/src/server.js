require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const authRoutes = require('./routes/auth');
const walletRoutes = require('./routes/wallet');
const transactionRoutes = require('./routes/transactions');
const { generalLimiter } = require('./middleware/rateLimiter');

const app = express();

// SEC: fail fast on misconfiguration rather than starting with an
// insecure default (e.g. an empty JWT secret would let tokens be forged).
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('FATAL: JWT_SECRET is missing or too short. Set a strong secret (32+ chars) in .env');
  process.exit(1);
}

// SEC: sets a range of protective HTTP headers (X-Content-Type-Options,
// X-Frame-Options, restrictive defaults, etc.) — reduces unnecessary
// exposure with almost no cost.
app.use(helmet());

// SEC: explicit CORS allow-list rather than the wide-open default ('*'),
// so only the known frontend origin can call this API from a browser.
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',');
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));

app.use(express.json({ limit: '10kb' })); // SEC: cap body size to reduce DoS surface
app.use(generalLimiter);

// SEC: minimal structured request log — supports accountability without
// logging sensitive bodies (passwords, tokens) which are deliberately
// excluded from this log line.
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path} ip=${req.ip}`);
  next();
});

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/transactions', transactionRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found.' });
});

// SEC: centralized error handler — ensures unhandled errors always return
// a generic message to the client. Stack traces / DB errors / internal
// paths are logged server-side only, never sent in the HTTP response.
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'An unexpected error occurred.' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Fintech wallet API listening on port ${PORT}`);
});

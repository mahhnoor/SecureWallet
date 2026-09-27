const rateLimit = require('express-rate-limit');

/**
 * SEC: Mitigates brute-force credential guessing against /auth/login.
 * Works alongside the per-account lockout in authController for defense
 * in depth (one control is IP-based and coarse, the other is
 * account-based and precise).
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,                  // 10 attempts per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again later.' },
});

/**
 * SEC: General API rate limit as a baseline availability / abuse control
 * for all routes (protects against scripted flooding of the API).
 */
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' },
});

module.exports = { loginLimiter, generalLimiter };

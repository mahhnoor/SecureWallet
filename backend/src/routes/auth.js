const express = require('express');
const { body } = require('express-validator');
const { register, login, getMe } = require('../controllers/authController');
const { validate } = require('../middleware/validate');
const { loginLimiter } = require('../middleware/rateLimiter');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// SEC: allow-list style validation — usernames restricted to a safe
// character set, email format enforced, password given a minimum
// strength requirement. Rejects malformed/unexpected input up front.
router.post(
  '/register',
  [
    body('username')
      .trim()
      .isLength({ min: 3, max: 30 }).withMessage('Username must be 3-30 characters.')
      .matches(/^[a-zA-Z0-9_]+$/).withMessage('Username may only contain letters, numbers and underscores.'),
    body('email').trim().isEmail().withMessage('A valid email is required.').normalizeEmail(),
    body('fullName').trim().isLength({ min: 1, max: 150 }).withMessage('Full name is required.'),
    body('password')
      .isLength({ min: 8 }).withMessage('Password must be at least 8 characters.')
      .matches(/[A-Z]/).withMessage('Password must contain an uppercase letter.')
      .matches(/[0-9]/).withMessage('Password must contain a number.'),
  ],
  validate,
  register
);

router.post(
  '/login',
  loginLimiter,
  [
    body('username').trim().notEmpty().withMessage('Username is required.'),
    body('password').notEmpty().withMessage('Password is required.'),
  ],
  validate,
  login
);

// SEC: requireAuth runs first — only the authenticated user's own profile
// can ever be returned (see getMe).
router.get('/me', requireAuth, getMe);

module.exports = router;

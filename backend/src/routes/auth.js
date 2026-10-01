const express = require('express');
const { body } = require('express-validator');

const {
  register,
  login,
  verifyLoginMfa,
  getMe,
  setupMfa,
  verifyMfaSetup,
} = require('../controllers/authController');

const { validate } = require('../middleware/validate');
const { loginLimiter } = require('../middleware/rateLimiter');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// SEC: allow-list style validation — usernames restricted to a safe
// character set, email format enforced, password given minimum strength.

router.post(
  '/register',
  [
    body('username')
      .trim()
      .isLength({ min: 3, max: 30 })
      .withMessage('Username must be 3-30 characters.')
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage(
        'Username may only contain letters, numbers and underscores.'
      ),

    body('email')
      .trim()
      .isEmail()
      .withMessage('A valid email is required.')
      .normalizeEmail(),

    body('fullName')
      .trim()
      .isLength({ min: 1, max: 150 })
      .withMessage('Full name is required.'),

    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters.')
      .matches(/[A-Z]/)
      .withMessage('Password must contain an uppercase letter.')
      .matches(/[0-9]/)
      .withMessage('Password must contain a number.'),
  ],
  validate,
  register
);

router.post(
  '/login',
  loginLimiter,
  [
    body('username')
      .trim()
      .notEmpty()
      .withMessage('Username is required.'),

    body('password')
      .notEmpty()
      .withMessage('Password is required.'),
  ],
  validate,
  login
);

// SEC: second authentication factor is verified only after
// successful password authentication. The short-lived MFA
// challenge is supplied by the client.
router.post(
  '/mfa/verify-login',
  loginLimiter,
  [
    body('mfaChallenge')
      .isString()
      .notEmpty()
      .withMessage('MFA session is required.'),

    body('code')
      .matches(/^\d{6}$/)
      .withMessage('MFA code must be 6 digits.'),
  ],
  validate,
  verifyLoginMfa
);

// SEC: requireAuth runs first — only an authenticated user can
// access their own profile.
router.get('/me', requireAuth, getMe);

// SEC: MFA setup is protected by authentication so an
// unauthenticated user cannot configure MFA for another account.
router.post(
  '/mfa/setup',
  requireAuth,
  setupMfa
);

// SEC: MFA setup must be verified before MFA is marked enabled.
router.post(
  '/mfa/verify-setup',
  requireAuth,
  verifyMfaSetup
);

module.exports = router;
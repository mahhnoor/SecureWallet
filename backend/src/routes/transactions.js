const express = require('express');
const { body } = require('express-validator');
const { requireAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { transfer, getHistory } = require('../controllers/transactionController');

const router = express.Router();

router.post(
  '/transfer',
  requireAuth,
  [
    body('receiverUsername')
      .trim()
      .isLength({ min: 3, max: 30 }).withMessage('Recipient username is invalid.')
      .matches(/^[a-zA-Z0-9_]+$/).withMessage('Recipient username is invalid.'),
    body('amount')
      .isFloat({ gt: 0, lt: 10000000 }).withMessage('Amount must be a positive number.')
      .custom((value) => {
        // SEC: reject more than 2 decimal places so amounts map cleanly
        // to integer minor units and can't be used to smuggle rounding
        // errors into the balance.
        if (!/^\d+(\.\d{1,2})?$/.test(String(value))) {
          throw new Error('Amount may have at most 2 decimal places.');
        }
        return true;
      }),
  ],
  validate,
  transfer
);

router.get('/history', requireAuth, getHistory);

module.exports = router;

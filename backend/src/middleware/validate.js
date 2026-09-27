const { validationResult } = require('express-validator');

/**
 * SEC: Input validation control.
 * Rejects requests that fail express-validator rules BEFORE they reach
 * any business logic or database query. This addresses "what happens if
 * invalid/unexpected input is submitted?" — malformed amounts, missing
 * fields, oversized strings, etc. are stopped here rather than causing
 * undefined behaviour deeper in the app.
 */
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // SEC: return field-level messages but never leak internals/stack traces
    return res.status(400).json({ error: 'Invalid input.', details: errors.array().map(e => ({ field: e.path, message: e.msg })) });
  }
  next();
}

module.exports = { validate };

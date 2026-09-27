const jwt = require('jsonwebtoken');

/**
 * SEC: Authentication control.
 * Verifies a signed, short-lived JWT sent in the Authorization header.
 * Attaches the authenticated user's id to req.user so downstream handlers
 * know WHO is making the request — this is what makes authorization
 * checks (see routes) possible in the first place.
 */
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    // SEC: generic 401 message — do not reveal whether the problem was a
    // missing header vs. a bad token (reduces information leakage).
    return res.status(401).json({ error: 'Authentication required.' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.sub, username: payload.username };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired session. Please log in again.' });
  }
}

module.exports = { requireAuth };

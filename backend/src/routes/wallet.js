const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { getBalance } = require('../controllers/walletController');

const router = express.Router();

// SEC: requireAuth runs first — no balance data is ever returned to an
// unauthenticated request.
router.get('/balance', requireAuth, getBalance);

module.exports = router;

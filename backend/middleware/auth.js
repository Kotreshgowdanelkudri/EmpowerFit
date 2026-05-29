const jwt = require('jsonwebtoken');
const db = require('../db');

module.exports = (req, res, next) => {
  // Read token from cookie first (browser session), then header (API testing)
  let token = req.cookies ? req.cookies.token : null;

  if (!token && req.headers.authorization) {
    const authHeader = req.headers.authorization;
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'No authentication token provided. Access denied.' });
  }

  try {
    const secret = process.env.JWT_SECRET || 'super_secret_empowerfit_jwt_key_2026';
    const decoded = jwt.verify(token, secret);
    
    // Retrieve user details from database
    db.get('SELECT id, name, email, membership, height, weight, fitness_goal FROM users WHERE id = ?', [decoded.id], (err, user) => {
      if (err) {
        console.error('Auth middleware DB error:', err.message);
        return res.status(500).json({ success: false, message: 'Internal server error during authentication.' });
      }

      if (!user) {
        return res.status(401).json({ success: false, message: 'User not found. Authentication failed.' });
      }

      // Attach user object to request
      req.user = user;
      next();
    });
  } catch (err) {
    console.error('JWT verification error:', err.message);
    return res.status(401).json({ success: false, message: 'Invalid or expired token. Access denied.' });
  }
};

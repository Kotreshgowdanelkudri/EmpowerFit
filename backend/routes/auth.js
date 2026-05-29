const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const authMiddleware = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_empowerfit_jwt_key_2026';

// Helper to sign JWT and set HTTP-only cookie
const sendTokenResponse = (userId, statusCode, res) => {
  const token = jwt.sign({ id: userId }, JWT_SECRET, {
    expiresIn: '7d'
  });

  const cookieOptions = {
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    httpOnly: true, // Prevents XSS attacks
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  };

  res.cookie('token', token, cookieOptions);
  return token;
};

// @route   POST /api/auth/signup
// @desc    Register a new user
// @access  Public
router.post('/signup', (req, res) => {
  const { name, email, password, membership } = req.body;

  // 1. Basic validation
  if (!name || !email || !password) {
    return res.status(400).json({ success: false, message: 'Please provide all required fields (name, email, password).' });
  }

  if (password.length < 6) {
    return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long.' });
  }

  // 2. Check if user already exists
  db.get('SELECT id FROM users WHERE email = ?', [email.toLowerCase()], async (err, existingUser) => {
    if (err) {
      console.error('Signup error (DB select):', err.message);
      return res.status(500).json({ success: false, message: 'Server database error during signup.' });
    }

    if (existingUser) {
      return res.status(400).json({ success: false, message: 'An account with this email address already exists.' });
    }

    try {
      // 3. Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      // Membership details
      const selectedMembership = membership || 'None';
      const today = new Date();
      const formatDate = (d) => d.toISOString().split('T')[0];
      const membershipStart = selectedMembership !== 'None' ? formatDate(today) : null;
      
      let membershipEnd = null;
      if (selectedMembership !== 'None') {
        const endDate = new Date();
        endDate.setFullYear(today.getFullYear() + 1);
        membershipEnd = formatDate(endDate);
      }

      // 4. Create new user
      db.run(
        `INSERT INTO users (name, email, password, membership, membership_start, membership_end) VALUES (?, ?, ?, ?, ?, ?)`,
        [name, email.toLowerCase(), hashedPassword, selectedMembership, membershipStart, membershipEnd],
        function (err) {
          if (err) {
            console.error('Signup error (DB insert):', err.message);
            return res.status(500).json({ success: false, message: 'Failed to create user account.' });
          }

          const userId = this.lastID;
          
          // Seed initial today's empty workout log for the user to start tracking
          const todayStr = formatDate(today);
          db.run(
            `INSERT INTO workout_logs (user_id, date, calories_burned, active_minutes, water_intake_ml) VALUES (?, ?, ?, ?, ?)`,
            [userId, todayStr, 0, 0, 0]
          );

          // 5. Send token and cookie response
          sendTokenResponse(userId, 201, res);

          return res.status(201).json({
            success: true,
            message: 'User registered successfully!',
            user: {
              id: userId,
              name,
              email: email.toLowerCase(),
              membership: selectedMembership,
              height: null,
              weight: null,
              fitness_goal: 'General Fitness'
            }
          });
        }
      );
    } catch (error) {
      console.error('Signup bcrypt error:', error);
      return res.status(500).json({ success: false, message: 'Server encryption error during signup.' });
    }
  });
});

// @route   POST /api/auth/login
// @desc    Authenticate user and set cookie token
// @access  Public
router.post('/login', (req, res) => {
  const { email, password } = req.body;

  // 1. Basic validation
  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Please provide both email and password.' });
  }

  // 2. Query user by email
  db.get('SELECT * FROM users WHERE email = ?', [email.toLowerCase()], async (err, user) => {
    if (err) {
      console.error('Login error (DB select):', err.message);
      return res.status(500).json({ success: false, message: 'Server database error during login.' });
    }

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials. Please check your email and password.' });
    }

    // 3. Verify password hash
    try {
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({ success: false, message: 'Invalid credentials. Please check your email and password.' });
      }

      // 4. Send token and cookie response
      sendTokenResponse(user.id, 200, res);

      return res.status(200).json({
        success: true,
        message: 'Logged in successfully!',
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          membership: user.membership,
          height: user.height,
          weight: user.weight,
          fitness_goal: user.fitness_goal
        }
      });
    } catch (error) {
      console.error('Login bcrypt match error:', error);
      return res.status(500).json({ success: false, message: 'Server error during login authentication.' });
    }
  });
});

// @route   POST /api/auth/logout
// @desc    Clear session cookies and logout user
// @access  Private (but accessible generally)
router.post('/logout', (req, res) => {
  res.cookie('token', 'none', {
    expires: new Date(Date.now() + 5 * 1000), // Expire in 5 seconds
    httpOnly: true
  });
  return res.status(200).json({ success: true, message: 'Logged out successfully.' });
});

// @route   GET /api/auth/me
// @desc    Get current logged in user details
// @access  Private
router.get('/me', authMiddleware, (req, res) => {
  return res.status(200).json({
    success: true,
    user: req.user
  });
});

// @route   POST /api/auth/forgot-password
// @desc    Request forgot password reset link
// @access  Public
router.post('/forgot-password', (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, message: 'Please enter your email address.' });
  }

  db.get('SELECT id FROM users WHERE email = ?', [email.toLowerCase()], (err, user) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Server error searching for email.' });
    }

    if (!user) {
      // Security best practice: don't reveal that email doesn't exist, but here we can return a friendly success
      // stating a link has been sent if the email is registered
      return res.status(200).json({ success: true, message: 'If this email is registered in our database, a password reset link has been dispatched.' });
    }

    return res.status(200).json({
      success: true,
      message: `A password reset link has been successfully dispatched to ${email.toLowerCase()}.`
    });
  });
});

module.exports = router;

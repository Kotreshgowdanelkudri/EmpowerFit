const express = require('express');
const router = express.Router();
const db = require('../db');

// @route   POST /api/contact
// @desc    Submit a contact support query form
// @access  Public
router.post('/', (req, res) => {
  const { name, email, message } = req.body;

  if (!name || !email || !message) {
    return res.status(400).json({ success: false, message: 'Please complete all required fields (name, email, message).' });
  }

  // Basic email syntax validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
  }

  const todayStr = new Date().toISOString().split('T')[0];

  db.run(
    `INSERT INTO contacts (name, email, message, date) VALUES (?, ?, ?, ?)`,
    [name, email, message, todayStr],
    function (err) {
      if (err) {
        console.error('Contact submit error:', err.message);
        return res.status(500).json({ success: false, message: 'Failed to submit contact message. Database error.' });
      }

      return res.status(200).json({
        success: true,
        message: 'Your message has been received! Our support team will reach out within 24 hours.'
      });
    }
  );
});

module.exports = router;

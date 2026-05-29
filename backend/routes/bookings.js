const express = require('express');
const router = express.Router();
const db = require('../db');
const authMiddleware = require('../middleware/auth');

// @route   GET /api/bookings
// @desc    Retrieve all active bookings for the logged-in user
// @access  Private
router.get('/', authMiddleware, (req, res) => {
  db.all(
    'SELECT * FROM bookings WHERE user_id = ? ORDER BY date ASC, time ASC',
    [req.user.id],
    (err, rows) => {
      if (err) {
        console.error('Error fetching bookings:', err.message);
        return res.status(500).json({ success: false, message: 'Failed to retrieve trainer bookings.' });
      }

      return res.status(200).json({
        success: true,
        bookings: rows
      });
    }
  );
});

// @route   POST /api/bookings/book
// @desc    Schedule a new trainer booking
// @access  Private
router.post('/book', authMiddleware, (req, res) => {
  const { trainer_name, specialty, date, time } = req.body;

  if (!trainer_name || !specialty || !date || !time) {
    return res.status(400).json({ success: false, message: 'Please provide all booking details (trainer name, specialty, date, time).' });
  }

  // Ensure user cannot book sessions in the past
  const bookingDate = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (bookingDate < today) {
    return res.status(400).json({ success: false, message: 'Cannot book a session for a date in the past.' });
  }

  db.run(
    `INSERT INTO bookings (user_id, trainer_name, specialty, date, time) VALUES (?, ?, ?, ?, ?)`,
    [req.user.id, trainer_name, specialty, date, time],
    function (err) {
      if (err) {
        console.error('Create booking error:', err.message);
        return res.status(500).json({ success: false, message: 'Failed to schedule trainer session.' });
      }

      const bookingId = this.lastID;

      return res.status(201).json({
        success: true,
        message: 'Personal trainer session booked successfully!',
        booking: {
          id: bookingId,
          user_id: req.user.id,
          trainer_name,
          specialty,
          date,
          time,
          status: 'Confirmed'
        }
      });
    }
  );
});

// @route   DELETE /api/bookings/cancel/:id
// @desc    Cancel an upcoming trainer booking
// @access  Private
router.delete('/cancel/:id', authMiddleware, (req, res) => {
  const bookingId = req.params.id;
  const userId = req.user.id;

  // 1. Verify the booking belongs to the logged-in user
  db.get('SELECT * FROM bookings WHERE id = ?', [bookingId], (err, row) => {
    if (err) {
      console.error('Error finding booking to delete:', err.message);
      return res.status(500).json({ success: false, message: 'Server error cancelling booking.' });
    }

    if (!row) {
      return res.status(404).json({ success: false, message: 'Booking slot not found.' });
    }

    if (row.user_id !== userId) {
      return res.status(403).json({ success: false, message: 'You do not have authorization to cancel this booking.' });
    }

    // 2. Perform cancellation
    db.run('DELETE FROM bookings WHERE id = ?', [bookingId], function (err) {
      if (err) {
        console.error('Delete booking error:', err.message);
        return res.status(500).json({ success: false, message: 'Failed to cancel the trainer booking.' });
      }

      return res.status(200).json({
        success: true,
        message: 'Trainer session cancelled successfully.'
      });
    });
  });
});

module.exports = router;

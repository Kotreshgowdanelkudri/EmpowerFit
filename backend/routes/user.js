const express = require('express');
const router = express.Router();
const db = require('../db');
const authMiddleware = require('../middleware/auth');

// Date helper: returns local timezone date formatted as YYYY-MM-DD
const getTodayString = () => {
  const d = new Date();
  return d.toISOString().split('T')[0];
};

// @route   PUT /api/user/profile
// @desc    Update user profile physical details
// @access  Private
router.put('/profile', authMiddleware, (req, res) => {
  const { name, height, weight, fitness_goal } = req.body;

  if (!name) {
    return res.status(400).json({ success: false, message: 'Name is required.' });
  }

  const heightVal = height ? parseFloat(height) : null;
  const weightVal = weight ? parseFloat(weight) : null;
  const goalVal = fitness_goal || 'General Fitness';

  db.run(
    `UPDATE users SET name = ?, height = ?, weight = ?, fitness_goal = ? WHERE id = ?`,
    [name, heightVal, weightVal, goalVal, req.user.id],
    function (err) {
      if (err) {
        console.error('Update profile error:', err.message);
        return res.status(500).json({ success: false, message: 'Failed to update profile details.' });
      }

      // Return updated profile details
      return res.status(200).json({
        success: true,
        message: 'Profile updated successfully!',
        user: {
          id: req.user.id,
          name,
          email: req.user.email,
          membership: req.user.membership,
          height: heightVal,
          weight: weightVal,
          fitness_goal: goalVal
        }
      });
    }
  );
});

// @route   GET /api/user/dashboard-data
// @desc    Fetch daily metrics and past 7 days logs for data charting
// @access  Private
router.get('/dashboard-data', authMiddleware, (req, res) => {
  const userId = req.user.id;
  const todayStr = getTodayString();

  // 1. First, make sure today's record exists. If not, insert a blank one
  db.get('SELECT * FROM workout_logs WHERE user_id = ? AND date = ?', [userId, todayStr], (err, todayLog) => {
    if (err) {
      console.error('Fetch today log error:', err.message);
      return res.status(500).json({ success: false, message: 'Server database error fetching metrics.' });
    }

    const ensureDashboardData = () => {
      // 2. Fetch last 7 days of logs (including today) to build history
      db.all(
        `SELECT date, calories_burned, active_minutes, water_intake_ml 
         FROM workout_logs 
         WHERE user_id = ? 
         ORDER BY date DESC LIMIT 7`,
        [userId],
        (err, logs) => {
          if (err) {
            console.error('Fetch weekly logs error:', err.message);
            return res.status(500).json({ success: false, message: 'Failed to retrieve historical tracking.' });
          }

          // Reverse logs to make it chronological (left-to-right on chart)
          const chronologicalLogs = logs.reverse();

          // Compile charts datasets
          const chartData = {
            labels: chronologicalLogs.map(l => {
              // Convert YYYY-MM-DD to friendly MM/DD format
              const parts = l.date.split('-');
              return `${parts[1]}/${parts[2]}`;
            }),
            calories: chronologicalLogs.map(l => l.calories_burned),
            minutes: chronologicalLogs.map(l => l.active_minutes),
            water: chronologicalLogs.map(l => l.water_intake_ml)
          };

          // Today's summary stats
          const currentStats = logs.length > 0 ? logs[logs.length - 1] : {
            calories_burned: 0,
            active_minutes: 0,
            water_intake_ml: 0
          };

          // Fetch user's subscription details to display remaining period
          db.get('SELECT membership, membership_start, membership_end FROM users WHERE id = ?', [userId], (err, userSub) => {
            return res.status(200).json({
              success: true,
              stats: {
                caloriesToday: currentStats.calories_burned,
                minutesToday: currentStats.active_minutes,
                waterToday: currentStats.water_intake_ml
              },
              membership: {
                type: userSub.membership,
                start: userSub.membership_start,
                end: userSub.membership_end
              },
              history: chartData
            });
          });
        }
      );
    };

    if (!todayLog) {
      db.run(
        `INSERT INTO workout_logs (user_id, date, calories_burned, active_minutes, water_intake_ml) VALUES (?, ?, 0, 0, 0)`,
        [userId, todayStr],
        function (err) {
          if (err) {
            console.error('Insert today empty log error:', err.message);
          }
          ensureDashboardData();
        }
      );
    } else {
      ensureDashboardData();
    }
  });
});

// @route   POST /api/user/log-workout
// @desc    Log workout calories and active time (adds incrementally)
// @access  Private
router.post('/log-workout', authMiddleware, (req, res) => {
  const { calories, minutes } = req.body;
  const userId = req.user.id;
  const todayStr = getTodayString();

  if (!calories || !minutes) {
    return res.status(400).json({ success: false, message: 'Please provide both calories burned and active minutes.' });
  }

  const calInt = parseInt(calories);
  const minInt = parseInt(minutes);

  db.get('SELECT id, calories_burned, active_minutes FROM workout_logs WHERE user_id = ? AND date = ?', [userId, todayStr], (err, row) => {
    if (err) {
      console.error('DB error finding today log:', err.message);
      return res.status(500).json({ success: false, message: 'Failed to record workout stats.' });
    }

    if (row) {
      // Update existing record
      const newCalories = row.calories_burned + calInt;
      const newMinutes = row.active_minutes + minInt;
      db.run(
        `UPDATE workout_logs SET calories_burned = ?, active_minutes = ? WHERE id = ?`,
        [newCalories, newMinutes, row.id],
        function (err) {
          if (err) return res.status(500).json({ success: false, message: 'Failed to update today metrics.' });
          return res.status(200).json({
            success: true,
            message: 'Workout stats updated successfully!',
            stats: { caloriesToday: newCalories, minutesToday: newMinutes }
          });
        }
      );
    } else {
      // Create new record
      db.run(
        `INSERT INTO workout_logs (user_id, date, calories_burned, active_minutes, water_intake_ml) VALUES (?, ?, ?, ?, 0)`,
        [userId, todayStr, calInt, minInt],
        function (err) {
          if (err) return res.status(500).json({ success: false, message: 'Failed to insert workout metrics.' });
          return res.status(201).json({
            success: true,
            message: 'Workout stats recorded successfully!',
            stats: { caloriesToday: calInt, minutesToday: minInt }
          });
        }
      );
    }
  });
});

// @route   POST /api/user/log-water
// @desc    Log water hydration intake in ML (adds incrementally)
// @access  Private
router.post('/log-water', authMiddleware, (req, res) => {
  const { amount } = req.body;
  const userId = req.user.id;
  const todayStr = getTodayString();

  if (!amount) {
    return res.status(400).json({ success: false, message: 'Please provide a valid water amount in ML.' });
  }

  const amtInt = parseInt(amount);

  db.get('SELECT id, water_intake_ml FROM workout_logs WHERE user_id = ? AND date = ?', [userId, todayStr], (err, row) => {
    if (err) {
      console.error('DB error finding today log for water:', err.message);
      return res.status(500).json({ success: false, message: 'Failed to record hydration stats.' });
    }

    if (row) {
      const newWater = row.water_intake_ml + amtInt;
      db.run(
        `UPDATE workout_logs SET water_intake_ml = ? WHERE id = ?`,
        [newWater, row.id],
        function (err) {
          if (err) return res.status(500).json({ success: false, message: 'Failed to update hydration metrics.' });
          return res.status(200).json({
            success: true,
            message: 'Hydration metrics updated!',
            stats: { waterToday: newWater }
          });
        }
      );
    } else {
      db.run(
        `INSERT INTO workout_logs (user_id, date, calories_burned, active_minutes, water_intake_ml) VALUES (?, ?, 0, 0, ?)`,
        [userId, todayStr, amtInt],
        function (err) {
          if (err) return res.status(500).json({ success: false, message: 'Failed to insert hydration metrics.' });
          return res.status(201).json({
            success: true,
            message: 'Hydration metrics recorded!',
            stats: { waterToday: amtInt }
          });
        }
      );
    }
  });
});

// @route   POST /api/user/generate-workout
// @desc    Generate customized workout routine in json format
// @access  Private
router.post('/generate-workout', authMiddleware, (req, res) => {
  const { goal, difficulty, duration } = req.body;

  if (!goal || !difficulty || !duration) {
    return res.status(400).json({ success: false, message: 'Please select goal, difficulty, and duration.' });
  }

  const selectedGoal = goal.toLowerCase();
  const selectedDiff = difficulty.toLowerCase();
  const durInt = parseInt(duration);

  // Generate highly tailored sets/reps and routines
  let routine = [];
  let caloriesEstimate = 0;

  if (selectedGoal === 'cardio') {
    caloriesEstimate = durInt * (selectedDiff === 'advanced' ? 12 : selectedDiff === 'intermediate' ? 9 : 6);
    routine = [
      { name: 'Warm-up: Dynamic Stretches', duration: '5 min', desc: 'Arm circles, leg swings, torso twists to increase blood flow.' },
      { 
        name: selectedDiff === 'advanced' ? 'High-Intensity Interval Training (HIIT)' : selectedDiff === 'intermediate' ? 'Interval Jogging' : 'Steady Pace Walking/Light Jogging', 
        duration: `${durInt - 10} min`, 
        desc: selectedDiff === 'advanced' 
          ? '45 seconds sprint followed by 15 seconds active rest (walk). Repeat.' 
          : selectedDiff === 'intermediate' 
          ? '2 minutes jogging, 1 minute power walking. Repeat.' 
          : 'Maintain comfortable brisk pace keeping heart rate elevated.' 
      },
      { name: 'Cool-down: Static Stretches', duration: '5 min', desc: 'Hamstring stretch, quad stretch, and deep breathing.' }
    ];
  } else if (selectedGoal === 'strength') {
    caloriesEstimate = durInt * (selectedDiff === 'advanced' ? 8 : selectedDiff === 'intermediate' ? 6 : 4);
    
    const sets = selectedDiff === 'advanced' ? '4 sets x 12 reps' : selectedDiff === 'intermediate' ? '3 sets x 10 reps' : '3 sets x 8 reps';
    
    routine = [
      { name: 'Warm-up: Light Cardio', duration: '5 min', desc: 'Jumping jacks or jogging in place to warm up muscles.' },
      { name: 'Goblet Squats', duration: sets, desc: 'Keep chest tall, hips back. Excellent lower-body builder.' },
      { name: 'Push-ups (or Incline Push-ups)', duration: sets, desc: 'Focus on full range of motion. Keep core fully tight.' },
      { name: 'Dumbbell Rows', duration: sets, desc: 'Squeeze shoulder blades together. Keeps back muscles strong.' }
    ];

    if (durInt >= 45) {
      routine.push({ name: 'Dumbbell Romanian Deadlifts', duration: sets, desc: 'Hinge at hips, slight knee bend. Strengthens hamstrings and glutes.' });
      routine.push({ name: 'Plank Hold', duration: selectedDiff === 'advanced' ? '3 sets x 60s' : '3 sets x 30s', desc: 'Keep body straight. Engage core muscles deeply.' });
    }

    routine.push({ name: 'Cool-down: Upper & Lower Body Stretch', duration: '5 min', desc: 'Hold dynamic/static poses to relax muscle tension.' });
  } else if (selectedGoal === 'yoga') {
    caloriesEstimate = durInt * (selectedDiff === 'advanced' ? 5 : selectedDiff === 'intermediate' ? 4 : 3);
    routine = [
      { name: 'Centering & Child’s Pose', duration: '5 min', desc: 'Focus on deep inhalation. Relieve lower back tension.' },
      { name: 'Sun Salutations (Vinyasa Flow)', duration: `${Math.round(durInt * 0.4)} min`, desc: 'Flow dynamically through Downward Dog, Cobra, and Plank.' },
      { name: 'Balance Poses (Tree Pose & Warrior III)', duration: `${Math.round(durInt * 0.3)} min`, desc: 'Ground your feet. Build stability, ankle strength, and mental focus.' }
    ];

    if (durInt >= 45) {
      routine.push({ name: 'Deep Hip Openers (Pigeon Pose)', duration: '8 min', desc: 'Hold pose on each side. Releases emotional and physical tension.' });
    }

    routine.push({ name: 'Final Relaxation (Savasana)', duration: '5 min', desc: 'Lie flat on back, breathing naturally. Fully absorb the practice.' });
  }

  return res.status(200).json({
    success: true,
    goal: goal,
    difficulty: difficulty,
    duration: duration,
    caloriesBurned: caloriesEstimate,
    routine: routine
  });
});

module.exports = router;

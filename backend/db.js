const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

// Establish absolute path for database file
const dbPath = path.resolve(__dirname, '../database.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to the SQLite database.');
    initializeDatabase();
  }
});

function initializeDatabase() {
  db.serialize(() => {
    // 1. Users Table
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        membership TEXT DEFAULT 'None',
        membership_start TEXT,
        membership_end TEXT,
        height REAL,
        weight REAL,
        fitness_goal TEXT DEFAULT 'General Fitness'
      )
    `);

    // 2. Bookings Table
    db.run(`
      CREATE TABLE IF NOT EXISTS bookings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        trainer_name TEXT NOT NULL,
        specialty TEXT NOT NULL,
        date TEXT NOT NULL,
        time TEXT NOT NULL,
        status TEXT DEFAULT 'Confirmed',
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // 3. Workout Logs Table
    db.run(`
      CREATE TABLE IF NOT EXISTS workout_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        calories_burned INTEGER NOT NULL,
        active_minutes INTEGER NOT NULL,
        water_intake_ml INTEGER DEFAULT 0,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // 4. Contacts Table
    db.run(`
      CREATE TABLE IF NOT EXISTS contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        message TEXT NOT NULL,
        date TEXT NOT NULL
      )
    `);

    console.log('Database tables verified/created successfully.');

    // Seed default test user if users table is empty
    db.get('SELECT COUNT(*) as count FROM users', [], (err, row) => {
      if (err) {
        console.error('Error checking users count:', err.message);
        return;
      }

      if (row.count === 0) {
        console.log('No users found. Seeding default data...');
        seedDefaultData();
      } else {
        console.log('Database already contains data. Seeding skipped.');
      }
    });
  });
}

async function seedDefaultData() {
  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('password123', salt);
    
    // Dates helper
    const today = new Date();
    const formatDate = (d) => d.toISOString().split('T')[0];
    
    const oneYearLater = new Date();
    oneYearLater.setFullYear(today.getFullYear() + 1);

    // Insert Default User: Alex Carter
    db.run(
      `INSERT INTO users (name, email, password, membership, membership_start, membership_end, height, weight, fitness_goal) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'Alex Carter',
        'alex@empowerfit.com',
        hashedPassword,
        'Premium',
        formatDate(today),
        formatDate(oneYearLater),
        180.0,
        78.5,
        'Build Muscle'
      ],
      function (err) {
        if (err) {
          console.error('Error seeding user:', err.message);
          return;
        }

        const userId = this.lastID;
        console.log(`Default user seeded successfully with ID: ${userId}`);

        // Seed 7 days of historical workout stats (for Chart.js visualization)
        const workoutLogsStatement = db.prepare(
          `INSERT INTO workout_logs (user_id, date, calories_burned, active_minutes, water_intake_ml) VALUES (?, ?, ?, ?, ?)`
        );

        for (let i = 7; i >= 0; i--) {
          const logDate = new Date();
          logDate.setDate(today.getDate() - i);
          const dateString = formatDate(logDate);

          let calories = 0;
          let minutes = 0;
          let water = 0;

          // Make data look dynamic and realistic
          if (i === 7) { calories = 480; minutes = 45; water = 2000; }
          else if (i === 6) { calories = 350; minutes = 30; water = 1800; }
          else if (i === 5) { calories = 620; minutes = 60; water = 2500; }
          else if (i === 4) { calories = 0; minutes = 0; water = 1200; } // Rest day
          else if (i === 3) { calories = 540; minutes = 50; water = 2200; }
          else if (i === 2) { calories = 410; minutes = 40; water = 1500; }
          else if (i === 1) { calories = 710; minutes = 75; water = 3200; }
          else if (i === 0) { calories = 300; minutes = 30; water = 1000; } // Today so far

          workoutLogsStatement.run(userId, dateString, calories, minutes, water);
        }

        workoutLogsStatement.finalize((err) => {
          if (err) console.error('Error finalizing workout logs seed:', err.message);
          else console.log('7 Days of workout logs seeded successfully.');
        });

        // Seed some trainer bookings
        const bookingStatement = db.prepare(
          `INSERT INTO bookings (user_id, trainer_name, specialty, date, time) VALUES (?, ?, ?, ?, ?)`
        );

        const tomorrow = new Date();
        tomorrow.setDate(today.getDate() + 1);
        const dayAfter = new Date();
        dayAfter.setDate(today.getDate() + 2);

        bookingStatement.run(userId, 'Jane Smith', 'Nutritionist', formatDate(tomorrow), '10:00 AM');
        bookingStatement.run(userId, 'John Doe', 'Strength Coach', formatDate(dayAfter), '04:30 PM');

        bookingStatement.finalize((err) => {
          if (err) console.error('Error finalizing bookings seed:', err.message);
          else console.log('Sample bookings seeded successfully.');
        });
      }
    );
  } catch (error) {
    console.error('Error generating seed hash password:', error);
  }
}

module.exports = db;

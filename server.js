require('dotenv').config();
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const morgan = require('morgan');

// Import database initialization
const db = require('./backend/db');

const app = express();
const PORT = process.env.PORT || 3000;

// 1. Logging Middleware
if (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) {
  app.use(morgan('dev'));
}

// 2. Parser Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// 3. CORS configuration (enabling API accesses)
app.use(cors({
  origin: true,
  credentials: true
}));

// 4. Register API Routes
app.use('/api/auth', require('./backend/routes/auth'));
app.use('/api/user', require('./backend/routes/user'));
app.use('/api/bookings', require('./backend/routes/bookings'));
app.use('/api/contact', require('./backend/routes/contact'));

// 5. Custom Clean URL Routing Middleware (recruiter-ready experience!)
// Serves /about instead of /about.html, keeping url bars elegant.
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.includes('.') && !req.path.startsWith('/api')) {
    const cleanPath = req.path === '/' ? '/index' : req.path;
    const htmlFilePath = path.join(__dirname, 'public', `${cleanPath}.html`);
    
    res.sendFile(htmlFilePath, (err) => {
      if (err) {
        // If file not found, pass to static/next to return 404
        next();
      }
    });
  } else {
    next();
  }
});

// 6. Serve static files (assets, css, js) from public
app.use(express.static(path.join(__dirname, 'public')));

// 7. Fallback page (404 Not Found)
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 8. Start server listening
const server = app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`   EmpowerFit Server is running in ${process.env.NODE_ENV || 'development'} mode`);
  console.log(`   Local Server Access: http://localhost:${PORT}`);
  console.log(`====================================================`);
});

module.exports = server;

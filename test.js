/* 
   EmpowerFit Automated API Validation Test Suite
   Runs programmatically on an isolated testing port.
   Executes end-to-end integration workflows on all REST endpoints.
*/

process.env.PORT = 3001;
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_secret_for_automated_testing_2026';

const http = require('http');
const server = require('./server'); // Spawns server programmatically
const db = require('./backend/db'); // Load DB programmatically

const TEST_PORT = 3001;
const BASE_URL = `http://localhost:${TEST_PORT}`;

let testUserCookie = '';
let createdBookingId = null;

// Helpers to make HTTP Requests programmatically using node native http
function makeRequest(method, path, body = null, cookie = '') {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : '';
    
    const options = {
      hostname: 'localhost',
      port: TEST_PORT,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    if (cookie) {
      options.headers['Cookie'] = cookie;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (e) {
          json = data;
        }
        
        // Grab cookie headers if any
        const setCookieHeader = res.headers['set-cookie'];
        let returnedCookie = '';
        if (setCookieHeader && setCookieHeader.length > 0) {
          returnedCookie = setCookieHeader[0].split(';')[0];
        }

        resolve({
          statusCode: res.statusCode,
          body: json,
          cookie: returnedCookie
        });
      });
    });

    req.on('error', (err) => reject(err));
    
    if (body) {
      req.write(postData);
    }
    req.end();
  });
}

// Log formatting utilities
const log = {
  success: (msg) => console.log(`\x1b[32m✔ SUCCESS: ${msg}\x1b[0m`),
  error: (msg) => console.error(`\x1b[31m✘ FAILED: ${msg}\x1b[0m`),
  info: (msg) => console.log(`\x1b[36mℹ INFO: ${msg}\x1b[0m`)
};

async function runTests() {
  log.info('====================================================');
  log.info('   Running EmpowerFit Automated API Integration Tests');
  log.info('====================================================');

  try {
    // Clean testing user records before running test
    await new Promise((resolve) => {
      db.run("DELETE FROM users WHERE email = 'tester@empowerfit.com'", () => {
        db.run("DELETE FROM contacts WHERE email = 'test_contact@email.com'", () => {
          resolve();
        });
      });
    });

    // 1. Test Public Contact Submission
    const contactRes = await makeRequest('POST', '/api/contact', {
      name: 'Test Inquirer',
      email: 'test_contact@email.com',
      message: 'Hello, this is an automated testing query.'
    });
    
    if (contactRes.statusCode === 200 && contactRes.body.success) {
      log.success('POST /api/contact - Support message logged into database');
    } else {
      throw new Error(`Contact API failed: ${JSON.stringify(contactRes.body)}`);
    }

    // 2. Test Contact Form Email Syntax Validation
    const contactErrRes = await makeRequest('POST', '/api/contact', {
      name: 'Bad Email',
      email: 'invalid-email-syntax',
      message: 'Should trigger error.'
    });
    if (contactErrRes.statusCode === 400 && !contactErrRes.body.success) {
      log.success('POST /api/contact - Rejected invalid email format (400)');
    } else {
      throw new Error('Contact API did not validate email syntax!');
    }

    // 3. Test Secure Registration (/api/auth/signup)
    const signupRes = await makeRequest('POST', '/api/auth/signup', {
      name: 'Automated Tester',
      email: 'tester@empowerfit.com',
      password: 'password123',
      membership: 'VIP'
    });
    
    if (signupRes.statusCode === 201 && signupRes.body.success) {
      log.success('POST /api/auth/signup - Registered new test account (201)');
      // Record cookie session token
      testUserCookie = signupRes.cookie;
    } else {
      throw new Error(`Signup failed: ${JSON.stringify(signupRes.body)}`);
    }

    // 4. Test Signup Password Strength Validation
    const signupErrRes = await makeRequest('POST', '/api/auth/signup', {
      name: 'Short Pass',
      email: 'short@email.com',
      password: '123'
    });
    if (signupErrRes.statusCode === 400 && !signupErrRes.body.success) {
      log.success('POST /api/auth/signup - Blocked short password request (400)');
    } else {
      throw new Error('Signup did not validate password minimum length!');
    }

    // 5. Test Credentials Sign-In (/api/auth/login)
    const loginRes = await makeRequest('POST', '/api/auth/login', {
      email: 'tester@empowerfit.com',
      password: 'password123'
    });
    if (loginRes.statusCode === 200 && loginRes.body.success) {
      log.success('POST /api/auth/login - Verified hashed credentials & logged in (200)');
      testUserCookie = loginRes.cookie; // Maintain token
    } else {
      throw new Error(`Login failed: ${JSON.stringify(loginRes.body)}`);
    }

    // 6. Test Token Access Check (/api/auth/me)
    const meRes = await makeRequest('GET', '/api/auth/me', null, testUserCookie);
    if (meRes.statusCode === 200 && meRes.body.success && meRes.body.user.email === 'tester@empowerfit.com') {
      log.success('GET /api/auth/me - Decoded JWT cookie & returned protected profile');
    } else {
      throw new Error(`Me API failed: ${JSON.stringify(meRes.body)}`);
    }

    // 7. Test Block Unauthorized Endpoints (No Cookie)
    const meUnauth = await makeRequest('GET', '/api/auth/me');
    if (meUnauth.statusCode === 401 && !meUnauth.body.success) {
      log.success('GET /api/auth/me - Blocked anonymous access as expected (401)');
    } else {
      throw new Error('Endpoint did not block unauthenticated query!');
    }

    // 8. Test Retrieve Dashboard Stats Arrays (/api/user/dashboard-data)
    const statsRes = await makeRequest('GET', '/api/user/dashboard-data', null, testUserCookie);
    if (statsRes.statusCode === 200 && statsRes.body.success && statsRes.body.history.calories) {
      log.success('GET /api/user/dashboard-data - Retrieved weekly analytics stats and history');
    } else {
      throw new Error(`Dashboard Data failed: ${JSON.stringify(statsRes.body)}`);
    }

    // 9. Test Log Activity stats (/api/user/log-workout)
    const logWorkoutRes = await makeRequest('POST', '/api/user/log-workout', {
      calories: 320,
      minutes: 25
    }, testUserCookie);
    if (logWorkoutRes.statusCode === 200 && logWorkoutRes.body.success && logWorkoutRes.body.stats.caloriesToday === 320) {
      log.success('POST /api/user/log-workout - Logged calories & active minutes to today database');
    } else {
      throw new Error(`Log Workout failed: ${JSON.stringify(logWorkoutRes.body)}`);
    }

    // 10. Test Log Hydration intake (/api/user/log-water)
    const logWaterRes = await makeRequest('POST', '/api/user/log-water', {
      amount: 500
    }, testUserCookie);
    if (logWaterRes.statusCode === 200 && logWaterRes.body.success && logWaterRes.body.stats.waterToday === 500) {
      log.success('POST /api/user/log-water - Logged 500ml of hydration points');
    } else {
      throw new Error(`Log Water failed: ${JSON.stringify(logWaterRes.body)}`);
    }

    // 11. Test Personal Workout Planner Routine Generator (/api/user/generate-workout)
    const routineRes = await makeRequest('POST', '/api/user/generate-workout', {
      goal: 'strength',
      difficulty: 'intermediate',
      duration: '45'
    }, testUserCookie);
    if (routineRes.statusCode === 200 && routineRes.body.success && routineRes.body.routine.length > 0) {
      log.success('POST /api/user/generate-workout - Exercised custom routine planner algorithm');
    } else {
      throw new Error(`Workout Plan Generator failed: ${JSON.stringify(routineRes.body)}`);
    }

    // 12. Test Schedule Trainer Session (/api/bookings/book)
    const tomorrowStr = new Date();
    tomorrowStr.setDate(tomorrowStr.getDate() + 1);
    const dateStr = tomorrowStr.toISOString().split('T')[0];

    const bookRes = await makeRequest('POST', '/api/bookings/book', {
      trainer_name: 'Jane Smith',
      specialty: 'Nutritionist',
      date: dateStr,
      time: '10:30 AM'
    }, testUserCookie);
    
    if (bookRes.statusCode === 201 && bookRes.body.success) {
      log.success('POST /api/bookings/book - Booked upcoming 1-on-1 personal trainer slot');
      createdBookingId = bookRes.body.booking.id;
    } else {
      throw new Error(`Trainer Booking failed: ${JSON.stringify(bookRes.body)}`);
    }

    // 13. Test Fetch Active Appointments list (/api/bookings)
    const listBookRes = await makeRequest('GET', '/api/bookings', null, testUserCookie);
    if (listBookRes.statusCode === 200 && listBookRes.body.success && listBookRes.body.bookings.length > 0) {
      log.success('GET /api/bookings - Retrieved active training bookings');
    } else {
      throw new Error(`Get Bookings list failed: ${JSON.stringify(listBookRes.body)}`);
    }

    // 14. Test Secure Booking Cancellation (/api/bookings/cancel/:id)
    const cancelRes = await makeRequest('DELETE', `/api/bookings/cancel/${createdBookingId}`, null, testUserCookie);
    if (cancelRes.statusCode === 200 && cancelRes.body.success) {
      log.success('DELETE /api/bookings/cancel/:id - Cleaned up and deleted training slot');
    } else {
      throw new Error(`Cancel Booking failed: ${JSON.stringify(cancelRes.body)}`);
    }

    log.info('====================================================');
    log.success('   ALL API WORKFLOW TESTS COMPLETED SUCCESSFULLY!   ');
    log.info('====================================================');
    shutdown(0);
  } catch (error) {
    log.error(`TEST EXCEPTION CAUGHT: ${error.message}`);
    log.info('====================================================');
    shutdown(1);
  }
}

function shutdown(code) {
  log.info('Closing database and server connections...');
  db.close(() => {
    server.close(() => {
      log.info(`Server test suite shut down. Exit Code: ${code}`);
      process.exit(code);
    });
  });
}

// Delay briefly to allow database connectivity to fire up
setTimeout(() => {
  runTests();
}, 800);

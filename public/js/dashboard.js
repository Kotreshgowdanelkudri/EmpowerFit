/* 
   EmpowerFit Dashboard Interaction Core
   Bridges frontend dashboard elements with Node.js Express & SQLite endpoints.
*/

let chartInstance = null;
let selectedTrainer = "John Doe";
let selectedSpecialty = "Strength Coach";

document.addEventListener('DOMContentLoaded', () => {
  // 1. Run Client-side Authentication Guard
  authCheckGuard();

  // 2. Initialize Sidebar Tab Switching
  setupTabSwitching();

  // 3. Initialize Metric Logger Buttons
  setupMetricLoggers();

  // 4. Initialize Workout Plan Generator
  setupWorkoutGenerator();

  // 5. Initialize Trainer Bookings
  setupTrainerBookings();

  // 6. Initialize Profile Form
  setupProfileForm();
});

// Auth check guard: redirects guest users immediately to login
function authCheckGuard() {
  fetch('/api/auth/me')
    .then(res => res.json())
    .then(data => {
      if (!data.success || !data.user) {
        window.location.href = 'login.html';
        return;
      }

      // Populate user info throughout dashboard
      document.getElementById('userGreeting').innerText = data.user.email;
      document.getElementById('welcomeHeader').innerText = `Welcome Back, ${data.user.name.split(' ')[0]}!`;
      
      // Populate Profile Form defaults
      document.getElementById('profileName').value = data.user.name;
      document.getElementById('profileHeight').value = data.user.height || '';
      document.getElementById('profileWeight').value = data.user.weight || '';
      document.getElementById('profileGoal').value = data.user.fitness_goal || 'General Fitness';

      // Load initial dashboard stats & bookings
      loadDashboardStats();
      loadActiveBookings();
    })
    .catch(() => {
      window.location.href = 'login.html';
    });
}

// Sidebar Tab switching script
function setupTabSwitching() {
  const sidebarButtons = document.querySelectorAll('.sidebar-btn');
  const tabPanels = document.querySelectorAll('.tab-panel');

  sidebarButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');

      // Update active sidebar button
      sidebarButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Update visible tab panel
      tabPanels.forEach(p => {
        p.classList.remove('active');
        if (p.getAttribute('id') === `${targetTab}-tab`) {
          p.classList.add('active');
        }
      });
    });
  });

  // Header LogOut wiring
  document.getElementById('headerLogoutBtn').addEventListener('click', () => {
    fetch('/api/auth/logout', { method: 'POST' })
      .then(res => res.json())
      .then(() => {
        window.showToast('Logged out successfully.', 'success');
        setTimeout(() => { window.location.href = 'index.html'; }, 800);
      });
  });
}

// Fetch dashboard metrics and draw Chart.js graph
function loadDashboardStats() {
  fetch('/api/user/dashboard-data')
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        // 1. Populate current daily metric summaries
        document.getElementById('calTodayVal').innerHTML = `${data.stats.caloriesToday} <span style="font-size: 14px; font-weight: 400; color: var(--text-muted);">kcal</span>`;
        document.getElementById('minTodayVal').innerHTML = `${data.stats.minutesToday} <span style="font-size: 14px; font-weight: 400; color: var(--text-muted);">mins</span>`;
        document.getElementById('waterTodayVal').innerHTML = `${data.stats.waterToday} <span style="font-size: 14px; font-weight: 400; color: var(--text-muted);">ml</span>`;

        // 2. Populate membership plan details
        const subType = data.membership.type || 'None';
        document.getElementById('subLabel').innerText = `${subType} Plan`;
        document.getElementById('subStartStr').innerText = data.membership.start || 'N/A';
        document.getElementById('subEndStr').innerText = data.membership.end || 'N/A';

        // Adjust perks description depending on membership tier
        let perks = "Access to Digital Analytics & Core Gym Equipments";
        if (subType === 'Premium') perks = "Unlimited 24/7 Access, All Fitness Classes & 1 Monthly Trainer Slot";
        if (subType === 'VIP') perks = "Elite Tier: Unlimited Trainer Bookings & Algorithmic Workout Generators";
        document.getElementById('subPerksDesc').innerText = perks;

        // 3. Render dynamic weekly performance charts (Chart.js)
        renderWeeklyChart(data.history);
      }
    })
    .catch(err => window.showToast('Failed to load dashboard statistics.', 'error'));
}

// Draw the master dual-axis/layer tracking chart
function renderWeeklyChart(history) {
  const ctx = document.getElementById('workoutChart');
  if (!ctx) return;

  // Destroy previous chart instance if it exists to refresh cleanly
  if (chartInstance) {
    chartInstance.destroy();
  }

  chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: history.labels,
      datasets: [
        {
          label: 'Water Intake (ml)',
          type: 'bar',
          data: history.water,
          backgroundColor: 'rgba(58, 134, 200, 0.35)',
          borderColor: '#3a86c8',
          borderWidth: 1.5,
          yAxisID: 'yWater',
          borderRadius: 4
        },
        {
          label: 'Calories Burned (kcal)',
          type: 'line',
          data: history.calories,
          backgroundColor: 'rgba(255, 159, 28, 0.1)',
          borderColor: '#ff9f1c',
          borderWidth: 3,
          yAxisID: 'yFitness',
          tension: 0.3,
          fill: true
        },
        {
          label: 'Active Minutes',
          type: 'line',
          data: history.minutes,
          backgroundColor: 'transparent',
          borderColor: '#2ec4b6',
          borderWidth: 3,
          yAxisID: 'yFitness',
          tension: 0.3
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: '#94a3b8', font: { family: 'Outfit', size: 12 } }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.03)' },
          ticks: { color: '#94a3b8', font: { family: 'Outfit' } }
        },
        yFitness: {
          type: 'linear',
          position: 'left',
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: { color: '#ff9f1c', font: { family: 'Outfit' } },
          title: { display: true, text: 'Calories / Active Minutes', color: '#ff9f1c', font: { family: 'Outfit' } }
        },
        yWater: {
          type: 'linear',
          position: 'right',
          grid: { display: false },
          ticks: { color: '#3a86c8', font: { family: 'Outfit' } },
          title: { display: true, text: 'Hydration Intake (ml)', color: '#3a86c8', font: { family: 'Outfit' } }
        }
      }
    }
  });
}

// Wire quick record actions for calories and water
function setupMetricLoggers() {
  const showLogFormBtn = document.getElementById('showLogFormBtn');
  const logWorkoutMiniForm = document.getElementById('logWorkoutMiniForm');

  showLogFormBtn.addEventListener('click', () => {
    const isHidden = logWorkoutMiniForm.style.display === 'none' || logWorkoutMiniForm.style.display === '';
    logWorkoutMiniForm.style.display = isHidden ? 'flex' : 'none';
    showLogFormBtn.innerText = isHidden ? 'Cancel' : 'Log Activity';
  });

  // Submit recorded activity log
  document.getElementById('submitWorkoutLogBtn').addEventListener('click', () => {
    const calories = document.getElementById('inputCalories').value;
    const minutes = document.getElementById('inputMinutes').value;

    if (!calories || !minutes || calories <= 0 || minutes <= 0) {
      window.showToast('Please enter valid positive values for active stats.', 'error');
      return;
    }

    fetch('/api/user/log-workout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ calories, minutes })
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        window.showToast(data.message, 'success');
        document.getElementById('inputCalories').value = '';
        document.getElementById('inputMinutes').value = '';
        logWorkoutMiniForm.style.display = 'none';
        showLogFormBtn.innerText = 'Log Activity';
        
        // Refresh metrics values & chart graphs
        loadDashboardStats();
      } else {
        window.showToast(data.message, 'error');
      }
    })
    .catch(() => window.showToast('Failed to record activity log.', 'error'));
  });

  // Hydration tracking log actions
  document.getElementById('logWater250Btn').addEventListener('click', () => recordWaterIntake(250));
  document.getElementById('logWater500Btn').addEventListener('click', () => recordWaterIntake(500));
}

function recordWaterIntake(amount) {
  fetch('/api/user/log-water', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount })
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      window.showToast(`Logged +${amount}ml of hydration intake!`, 'success');
      loadDashboardStats();
    } else {
      window.showToast(data.message, 'error');
    }
  })
  .catch(() => window.showToast('Failed to log water intake.', 'error'));
}

// Workout Planner logic
function setupWorkoutGenerator() {
  const generatorForm = document.getElementById('workoutGeneratorForm');
  const emptyState = document.getElementById('emptyRoutineState');
  const activeState = document.getElementById('activeRoutineState');
  const exercisesContainer = document.getElementById('exercisesContainer');

  generatorForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const goal = document.getElementById('workoutGoal').value;
    const difficulty = document.getElementById('workoutDifficulty').value;
    const duration = document.getElementById('workoutDuration').value;

    fetch('/api/user/generate-workout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ goal, difficulty, duration })
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        window.showToast('Workout plan generated successfully!', 'success');
        
        // Populate generator info header
        document.getElementById('routineGoalTitle').innerText = `${data.goal.charAt(0).toUpperCase() + data.goal.slice(1)} Routine`;
        document.getElementById('routineDiffLevel').innerText = data.difficulty.toUpperCase();
        document.getElementById('routineTime').innerHTML = `<i class="fa-solid fa-clock"></i> ${data.duration} Mins`;
        document.getElementById('routineCals').innerHTML = `<i class="fa-solid fa-fire"></i> ~${data.caloriesBurned} Kcal`;

        // Render workout exercises list dynamically
        exercisesContainer.innerHTML = '';
        data.routine.forEach(step => {
          const stepDiv = document.createElement('div');
          stepDiv.className = 'routine-step animated-fade';
          stepDiv.innerHTML = `
            <div class="step-time">${step.duration}</div>
            <div class="step-details">
              <h4>${step.name}</h4>
              <p>${step.desc}</p>
            </div>
          `;
          exercisesContainer.appendChild(stepDiv);
        });

        // Toggle UI panel views
        emptyState.style.display = 'none';
        activeState.style.display = 'block';
      }
    })
    .catch(() => window.showToast('Workout generation failed. Check inputs.', 'error'));
  });
}

// Personal Trainer booking flows
function setupTrainerBookings() {
  const trainerCards = document.querySelectorAll('.trainer-card');
  const bookingDateInput = document.getElementById('bookingDate');
  const appointmentForm = document.getElementById('appointmentForm');

  // Set min scheduling date constraint to today
  const todayStr = new Date().toISOString().split('T')[0];
  bookingDateInput.min = todayStr;

  // Handle trainer card clicks
  trainerCards.forEach(card => {
    card.addEventListener('click', () => {
      trainerCards.forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      selectedTrainer = card.getAttribute('data-trainer');
      selectedSpecialty = card.getAttribute('data-specialty');
    });
  });

  // Submit appointment booking
  appointmentForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const date = bookingDateInput.value;
    const time = document.getElementById('bookingTime').value;

    fetch('/api/bookings/book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        trainer_name: selectedTrainer,
        specialty: selectedSpecialty,
        date: date,
        time: time
      })
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        window.showToast(data.message, 'success');
        bookingDateInput.value = '';
        loadActiveBookings();
      } else {
        window.showToast(data.message, 'error');
      }
    })
    .catch(() => window.showToast('Network error booking trainer session.', 'error'));
  });
}

// Fetch user active bookings and map to UI list
function loadActiveBookings() {
  fetch('/api/bookings')
    .then(res => res.json())
    .then(data => {
      const activeSessionsList = document.getElementById('activeSessionsList');
      const emptySessionsState = document.getElementById('emptySessionsState');

      if (data.success && data.bookings.length > 0) {
        activeSessionsList.innerHTML = '';
        data.bookings.forEach(session => {
          const item = document.createElement('div');
          item.className = 'session-item animated-fade';
          item.innerHTML = `
            <div class="session-details">
              <h4>${session.trainer_name}</h4>
              <p>${session.specialty} Session</p>
              <span style="font-size: 12px; color: var(--text-muted);"><i class="fa-solid fa-calendar-days"></i> ${session.date} | <i class="fa-solid fa-clock"></i> ${session.time}</span>
            </div>
            <button class="btn btn-secondary btn-danger btn-sm cancel-session-btn" data-id="${session.id}" style="padding: 6px 12px; border-radius: 4px; font-size:12px;">Cancel</button>
          `;
          activeSessionsList.appendChild(item);
        });

        // Wire click actions to cancellation buttons
        document.querySelectorAll('.cancel-session-btn').forEach(btn => {
          btn.addEventListener('click', function() {
            const bookingId = this.getAttribute('data-id');
            cancelTrainerSession(bookingId);
          });
        });

        emptySessionsState.style.display = 'none';
        activeSessionsList.style.display = 'flex';
      } else {
        activeSessionsList.style.display = 'none';
        emptySessionsState.style.display = 'block';
      }
    })
    .catch(() => console.log('trainer bookings query error.'));
}

// Perform booking cancellation
function cancelTrainerSession(id) {
  if (!confirm('Are you sure you want to cancel this scheduled trainer session?')) {
    return;
  }

  fetch(`/api/bookings/cancel/${id}`, { method: 'DELETE' })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        window.showToast(data.message, 'success');
        loadActiveBookings();
      } else {
        window.showToast(data.message, 'error');
      }
    })
    .catch(() => window.showToast('Failed to cancel training appointment.', 'error'));
}

// Profile update stats handler
function setupProfileForm() {
  const profileForm = document.getElementById('profileForm');

  profileForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const name = document.getElementById('profileName').value.trim();
    const height = document.getElementById('profileHeight').value;
    const weight = document.getElementById('profileWeight').value;
    const goal = document.getElementById('profileGoal').value;

    fetch('/api/user/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        height,
        weight,
        fitness_goal: goal
      })
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        window.showToast(data.message, 'success');
        
        // Refresh greetings and default details
        document.getElementById('welcomeHeader').innerText = `Welcome Back, ${data.user.name.split(' ')[0]}!`;
      } else {
        window.showToast(data.message, 'error');
      }
    })
    .catch(() => window.showToast('Failed to save profile changes.', 'error'));
  });
}

/* 
   EmpowerFit Authentication Form Engine
   Handles signup, login, and password recovery interactions.
*/

document.addEventListener('DOMContentLoaded', () => {
  // 1. SignUp Form submission
  const signupForm = document.getElementById('signupForm');
  if (signupForm) {
    // Check if a membership plan was passed in url search queries (e.g., memberships redirects)
    const urlParams = new URLSearchParams(window.location.search);
    const plan = urlParams.get('plan');
    if (plan) {
      window.showToast(`Selected Plan: ${plan}. Complete registration to join!`, 'info');
    }

    signupForm.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const name = signupForm.querySelector('input[placeholder*="name"]').value.trim();
      const email = signupForm.querySelector('input[type="email"]').value.trim();
      const password = signupForm.querySelector('input[placeholder="Enter password"]').value;
      const confirmPassword = signupForm.querySelector('input[placeholder="Confirm password"]').value;

      // Local Validations
      if (!name || !email || !password || !confirmPassword) {
        window.showToast('Please fill out all fields.', 'error');
        return;
      }

      if (password !== confirmPassword) {
        window.showToast('Passwords do not match. Please verify.', 'error');
        return;
      }

      if (password.length < 6) {
        window.showToast('Password must be at least 6 characters long.', 'error');
        return;
      }

      const submitBtn = signupForm.querySelector('.submit');
      const origText = submitBtn.innerText;
      submitBtn.innerText = 'Registering...';
      submitBtn.disabled = true;

      const planDropdown = signupForm.querySelector('#membershipSelect');
      const selectedPlan = planDropdown ? planDropdown.value : (plan ? plan.charAt(0).toUpperCase() + plan.slice(1) : 'None');

      // Post registration data
      fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          password,
          membership: selectedPlan
        })
      })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          window.showToast(data.message, 'success');
          signupForm.classList.add('fade-out');
          
          setTimeout(() => {
            window.location.href = 'home.html';
          }, 800);
        } else {
          window.showToast(data.message, 'error');
          submitBtn.innerText = origText;
          submitBtn.disabled = false;
        }
      })
      .catch(err => {
        window.showToast('Network error during registration.', 'error');
        submitBtn.innerText = origText;
        submitBtn.disabled = false;
      });
    });
  }

  // 2. Login Form submission
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const email = loginForm.querySelector('input[type="email"]').value.trim();
      const password = loginForm.querySelector('input[type="password"]').value;

      if (!email || !password) {
        window.showToast('Please fill in all credentials.', 'error');
        return;
      }

      const submitBtn = loginForm.querySelector('.submit');
      const origText = submitBtn.innerText;
      submitBtn.innerText = 'Signing in...';
      submitBtn.disabled = true;

      // Post login data
      fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          window.showToast(data.message, 'success');
          loginForm.classList.add('fade-out');

          setTimeout(() => {
            window.location.href = 'home.html';
          }, 800);
        } else {
          window.showToast(data.message, 'error');
          submitBtn.innerText = origText;
          submitBtn.disabled = false;
        }
      })
      .catch(err => {
        window.showToast('Network error during login.', 'error');
        submitBtn.innerText = origText;
        submitBtn.disabled = false;
      });
    });
  }

  // 3. Forgot Password Form submission
  const forgotPasswordForm = document.getElementById('forgotPasswordForm');
  if (forgotPasswordForm) {
    forgotPasswordForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const email = forgotPasswordForm.querySelector('input[type="email"]').value.trim();

      if (!email) {
        window.showToast('Please enter your email.', 'error');
        return;
      }

      const submitBtn = forgotPasswordForm.querySelector('.submit');
      const origText = submitBtn.innerText;
      submitBtn.innerText = 'Sending...';
      submitBtn.disabled = true;

      // Post recovery data
      fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          window.showToast(data.message, 'success');
          forgotPasswordForm.classList.add('fade-out');

          setTimeout(() => {
            window.location.href = 'login.html';
          }, 1500);
        } else {
          window.showToast(data.message, 'error');
          submitBtn.innerText = origText;
          submitBtn.disabled = false;
        }
      })
      .catch(err => {
        window.showToast('Network error processing recovery request.', 'error');
        submitBtn.innerText = origText;
        submitBtn.disabled = false;
      });
    });
  }
});

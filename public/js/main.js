/* 
   EmpowerFit Frontend Core Engine
   Manages global UI features, interactive toasts, and user session syncs.
*/

document.addEventListener('DOMContentLoaded', () => {
  // 1. Synchronize navbar links active state
  highlightActiveLink();

  // 2. Query session API to adjust navbar according to log state
  checkSessionStatus();
});

// Highlight the active page in the navbar
function highlightActiveLink() {
  const currentPath = window.location.pathname;
  const navLinks = document.querySelectorAll('.navbar li a');
  
  navLinks.forEach(link => {
    const href = link.getAttribute('href');
    if (currentPath === '/' && (href === 'index.html' || href === '/')) {
      link.classList.add('active');
    } else if (currentPath.includes(href) && href !== 'index.html' && href !== '/') {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
}

// Global Toast Alerts System
function showToast(message, type = 'info') {
  // 1. Create container if not exists
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  // 2. Create toast item
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  toast.innerHTML = `
    <span class="toast-message">${message}</span>
    <span class="toast-close">&times;</span>
  `;

  // 3. Append toast to container
  container.appendChild(toast);

  // 4. Click to dismiss
  const closeBtn = toast.querySelector('.toast-close');
  closeBtn.addEventListener('click', () => {
    toast.style.animation = 'slideIn 0.3s ease reverse forwards';
    setTimeout(() => toast.remove(), 300);
  });

  // 5. Auto dismiss after 4 seconds
  setTimeout(() => {
    if (toast.parentNode) {
      toast.style.animation = 'slideIn 0.3s ease reverse forwards';
      setTimeout(() => toast.remove(), 300);
    }
  }, 4000);
}

// Sync session status to navbar elements dynamically
function checkSessionStatus() {
  fetch('/api/auth/me')
    .then(res => res.json())
    .then(data => {
      const header = document.querySelector('header');
      if (!header) return;

      const navbar = header.querySelector('.navbar');
      let joinBtnContainer = header.querySelector('a[href="join.html"]');

      if (data.success && data.user) {
        // Logged In state: Remove Join Us button and replace with Dashboard/Logout controls
        if (joinBtnContainer) {
          joinBtnContainer.remove();
        }

        // Check if dashboard button already exists
        if (!header.querySelector('.nav-user-controls')) {
          const controls = document.createElement('div');
          controls.className = 'nav-user-controls';
          controls.style.display = 'flex';
          controls.style.alignItems = 'center';
          controls.style.gap = '15px';

          // Dashboard Redirect
          const dashLink = document.createElement('a');
          dashLink.href = 'home.html';
          dashLink.innerHTML = '<button class="btn btn-teal">Dashboard</button>';
          controls.appendChild(dashLink);

          // Logout Action
          const logoutBtn = document.createElement('button');
          logoutBtn.className = 'btn btn-secondary';
          logoutBtn.innerText = 'Log Out';
          logoutBtn.addEventListener('click', handleLogout);
          controls.appendChild(logoutBtn);

          header.appendChild(controls);
        }

        // Add extra home/dashboard links to navbar if not already exists
        const navbarLinks = Array.from(navbar.querySelectorAll('li a')).map(a => a.getAttribute('href'));
        if (!navbarLinks.includes('home.html')) {
          const homeLi = document.createElement('li');
          homeLi.innerHTML = '<a href="home.html">Dashboard</a>';
          navbar.appendChild(homeLi);
          highlightActiveLink();
        }
      }
    })
    .catch(err => console.log('Session status query check skipped.'));
}

// Perform full logout request
function handleLogout() {
  fetch('/api/auth/logout', { method: 'POST' })
    .then(res => res.json())
    .then(data => {
      showToast('Logged out successfully.', 'success');
      setTimeout(() => {
        window.location.href = 'index.html';
      }, 1000);
    })
    .catch(err => {
      showToast('Log out request failed.', 'error');
    });
}

// Expose toast function globally
window.showToast = showToast;

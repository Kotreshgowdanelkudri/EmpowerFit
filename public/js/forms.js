/* 
   EmpowerFit Support Forms Handler
   Connects contact query forms to the Express backend API.
*/

document.addEventListener('DOMContentLoaded', () => {
  const contactForm = document.querySelector('.contact-form form');
  
  if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const name = document.getElementById('name').value.trim();
      const email = document.getElementById('email').value.trim();
      const message = document.getElementById('message').value.trim();

      // Local validation
      if (!name || !email || !message) {
        window.showToast('Please complete all contact form fields.', 'error');
        return;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        window.showToast('Please supply a valid email address.', 'error');
        return;
      }

      const submitBtn = contactForm.querySelector('button[type="submit"]');
      const origText = submitBtn.innerText;
      submitBtn.innerText = 'Submitting message...';
      submitBtn.disabled = true;

      // POST to backend API
      fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, message })
      })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          window.showToast(data.message, 'success');
          contactForm.reset();
        } else {
          window.showToast(data.message, 'error');
        }
        submitBtn.innerText = origText;
        submitBtn.disabled = false;
      })
      .catch(err => {
        window.showToast('Network error submitting contact request.', 'error');
        submitBtn.innerText = origText;
        submitBtn.disabled = false;
      });
    });
  }
});

/**
 * نظام أحمد لإدارة الفنادق - سكربت تسجيل الدخول (login.js)
 * Handles login authentication, input unfreezing, and state resets upon logout.
 */

(function () {
  'use strict';

  const form = document.getElementById('login-form');
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  const errorAlert = document.getElementById('login-error-alert');
  const btnSubmit = document.getElementById('btn-submit');

  const defaultBtnHtml = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
      <polyline points="10 17 15 12 10 7"></polyline>
      <line x1="15" y1="12" x2="3" y2="12"></line>
    </svg>
    تسجيل الدخول إلى النظام
  `;

  /**
   * Completely unlocks and clears input fields on initialization / return from logout
   */
  function unlockAndResetLoginForm() {
    if (form) form.reset();

    if (usernameInput) {
      usernameInput.value = '';
      usernameInput.disabled = false;
      usernameInput.readOnly = false;
      usernameInput.removeAttribute('disabled');
      usernameInput.removeAttribute('readonly');
      usernameInput.style.pointerEvents = 'auto';
      usernameInput.style.opacity = '1';
    }

    if (passwordInput) {
      passwordInput.value = '';
      passwordInput.disabled = false;
      passwordInput.readOnly = false;
      passwordInput.removeAttribute('disabled');
      passwordInput.removeAttribute('readonly');
      passwordInput.style.pointerEvents = 'auto';
      passwordInput.style.opacity = '1';
    }

    if (btnSubmit) {
      btnSubmit.disabled = false;
      btnSubmit.removeAttribute('disabled');
      btnSubmit.style.pointerEvents = 'auto';
      btnSubmit.style.opacity = '1';
      btnSubmit.innerHTML = defaultBtnHtml;
    }

    if (errorAlert) {
      errorAlert.style.display = 'none';
      errorAlert.textContent = '';
    }

    // Remove any leftover overlays, backdrops, or blocking elements
    document.querySelectorAll('.modal-backdrop, .overlay, .loading-overlay').forEach(el => el.remove());
    document.body.style.pointerEvents = 'auto';
    document.body.style.overflow = 'auto';

    // Auto-focus username field so user can type immediately
    setTimeout(() => {
      if (usernameInput) {
        usernameInput.focus();
        usernameInput.select();
      }
    }, 60);
  }

  // Handle Form Submission
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const username = usernameInput ? usernameInput.value.trim() : '';
      const password = passwordInput ? passwordInput.value : '';

      if (!username || !password) {
        if (errorAlert) {
          errorAlert.textContent = 'يرجى إدخال اسم المستخدم وكلمة المرور.';
          errorAlert.style.display = 'block';
        }
        return;
      }

      // Indicate loading state
      if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.style.opacity = '0.75';
        btnSubmit.innerHTML = `<span>جاري التحقق والدخول...</span>`;
      }
      if (errorAlert) {
        errorAlert.style.display = 'none';
      }

      try {
        if (!window.api || !window.api.login) {
          throw new Error('تعذر الاتصال بقناة Electron IPC.');
        }

        const result = await window.api.login({ username, password });

        if (result && result.success) {
          if (result.logId) {
            localStorage.setItem('ahmed_hotel_log_id', String(result.logId));
          }
          if (result.user) {
            localStorage.setItem('currentUserRole', result.user.role);
            localStorage.setItem('currentUsername', result.user.username);
            localStorage.setItem('currentUserId', String(result.user.id));
          }
          window.location.href = 'dashboard.html';
        } else {
          // Re-enable and unlock form on failure
          if (errorAlert) {
            errorAlert.textContent = result?.message || 'اسم المستخدم أو كلمة المرور غير صحيحة.';
            errorAlert.style.display = 'block';
          }
          if (passwordInput) {
            passwordInput.value = '';
            passwordInput.focus();
          }
          if (btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.style.opacity = '1';
            btnSubmit.innerHTML = defaultBtnHtml;
          }
        }
      } catch (err) {
        console.error('Login error:', err);
        if (errorAlert) {
          errorAlert.textContent = `خطأ في الاتصال: ${err.message}`;
          errorAlert.style.display = 'block';
        }
        if (btnSubmit) {
          btnSubmit.disabled = false;
          btnSubmit.style.opacity = '1';
          btnSubmit.innerHTML = defaultBtnHtml;
        }
      }
    });
  }

  async function applyLoginBranding() {
    try {
      if (window.api && typeof window.api.getBrandingConfig === 'function') {
        const res = await window.api.getBrandingConfig();
        if (res && res.current) {
          const brand = res.current;
          const logoEl = document.getElementById('login-brand-logo');
          const titleEl = document.getElementById('login-brand-title');
          const subEl = document.getElementById('login-brand-subtitle');
          if (logoEl && brand.logo) logoEl.src = brand.logo;
          if (titleEl && brand.nameAr) titleEl.textContent = brand.nameAr;
          if (subEl) subEl.textContent = `${brand.nameEn || ''} • ${brand.subtitle || 'نظام إدارة الحجوزات الفندقية'}`;
          document.title = `تسجيل الدخول | ${brand.nameAr} - ${brand.nameEn || ''}`;
        }
      }
    } catch (err) {
      console.warn('[Branding] Could not load login branding:', err);
    }
  }

  // Run unfreezing, branding, and reset immediately
  unlockAndResetLoginForm();
  applyLoginBranding();
  window.addEventListener('pageshow', unlockAndResetLoginForm);

  // Export helper
  window.unlockAndResetLoginForm = unlockAndResetLoginForm;
})();

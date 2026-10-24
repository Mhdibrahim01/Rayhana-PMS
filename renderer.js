/**
 * نظام أحمد لإدارة الفنادق (Ahmed Hotel ERP)
 * Frontend RBAC Logic & UI Controller (renderer.js)
 * Strict Role-Based Access Control:
 * - Admin: Full access (Users management, logs, additions/deletions, reservations, guests).
 * - User (Staff): Allowed ONLY to manage reservations and add/view guests/customers. CANNOT manage users.
 */

(function () {
  'use strict';

  // State
  let currentUser = null;
  let currentUserRole = localStorage.getItem('currentUserRole') || 'User';

  // DOM Elements - Navigation & Sections
  const navUserManagement = document.getElementById('nav-admin') || document.querySelector('[data-section="admin"]');
  const navLogs = document.getElementById('nav-logs') || document.querySelector('[data-section="logs"]');
  const sectionUserManagement = document.getElementById('view-admin');
  const sectionLogs = document.getElementById('view-logs');
  const userManagementButtons = document.querySelectorAll('[data-action="delete-user"], #btn-refresh-users, #add-user-form button');

  // Customer Management Elements (Accessible to both Admin and User)
  const btnToggleAddCustomer = document.getElementById('btn-toggle-add-customer');
  const addCustomerPanel = document.getElementById('add-customer-panel');
  const addCustomerForm = document.getElementById('add-customer-form');
  const btnCancelAddCustomer = document.getElementById('btn-cancel-add-customer');
  const newCustomerName = document.getElementById('new-customer-name');
  const newCustomerPhone = document.getElementById('new-customer-phone');
  const newCustomerId = document.getElementById('new-customer-id');

  // User Management Form Elements (Admin Only)
  const addUserForm = document.getElementById('add-user-form');
  const newUsernameInput = document.getElementById('new-username');
  const newUserPasswordInput = document.getElementById('new-user-password');
  const newUserRoleSelect = document.getElementById('new-user-role');

  /**
   * Enforces strict RBAC on UI elements.
   * If role is 'User', completely hides User Management and Employee Logs.
   * Keeps Add Customer visible to both Admin and User.
   * @param {string} role - 'Admin' | 'User'
   */
  function applyRbacUI(role) {
    currentUserRole = role;
    const isAdmin = role === 'Admin';

    // 1. Sidebar Links Visibility
    if (navUserManagement) {
      navUserManagement.style.display = isAdmin ? 'flex' : 'none';
    }
    if (navLogs) {
      navLogs.style.display = isAdmin ? 'flex' : 'none';
    }

    // 2. UI Panels / Sections Visibility
    if (sectionUserManagement) {
      sectionUserManagement.style.display = isAdmin ? '' : 'none';
    }
    if (sectionLogs) {
      sectionLogs.style.display = isAdmin ? '' : 'none';
    }

    // 3. User Management Buttons Visibility
    userManagementButtons.forEach(btn => {
      btn.style.display = isAdmin ? '' : 'none';
    });

    // 4. Ensure Add Customer is explicitly visible to both roles
    if (btnToggleAddCustomer) {
      btnToggleAddCustomer.style.display = 'inline-flex';
    }
    const viewGuests = document.getElementById('view-guests');
    if (viewGuests) {
      viewGuests.style.display = '';
    }

    console.log(`[RBAC] UI updated for role: "${role}" (Admin Privileges: ${isAdmin})`);
  }

  /**
   * Stores user session & role in localStorage
   * @param {Object} user - { id, username, role }
   */
  function setUserSession(user) {
    if (!user) return;
    currentUser = user;
    currentUserRole = user.role || 'User';
    localStorage.setItem('currentUserRole', currentUserRole);
    localStorage.setItem('currentUsername', user.username);
    localStorage.setItem('currentUserId', String(user.id));
    applyRbacUI(currentUserRole);
  }

  /**
   * Helper for Toast Notifications
   */
  function showToast(message, type = 'info') {
    if (window.DashboardApp?.Helpers?.showToast) {
      return window.DashboardApp.Helpers.showToast(message, type);
    }
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    } else if (container.parentElement !== document.body) {
      document.body.appendChild(container);
    }
    container.style.zIndex = '9999999';
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.setAttribute('role', 'alert');
    toast.innerHTML = `<span style="flex: 1;">${message}</span><button type="button" class="toast-close" aria-label="إغلاق" title="إغلاق" style="background:none;border:none;cursor:pointer;font-size:16px;color:inherit;padding:0 4px;margin-inline-start:auto;">&times;</button>`;
    toast.querySelector('.toast-close')?.addEventListener('click', () => {
      if (toast.isConnected) toast.remove();
    });
    container.appendChild(toast);
    setTimeout(() => {
      if (toast.isConnected) toast.remove();
    }, 3500);
  }

  /**
   * Register Add Customer Handler (Both Admin and User permitted)
   */
  if (btnToggleAddCustomer && addCustomerPanel) {
    btnToggleAddCustomer.addEventListener('click', () => {
      const isHidden = addCustomerPanel.style.display === 'none' || !addCustomerPanel.style.display;
      addCustomerPanel.style.display = isHidden ? 'block' : 'none';
      if (isHidden && newCustomerName) newCustomerName.focus();
    });
  }

  if (btnCancelAddCustomer && addCustomerPanel) {
    btnCancelAddCustomer.addEventListener('click', () => {
      addCustomerPanel.style.display = 'none';
      if (addCustomerForm) addCustomerForm.reset();
    });
  }

  if (addCustomerForm) {
    addCustomerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = newCustomerName ? newCustomerName.value.trim() : '';
      const phone = newCustomerPhone ? newCustomerPhone.value.trim() : '';
      const id_number = newCustomerId ? newCustomerId.value.trim() : '';

      // Strict Validation
      if (!name) {
        showToast('يرجى إدخال اسم العميل / النزيل.', 'error');
        return;
      }
      const cleanPhone = phone ? String(phone).trim().replace(/[\s\-\(\)]/g, '') : '';
      if (cleanPhone && !/^(?:\+|00)?[0-9]{7,15}$/.test(cleanPhone)) {
        showToast('رقم الجوال غير صحيح: يرجى إدخال رقم هاتف صحيح من 7 إلى 15 رقماً (محلي أو دولي).', 'error');
        return;
      }
      if (id_number && !/^(?:\d{10}|[a-zA-Z0-9]{6,9})$/i.test(id_number)) {
        showToast('رقم الهوية الوطنية أو الإقامة (10 أرقام) أو جواز السفر (6 إلى 9 خانات) غير صحيح.', 'error');
        return;
      }

      try {
        const res = await window.api.addCustomer({ name, phone, id_number }, currentUserRole);
        if (res.success) {
          showToast(`تم تسجيل بيانات النزيل "${name}" بنجاح!`, 'success');
          addCustomerForm.reset();
          if (addCustomerPanel) addCustomerPanel.style.display = 'none';
          if (typeof window.loadGuestsData === 'function') {
            await window.loadGuestsData();
          }
        } else {
          showToast(res.error || 'فشل حفظ بيانات النزيل.', 'error');
        }
      } catch (err) {
        console.error('Add customer error:', err);
        showToast(`خطأ أثناء الحفظ: ${err.message}`, 'error');
      }
    });
  }

  /**
   * Register Add User Handler (Admin Only)
   */
  if (addUserForm) {
    addUserForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (currentUserRole !== 'Admin') {
        showToast('Access Denied: Admin privileges required.', 'error');
        return;
      }

      const username = newUsernameInput ? newUsernameInput.value.trim() : '';
      const password = newUserPasswordInput ? newUserPasswordInput.value : '';
      const role = newUserRoleSelect ? newUserRoleSelect.value : 'User';

      if (!username || !password) {
        showToast('يرجى إدخال اسم المستخدم وكلمة المرور.', 'error');
        return;
      }

      try {
        const res = await window.api.addUser({ username, password, role }, currentUserRole);
        if (res.success) {
          showToast(`تم إنشاء حساب "${username}" بصلاحية ${role} بنجاح!`, 'success');
          addUserForm.reset();
          if (typeof window.loadAdminData === 'function') {
            await window.loadAdminData();
          }
        } else {
          showToast(res.error || 'فشل إنشاء المستخدم.', 'error');
        }
      } catch (err) {
        showToast(`خطأ: ${err.message}`, 'error');
      }
    });
  }

  /**
   * Delete User Action (Admin Only)
   */
  window.handleDeleteUser = async function (userId, username) {
    if (currentUserRole !== 'Admin') {
      showToast('Access Denied: Admin privileges required.', 'error');
      return;
    }

    const confirmed = (typeof window.showConfirmDialog === 'function')
      ? await window.showConfirmDialog({
          title: 'حذف مستخدم من النظام',
          message: `هل أنت متأكد من حذف المستخدم "${username}"؟`,
          confirmText: 'نعم، حذف المستخدم',
          cancelText: 'إلغاء',
          isDanger: true
        })
      : confirm(`هل أنت متأكد من حذف المستخدم "${username}"؟`);

    if (confirmed) {
      try {
        const res = await window.api.deleteUser(userId, currentUserRole);
        if (res.success) {
          showToast(`تم حذف المستخدم "${username}" بنجاح.`, 'info');
          if (typeof window.loadAdminData === 'function') {
            await window.loadAdminData();
          }
        } else {
          showToast(res.error || 'فشل حذف المستخدم.', 'error');
        }
      } catch (err) {
        showToast(`خطأ: ${err.message}`, 'error');
      }
    }
  };

  /**
   * Auto-fill returning guest details in Reservation form
   */
  function initGuestAutofill() {
    const phoneInput = document.getElementById('guest-phone');
    const idInput = document.getElementById('guest-id-number');
    const nameInput = document.getElementById('guest-name');
    const statusBanner = document.getElementById('autofill-guest-status');
    const statusMsg = document.getElementById('autofill-guest-msg');
    let debounceTimer = null;
    let lastFilledId = null;

    if (!phoneInput || !idInput || !nameInput) return;

    const triggerSearch = async (source) => {
      const phone = phoneInput.value.trim();
      const idNum = idInput.value.trim();
      const activeVal = source === 'phone' ? phone : idNum;

      if (!activeVal || activeVal.length < 4) {
        if (!phone && !idNum && statusBanner) {
          statusBanner.style.display = 'none';
        }
        return;
      }

      try {
        const res = await window.api.searchGuest({ phone, id_number: idNum });
        if (res && res.success && res.guest) {
          const guest = res.guest;
          if (guest.id !== lastFilledId || !nameInput.value.trim()) {
            lastFilledId = guest.id;
            nameInput.value = guest.name || '';
            if (source === 'phone' && guest.id_number && !idInput.value.trim()) {
              idInput.value = guest.id_number;
            } else if (source === 'id' && guest.phone && !phoneInput.value.trim()) {
              phoneInput.value = guest.phone;
            }
            if (statusBanner && statusMsg) {
              const stays = parseInt(guest.total_stays, 10) || 1;
              const staysText = stays === 1 ? 'إقامة سابقة واحدة' : `${stays} إقامات سابقة`;
              statusMsg.innerHTML = `<strong>تم التعرف على النزيل السابق:</strong> ${guest.name} (${staysText}) - تم ملء البيانات تلقائياً.`;
              statusBanner.style.display = 'flex';
            }
            showToast(`مرحباً بعودته! تم استرجاع بيانات النزيل السابق "${guest.name}" تلقائياً.`, 'success');
          }
        }
      } catch (err) {
        console.error('Autofill error:', err);
      }
    };

    phoneInput.addEventListener('keyup', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => triggerSearch('phone'), 300);
    });
    phoneInput.addEventListener('blur', () => triggerSearch('phone'));

    idInput.addEventListener('keyup', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => triggerSearch('id'), 300);
    });
    idInput.addEventListener('blur', () => triggerSearch('id'));
  }

  /**
   * Complete Logout Function (renderer.js)
   * Ensures that upon logging out:
   * 1. Logs out on the backend via IPC (updates employee logout timestamp)
   * 2. Clears all session storage & local credentials
   * 3. Fully clears input fields (value = '')
   * 4. Removes any disabled/readonly attributes, pointer-events locks, or frozen states
   * 5. Purges any leftover blocking overlays, modals, or backdrops
   * 6. Automatically focuses the username input so the user can type immediately
   */
  async function logout() {
    try {
      const storedLogId = localStorage.getItem('ahmed_hotel_log_id');
      if (window.api && typeof window.api.logout === 'function') {
        await window.api.logout(storedLogId ? parseInt(storedLogId, 10) : null);
      }
    } catch (err) {
      console.warn('[Logout] API logout warning:', err);
    } finally {
      // 1. Purge session storage & cached authentication credentials
      localStorage.removeItem('ahmed_hotel_log_id');
      localStorage.removeItem('currentUserRole');
      localStorage.removeItem('currentUsername');
      localStorage.removeItem('currentUserId');
      currentUser = null;
      currentUserRole = 'User';

      // 2. Unfreeze, clear, and enable inputs if present in current document
      const usernameInput = document.getElementById('username');
      const passwordInput = document.getElementById('password');
      const submitBtn = document.getElementById('btn-submit');
      const loginForm = document.getElementById('login-form');

      if (loginForm) {
        loginForm.reset();
      }

      [usernameInput, passwordInput].forEach(inp => {
        if (inp) {
          inp.value = '';
          inp.disabled = false;
          inp.readOnly = false;
          inp.removeAttribute('disabled');
          inp.removeAttribute('readonly');
          inp.style.pointerEvents = 'auto';
          inp.style.opacity = '1';
        }
      });

      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.removeAttribute('disabled');
        submitBtn.style.pointerEvents = 'auto';
        submitBtn.style.opacity = '1';
      }

      // 3. Remove any active overlays, backdrops, and restore pointer events on body
      document.querySelectorAll('.modal-backdrop, .overlay, .loading-overlay, .modal').forEach(el => el.remove());
      document.body.style.pointerEvents = 'auto';
      document.body.style.overflow = 'auto';

      // 4. Auto-focus username input for immediate credential typing
      setTimeout(() => {
        if (usernameInput) {
          usernameInput.focus();
          usernameInput.select();
        }
      }, 50);

      if (!window.location.pathname.endsWith('login.html')) {
        window.location.href = 'login.html';
      }
    }
  }

  /**
   * Initialize Renderer State
   */
  async function initRenderer() {
    // 1. Initial enforcement from cached role
    const cachedRole = localStorage.getItem('currentUserRole') || 'User';
    applyRbacUI(cachedRole);
    initGuestAutofill();

    // 2. Bind logout button only if not already managed by dashboard modal
    const btnLogout = document.getElementById('btn-logout');
    const hasModal = document.getElementById('logout-confirm-modal');
    if (btnLogout && !hasModal) {
      btnLogout.addEventListener('click', async (e) => {
        e.preventDefault();
        await logout();
      });
    }

    // 3. Fetch authenticated session from main process
    try {
      if (window.api && window.api.getCurrentUser) {
        const user = await window.api.getCurrentUser();
        if (user) {
          setUserSession(user);
        }
      }
    } catch (err) {
      console.warn('[RBAC] Could not retrieve session user:', err);
    }
  }

  // Export functions to window for interoperability
  window.setUserSession = setUserSession;
  window.applyRbacUI = applyRbacUI;
  window.logout = logout;

  // Run on DOM loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initRenderer);
  } else {
    initRenderer();
  }
})();

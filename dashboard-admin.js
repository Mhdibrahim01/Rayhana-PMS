(function(App) {
  'use strict';

  // =========================================================================
  // VIEW 5: ADMIN PANEL & USER MANAGEMENT (RBAC)
  // =========================================================================
  async function loadAdminData() {
    const activeRole = localStorage.getItem('currentUserRole') || (App.State.currentUser ? App.State.currentUser.role : null);
    if (activeRole !== 'Admin') return;

    try {
      const res = await window.api.getAllUsers();
      if (res.success) {
        App.State.usersCache = res.data || [];
        renderUsersTable();
      } else {
        App.Helpers.showToast(res.error || 'تعذر تحميل المستخدمين.', 'error');
      }
    } catch (err) {
      console.error('Load users error:', err);
    }
    await loadBusinessDayAdminSettings();
    await loadBrandAdminSettings();
  }

  async function loadBusinessDayAdminSettings() {
    const form = document.getElementById('business-day-settings-form');
    const notice = document.getElementById('business-day-pending-reconciliation');
    if (!form) return;
    try {
      const [settingsResult, pendingResult, policiesResult] = await Promise.all([
        window.api.getBusinessDaySettings(),
        window.api.getPendingShiftReconciliationAudits(),
        window.api.getReceiptStayPolicies()
      ]);
      if (settingsResult?.success && settingsResult.data) {
        document.getElementById('business-day-cutoff-time').value = settingsResult.data.business_day_cutoff_time;
        const timezoneSelect = document.getElementById('hotel-timezone');
        const detectedTimezone = document.getElementById('detected-timezone-display');
        
        // Get saved timezone or default to Asia/Riyadh
        let savedTimezone = settingsResult.data.hotel_timezone || 'Asia/Riyadh';
        
        // Auto-detect system timezone if needed
        if (savedTimezone === 'auto' || !savedTimezone) {
          try {
            savedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Riyadh';
          } catch (e) {
            savedTimezone = 'Asia/Riyadh';
          }
        }
        
        // Set the select value
        timezoneSelect.value = savedTimezone;
        
        // Update the display
        if (detectedTimezone) {
          detectedTimezone.textContent = savedTimezone;
        }
        
        document.getElementById('auto-rollover-enabled').checked = settingsResult.data.auto_rollover_enabled;
      } else {
        // Set default timezone to Saudi Arabia if no settings exist
        const timezoneSelect = document.getElementById('hotel-timezone');
        const detectedTimezone = document.getElementById('detected-timezone-display');
        if (timezoneSelect) timezoneSelect.value = 'Asia/Riyadh';
        if (detectedTimezone) detectedTimezone.textContent = 'Asia/Riyadh';
      }
      if (policiesResult?.success && Array.isArray(policiesResult.data)) {
        const policyInput = document.getElementById('receipt-policy-text');
        if (policyInput) policyInput.value = policiesResult.data.join('\n');
      }
      const pending = pendingResult?.success && Array.isArray(pendingResult.data) ? pendingResult.data : [];
      if (notice) {
        notice.hidden = pending.length === 0;
        notice.innerHTML = pending.map(audit => `
          <div class="business-day-pending-row">
            <div><strong>إقفال تلقائي يحتاج إلى مطابقة الوردية</strong><span>اليوم المغلق: <bdi dir="ltr">${App.Helpers.escapeHtml(audit.closed_business_date)}</bdi></span></div>
            <button type="button" data-reconcile-audit-id="${Number(audit.id)}">تمت المراجعة والمطابقة</button>
          </div>`).join('');
      }
    } catch (error) {
      console.warn('تعذر تحميل إعدادات اليوم الفندقي:', error);
    }
  }

  function updateBrandPreviewAndInputs(brand) {
    if (!brand) return;
    const logoEl = document.getElementById('brand-preview-logo');
    const nameEl = document.getElementById('brand-preview-name');
    const compEl = document.getElementById('brand-preview-company');
    const sealEl = document.getElementById('brand-preview-seal');
    const sigEl = document.getElementById('brand-preview-signature');

    if (logoEl && brand.logo) logoEl.src = brand.logo;
    if (nameEl && brand.nameAr) nameEl.textContent = brand.nameAr;
    if (compEl && brand.companyAr) compEl.textContent = brand.companyAr;
    if (sealEl && brand.seal) sealEl.src = brand.seal;
    if (sigEl && brand.signature) sigEl.src = brand.signature;

    const inNameAr = document.getElementById('brand-edit-name-ar');
    const inNameEn = document.getElementById('brand-edit-name-en');
    const inComp = document.getElementById('brand-edit-company-ar');
    const inCr = document.getElementById('brand-edit-cr');
    const inVat = document.getElementById('brand-edit-vat');
    const inPhone = document.getElementById('brand-edit-phone');
    const inAddr = document.getElementById('brand-edit-address');
    const inPost = document.getElementById('brand-edit-postal');

    if (inNameAr) inNameAr.value = brand.nameAr || '';
    if (inNameEn) inNameEn.value = brand.nameEn || '';
    if (inComp) inComp.value = brand.companyAr || '';
    if (inCr) inCr.value = brand.crNumber || '';
    if (inVat) inVat.value = brand.vatNumber || '';
    if (inPhone) inPhone.value = brand.phone || '';
    if (inAddr) inAddr.value = brand.address || '';
    if (inPost) inPost.value = brand.postalCode || '';
  }

  async function loadBrandAdminSettings() {
    try {
      const brandCard = document.querySelector('.brand-management-card');
      if (!window.api || typeof window.api.getBrandingConfig !== 'function') {
        if (brandCard) brandCard.style.display = 'none';
        return;
      }

      let isPackaged = Boolean(App.State.isPackaged);
      try {
        if (typeof window.api.getAppInfo === 'function') {
          const info = await window.api.getAppInfo();
          if (info && typeof info.isPackaged === 'boolean') {
            isPackaged = info.isPackaged;
          }
        }
      } catch (_) {}

      const res = await window.api.getBrandingConfig();
      if (res && res.success) {
        if (brandCard) {
          brandCard.style.display = '';
          brandCard.removeAttribute('hidden');
        }

        const effectiveIsPackaged = Boolean(isPackaged || res.isPackaged);
        App.State.isPackaged = effectiveIsPackaged;
        App.State.brands = res.brands || {};
        App.State.activeBrandId = res.activeBrandId || 'hotel_1';
        App.State.branding = res.current;

        const switcherControls = document.getElementById('brand-switcher-controls');
        const titleEl = document.getElementById('brand-management-title');
        const subtitleEl = document.getElementById('brand-management-subtitle');
        const btnSave = document.getElementById('btn-save-brand-profile');

        if (effectiveIsPackaged) {
          // Client mode (Packaged EXE): Only show their hotel data, hide brand switcher
          if (switcherControls) switcherControls.style.display = 'none';
          if (titleEl) titleEl.innerHTML = '<span>🏨</span> بيانات المنشأة والفندق (Hotel Profile)';
          if (subtitleEl) subtitleEl.textContent = 'بيانات المنشأة المعتمدة في الفواتير الرسمية والتقارير والسندات.';
          if (btnSave) btnSave.innerHTML = '💾 حفظ بيانات المنشأة';
        } else {
          // Developer mode (Local/Dev): Show all brands and switcher controls
          if (switcherControls) switcherControls.style.display = 'flex';
          if (titleEl) titleEl.innerHTML = '<span>🏷️</span> إدارة الهوية والعلامة التجارية (Multi-Brand / White-Label)';
          if (subtitleEl) subtitleEl.textContent = 'التبديل بين هويات الفنادق وتحديث بيانات الفاتورة والأختام والتواقيع المعتمدة.';
          if (btnSave) btnSave.innerHTML = '💾 حفظ تعديلات الهوية';

          const selector = document.getElementById('brand-selector');
          if (selector && res.brands) {
            selector.innerHTML = Object.entries(res.brands).map(([id, b]) => {
              return `<option value="${id}">${App.Helpers.escapeHtml(b.nameAr)} (${App.Helpers.escapeHtml(b.nameEn || id)})</option>`;
            }).join('');
            selector.value = App.State.activeBrandId;
          }
        }

        updateBrandPreviewAndInputs(res.current);
      }
    } catch (error) {
      console.warn('تعذر تحميل إعدادات الهوية والعلامة التجارية:', error);
    }
  }

  function renderUsersTable() {
    App.DOM.usersTableBody.innerHTML = App.State.usersCache.map(u => {
      const isAdmin = u.role === 'Admin';
      const isDefaultAdmin = u.username.toLowerCase() === 'admin';

      return `
        <tr>
          <td style="font-family: monospace; font-weight: 700; color: var(--primary);">#${u.id}</td>
          <td style="font-weight: 700; font-size: 0.9rem;">
            ${App.Helpers.escapeHtml(u.username)}
            ${App.State.currentUser && u.id === App.State.currentUser.id ? ' <span style="font-size: 0.7rem; color: var(--success); font-weight: 600;">(أنت)</span>' : ''}
          </td>
          <td>
            <span class="badge-unified ${isAdmin ? 'badge-role-admin' : 'badge-role-staff'}">
              ${isAdmin ? 'مدير نظام (Admin) 🛡️' : 'مستخدم (User) 💼'}
            </span>
          </td>
          <td style="font-size: 0.8rem; color: var(--text-muted);">${App.Helpers.escapeHtml(String(u.created_at || '').split(' ')[0])}</td>
          <td style="text-align: center;">
            ${!isDefaultAdmin && (!App.State.currentUser || u.id !== App.State.currentUser.id) ? `
              <button class="btn btn-danger btn-sm" data-action="delete-user" data-id="${u.id}" data-username="${App.Helpers.escapeHtml(u.username)}" title="حذف هذا المستخدم" style="display: inline-flex; align-items: center; justify-content: center; gap: 5px; padding: 5px 12px; font-size: 0.78rem; font-weight: 700; border-radius: 8px; cursor: pointer;">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
                <span>حذف</span>
              </button>
            ` : `<span style="font-size: 0.75rem; color: var(--text-light);">-</span>`}
          </td>
        </tr>
      `;
    }).join('');
  }

  App.Helpers.initAdmin = function() {
  const businessDaySettingsForm = document.getElementById('business-day-settings-form');
  if (businessDaySettingsForm) {
    businessDaySettingsForm.addEventListener('submit', async event => {
      event.preventDefault();
      const submit = businessDaySettingsForm.querySelector('button[type="submit"]');
      if (submit) submit.disabled = true;
      try {
        const timezoneSelect = document.getElementById('hotel-timezone');
        let timezone = timezoneSelect.value;
        
        // Handle auto-detection
        if (timezone === 'auto') {
          try {
            timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Riyadh';
          } catch (e) {
            timezone = 'Asia/Riyadh';
          }
        }
        
        // Update the display
        const detectedTimezone = document.getElementById('detected-timezone-display');
        if (detectedTimezone) {
          detectedTimezone.textContent = timezone;
        }
        
        const response = await window.api.updateBusinessDaySettings({
          business_day_cutoff_time: document.getElementById('business-day-cutoff-time').value,
          hotel_timezone: timezone,
          auto_rollover_enabled: document.getElementById('auto-rollover-enabled').checked
        });
        if (!response?.success) throw new Error(response?.error || 'تعذر حفظ الإعدادات.');
        App.Helpers.showToast('تم حفظ إعدادات اليوم الفندقي.', 'success');
        await loadBusinessDayAdminSettings();
      } catch (error) {
        App.Helpers.showToast(error.message || 'تعذر حفظ الإعدادات.', 'error');
      } finally {
        if (submit) submit.disabled = false;
      }
    });
  }
  
  // Add timezone change listener to update display
  const timezoneSelect = document.getElementById('hotel-timezone');
  if (timezoneSelect) {
    timezoneSelect.addEventListener('change', function() {
      const detectedTimezone = document.getElementById('detected-timezone-display');
      if (!detectedTimezone) return;
      
      let displayValue = this.value;
      
      // If auto is selected, show the detected timezone
      if (displayValue === 'auto') {
        try {
          displayValue = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Riyadh';
        } catch (e) {
          displayValue = 'Asia/Riyadh';
        }
        detectedTimezone.textContent = displayValue + ' (مكتشف تلقائياً)';
      } else {
        detectedTimezone.textContent = displayValue;
      }
    });
  }

  const receiptPolicySettingsForm = document.getElementById('receipt-policy-settings-form');
  if (receiptPolicySettingsForm) {
    receiptPolicySettingsForm.addEventListener('submit', async event => {
      event.preventDefault();
      const submit = receiptPolicySettingsForm.querySelector('button[type="submit"]');
      if (submit) submit.disabled = true;
      try {
        const policies = document.getElementById('receipt-policy-text').value.split(/\r?\n/).map(value => value.trim()).filter(Boolean);
        if (policies.length > 7) throw new Error('يمكن حفظ 7 شروط كحد أقصى.');
        const response = await window.api.updateReceiptStayPolicies(policies);
        if (!response?.success) throw new Error(response?.error || 'تعذر حفظ سياسة الإقامة.');
        document.getElementById('receipt-policy-text').value = response.data.join('\n');
        App.Helpers.showToast('تم حفظ سياسة الإقامة والشروط.', 'success');
      } catch (error) {
        App.Helpers.showToast(error.message || 'تعذر حفظ سياسة الإقامة.', 'error');
      } finally {
        if (submit) submit.disabled = false;
      }
    });
  }

  const reconciliationNotice = document.getElementById('business-day-pending-reconciliation');
  if (reconciliationNotice) {
    reconciliationNotice.addEventListener('click', async event => {
      const button = event.target.closest('[data-reconcile-audit-id]');
      if (!button) return;
      button.disabled = true;
      try {
        const response = await window.api.reconcileShiftAudit(button.dataset.reconcileAuditId);
        if (!response?.success) throw new Error(response?.error || 'تعذر تأكيد المصالحة.');
        App.Helpers.showToast('تم تأكيد مصالحة الوردية.', 'success');
        await loadBusinessDayAdminSettings();
        if (typeof window.refreshBusinessDayReconciliationNotice === 'function') await window.refreshBusinessDayReconciliationNotice();
      } catch (error) {
        App.Helpers.showToast(error.message || 'تعذر تأكيد المصالحة.', 'error');
        button.disabled = false;
      }
    });
  }
  // Add User Form (Admin Only)
  App.DOM.addUserForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = App.DOM.newUsernameInput.value.trim();
    const password = App.DOM.newUserPasswordInput.value;
    const role = App.DOM.newUserRoleSelect.value;

    if (!username || !password) {
      App.Helpers.showToast('يرجى ملء اسم المستخدم وكلمة المرور.', 'error');
      return;
    }

    const activeRole = localStorage.getItem('currentUserRole') || (App.State.currentUser ? App.State.currentUser.role : 'User');

    try {
      const res = await window.api.addUser({ username, password, role }, activeRole);
      if (res.success) {
        App.Helpers.showToast(`تم إنشاء حساب "${username}" بصلاحية ${role} بنجاح!`, 'success');
        App.DOM.addUserForm.reset();
        await loadAdminData();
      } else {
        App.Helpers.showToast(res.error || 'فشل إنشاء المستخدم.', 'error');
      }
    } catch (err) {
      App.Helpers.showToast(`خطأ: ${err.message}`, 'error');
    }
  });

  // Update Admin Password Form
  App.DOM.updatePasswordForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const newPassword = App.DOM.currentAdminNewPasswordInput.value;
    if (!newPassword || newPassword.length < 3) {
      App.Helpers.showToast('كلمة المرور يجب أن لا تقل عن 3 أحرف.', 'error');
      return;
    }

    try {
      const res = await window.api.updateUserPassword({
        userId: App.State.currentUser ? App.State.currentUser.id : null,
        newPassword
      });

      if (res.success) {
        App.Helpers.showToast('تم تحديث كلمة المرور الخاصة بك بنجاح!', 'success');
        App.DOM.updatePasswordForm.reset();
      } else {
        App.Helpers.showToast(res.error || 'فشل تحديث كلمة المرور.', 'error');
      }
    } catch (err) {
      App.Helpers.showToast(`خطأ: ${err.message}`, 'error');
    }
  });

  App.DOM.btnRefreshUsers.addEventListener('click', loadAdminData);

  // Delete User delegation (Admin Only)
  App.DOM.usersTableBody.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action="delete-user"]');
    if (!btn) return;

    const userId = btn.dataset.id;
    const username = btn.dataset.username;
    const activeRole = localStorage.getItem('currentUserRole') || (App.State.currentUser ? App.State.currentUser.role : 'User');

    const confirmed = await App.Helpers.showConfirmDialog({
      title: 'حذف مستخدم من النظام',
      message: `هل أنت متأكد من رغبتك في حذف المستخدم "${username}"؟\nلن يتمكن هذا المستخدم من تسجيل الدخول للنظام بعد الحذف.`,
      confirmText: 'نعم، حذف المستخدم',
      cancelText: 'إلغاء',
      isDanger: true
    });

    if (confirmed) {
      try {
        const res = await window.api.deleteUser(userId, activeRole);
        if (res.success) {
          App.Helpers.showToast(`تم حذف المستخدم "${username}" بنجاح.`, 'info');
          await loadAdminData();
        } else {
          App.Helpers.showToast(res.error || 'فشل حذف المستخدم.', 'error');
        }
      } catch (err) {
        App.Helpers.showToast(`خطأ: ${err.message}`, 'error');
      }
    }
  });

  // =========================================================================
  // FACTORY RESET APP DATA (Requires Admin Role & Password Challenge)
  // =========================================================================

  function openFactoryResetModal() {
    const activeRole = localStorage.getItem('currentUserRole') || (App.State.currentUser ? App.State.currentUser.role : null);
    if (activeRole !== 'Admin') {
      App.Helpers.showToast('غير مصرح: تصفير بيانات التطبيق يتطلب صلاحيات مدير النظام (Admin).', 'error');
      return;
    }
    if (App.DOM.factoryResetPasswordInput) App.DOM.factoryResetPasswordInput.value = '';
    if (App.DOM.factoryResetErrorMsg) {
      App.DOM.factoryResetErrorMsg.textContent = '';
      App.DOM.factoryResetErrorMsg.style.display = 'none';
    }
    if (App.DOM.factoryResetModal) {
      App.DOM.factoryResetModal.style.display = 'flex';
      setTimeout(() => {
        if (App.DOM.factoryResetPasswordInput) App.DOM.factoryResetPasswordInput.focus();
      }, 100);
    }
  }

  function closeFactoryResetModal() {
    if (App.DOM.factoryResetModal) App.DOM.factoryResetModal.style.display = 'none';
    if (App.DOM.factoryResetPasswordInput) App.DOM.factoryResetPasswordInput.value = '';
    if (App.DOM.factoryResetErrorMsg) {
      App.DOM.factoryResetErrorMsg.textContent = '';
      App.DOM.factoryResetErrorMsg.style.display = 'none';
    }
  }

  if (App.DOM.btnOpenFactoryReset) {
    App.DOM.btnOpenFactoryReset.addEventListener('click', openFactoryResetModal);
  }
  if (App.DOM.btnCloseFactoryReset) {
    App.DOM.btnCloseFactoryReset.addEventListener('click', closeFactoryResetModal);
  }
  if (App.DOM.btnCancelFactoryReset) {
    App.DOM.btnCancelFactoryReset.addEventListener('click', closeFactoryResetModal);
  }
  if (App.DOM.factoryResetModal) {
    App.DOM.factoryResetModal.addEventListener('click', (e) => {
      if (e.target === App.DOM.factoryResetModal) closeFactoryResetModal();
    });
  }

  if (App.DOM.factoryResetForm) {
    App.DOM.factoryResetForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const pwd = App.DOM.factoryResetPasswordInput ? App.DOM.factoryResetPasswordInput.value : '';
      if (!pwd) {
        if (App.DOM.factoryResetErrorMsg) {
          App.DOM.factoryResetErrorMsg.textContent = 'يرجى كتابة كلمة المرور لتأكيد تصفير البيانات.';
          App.DOM.factoryResetErrorMsg.style.display = 'block';
        }
        return;
      }

      if (App.DOM.btnSubmitFactoryReset) {
        App.DOM.btnSubmitFactoryReset.disabled = true;
        App.DOM.btnSubmitFactoryReset.textContent = 'جاري تصفير البيانات...';
      }

      try {
        const res = await window.api.factoryResetDatabase(pwd);
        if (res && res.success) {
          App.Helpers.showToast(res.message || 'تم تصفير بيانات النظام بنجاح واستعادة تهيئة المصنع!', 'success');
          closeFactoryResetModal();
          setTimeout(() => {
            window.location.reload();
          }, 1200);
        } else {
          if (App.DOM.factoryResetErrorMsg) {
            App.DOM.factoryResetErrorMsg.textContent = res?.error || 'فشلت عملية تصفير البيانات: تأكد من صحة كلمة المرور.';
            App.DOM.factoryResetErrorMsg.style.display = 'block';
          }
          if (App.DOM.factoryResetPasswordInput) {
            App.DOM.factoryResetPasswordInput.focus();
            App.Helpers.highlightField(App.DOM.factoryResetPasswordInput);
          }
        }
      } catch (err) {
        if (App.DOM.factoryResetErrorMsg) {
          App.DOM.factoryResetErrorMsg.textContent = `خطأ: ${err.message}`;
          App.DOM.factoryResetErrorMsg.style.display = 'block';
        }
      } finally {
        if (App.DOM.btnSubmitFactoryReset) {
          App.DOM.btnSubmitFactoryReset.disabled = false;
          App.DOM.btnSubmitFactoryReset.textContent = 'تأكيد التصفير واستعادة المصنع ⚠️';
        }
      }
    });
  }

  const brandSelector = document.getElementById('brand-selector');
  if (brandSelector) {
    brandSelector.addEventListener('change', () => {
      const selectedId = brandSelector.value;
      const brand = (App.State.brands && App.State.brands[selectedId]) || null;
      if (brand) {
        updateBrandPreviewAndInputs(brand);
      }
    });
  }

  const btnActivateBrand = document.getElementById('btn-activate-brand');
  if (btnActivateBrand) {
    btnActivateBrand.addEventListener('click', async () => {
      const selector = document.getElementById('brand-selector');
      const selectedId = selector ? selector.value : null;
      if (!selectedId) return;

      btnActivateBrand.disabled = true;
      try {
        const res = await window.api.setActiveBrand(selectedId);
        if (res && res.success) {
          App.State.activeBrandId = res.activeBrandId;
          App.State.branding = res.current;
          App.Helpers.applyBranding(res.current);
          updateBrandPreviewAndInputs(res.current);
          App.Helpers.showToast(`تم تفعيل هوية "${res.current.nameAr}" بنجاح!`, 'success');
        } else {
          App.Helpers.showToast(res?.error || 'فشل تفعيل الهوية.', 'error');
        }
      } catch (err) {
        App.Helpers.showToast(`خطأ أثناء تفعيل الهوية: ${err.message}`, 'error');
      } finally {
        btnActivateBrand.disabled = false;
      }
    });
  }

  const brandProfileForm = document.getElementById('brand-profile-edit-form');
  if (brandProfileForm) {
    brandProfileForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const isPackaged = Boolean(App.State.isPackaged);
      const selector = document.getElementById('brand-selector');
      const selectedId = (!isPackaged && selector && selector.value) ? selector.value : App.State.activeBrandId;
      if (!selectedId) return;

      const profile = {
        nameAr: document.getElementById('brand-edit-name-ar')?.value?.trim(),
        nameEn: document.getElementById('brand-edit-name-en')?.value?.trim(),
        companyAr: document.getElementById('brand-edit-company-ar')?.value?.trim(),
        crNumber: document.getElementById('brand-edit-cr')?.value?.trim(),
        vatNumber: document.getElementById('brand-edit-vat')?.value?.trim(),
        phone: document.getElementById('brand-edit-phone')?.value?.trim(),
        address: document.getElementById('brand-edit-address')?.value?.trim(),
        postalCode: document.getElementById('brand-edit-postal')?.value?.trim()
      };

      const btnSave = document.getElementById('btn-save-brand-profile');
      if (btnSave) btnSave.disabled = true;

      try {
        const res = await window.api.updateBrandProfile({ brandId: selectedId, profile });
        if (res && res.success) {
          App.State.brands = res.brands;
          if (res.activeBrandId === selectedId) {
            App.State.branding = res.current;
            App.Helpers.applyBranding(res.current);
          }
          const updatedBrand = (res.brands && res.brands[selectedId]) || res.current;
          updateBrandPreviewAndInputs(updatedBrand);
          App.Helpers.showToast('تم حفظ بيانات المنشأة بنجاح!', 'success');
        } else {
          App.Helpers.showToast(res?.error || 'فشل حفظ بيانات المنشأة.', 'error');
        }
      } catch (err) {
        App.Helpers.showToast(`خطأ في حفظ البيانات: ${err.message}`, 'error');
      } finally {
        if (btnSave) btnSave.disabled = false;
      }
    });
  }

  };

  App.Helpers.loadAdminData = loadAdminData;
  App.Helpers.loadBusinessDayAdminSettings = loadBusinessDayAdminSettings;
  App.Helpers.loadBrandAdminSettings = loadBrandAdminSettings;

})(window.DashboardApp);

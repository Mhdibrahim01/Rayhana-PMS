(function(App) {
  'use strict';

  // =========================================================================
  // VIEW 4: GUESTS DIRECTORY (SERVER-SIDE PAGINATION) + EXCEL IMPORT / EXPORT
  // =========================================================================
  let guestsCurrentPage = 1;
  const guestsPageLimit = 50;
  let guestsTotalPages = 1;
  let guestsTotalCount = 0;
  let guestSearchDebounceTimer = null;
  let currentGuestBanFilter = 'all';
  let guestHistoryModal = null;

  async function loadGuestsData(page = guestsCurrentPage) {
    try {
      guestsCurrentPage = Math.max(1, page);
      const query = (App.DOM.searchGuests ? App.DOM.searchGuests.value : '').trim();

      const res = await window.api.getGuestsPaginated({
        page: guestsCurrentPage,
        limit: guestsPageLimit,
        search: query,
        banFilter: currentGuestBanFilter
      });

      if (res && res.success) {
        App.State.guestsCache = res.data || [];
        const pag = res.pagination || {};
        guestsTotalCount = res.totalCount !== undefined ? res.totalCount : (pag.totalCount || 0);
        guestsTotalPages = res.totalPages !== undefined ? res.totalPages : (pag.totalPages || 1);
        guestsCurrentPage = res.page !== undefined ? res.page : (pag.page || 1);

        renderGuestsTable();
        updateGuestsPaginationUI();
      }
    } catch (err) {
      console.error('Error loading guests:', err);
      App.Helpers.showToast('خطأ أثناء تحميل بيانات النزلاء.', 'error');
    }
  }

  function renderGuestsTable() {
    if (App.DOM.guestsCountBadge) App.DOM.guestsCountBadge.textContent = guestsTotalCount.toLocaleString();

    if (!App.State.guestsCache || App.State.guestsCache.length === 0) {
      App.DOM.guestsTableBody.innerHTML = '';
      if (App.DOM.guestsEmpty) App.DOM.guestsEmpty.style.display = 'block';
      return;
    }

    if (App.DOM.guestsEmpty) App.DOM.guestsEmpty.style.display = 'none';

    const activeRole = localStorage.getItem('currentUserRole') || (App.State.currentUser ? App.State.currentUser.role : null);
    const isAdmin = activeRole === 'Admin';

    document.querySelectorAll('#view-guests .admin-only').forEach(el => {
      el.style.display = isAdmin ? '' : 'none';
    });

    App.DOM.guestsTableBody.innerHTML = App.State.guestsCache.map(g => {
      const totalStays = parseInt(g.total_stays, 10) || 0;
      const totalSpent = parseFloat(g.total_spent) || 0;
      const isBanned = Number(g.is_banned) === 1;

      return `
        <tr>
          <td style="font-family: monospace; font-weight: 700; color: var(--primary);">#${g.id}</td>
          <td style="font-weight: 800; color: #1e293b; font-size: 0.9rem;">
            ${App.Helpers.escapeHtml(g.name)}
          </td>
          <td style="color: var(--text-secondary); font-weight: 600;">${App.Helpers.escapeHtml(g.nationality || 'سعودي')}</td>
          <td style="font-family: monospace; color: var(--text-secondary);">${App.Helpers.escapeHtml(g.phone || '-')}</td>
          <td style="color: var(--text-secondary);">${App.Helpers.escapeHtml(g.id_number || '-')}</td>
          <td>
            <button type="button" class="badge guest-stays-trigger" data-action="guest-reservation-history" data-id="${g.id}" title="عرض سجل إقامات النزيل" aria-label="عرض ${totalStays} ${totalStays === 1 ? 'إقامة' : 'إقامات'} للنزيل ${App.Helpers.escapeHtml(g.name)}">
              ${totalStays} ${totalStays === 1 ? 'إقامة' : 'إقامات'}
            </button>
          </td>
          <td style="font-weight: 800; color: var(--primary);">${totalSpent.toLocaleString()} ر.س</td>
          <td style="font-size: 0.8rem; color: var(--text-muted);">${App.Helpers.escapeHtml(String(g.created_at || '').split(' ')[0])}</td>
          <!-- The ban-status column travels with the ban action: a receptionist who can now
               ban a guest must be able to see whether that guest is currently banned.
               Previously both were wrapped in the same isAdmin check. -->
          <td>
            <span class="badge-unified ${isBanned ? 'badge-guest-banned' : 'badge-guest-active'}">
              ${isBanned ? 'محظور' : 'نشط'}
            </span>
          </td>
          <td style="text-align: center; white-space: nowrap;">
            <div class="btn-row-group overview-row-actions guest-actions-list" role="group" aria-label="إجراءات النزيل" style="justify-content: center;">
              <button type="button" class="btn-row icon-ghost guest-row-action" data-action="edit-guest" data-id="${g.id}" title="تعديل بيانات النزيل" aria-label="تعديل بيانات النزيل">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
              </button>
              <button type="button" class="btn-row ${isBanned ? 'guest-row-action-unban' : 'checkout-danger guest-row-action-ban'}" data-action="toggle-ban-guest" data-id="${g.id}" data-name="${App.Helpers.escapeHtml(g.name)}" data-banned="${isBanned ? '1' : '0'}" title="${isBanned ? 'إلغاء حظر النزيل' : 'حظر هذا النزيل'}" aria-label="${isBanned ? 'إلغاء حظر النزيل' : 'حظر هذا النزيل'}">
                ${isBanned ? `
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><path d="m9 12 2 2 4-4"></path></svg>
                ` : `
                  <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg>
                `}
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  function updateGuestsPaginationUI() {
    if (App.DOM.guestsCurrentPageEl) App.DOM.guestsCurrentPageEl.textContent = guestsCurrentPage;
    if (App.DOM.guestsTotalPagesEl) App.DOM.guestsTotalPagesEl.textContent = Math.max(1, guestsTotalPages);
    if (App.DOM.guestsTotalCountEl) App.DOM.guestsTotalCountEl.textContent = guestsTotalCount.toLocaleString();

    if (App.DOM.guestsPageRangeEl) {
      if (guestsTotalCount === 0) {
        App.DOM.guestsPageRangeEl.textContent = '0 - 0';
      } else {
        const start = (guestsCurrentPage - 1) * guestsPageLimit + 1;
        const end = Math.min(guestsCurrentPage * guestsPageLimit, guestsTotalCount);
        App.DOM.guestsPageRangeEl.textContent = `${start} - ${end}`;
      }
    }

    if (App.DOM.btnGuestsPrevPage) {
      App.DOM.btnGuestsPrevPage.disabled = guestsCurrentPage <= 1;
    }
    if (App.DOM.btnGuestsNextPage) {
      App.DOM.btnGuestsNextPage.disabled = guestsCurrentPage >= guestsTotalPages;
    }
  }

  function openEditGuestModal(guestId) {
    const targetId = parseInt(guestId, 10);
    if (!targetId || isNaN(targetId)) return;

    const guest = (App.State.guestsCache || []).find(g => g.id === targetId);
    if (!guest) {
      App.Helpers.showToast('بيانات النزيل غير متوفرة في الصفحة الحالية.', 'error');
      return;
    }

    if (App.DOM.editGuestId) App.DOM.editGuestId.value = guest.id;
    if (App.DOM.editGuestName) App.DOM.editGuestName.value = guest.name || '';
    if (App.DOM.editGuestNationality) App.DOM.editGuestNationality.value = guest.nationality || 'سعودي';
    if (App.DOM.editGuestPhone) App.DOM.editGuestPhone.value = guest.phone || '';
    if (App.DOM.editGuestIdNumber) App.DOM.editGuestIdNumber.value = guest.id_number || '';

    if (App.DOM.editGuestModal) App.DOM.editGuestModal.style.display = 'flex';
    if (App.DOM.editGuestName) App.DOM.editGuestName.focus();
  }

  function ensureGuestHistoryModal() {
    if (guestHistoryModal) return guestHistoryModal;
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop modal-layout-backdrop guest-history-backdrop';
    modal.style.display = 'none';
    modal.setAttribute('role', 'presentation');
    modal.innerHTML = `
      <section class="modal-layout guest-history-dialog" role="dialog" aria-modal="true" aria-labelledby="guest-history-title" dir="rtl">
        <header class="modal-layout__header guest-history-header">
          <div>
            <h2 id="guest-history-title">سجل إقامات النزيل</h2>
            <p class="guest-history-subtitle"></p>
          </div>
          <button type="button" class="modal-layout__close" data-guest-history-close aria-label="إغلاق سجل الإقامات">&times;</button>
        </header>
        <div class="guest-history-content" aria-live="polite"></div>
      </section>`;
    document.body.appendChild(modal);
    const close = () => { modal.style.display = 'none'; };
    modal.addEventListener('click', event => {
      if (event.target === modal || event.target.closest('[data-guest-history-close]')) close();
      const invoiceButton = event.target.closest('[data-action="guest-history-invoice"]');
      if (!invoiceButton) return;
      const reservationId = Number(invoiceButton.dataset.id);
      close();
      if (reservationId && window.openInvoiceModal) window.openInvoiceModal(reservationId);
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && modal.style.display === 'flex') close();
    });
    guestHistoryModal = {
      element: modal,
      title: modal.querySelector('#guest-history-title'),
      subtitle: modal.querySelector('.guest-history-subtitle'),
      content: modal.querySelector('.guest-history-content'),
      closeButton: modal.querySelector('[data-guest-history-close]')
    };
    return guestHistoryModal;
  }

  async function openGuestReservationHistory(guestId) {
    const guest = (App.State.guestsCache || []).find(item => Number(item.id) === Number(guestId));
    if (!guest) return;
    const modal = ensureGuestHistoryModal();
    modal.title.textContent = `سجل إقامات ${guest.name || 'النزيل'}`;
    modal.subtitle.textContent = [guest.phone, guest.id_number].filter(Boolean).join(' · ');
    modal.content.innerHTML = '<div class="guest-history-state">جارٍ تحميل سجل الإقامات...</div>';
    modal.element.style.display = 'flex';
    modal.closeButton.focus();

    try {
      const result = await window.api.getGuestReservationHistory(Number(guestId));
      if (!result?.success) throw new Error(result?.error || 'تعذر تحميل سجل الإقامات.');
      const reservations = Array.isArray(result.data) ? result.data : [];
      if (!reservations.length) {
        modal.content.innerHTML = '<div class="guest-history-state">لا توجد حجوزات مسجلة لهذا النزيل.</div>';
        return;
      }

      const escape = App.Helpers.escapeHtml;
      const number = value => Number(value || 0).toLocaleString('ar-SA-u-nu-latn');
      const rows = reservations.map(reservation => {
        const stayPeriod = `${escape(reservation.check_in_date || '-')} → ${escape(reservation.check_out_date || 'مفتوح')}`;
        const actualArrival = Number(reservation.is_early_checkin) === 1 && reservation.actual_check_in_at
          ? `<small class="guest-history-actual-arrival">الوصول الفعلي: ${escape(App.Helpers.formatArabicDateTime(reservation.actual_check_in_at))}</small>`
          : '';
        const statusClass = reservation.status === 'مؤكد' ? 'is-active' : (reservation.status === 'مكتمل' ? 'is-completed' : 'is-other');
        return `<tr>
          <td class="guest-history-reservation-id">#${escape(reservation.id)}</td>
          <td>${escape(reservation.room_number || '-')}<small>${escape(reservation.room_type || '')}</small></td>
          <td><span dir="ltr">${stayPeriod}</span>${actualArrival}</td>
          <td>${escape(reservation.booking_type || 'عادي')}</td>
          <td><strong>${number(reservation.total_price)} ر.س</strong><small>مدفوع ${number(reservation.paid_amount)} ر.س</small></td>
          <td><span class="guest-history-status ${statusClass}">${escape(reservation.status || 'غير محدد')}</span></td>
          <td><button type="button" class="btn btn-secondary guest-history-invoice" data-action="guest-history-invoice" data-id="${escape(reservation.id)}" title="معاينة سند الاستلام والإقامة"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><path d="M14 2v6h6M8 13h8M8 17h8"></path></svg><span>معاينة السند</span></button></td>
        </tr>`;
      }).join('');
      modal.content.innerHTML = `<div class="guest-history-table-wrap"><table class="guest-history-table"><thead><tr><th>الحجز</th><th>الغرفة</th><th>فترة الإقامة</th><th>نوع الحجز</th><th>الإجمالي والسداد</th><th>الحالة</th><th>السند</th></tr></thead><tbody>${rows}</tbody></table></div>`;
    } catch (error) {
      modal.content.innerHTML = `<div class="guest-history-state is-error">${App.Helpers.escapeHtml(error.message || 'تعذر تحميل سجل الإقامات.')}</div>`;
    }
  }

  App.Helpers.initGuests = function() {
  if (App.DOM.btnGuestsPrevPage) {
    App.DOM.btnGuestsPrevPage.addEventListener('click', () => {
      if (guestsCurrentPage > 1) {
        loadGuestsData(guestsCurrentPage - 1);
      }
    });
  }

  if (App.DOM.btnGuestsNextPage) {
    App.DOM.btnGuestsNextPage.addEventListener('click', () => {
      if (guestsCurrentPage < guestsTotalPages) {
        loadGuestsData(guestsCurrentPage + 1);
      }
    });
  }

  if (App.DOM.searchGuests) {
    App.DOM.searchGuests.addEventListener('input', () => {
      clearTimeout(guestSearchDebounceTimer);
      guestSearchDebounceTimer = setTimeout(() => {
        loadGuestsData(1);
      }, 250);
    });
  }

  // Ban-status filter tabs — re-fetch from page 1 with new filter applied server-side
  App.DOM.guestsBanFilterTabs.forEach(btn => {
    btn.addEventListener('click', () => {
      App.DOM.guestsBanFilterTabs.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentGuestBanFilter = btn.dataset.banFilter;
      loadGuestsData(1);
    });
  });

  // Ban / Unban & Edit Guest Action Delegation
  if (App.DOM.guestsTableBody) {
    App.DOM.guestsTableBody.addEventListener('click', async (e) => {
      const historyBtn = e.target.closest('button[data-action="guest-reservation-history"]');
      if (historyBtn) {
        await openGuestReservationHistory(historyBtn.dataset.id);
        return;
      }

      // Edit Guest (All Staff & Admin)
      const editBtn = e.target.closest('button[data-action="edit-guest"]');
      if (editBtn) {
        const guestId = parseInt(editBtn.dataset.id, 10);
        openEditGuestModal(guestId);
        return;
      }

      const btn = e.target.closest('button[data-action="toggle-ban-guest"]');
      if (!btn) return;

      const guestId = parseInt(btn.dataset.id, 10);
      const guestName = btn.dataset.name || 'النزيل';
      const isCurrentlyBanned = btn.dataset.banned === '1';

      // No role check here. Banning is available to any signed-in user and the main
      // process (ipc/guests.js) requires only a session. This renderer guard used to
      // reject non-Admins with "هذا الإجراء مخصص لمدير النظام فقط", which blocked the
      // click before it ever reached the IPC layer.
      if (!App.State.currentUser) {
        App.Helpers.showToast('يرجى تسجيل الدخول أولاً.', 'error');
        return;
      }

      if (isCurrentlyBanned) {
        // Unban confirmation
        const confirmed = await App.Helpers.showConfirmDialog({
          title: 'إلغاء حظر النزيل',
          message: `هل أنت متأكد من إلغاء الحظر عن النزيل "${guestName}"؟\nسيتمكن النزيل من الحجز مجدداً دون قيود أو تنبيهات.`,
          confirmText: 'نعم، إلغاء الحظر',
          cancelText: 'تراجع',
          isDanger: false
        });

        if (!confirmed) return;

        try {
          const res = await window.api.setGuestBanStatus({ guestId, isBanned: 0, reason: '' });
          if (res && res.success) {
            App.Helpers.showToast(`تم إلغاء الحظر عن النزيل "${guestName}" بنجاح!`, 'success');
            await loadGuestsData();
          } else {
            App.Helpers.showToast(res?.error || 'فشل إلغاء الحظر.', 'error');
          }
        } catch (err) {
          App.Helpers.showToast(`خطأ: ${err.message}`, 'error');
        }
      } else {
        // Ban prompt for reason
        const reason = await App.Helpers.showPromptDialog({
          title: 'حظر النزيل (إدراج في القائمة السوداء)',
          message: `يرجى إدخال سبب حظر النزيل "${guestName}":`,
          placeholder: 'مثال: إتلاف أثاث الغرفة / سلوك غير لائق / تخلف عن السداد...',
          confirmText: 'تأكيد الحظر',
          cancelText: 'إلغاء'
        });

        if (reason === null) return; // User cancelled

        try {
          const res = await window.api.setGuestBanStatus({ guestId, isBanned: 1, reason });
          if (res && res.success) {
            App.Helpers.showToast(`تم إدراج النزيل "${guestName}" في قائمة الحظر بنجاح!`, 'success');
            await loadGuestsData();
          } else {
            App.Helpers.showToast(res?.error || 'فشل حظر النزيل.', 'error');
          }
        } catch (err) {
          App.Helpers.showToast(`خطأ: ${err.message}`, 'error');
        }
      }
    });
  }

  // =========================================================================
  // EDIT GUEST MODAL
  // =========================================================================
  function closeEditGuestModal() {
    if (App.DOM.editGuestModal) App.DOM.editGuestModal.style.display = 'none';
    if (App.DOM.editGuestForm) App.DOM.editGuestForm.reset();
  }

  if (App.DOM.btnCloseEditGuest) App.DOM.btnCloseEditGuest.addEventListener('click', closeEditGuestModal);
  if (App.DOM.btnCancelEditGuest) App.DOM.btnCancelEditGuest.addEventListener('click', closeEditGuestModal);
  if (App.DOM.editGuestModal) {
    App.DOM.editGuestModal.addEventListener('click', (e) => {
      if (e.target === App.DOM.editGuestModal) closeEditGuestModal();
    });
  }

  if (App.DOM.editGuestForm) {
    App.DOM.editGuestForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const guestId = parseInt(App.DOM.editGuestId.value, 10);
      const name = App.DOM.editGuestName.value.trim();
      const nationality = (App.DOM.editGuestNationality ? App.DOM.editGuestNationality.value : '').trim() || 'سعودي';
      const phone = App.DOM.editGuestPhone.value.trim();
      const id_number = App.DOM.editGuestIdNumber.value.trim();

      if (!name) {
        App.Helpers.showToast('يرجى إدخال اسم النزيل.', 'warning');
        return;
      }

      try {
        if (App.DOM.btnSaveEditGuest) {
          App.DOM.btnSaveEditGuest.disabled = true;
          App.DOM.btnSaveEditGuest.textContent = 'جاري الحفظ...';
        }

        const res = await window.api.updateGuest({ guestId, name, phone, id_number, nationality });
        if (res && res.success) {
          App.Helpers.showToast('تم تحديث بيانات النزيل بنجاح! ✓', 'success');
          closeEditGuestModal();
          await loadGuestsData(guestsCurrentPage);
        } else {
          App.Helpers.showToast(res?.error || 'فشل تحديث بيانات النزيل.', 'error');
        }
      } catch (err) {
        App.Helpers.showToast(`خطأ: ${err.message}`, 'error');
      } finally {
        if (App.DOM.btnSaveEditGuest) {
          App.DOM.btnSaveEditGuest.disabled = false;
          App.DOM.btnSaveEditGuest.textContent = 'حفظ التعديلات ✓';
        }
      }
    });
  }

  // Export Guests to Excel (fetches full list from database)
  App.DOM.btnExportGuestsExcel.addEventListener('click', async () => {
    if (typeof XLSX === 'undefined') {
      App.Helpers.showToast('مكتبة SheetJS غير متوفرة.', 'error');
      return;
    }

    try {
      App.Helpers.showToast('جاري تحضير ملف Excel لكافة النزلاء...', 'info');
      const allRes = await window.api.getAllGuests();
      if (!allRes?.success || !Array.isArray(allRes.data)) {
        throw new Error(allRes?.error || 'تعذر تحميل قائمة النزلاء كاملة للتصدير.');
      }
      const allGuestsList = allRes.data;

      if (!allGuestsList || allGuestsList.length === 0) {
        App.Helpers.showToast('لا توجد بيانات نزلاء لتصديرها.', 'info');
        return;
      }

      const exportRows = allGuestsList.map(g => ({
        'معرف النزيل': g.id,
        'اسم النزيل': g.name,
        'الجنسية': g.nationality || 'سعودي',
        'رقم الجوال': g.phone || '',
        'رقم الهوية / الجواز': g.id_number || '',
        'عدد الإقامات المكتملة': parseInt(g.total_stays, 10) || 0,
        'المدفوع للإقامات المكتملة': parseFloat(g.total_spent) || 0,
        'تاريخ التسجيل': g.created_at
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportRows);

      ws['!cols'] = [
        { wch: 12 }, { wch: 28 }, { wch: 16 }, { wch: 18 }, { wch: 20 },
        { wch: 14 }, { wch: 18 }, { wch: 20 }
      ];

      XLSX.utils.book_append_sheet(wb, ws, 'قائمة النزلاء');
      const filename = `hotel_guests_${App.Helpers.getLocalDateString()}.xlsx`;
      XLSX.writeFile(wb, filename);

      App.Helpers.showToast(`تم تصدير ${exportRows.length} نزيل إلى "${filename}" بنجاح!`, 'success');
    } catch (err) {
      console.error('Export error:', err);
      App.Helpers.showToast(`فشل تصدير Excel: ${err.message}`, 'error');
    }
  });

  // Import Guests from CSV / Excel (with dual UTF-8 & Windows-1256 Arabic encoding support + smart column detector)
  if (App.DOM.inputImportGuestsExcel) {
    App.DOM.inputImportGuestsExcel.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async function (evt) {
        try {
          const rawBuffer = evt.target.result;
          const uint8Array = new Uint8Array(rawBuffer);

          let wb;
          // Check magic numbers for binary Excel (XLSX = PK / 0x50 0x4B, XLS = 0xD0 0xCF)
          const isZip = uint8Array.length > 2 && uint8Array[0] === 0x50 && uint8Array[1] === 0x4b;
          const isCfb = uint8Array.length > 2 && uint8Array[0] === 0xd0 && uint8Array[1] === 0xcf;

          if (isZip || isCfb) {
            wb = XLSX.read(uint8Array, { type: 'array' });
          } else {
            // Plain text CSV: decode with UTF-8 or fallback to Windows-1256 (standard Arabic Windows Excel encoding)
            let decodedText = '';
            try {
              const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
              decodedText = utf8Decoder.decode(uint8Array);
              if (decodedText.includes('\uFFFD')) {
                throw new Error('Mojibake detected');
              }
            } catch (utfErr) {
              try {
                const win1256Decoder = new TextDecoder('windows-1256');
                decodedText = win1256Decoder.decode(uint8Array);
              } catch (winErr) {
                decodedText = new TextDecoder('utf-8').decode(uint8Array);
              }
            }
            wb = XLSX.read(decodedText, { type: 'string' });
          }

          const sheetName = wb.SheetNames[0];
          const sheet = wb.Sheets[sheetName];
          if (!sheet) {
            App.Helpers.showToast('الملف المرفوع لا يحتوي على أي صفحات بيانات.', 'error');
            return;
          }

          const cleanVal = (v) => String(v !== undefined && v !== null ? v : '').trim();

          // 1. Try reading as Object rows with flexible key lookup
          const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
          let guestsData = [];

          if (rawRows && rawRows.length > 0) {
            guestsData = rawRows.map(row => {
              let name = '', phone = '', id_number = '';
              const cleanEntries = Object.entries(row).map(([k, v]) => [cleanVal(k).toLowerCase(), cleanVal(v)]);

              // Header mapping
              for (const [k, v] of cleanEntries) {
                if (!v) continue;
                if (!name && /^(الاسم|اسم النزيل|اسم العميل|الاسم الكامل|النزيل|العميل|name|guest_name|customer_name|fullname|full_name)$/i.test(k)) {
                  name = v;
                } else if (!phone && /^(الجوال|رقم الجوال|الهاتف|رقم الهاتف|الموبايل|رقم الموبايل|phone|mobile|tel|telephone|phone_number|mobile_number)$/i.test(k)) {
                  phone = v;
                } else if (!id_number && /^(الهوية|رقم الهوية|الهوية الوطنية|السجل المدني|الإقامة|رقم الإقامة|بطاقة الأحوال|الجواز|رقم الجواز|جواز السفر|رقم جواز السفر|passport|passport_number|id|id_number|national_id|iqama)$/i.test(k)) {
                  id_number = v;
                }
              }

              // Smart content-pattern heuristic fallback
              if (!name || !phone || !id_number) {
                for (const [, v] of cleanEntries) {
                  if (!v) continue;
                  const digits = v.replace(/\D/g, '');
                  if (!id_number && /^[12]\d{9}$/.test(digits)) {
                    id_number = digits;
                  } else if (!id_number && /^[A-Za-z0-9\-]{6,15}$/.test(v.trim()) && !/^(الاسم|الجوال|الهوية|name|phone|id)$/i.test(v)) {
                    id_number = v.trim();
                  } else if (!phone && ((digits.startsWith('05') && digits.length === 10) || (digits.startsWith('5') && (digits.length === 8 || digits.length === 9)) || (digits.startsWith('9665') && digits.length === 12))) {
                    phone = digits;
                  } else if (!name && v.length >= 2 && !/^\d+$/.test(v) && !/^(الاسم|الجوال|الهوية|name|phone|id)$/i.test(v)) {
                    name = v;
                  }
                }
              }

              // Normalize phone (prepend 0 if starting with 5)
              let normPhone = phone.replace(/\D/g, '');
              if (normPhone.startsWith('9665') && normPhone.length === 12) {
                normPhone = '0' + normPhone.substring(3);
              } else if (normPhone.startsWith('5') && (normPhone.length === 8 || normPhone.length === 9)) {
                normPhone = '0' + normPhone;
              }

              return {
                name,
                phone: normPhone,
                id_number: id_number.replace(/[^A-Za-z0-9\-]/g, '').trim(),
                guest_name: name,
                phone_number: normPhone
              };
            }).filter(g => g.name);
          }

          // 2. Fallback to 2D Array by column index if header-based parsing returned nothing
          if (guestsData.length === 0) {
            const rawArrays = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
            for (const arr of rawArrays) {
              if (!Array.isArray(arr) || arr.length === 0) continue;
              const c0 = cleanVal(arr[0]);
              const c1 = cleanVal(arr[1]);
              const c2 = cleanVal(arr[2]);
              // Skip header line if detected
              if (/^(الاسم|name|اسم النزيل)$/i.test(c0) || /^(الجوال|phone|رقم الجوال)$/i.test(c1)) continue;
              if (c0 && c0.length >= 2 && !/^\d+$/.test(c0)) {
                let p = c1.replace(/\D/g, '');
                if (p.startsWith('5') && (p.length === 8 || p.length === 9)) p = '0' + p;
                guestsData.push({
                  name: c0,
                  phone: p,
                  id_number: c2.replace(/[^A-Za-z0-9\-]/g, '').trim(),
                  guest_name: c0,
                  phone_number: p
                });
              }
            }
          }

          if (guestsData.length === 0) {
            App.Helpers.showToast('لم يتم العثور على بيانات نزلاء صالحة في الملف المرفوع.', 'error');
            return;
          }

          // إرسال المصفوفة عبر IPC إلى الباك إند
          const res = await window.api.importGuests(guestsData);

          if (res.success) {
            const count = res.importedCount ?? res.data?.inserted ?? 0;
            const updated = res.updatedCount ?? res.data?.updated ?? 0;
            const total = res.totalCount ?? guestsData.length;
            const updatedGuests = res.updatedGuests || [];

            // 1. تحديث جدول النزلاء في الشاشة فوراً حتى تكون البيانات جاهزة خلف النافذة
            await loadGuestsData();

            // 2. إشعار Toast علوي سريع
            App.Helpers.showToast(`تم استيراد ${count} عميل بنجاح!`, 'success');

            // 3. فتح نافذة التقرير العصرية المنبثقة (بدون alert النظام القديم)
            openImportResultModal({
              importedCount: count,
              updatedCount: updated,
              totalCount: total,
              updatedGuests: updatedGuests
            });
          } else {
            App.Helpers.showToast(res.message || res.error || 'فشل استيراد بيانات النزلاء.', 'error');
          }
        } catch (err) {
          console.error('Import error:', err);
          App.Helpers.showToast(`خطأ في قراءة ملف البيانات: ${err.message}`, 'error');
        } finally {
          App.DOM.inputImportGuestsExcel.value = '';
        }
      };
      reader.readAsArrayBuffer(file);
    });
  }

  // Import Result Modal Handlers

  function openImportResultModal({ importedCount, updatedCount, totalCount, updatedGuests }) {
    if (!App.DOM.importResultModal) return;

    const insertedEl = document.getElementById('import-modal-inserted');
    const updatedEl = document.getElementById('import-modal-updated');
    const totalEl = document.getElementById('import-modal-total');
    const totalSystemEl = document.getElementById('import-modal-total-system-guests');

    if (insertedEl) insertedEl.textContent = importedCount;
    if (updatedEl) updatedEl.textContent = updatedCount;
    if (totalEl) totalEl.textContent = totalCount;
    if (totalSystemEl) totalSystemEl.textContent = App.State.guestsCache.length;

    const dedupNotice = document.getElementById('import-modal-dedup-notice');
    const updatedInline = document.getElementById('import-modal-updated-inline');
    const updatedSection = document.getElementById('import-modal-updated-section');
    const mergedListCount = document.getElementById('import-modal-merged-list-count');
    const updatedTbody = document.getElementById('import-modal-updated-table-body');

    if (updatedCount > 0) {
      if (dedupNotice) dedupNotice.style.display = 'block';
      if (updatedInline) updatedInline.textContent = updatedCount;
      if (updatedSection) updatedSection.style.display = 'block';
      if (mergedListCount) mergedListCount.textContent = (updatedGuests && updatedGuests.length > 0) ? updatedGuests.length : updatedCount;

      if (updatedTbody) {
        if (updatedGuests && updatedGuests.length > 0) {
          updatedTbody.innerHTML = updatedGuests.map(g => `
            <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.1);">
              <td style="padding: 8px 12px; font-weight: 700; color: #ffffff;">${App.Helpers.escapeHtml(g.name || '-')}</td>
              <td style="padding: 8px 12px; font-family: monospace; color: var(--text-secondary);">${App.Helpers.escapeHtml(g.phone || '-')}</td>
              <td style="padding: 8px 12px; font-family: monospace; color: var(--text-secondary);">${App.Helpers.escapeHtml(g.id_number || '-')}</td>
              <td style="padding: 8px 12px; color: #f59e0b; font-weight: 600;">${App.Helpers.escapeHtml(g.matchReason || 'تطابق بيانات')}</td>
            </tr>
          `).join('');
        } else {
          updatedTbody.innerHTML = `
            <tr>
              <td colspan="4" style="padding: 12px; text-align: center; color: var(--text-secondary);">
                تم دمج السجلات المكررة مع النزلاء المسجلين مسبقاً لمنع التكرار.
              </td>
            </tr>
          `;
        }
      }
    } else {
      if (dedupNotice) dedupNotice.style.display = 'none';
      if (updatedSection) updatedSection.style.display = 'none';
    }

    App.DOM.importResultModal.style.display = 'flex';
  }

  function closeImportResultModal() {
    if (App.DOM.importResultModal) {
      App.DOM.importResultModal.style.display = 'none';
    }
  }

  if (App.DOM.btnCloseImportResultModal) {
    App.DOM.btnCloseImportResultModal.addEventListener('click', closeImportResultModal);
  }

  if (App.DOM.btnConfirmImportResult) {
    App.DOM.btnConfirmImportResult.addEventListener('click', () => {
      closeImportResultModal();
      const tableCard = document.querySelector('#view-guests .card');
      if (tableCard) tableCard.scrollIntoView({ behavior: 'smooth' });
    });
  }

  if (App.DOM.btnToggleUpdatedGuestsList && App.DOM.importModalUpdatedContainer) {
    App.DOM.btnToggleUpdatedGuestsList.addEventListener('click', () => {
      const isVisible = App.DOM.importModalUpdatedContainer.style.display !== 'none';
      App.DOM.importModalUpdatedContainer.style.display = isVisible ? 'none' : 'block';
      if (App.DOM.importModalToggleArrow) {
        App.DOM.importModalToggleArrow.textContent = isVisible ? 'إظهار التفاصيل ▼' : 'إخفاء التفاصيل ▲';
      }
    });
  }

  };

  App.Helpers.loadGuestsData = loadGuestsData;
  App.Helpers.openEditGuestModal = openEditGuestModal;
  

})(window.DashboardApp);

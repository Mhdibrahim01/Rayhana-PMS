(function registerFrontDeskHotkeys() {
  'use strict';

  if (window.__rayhanaFrontDeskHotkeysRegistered) return;
  window.__rayhanaFrontDeskHotkeysRegistered = true;

  const formBaselines = new WeakMap();
  const observedOpenModals = new Set();
  let helpPopover;

  const searchByView = [
    ['view-rooms', '#search-rooms'],
    ['view-reservations', '#search-all-reservations'],
    ['view-overview', '#today-checkouts-search'],
    ['view-guests', '#search-guests'],
    ['view-logs', '#search-logs']
  ];

  function isVisible(element) {
    if (!element || element.hidden || element.getAttribute('aria-hidden') === 'true') return false;
    const style = window.getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0;
  }

  function visibleModals() {
    return [...document.querySelectorAll('.modal-backdrop, .reservation-preview-backdrop, .command-palette-backdrop, .attention-inbox-backdrop')]
      .filter(isVisible)
      .map((element, index) => ({
        element,
        index,
        zIndex: Number.parseInt(window.getComputedStyle(element).zIndex, 10) || 0
      }))
      .sort((a, b) => a.zIndex - b.zIndex || a.index - b.index)
      .map(item => item.element);
  }

  function modalControls(modal) {
    return [...modal.querySelectorAll('input:not([type="hidden"]), textarea, select, [contenteditable="true"]')];
  }

  function controlSnapshot(modal) {
    return modalControls(modal).map((control, index) => ({
      key: control.id || control.name || `${control.tagName}:${index}`,
      value: control.isContentEditable ? control.textContent : control.value,
      checked: 'checked' in control ? control.checked : undefined
    }));
  }

  function captureModalBaseline(modal) {
    if (!isVisible(modal)) return;
    formBaselines.set(modal, controlSnapshot(modal));
  }

  function modalHasUnsavedChanges(modal) {
    if (modal.classList.contains('command-palette-backdrop') || modal.classList.contains('attention-inbox-backdrop') || modal.id === 'command-palette-modal' || modal.id === 'attention-inbox-modal') {
      return false;
    }
    const baseline = formBaselines.get(modal);
    if (!baseline) return false;
    const current = controlSnapshot(modal);
    if (current.length !== baseline.length) return true;
    return current.some((item, index) => item.key !== baseline[index].key
      || item.value !== baseline[index].value
      || item.checked !== baseline[index].checked);
  }

  function modalIsBusy(modal) {
    if (modal.matches('[aria-busy="true"], [data-saving="true"], [data-printing="true"], [data-processing="true"]')) return true;
    if (modal.querySelector('[aria-busy="true"], [data-saving="true"], [data-printing="true"], [data-processing="true"], .is-saving, .is-printing, .is-processing')) return true;
    return [...modal.querySelectorAll('button')].some(button => /جار[ٍي] الحفظ|جار[ٍي] الطباعة|جار[ٍي] المعالجة|يتم الحفظ|يتم الطباعة|جاري الإرسال/i.test(button.textContent || ''));
  }

  function closeControlFor(modal) {
    const preferred = modal.querySelector([
      '[data-preview-close]', '[data-modal-close]', '[data-command-palette-close]', 'button.modal-layout__close',
      'button[aria-label="إغلاق"]', 'button[title="إغلاق"]', 'button[id^="btn-close"]',
      'button[data-action="close"]', '#btn-close-attention-inbox', '#btn-footer-close-attention'
    ].join(','));
    if (preferred && !preferred.disabled) return preferred;

    return [...modal.querySelectorAll('button')].find(button => {
      if (button.disabled) return false;
      const text = (button.textContent || '').replace(/[×✕]/g, '').trim();
      return /^(إغلاق|اغلاق|إلغاء|الغاء|رجوع|close|Cancel)$/i.test(text);
    }) || null;
  }

  function isEditingSurface(target) {
    return Boolean(target?.isContentEditable || target?.closest?.('input, textarea, select, [contenteditable], [role="textbox"]'));
  }

  function getCurrentSearch() {
    for (const [viewId, selector] of searchByView) {
      const view = document.getElementById(viewId);
      const input = view?.querySelector(selector);
      if (isVisible(view) && isVisible(input) && !input.disabled) return input;
    }
    return null;
  }

  function bookingOpener() {
    const role = window.DashboardApp?.State?.currentUser?.role || window.localStorage.getItem('currentUserRole');
    return ['btn-open-new-reservation-modal', 'btn-res-new-booking']
      .map(id => document.getElementById(id))
      .find(button => button && !button.disabled && button.getAttribute('aria-disabled') !== 'true' && !button.hidden
        && window.getComputedStyle(button).display !== 'none'
        && ((!button.classList.contains('admin-only') && button.dataset.roleRequired !== 'Admin') || role === 'Admin'));
  }

  function isNativePickerOpen(event) {
    const target = event.target;
    if (target?.closest?.('#command-palette-modal, #attention-inbox-modal, .command-palette-dialog, .attention-inbox-dialog')) {
      return false;
    }
    if (target?.closest?.('select, input[type="date"], input[type="time"], input[type="datetime-local"], [role="combobox"], [aria-haspopup="listbox"]')) return true;
    const openCalendar = document.querySelector('.flatpickr-calendar.open');
    if (openCalendar && isVisible(openCalendar)) return true;
    const openDropdown = document.querySelector('[data-state="open"][data-dropdown]');
    if (openDropdown && isVisible(openDropdown)) return true;
    const openListbox = document.querySelector('[role="listbox"]:not(#command-palette-results):not([hidden])');
    if (openListbox && isVisible(openListbox)) return true;
    return false;
  }

  function buildHelpPopover() {
    if (helpPopover) return helpPopover;
    helpPopover = document.createElement('aside');
    helpPopover.className = 'front-desk-hotkeys-help';
    helpPopover.hidden = true;
    helpPopover.setAttribute('role', 'dialog');
    helpPopover.setAttribute('aria-label', 'اختصارات لوحة المفاتيح');
    helpPopover.setAttribute('dir', 'rtl');
    helpPopover.innerHTML = `
      <div class="front-desk-hotkeys-help-heading"><strong>اختصارات لوحة المفاتيح</strong><button type="button" aria-label="إغلاق" data-hotkeys-help-close>&times;</button></div>
      <div class="front-desk-hotkeys-help-row"><span>حجز / تسكين جديد</span><kbd>F2</kbd></div>
      <div class="front-desk-hotkeys-help-row"><span>شريط الأوامر والبحث الذكي</span><span><kbd>Ctrl</kbd> + <kbd>K</kbd></span></div>
      <div class="front-desk-hotkeys-help-row"><span>البحث في الصفحة الحالية</span><kbd>/</kbd></div>
      <div class="front-desk-hotkeys-help-row"><span>إغلاق النافذة الحالية</span><kbd>Esc</kbd></div>`;
    document.body.appendChild(helpPopover);
    helpPopover.addEventListener('click', event => {
      if (event.target.closest('[data-hotkeys-help-close]')) helpPopover.hidden = true;
    });
    // Focus the close button so keyboard users can dismiss with Escape.
    const closeBtn = helpPopover.querySelector('[data-hotkeys-help-close]');
    if (closeBtn) closeBtn.addEventListener('click', () => { helpPopover.hidden = true; closeBtn.focus(); });
    return helpPopover;
  }

  function stopShortcut(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  function handleEscape(event) {
    if (helpPopover && !helpPopover.hidden) {
      stopShortcut(event);
      helpPopover.hidden = true;
      return;
    }
    if (isNativePickerOpen(event)) {
      // Allow the browser's picker to consume Escape while preventing older
      // document-level modal listeners from closing an underlying dialog too.
      event.stopImmediatePropagation();
      return;
    }

    const modal = visibleModals().at(-1);
    if (!modal) return;
    if (modalIsBusy(modal)) {
      event.stopImmediatePropagation();
      return;
    }
    const closeButton = closeControlFor(modal);
    if (!closeButton) {
      event.stopImmediatePropagation();
      return;
    }

    if (modalHasUnsavedChanges(modal)) {
      stopShortcut(event);
      if (typeof window.showConfirmDialog === 'function') {
        window.showConfirmDialog({
          title: 'تجاهل التعديلات',
          message: 'هل أنت متأكد من إغلاق النافذة وتجاهل التغييرات غير المحفوظة؟',
          confirmText: 'نعم، إغلاق وتجاهل',
          cancelText: 'البقاء في النافذة',
          isDanger: true
        }).then(confirmed => {
          if (confirmed) closeButton.click();
        });
        return;
      }
      if (!window.confirm('تجاهل التغييرات؟')) {
        return;
      }
    }

    stopShortcut(event);
    closeButton.click();
  }

  function handleKeydown(event) {
    if (event.repeat || event.isComposing) return;

    if (event.code === 'Escape' || event.key === 'Escape' || event.keyCode === 27) {
      handleEscape(event);
      return;
    }

    if (event.code === 'F2') {
      if (visibleModals().length || (helpPopover && !helpPopover.hidden)) return;
      const opener = bookingOpener();
      if (!opener) return;
      stopShortcut(event);
      opener.click();
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.code === 'KeyK') {
      stopShortcut(event);
      if (typeof window.openCommandPalette === 'function') {
        window.openCommandPalette();
      }
      return;
    }

    if (event.code === 'Slash' && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) {
      if (isEditingSurface(event.target)) return;
      const search = getCurrentSearch();
      if (!search) return;
      stopShortcut(event);
      search.focus();
      search.select();
      return;
    }

    if (event.code === 'Slash' && event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey && !isEditingSurface(event.target)) {
      stopShortcut(event);
      const help = buildHelpPopover();
      help.hidden = !help.hidden;
    }
  }

  function observeModalOpenings() {
    const syncOpenModals = () => {
      const currentlyOpen = new Set(visibleModals());
      currentlyOpen.forEach(modal => {
        if (!observedOpenModals.has(modal)) window.setTimeout(() => captureModalBaseline(modal), 80);
      });
      observedOpenModals.clear();
      currentlyOpen.forEach(modal => observedOpenModals.add(modal));
    };
    new MutationObserver(syncOpenModals).observe(document.body, {
      attributes: true,
      attributeFilter: ['class', 'hidden', 'style'],
      childList: true,
      subtree: true
    });
    syncOpenModals();
  }

  function initHotkeys() {
    if (window.__rayhanaFrontDeskHotkeysInitialized) return;
    window.__rayhanaFrontDeskHotkeysInitialized = true;
    document.addEventListener('keydown', handleKeydown, true);
    observeModalOpenings();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initHotkeys, { once: true });
  else initHotkeys();
})();

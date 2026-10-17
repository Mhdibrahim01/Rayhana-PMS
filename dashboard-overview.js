(function(App) {
  'use strict';

  // =========================================================================
  // ANALYTICS CARDS (live monthly collections and room status)
  // =========================================================================
  function renderAnalyticsCharts(monthlyData, stats) {
    const revenueBars = document.getElementById('monthly-revenue-bars');
    const currentRevenue = document.getElementById('monthly-revenue-current');
    const roomMeters = document.getElementById('room-status-meters');
    const roomCount = document.getElementById('room-status-total');
    const readiness = document.getElementById('room-status-readiness');
    const formatMoney = value => (Number(value) || 0).toLocaleString('en-US');
    const today = String(App.State.businessDate || App.Helpers.getLocalDateString());
    const [currentYear, currentMonth] = today.slice(0, 7).split('-').map(Number);
    const monthNames = App.Helpers.ARABIC_MONTHS || ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
    const revenueByMonth = new Map((monthlyData || []).map(row => [String(row.month || '').slice(0, 7), Number(row.collected) || 0]));
    const lastSixMonths = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(currentYear, currentMonth - 1 - (5 - index), 1);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      return { key: monthKey, name: monthNames[date.getMonth()], amount: revenueByMonth.get(monthKey) || 0 };
    });
    const maxRevenue = Math.max(0, ...lastSixMonths.map(item => item.amount));

    if (revenueBars) {
      revenueBars.innerHTML = lastSixMonths.map((item, index) => {
        const current = item.key === `${String(currentYear).padStart(4, '0')}-${String(currentMonth).padStart(2, '0')}`;
        const height = maxRevenue > 0 ? Math.round((item.amount / maxRevenue) * 100) : 0;
        return `<div class="monthly-revenue-bar${current ? ' is-current' : ''}" tabindex="0" role="img" aria-label="${item.name}: ${formatMoney(item.amount)} ر.س">
          <span class="monthly-revenue-value" style="bottom:${Math.round((height / 100) * 190) + 28}px">${formatMoney(item.amount)} ر.س</span>
          <div class="monthly-revenue-track"><div class="monthly-revenue-fill" style="height:${height}%"></div></div>
          <span class="monthly-revenue-month">${item.name}</span>
        </div>`;
      }).join('');
    }
    if (currentRevenue) {
      const currentKey = `${String(currentYear).padStart(4, '0')}-${String(currentMonth).padStart(2, '0')}`;
      currentRevenue.textContent = `${formatMoney(revenueByMonth.get(currentKey) || 0)} ر.س (الشهر الحالي)`;
    }

    if (roomMeters) {
      const total = Math.max(0, Number(stats?.totalRooms) || 0);
      const statuses = [
        { label: 'متاحة للاستقبال', count: Math.max(0, Number(stats?.availableRooms) || 0), key: 'available' },
        { label: 'مشغولة بنزلاء', count: Math.max(0, Number(stats?.occupiedRooms) || 0), key: 'occupied' },
        { label: 'قيد التنظيف والتعقيم', count: Math.max(0, Number(stats?.cleaningRooms) || 0), key: 'cleaning' }
      ];
      const reserved = Math.max(0, Number(stats?.reservedRooms) || 0);
      if (reserved > 0) statuses.push({ label: 'محجوزة', count: reserved, key: 'reserved' });
      roomMeters.innerHTML = total > 0 ? statuses.map(item => {
        const percentage = Math.min(100, Math.round((item.count / total) * 100));
        return `<div class="room-status-meter room-status-meter-${item.key}">
          <div class="room-status-meter-label"><span><i aria-hidden="true"></i>${item.label}</span><bdi>${formatMoney(item.count)} ${item.count === 1 ? 'غرفة' : 'غرف'}</bdi></div>
          <div class="room-status-meter-track" role="progressbar" aria-label="${item.label}" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${item.count}"><span style="width:${percentage}%"></span></div>
        </div>`;
      }).join('') : '<p class="room-status-empty">لا توجد بيانات غرف لعرضها.</p>';
      if (roomCount) roomCount.textContent = `${formatMoney(total)} غرفة`;
      if (readiness) {
        const readyCount = Math.min(total, statuses.find(item => item.key === 'available').count + statuses.find(item => item.key === 'occupied').count);
        readiness.textContent = `${total ? Math.round((readyCount / total) * 100) : 0}% جاهز`;
      }
    }

    // These cards now render as HTML; clear any prior Chart.js instances safely.
    ['monthlyRevenueChart', 'roomStatusChart'].forEach(key => {
      if (App.State[key] && typeof App.State[key].destroy === 'function') App.State[key].destroy();
      App.State[key] = null;
    });
  }

  // A transparent weekly demand baseline keeps this estimate useful before the
  // application has enough booking-pickup history for a learned forecast. Confirmed
  // reservations always take precedence over the baseline.
  const WEEKDAY_DEMAND_BASELINE = [45, 36, 55, 64, 82, 91, 73];
  const ARABIC_WEEKDAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  let occupancyForecastChart = null;

  function buildOccupancyForecast(reservations, totalCapacity) {
    const capacity = Math.max(0, Number(totalCapacity) || 0);
    if (capacity === 0) return [];

    const today = String(App.State.businessDate || App.Helpers.getLocalDateString());
    const [year, month, day] = today.split('-').map(Number);
    const startDate = new Date(year, month - 1, day);
    const confirmedReservations = (reservations || []).filter(reservation => reservation.status === 'مؤكد');

    return Array.from({ length: 7 }, (_, dayOffset) => {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + dayOffset);
      const isoDate = App.Helpers.getLocalDateString(date);
      const bookedRoomIds = new Set();

      confirmedReservations.forEach(reservation => {
        const checkInDate = String(reservation.check_in_date || '').slice(0, 10);
        const checkOutDate = String(reservation.check_out_date || '').slice(0, 10);
        const openEndedStay = !checkOutDate || checkOutDate === 'مفتوح';
        const overlaps = checkInDate && checkInDate <= isoDate && (openEndedStay || checkOutDate > isoDate);
        if (overlaps && reservation.room_id !== null && reservation.room_id !== undefined) {
          bookedRoomIds.add(String(reservation.room_id));
        }
      });

      const weekdayIndex = date.getDay();
      const baselineRate = WEEKDAY_DEMAND_BASELINE[weekdayIndex];
      const bookedRooms = Math.min(capacity, bookedRoomIds.size);
      const projectedRooms = Math.min(capacity, Math.max(bookedRooms, Math.round(capacity * baselineRate / 100)));
      const occupancyRate = Math.round(projectedRooms / capacity * 100);
      const displayDate = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
      const demandLevel = occupancyRate >= 85
        ? 'ذروة قصوى 🔥'
        : occupancyRate >= 75
          ? 'طلب مرتفع ⚡'
          : 'طلب اعتيادي 🟢';

      return {
        date: isoDate,
        displayDate,
        dayName: ARABIC_WEEKDAYS[weekdayIndex],
        bookedRooms,
        occupiedRooms: projectedRooms,
        availableRooms: Math.max(0, capacity - projectedRooms),
        totalCapacity: capacity,
        occupancyRate,
        isHighDemand: occupancyRate >= 80,
        demandLevel
      };
    });
  }

  function updateForecastTooltip(tooltipContext, forecast) {
    const tooltipElement = document.getElementById('occupancy-forecast-tooltip');
    if (!tooltipElement) return;

    const { chart, tooltip } = tooltipContext;
    if (!tooltip || tooltip.opacity === 0 || !tooltip.dataPoints?.length) {
      tooltipElement.hidden = true;
      return;
    }

    const day = forecast[tooltip.dataPoints[0].dataIndex];
    if (!day) {
      tooltipElement.hidden = true;
      return;
    }

    const safeDayName = App.Helpers.escapeHtml(day.dayName);
    const safeDemand = App.Helpers.escapeHtml(day.demandLevel);
    tooltipElement.innerHTML = `
      <strong class="forecast-tooltip-heading">${safeDayName} · ${day.displayDate}</strong>
      <div class="forecast-tooltip-rate">${day.occupancyRate}% إشغال متوقع</div>
      <div>الحجوزات المؤكدة: ${day.bookedRooms} من ${day.totalCapacity} غرفة</div>
      <div>الإشغال المتوقع: ${day.occupiedRooms} من ${day.totalCapacity} غرفة</div>
      <div>الغرف المتاحة المتوقعة: ${day.availableRooms}</div>
      <span class="forecast-tooltip-tier ${day.isHighDemand ? 'is-high' : ''}">${safeDemand}</span>
    `;
    tooltipElement.hidden = false;

    const chartArea = chart.chartArea;
    const tooltipLeft = Math.min(chartArea.right - tooltipElement.offsetWidth, Math.max(chartArea.left, tooltip.caretX + 12));
    const tooltipTop = Math.max(4, tooltip.caretY - tooltipElement.offsetHeight - 12);
    tooltipElement.style.left = `${tooltipLeft}px`;
    tooltipElement.style.top = `${tooltipTop}px`;
  }

  function renderOccupancyForecast(reservations, rooms) {
    const chartCanvas = document.getElementById('occupancy-forecast-chart');
    const chartWrap = chartCanvas?.parentElement;
    const emptyState = document.getElementById('occupancy-forecast-empty');
    const daysContainer = document.getElementById('occupancy-forecast-days');
    if (!chartCanvas || !chartWrap || !daysContainer) return;

    const capacity = Array.isArray(rooms) ? rooms.length : 0;
    const forecast = buildOccupancyForecast(reservations, capacity);
    if (emptyState) emptyState.hidden = forecast.length > 0;
    chartWrap.hidden = forecast.length === 0;
    daysContainer.hidden = forecast.length === 0;

    if (!forecast.length) {
      daysContainer.replaceChildren();
      if (occupancyForecastChart) {
        occupancyForecastChart.destroy();
        occupancyForecastChart = null;
      }
      return;
    }

    const peak = forecast.reduce((highest, item) => item.occupancyRate > highest.occupancyRate ? item : highest, forecast[0]);
    const averageRate = Math.round(forecast.reduce((sum, item) => sum + item.occupancyRate, 0) / forecast.length);
    const highDemandDays = forecast.filter(item => item.isHighDemand);
    const peakElement = document.getElementById('forecast-peak-day');
    const averageElement = document.getElementById('forecast-average-rate');
    const highDaysElement = document.getElementById('forecast-high-demand-days');
    const alertBanner = document.getElementById('occupancy-forecast-alert');
    const alertCopy = document.getElementById('occupancy-forecast-alert-copy');

    if (peakElement) peakElement.textContent = `${peak.dayName} ${peak.occupancyRate}%`;
    if (averageElement) averageElement.textContent = `${averageRate}%`;
    if (highDaysElement) highDaysElement.textContent = String(highDemandDays.length);
    if (alertBanner) alertBanner.hidden = highDemandDays.length === 0;
    if (alertCopy && highDemandDays.length) {
      alertCopy.textContent = `تُظهر التوقعات طلباً مرتفعاً في ${highDemandDays.map(item => `${item.dayName} (${item.displayDate})`).join('، ')}. هذه تقديرات تخطيطية وليست حجوزات مؤكدة.`;
    }

    daysContainer.innerHTML = forecast.map(item => `
      <article class="occupancy-forecast-day ${item.isHighDemand ? 'is-high-demand' : ''}">
        <div class="forecast-day-heading"><strong>${item.dayName}</strong><time datetime="${item.date}">${item.displayDate}</time></div>
        <b class="forecast-day-rate">${item.occupancyRate}%</b>
        <span class="forecast-day-rooms">${item.occupiedRooms} / ${item.totalCapacity} غرفة</span>
        <span class="forecast-day-status ${item.isHighDemand ? 'is-high' : ''}">${item.isHighDemand ? 'ذروة طلب' : 'طلب هادئ'}</span>
      </article>
    `).join('');

    if (typeof Chart === 'undefined') return;
    if (occupancyForecastChart) occupancyForecastChart.destroy();

    occupancyForecastChart = new Chart(chartCanvas, {
      type: 'bar',
      data: {
        labels: forecast.map((item, index) => `${index === 0 ? 'اليوم' : item.dayName} (${item.displayDate})`),
        datasets: [
          {
            type: 'bar',
            label: 'الغرف المشغولة والمتوقعة',
            data: forecast.map(item => item.occupiedRooms),
            yAxisID: 'rooms',
            backgroundColor: 'rgba(166, 124, 82, 0.25)',
            hoverBackgroundColor: 'rgba(166, 124, 82, 0.42)',
            borderColor: 'rgba(166, 124, 82, 0.48)',
            borderWidth: 1,
            borderRadius: 7,
            maxBarThickness: 28,
            order: 2
          },
          {
            type: 'line',
            label: 'نسبة الإشغال المتوقعة',
            data: forecast.map(item => item.occupancyRate),
            yAxisID: 'occupancy',
            borderColor: '#1a432a',
            borderWidth: 2.5,
            pointRadius: 4,
            pointHoverRadius: 6,
            pointBackgroundColor: forecast.map(item => item.isHighDemand ? '#a67c52' : '#1a432a'),
            pointBorderColor: '#ffffff',
            pointBorderWidth: 2,
            tension: 0.38,
            fill: true,
            backgroundColor: context => {
              const { chart } = context;
              const { ctx, chartArea } = chart;
              if (!chartArea) return 'rgba(26, 67, 42, 0.12)';
              const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
              gradient.addColorStop(0, 'rgba(26, 67, 42, 0.30)');
              gradient.addColorStop(1, 'rgba(26, 67, 42, 0.015)');
              return gradient;
            },
            order: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        layout: { padding: { top: 12, right: 8, left: 4, bottom: 0 } },
        plugins: {
          legend: { display: false },
          tooltip: {
            enabled: false,
            external: context => updateForecastTooltip(context, forecast)
          }
        },
        scales: {
          occupancy: {
            type: 'linear',
            position: 'left',
            min: 0,
            max: 100,
            ticks: {
              stepSize: 25,
              color: '#8391a2',
              font: { family: 'Cairo, Segoe UI, Tahoma', size: 10 },
              callback: value => `${value}%`
            },
            grid: { color: '#f1f5f9', drawBorder: false }
          },
          rooms: {
            type: 'linear',
            position: 'right',
            min: 0,
            max: capacity,
            display: false,
            grid: { display: false }
          },
          x: {
            reverse: true,
            ticks: {
              color: '#53667a',
              maxRotation: 0,
              minRotation: 0,
              autoSkip: false,
              font: { family: 'Cairo, Segoe UI, Tahoma', size: 10, weight: '700' }
            },
            grid: { display: false }
          }
        }
      },
      plugins: [{
        id: 'occupancy-demand-threshold',
        afterDatasetsDraw(chart) {
          const yScale = chart.scales.occupancy;
          const chartArea = chart.chartArea;
          if (!yScale || !chartArea) return;
          const y = yScale.getPixelForValue(80);
          const { ctx } = chart;
          ctx.save();
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 1;
          ctx.setLineDash([5, 4]);
          ctx.beginPath();
          ctx.moveTo(chartArea.left, y);
          ctx.lineTo(chartArea.right, y);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = '#dc2626';
          ctx.font = '700 10px Cairo, Segoe UI, Tahoma';
          ctx.textAlign = 'right';
          ctx.direction = 'rtl';
          ctx.fillText('عتبة الذروة (80%)', chartArea.right - 4, y - 6);
          ctx.restore();
        }
      }]
    });
  }

  function renderExecutiveSummaryKpis(stats, reservations, rooms, shiftSummary) {
    const today = String(App.State.businessDate || App.Helpers.getLocalDateString());
    const confirmedReservations = (reservations || []).filter(reservation => reservation.status === 'مؤكد');
    const checkInsToday = confirmedReservations.filter(reservation => String(reservation.check_in_date || '').slice(0, 10) === today).length;
    const checkoutsToday = confirmedReservations.filter(reservation => String(reservation.check_out_date || '').slice(0, 10) === today);
    const pendingCheckouts = checkoutsToday.length;
    const totalRooms = Math.max(0, Number(stats?.totalRooms) || (Array.isArray(rooms) ? rooms.length : 0));
    const roomStatusCount = (Array.isArray(rooms) ? rooms.filter(room => room.status === 'مشغولة').length : 0);
    const occupiedRooms = Math.min(totalRooms, Math.max(0, Number(stats?.occupiedRooms ?? roomStatusCount) || 0));
    const occupancyRate = totalRooms > 0 ? Math.round(occupiedRooms / totalRooms * 100) : 0;

    const occupancyRateEl = document.getElementById('overview-occupancy-rate');
    const occupancyBadge = document.getElementById('overview-occupancy-badge');
    const occupancyProgress = document.getElementById('overview-occupancy-progress');
    const occupiedCountEl = document.getElementById('overview-occupied-count');
    const checkInsEl = document.getElementById('overview-checkins-count');
    const checkOutsEl = document.getElementById('overview-checkouts-count');
    const pendingCheckoutsEl = document.getElementById('overview-pending-checkouts-count');
    const revenueTotalEl = document.getElementById('overview-shift-revenue-total');
    const revenueBreakdownEl = document.getElementById('overview-shift-revenue-breakdown');

    if (occupancyRateEl) occupancyRateEl.textContent = `${occupancyRate}%`;
    if (occupancyBadge) {
      occupancyBadge.textContent = occupancyRate >= 80
        ? 'إشغال مرتفع 🔥'
        : occupancyRate >= 50
          ? 'إشغال معتدل 🟢'
          : 'إشغال هادئ';
    }
    if (occupancyProgress) occupancyProgress.style.width = `${occupancyRate}%`;
    if (occupiedCountEl) occupiedCountEl.textContent = `${occupiedRooms} من ${totalRooms} غرف مسكونة`;
    if (checkInsEl) checkInsEl.textContent = String(checkInsToday);
    if (checkOutsEl) checkOutsEl.textContent = String(checkoutsToday.length);
    if (pendingCheckoutsEl) pendingCheckoutsEl.textContent = String(pendingCheckouts);

    if (shiftSummary && revenueTotalEl && revenueBreakdownEl) {
      const cash = Number(shiftSummary.cashTotal) || 0;
      const card = Number(shiftSummary.cardTotal) || 0;
      const transfer = Number(shiftSummary.transferTotal) || 0;
      const total = cash + card + transfer;
      revenueTotalEl.textContent = total.toLocaleString('en-US');
      revenueBreakdownEl.textContent = `نقد: ${cash.toLocaleString('en-US')} | شبكة: ${card.toLocaleString('en-US')} | تحويل: ${transfer.toLocaleString('en-US')} ر.س`;
    } else {
      if (revenueTotalEl) revenueTotalEl.textContent = '—';
      if (revenueBreakdownEl) revenueBreakdownEl.textContent = 'بيانات الوردية غير متاحة';
    }
  }

  function initExecutiveSummaryKpiActions() {
    const occupancyKpi = document.getElementById('overview-kpi-occupancy');
    const checkInsKpi = document.getElementById('overview-kpi-checkins');
    const checkOutsKpi = document.getElementById('overview-kpi-checkouts');
    const shiftRevenueKpi = document.getElementById('overview-kpi-shift-revenue');

    occupancyKpi?.addEventListener('click', () => {
      if (typeof window.openRoomsFiltered === 'function') window.openRoomsFiltered('مشغولة');
      else if (typeof window.switchView === 'function') window.switchView('rooms');
    });
    checkInsKpi?.addEventListener('click', () => {
      document.getElementById('btn-open-new-reservation-modal')?.click();
    });
    checkOutsKpi?.addEventListener('click', () => {
      document.getElementById('tab-today-checkouts')?.click();
      document.getElementById('widget-today-checkouts')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    shiftRevenueKpi?.addEventListener('click', () => {
      if (App.State.currentUser?.role === 'Admin' && typeof window.openShiftAuditModal === 'function') {
        window.openShiftAuditModal();
      } else {
        App.Helpers.showToast('تقرير الوردية التفصيلي متاح لمدير النظام فقط.', 'warning');
      }
    });
  }

  async function loadOccupancyForecast(stats) {
    try {
      const [reservationsResult, roomsResult, shiftSummaryResult] = await Promise.all([
        window.api.getAllReservations(),
        window.api.getAllRooms(),
        window.api.getCurrentShiftRevenueSummary().catch(err => {
          console.warn('Could not load current shift summary:', err);
          return null;
        })
      ]);
      if (!reservationsResult?.success || !roomsResult?.success) {
        throw new Error(reservationsResult?.error || roomsResult?.error || 'تعذر تحميل بيانات الإشغال.');
      }
      const reservations = reservationsResult.data || [];
      const rooms = roomsResult.data || [];
      App.State.roomsCache = rooms;
      App.State.reservationsCache = reservations;
      renderOccupancyForecast(reservations, rooms);
      renderExecutiveSummaryKpis(stats, reservations, rooms, shiftSummaryResult?.success ? shiftSummaryResult.data : null);
    } catch (err) {
      console.error('Error loading 7-day occupancy forecast:', err);
    }
  }

  // =========================================================================
  // VIEW 1: OVERVIEW LOGIC
  // =========================================================================
  async function loadOverviewData() {
    try {
      // 1. Load Stats
      let stats = null;
      const statsRes = await window.api.getDashboardStats();
      if (statsRes.success && statsRes.data) {
        stats = statsRes.data;
        if (App.DOM.statAvailableRooms) App.DOM.statAvailableRooms.textContent = stats.availableRooms.toLocaleString();
        if (App.DOM.statOccupiedRooms) App.DOM.statOccupiedRooms.textContent = stats.occupiedRooms.toLocaleString();
        if (App.DOM.statCleaningRooms) App.DOM.statCleaningRooms.textContent = stats.cleaningRooms.toLocaleString();
        if (App.DOM.statTotalReservations) App.DOM.statTotalReservations.textContent = stats.totalReservations.toLocaleString();
      }

      // 2. Load Monthly Revenue for Analytics
      let monthlyData = [];
      const analyticsRes = await window.api.getMonthlyRevenue();
      if (analyticsRes.success) {
        monthlyData = analyticsRes.data || [];
      }

      // Render Charts
      renderAnalyticsCharts(monthlyData, stats);
      await loadOccupancyForecast(stats);

      // 3. Load Available & Future Reserved Rooms into Booking Dropdown
      const currentSelectedVal = App.DOM.roomSelect ? App.DOM.roomSelect.value : '';
      const roomsRes = await window.api.getAvailableRooms();
      if (roomsRes.success) {
        let optionsHtml = `<option value="">-- اختر الغرفة --</option>`;
        (roomsRes.data || []).forEach(room => {
          const isReservedLater = room.status === 'محجوزة';
          optionsHtml += `
            <option value="${room.id}" data-price="${room.price_per_night}" data-monthly-price="${room.monthly_price ?? ''}">
              غرفة رقم ${App.Helpers.escapeHtml(room.room_number)} (${App.Helpers.escapeHtml(room.type)}) - ${room.price_per_night} ريال/يوم · ${room.monthly_price ? `${room.monthly_price} ريال/شهر` : 'السعر الشهري غير محدد'} ${isReservedLater ? '⏳ (محجوزة لفترة لاحقة)' : '✓ (متاحة)'}
            </option>
          `;
        });
        App.DOM.roomSelect.innerHTML = optionsHtml;
        if (currentSelectedVal) {
          App.DOM.roomSelect.value = currentSelectedVal;
        }
      }

      // 4. Load Recent Reservations into Overview Table
      const resRes = await window.api.getReservationsPage({ page: 1, pageSize: 10, status: 'مؤكد' });
      if (resRes && resRes.success) {
        App.State.recentReservationsRows = resRes.data?.rows || [];
        const activeBookingsCount = Number(resRes.data?.total ?? (App.State.reservationsCache?.length || App.State.recentReservationsRows.length));
        const activeBookingsTabCount = document.getElementById('active-bookings-tab-count');
        if (activeBookingsTabCount) activeBookingsTabCount.textContent = String(activeBookingsCount);
        renderOverviewTable();
      }

      // 5. Load Today's Check-outs Widget
      await loadTodayCheckouts();
      if (typeof window.updateAttentionInbox === 'function') {
        window.updateAttentionInbox();
      }
    } catch (err) {
      console.error('Error loading overview data:', err);
      App.Helpers.showToast?.('فشل تحميل بيانات لوحة التحكم — تحقق من الاتصال وقم بالتحديث.', 'error');
    }
  }

  function renderOverviewTable() {
    const recent = (App.State.recentReservationsRows || App.State.reservationsCache || []).filter(r => r.status === 'مؤكد').slice(0, 10);
    const recentCount = App.DOM.overviewRecentTabCount;
    if (recentCount) recentCount.textContent = String(recent.length);
    if (!recent.length) {
      App.DOM.overviewTableBody.innerHTML = '';
      App.DOM.overviewEmpty.style.display = 'block';
      return;
    }
    App.DOM.overviewEmpty.style.display = 'none';
    const e = App.Helpers.escapeHtml;
    const today = String(App.State.businessDate || App.Helpers.getLocalDateString());
    const icons = {
      preview: '<svg viewBox="0 0 24 24"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"></path><circle cx="12" cy="12" r="3"></circle></svg>',
      checkout: '<svg viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>',
      payment: '<svg viewBox="0 0 24 24"><rect x="1" y="4" width="22" height="16" rx="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>',
      extend: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>',
      invoice: '<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><path d="M14 2v6h6M8 13h8M8 17h8"></path></svg>',
      whatsapp: '<svg viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>',
      cancel: '<svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>'
    };
    const titles = { preview: 'معاينة تفاصيل الحجز', checkout: 'تسجيل مغادرة وتسليم الغرفة', payment: 'تسجيل دفعة سداد جديدة', extend: 'تمديد فترة الإقامة', invoice: 'طباعة سند الاستلام والإقامة (فاتورة)', whatsapp: 'مراسلة النزيل عبر واتساب', cancel: 'إلغاء الحجز' };
    App.DOM.overviewTableBody.innerHTML = recent.map(r => {
      const isContract = r.booking_type === 'عقد مفتوح';
      const isEarlyMorningCheckin = Number(r.is_early_checkin) === 1;
      const arrivalDate = isEarlyMorningCheckin ? getActualArrivalCalendarDate(r) : String(r.check_in_date || '-').slice(0, 10);
      const storedTotal = Number(r.total_price || 0);
      const paid = Number((r.ledger_paid_amount ?? r.paid_amount) || 0);
      const rate = Number(r.custom_nightly_price || r.price_per_night || 0);
      const checkIn = String(r.check_in_date || '').slice(0, 10);
      const checkOut = String(r.check_out_date || '').slice(0, 10);
      const isOverdue = r.status === 'مؤكد' && !isContract && checkOut && checkOut < today;
      const elapsedNights = (isContract || isOverdue) && checkIn && checkIn <= today
        ? Math.max(1, Math.floor((Date.parse(today + 'T00:00:00Z') - Date.parse(checkIn + 'T00:00:00Z')) / 86400000))
        : 0;
      const runningCharge = elapsedNights > 0 && rate > 0
        ? Math.max(0, Math.round((elapsedNights * rate - Number(r.discount_amount || 0)) * 100) / 100)
        : 0;
      const total = (isContract || isOverdue) ? Math.max(storedTotal, runningCharge) : storedTotal;
      const balance = total - paid;
      const isCredit = balance < -0.005;
      const remaining = Math.max(0, balance);
      const paymentDisplayStatus = isCredit
        ? 'رصيد دائن'
        : (balance <= 0.005 ? 'مدفوع بالكامل' : (paid > 0.005 ? 'مدفوع جزئياً' : 'غير مدفوع'));
      const canCheckOut = r.check_in_date && today >= r.check_in_date;
      const canCancel = r.check_in_date && today <= r.check_in_date;
      const isLate = !isContract && App.Helpers.isLateCheckout(r);
      const paymentTone = paymentDisplayStatus === 'مدفوع بالكامل' ? 'success' : (paymentDisplayStatus === 'مدفوع جزئياً' ? 'warning' : (isCredit ? 'info' : 'danger'));
      const hasCheckoutDate = r.check_out_date && r.check_out_date !== 'مفتوح' && !isContract;
      const visibleActions = [['preview', false]];
      if (canCheckOut) visibleActions.push(['checkout', true]);
      if (canCancel) visibleActions.push(['cancel', false]);
      if (hasCheckoutDate) visibleActions.push(['extend', false]);
      if (visibleActions.length < 4) visibleActions.push(['invoice', false]);
      if (visibleActions.length < 4 && (remaining > 0 || isContract)) visibleActions.push(['payment', false]);
      if (visibleActions.length < 4 && r.guest_phone) visibleActions.push(['whatsapp', false]);
      const actions = visibleActions.map(([action]) => {
        const extra = action === 'payment' ? ' onclick="event.stopPropagation(); window.openAddPaymentModal && window.openAddPaymentModal(' + Number(r.id) + ');"' : '';
        const handlerAction = action === 'payment' ? 'add-payment' : (action === 'preview' ? 'preview-reservation' : action);
        const title = action === 'cancel' && r.check_in_date === today ? 'إبطال / إلغاء الحجز المباشر' : titles[action];
        const buttonClass = action === 'checkout' ? 'btn-row primary checkout-danger overview-row-checkout' : 'btn-row icon-ghost';
        return '<button type="button" class="' + buttonClass + '" data-action="' + handlerAction + '" data-id="' + Number(r.id) + '" title="' + title + '" aria-label="' + title + '"' + extra + '>' + icons[action] + '</button>';
      }).join('');
      const lateBadge = isLate ? renderDashboardStatusBadge(getCheckoutDelayLabel(r.check_out_date), 'danger') : '<span class="overview-status-dash">—</span>';
      const bookingNumber = formatReservationNumber(r);
      const balanceLine = isCredit
        ? '<small class="overview-credit-line">رصيد دائن للنزيل (مستحق له): ' + Math.abs(balance).toLocaleString() + ' ر.س</small>'
        : '<small class="overview-balance-line ' + (remaining > 0 ? 'due' : 'settled') + '">' + (remaining > 0 ? 'متبقي على النزيل: ' + remaining.toLocaleString() + ' ر.س' : 'لا يوجد رصيد مستحق') + '</small>';
      return '<tr class="' + (isLate ? 'overview-late-booking-row' : '') + '">' +
        '<td class="overview-booking-number-cell" data-label="رقم الحجز"><bdi class="overview-booking-number" dir="ltr">' + e(bookingNumber) + '</bdi></td>' +
        '<td class="overview-booking-guest-cell" data-label="بيانات النزيل"><strong class="overview-booking-guest-name" title="' + e(r.guest_name || '') + '">' + e(r.guest_name || '-') + '</strong><small class="overview-booking-guest-phone" dir="ltr">' + e(r.guest_phone || '—') + '</small></td>' +
        '<td class="overview-booking-room-cell" data-label="رقم الغرفة" style="text-align: center;"><button type="button" class="checkout-room-chip clickable-room-chip" data-action="preview-reservation" data-id="' + e(r.id) + '" title="عرض تفاصيل الغرفة ' + e(r.room_number || '') + '">' + e(r.room_number || '-') + '</button></td>' +
        '<td class="overview-booking-date" data-label="الوصول والمغادرة"><span class="overview-date-line"><small>' + (isEarlyMorningCheckin ? 'فعلي' : 'من') + '</small><bdi>' + e(arrivalDate) + '</bdi></span><span class="overview-date-line"><small>إلى</small>' + (isContract ? '<strong class="overview-open-contract">عقد مفتوح</strong>' : '<bdi>' + e(String(r.check_out_date || '-').slice(0, 10)) + '</bdi>') + '</span></td>' +
        '<td class="overview-booking-financial" data-label="المبلغ والمدفوع"><strong>' + total.toLocaleString() + ' ر.س</strong>' + (isContract ? '<small>' + elapsedNights + (elapsedNights === 1 ? ' ليلة' : ' ليالٍ') + ' × ' + rate.toLocaleString() + ' ر.س</small>' : '') + balanceLine + '</td>' +
        '<td class="overview-booking-method" data-label="طريقة السداد">' + e(r.payment_method || '—') + '</td>' +
        '<td class="overview-booking-status" data-label="حالة السداد"><span class="status-badge ' + paymentTone + '">' + e(paymentDisplayStatus) + '</span><small>مدفوع: ' + paid.toLocaleString() + ' ر.س</small>' + (isLate ? '<span class="overview-late-inline">' + lateBadge + '</span>' : '') + '</td>' +
        '<td class="overview-booking-actions-cell" data-label="إجراءات"><div class="btn-row-group overview-row-actions" role="group" aria-label="إجراءات الحجز">' + actions + '</div></td>' +
        '</tr>';
    }).join('');
  }

  function formatReservationNumber(reservation) {
    const extractYear = value => {
      const match = String(value || '').trim().match(/^(\d{4})[-/]/);
      const year = Number(match?.[1]);
      return year >= 1900 && year <= 2100 ? match[1] : '';
    };
    const year = extractYear(reservation?.created_at) || extractYear(reservation?.check_in_date);
    const sequence = String(reservation?.id ?? '').padStart(5, '0');
    return year ? `RYH-${year}-${sequence}` : `RYH-غير مؤرخ-${sequence}`;
  }

  function getPaymentProgressPercent(total, paid) {
    const safeTotal = Number(total) || 0;
    const safePaid = Number(paid) || 0;
    if (safeTotal <= 0) return safePaid > 0 ? 100 : 0;
    return Math.max(0, Math.min(100, Math.round((safePaid / safeTotal) * 100)));
  }

  function renderDateTimeCell(dateValue, timeValue, fallback = '-', timeLabel = '') {
    const rawDate = String(dateValue || '').trim();
    if (!rawDate) return App.Helpers.escapeHtml(fallback);

    const [datePart, embeddedTime] = rawDate.split(/[T ]/);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return App.Helpers.escapeHtml(rawDate);

    const time = String(timeValue || embeddedTime || '').trim().slice(0, 5);
    return `<div class="table-date">${App.Helpers.escapeHtml(datePart)}</div>${time ? `<div class="table-time">${timeLabel ? `<span class="table-time-label">${App.Helpers.escapeHtml(timeLabel)}:</span>` : ''}<bdi class="table-time-value">${App.Helpers.escapeHtml(time)}</bdi></div>` : ''}`;
  }

  function renderDashboardStatusBadge(label, tone = 'neutral') {
    const toneClassMap = {
      success: 'badge-res-confirmed',
      danger: 'badge-res-cancelled',
      warning: 'badge-pay-partial',
      info: 'badge-fin-credit',
      neutral: 'badge-res-completed'
    };
    const mapped = toneClassMap[tone] || 'badge-res-completed';
    return `<span class="badge-unified status-badge ${tone} ${mapped}">${App.Helpers.escapeHtml(label)}</span>`;
  }

  function initActionHoverTooltips() {
    if (document.documentElement.dataset.actionTooltipsInitialized === 'true') return;
    document.documentElement.dataset.actionTooltipsInitialized = 'true';

    const selector = '#widget-today-checkouts .overview-row-actions [title], #widget-recent-bookings .overview-row-actions [title], #view-reservations .reservation-actions-list [title], #view-guests .guest-actions-list [title]';
    const tooltip = document.createElement('div');
    tooltip.className = 'action-hover-tooltip';
    tooltip.setAttribute('role', 'tooltip');
    tooltip.setAttribute('aria-hidden', 'true');
    document.body.appendChild(tooltip);

    let hoveredButton = null;
    let activeButton = null;
    let dismissedButton = null;
    let pressedButton = null;

    const hideTooltip = () => {
      tooltip.classList.remove('is-visible');
      tooltip.setAttribute('aria-hidden', 'true');
    };

    const updateTooltip = () => {
      const nextButton = hoveredButton;
      activeButton = nextButton;
      if (!activeButton) {
        dismissedButton = null;
        hideTooltip();
        return;
      }

      if (!Object.prototype.hasOwnProperty.call(activeButton.dataset, 'actionTooltipTitle')) {
        activeButton.dataset.actionTooltipTitle = activeButton.getAttribute('title') || '';
      }
      activeButton.removeAttribute('title');
      const label = activeButton.getAttribute('aria-label') || activeButton.dataset.actionTooltipTitle;
      if (!label) {
        hideTooltip();
        return;
      }

      tooltip.textContent = label;
      if (dismissedButton === activeButton) {
        hideTooltip();
        return;
      }
      tooltip.classList.add('is-visible');
      tooltip.setAttribute('aria-hidden', 'false');
      const buttonRect = activeButton.getBoundingClientRect();
      const tooltipRect = tooltip.getBoundingClientRect();
      const halfWidth = tooltipRect.width / 2;
      const centerX = Math.min(Math.max(buttonRect.left + buttonRect.width / 2, halfWidth + 8), window.innerWidth - halfWidth - 8);
      tooltip.style.left = `${centerX}px`;
      if (buttonRect.top > tooltipRect.height + 16) {
        tooltip.dataset.placement = 'top';
        tooltip.style.top = `${buttonRect.top - 8}px`;
      } else {
        tooltip.dataset.placement = 'bottom';
        tooltip.style.top = `${buttonRect.bottom + 8}px`;
      }
    };

    document.addEventListener('pointerover', event => {
      const button = event.target.closest?.(selector);
      if (!button || button === hoveredButton) return;
      hoveredButton = button;
      dismissedButton = null;
      updateTooltip();
    }, true);
    document.addEventListener('pointermove', event => {
      const hit = document.elementFromPoint(event.clientX, event.clientY);
      const button = hit?.closest?.(selector) || null;
      if (button === hoveredButton) return;
      hoveredButton = button;
      dismissedButton = null;
      updateTooltip();
    }, true);
    document.addEventListener('pointerout', event => {
      const button = event.target.closest?.(selector);
      if (!button || button.contains(event.relatedTarget)) return;
      if (hoveredButton === button) hoveredButton = null;
      updateTooltip();
    }, true);
    const dismissTooltipForButton = (event, buttonOverride = null) => {
      const button = buttonOverride || event.target.closest?.(selector);
      if (!button) return;
      dismissedButton = button;
      button.blur?.();
      updateTooltip();
    };
    document.addEventListener('pointerdown', event => {
      pressedButton = event.target.closest?.(selector) || null;
    }, true);
    document.addEventListener('pointerup', event => {
      dismissTooltipForButton(event, pressedButton);
      pressedButton = null;
    }, true);
    document.addEventListener('mouseup', event => dismissTooltipForButton(event, pressedButton), true);
    document.addEventListener('click', dismissTooltipForButton, true);
    window.addEventListener('scroll', () => {
      if (!activeButton) return;
      hoveredButton = null;
      updateTooltip();
    }, true);
    window.addEventListener('resize', () => {
      if (!activeButton) return;
      hoveredButton = null;
      updateTooltip();
    });
  }

  function getCheckoutDelayLabel(checkOutDate) {
    const today = String(App.State.businessDate || App.Helpers.getLocalDateString());
    const dueDate = String(checkOutDate || '').slice(0, 10);
    const diffDays = Math.max(0, Math.floor((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${dueDate}T00:00:00Z`)) / 86400000));
    if (diffDays === 0) return 'متأخر اليوم';
    if (diffDays === 1) return 'متأخر يوم';
    if (diffDays === 2) return 'متأخر يومين';
    if (diffDays <= 10) return `متأخر ${diffDays} أيام`;
    return `متأخر ${diffDays} يوماً`;
  }

  // =========================================================================
  // TODAY'S CHECK-OUTS (مغادرات اليوم) WIDGET LOGIC
  // =========================================================================
  async function loadTodayCheckouts() {
    try {
      const todayStr = String(App.State.businessDate || App.Helpers.getLocalDateString());
      if (App.DOM.todayDateBadge) {
        App.DOM.todayDateBadge.textContent = todayStr;
      }

      const res = await window.api.getTodayCheckouts(todayStr);
      if (res && res.success) {
        const checkouts = res.data || [];
        renderTodayCheckoutsTable(checkouts);
        if (typeof window.syncAttentionTodayCheckouts === 'function') {
          window.syncAttentionTodayCheckouts(checkouts);
        } else if (typeof window.updateAttentionInbox === 'function') {
          window.updateAttentionInbox();
        }
      } else {
        console.warn('Could not load today checkouts:', res?.error);
      }
    } catch (err) {
      console.error('Error in loadTodayCheckouts:', err);
    }
  }

  function renderLateCheckoutAlert(checkouts) {
    const alert = document.getElementById('late-checkout-alert');
    const counter = document.getElementById('late-checkout-count');
    const actions = document.getElementById('late-checkout-actions');
    if (!alert || !actions) return;

    const lateCheckouts = (checkouts || []).filter(row => App.Helpers.isLateCheckout(row));
    alert.hidden = lateCheckouts.length === 0;
    if (counter) counter.textContent = `${lateCheckouts.length} ${lateCheckouts.length === 1 ? 'غرفة متأخرة' : 'غرف متأخرة'}`;
    actions.innerHTML = lateCheckouts.map(row => {
      const id = Number(row.reservation_id ?? row.id);
      return `
        <article class="late-checkout-action-card">
          <div class="late-checkout-action-guest">
            <strong>غرفة ${App.Helpers.escapeHtml(row.room_number || '-')}</strong>
            <span>${App.Helpers.escapeHtml(row.guest_name || 'نزيل')}</span>
            <small dir="ltr">${App.Helpers.escapeHtml(row.guest_phone || 'لا يوجد رقم جوال')}</small>
          </div>
          <div class="late-checkout-action-buttons">
            <button type="button" class="late-checkout-button late-checkout-button-primary" data-action="checkout" data-id="${id}" title="تسوية فورية وتسجيل المغادرة" aria-label="تسوية فورية وتسجيل المغادرة">🚪 خروج فوري</button>
            <button type="button" class="late-checkout-button late-checkout-button-secondary" data-action="extend" data-id="${id}" title="تمديد فترة الإقامة" aria-label="تمديد فترة الإقامة">⏳ تمديد</button>
          </div>
        </article>
      `;
    }).join('');
  }

  function renderTodayCheckoutsTable(checkouts) {
    if (!App.DOM.todayCheckoutsTableBody) return;

    const uniqueReservations = new Map();
    (checkouts || []).forEach(row => {
      const reservationId = row.reservation_id ?? row.id;
      const key = reservationId != null
        ? `reservation:${reservationId}`
        : `room:${row.room_id ?? row.room_number}|guest:${row.guest_id_number ?? row.guest_name ?? ''}|date:${row.check_in_date ?? ''}`;
      if (!uniqueReservations.has(key)) uniqueReservations.set(key, row);
    });

    // A room should appear once in today's operational list. Keep its newest
    // reservation when legacy/imported data contains repeated room entries.
    const latestFirst = [...uniqueReservations.values()].sort((a, b) => {
      const byCreatedAt = String(b.created_at || '').localeCompare(String(a.created_at || ''));
      return byCreatedAt || Number(b.id || 0) - Number(a.id || 0);
    });
    const latestByRoom = new Map();
    latestFirst.forEach(row => {
      const roomKey = row.room_id ?? row.room_number ?? `reservation:${row.reservation_id ?? row.id}`;
      if (!latestByRoom.has(String(roomKey))) latestByRoom.set(String(roomKey), row);
    });
    const latestRoomRows = [...latestByRoom.values()];
    const visibleReservationIds = new Set(latestRoomRows.map(row => String(row.reservation_id ?? row.id)));
    const overdueRows = latestFirst.filter(row =>
      row.status === 'مؤكد' &&
      String(row.check_out_date || '').slice(0, 10) < String(App.State.businessDate || App.Helpers.getLocalDateString()) &&
      !visibleReservationIds.has(String(row.reservation_id ?? row.id))
    );
    checkouts = [...latestRoomRows, ...overdueRows].sort((a, b) => {
      const overdueOrder = Number(App.Helpers.isLateCheckout(b)) - Number(App.Helpers.isLateCheckout(a));
      return overdueOrder || String(a.room_number || '').localeCompare(String(b.room_number || ''), undefined, { numeric: true });
    });
    App.State.todayCheckoutsRows = checkouts;
    renderLateCheckoutAlert(checkouts);

    if (App.DOM.todayCheckoutsCountBadge) {
      const count = checkouts.length;
      App.DOM.todayCheckoutsCountBadge.textContent = `${count} ${count === 1 ? 'مغادرة' : 'مغادرات'}`;
    }
    const todayCheckoutsTabCount = document.getElementById('today-checkouts-tab-count');
    if (todayCheckoutsTabCount) todayCheckoutsTabCount.textContent = String(checkouts.length);
    const filterCounts = {
      all: checkouts.length,
      pending: checkouts.filter(row => row.status === 'مؤكد' && !App.Helpers.isLateCheckout(row)).length,
      overdue: checkouts.filter(row => App.Helpers.isLateCheckout(row)).length,
      completed: checkouts.filter(row => row.status === 'مكتمل').length
    };
    Object.entries(filterCounts).forEach(([filter, count]) => {
      const target = document.getElementById(`today-checkouts-filter-${filter}-count`);
      if (target) target.textContent = String(count);
    });

    const today = String(App.State.businessDate || App.Helpers.getLocalDateString());
    let lateCount = 0;
    let totalOutstanding = 0;
    let completedCount = 0;

    checkouts.forEach(r => {
      if (r.status === 'مكتمل') {
        completedCount++;
      } else {
        if (App.Helpers.isLateCheckout(r)) {
          lateCount++;
        }
        const isContract = r.booking_type === 'عقد مفتوح';
        const storedTotal = Number(r.total_price) || 0;
        const paid = Number(r.ledger_paid_amount ?? r.paid_amount) || 0;
        const rate = Number(r.custom_nightly_price || r.price_per_night || 0);
        const checkIn = String(r.check_in_date || '').slice(0, 10);
        const checkoutDate = String(r.check_out_date || '').slice(0, 10);
        const isOverdue = r.status === 'مؤكد' && !isContract && checkoutDate && checkoutDate < today;
        let total = storedTotal;
        if ((isContract || isOverdue) && checkIn && checkIn <= today && rate > 0) {
          const elapsedNights = Math.max(1, Math.floor((Date.parse(today + 'T00:00:00Z') - Date.parse(checkIn + 'T00:00:00Z')) / 86400000));
          const runningCharge = Math.max(0, Math.round((elapsedNights * rate - Number(r.discount_amount || 0)) * 100) / 100);
          total = Math.max(storedTotal, runningCharge);
        }
        const rawDiff = total - paid;
        if (rawDiff > 0.005) {
          totalOutstanding += rawDiff;
        }
      }
    });

    const lateCountEl = document.getElementById('today-summary-late-count');
    if (lateCountEl) lateCountEl.textContent = lateCount.toLocaleString('en-US');

    const dueAmountEl = document.getElementById('today-summary-due-amount');
    if (dueAmountEl) dueAmountEl.textContent = `${Math.round(totalOutstanding).toLocaleString('en-US')} ر.س`;

    const completedCountEl = document.getElementById('today-summary-completed-count');
    if (completedCountEl) completedCountEl.textContent = completedCount.toLocaleString('en-US');

    const searchTerm = String(App.DOM.todayCheckoutsSearch?.value || '').trim().toLocaleLowerCase();
    const visibleCheckouts = checkouts.filter(row => {
      const overdue = App.Helpers.isReservationOverdue(row);
      const statusMatches = App.State.todayCheckoutsActiveFilter === 'all'
        || (App.State.todayCheckoutsActiveFilter === 'pending' && row.status === 'مؤكد' && !overdue)
        || (App.State.todayCheckoutsActiveFilter === 'overdue' && overdue)
        || (App.State.todayCheckoutsActiveFilter === 'completed' && row.status === 'مكتمل');
      if (!statusMatches) return false;

      if (!searchTerm) return true;
      const searchableText = [row.room_number, row.room_type, row.guest_name, row.guest_phone, row.guest_id_number]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase();
      return searchableText.includes(searchTerm);
    });

    if (visibleCheckouts.length === 0) {
      App.DOM.todayCheckoutsTableBody.innerHTML = '';
      if (App.DOM.todayCheckoutsEmpty) App.DOM.todayCheckoutsEmpty.style.display = 'block';
      if (App.DOM.todayCheckoutsEmpty) {
        const title = App.DOM.todayCheckoutsEmpty.querySelector('h4');
        const description = App.DOM.todayCheckoutsEmpty.querySelector('p');
        const noRowsAtAll = checkouts.length === 0;
        if (title) title.textContent = noRowsAtAll ? 'لا توجد مغادرات مجدولة لهذا اليوم' : 'لا توجد نتائج مطابقة';
        if (description) description.textContent = noRowsAtAll
          ? 'جميع الغرف المشغولة لا تنتهي فترة إقامتها اليوم أو تم إنهاء إجراءات مغادرتها بالفعل.'
          : 'جرّب تغيير حالة المغادرة أو تعديل عبارة البحث.';
      }
      return;
    }

    if (App.DOM.todayCheckoutsEmpty) App.DOM.todayCheckoutsEmpty.style.display = 'none';

    App.DOM.todayCheckoutsTableBody.innerHTML = visibleCheckouts.map(r => {
      const isConfirmed = r.status === 'مؤكد';
      const isCompleted = r.status === 'مكتمل';
      const isLateCheckout = App.Helpers.isLateCheckout(r);
      const isContract = r.booking_type === 'عقد مفتوح';
      const checkoutDate = String(r.check_out_date || '').slice(0, 10);
      const checkOutDisplay = r.check_out_date || (isContract ? 'مفتوح (غير محدد)' : '-');
      const expectedCheckoutTime = App.Helpers.getExpectedCheckoutTime
        ? App.Helpers.getExpectedCheckoutTime(r)
        : (isConfirmed && !isContract && r.check_out_date && r.check_out_date !== 'مفتوح' ? '14:00' : '');
      const departureTimeText = r.checkout_time || expectedCheckoutTime || '';

      const overdueDays = checkoutDate
        ? Math.max(0, Math.floor((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${checkoutDate}T00:00:00Z`)) / 86400000))
        : 0;
      const isOverdue = isConfirmed && !isContract && checkoutDate && checkoutDate < today;
      const isRowLate = isLateCheckout || isOverdue;

      const overdueLabel = overdueDays === 0 ? 'متأخر اليوم'
        : overdueDays === 1 ? 'متأخر يوم'
        : overdueDays === 2 ? 'متأخر يومين'
        : overdueDays <= 10 ? `متأخر ${overdueDays} أيام` : `متأخر ${overdueDays} يوماً`;

      const statusLabel = isLateCheckout ? getCheckoutDelayLabel(checkoutDate) : (isCompleted ? 'تمت المغادرة ✓' : 'حجز مؤكد');
      const statusTone = isLateCheckout ? 'danger' : (isCompleted ? 'success' : 'neutral');
      const delayHours = (isLateCheckout && App.Helpers.getCheckoutDelayHours) ? App.Helpers.getCheckoutDelayHours(r) : 0;
      const checkoutDetail = r.checkout_time
        ? `المغادرة الفعلية: ${checkoutDate} · ${String(r.checkout_time).slice(0, 5)}`
        : (expectedCheckoutTime && checkoutDate ? `المغادرة المتوقعة: ${checkoutDate} · ${expectedCheckoutTime}` : '');

      const storedTotal = Number(r.total_price) || 0;
      const paid = Number(r.ledger_paid_amount ?? r.paid_amount) || 0;
      const rate = Number(r.custom_nightly_price || r.price_per_night || 0);
      const checkIn = String(r.check_in_date || '').slice(0, 10);

      let total = storedTotal;
      let elapsedNights = 0;
      if ((isContract || isOverdue) && checkIn && checkIn <= today && rate > 0) {
        elapsedNights = Math.max(1, Math.floor((Date.parse(today + 'T00:00:00Z') - Date.parse(checkIn + 'T00:00:00Z')) / 86400000));
        const runningCharge = Math.max(0, Math.round((elapsedNights * rate - Number(r.discount_amount || 0)) * 100) / 100);
        total = Math.max(storedTotal, runningCharge);
      }
      const rawDiff = total - paid;
      const balance = Math.max(0, rawDiff);
      const isCredit = rawDiff < -0.005;
      const guestName = String(r.guest_name || '');

      return `
        <tr class="${isRowLate ? 'late-checkout-row' : ''}">
          <td data-label="رقم الغرفة" style="text-align: center;">
            <button type="button" class="checkout-room-chip clickable-room-chip" data-action="preview-reservation" data-id="${App.Helpers.escapeHtml(r.reservation_id ?? r.id)}" title="عرض تفاصيل الغرفة ${App.Helpers.escapeHtml(r.room_number)}">
              ${App.Helpers.escapeHtml(r.room_number)}
            </button>
          </td>
          <td class="res-cell-guest" data-label="بيانات النزيل">
            <div class="res-guest-name" title="${App.Helpers.escapeHtml(guestName)}">${App.Helpers.escapeHtml(guestName)}</div>
            <div class="res-guest-meta">
              ${r.guest_id_number ? `<span>هوية: <bdi dir="ltr">${App.Helpers.escapeHtml(r.guest_id_number)}</bdi></span>` : ''}
              ${r.guest_id_number && r.guest_phone ? `<span class="res-meta-dot">•</span>` : ''}
              ${r.guest_phone ? `<span dir="ltr"><bdi>${App.Helpers.escapeHtml(r.guest_phone)}</bdi></span>` : ''}
            </div>
          </td>
          <td class="res-cell-dates" data-label="الوصول والمغادرة">
            <div class="res-date-line">
              <span class="res-date-label">وصول:</span>
              <span class="res-date-val"><bdi dir="ltr">${App.Helpers.escapeHtml(r.check_in_date || '-')}</bdi></span>
              ${r.booking_time ? `<span class="res-time-val">${App.Helpers.escapeHtml(String(r.booking_time).slice(0, 5))}</span>` : ''}
            </div>
            <div class="res-date-line">
              <span class="res-date-label">مغادرة:</span>
              <span class="res-date-val"><bdi dir="ltr">${App.Helpers.escapeHtml(checkOutDisplay)}</bdi></span>
              ${departureTimeText ? `<span class="res-time-val">${App.Helpers.escapeHtml(String(departureTimeText).slice(0, 5))}</span>` : ''}
            </div>
            ${isLateCheckout && overdueDays > 0 ? `
              <div class="res-late-departure-tag">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                <span>${App.Helpers.escapeHtml(overdueLabel)}</span>
              </div>
            ` : ''}
          </td>
          <td class="res-cell-money" data-label="المبلغ والمدفوع">
            <div class="res-money-total">
              ${(isOverdue || isContract) && total > storedTotal ? `
                ${total.toLocaleString('en-US')} ر.س <small class="res-accrued-tag">(مستحق)</small>
              ` : `
                ${total.toLocaleString('en-US')} ر.س
              `}
            </div>
            <div class="res-money-sub muted">
              ${isCredit ? `
                <span>مدفوع: ${paid.toLocaleString('en-US')}</span> • <span class="res-money-sub credit">دائن: ${Math.abs(rawDiff).toLocaleString('en-US')} ر.س</span>
              ` : (balance > 0 ? `
                <span>مدفوع: ${paid.toLocaleString('en-US')}</span> • <span class="res-money-sub remaining">متبقي: ${balance.toLocaleString('en-US')} ر.س</span>
              ` : `
                <span>مدفوع: ${paid.toLocaleString('en-US')} ر.س</span>
              `)}
            </div>
          </td>
          <td data-label="حالة الحجز">
            <div class="checkouts-status-stack">
              ${renderDashboardStatusBadge(statusLabel, statusTone)}
              ${checkoutDetail ? `
                <small class="checkout-status-detail" title="${App.Helpers.escapeHtml(checkoutDetail)}${delayHours > 0 ? ` (تأخير ${delayHours} ساعة)` : ''}">
                  ${App.Helpers.escapeHtml(checkoutDetail)}
                  ${delayHours > 0 ? `<span class="checkout-delay-hours" style="color: #b91c1c; font-weight: 700; white-space: nowrap;"> (${delayHours} س تأخير)</span>` : ''}
                </small>
              ` : ''}
            </div>
          </td>
          <td data-label="إجراء المغادرة" style="text-align: center;">
            ${isConfirmed ? `
              <div class="overview-row-actions ${isLateCheckout ? 'overview-row-actions-late-checkout' : ''}" role="group" aria-label="إجراءات الحجز">
                <button type="button" class="btn-row icon-ghost checkout-row-action checkout-row-action-preview" data-action="preview-reservation" data-id="${r.id}" title="معاينة تفاصيل الحجز" aria-label="معاينة تفاصيل الحجز">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                </button>
                <button type="button" class="btn-row secondary checkout-row-action checkout-row-action-extend" data-action="extend" data-id="${r.id}" title="تمديد فترة الإقامة" aria-label="تمديد فترة الإقامة">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path></svg>
                </button>
                <button type="button" class="btn-row primary checkout-danger ${isLateCheckout ? 'late-checkout-button late-checkout-button-primary' : 'checkout-row-action checkout-row-action-primary'}" data-action="checkout" data-id="${r.id}" title="${isLateCheckout ? 'تسوية فورية وتسجيل المغادرة' : 'تسجيل مغادرة النزيل وتسليم الغرفة'}" aria-label="${isLateCheckout ? 'تسوية فورية وتسجيل المغادرة' : 'تسجيل مغادرة النزيل وتسليم الغرفة'}">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                </button>
                <button type="button" class="btn-row icon-ghost checkout-row-action" data-action="invoice" data-id="${r.id}" title="معاينة سند الاستلام والإقامة" aria-label="معاينة سند الاستلام والإقامة">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h9l4 4v14H6z"></path><path d="M14 3v5h5M9 13h7M9 17h7"></path></svg>
                </button>
              </div>
            ` : isCompleted ? `
              <div class="overview-row-actions" role="group" aria-label="إجراءات الحجز المكتمل">
                <button type="button" class="btn-row icon-ghost checkout-row-action checkout-row-action-preview" data-action="preview-reservation" data-id="${r.id}" title="معاينة تفاصيل الحجز" aria-label="معاينة تفاصيل الحجز">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                </button>
                <button type="button" class="btn-row icon-ghost checkout-row-action" data-action="invoice" data-id="${r.id}" title="معاينة سند الاستلام والإقامة" aria-label="معاينة سند الاستلام والإقامة">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h9l4 4v14H6z"></path><path d="M14 3v5h5M9 13h7M9 17h7"></path></svg>
                </button>
              </div>
            ` : `<span style="color: var(--text-secondary); font-size: 0.8rem;">-</span>`}
          </td>
        </tr>
      `;
    }).join('');
  }

  function westernPreviewDigits(value) {
    return String(value ?? '').replace(/[\u0660-\u0669\u06f0-\u06f9]/g, digit => {
      const code = digit.charCodeAt(0);
      return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660);
    });
  }

  function roomDetailsDate(value) {
    return westernPreviewDigits(value || '').slice(0, 10);
  }

  function getActualArrivalCalendarDate(reservation) {
    const fallbackDate = roomDetailsDate(reservation.check_in_date) || '-';
    const timestamp = reservation.actual_check_in_at || reservation.created_at;
    if (!timestamp) return fallbackDate;
    const parsed = App.Helpers.parseStoredTimestamp(timestamp);
    if (!parsed || Number.isNaN(parsed.getTime())) return fallbackDate;
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: App.Helpers.getHotelTimezone(),
      year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(parsed);
    const values = Object.fromEntries(parts.filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  }

  function roomDetailsMoney(value) {
    return `${Number(value || 0).toLocaleString('ar-SA-u-nu-latn')} \u0631.\u0633`;
  }

  function roomDetailsField(label, value, detail = '', modifier = '') {
    const safe = App.Helpers.escapeHtml(westernPreviewDigits(value == null || value === '' ? 'غير متوفر' : value));
    const safeDetail = detail ? App.Helpers.escapeHtml(westernPreviewDigits(detail)) : '';
    return `<div class="reservation-preview-field room-details-field ${modifier}"><span>${App.Helpers.escapeHtml(westernPreviewDigits(label))}</span><strong>${safe}</strong>${safeDetail ? `<small>${safeDetail}</small>` : ''}</div>`;
  }

  App.Helpers.openReservationPreview = async function(reservationId) {
    const response = await window.api.getInvoiceData(reservationId);
    if (!response?.success || !response.data) {
      App.Helpers.showToast?.(response?.error || 'تعذر تحميل تفاصيل الحجز.', 'error');
      return;
    }

    let modal = document.getElementById('reservation-preview-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'reservation-preview-modal';
      modal.className = 'reservation-preview-backdrop';
      modal.setAttribute('role', 'presentation');
      modal.innerHTML = '<section class="reservation-preview-dialog modal-layout room-details-refined" role="dialog" aria-modal="true" aria-labelledby="reservation-preview-title" dir="rtl"><div id="reservation-preview-content"></div></section>';
      document.body.appendChild(modal);
      modal.addEventListener('click', event => { if (event.target === modal) modal.style.display = 'none'; });
      modal.addEventListener('click', event => { if (event.target.closest('[data-preview-close]')) modal.style.display = 'none'; });
      document.addEventListener('keydown', event => { if (event.key === 'Escape' && modal.style.display === 'flex') modal.style.display = 'none'; });
    }

    const r = response.data;
    const total = Number(r.total_price) || 0;
    const paid = Number(r.ledger_paid_amount ?? r.paid_amount) || 0;
    const balance = Math.max(0, total - paid);
    const money = value => `${Number(value || 0).toLocaleString('ar-SA-u-nu-latn')} ر.س`;
    const status = App.Helpers.escapeHtml(r.status || 'غير محدد');
    const statusTone = r.status === 'مؤكد' ? 'active' : (r.status === 'مكتمل' ? 'done' : 'other');
    const isOpenContract = r.booking_type === '\u0639\u0642\u062f \u0645\u0641\u062a\u0648\u062d' || !r.check_out_date || r.check_out_date === '\u0645\u0641\u062a\u0648\u062d';
    const dailyRate = Number(r.custom_nightly_price || r.price_per_night) || 0;
    const previewRate = r.booking_type === 'حجز شهري'
      ? (Number(r.monthly_rate_snapshot) || (dailyRate * 30))
      : dailyRate;
    const checkIn = roomDetailsDate(r.check_in_date);
    const isEarlyMorningCheckin = Number(r.is_early_checkin) === 1;
    const displayedCheckIn = isEarlyMorningCheckin ? getActualArrivalCalendarDate(r) : checkIn;
    const checkout = roomDetailsDate(r.check_out_date);
    const today = String(App.State.businessDate || App.Helpers.getLocalDateString());
    const isOverdue = r.status === 'مؤكد' && !isOpenContract && /^\d{4}-\d{2}-\d{2}$/.test(checkout) && checkout < today;
    const elapsedNights = (isOpenContract || isOverdue) && /^\d{4}-\d{2}-\d{2}$/.test(checkIn) && checkIn <= today
      ? Math.max(1, Math.floor((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${checkIn}T00:00:00Z`)) / 86400000))
      : 0;
    const bookedNights = /^\d{4}-\d{2}-\d{2}$/.test(checkIn) && /^\d{4}-\d{2}-\d{2}$/.test(checkout)
      ? Math.max(0, Math.floor((Date.parse(`${checkout}T00:00:00Z`) - Date.parse(`${checkIn}T00:00:00Z`)) / 86400000))
      : 0;
    const overdueNights = isOverdue ? Math.max(0, elapsedNights - bookedNights) : 0;
    const stayNights = (isOpenContract || isOverdue) ? elapsedNights : bookedNights;
    const runningCharge = (r.running_total !== undefined && r.running_total !== null)
      ? Number(r.running_total)
      : Math.max(0, Math.round((elapsedNights * previewRate - Number(r.discount_amount || 0)) * 100) / 100);
    const previewTotal = (isOpenContract || isOverdue) ? Math.max(total, runningCharge) : total;
    const previewBalance = Math.max(0, previewTotal - paid);
    const paidPercent = getPaymentProgressPercent(previewTotal, paid);
    const content = modal.querySelector('#reservation-preview-content');
    content.innerHTML = `
      <header class="reservation-preview-header modal-layout__header room-details-header">
        <div class="reservation-preview-heading room-details-heading">
          <div class="reservation-preview-room-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M3 18V8a2 2 0 0 1 2-2h3a3 3 0 0 1 3 3v2h6a4 4 0 0 1 4 4v3M3 14h18M5 18v2m14-2v2"></path></svg></div>
          <div class="room-details-heading-copy"><div class="room-details-title-line"><h2 id="reservation-preview-title">\u062a\u0641\u0627\u0635\u064a\u0644 \u0627\u0644\u063a\u0631\u0641\u0629 ${App.Helpers.escapeHtml(westernPreviewDigits(r.room_number || '-'))}</h2><span class="badge-unified reservation-preview-status is-${statusTone} ${statusTone === 'active' ? 'badge-res-confirmed' : (statusTone === 'done' ? 'badge-res-completed' : 'badge-res-cancelled')}">${status}</span></div><p>${App.Helpers.escapeHtml(westernPreviewDigits(`\u0631\u0642\u0645 \u0627\u0644\u062d\u062c\u0632 ${formatReservationNumber(r)} \u00b7 ${r.room_type || '\u0646\u0648\u0639 \u0627\u0644\u063a\u0631\u0641\u0629 \u063a\u064a\u0631 \u0645\u062d\u062f\u062f'} \u00b7 ${r.booking_type || '\u062d\u062c\u0632'} \u00b7 ${roomDetailsMoney(previewRate)} / ${r.booking_type === '\u062d\u062c\u0632 \u0634\u0647\u0631\u064a' ? '\u0634\u0647\u0631' : '\u0644\u064a\u0644\u0629'}`))}</p></div>
        </div>
        <button type="button" class="reservation-preview-close modal-layout__close" data-preview-close aria-label="\u0625\u063a\u0644\u0627\u0642">&times;</button>
      </header>
      <div class="reservation-preview-body modal-layout__body room-details-body">
        <section class="reservation-preview-section modal-section-card room-details-card room-details-guest-card">
          <div class="reservation-preview-section-title modal-section-card__header room-details-card-heading"><span class="reservation-preview-title-icon">\u2659</span><strong>\u0628\u064a\u0627\u0646\u0627\u062a \u0627\u0644\u0646\u0632\u064a\u0644</strong></div>
          <div class="room-details-guest-fields">${roomDetailsField('\u0627\u0633\u0645 \u0627\u0644\u0646\u0632\u064a\u0644', r.guest_name, '', 'room-details-name')}${roomDetailsField('\u0631\u0642\u0645 \u0627\u0644\u062c\u0648\u0627\u0644', r.guest_phone)}${roomDetailsField('\u0631\u0642\u0645 \u0627\u0644\u0647\u0648\u064a\u0629 / \u0627\u0644\u0625\u0642\u0627\u0645\u0629', r.guest_id_number)}${roomDetailsField('\u0627\u0644\u062c\u0646\u0633\u064a\u0629', r.guest_nationality || '\u0633\u0639\u0648\u062f\u064a')}</div>
          <div class="room-details-companions-section" style="margin-top: 10px; border-top: 1px dashed #cbd5e1; padding-top: 10px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 7px;">
              <span style="font-size: 0.82rem; font-weight: 800; color: #1e293b; display: flex; align-items: center; gap: 5px;">
                <span>👥</span>
                <span>\u0645\u0631\u0627\u0641\u0642\u0648 \u0627\u0644\u062d\u062c\u0632</span>
                ${(r.companions && r.companions.length > 0) ? `<span style="background: #e0f2fe; color: #0369a1; font-size: 0.72rem; padding: 1px 7px; border-radius: 999px; font-weight: 700;">${r.companions.length}</span>` : ''}
              </span>
              <button type="button" class="btn btn-sm" data-action="manage-companions" data-id="${App.Helpers.escapeHtml(r.id)}" style="font-size: 0.72rem; padding: 3px 9px; color: #0284c7; background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 6px; cursor: pointer; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;" title="\u0625\u062f\u0627\u0631\u0629 \u0645\u0631\u0627\u0641\u0642\u064a\u0646 \u0627\u0644\u062d\u062c\u0632">
                <span>${(r.companions && r.companions.length > 0) ? '\u270f\ufe0f \u0625\u062f\u0627\u0631\u0629' : '+ \u0625\u0636\u0627\u0641\u0629 \u0645\u0631\u0627\u0641\u0642'}</span>
              </button>
            </div>
            ${(r.companions && r.companions.length > 0) ? `
              <div class="room-details-companions-list" style="display: flex; flex-direction: column; gap: 5px; max-height: 135px; overflow-y: auto; padding-left: 2px;">
                ${r.companions.map(c => `
                  <div class="room-details-companion-item" style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 6px 9px; font-size: 0.78rem; display: flex; justify-content: space-between; align-items: center; gap: 6px;">
                    <div style="min-width: 0; flex: 1;">
                      <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                        <strong style="color: #1e293b; font-size: 0.82rem;">${App.Helpers.escapeHtml(westernPreviewDigits(c.name))}</strong>
                        ${c.relationship ? `<span style="color: #475569; background: #e2e8f0; font-size: 0.7rem; padding: 1px 5px; border-radius: 4px; font-weight: 600;">${App.Helpers.escapeHtml(westernPreviewDigits(c.relationship))}</span>` : ''}
                        <span style="color: #0369a1; background: #e0f2fe; font-size: 0.7rem; padding: 1px 5px; border-radius: 4px; font-weight: 600;">${App.Helpers.escapeHtml(westernPreviewDigits(c.nationality || '\u0633\u0639\u0648\u062f\u064a'))}</span>
                      </div>
                      ${(c.id_number || c.phone) ? `
                        <div style="font-size: 0.72rem; color: #64748b; margin-top: 2px; display: flex; gap: 8px; flex-wrap: wrap;">
                          ${c.id_number ? `<span>\u0647\u0648\u064a\u0629: <strong style="color: #475569;">${App.Helpers.escapeHtml(westernPreviewDigits(c.id_number))}</strong></span>` : ''}
                          ${c.phone ? `<span>\u062c\u0648\u0627\u0644: <strong dir="ltr" style="color: #475569;"><bdi>${App.Helpers.escapeHtml(westernPreviewDigits(c.phone))}</bdi></strong></span>` : ''}
                        </div>
                      ` : ''}
                    </div>
                  </div>
                `).join('')}
              </div>
            ` : `
              <div style="font-size: 0.76rem; color: #94a3b8; text-align: center; padding: 8px 6px; background: #f8fafc; border: 1px dashed #e2e8f0; border-radius: 8px;">
                \u0644\u0627 \u064a\u0648\u062c\u062f \u0645\u0631\u0627\u0641\u0642\u0648\u0646 \u0645\u0633\u062c\u0644\u0648\u0646 \u0644\u0647\u0630\u0627 \u0627\u0644\u062d\u062c\u0632
              </div>
            `}
          </div>
          <div class="reservation-preview-contact-actions room-details-contact-actions">${r.guest_phone ? `<a class="reservation-preview-contact" href="tel:${App.Helpers.escapeHtml(westernPreviewDigits(r.guest_phone))}">\u0627\u062a\u0635\u0627\u0644 <span>\u260e</span></a>` : ''}<button type="button" class="reservation-preview-contact reservation-preview-whatsapp" data-action="whatsapp" data-id="${App.Helpers.escapeHtml(r.id)}" title="\u0645\u0631\u0627\u0633\u0644\u0629 \u0627\u0644\u0646\u0632\u064a\u0644 \u0639\u0628\u0631 \u0648\u0627\u062a\u0633\u0627\u0628" aria-label="\u0645\u0631\u0627\u0633\u0644\u0629 \u0627\u0644\u0646\u0632\u064a\u0644 \u0639\u0628\u0631 \u0648\u0627\u062a\u0633\u0627\u0628">\u0645\u0631\u0627\u0633\u0644\u0629 \u0648\u0627\u062a\u0633\u0627\u0628 <span>\u230f</span></button></div>
        </section>
        <section class="reservation-preview-section modal-section-card room-details-card room-details-stay-card">
          <div class="reservation-preview-section-title modal-section-card__header room-details-card-heading"><span class="reservation-preview-title-icon">\u25a6</span><strong>\u062a\u0641\u0627\u0635\u064a\u0644 \u0627\u0644\u0625\u0642\u0627\u0645\u0629</strong></div>
          <div class="room-details-stay-fields">${roomDetailsField('\u0646\u0648\u0639 \u0627\u0644\u062d\u062c\u0632', r.booking_type || '\u062d\u062c\u0632 \u064a\u0648\u0645\u064a')}${roomDetailsField('\u0631\u0642\u0645 \u0627\u0644\u0633\u0646\u062f', formatReservationNumber(r), '', 'room-details-receipt-number')}${roomDetailsField(isEarlyMorningCheckin ? '\u062a\u0627\u0631\u064a\u062e \u0627\u0644\u0648\u0635\u0648\u0644 \u0627\u0644\u0641\u0639\u0644\u064a' : '\u062a\u0627\u0631\u064a\u062e \u0627\u0644\u0648\u0635\u0648\u0644', displayedCheckIn || '\u063a\u064a\u0631 \u0645\u062d\u062f\u062f')}${roomDetailsField('\u062a\u0627\u0631\u064a\u062e \u0627\u0644\u0645\u063a\u0627\u062f\u0631\u0629', isOpenContract ? '\u0639\u0642\u062f \u0645\u0641\u062a\u0648\u062d' : (roomDetailsDate(r.check_out_date) || '\u063a\u064a\u0631 \u0645\u062d\u062f\u062f'))}${roomDetailsField(r.booking_type === '\u062d\u062c\u0632 \u0634\u0647\u0631\u064a' ? '\u0627\u0644\u0633\u0639\u0631 \u0627\u0644\u0634\u0647\u0631\u064a' : '\u0633\u0639\u0631 \u0627\u0644\u0644\u064a\u0644\u0629', roomDetailsMoney(previewRate), Number(r.discount_amount) > 0 ? `\u0627\u0644\u062e\u0635\u0645: ${roomDetailsMoney(r.discount_amount)}` : '')}${roomDetailsField('\u0639\u062f\u062f \u0627\u0644\u0644\u064a\u0627\u0644\u064a', stayNights > 0 ? `${stayNights} ${stayNights === 1 ? '\u0644\u064a\u0644\u0629' : '\u0644\u064a\u0627\u0644\u064d'}${isOverdue && overdueNights > 0 ? ` (\u0645\u062a\u0623\u062e\u0631 ${overdueNights} \u0644\u064a\u0627\u0644\u064d)` : ''}` : '\u063a\u064a\u0631 \u0645\u062a\u0648\u0641\u0631')}</div>
          ${(Number(r.discount_amount) > 0 || isOpenContract || r.discount_reason) ? `<div class="room-details-note"><strong>\u0645\u0644\u0627\u062d\u0638\u0627\u062a \u0648\u062a\u0639\u0644\u064a\u0645\u0627\u062a \u0627\u0644\u0625\u0642\u0627\u0645\u0629:</strong> ${r.discount_reason ? App.Helpers.escapeHtml(westernPreviewDigits(r.discount_reason)) : (isOpenContract ? '\u0639\u0642\u062f \u0645\u0641\u062a\u0648\u062d' : '\u062e\u0635\u0645 \u0645\u0633\u062c\u0644 \u0639\u0644\u0649 \u0627\u0644\u0625\u0642\u0627\u0645\u0629')}</div>` : ''}
        </section>
        <section class="reservation-preview-section modal-section-card room-details-card room-details-financial-card">
          <div class="reservation-preview-section-title modal-section-card__header room-details-card-heading"><span class="reservation-preview-title-icon financial">\u0631.\u0633</span><strong>\u0627\u0644\u0645\u0648\u0642\u0641 \u0627\u0644\u0645\u0627\u0644\u064a</strong></div>
          <span class="badge-unified reservation-preview-paid-badge room-details-financial-status ${previewBalance <= 0 ? 'badge-pay-paid' : (paid > 0 ? 'badge-pay-partial' : 'badge-pay-unpaid')}">${previewBalance <= 0 ? '\u0645\u062f\u0641\u0648\u0639 \u0628\u0627\u0644\u0643\u0627\u0645\u0644 \u2713' : (paid > 0 ? '\u0645\u062f\u0641\u0648\u0639 \u062c\u0632\u0626\u064a\u0627\u064b' : '\u0645\u0637\u0644\u0648\u0628 \u062a\u062d\u0635\u064a\u0644')}</span>
          <div class="room-details-financial-fields">${roomDetailsField('\u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u0625\u0642\u0627\u0645\u0629', roomDetailsMoney(previewTotal), isOverdue && previewTotal > total ? `${stayNights} \u0644\u064a\u0644\u0629 (${overdueNights} \u0644\u064a\u0627\u0644\u064d \u0645\u062a\u0623\u062e\u0631\u0629) = ${roomDetailsMoney(previewTotal)}` : (isOpenContract ? `${elapsedNights} \u0644\u064a\u0644\u0629 \u00d7 ${roomDetailsMoney(previewRate)} = ${roomDetailsMoney(previewTotal)}` : ''))}${roomDetailsField('\u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u0645\u0628\u0627\u0644\u063a \u0627\u0644\u0645\u0633\u062f\u062f\u0629', roomDetailsMoney(paid), r.payment_method || '')}${roomDetailsField('\u0627\u0644\u0645\u0628\u0644\u063a \u0627\u0644\u0645\u062a\u0628\u0642\u064a', roomDetailsMoney(previewBalance))}${roomDetailsField('\u0645\u0628\u0644\u063a \u0627\u0644\u062a\u0623\u0645\u064a\u0646', roomDetailsMoney(r.deposit_ledger_balance ?? r.deposit_amount))}</div>
          <div class="room-details-progress"><div class="reservation-preview-payment-bar"><span style="width:${paidPercent}%"></span></div><span>\u0645\u0633\u062f\u062f ${paidPercent}%</span></div>
        </section>
      </div>
      <footer class="reservation-preview-footer modal-layout__footer room-details-footer"><div class="room-details-footer-actions">${r.status === '\u0645\u0624\u0643\u062f' ? `<button type="button" class="btn btn-primary reservation-preview-action reservation-preview-checkout" data-action="checkout" data-id="${App.Helpers.escapeHtml(r.id)}" title="\u062a\u0633\u0648\u064a\u0629 \u0648\u0645\u063a\u0627\u062f\u0631\u0629"><span>\u21e5</span> \u062a\u0633\u0648\u064a\u0629 \u0648\u0645\u063a\u0627\u062f\u0631\u0629</button><button type="button" class="btn btn-secondary reservation-preview-action reservation-preview-extend" data-action="extend" data-id="${App.Helpers.escapeHtml(r.id)}" title="\u062a\u0645\u062f\u064a\u062f \u0641\u062a\u0631\u0629 \u0627\u0644\u0625\u0642\u0627\u0645\u0629"><span>\u25f7</span> \u062a\u0645\u062f\u064a\u062f \u0627\u0644\u0625\u0642\u0627\u0645\u0629</button>` : ''}${previewBalance > 0 ? `<button type="button" class="btn btn-secondary reservation-preview-action" onclick="event.stopPropagation(); document.getElementById('reservation-preview-modal').style.display='none'; window.openAddPaymentModal && window.openAddPaymentModal(${Number(r.id)});" title="\u062a\u0633\u062c\u064a\u0644 \u062f\u0641\u0639\u0629 \u0633\u062f\u0627\u062f">\u062a\u0633\u062c\u064a\u0644 \u062f\u0641\u0639\u0629 \u0633\u062f\u0627\u062f</button>` : ''}<button type="button" class="btn btn-secondary reservation-preview-action reservation-preview-invoice" data-action="invoice" data-id="${App.Helpers.escapeHtml(r.id)}" title="\u0645\u0639\u0627\u064a\u0646\u0629 \u0627\u0644\u0641\u0627\u062a\u0648\u0631\u0629"><span>\u25a4</span> \u0645\u0639\u0627\u064a\u0646\u0629 \u0627\u0644\u0641\u0627\u062a\u0648\u0631\u0629</button></div><button type="button" class="btn reservation-preview-footer-close" data-preview-close title="\u0625\u063a\u0644\u0627\u0642 \u0627\u0644\u0645\u0639\u0627\u064a\u0646\u0629">\u0625\u063a\u0644\u0627\u0642</button></footer>`;

    modal.style.display = 'flex';
    modal.querySelector('[data-preview-close]')?.focus();
  };

  window.openRoomDetailsModal = async function(id) {
    if (typeof App.Helpers.openReservationPreview === 'function') {
      const parsed = parseInt(id, 10);
      const room = App.State.roomsCache?.find(r => r.id === parsed || r.room_number == id);
      if (room && room.active_reservations?.[0]?.id) {
        return await App.Helpers.openReservationPreview(room.active_reservations[0].id);
      }
      return await App.Helpers.openReservationPreview(parsed || id);
    }
  };

  App.Helpers.initOverview = function() {
  initExecutiveSummaryKpiActions();
  initActionHoverTooltips();
  document.querySelectorAll('[data-overview-table-tab]').forEach(tab => {
    tab.addEventListener('click', () => {
      const selectedPanelId = tab.dataset.overviewTableTab;
      document.querySelectorAll('[data-overview-table-tab]').forEach(button => {
        const active = button === tab;
        button.classList.toggle('active', active);
        button.setAttribute('aria-selected', String(active));
      });
      document.querySelectorAll('[data-overview-table-panel]').forEach(panel => {
        const active = panel.id === selectedPanelId;
        panel.hidden = !active;
        panel.classList.toggle('active', active);
      });
    });
  });

  if (App.DOM.btnRefreshCheckouts) {
    App.DOM.btnRefreshCheckouts.addEventListener('click', loadTodayCheckouts);
  }

  if (App.DOM.todayCheckoutsSearch) {
    App.DOM.todayCheckoutsSearch.addEventListener('input', () => renderTodayCheckoutsTable(App.State.todayCheckoutsRows));
  }

  if (App.DOM.todayCheckoutsFilters) {
    App.DOM.todayCheckoutsFilters.addEventListener('click', event => {
      const button = event.target.closest('[data-checkout-filter]');
      if (!button) return;

      App.State.todayCheckoutsActiveFilter = button.dataset.checkoutFilter || 'all';
      App.DOM.todayCheckoutsFilters.querySelectorAll('[data-checkout-filter]').forEach(filterButton => {
        const active = filterButton === button;
        filterButton.classList.toggle('active', active);
        filterButton.setAttribute('aria-pressed', String(active));
      });
      renderTodayCheckoutsTable(App.State.todayCheckoutsRows);
    });
  }


  };
  App.Helpers.loadOverviewData = loadOverviewData;
  App.Helpers.loadTodayCheckouts = loadTodayCheckouts;

})(window.DashboardApp);

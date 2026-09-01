/* ============================================================
   대시보드 로직
   - 상단 필터 바(기간: 월별/기간별, 영업대표)로 지표/차트/최근 견적을 필터링
   - "월별 견적발행/계약 금액" 차트는 필터 기간과 무관하게 항상 연간(월별 모드) /
     최근 12개월(기간별 모드) 기준으로 표시되며, 영업대표 선택만 반영됨
   ============================================================ */

let allQuotes = [];
let monthlyChartInstance = null;
let statusChartInstance = null;

const RANGE_PRESET_LABELS = {
  '1w': '최근 1주일',
  '1m': '최근 1개월',
  '3m': '최근 3개월',
  '6m': '최근 6개월',
  '1y': '최근 1년',
};

function defaultFilterState() {
  const now = new Date();
  return {
    mode: 'month',
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    rangePreset: '1m',
    rangeFrom: '',
    rangeTo: '',
    repName: '',
  };
}

let draftFilter = defaultFilterState();
let appliedFilter = defaultFilterState();
let monthGridYear = draftFilter.year;

async function loadDashboard() {
  try {
    const { data } = await apiList('quotes');
    allQuotes = data || [];
    bindFilterEvents();
    renderRepOptions();
    syncFilterUiFromDraft();
    renderDashboard();
  } catch (e) {
    console.error(e);
    showToast('대시보드 데이터를 불러오지 못했습니다.', 'error');
  }
}

function renderDashboard() {
  const filtered = getFilteredQuotes();
  renderStats(filtered);
  renderRecentQuotes(filtered);
  renderMonthlyChart();
  renderStatusChart(filtered);
}

/* ---------------- 필터 상태 → 날짜 범위 ---------------- */
function addMonthsLocal(date, delta) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + delta);
  return d;
}

function getDateRangeFor(filter) {
  if (filter.mode === 'month') {
    const start = new Date(filter.year, filter.month - 1, 1, 0, 0, 0, 0);
    const end = new Date(filter.year, filter.month, 0, 23, 59, 59, 999);
    return { start, end };
  }

  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  if (filter.rangePreset === 'custom') {
    const start = filter.rangeFrom ? new Date(`${filter.rangeFrom}T00:00:00`) : new Date(0);
    const customEnd = filter.rangeTo ? new Date(`${filter.rangeTo}T23:59:59.999`) : end;
    return { start, end: customEnd };
  }

  let start;
  switch (filter.rangePreset) {
    case '1w': start = addDays(end, -6); break;
    case '3m': start = addMonthsLocal(end, -3); break;
    case '6m': start = addMonthsLocal(end, -6); break;
    case '1y': start = addMonthsLocal(end, -12); break;
    case '1m':
    default: start = addMonthsLocal(end, -1); break;
  }
  start.setHours(0, 0, 0, 0);
  return { start, end };
}

function getFilteredQuotes() {
  const { start, end } = getDateRangeFor(appliedFilter);
  return allQuotes.filter(q => {
    if (appliedFilter.repName && q.sales_rep_name !== appliedFilter.repName) return false;
    const d = new Date(q.issue_date);
    if (isNaN(d.getTime())) return false;
    return d >= start && d <= end;
  });
}

function getRepScopedQuotes() {
  return appliedFilter.repName ? allQuotes.filter(q => q.sales_rep_name === appliedFilter.repName) : allQuotes;
}

/* ---------------- 지표 카드: 상태별 건수/금액 ---------------- */
const STAT_CARD_ORDER = ['전체', '계약됨', '내부협의중', '발송됨', '발송전', '만료됨'];

function renderStats(filtered) {
  STAT_CARD_ORDER.forEach(key => {
    const group = key === '전체' ? filtered : filtered.filter(q => q.status === key);
    const count = group.length;
    const amount = group.reduce((sum, q) => sum + (Number(q.total) || 0), 0);
    document.getElementById(`stat-${key}-count`).textContent = `${formatNumber(count)}건`;
    document.getElementById(`stat-${key}-amount`).textContent = formatCurrency(amount);
  });
}

/* ---------------- 최근 견적서 ---------------- */
function renderRecentQuotes(filtered) {
  const tbody = document.getElementById('recent-quotes-body');
  const sorted = [...filtered].sort((a, b) => new Date(b.issue_date) - new Date(a.issue_date)).slice(0, 8);

  if (!sorted.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-slate-400 py-8">조건에 맞는 견적서가 없습니다.</td></tr>`;
    return;
  }

  tbody.innerHTML = sorted.map(q => `
    <tr class="cursor-pointer" onclick="location.href='quote-detail.html?id=${q.id}'">
      <td class="font-semibold text-slate-700">${q.quote_number || '-'}</td>
      <td>${q.customer_name || '-'}</td>
      <td>${q.sales_rep_name || '-'}</td>
      <td>${formatDate(q.issue_date)}</td>
      <td class="font-semibold text-right">${formatCurrency(q.total)}</td>
      <td>${statusBadge(q.status)}</td>
      <td class="text-right"><i class="fa-solid fa-chevron-right text-slate-300"></i></td>
    </tr>
  `).join('');
}

/* ---------------- 월별 견적발행/계약 금액 차트 ---------------- */
function renderMonthlyChart() {
  const repQuotes = getRepScopedQuotes();
  let months = [];

  if (appliedFilter.mode === 'month') {
    const y = appliedFilter.year;
    for (let m = 1; m <= 12; m++) months.push({ key: `${y}-${String(m).padStart(2, '0')}`, label: `${m}` });
    document.getElementById('monthly-chart-caption').textContent =
      `${y}년 · 영업대표 ${appliedFilter.repName || '전체'} (대표 선택 시 해당 대표 실적만 표시)`;
  } else {
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: `${d.getMonth() + 1}` });
    }
    document.getElementById('monthly-chart-caption').textContent =
      `최근 12개월 · 영업대표 ${appliedFilter.repName || '전체'} (대표 선택 시 해당 대표 실적만 표시)`;
  }

  const issuedTotals = months.map(m => repQuotes
    .filter(q => formatDate(q.issue_date).slice(0, 7) === m.key)
    .reduce((sum, q) => sum + (Number(q.total) || 0), 0));
  const contractedTotals = months.map(m => repQuotes
    .filter(q => q.status === '계약됨' && formatDate(q.issue_date).slice(0, 7) === m.key)
    .reduce((sum, q) => sum + (Number(q.total) || 0), 0));

  const ctx = document.getElementById('monthlyChart');
  if (monthlyChartInstance) monthlyChartInstance.destroy();
  monthlyChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: months.map(m => m.label),
      datasets: [
        { label: '견적발행', data: issuedTotals, backgroundColor: '#cbd5e1', borderRadius: 6, maxBarThickness: 22 },
        { label: '계약', data: contractedTotals, backgroundColor: '#4f46e5', borderRadius: 6, maxBarThickness: 22 },
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'top', align: 'end', labels: { boxWidth: 10, font: { size: 11 } } } },
      scales: {
        y: { ticks: { callback: v => (v / 10000).toLocaleString() + '만' }, grid: { color: '#f1f5f9' } },
        x: { grid: { display: false } }
      }
    }
  });
}

/* ---------------- 상태별 분포 차트 ---------------- */
function renderStatusChart(filtered) {
  const labels = Object.keys(STATUS_CONFIG);
  const counts = labels.map(l => filtered.filter(q => q.status === l).length);
  const colors = ['#94a3b8', '#2563eb', '#d97706', '#16a34a', '#dc2626'];

  const ctx = document.getElementById('statusChart');
  if (statusChartInstance) statusChartInstance.destroy();
  statusChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data: counts, backgroundColor: colors, borderWidth: 0 }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } } }
    }
  });
}

/* ---------------- 필터 바: 이벤트 바인딩 ---------------- */
function bindFilterEvents() {
  document.getElementById('period-mode-toggle').addEventListener('click', (e) => {
    const btn = e.target.closest('.filter-toggle-btn');
    if (!btn) return;
    e.stopPropagation(); // 팝오버가 열려 있었다면 모드 전환 후에도 계속 열려 있도록 유지
    const popover = document.getElementById('period-popover');
    const wasOpen = !popover.classList.contains('hidden');
    draftFilter.mode = btn.dataset.mode;
    syncFilterUiFromDraft();
    if (wasOpen) popover.classList.remove('hidden');
  });

  document.getElementById('period-value-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    togglePopover('period-popover');
  });
  document.getElementById('rep-value-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    togglePopover('rep-popover');
  });

  document.getElementById('month-year-prev').addEventListener('click', () => {
    monthGridYear -= 1;
    renderMonthGrid();
  });
  document.getElementById('month-year-next').addEventListener('click', () => {
    monthGridYear += 1;
    renderMonthGrid();
  });

  document.getElementById('month-grid').addEventListener('click', (e) => {
    const cell = e.target.closest('.month-cell');
    if (!cell) return;
    draftFilter.year = monthGridYear;
    draftFilter.month = Number(cell.dataset.month);
    updatePeriodButtonLabel();
    renderMonthGrid();
    closePopovers();
  });

  document.getElementById('range-preset-group').addEventListener('click', (e) => {
    const pill = e.target.closest('.preset-pill');
    if (!pill) return;
    draftFilter.rangePreset = pill.dataset.preset;
    renderRangePresets();
    updateRangeInputsState();
    updatePeriodButtonLabel();
    if (draftFilter.rangePreset !== 'custom') closePopovers();
  });

  document.getElementById('range-from').addEventListener('change', (e) => {
    draftFilter.rangeFrom = e.target.value;
    updatePeriodButtonLabel();
  });
  document.getElementById('range-to').addEventListener('change', (e) => {
    draftFilter.rangeTo = e.target.value;
    updatePeriodButtonLabel();
  });

  document.getElementById('rep-search').addEventListener('input', renderRepOptions);

  // 팝오버 내부 클릭은 바깥 클릭으로 간주해 닫히지 않도록 전파를 막음
  // (개별 선택 동작은 각 핸들러에서 명시적으로 closePopovers()를 호출함)
  document.getElementById('period-popover').addEventListener('click', (e) => e.stopPropagation());
  document.getElementById('rep-popover').addEventListener('click', (e) => e.stopPropagation());

  document.getElementById('btn-filter-apply').addEventListener('click', () => {
    appliedFilter = { ...draftFilter };
    renderDashboard();
    closePopovers();
  });

  document.getElementById('btn-filter-reset').addEventListener('click', () => {
    draftFilter = defaultFilterState();
    appliedFilter = defaultFilterState();
    monthGridYear = draftFilter.year;
    syncFilterUiFromDraft();
    renderDashboard();
    closePopovers();
  });

  document.addEventListener('click', () => closePopovers());
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePopovers(); });
}

function togglePopover(id) {
  const el = document.getElementById(id);
  const willOpen = el.classList.contains('hidden');
  closePopovers();
  if (willOpen) el.classList.remove('hidden');
}

function closePopovers() {
  document.getElementById('period-popover').classList.add('hidden');
  document.getElementById('rep-popover').classList.add('hidden');
}

/* ---------------- 필터 UI 동기화 ---------------- */
function syncFilterUiFromDraft() {
  document.querySelectorAll('#period-mode-toggle .filter-toggle-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === draftFilter.mode);
  });
  document.getElementById('month-picker-panel').classList.toggle('hidden', draftFilter.mode !== 'month');
  document.getElementById('range-picker-panel').classList.toggle('hidden', draftFilter.mode !== 'range');

  monthGridYear = draftFilter.year;
  renderMonthGrid();
  renderRangePresets();
  document.getElementById('range-from').value = draftFilter.rangeFrom || '';
  document.getElementById('range-to').value = draftFilter.rangeTo || '';
  updateRangeInputsState();

  renderRepOptions();
  updatePeriodButtonLabel();
  updateRepButtonLabel();
}

function renderMonthGrid() {
  document.getElementById('month-year-label').textContent = `${monthGridYear}년`;
  const grid = document.getElementById('month-grid');
  grid.innerHTML = Array.from({ length: 12 }, (_, i) => i + 1).map(m => {
    const active = monthGridYear === draftFilter.year && m === draftFilter.month;
    return `<button type="button" class="month-cell ${active ? 'active' : ''}" data-month="${m}">${m}월</button>`;
  }).join('');
}

function renderRangePresets() {
  document.querySelectorAll('#range-preset-group .preset-pill').forEach(pill => {
    pill.classList.toggle('active', pill.dataset.preset === draftFilter.rangePreset);
  });
}

function updateRangeInputsState() {
  const isCustom = draftFilter.rangePreset === 'custom';
  document.getElementById('range-from').disabled = !isCustom;
  document.getElementById('range-to').disabled = !isCustom;
}

function updatePeriodButtonLabel() {
  let label;
  if (draftFilter.mode === 'month') {
    label = `${draftFilter.year}-${String(draftFilter.month).padStart(2, '0')}`;
  } else if (draftFilter.rangePreset === 'custom') {
    label = (draftFilter.rangeFrom && draftFilter.rangeTo)
      ? `${draftFilter.rangeFrom} ~ ${draftFilter.rangeTo}`
      : '기간 설정';
  } else {
    label = RANGE_PRESET_LABELS[draftFilter.rangePreset] || '기간 선택';
  }
  document.getElementById('period-value-label').textContent = label;
}

function updateRepButtonLabel() {
  document.getElementById('rep-value-label').textContent = draftFilter.repName || '전체';
}

function renderRepOptions() {
  const list = document.getElementById('rep-option-list');
  const query = (document.getElementById('rep-search').value || '').trim().toLowerCase();
  const reps = [...new Set(allQuotes.map(q => q.sales_rep_name).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ko'));
  const filteredReps = query ? reps.filter(r => r.toLowerCase().includes(query)) : reps;

  const optionHtml = (value, label) => {
    const active = draftFilter.repName === value;
    return `<button type="button" class="rep-option ${active ? 'active' : ''}" data-rep="${escapeAttr(value)}"><span class="rep-option-dot"></span>${label}</button>`;
  };

  const items = [];
  if (!query) items.push(optionHtml('', '전체'));
  items.push(...filteredReps.map(r => optionHtml(r, r)));

  list.innerHTML = items.length ? items.join('') : `<p class="text-slate-400 text-xs px-1 py-2">일치하는 영업대표가 없습니다.</p>`;

  list.querySelectorAll('.rep-option').forEach(btn => {
    btn.addEventListener('click', () => {
      draftFilter.repName = btn.dataset.rep;
      updateRepButtonLabel();
      renderRepOptions();
      closePopovers();
    });
  });
}

function escapeAttr(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

document.addEventListener('DOMContentLoaded', loadDashboard);

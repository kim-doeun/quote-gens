/* ============================================================
   대시보드 로직
   ============================================================ */

let monthlyChartInstance = null;
let statusChartInstance = null;

async function loadDashboard() {
  try {
    const { data: quotes } = await apiList('quotes');
    renderStats(quotes);
    renderRecentQuotes(quotes);
    renderMonthlyChart(quotes);
    renderStatusChart(quotes);
  } catch (e) {
    console.error(e);
    showToast('대시보드 데이터를 불러오지 못했습니다.', 'error');
  }
}

function renderStats(quotes) {
  const now = new Date();
  const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const total = quotes.length;
  const monthTotal = quotes
    .filter(q => formatDate(q.issue_date).slice(0, 7) === thisMonthKey)
    .reduce((sum, q) => sum + (Number(q.total) || 0), 0);
  const approved = quotes.filter(q => q.status === '계약됨').length;
  const inProgress = quotes.filter(q => q.status === '발송됨' || q.status === '내부협의중').length;

  document.getElementById('stat-total').textContent = `${formatNumber(total)}건`;
  document.getElementById('stat-month-total').textContent = formatCurrency(monthTotal);
  document.getElementById('stat-approved').textContent = `${formatNumber(approved)}건`;
  document.getElementById('stat-inprogress').textContent = `${formatNumber(inProgress)}건`;
}

function renderRecentQuotes(quotes) {
  const tbody = document.getElementById('recent-quotes-body');
  const sorted = [...quotes].sort((a, b) => new Date(b.issue_date) - new Date(a.issue_date)).slice(0, 8);

  if (!sorted.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-slate-400 py-8">아직 발행된 견적서가 없습니다.</td></tr>`;
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

function renderMonthlyChart(quotes) {
  const now = new Date();
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: `${d.getMonth() + 1}월` });
  }

  const totals = months.map(m => quotes
    .filter(q => formatDate(q.issue_date).slice(0, 7) === m.key)
    .reduce((sum, q) => sum + (Number(q.total) || 0), 0));

  const ctx = document.getElementById('monthlyChart');
  if (monthlyChartInstance) monthlyChartInstance.destroy();
  monthlyChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: months.map(m => m.label),
      datasets: [{
        label: '견적 발행 금액',
        data: totals,
        backgroundColor: '#4f46e5',
        borderRadius: 6,
        maxBarThickness: 42
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { ticks: { callback: v => (v / 10000).toLocaleString() + '만' }, grid: { color: '#f1f5f9' } },
        x: { grid: { display: false } }
      }
    }
  });
}

function renderStatusChart(quotes) {
  const labels = Object.keys(STATUS_CONFIG);
  const counts = labels.map(l => quotes.filter(q => q.status === l).length);
  const colors = ['#94a3b8', '#2563eb', '#d97706', '#16a34a', '#dc2626', '#64748b'];

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

document.addEventListener('DOMContentLoaded', loadDashboard);

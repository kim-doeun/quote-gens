/* ============================================================
   견적 이력 관리 페이지 로직
   ============================================================ */

let allQuotes = [];
let statusChangeTargetId = null;

async function initQuotesPage() {
  bindFilterEvents();
  await loadQuotes();
}

async function loadQuotes() {
  try {
    const { data } = await apiList('quotes');
    allQuotes = data || [];
    populateRepFilter(allQuotes);
    applyFilters();
  } catch (e) {
    console.error(e);
    showToast('견적 목록을 불러오지 못했습니다.', 'error');
  }
}

function populateRepFilter(quotes) {
  const sel = document.getElementById('filter-rep');
  const reps = [...new Set(quotes.map(q => q.sales_rep_name).filter(Boolean))].sort();
  sel.innerHTML = '<option value="">전체 영업대표</option>' + reps.map(r => `<option value="${r}">${r}</option>`).join('');
}

function bindFilterEvents() {
  document.getElementById('search-input').addEventListener('input', applyFilters);
  document.getElementById('filter-status').addEventListener('change', applyFilters);
  document.getElementById('filter-rep').addEventListener('change', applyFilters);
  document.getElementById('sort-order').addEventListener('change', applyFilters);
}

function applyFilters() {
  const q = document.getElementById('search-input').value.trim().toLowerCase();
  const status = document.getElementById('filter-status').value;
  const rep = document.getElementById('filter-rep').value;
  const sortOrder = document.getElementById('sort-order').value;

  let filtered = allQuotes.filter(quote => {
    const matchesQuery = !q ||
      (quote.quote_number || '').toLowerCase().includes(q) ||
      (quote.customer_name || '').toLowerCase().includes(q) ||
      (quote.sales_rep_name || '').toLowerCase().includes(q);
    const matchesStatus = !status || quote.status === status;
    const matchesRep = !rep || quote.sales_rep_name === rep;
    return matchesQuery && matchesStatus && matchesRep;
  });

  filtered.sort((a, b) => {
    switch (sortOrder) {
      case 'date-asc': return new Date(a.issue_date) - new Date(b.issue_date);
      case 'total-desc': return (Number(b.total) || 0) - (Number(a.total) || 0);
      case 'total-asc': return (Number(a.total) || 0) - (Number(b.total) || 0);
      default: return new Date(b.issue_date) - new Date(a.issue_date);
    }
  });

  renderQuotesTable(filtered);
  renderSummary(filtered);
}

function renderSummary(list) {
  document.getElementById('result-count').textContent = `${formatNumber(list.length)}건`;
  const total = list.reduce((sum, q) => sum + (Number(q.total) || 0), 0);
  document.getElementById('result-total').textContent = formatCurrency(total);
}

function renderQuotesTable(list) {
  const tbody = document.getElementById('quotes-body');
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center text-slate-400 py-10">조건에 맞는 견적서가 없습니다.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(q => `
    <tr>
      <td class="font-semibold text-slate-700 cursor-pointer" onclick="location.href='quote-detail.html?id=${q.id}'">${q.quote_number || '-'}${Number(q.version) > 1 ? `<span class="version-tag">v${q.version}</span>` : ''}</td>
      <td class="cursor-pointer" onclick="location.href='quote-detail.html?id=${q.id}'">${q.customer_name || '-'}</td>
      <td>${q.sales_rep_name || '-'}</td>
      <td>${formatDate(q.issue_date)}</td>
      <td>${formatDate(q.valid_until)}</td>
      <td class="font-semibold text-right">${formatCurrency(q.total)}</td>
      <td>
        <button onclick="openStatusModal('${q.id}', '${q.status}')" class="cursor-pointer">${statusBadge(q.status)}</button>
      </td>
      <td>
        <div class="flex items-center gap-1 whitespace-nowrap">
          <a href="quote-detail.html?id=${q.id}" class="btn-ghost btn" style="padding:0.35rem 0.55rem;" title="상세보기"><i class="fa-solid fa-eye"></i></a>
          ${q.status === '발송전' ? `<a href="quote-new.html?id=${q.id}" class="btn-ghost btn" style="padding:0.35rem 0.55rem;" title="수정 (발송전 상태만 수정 가능)"><i class="fa-solid fa-pen"></i></a>` : ''}
          <button onclick="deleteQuote('${q.id}')" class="btn-ghost btn text-rose-500" style="padding:0.35rem 0.55rem;" title="삭제"><i class="fa-solid fa-trash"></i></button>
        </div>
      </td>
    </tr>
  `).join('');
}

/* ---------------- 상태 변경 모달 ---------------- */
function openStatusModal(id, currentStatus) {
  statusChangeTargetId = id;
  document.getElementById('status-modal-select').value = currentStatus || '발송전';
  document.getElementById('status-modal').classList.remove('hidden');
}

function closeStatusModal() {
  document.getElementById('status-modal').classList.add('hidden');
  statusChangeTargetId = null;
}

async function confirmStatusChange() {
  if (!statusChangeTargetId) return;
  const newStatus = document.getElementById('status-modal-select').value;
  try {
    await apiUpdate('quotes', statusChangeTargetId, { status: newStatus });
    showToast('상태가 변경되었습니다.', 'success');
    closeStatusModal();
    await loadQuotes();
  } catch (e) {
    console.error(e);
    showToast('상태 변경 중 오류가 발생했습니다.', 'error');
  }
}

/* ---------------- 삭제 ---------------- */
async function deleteQuote(id) {
  if (!(await confirmAction('이 견적서를 삭제할까요? 삭제 후 되돌릴 수 없습니다.'))) return;
  try {
    await apiDelete('quotes', id);
    showToast('견적서가 삭제되었습니다.', 'success');
    await loadQuotes();
  } catch (e) {
    console.error(e);
    showToast('삭제 중 오류가 발생했습니다.', 'error');
  }
}

document.addEventListener('DOMContentLoaded', initQuotesPage);

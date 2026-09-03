/* ============================================================
   인건비 단가 관리 페이지 로직
   ============================================================ */

let allRates = [];

const GRADE_ORDER = { '특급': 0, '고급': 1, '중급': 2, '초급': 3 };

async function initRatesPage() {
  document.getElementById('btn-new-rate').addEventListener('click', () => openRateModal());
  await loadRates();
}

async function loadRates() {
  try {
    const { data } = await apiList('labor_rates');
    allRates = (data || []).sort((a, b) => (GRADE_ORDER[a.grade] ?? 9) - (GRADE_ORDER[b.grade] ?? 9));
    renderRates(allRates);
  } catch (e) {
    console.error(e);
    showToast('인건비 단가 목록을 불러오지 못했습니다.', 'error');
  }
}

function renderRates(list) {
  const tbody = document.getElementById('rates-body');
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-slate-400 py-10">등록된 단가가 없습니다.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(r => `
    <tr>
      <td><span class="badge badge-sent">${r.grade || '-'}</span></td>
      <td class="font-semibold text-slate-700">${r.default_role || '-'}</td>
      <td class="font-semibold text-right">${formatCurrency(r.monthly_rate)}</td>
      <td class="text-slate-500 text-sm max-w-md">${r.description || ''}</td>
      <td>
        <div class="flex items-center gap-1 whitespace-nowrap">
          <button onclick="openRateModalById('${r.id}')" class="btn-ghost btn" style="padding:0.35rem 0.55rem;"><i class="fa-solid fa-pen text-slate-400"></i></button>
          <button onclick="deleteRate('${r.id}')" class="btn-ghost btn" style="padding:0.35rem 0.55rem;"><i class="fa-solid fa-trash text-rose-400"></i></button>
        </div>
      </td>
    </tr>
  `).join('');
}

/* ---------------- 모달 ---------------- */
function openRateModalById(id) {
  const rate = allRates.find(r => r.id === id);
  if (!rate) {
    showToast('단가 정보를 찾을 수 없습니다. 목록을 새로고침합니다.', 'error');
    loadRates();
    return;
  }
  openRateModal(rate);
}

function openRateModal(rate) {
  document.getElementById('rate-modal-title').textContent = rate ? '단가 수정' : '단가 등록';
  document.getElementById('r-id').value = rate ? rate.id : '';
  document.getElementById('r-grade').value = rate ? rate.grade || '중급' : '중급';
  document.getElementById('r-role').value = rate ? rate.default_role || '' : '';
  document.getElementById('r-rate').value = rate ? rate.monthly_rate || 0 : 0;
  document.getElementById('r-description').value = rate ? rate.description || '' : '';
  document.getElementById('rate-modal').classList.remove('hidden');
}

function closeRateModal() {
  document.getElementById('rate-modal').classList.add('hidden');
}

async function saveRate() {
  const id = document.getElementById('r-id').value;
  const payload = {
    grade: document.getElementById('r-grade').value,
    default_role: document.getElementById('r-role').value.trim(),
    monthly_rate: Number(document.getElementById('r-rate').value) || 0,
    description: document.getElementById('r-description').value.trim(),
  };

  try {
    if (id) {
      await apiUpdate('labor_rates', id, payload);
      showToast('단가 정보가 수정되었습니다.', 'success');
    } else {
      await apiCreate('labor_rates', payload);
      showToast('단가가 등록되었습니다.', 'success');
    }
    closeRateModal();
    await loadRates();
  } catch (e) {
    console.error(e);
    showToast('저장 중 오류가 발생했습니다.', 'error');
  }
}

async function deleteRate(id) {
  if (!(await confirmAction('이 단가 항목을 삭제할까요?'))) return;
  try {
    await apiDelete('labor_rates', id);
    showToast('삭제되었습니다.', 'success');
    await loadRates();
  } catch (e) {
    console.error(e);
    showToast('삭제 중 오류가 발생했습니다.', 'error');
  }
}

document.addEventListener('DOMContentLoaded', initRatesPage);

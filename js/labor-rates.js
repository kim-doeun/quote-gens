/* ============================================================
   인건비 단가 관리 페이지 로직
   - 등급별 단가(grade_rates)와 역할(roles)은 서로 독립적으로 관리됩니다.
     (등급=단가, 역할=설명이며 "등급+역할" 조합 단위로 관리하지 않음)
   ============================================================ */

let gradeRatesCache = [];
let allRoles = [];

const GRADE_ORDER = { '특급': 0, '고급': 1, '중급': 2, '초급': 3 };
const GRADES = ['특급', '고급', '중급', '초급'];

async function initRatesPage() {
  document.getElementById('btn-new-role').addEventListener('click', () => openRoleModal());
  await Promise.all([loadGradeRates(), loadRoles()]);
}

/* ---------------- 등급별 단가 ---------------- */
async function loadGradeRates() {
  try {
    const { data } = await apiList('grade_rates');
    gradeRatesCache = data || [];
    renderGradeRates();
  } catch (e) {
    console.error(e);
    showToast('등급별 단가를 불러오지 못했습니다.', 'error');
  }
}

function renderGradeRates() {
  const tbody = document.getElementById('grade-rates-body');
  tbody.innerHTML = GRADES.map(grade => {
    const row = gradeRatesCache.find(r => r.grade === grade);
    const rate = row ? row.monthly_rate : 0;
    return `
    <tr>
      <td><span class="badge badge-sent">${grade}</span></td>
      <td class="text-right">
        <input type="number" class="input text-right" style="max-width:220px; margin-left:auto;" min="0" value="${rate}" onchange="saveGradeRate('${grade}', this.value)">
      </td>
    </tr>`;
  }).join('');
}

async function saveGradeRate(grade, value) {
  const monthlyRate = Number(value) || 0;
  const existing = gradeRatesCache.find(r => r.grade === grade);
  try {
    if (existing) {
      await apiUpdate('grade_rates', existing.id, { monthly_rate: monthlyRate });
    } else {
      await apiCreate('grade_rates', { grade, monthly_rate: monthlyRate });
    }
    showToast(`${grade} 단가가 저장되었습니다.`, 'success');
    await loadGradeRates();
  } catch (e) {
    console.error(e);
    showToast('단가 저장 중 오류가 발생했습니다.', 'error');
  }
}

/* ---------------- 역할 ---------------- */
async function loadRoles() {
  try {
    const { data } = await apiList('roles');
    allRoles = (data || []).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko'));
    renderRoles();
  } catch (e) {
    console.error(e);
    showToast('역할 목록을 불러오지 못했습니다.', 'error');
  }
}

function renderRoles() {
  const tbody = document.getElementById('roles-body');
  if (!allRoles.length) {
    tbody.innerHTML = `<tr><td colspan="3" class="text-center text-slate-400 py-10">등록된 역할이 없습니다.</td></tr>`;
    return;
  }

  tbody.innerHTML = allRoles.map(r => `
    <tr>
      <td class="font-semibold text-slate-700">${escapeHtml(r.name)}</td>
      <td class="text-slate-500 text-sm max-w-md">${escapeHtml(r.description || '')}</td>
      <td>
        <div class="flex items-center gap-1 whitespace-nowrap">
          <button onclick="openRoleModalById('${r.id}')" class="btn-ghost btn" style="padding:0.35rem 0.55rem;"><i class="fa-solid fa-pen text-slate-400"></i></button>
          <button onclick="deleteRole('${r.id}')" class="btn-ghost btn" style="padding:0.35rem 0.55rem;"><i class="fa-solid fa-trash text-rose-400"></i></button>
        </div>
      </td>
    </tr>
  `).join('');
}

function openRoleModalById(id) {
  const role = allRoles.find(r => r.id === id);
  if (!role) {
    showToast('역할 정보를 찾을 수 없습니다. 목록을 새로고침합니다.', 'error');
    loadRoles();
    return;
  }
  openRoleModal(role);
}

function openRoleModal(role) {
  document.getElementById('role-modal-title').textContent = role ? '역할 수정' : '역할 등록';
  document.getElementById('ro-id').value = role ? role.id : '';
  document.getElementById('ro-name').value = role ? role.name || '' : '';
  document.getElementById('ro-description').value = role ? role.description || '' : '';
  document.getElementById('role-modal').classList.remove('hidden');
}

function closeRoleModal() {
  document.getElementById('role-modal').classList.add('hidden');
}

async function saveRole() {
  const id = document.getElementById('ro-id').value;
  const name = document.getElementById('ro-name').value.trim();
  if (!name) {
    showToast('역할명을 입력해주세요.', 'error');
    return;
  }

  const payload = {
    name,
    description: document.getElementById('ro-description').value.trim(),
  };

  try {
    if (id) {
      await apiUpdate('roles', id, payload);
      showToast('역할 정보가 수정되었습니다.', 'success');
    } else {
      await apiCreate('roles', payload);
      showToast('역할이 등록되었습니다.', 'success');
    }
    closeRoleModal();
    await loadRoles();
  } catch (e) {
    console.error(e);
    showToast('저장 중 오류가 발생했습니다.', 'error');
  }
}

async function deleteRole(id) {
  if (!(await confirmAction('이 역할을 삭제할까요?'))) return;
  try {
    await apiDelete('roles', id);
    showToast('삭제되었습니다.', 'success');
    await loadRoles();
  } catch (e) {
    console.error(e);
    showToast('삭제 중 오류가 발생했습니다.', 'error');
  }
}

function escapeHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

document.addEventListener('DOMContentLoaded', initRatesPage);

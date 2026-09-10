/* ============================================================
   영업대표(견적담당정보) 관리 페이지 로직
   ============================================================ */

let allReps = [];

async function initRepsPage() {
  document.getElementById('btn-new-rep').addEventListener('click', () => openRepModal());
  await loadReps();
}

async function loadReps() {
  try {
    const { data } = await apiList('sales_reps');
    allReps = (data || []).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko'));
    renderReps(allReps);
  } catch (e) {
    console.error(e);
    showToast('영업대표 목록을 불러오지 못했습니다.', 'error');
  }
}

function renderReps(list) {
  const tbody = document.getElementById('reps-body');
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-center text-slate-400 py-10">등록된 영업대표가 없습니다.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(r => `
    <tr>
      <td class="font-semibold text-slate-700">${r.name || '-'}</td>
      <td class="text-slate-500 text-sm">${r.email || '-'}</td>
      <td class="text-slate-500 text-sm">${r.phone || '-'}</td>
      <td>
        <div class="flex items-center gap-1 whitespace-nowrap">
          <button onclick="openRepModalById('${r.id}')" class="btn-ghost btn" style="padding:0.35rem 0.55rem;"><i class="fa-solid fa-pen text-slate-400"></i></button>
          <button onclick="deleteRep('${r.id}')" class="btn-ghost btn" style="padding:0.35rem 0.55rem;"><i class="fa-solid fa-trash text-rose-400"></i></button>
        </div>
      </td>
    </tr>
  `).join('');
}

/* ---------------- 모달 ---------------- */
function openRepModalById(id) {
  const rep = allReps.find(r => r.id === id);
  if (!rep) {
    showToast('영업대표 정보를 찾을 수 없습니다. 목록을 새로고침합니다.', 'error');
    loadReps();
    return;
  }
  openRepModal(rep);
}

function openRepModal(rep) {
  document.getElementById('rep-modal-title').textContent = rep ? '영업대표 수정' : '영업대표 등록';
  document.getElementById('sr-id').value = rep ? rep.id : '';
  document.getElementById('sr-name').value = rep ? rep.name || '' : '';
  document.getElementById('sr-email').value = rep ? rep.email || '' : '';
  document.getElementById('sr-phone').value = rep ? rep.phone || '' : '';
  document.getElementById('rep-modal').classList.remove('hidden');
}

function closeRepModal() {
  document.getElementById('rep-modal').classList.add('hidden');
}

async function saveRep() {
  const id = document.getElementById('sr-id').value;
  const name = document.getElementById('sr-name').value.trim();
  if (!name) {
    showToast('영업대표명을 입력해주세요.', 'error');
    return;
  }
  const payload = {
    name,
    email: document.getElementById('sr-email').value.trim(),
    phone: document.getElementById('sr-phone').value.trim(),
  };

  try {
    if (id) {
      await apiUpdate('sales_reps', id, payload);
      showToast('영업대표 정보가 수정되었습니다.', 'success');
    } else {
      await apiCreate('sales_reps', payload);
      showToast('영업대표가 등록되었습니다.', 'success');
    }
    closeRepModal();
    await loadReps();
  } catch (e) {
    console.error(e);
    showToast('저장 중 오류가 발생했습니다.', 'error');
  }
}

async function deleteRep(id) {
  if (!(await confirmAction('이 영업대표 정보를 삭제할까요?'))) return;
  try {
    await apiDelete('sales_reps', id);
    showToast('삭제되었습니다.', 'success');
    await loadReps();
  } catch (e) {
    console.error(e);
    showToast('삭제 중 오류가 발생했습니다.', 'error');
  }
}

document.addEventListener('DOMContentLoaded', initRepsPage);

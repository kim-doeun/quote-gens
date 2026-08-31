/* ============================================================
   고객사 관리 페이지 로직
   ============================================================ */

let allCustomers = [];
let quoteCountByCustomer = {};

async function initCustomersPage() {
  document.getElementById('btn-new-customer').addEventListener('click', () => openCustomerModal());
  document.getElementById('search-input').addEventListener('input', applyCustomerFilter);
  await loadCustomers();
}

async function loadCustomers() {
  try {
    const [{ data: customers }, { data: quotes }] = await Promise.all([
      apiList('customers'),
      apiList('quotes')
    ]);
    allCustomers = customers || [];
    quoteCountByCustomer = {};
    (quotes || []).forEach(q => {
      const key = q.customer_id || q.customer_name;
      quoteCountByCustomer[key] = (quoteCountByCustomer[key] || 0) + 1;
    });
    applyCustomerFilter();
  } catch (e) {
    console.error(e);
    showToast('고객사 목록을 불러오지 못했습니다.', 'error');
  }
}

function applyCustomerFilter() {
  const q = document.getElementById('search-input').value.trim().toLowerCase();
  const filtered = allCustomers.filter(c =>
    !q ||
    (c.company_name || '').toLowerCase().includes(q) ||
    (c.contact_name || '').toLowerCase().includes(q) ||
    (c.industry || '').toLowerCase().includes(q)
  );
  renderCustomers(filtered);
}

function renderCustomers(list) {
  const grid = document.getElementById('customers-grid');
  if (!list.length) {
    grid.innerHTML = `<div class="text-center text-slate-400 py-10 col-span-full">등록된 고객사가 없습니다.</div>`;
    return;
  }

  grid.innerHTML = list.map(c => {
    const count = quoteCountByCustomer[c.id] || quoteCountByCustomer[c.company_name] || 0;
    return `
    <div class="card p-5 flex flex-col gap-3">
      <div class="flex items-start justify-between">
        <div>
          <p class="font-bold text-slate-800">${c.company_name || '-'}</p>
          <p class="text-xs text-slate-400 mt-0.5">${c.industry || '업종 미등록'}</p>
        </div>
        <div class="flex gap-1">
          <button onclick="openCustomerModalById('${c.id}')" class="btn-ghost btn" style="padding:0.35rem 0.5rem;"><i class="fa-solid fa-pen text-slate-400"></i></button>
          <button onclick="deleteCustomer('${c.id}')" class="btn-ghost btn" style="padding:0.35rem 0.5rem;"><i class="fa-solid fa-trash text-rose-400"></i></button>
        </div>
      </div>
      <div class="text-sm text-slate-500 space-y-1 border-t border-slate-100 pt-3">
        ${c.contact_name ? `<p><i class="fa-solid fa-user w-4 text-slate-300 mr-1"></i>${c.contact_name} ${c.contact_position || ''}</p>` : ''}
        ${c.phone ? `<p><i class="fa-solid fa-phone w-4 text-slate-300 mr-1"></i>${c.phone}</p>` : ''}
        ${c.email ? `<p><i class="fa-solid fa-envelope w-4 text-slate-300 mr-1"></i>${c.email}</p>` : ''}
      </div>
      <div class="flex items-center justify-between pt-2 border-t border-slate-100">
        <span class="text-xs text-slate-400">누적 견적 <b class="text-indigo-600">${count}</b>건</span>
        <a href="quote-new.html" class="text-xs font-semibold text-indigo-600 hover:underline">견적 발급 <i class="fa-solid fa-arrow-right"></i></a>
      </div>
    </div>
  `;
  }).join('');
}

/* ---------------- 모달 ---------------- */
function openCustomerModalById(id) {
  // onclick 속성에 객체 전체를 직렬화해 넣던 기존 방식은 회사명/주소/메모 등에
  // 특수문자(따옴표, 백틱 등)가 있으면 HTML 속성이 깨져 오류가 발생했습니다.
  // 캐시(allCustomers)에서 id로 안전하게 조회하도록 변경합니다.
  const customer = allCustomers.find(c => c.id === id);
  if (!customer) {
    showToast('고객사 정보를 찾을 수 없습니다. 목록을 새로고침합니다.', 'error');
    loadCustomers();
    return;
  }
  openCustomerModal(customer);
}

function openCustomerModal(customer) {
  document.getElementById('customer-modal-title').textContent = customer ? '고객사 정보 수정' : '고객사 등록';
  document.getElementById('c-id').value = customer ? customer.id : '';
  document.getElementById('c-company-name').value = customer ? customer.company_name || '' : '';
  document.getElementById('c-business-number').value = customer ? customer.business_number || '' : '';
  document.getElementById('c-industry').value = customer ? customer.industry || '' : '';
  document.getElementById('c-contact-name').value = customer ? customer.contact_name || '' : '';
  document.getElementById('c-contact-position').value = customer ? customer.contact_position || '' : '';
  document.getElementById('c-phone').value = customer ? customer.phone || '' : '';
  document.getElementById('c-email').value = customer ? customer.email || '' : '';
  document.getElementById('c-address').value = customer ? customer.address || '' : '';
  document.getElementById('c-notes').value = customer ? customer.notes || '' : '';
  document.getElementById('customer-modal').classList.remove('hidden');
}

function closeCustomerModal() {
  document.getElementById('customer-modal').classList.add('hidden');
}

async function saveCustomer() {
  const id = document.getElementById('c-id').value;
  const companyName = document.getElementById('c-company-name').value.trim();
  if (!companyName) {
    showToast('회사명을 입력해주세요.', 'error');
    return;
  }

  const payload = {
    company_name: companyName,
    business_number: document.getElementById('c-business-number').value.trim(),
    industry: document.getElementById('c-industry').value.trim(),
    contact_name: document.getElementById('c-contact-name').value.trim(),
    contact_position: document.getElementById('c-contact-position').value.trim(),
    phone: document.getElementById('c-phone').value.trim(),
    email: document.getElementById('c-email').value.trim(),
    address: document.getElementById('c-address').value.trim(),
    notes: document.getElementById('c-notes').value.trim(),
  };

  try {
    if (id) {
      await apiUpdate('customers', id, payload);
      showToast('고객사 정보가 수정되었습니다.', 'success');
    } else {
      await apiCreate('customers', payload);
      showToast('고객사가 등록되었습니다.', 'success');
    }
    closeCustomerModal();
    await loadCustomers();
  } catch (e) {
    console.error(e);
    showToast('저장 중 오류가 발생했습니다.', 'error');
  }
}

async function deleteCustomer(id) {
  if (!confirmAction('이 고객사를 삭제할까요?')) return;
  try {
    await apiDelete('customers', id);
    showToast('고객사가 삭제되었습니다.', 'success');
    await loadCustomers();
  } catch (e) {
    console.error(e);
    showToast('삭제 중 오류가 발생했습니다.', 'error');
  }
}

document.addEventListener('DOMContentLoaded', initCustomersPage);

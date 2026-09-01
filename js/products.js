/* ============================================================
   S/W 라이선스 관리 페이지 로직
   ============================================================ */

let allProducts = [];

async function initProductsPage() {
  document.getElementById('btn-new-product').addEventListener('click', () => openProductModal());
  document.getElementById('search-input').addEventListener('input', applyProductFilter);
  document.getElementById('filter-category').addEventListener('change', applyProductFilter);
  await loadProducts();
}

async function loadProducts() {
  try {
    const { data } = await apiList('products');
    allProducts = data || [];
    applyProductFilter();
  } catch (e) {
    console.error(e);
    showToast('제품 목록을 불러오지 못했습니다.', 'error');
  }
}

function applyProductFilter() {
  const q = document.getElementById('search-input').value.trim().toLowerCase();
  const category = document.getElementById('filter-category').value;
  const filtered = allProducts.filter(p => {
    const matchesQuery = !q || (p.name || '').toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q);
    const matchesCategory = !category || p.category === category;
    return matchesQuery && matchesCategory;
  });
  renderProducts(filtered);
}

function renderProducts(list) {
  const tbody = document.getElementById('products-body');
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-slate-400 py-10">등록된 제품이 없습니다.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(p => `
    <tr>
      <td>
        <p class="font-semibold text-slate-800">${p.name || '-'}</p>
        <p class="text-xs text-slate-400 mt-0.5 max-w-md truncate">${(p.description || '').split('\n')[0]}</p>
      </td>
      <td><span class="badge badge-sent">${p.category || '-'}</span></td>
      <td>${p.unit || '-'}</td>
      <td class="text-slate-400 text-right">${formatCurrency(p.list_price)}</td>
      <td class="font-semibold text-right">${formatCurrency(p.unit_price)}</td>
      <td>${p.is_active !== false ? '<span class="badge badge-approved"><i class="fa-solid fa-check"></i>판매중</span>' : '<span class="badge badge-expired"><i class="fa-solid fa-pause"></i>중단</span>'}</td>
      <td>
        <div class="flex items-center gap-1 whitespace-nowrap">
          <button onclick="openProductModalById('${p.id}')" class="btn-ghost btn" style="padding:0.35rem 0.55rem;"><i class="fa-solid fa-pen text-slate-400"></i></button>
          <button onclick="deleteProduct('${p.id}')" class="btn-ghost btn" style="padding:0.35rem 0.55rem;"><i class="fa-solid fa-trash text-rose-400"></i></button>
        </div>
      </td>
    </tr>
  `).join('');
}

/* ---------------- 모달 ---------------- */
function openProductModalById(id) {
  // onclick 속성에 객체 전체를 직렬화해 넣던 기존 방식은 제품명/설명에
  // 특수문자(따옴표, 백틱 등)가 있으면 HTML 속성이 깨져 오류가 발생했습니다.
  // 캐시(allProducts)에서 id로 안전하게 조회하도록 변경합니다.
  const product = allProducts.find(p => p.id === id);
  if (!product) {
    showToast('제품 정보를 찾을 수 없습니다. 목록을 새로고침합니다.', 'error');
    loadProducts();
    return;
  }
  openProductModal(product);
}

function openProductModal(product) {
  document.getElementById('product-modal-title').textContent = product ? '제품 정보 수정' : '제품 등록';
  document.getElementById('p-id').value = product ? product.id : '';
  document.getElementById('p-name').value = product ? product.name || '' : '';
  document.getElementById('p-category').value = product ? product.category || '라이선스' : '라이선스';
  document.getElementById('p-unit').value = product ? product.unit || '' : '';
  document.getElementById('p-list-price').value = product ? product.list_price || 0 : 0;
  document.getElementById('p-price').value = product ? product.unit_price || 0 : 0;
  document.getElementById('p-description').value = product ? product.description || '' : '';
  document.getElementById('p-active').checked = product ? product.is_active !== false : true;
  document.getElementById('product-modal').classList.remove('hidden');
}

function closeProductModal() {
  document.getElementById('product-modal').classList.add('hidden');
}

async function saveProduct() {
  const id = document.getElementById('p-id').value;
  const name = document.getElementById('p-name').value.trim();
  if (!name) {
    showToast('제품명을 입력해주세요.', 'error');
    return;
  }

  const payload = {
    name,
    category: document.getElementById('p-category').value,
    unit: document.getElementById('p-unit').value.trim(),
    list_price: Number(document.getElementById('p-list-price').value) || 0,
    unit_price: Number(document.getElementById('p-price').value) || 0,
    description: document.getElementById('p-description').value.trim(),
    is_active: document.getElementById('p-active').checked,
  };

  try {
    if (id) {
      await apiUpdate('products', id, payload);
      showToast('제품 정보가 수정되었습니다.', 'success');
    } else {
      await apiCreate('products', payload);
      showToast('제품이 등록되었습니다.', 'success');
    }
    closeProductModal();
    await loadProducts();
  } catch (e) {
    console.error(e);
    showToast('저장 중 오류가 발생했습니다.', 'error');
  }
}

async function deleteProduct(id) {
  if (!(await confirmAction('이 제품을 삭제할까요?'))) return;
  try {
    await apiDelete('products', id);
    showToast('제품이 삭제되었습니다.', 'success');
    await loadProducts();
  } catch (e) {
    console.error(e);
    showToast('삭제 중 오류가 발생했습니다.', 'error');
  }
}

document.addEventListener('DOMContentLoaded', initProductsPage);

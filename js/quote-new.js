/* ============================================================
   견적서 발급 페이지 로직
   - 01. S/W 라이선스(licenseItems) / 02. 개발비(serviceItems) 분리 구조
   - 발급 상태는 발급 시점에 지정하지 않음(기본값 '발송전', 이후 이력관리에서 변경)
   ============================================================ */

let licenseItems = [];
let serviceItems = [];
// 03. 기타 품목: "구분"(하드웨어/3rd-party S/W/외주/기타)은 표의 컬럼이 아니라
// 01(S/W 라이선스)·02(개발비)와 같은 레벨의 "표 단위" 구분입니다.
// miscCategories = [{ classification: '하드웨어', items: [...] }, ...]
// 상단 select에서 유형을 선택하면 해당 유형만을 위한 표가 새로 생성되고,
// 그 표 안에서 "항목 추가"로 행을 계속 추가할 수 있습니다.
let miscCategories = [];
let productsCache = [];
let ratesCache = [];
let customersCache = [];

const MISC_CLASSIFICATION_OPTIONS = ['하드웨어', '3rd-party S/W', '외주', '기타'];

async function initQuoteNewPage() {
  const issueInput = document.getElementById('issue-date');
  const validInput = document.getElementById('valid-until');
  const now = new Date();
  issueInput.value = now.toISOString().slice(0, 10);
  validInput.value = addDays(now, 30).toISOString().slice(0, 10);

  const qn = await generateQuoteNumber();
  document.getElementById('quote-number-preview').textContent = qn;

  await Promise.all([loadCustomersForSelect(), loadProductsForSelect(), loadRatesForSelect()]);
  bindEvents();
  renderLicenseTable();
  renderServiceTable();
  renderMiscCategorySelect();
  renderMiscCategories();
  updateSummary();
}

async function loadCustomersForSelect() {
  try {
    const { data } = await apiList('customers');
    customersCache = data || [];
    const sel = document.getElementById('customer-select');
    customersCache.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.company_name;
      sel.appendChild(opt);
    });
  } catch (e) {
    console.error(e);
  }
}

async function loadProductsForSelect() {
  try {
    const { data } = await apiList('products');
    productsCache = (data || []).filter(p => p.is_active !== false);
    const sel = document.getElementById('modal-license-product');
    productsCache.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = `${p.name} (제안단가 ${formatCurrency(p.unit_price)})`;
      sel.appendChild(opt);
    });
  } catch (e) {
    console.error(e);
  }
}

async function loadRatesForSelect() {
  try {
    const { data } = await apiList('labor_rates');
    ratesCache = data || [];
    const sel = document.getElementById('modal-service-rate');
    ratesCache.forEach(r => {
      const opt = document.createElement('option');
      opt.value = r.id;
      opt.textContent = `[${r.grade}] ${r.default_role} (${formatCurrency(r.monthly_rate)}/M)`;
      sel.appendChild(opt);
    });
  } catch (e) {
    console.error(e);
  }
}

function bindEvents() {
  document.getElementById('customer-select').addEventListener('change', (e) => {
    const c = customersCache.find(x => x.id === e.target.value);
    if (!c) return;
    document.getElementById('customer-name').value = c.company_name || '';
    document.getElementById('customer-contact').value = c.contact_name ? `${c.contact_name} ${c.contact_position || ''}`.trim() : '';
    document.getElementById('customer-email').value = c.email || '';
    document.getElementById('customer-phone').value = c.phone || '';
    document.getElementById('customer-address').value = c.address || '';
  });

  document.getElementById('modal-license-product').addEventListener('change', (e) => {
    const p = productsCache.find(x => x.id === e.target.value);
    if (!p) return;
    document.getElementById('modal-license-name').value = p.name;
    document.getElementById('modal-license-desc').value = p.description || '';
    document.getElementById('modal-license-listprice').value = p.list_price || 0;
    document.getElementById('modal-license-price').value = p.unit_price || 0;
    syncDiscountFromPrice('modal-license-listprice', 'modal-license-discount', 'modal-license-price');
  });

  document.getElementById('modal-service-rate').addEventListener('change', (e) => {
    const r = ratesCache.find(x => x.id === e.target.value);
    if (!r) return;
    document.getElementById('modal-service-grade').value = r.grade || '중급';
    document.getElementById('modal-service-listprice').value = r.monthly_rate || 0;
    document.getElementById('modal-service-price').value = r.monthly_rate || 0;
    syncDiscountFromPrice('modal-service-listprice', 'modal-service-discount', 'modal-service-price');
    if (!document.getElementById('modal-service-name').value) {
      document.getElementById('modal-service-name').value = r.default_role || '';
    }
    if (!document.getElementById('modal-service-desc').value) {
      document.getElementById('modal-service-desc').value = r.description || '';
    }
  });

  document.getElementById('btn-add-license').addEventListener('click', openLicenseModal);
  document.getElementById('btn-add-service').addEventListener('click', openServiceModal);
  document.getElementById('misc-category-select').addEventListener('change', (e) => {
    const value = e.target.value;
    if (!value) return;
    addMiscCategory(value);
    e.target.value = '';
  });
  document.getElementById('tax-rate').addEventListener('input', updateSummary);

  // 라이선스 모달: 소비자단가/할인율/제안단가 연동
  document.getElementById('modal-license-listprice').addEventListener('input', () => {
    syncPriceFromDiscount('modal-license-listprice', 'modal-license-discount', 'modal-license-price');
  });
  document.getElementById('modal-license-discount').addEventListener('input', () => {
    syncPriceFromDiscount('modal-license-listprice', 'modal-license-discount', 'modal-license-price');
  });
  document.getElementById('modal-license-price').addEventListener('input', () => {
    syncDiscountFromPrice('modal-license-listprice', 'modal-license-discount', 'modal-license-price');
  });

  // 개발비 모달: 소비자단가/할인율/제안단가 연동
  document.getElementById('modal-service-listprice').addEventListener('input', () => {
    syncPriceFromDiscount('modal-service-listprice', 'modal-service-discount', 'modal-service-price');
  });
  document.getElementById('modal-service-discount').addEventListener('input', () => {
    syncPriceFromDiscount('modal-service-listprice', 'modal-service-discount', 'modal-service-price');
  });
  document.getElementById('modal-service-price').addEventListener('input', () => {
    syncDiscountFromPrice('modal-service-listprice', 'modal-service-discount', 'modal-service-price');
  });
  document.getElementById('btn-save-quote').addEventListener('click', saveQuote);
  document.getElementById('btn-reset').addEventListener('click', () => {
    if (confirmAction('입력한 내용을 모두 초기화할까요?')) location.reload();
  });
}

/* ---------------- 소비자단가/할인율/제안단가 연동 ---------------- */
// 소비자단가 또는 할인율이 바뀌면 제안단가 = 소비자단가 × (1 - 할인율/100)
function syncPriceFromDiscount(listPriceId, discountId, priceId) {
  const listPrice = Number(document.getElementById(listPriceId).value) || 0;
  const discount = Number(document.getElementById(discountId).value) || 0;
  const price = Math.round(listPrice * (1 - discount / 100));
  document.getElementById(priceId).value = price;
}

// 제안단가가 직접 바뀌면 할인율 = (1 - 제안단가/소비자단가) × 100 로 역산
function syncDiscountFromPrice(listPriceId, discountId, priceId) {
  const listPrice = Number(document.getElementById(listPriceId).value) || 0;
  const price = Number(document.getElementById(priceId).value) || 0;
  const discount = listPrice > 0 ? Math.max(0, (1 - price / listPrice) * 100) : 0;
  document.getElementById(discountId).value = Math.round(discount * 10) / 10;
}

/* ---------------- 01. S/W 라이선스 모달 ---------------- */
function openLicenseModal() {
  document.getElementById('modal-license-product').value = '';
  document.getElementById('modal-license-name').value = '';
  document.getElementById('modal-license-classification').value = '운영';
  document.getElementById('modal-license-desc').value = '';
  document.getElementById('modal-license-qty').value = 1;
  document.getElementById('modal-license-listprice').value = 0;
  document.getElementById('modal-license-discount').value = 0;
  document.getElementById('modal-license-price').value = 0;
  document.getElementById('modal-license-remark').value = '';
  document.getElementById('license-modal').classList.remove('hidden');
}

function closeLicenseModal() {
  document.getElementById('license-modal').classList.add('hidden');
}

function confirmAddLicense() {
  const name = document.getElementById('modal-license-name').value.trim();
  if (!name) {
    showToast('항목명을 입력해주세요.', 'error');
    return;
  }
  const qty = Number(document.getElementById('modal-license-qty').value) || 0;
  const listPrice = Number(document.getElementById('modal-license-listprice').value) || 0;
  const price = Number(document.getElementById('modal-license-price').value) || 0;

  licenseItems.push({
    id: uid('lic'),
    product_id: document.getElementById('modal-license-product').value || '',
    name,
    classification: document.getElementById('modal-license-classification').value,
    description: document.getElementById('modal-license-desc').value.trim(),
    remark: document.getElementById('modal-license-remark').value.trim(),
    quantity: qty,
    list_price: listPrice,
    list_amount: Math.round(qty * listPrice),
    unit_price: price,
    amount: Math.round(qty * price),
  });

  closeLicenseModal();
  renderLicenseTable();
  updateSummary();
}

function removeLicenseItem(itemId) {
  licenseItems = licenseItems.filter(i => i.id !== itemId);
  renderLicenseTable();
  updateSummary();
}

function updateLicenseField(itemId, field, value) {
  const item = licenseItems.find(i => i.id === itemId);
  if (!item) return;
  if (['quantity', 'list_price', 'unit_price'].includes(field)) {
    item[field] = Number(value) || 0;
  } else {
    item[field] = value;
  }
  item.list_amount = Math.round(item.quantity * item.list_price);
  item.amount = Math.round(item.quantity * item.unit_price);
  renderLicenseTable();
  updateSummary();
}

function renderLicenseTable() {
  const tbody = document.getElementById('license-body');
  const noMsg = document.getElementById('no-license-msg');

  if (!licenseItems.length) {
    tbody.innerHTML = '';
    noMsg.classList.remove('hidden');
    return;
  }
  noMsg.classList.add('hidden');

  tbody.innerHTML = licenseItems.map(item => `
    <tr>
      <td><input type="text" class="input" value="${escapeAttr(item.name)}" onchange="updateLicenseField('${item.id}','name', this.value)"></td>
      <td><textarea class="input" style="min-height:1.9rem;" rows="1" onchange="updateLicenseField('${item.id}','description', this.value)">${escapeHtml(item.description)}</textarea></td>
      <td>
        <select class="input" onchange="updateLicenseField('${item.id}','classification', this.value)">
          <option value="운영" ${item.classification === '운영' ? 'selected' : ''}>운영</option>
          <option value="개발" ${item.classification === '개발' ? 'selected' : ''}>개발</option>
        </select>
      </td>
      <td><input type="number" class="input text-right" value="${item.quantity}" min="0" onchange="updateLicenseField('${item.id}','quantity', this.value)"></td>
      <td><input type="number" class="input text-right" value="${item.list_price}" min="0" onchange="updateLicenseField('${item.id}','list_price', this.value)"></td>
      <td><input type="number" class="input text-right" value="${item.unit_price}" min="0" onchange="updateLicenseField('${item.id}','unit_price', this.value)"></td>
      <td class="font-semibold whitespace-nowrap text-right">${formatCurrency(item.amount)}</td>
      <td><input type="text" class="input" value="${escapeAttr(item.remark)}" onchange="updateLicenseField('${item.id}','remark', this.value)"></td>
      <td><button onclick="removeLicenseItem('${item.id}')" class="btn-ghost btn text-rose-500" style="padding:0.2rem 0.35rem;"><i class="fa-solid fa-trash"></i></button></td>
    </tr>
  `).join('');
}

/* ---------------- 02. 개발비(서비스) 모달 ---------------- */
function openServiceModal() {
  document.getElementById('modal-service-rate').value = '';
  document.getElementById('modal-service-name').value = '';
  document.getElementById('modal-service-desc').value = '';
  document.getElementById('modal-service-grade').value = '중급';
  document.getElementById('modal-service-qty').value = 1;
  document.getElementById('modal-service-listprice').value = 0;
  document.getElementById('modal-service-discount').value = 0;
  document.getElementById('modal-service-price').value = 0;
  document.getElementById('modal-service-remark').value = '';
  document.getElementById('service-modal').classList.remove('hidden');
}

function closeServiceModal() {
  document.getElementById('service-modal').classList.add('hidden');
}

function confirmAddService() {
  const name = document.getElementById('modal-service-name').value.trim();
  if (!name) {
    showToast('업무 활동명을 입력해주세요.', 'error');
    return;
  }
  const qty = Number(document.getElementById('modal-service-qty').value) || 0;
  const listPrice = Number(document.getElementById('modal-service-listprice').value) || 0;
  const price = Number(document.getElementById('modal-service-price').value) || 0;

  serviceItems.push({
    id: uid('svc'),
    name,
    description: document.getElementById('modal-service-desc').value.trim(),
    grade: document.getElementById('modal-service-grade').value,
    remark: document.getElementById('modal-service-remark').value.trim(),
    quantity: qty,
    list_price: listPrice,
    list_amount: Math.round(qty * listPrice),
    unit_price: price,
    amount: Math.round(qty * price),
  });

  closeServiceModal();
  renderServiceTable();
  updateSummary();
}

function removeServiceItem(itemId) {
  serviceItems = serviceItems.filter(i => i.id !== itemId);
  renderServiceTable();
  updateSummary();
}

function updateServiceField(itemId, field, value) {
  const item = serviceItems.find(i => i.id === itemId);
  if (!item) return;
  if (['quantity', 'list_price', 'unit_price'].includes(field)) {
    item[field] = Number(value) || 0;
  } else {
    item[field] = value;
  }
  item.list_amount = Math.round(item.quantity * item.list_price);
  item.amount = Math.round(item.quantity * item.unit_price);
  renderServiceTable();
  updateSummary();
}

function renderServiceTable() {
  const tbody = document.getElementById('service-body');
  const noMsg = document.getElementById('no-service-msg');

  if (!serviceItems.length) {
    tbody.innerHTML = '';
    noMsg.classList.remove('hidden');
    return;
  }
  noMsg.classList.add('hidden');

  const gradeOptions = ['특급', '고급', '중급', '초급'];

  tbody.innerHTML = serviceItems.map(item => `
    <tr>
      <td><input type="text" class="input" value="${escapeAttr(item.name)}" onchange="updateServiceField('${item.id}','name', this.value)"></td>
      <td><input type="text" class="input" value="${escapeAttr(item.description)}" onchange="updateServiceField('${item.id}','description', this.value)"></td>
      <td>
        <select class="input" onchange="updateServiceField('${item.id}','grade', this.value)">
          ${gradeOptions.map(g => `<option value="${g}" ${item.grade === g ? 'selected' : ''}>${g}</option>`).join('')}
        </select>
      </td>
      <td><input type="number" class="input text-right" value="${item.quantity}" min="0" step="0.1" onchange="updateServiceField('${item.id}','quantity', this.value)"></td>
      <td><input type="number" class="input text-right" value="${item.list_price}" min="0" onchange="updateServiceField('${item.id}','list_price', this.value)"></td>
      <td><input type="number" class="input text-right" value="${item.unit_price}" min="0" onchange="updateServiceField('${item.id}','unit_price', this.value)"></td>
      <td class="font-semibold whitespace-nowrap text-right">${formatCurrency(item.amount)}</td>
      <td><input type="text" class="input" value="${escapeAttr(item.remark)}" onchange="updateServiceField('${item.id}','remark', this.value)"></td>
      <td><button onclick="removeServiceItem('${item.id}')" class="btn-ghost btn text-rose-500" style="padding:0.2rem 0.35rem;"><i class="fa-solid fa-trash"></i></button></td>
    </tr>
  `).join('');
}

/* ---------------- 03. 기타 품목 ----------------
   S/W 라이선스(products)나 개발비(labor_rates)처럼 미리 등록된 카탈로그가
   없는 하드웨어/3rd-party S/W/외주/기타 품목을 견적서 발급 시 필요할 때마다
   바로 추가하는 섹션입니다. 별도 DB 테이블/관리 화면 없이 구성됩니다.

   "구분"(하드웨어/3rd-party S/W/외주/기타)은 표의 컬럼이 아니라 01·02와 같은
   레벨의 "표 단위" 구분입니다. 상단 select에서 유형을 선택하면 그 유형만을
   위한 표가 새로 생성되고("이미 추가된 유형은 select에서 제외"), 표 안에서는
   "항목 추가" 버튼으로 행을 계속 추가해 값을 입력/수정합니다. */

function renderMiscCategorySelect() {
  const sel = document.getElementById('misc-category-select');
  const usedSet = new Set(miscCategories.map(c => c.classification));
  const remaining = MISC_CLASSIFICATION_OPTIONS.filter(o => !usedSet.has(o));
  sel.innerHTML = `<option value="">+ 품목 유형 선택</option>` +
    remaining.map(o => `<option value="${o}">${o}</option>`).join('');
  sel.disabled = remaining.length === 0;
}

function addMiscCategory(classification) {
  if (miscCategories.some(c => c.classification === classification)) return;
  miscCategories.push({ classification, items: [] });
  addMiscItem(classification); // 표 생성 시 바로 입력 가능한 첫 행을 함께 추가
  renderMiscCategorySelect();
  renderMiscCategories();
  updateSummary();
}

function removeMiscCategory(classification) {
  if (!confirmAction(`"${classification}" 표를 삭제할까요? 입력된 항목도 함께 삭제됩니다.`)) return;
  miscCategories = miscCategories.filter(c => c.classification !== classification);
  renderMiscCategorySelect();
  renderMiscCategories();
  updateSummary();
}

function addMiscItem(classification) {
  const cat = miscCategories.find(c => c.classification === classification);
  if (!cat) return;
  cat.items.push({
    id: uid('misc'),
    name: '',
    description: '',
    remark: '',
    quantity: 1,
    list_price: 0,
    list_amount: 0,
    unit_price: 0,
    amount: 0,
  });
  renderMiscCategories();
  updateSummary();
}

function removeMiscItem(classification, itemId) {
  const cat = miscCategories.find(c => c.classification === classification);
  if (!cat) return;
  cat.items = cat.items.filter(i => i.id !== itemId);
  renderMiscCategories();
  updateSummary();
}

function updateMiscField(classification, itemId, field, value) {
  const cat = miscCategories.find(c => c.classification === classification);
  if (!cat) return;
  const item = cat.items.find(i => i.id === itemId);
  if (!item) return;
  if (['quantity', 'list_price', 'unit_price'].includes(field)) {
    item[field] = Number(value) || 0;
  } else {
    item[field] = value;
  }
  item.list_amount = Math.round(item.quantity * item.list_price);
  item.amount = Math.round(item.quantity * item.unit_price);
  renderMiscCategories();
  updateSummary();
}

function getAllMiscItems() {
  return miscCategories.flatMap(c => c.items.map(item => ({ ...item, classification: c.classification })));
}

function renderMiscCategories() {
  const wrap = document.getElementById('misc-categories-wrap');
  const noMsg = document.getElementById('no-misc-msg');

  if (!miscCategories.length) {
    wrap.innerHTML = '';
    noMsg.classList.remove('hidden');
    return;
  }
  noMsg.classList.add('hidden');

  wrap.innerHTML = miscCategories.map(cat => {
    const rows = cat.items.map(item => `
      <tr>
        <td><input type="text" class="input" value="${escapeAttr(item.name)}" placeholder="예: 문서 스캐너" onchange="updateMiscField('${cat.classification}','${item.id}','name', this.value)"></td>
        <td><textarea class="input" style="min-height:1.9rem;" rows="1" placeholder="설명" onchange="updateMiscField('${cat.classification}','${item.id}','description', this.value)">${escapeHtml(item.description)}</textarea></td>
        <td><input type="number" class="input text-right" value="${item.quantity}" min="0" onchange="updateMiscField('${cat.classification}','${item.id}','quantity', this.value)"></td>
        <td><input type="number" class="input text-right" value="${item.list_price}" min="0" onchange="updateMiscField('${cat.classification}','${item.id}','list_price', this.value)"></td>
        <td><input type="number" class="input text-right" value="${item.unit_price}" min="0" onchange="updateMiscField('${cat.classification}','${item.id}','unit_price', this.value)"></td>
        <td class="font-semibold whitespace-nowrap text-right">${formatCurrency(item.amount)}</td>
        <td><input type="text" class="input" value="${escapeAttr(item.remark)}" onchange="updateMiscField('${cat.classification}','${item.id}','remark', this.value)"></td>
        <td><button onclick="removeMiscItem('${cat.classification}','${item.id}')" class="btn-ghost btn text-rose-500" style="padding:0.2rem 0.35rem;"><i class="fa-solid fa-trash"></i></button></td>
      </tr>
    `).join('');

    const catSubtotal = cat.items.reduce((sum, i) => sum + i.amount, 0);

    return `
      <div class="border border-slate-200 rounded-xl p-4">
        <div class="flex items-center justify-between mb-3">
          <h3 class="font-semibold text-slate-700 flex items-center gap-2">
            <span class="inline-flex items-center justify-center text-[11px] font-bold text-indigo-600 bg-indigo-50 rounded px-2 py-0.5">기타 품목</span>
            ${cat.classification}
          </h3>
          <div class="flex items-center gap-2">
            <button onclick="addMiscItem('${cat.classification}')" class="btn btn-secondary text-xs py-1.5"><i class="fa-solid fa-plus"></i> 항목 추가</button>
            <button onclick="removeMiscCategory('${cat.classification}')" class="btn-ghost btn text-rose-500 text-xs" style="padding:0.3rem 0.5rem;"><i class="fa-solid fa-trash"></i> 표 삭제</button>
          </div>
        </div>
        <div class="table-wrap">
          <table class="data-table compact-table">
            <thead>
              <tr>
                <th style="width:17%">항목</th>
                <th style="width:23%">설명</th>
                <th style="width:6%" class="text-right">수량</th>
                <th style="width:11%" class="text-right">소비자단가</th>
                <th style="width:11%" class="text-right">제안단가</th>
                <th style="width:11%" class="text-right">제안금액</th>
                <th style="width:15%">비고</th>
                <th style="width:4%"></th>
              </tr>
            </thead>
            <tbody>${rows || `<tr><td colspan="8" class="text-center text-slate-400 text-sm py-4">항목을 추가해주세요.</td></tr>`}</tbody>
          </table>
        </div>
        <div class="flex justify-end mt-2">
          <span class="text-xs text-slate-500">${cat.classification} 소계: <span class="font-semibold text-slate-700">${formatCurrency(catSubtotal)}</span></span>
        </div>
      </div>
    `;
  }).join('');
}

function escapeAttr(str) {
  return (str || '').replace(/"/g, '&quot;');
}
function escapeHtml(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* ---------------- 요약 계산 ---------------- */
function updateSummary() {
  const licenseSubtotal = licenseItems.reduce((sum, i) => sum + i.amount, 0);
  const licenseListSubtotal = licenseItems.reduce((sum, i) => sum + i.list_amount, 0);
  const serviceSubtotal = serviceItems.reduce((sum, i) => sum + i.amount, 0);
  const miscSubtotal = getAllMiscItems().reduce((sum, i) => sum + i.amount, 0);
  const subtotal = licenseSubtotal + serviceSubtotal + miscSubtotal;
  const taxRate = Number(document.getElementById('tax-rate').value) || 0;
  const taxAmount = Math.round(subtotal * (taxRate / 100));
  const total = subtotal + taxAmount;

  // S/W 할인율 = (소비자금액 합계 대비 제안금액 합계의 할인 비율)
  const discountRate = licenseListSubtotal > 0
    ? Math.max(0, (1 - licenseSubtotal / licenseListSubtotal) * 100)
    : 0;

  document.getElementById('license-subtotal-view').textContent = formatCurrency(licenseSubtotal);
  document.getElementById('service-subtotal-view').textContent = formatCurrency(serviceSubtotal);
  document.getElementById('misc-subtotal-view').textContent = formatCurrency(miscSubtotal);
  document.getElementById('summary-license').textContent = formatCurrency(licenseSubtotal);
  document.getElementById('summary-service').textContent = formatCurrency(serviceSubtotal);
  document.getElementById('summary-misc').textContent = formatCurrency(miscSubtotal);
  document.getElementById('summary-discount-rate').textContent = `${discountRate.toFixed(1)}%`;
  document.getElementById('summary-subtotal').textContent = formatCurrency(subtotal);
  document.getElementById('summary-tax').textContent = formatCurrency(taxAmount);
  document.getElementById('summary-total').textContent = formatCurrency(total);

  return { licenseSubtotal, serviceSubtotal, miscSubtotal, subtotal, taxRate, taxAmount, total };
}

/* ---------------- 저장 ---------------- */
async function saveQuote() {
  const quoteTitle = document.getElementById('quote-title').value.trim();
  const customerName = document.getElementById('customer-name').value.trim();
  const repName = document.getElementById('rep-name').value.trim();

  if (!quoteTitle) {
    showToast('견적명(프로젝트명)을 입력해주세요.', 'error');
    return;
  }
  if (!customerName) {
    showToast('회사명을 입력해주세요.', 'error');
    return;
  }
  if (!repName) {
    showToast('견적담당(영업대표) 이름을 입력해주세요.', 'error');
    return;
  }
  const miscItemsFlat = getAllMiscItems();
  if (!licenseItems.length && !serviceItems.length && !miscItemsFlat.length) {
    showToast('S/W 라이선스, 개발비 또는 기타 품목을 1개 이상 추가해주세요.', 'error');
    return;
  }
  if (miscItemsFlat.some(i => !i.name.trim())) {
    showToast('03. 기타 품목의 항목명을 모두 입력해주세요.', 'error');
    return;
  }

  const btn = document.getElementById('btn-save-quote');
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner" style="width:1rem;height:1rem;border-width:2px;"></div> 저장 중...';

  try {
    const { licenseSubtotal, serviceSubtotal, miscSubtotal, subtotal, taxRate, taxAmount, total } = updateSummary();
    const quoteNumber = await generateQuoteNumber();

    const quotePayload = {
      quote_number: quoteNumber,
      quote_title: quoteTitle,
      reference: document.getElementById('quote-reference').value.trim(),
      customer_id: document.getElementById('customer-select').value || '',
      customer_name: customerName,
      customer_contact: document.getElementById('customer-contact').value.trim(),
      customer_email: document.getElementById('customer-email').value.trim(),
      customer_phone: document.getElementById('customer-phone').value.trim(),
      customer_address: document.getElementById('customer-address').value.trim(),
      sales_rep_name: repName,
      sales_rep_email: document.getElementById('rep-email').value.trim(),
      sales_rep_phone: document.getElementById('rep-phone').value.trim(),
      issue_date: document.getElementById('issue-date').value,
      valid_until: document.getElementById('valid-until').value,
      status: '발송전', // 발급 상태는 발급 시점에 지정하지 않고 기본값으로 저장, 이후 견적 이력 관리에서 변경
      tax_rate: taxRate,
      license_subtotal: licenseSubtotal,
      service_subtotal: serviceSubtotal,
      misc_subtotal: miscSubtotal,
      subtotal, tax_amount: taxAmount, total,
      payment_terms: document.getElementById('payment-terms').value.trim(),
      notes: document.getElementById('notes').value.trim(),
      internal_memo: document.getElementById('internal-memo').value.trim(),
    };

    const created = await apiCreate('quotes', quotePayload);

    const licensePayloads = licenseItems.map((item, idx) => apiCreate('quote_items', {
      quote_id: created.id,
      item_type: '제품(S/W라이선스)',
      name: item.name,
      classification: item.classification,
      description: item.description,
      remark: item.remark,
      quantity: item.quantity,
      list_price: item.list_price,
      list_amount: item.list_amount,
      unit_price: item.unit_price,
      amount: item.amount,
      sort_order: idx + 1
    }));

    const servicePayloads = serviceItems.map((item, idx) => apiCreate('quote_items', {
      quote_id: created.id,
      item_type: '서비스(개발/구축)',
      name: item.name,
      grade: item.grade,
      description: item.description,
      remark: item.remark,
      quantity: item.quantity,
      list_price: item.list_price,
      list_amount: item.list_amount,
      unit_price: item.unit_price,
      amount: item.amount,
      sort_order: idx + 1
    }));

    const miscPayloads = miscItemsFlat.map((item, idx) => apiCreate('quote_items', {
      quote_id: created.id,
      item_type: '기타(HW/3rd-party 등)',
      name: item.name,
      classification: item.classification,
      description: item.description,
      remark: item.remark,
      quantity: item.quantity,
      list_price: item.list_price,
      list_amount: item.list_amount,
      unit_price: item.unit_price,
      amount: item.amount,
      sort_order: idx + 1
    }));

    await Promise.all([...licensePayloads, ...servicePayloads, ...miscPayloads]);

    notifySlackQuoteIssued(created);

    showToast('견적서가 성공적으로 발급되었습니다.', 'success');
    setTimeout(() => { location.href = `quote-detail.html?id=${created.id}`; }, 700);
  } catch (e) {
    console.error(e);
    showToast('저장 중 오류가 발생했습니다.', 'error');
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> 견적서 발급 및 저장';
  }
}

document.addEventListener('DOMContentLoaded', initQuoteNewPage);

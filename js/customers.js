/* ============================================================
   고객사 관리 페이지 로직
   ============================================================ */

let allCustomers = [];
let quoteCountByCustomer = {};

async function initCustomersPage() {
  document.getElementById('btn-new-customer').addEventListener('click', () => openCustomerModal());
  document.getElementById('search-input').addEventListener('input', applyCustomerFilter);
  document.getElementById('btn-bulk-customer').addEventListener('click', openBulkModal);
  bindBulkModalEvents();
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
  if (!(await confirmAction('이 고객사를 삭제할까요?'))) return;
  try {
    await apiDelete('customers', id);
    showToast('고객사가 삭제되었습니다.', 'success');
    await loadCustomers();
  } catch (e) {
    console.error(e);
    showToast('삭제 중 오류가 발생했습니다.', 'error');
  }
}

/* ============================================================
   고객사 일괄 등록 (엑셀 업로드 / 복사-붙여넣기)
   ============================================================ */

const BULK_FIELDS = ['company_name', 'business_number', 'industry', 'contact_name', 'contact_position', 'phone', 'email', 'address', 'notes'];
const BULK_HEADERS = ['회사명', '사업자등록번호', '업종', '담당자명', '담당자직급', '연락처', '이메일', '주소', '비고'];

let bulkRows = [];

function bindBulkModalEvents() {
  document.getElementById('bulk-mode-toggle').addEventListener('click', (e) => {
    const btn = e.target.closest('.filter-toggle-btn');
    if (!btn) return;
    document.querySelectorAll('#bulk-mode-toggle .filter-toggle-btn').forEach(b => b.classList.toggle('active', b === btn));
    const mode = btn.dataset.mode;
    document.getElementById('bulk-excel-panel').classList.toggle('hidden', mode !== 'excel');
    document.getElementById('bulk-paste-panel').classList.toggle('hidden', mode !== 'paste');
  });

  document.getElementById('bulk-file-input').addEventListener('change', handleBulkFileChange);
  document.getElementById('btn-apply-paste').addEventListener('click', applyPastedText);
  document.getElementById('btn-download-template').addEventListener('click', downloadCustomerTemplate);
}

function openBulkModal() {
  bulkRows = [];
  document.getElementById('bulk-file-input').value = '';
  document.getElementById('bulk-paste-area').value = '';
  document.querySelectorAll('#bulk-mode-toggle .filter-toggle-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === 'excel'));
  document.getElementById('bulk-excel-panel').classList.remove('hidden');
  document.getElementById('bulk-paste-panel').classList.add('hidden');
  renderBulkPreview();
  document.getElementById('bulk-customer-modal').classList.remove('hidden');
}

function closeBulkModal() {
  document.getElementById('bulk-customer-modal').classList.add('hidden');
}

/* ---------------- 파싱 ---------------- */
function matrixRowToCustomer(cells) {
  const obj = {};
  BULK_FIELDS.forEach((f, i) => { obj[f] = (cells[i] || '').toString().trim(); });
  return obj;
}

// 첫 행이 템플릿 제목 행("회사명"으로 시작)이면 건너뛰고, 완전히 빈 행은 제외합니다.
function parseBulkMatrix(matrix) {
  let rows = matrix.filter(r => r.some(c => (c || '').toString().trim() !== ''));
  if (rows.length && (rows[0][0] || '').toString().trim() === BULK_HEADERS[0]) {
    rows = rows.slice(1);
  }
  return rows.map(matrixRowToCustomer);
}

function parsePastedText(text) {
  return text.split(/\r\n|\r|\n/)
    .filter(line => line.trim() !== '')
    .map(line => line.split('\t').map(c => c.trim()));
}

function excelCellToString(v) {
  if (v == null) return '';
  if (v instanceof Date) return formatDate(v);
  if (typeof v === 'object') {
    if (Array.isArray(v.richText)) return v.richText.map(t => t.text).join('');
    if ('result' in v) return excelCellToString(v.result);
    if ('text' in v) return String(v.text);
    return '';
  }
  return String(v).trim();
}

async function parseExcelFile(file) {
  const buf = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buf);
  const ws = workbook.worksheets[0];
  if (!ws) return [];
  const matrix = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    const cells = [];
    for (let i = 1; i <= BULK_FIELDS.length; i++) {
      cells.push(excelCellToString(row.getCell(i).value));
    }
    matrix.push(cells);
  });
  return matrix;
}

async function handleBulkFileChange(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (typeof ExcelJS === 'undefined') {
    showToast('엑셀 라이브러리를 불러오지 못했습니다. 새로고침 후 다시 시도해주세요.', 'error');
    return;
  }
  try {
    const matrix = await parseExcelFile(file);
    const rows = parseBulkMatrix(matrix);
    if (!rows.length) {
      showToast('파일에서 데이터를 찾지 못했습니다. 템플릿 형식을 확인해주세요.', 'error');
      return;
    }
    setBulkRows(rows);
    showToast(`${rows.length}행을 불러왔습니다. 등록 전 내용을 확인해주세요.`, 'success');
  } catch (err) {
    console.error(err);
    showToast('엑셀 파일을 읽는 중 오류가 발생했습니다.', 'error');
  } finally {
    e.target.value = '';
  }
}

function applyPastedText() {
  const text = document.getElementById('bulk-paste-area').value;
  if (!text.trim()) {
    showToast('붙여넣을 데이터를 입력해주세요.', 'error');
    return;
  }
  const rows = parseBulkMatrix(parsePastedText(text));
  if (!rows.length) {
    showToast('붙여넣은 내용에서 데이터를 찾지 못했습니다.', 'error');
    return;
  }
  setBulkRows(rows);
  showToast(`${rows.length}행을 불러왔습니다. 등록 전 내용을 확인해주세요.`, 'success');
}

/* ---------------- 미리보기/편집 ---------------- */
function setBulkRows(customers) {
  bulkRows = customers.map(c => ({ _id: uid('bulkrow'), ...c }));
  renderBulkPreview();
}

function updateBulkField(id, field, value) {
  const row = bulkRows.find(r => r._id === id);
  if (!row) return;
  row[field] = value;
  renderBulkPreview();
}

function removeBulkRow(id) {
  bulkRows = bulkRows.filter(r => r._id !== id);
  renderBulkPreview();
}

function renderBulkPreview() {
  const wrap = document.getElementById('bulk-preview-wrap');
  const empty = document.getElementById('bulk-preview-empty');
  const countLabel = document.getElementById('bulk-preview-count');
  const summary = document.getElementById('bulk-summary-text');
  const confirmBtn = document.getElementById('btn-confirm-bulk');

  if (!bulkRows.length) {
    wrap.classList.add('hidden');
    empty.classList.remove('hidden');
    countLabel.textContent = '';
    summary.textContent = '';
    confirmBtn.disabled = true;
    confirmBtn.textContent = '일괄 등록';
    return;
  }

  empty.classList.add('hidden');
  wrap.classList.remove('hidden');

  const validCount = bulkRows.filter(r => r.company_name.trim()).length;
  const invalidCount = bulkRows.length - validCount;
  countLabel.textContent = `(${bulkRows.length}행 · 유효 ${validCount}건${invalidCount ? ` · 회사명 누락 ${invalidCount}건` : ''})`;
  summary.textContent = invalidCount ? '회사명이 비어 있는 행(붉은 배경)은 등록 시 자동으로 제외됩니다.' : '';
  confirmBtn.disabled = validCount === 0;
  confirmBtn.textContent = `${validCount}건 일괄 등록`;

  document.getElementById('bulk-preview-body').innerHTML = bulkRows.map(row => {
    const invalid = !row.company_name.trim();
    const fieldCell = (field, placeholder = '') => `<td><input type="text" class="input" value="${escapeAttr(row[field])}" placeholder="${placeholder}" onchange="updateBulkField('${row._id}','${field}', this.value)"></td>`;
    return `
    <tr class="${invalid ? 'bg-rose-50' : ''}">
      ${fieldCell('company_name', '필수')}
      ${fieldCell('business_number')}
      ${fieldCell('industry')}
      ${fieldCell('contact_name')}
      ${fieldCell('contact_position')}
      ${fieldCell('phone')}
      ${fieldCell('email')}
      ${fieldCell('address')}
      ${fieldCell('notes')}
      <td><button onclick="removeBulkRow('${row._id}')" class="btn-ghost btn text-rose-500" style="padding:0.2rem 0.35rem;"><i class="fa-solid fa-trash"></i></button></td>
    </tr>`;
  }).join('');
}

/* ---------------- 등록 실행 ---------------- */
async function confirmBulkImport() {
  const validRows = bulkRows.filter(r => r.company_name.trim());
  if (!validRows.length) {
    showToast('등록할 유효한 행이 없습니다. 회사명을 입력해주세요.', 'error');
    return;
  }

  const btn = document.getElementById('btn-confirm-bulk');
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner" style="width:1rem;height:1rem;border-width:2px;display:inline-block;"></div> 등록 중...';

  try {
    const results = await Promise.allSettled(validRows.map(r => apiCreate('customers', {
      company_name: r.company_name.trim(),
      business_number: r.business_number.trim(),
      industry: r.industry.trim(),
      contact_name: r.contact_name.trim(),
      contact_position: r.contact_position.trim(),
      phone: r.phone.trim(),
      email: r.email.trim(),
      address: r.address.trim(),
      notes: r.notes.trim(),
    })));
    const succeeded = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.length - succeeded;

    if (succeeded > 0) {
      showToast(`${succeeded}건의 고객사가 등록되었습니다.${failed ? ` (${failed}건 실패, 실패한 항목은 다시 시도해주세요)` : ''}`, failed ? 'info' : 'success');
      closeBulkModal();
      await loadCustomers();
    } else {
      showToast('일괄 등록 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.', 'error');
    }
  } catch (err) {
    console.error(err);
    showToast('일괄 등록 중 오류가 발생했습니다.', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

/* ---------------- 템플릿 다운로드 ---------------- */
async function downloadCustomerTemplate() {
  if (typeof ExcelJS === 'undefined') {
    showToast('엑셀 라이브러리를 불러오지 못했습니다. 새로고침 후 다시 시도해주세요.', 'error');
    return;
  }

  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('고객사');
  ws.columns = BULK_HEADERS.map((h, i) => ({ header: h, key: BULK_FIELDS[i], width: i === 0 || i === 7 ? 24 : 16 }));
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF2FF' } };
  ws.addRow({
    company_name: '㈜예시회사', business_number: '000-00-00000', industry: '물류',
    contact_name: '홍길동', contact_position: '과장', phone: '02-0000-0000',
    email: 'example@company.com', address: '서울시 강남구 테헤란로 123', notes: ''
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = '고객사_일괄등록_템플릿.xlsx';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function escapeAttr(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

document.addEventListener('DOMContentLoaded', initCustomersPage);

/* ============================================================
   견적서 상세/인쇄 페이지 로직
   - "01. S/W 라이선스" / "02. 개발비" 섹션 분리 양식
   ============================================================ */

let currentQuote = null;
let currentItems = [];
let allQuotesCache = [];

/* 회사 고정 정보 (사업자등록증 기준) */
const COMPANY_INFO = {
  business_number: '754-87-00942',
  company_name: '주식회사 로민',
  ceo_name: '강지홍 (직인생략)',
  address: '서울시 서초구 사임당로 32 (재우빌딩) 5층',
  phone: '02-6331-1853',
};

function getQuoteIdFromUrl() {
  return new URLSearchParams(window.location.search).get('id');
}

async function initQuoteDetailPage() {
  const id = getQuoteIdFromUrl();
  if (!id) {
    document.getElementById('quote-content').innerHTML = `<div class="text-center text-slate-400 py-20">견적서 ID가 없습니다. <a href="quotes.html" class="text-indigo-600 underline">목록으로 이동</a></div>`;
    return;
  }

  try {
    const [quote, itemsRes, quotesRes] = await Promise.all([
      apiGet('quotes', id),
      apiList('quote_items', { search: '' }),
      apiList('quotes')
    ]);
    currentQuote = quote;
    const items = (itemsRes.data || [])
      .filter(i => i.quote_id === id)
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    currentItems = items;
    allQuotesCache = quotesRes.data || [];

    document.getElementById('page-subtitle').textContent = `${quote.quote_number} · ${quote.customer_name}`;
    document.getElementById('status-select').value = quote.status || '발송전';
    renderQuoteDocument(quote, items);
    renderVersionHistory(quote);
    updateDeleteButtonState();
    bindDetailEvents(id);
  } catch (e) {
    console.error(e);
    document.getElementById('quote-content').innerHTML = `<div class="text-center text-rose-400 py-20">견적서를 불러오지 못했습니다.</div>`;
  }
}

// 계약된 견적서는 삭제할 수 없도록 버튼을 비활성화합니다(계약 후 상태 변경으로
// 즉시 반영되도록 status-select change 핸들러에서도 함께 호출).
function updateDeleteButtonState() {
  const btn = document.getElementById('btn-delete');
  const isContracted = currentQuote && currentQuote.status === '계약됨';
  btn.disabled = isContracted;
  btn.title = isContracted ? '계약된 견적서는 삭제할 수 없습니다.' : '';
}

function bindDetailEvents(id) {
  document.getElementById('status-select').addEventListener('change', async (e) => {
    try {
      await apiUpdate('quotes', id, { status: e.target.value });
      if (currentQuote) currentQuote.status = e.target.value;
      updateDeleteButtonState();
      showToast('상태가 변경되었습니다.', 'success');
    } catch (err) {
      console.error(err);
      showToast('상태 변경 중 오류가 발생했습니다.', 'error');
    }
  });

  document.getElementById('btn-revise').addEventListener('click', () => {
    location.href = `quote-new.html?reviseFrom=${id}`;
  });

  document.getElementById('btn-print').addEventListener('click', () => window.print());

  document.getElementById('btn-excel').addEventListener('click', async () => {
    const btn = document.getElementById('btn-excel');
    const originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner" style="width:0.9rem;height:0.9rem;border-width:2px;"></div> 생성 중...';
    try {
      await exportQuoteToExcel(currentQuote, currentItems);
    } catch (err) {
      console.error(err);
      showToast('엑셀 파일 생성 중 오류가 발생했습니다.', 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalHtml;
    }
  });

  document.getElementById('btn-delete').addEventListener('click', async () => {
    if (currentQuote && currentQuote.status === '계약됨') {
      showToast('계약된 견적서는 삭제할 수 없습니다.', 'error');
      return;
    }
    if (!(await confirmAction('이 견적서를 삭제할까요? 삭제 후 되돌릴 수 없습니다.'))) return;
    try {
      await apiDelete('quotes', id);
      showToast('견적서가 삭제되었습니다.', 'success');
      setTimeout(() => { location.href = 'quotes.html'; }, 500);
    } catch (err) {
      console.error(err);
      showToast('삭제 중 오류가 발생했습니다.', 'error');
    }
  });
}

function nl2br(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
}

/* 01. S/W 라이선스 섹션 렌더 */
function renderLicenseSection(items, taxRate) {
  if (!items.length) return '';

  const rows = items.map(item => `
    <tr>
      <td class="border border-slate-300 font-semibold text-slate-800 bg-amber-50" style="vertical-align:top;">${item.name || '-'}</td>
      <td class="border border-slate-300" style="vertical-align:top;">
        <p class="text-[11px] text-slate-600 whitespace-pre-line leading-relaxed">${nl2br(item.description)}</p>
      </td>
      <td class="border border-slate-300 text-center">${item.classification || '-'}</td>
      <td class="border border-slate-300 text-center whitespace-nowrap">${formatNumber(item.quantity)}</td>
      <td class="border border-slate-300 text-right whitespace-nowrap">${item.list_price ? formatCurrency(item.list_price) : '-'}</td>
      <td class="border border-slate-300 text-right whitespace-nowrap">${item.list_amount ? formatCurrency(item.list_amount) : '-'}</td>
      <td class="border border-slate-300 text-right whitespace-nowrap">${item.unit_price ? formatCurrency(item.unit_price) : '-'}</td>
      <td class="border border-slate-300 text-right font-semibold whitespace-nowrap">${item.amount ? formatCurrency(item.amount) : '-'}</td>
      <td class="border border-slate-300 text-center" style="vertical-align:top;">${item.remark || '-'}</td>
    </tr>
  `).join('');

  const subtotal = items.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
  const withTax = Math.round(subtotal * (1 + (taxRate || 0) / 100));

  return `
  <div class="mb-8">
    <h3 class="text-lg font-extrabold text-slate-800 mb-3">01. S/W 라이선스</h3>
    <div class="table-wrap">
      <table class="w-full text-[13px] border border-slate-300" style="border-collapse:collapse;">
        <thead>
          <tr class="bg-sky-50 text-slate-600">
            <th class="border border-slate-300 py-1 px-1.5 text-center" style="width:12%;">항 목</th>
            <th class="border border-slate-300 py-1 px-1.5 text-center" style="width:28%;">설명</th>
            <th class="border border-slate-300 py-1 px-1.5 text-center" style="width:6%;">구분</th>
            <th class="border border-slate-300 py-1 px-1.5 text-center" style="width:5%;">수량<br>(Q)</th>
            <th class="border border-slate-300 py-1 px-1.5 text-center" style="width:10%;">소비자단가<br>(LP)</th>
            <th class="border border-slate-300 py-1 px-1.5 text-center" style="width:10%;">소비자금액<br>(Q*LP)</th>
            <th class="border border-slate-300 py-1 px-1.5 text-center" style="width:10%;">제안단가<br>(P)</th>
            <th class="border border-slate-300 py-1 px-1.5 text-center" style="width:10%;">제안금액<br>(Q*P)</th>
            <th class="border border-slate-300 py-1 px-1.5 text-center" style="width:9%;">비고</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
        <tfoot>
          <tr class="bg-emerald-50">
            <td colspan="7" class="border border-slate-300 py-1 px-2 text-right font-semibold">S/W 제안 금액 (VAT 제외)</td>
            <td colspan="2" class="border border-slate-300 py-1 px-2 text-right font-bold whitespace-nowrap">${formatCurrency(subtotal)}</td>
          </tr>
          <tr class="bg-emerald-50">
            <td colspan="7" class="border border-slate-300 py-1 px-2 text-right font-semibold">S/W 제안 금액 (VAT 포함)</td>
            <td colspan="2" class="border border-slate-300 py-1 px-2 text-right font-bold whitespace-nowrap">${formatCurrency(withTax)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  </div>`;
}

/* 02. 개발비 섹션 렌더 */
function renderServiceSection(items, taxRate) {
  if (!items.length) return '';

  const rows = items.map(item => `
    <tr>
      <td class="border border-slate-300 font-semibold text-slate-800" style="vertical-align:top;">${item.name || '-'}</td>
      <td class="border border-slate-300" style="vertical-align:top;">
        <p class="text-[11px] text-slate-600 whitespace-pre-line leading-relaxed">${nl2br(item.description)}</p>
      </td>
      <td class="border border-slate-300 text-center">${item.grade || '-'}</td>
      <td class="border border-slate-300 text-center whitespace-nowrap">${Number(item.quantity || 0).toFixed(2)}</td>
      <td class="border border-slate-300 text-right whitespace-nowrap">${item.list_price ? formatCurrency(item.list_price) : '-'}</td>
      <td class="border border-slate-300 text-right whitespace-nowrap">${item.list_amount ? formatCurrency(item.list_amount) : '-'}</td>
      <td class="border border-slate-300 text-right whitespace-nowrap">${item.unit_price ? formatCurrency(item.unit_price) : '-'}</td>
      <td class="border border-slate-300 text-right font-semibold whitespace-nowrap">${item.amount ? formatCurrency(item.amount) : '-'}</td>
      <td class="border border-slate-300 text-center" style="vertical-align:top;">${item.remark || '-'}</td>
    </tr>
  `).join('');

  const subtotal = items.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
  const withTax = Math.round(subtotal * (1 + (taxRate || 0) / 100));

  return `
  <div class="mb-8">
    <h3 class="text-lg font-extrabold text-slate-800 mb-3">02. 개발비</h3>
    <div class="table-wrap">
      <table class="w-full text-[13px] border border-slate-300" style="border-collapse:collapse;">
        <thead>
          <tr class="bg-sky-50 text-slate-600">
            <th class="border border-slate-300 py-1 px-1.5 text-center" style="width:13%;">업무 활동</th>
            <th class="border border-slate-300 py-1 px-1.5 text-center">설명</th>
            <th class="border border-slate-300 py-1 px-1.5 text-center" style="width:7%;">등급</th>
            <th class="border border-slate-300 py-1 px-1.5 text-center" style="width:8%;">수량<br>(M/M)(Q)</th>
            <th class="border border-slate-300 py-1 px-1.5 text-center" style="width:11%;">소비자단가<br>(LP)</th>
            <th class="border border-slate-300 py-1 px-1.5 text-center" style="width:11%;">소비자금액<br>(MM*LP)</th>
            <th class="border border-slate-300 py-1 px-1.5 text-center" style="width:11%;">제안단가<br>(P)</th>
            <th class="border border-slate-300 py-1 px-1.5 text-center" style="width:12%;">제안금액<br>(Q*P)</th>
            <th class="border border-slate-300 py-1 px-1.5 text-center" style="width:10%;">비고</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
        <tfoot>
          <tr class="bg-emerald-50">
            <td colspan="7" class="border border-slate-300 py-1 px-2 text-right font-semibold">개발비 제안금액 (VAT 제외)</td>
            <td colspan="2" class="border border-slate-300 py-1 px-2 text-right font-bold whitespace-nowrap">${formatCurrency(subtotal)}</td>
          </tr>
          <tr class="bg-emerald-50">
            <td colspan="7" class="border border-slate-300 py-1 px-2 text-right font-semibold">개발비 제안금액 (VAT 포함)</td>
            <td colspan="2" class="border border-slate-300 py-1 px-2 text-right font-bold whitespace-nowrap">${formatCurrency(withTax)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  </div>`;
}

/* 03. 하드웨어 / 04. 기타 섹션 렌더
   두 섹션 모두 01. S/W 라이선스와 동일한 9컬럼(항목/설명/구분/수량/소비자단가/
   제안단가/제안금액/비고) 구조를 사용하는 고정 섹션입니다. 분류(classification)
   선택에 따라 표가 동적으로 늘어나던 이전 방식과 달리, item_type
   ('하드웨어' / '기타')으로 필터링된 항목을 각각 하나의 표에 그대로 렌더링합니다. */
function renderFixedItemSection(title, items, taxRate, nameBgClass) {
  if (!items.length) return '';

  const rows = items.map(item => `
    <tr>
      <td class="border border-slate-300 font-semibold text-slate-800 ${nameBgClass}" style="vertical-align:top;">${item.name || '-'}</td>
      <td class="border border-slate-300" style="vertical-align:top;">
        <p class="text-[11px] text-slate-600 whitespace-pre-line leading-relaxed">${nl2br(item.description)}</p>
      </td>
      <td class="border border-slate-300 text-center">${item.classification || '-'}</td>
      <td class="border border-slate-300 text-center whitespace-nowrap">${formatNumber(item.quantity)}</td>
      <td class="border border-slate-300 text-right whitespace-nowrap">${item.list_price ? formatCurrency(item.list_price) : '-'}</td>
      <td class="border border-slate-300 text-right whitespace-nowrap">${item.list_amount ? formatCurrency(item.list_amount) : '-'}</td>
      <td class="border border-slate-300 text-right whitespace-nowrap">${item.unit_price ? formatCurrency(item.unit_price) : '-'}</td>
      <td class="border border-slate-300 text-right font-semibold whitespace-nowrap">${item.amount ? formatCurrency(item.amount) : '-'}</td>
      <td class="border border-slate-300 text-center" style="vertical-align:top;">${item.remark || '-'}</td>
    </tr>
  `).join('');

  const subtotal = items.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
  const withTax = Math.round(subtotal * (1 + (taxRate || 0) / 100));

  return `
  <div class="mb-8">
    <h3 class="text-lg font-extrabold text-slate-800 mb-3">${title}</h3>
    <div class="table-wrap">
      <table class="w-full text-[13px] border border-slate-300" style="border-collapse:collapse;">
        <thead>
          <tr class="bg-sky-50 text-slate-600">
            <th class="border border-slate-300 py-1 px-1.5 text-center" style="width:12%;">항 목</th>
            <th class="border border-slate-300 py-1 px-1.5 text-center" style="width:28%;">설명</th>
            <th class="border border-slate-300 py-1 px-1.5 text-center" style="width:6%;">구분</th>
            <th class="border border-slate-300 py-1 px-1.5 text-center" style="width:5%;">수량<br>(Q)</th>
            <th class="border border-slate-300 py-1 px-1.5 text-center" style="width:10%;">소비자단가<br>(LP)</th>
            <th class="border border-slate-300 py-1 px-1.5 text-center" style="width:10%;">소비자금액<br>(Q*LP)</th>
            <th class="border border-slate-300 py-1 px-1.5 text-center" style="width:10%;">제안단가<br>(P)</th>
            <th class="border border-slate-300 py-1 px-1.5 text-center" style="width:10%;">제안금액<br>(Q*P)</th>
            <th class="border border-slate-300 py-1 px-1.5 text-center" style="width:9%;">비고</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
        <tfoot>
          <tr class="bg-emerald-50">
            <td colspan="7" class="border border-slate-300 py-1 px-2 text-right font-semibold">${title} 제안 금액 (VAT 제외)</td>
            <td colspan="2" class="border border-slate-300 py-1 px-2 text-right font-bold whitespace-nowrap">${formatCurrency(subtotal)}</td>
          </tr>
          <tr class="bg-emerald-50">
            <td colspan="7" class="border border-slate-300 py-1 px-2 text-right font-semibold">${title} 제안 금액 (VAT 포함)</td>
            <td colspan="2" class="border border-slate-300 py-1 px-2 text-right font-bold whitespace-nowrap">${formatCurrency(withTax)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  </div>`;
}

function renderHardwareSection(items, taxRate) {
  return renderFixedItemSection('03. 하드웨어', items, taxRate, 'bg-violet-50');
}

function renderEtcSection(items, taxRate) {
  return renderFixedItemSection('04. 기타', items, taxRate, 'bg-teal-50');
}


function renderQuoteDocument(q, items) {
  const licenseItems = items.filter(i => i.item_type === '제품(S/W라이선스)');
  const serviceItems = items.filter(i => i.item_type === '서비스(개발/구축)');
  const hardwareItems = items.filter(i => i.item_type === '하드웨어');
  const etcItems = items.filter(i => i.item_type === '기타' || i.item_type === '기타(HW/3rd-party 등)');
  const taxRate = q.tax_rate || 0;

  document.getElementById('quote-content').innerHTML = `
    <div class="flex flex-col md:flex-row justify-between items-start gap-6 mb-8 pb-8 border-b-2 border-slate-800">
      <div class="flex items-center gap-3">
        <div class="w-14 h-14 rounded-xl bg-white border border-slate-200 flex items-center justify-center flex-shrink-0 p-2">
          <img src="images/lomin-logo.png" alt="Lomin" class="w-full h-full object-contain">
        </div>
        <div>
          <p class="font-extrabold text-xl text-slate-800">Lomin Inc.</p>
          <p class="text-slate-400 text-xs">Document AI 솔루션 전문기업</p>
        </div>
      </div>
      <div class="text-left md:text-right">
        <h2 class="text-3xl font-extrabold text-slate-800 tracking-wide">견 적 서</h2>
        <p class="text-slate-500 text-[13px] mt-1">QUOTATION</p>
      </div>
    </div>

    <div class="mb-8">
      <div class="table-wrap">
        <table class="w-full text-[13px] border border-slate-800" style="border-collapse:collapse;">
          <tbody>
            <tr>
              <td class="border border-slate-400 bg-slate-50 font-semibold px-2 py-2 text-center" style="width:11%;">견적번호</td>
              <td class="border border-slate-400 px-2 py-2" style="width:22%;">${q.quote_number || '-'}</td>
              <td class="border border-slate-400 bg-slate-50 font-semibold px-2 py-2 text-center" style="width:11%;">발행일</td>
              <td class="border border-slate-400 px-2 py-2" style="width:18%;">${formatDate(q.issue_date)}</td>
              <td class="border border-slate-400 bg-slate-50 font-semibold px-2 py-2 text-center" style="width:14%;">사업자등록번호</td>
              <td class="border border-slate-400 px-2 py-2">${COMPANY_INFO.business_number}</td>
            </tr>
            <tr>
              <td class="border border-slate-400 bg-slate-50 font-semibold px-2 py-2 text-center">견적명</td>
              <td class="border border-slate-400 px-2 py-2">${q.quote_title || '-'}</td>
              <td class="border border-slate-400 bg-slate-50 font-semibold px-2 py-2 text-center">유효기간</td>
              <td class="border border-slate-400 px-2 py-2">${formatDate(q.valid_until)}</td>
              <td class="border border-slate-400 bg-slate-50 font-semibold px-2 py-2 text-center">회사명</td>
              <td class="border border-slate-400 px-2 py-2">${COMPANY_INFO.company_name}</td>
            </tr>
            <tr>
              <td class="border border-slate-400 bg-slate-50 font-semibold px-2 py-2 text-center">수신</td>
              <td class="border border-slate-400 px-2 py-2">${q.customer_contact || '-'}</td>
              <td class="border border-slate-400 bg-slate-50 font-semibold px-2 py-2 text-center">견적담당</td>
              <td class="border border-slate-400 px-2 py-2">${q.sales_rep_name || '-'}</td>
              <td class="border border-slate-400 bg-slate-50 font-semibold px-2 py-2 text-center">대표이사</td>
              <td class="border border-slate-400 px-2 py-2">${COMPANY_INFO.ceo_name}</td>
            </tr>
            <tr>
              <td class="border border-slate-400 bg-slate-50 font-semibold px-2 py-2 text-center">참조</td>
              <td class="border border-slate-400 px-2 py-2">${q.reference || '-'}</td>
              <td class="border border-slate-400 bg-slate-50 font-semibold px-2 py-2 text-center">연락처</td>
              <td class="border border-slate-400 px-2 py-2">${q.sales_rep_phone || '-'}</td>
              <td class="border border-slate-400 bg-slate-50 font-semibold px-2 py-2 text-center">주소</td>
              <td class="border border-slate-400 px-2 py-2">${COMPANY_INFO.address}</td>
            </tr>
            <tr>
              <td class="border border-slate-400 bg-slate-50 font-semibold px-2 py-2 text-center">연락처</td>
              <td class="border border-slate-400 px-2 py-2">${q.customer_phone || '-'}</td>
              <td class="border border-slate-400 bg-slate-50 font-semibold px-2 py-2 text-center">이메일</td>
              <td class="border border-slate-400 px-2 py-2">${q.sales_rep_email || '-'}</td>
              <td class="border border-slate-400 bg-slate-50 font-semibold px-2 py-2 text-center">대표전화</td>
              <td class="border border-slate-400 px-2 py-2">${COMPANY_INFO.phone}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    ${renderLicenseSection(licenseItems, taxRate)}
    ${renderServiceSection(serviceItems, taxRate)}
    ${renderHardwareSection(hardwareItems, taxRate)}
    ${renderEtcSection(etcItems, taxRate)}

    <div class="flex justify-end mb-8">
      <div class="w-full md:w-96 rounded-xl overflow-hidden border-2 border-slate-800">
        <div class="flex justify-between items-center px-4 py-3 bg-orange-50 border-b border-slate-300">
          <span class="font-bold text-slate-700">총 제안 금액 (VAT 제외)</span>
          <span class="font-bold text-xl text-slate-800 whitespace-nowrap text-right">₩ ${formatNumber(q.subtotal)}</span>
        </div>
        <div class="flex justify-between items-center px-4 py-3 bg-orange-100">
          <span class="font-extrabold text-slate-800">총 제안 금액 (VAT 포함)</span>
          <span class="font-extrabold text-xl text-indigo-700 whitespace-nowrap text-right">₩ ${formatNumber(q.total)}</span>
        </div>
      </div>
    </div>

    ${q.payment_terms ? `
    <div class="mb-4">
      <p class="text-[11px] font-bold text-slate-500 mb-1">결제 조건</p>
      <p class="text-[13px] text-slate-600 bg-slate-50 rounded-lg p-3">${q.payment_terms}</p>
    </div>` : ''}

    ${q.notes ? `
    <div class="mb-8">
      <p class="text-[11px] font-bold text-slate-500 mb-1">비고</p>
      <p class="text-[13px] text-slate-600 bg-slate-50 rounded-lg p-3 whitespace-pre-line">${q.notes}</p>
    </div>` : ''}

    <div class="text-center text-[11px] text-slate-400 pt-6 border-t border-slate-100">
      본 견적서는 Lomin Inc.에서 발행하였으며, 명시된 유효기한 이후에는 가격 조건이 변경될 수 있습니다.
    </div>
  `;

  renderInternalMemoBox(q);
}

/* ---------------- 버전 히스토리 (재발행 체인) ----------------
   동일 건이 협상 중 "새 버전으로 재발행"을 통해 여러 번 발행된 경우, 이전
   버전들과 현재 견적서를 연결해서 보여줍니다. 각 버전은 parent_quote_id로
   직전 버전을 가리키는 단순 연결 리스트 구조이므로(재발행 시 항상 정확히
   하나의 다음 버전만 생기고, 재발행되면 이전 버전은 '재발행됨' 상태로
   자동 전환됨), 앞뒤로 한 번씩만 순회하면 전체 체인을 구할 수 있습니다. */
function buildVersionChain(allQuotes, quote) {
  const byId = new Map(allQuotes.map(q => [q.id, q]));

  let root = quote;
  const seenBack = new Set();
  while (root.parent_quote_id && byId.has(root.parent_quote_id) && !seenBack.has(root.id)) {
    seenBack.add(root.id);
    root = byId.get(root.parent_quote_id);
  }

  const chain = [root];
  const seenForward = new Set();
  let cursor = root;
  while (true) {
    const next = allQuotes.find(q => q.parent_quote_id === cursor.id);
    if (!next || seenForward.has(next.id)) break;
    seenForward.add(next.id);
    chain.push(next);
    cursor = next;
  }
  return chain;
}

function renderVersionHistory(quote) {
  const box = document.getElementById('version-history-box');
  const reviseBtn = document.getElementById('btn-revise');
  if (!box) return;

  const chain = buildVersionChain(allQuotesCache, quote);
  const supersededBy = allQuotesCache.find(q => q.parent_quote_id === quote.id);

  // 이미 재발행되어 대체된 버전에서는 새로 재발행하지 않고, 최신 버전에서 진행하도록 안내
  if (quote.status === '재발행됨' && reviseBtn) {
    reviseBtn.disabled = true;
    reviseBtn.title = '이미 재발행되어 대체된 견적서입니다. 최신 버전에서 재발행해주세요.';
  }

  if (chain.length <= 1) {
    box.classList.add('hidden');
    box.innerHTML = '';
    return;
  }

  const rows = chain.map(v => {
    const isCurrent = v.id === quote.id;
    const rowClass = isCurrent ? 'bg-indigo-50 border border-indigo-200' : 'bg-white border border-slate-200';
    const content = `
      <span class="font-semibold text-slate-700">v${v.version || 1}</span>
      <span class="text-slate-600">${v.quote_number || '-'}</span>
      ${statusBadge(v.status)}
      <span class="text-slate-400 text-xs">${formatDate(v.issue_date)}</span>
      ${isCurrent ? '<span class="text-indigo-600 text-xs font-semibold">(현재 보는 중)</span>' : ''}
    `;
    return isCurrent
      ? `<div class="flex items-center gap-2 flex-wrap px-3 py-2 rounded-lg ${rowClass}">${content}</div>`
      : `<a href="quote-detail.html?id=${v.id}" class="flex items-center gap-2 flex-wrap px-3 py-2 rounded-lg ${rowClass} hover:border-indigo-300">${content}</a>`;
  }).join('');

  box.classList.remove('hidden');
  box.innerHTML = `
    <div class="p-4 rounded-xl bg-slate-50 border border-slate-200">
      <p class="text-xs font-bold text-slate-500 mb-2"><i class="fa-solid fa-code-branch mr-1"></i>버전 히스토리 (동일 건, 총 ${chain.length}개 버전)</p>
      <div class="flex flex-col gap-1.5">${rows}</div>
      ${supersededBy ? `<p class="text-xs text-violet-600 mt-2"><i class="fa-solid fa-arrow-right mr-1"></i>이 견적은 <a href="quote-detail.html?id=${supersededBy.id}" class="underline font-semibold">v${supersededBy.version || '?'} (${supersededBy.quote_number})</a>으로 재발행되었습니다.</p>` : ''}
    </div>`;
}

/* 내부 메모는 화면(상세보기)에서만 노출되는 사내 전용 정보입니다.
   - 인쇄/PDF: #print-area 밖에 있고 no-print 클래스가 적용되어 항상 제외됨
   - 엑셀 다운로드: js/quote-excel-template.js는 internal_memo를 전혀 참조하지 않으므로 애초에 포함되지 않음 */
function renderInternalMemoBox(q) {
  const box = document.getElementById('internal-memo-box');
  if (!box) return;
  if (q.internal_memo) {
    box.classList.remove('hidden');
    box.innerHTML = `
      <div class="p-4 rounded-xl bg-amber-50 border border-amber-200">
        <p class="text-xs font-bold text-amber-600 mb-1"><i class="fa-solid fa-lock mr-1"></i>내부 메모 (사내 전용 · 고객에게 노출되지 않음, 인쇄/PDF/엑셀 다운로드에 포함되지 않음)</p>
        <p class="text-sm text-amber-700 whitespace-pre-line">${q.internal_memo}</p>
      </div>`;
  } else {
    box.classList.add('hidden');
    box.innerHTML = '';
  }
}

/* ---------------- 엑셀 다운로드 (템플릿 기반) ----------------
   js/quote-excel-template.js 에 정의된 buildQuoteWorkbook() 템플릿에
   실제 견적 데이터를 주입해 완성된 워크북을 생성한 뒤 .xlsx로 다운로드합니다.
   서식(레이아웃/색상/테두리/컬럼너비 등)은 전부 템플릿 파일에서 관리되며,
   이 함수는 "템플릿 호출 + 파일 다운로드 트리거" 역할만 담당합니다. */
async function exportQuoteToExcel(q, items) {
  if (!q) {
    showToast('견적서 정보를 불러오지 못했습니다.', 'error');
    return;
  }
  if (typeof ExcelJS === 'undefined' || typeof buildQuoteWorkbook !== 'function') {
    showToast('엑셀 템플릿을 불러오지 못했습니다. 새로고침 후 다시 시도해주세요.', 'error');
    return;
  }

  const workbook = await buildQuoteWorkbook(q, items);
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

  const fileName = `견적서_${q.quote_number || 'quote'}_${q.customer_name || ''}.xlsx`.replace(/[\\/:*?"<>|]/g, '_');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  showToast('엑셀 파일이 다운로드되었습니다.', 'success');
}

document.addEventListener('DOMContentLoaded', initQuoteDetailPage);

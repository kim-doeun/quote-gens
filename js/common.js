/* ============================================================
   Lomin 견적관리 시스템 - 공통 유틸리티
   ============================================================ */

const API_BASE = 'tables';

/* ---------------- Table API 헬퍼 ---------------- */
async function apiList(table, params = {}) {
  const query = new URLSearchParams({ limit: 1000, ...params }).toString();
  const res = await fetch(`${API_BASE}/${table}?${query}`);
  if (!res.ok) throw new Error(`${table} 목록 조회 실패`);
  return res.json();
}

async function apiGet(table, id) {
  const res = await fetch(`${API_BASE}/${table}/${id}`);
  if (!res.ok) throw new Error(`${table} 조회 실패`);
  return res.json();
}

async function apiCreate(table, data) {
  const res = await fetch(`${API_BASE}/${table}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error(`${table} 생성 실패`);
  return res.json();
}

async function apiUpdate(table, id, data) {
  const res = await fetch(`${API_BASE}/${table}/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error(`${table} 수정 실패`);
  return res.json();
}

async function apiDelete(table, id) {
  const res = await fetch(`${API_BASE}/${table}/${id}`, { method: 'DELETE' });
  if (!res.ok && res.status !== 204) throw new Error(`${table} 삭제 실패`);
  return true;
}

/* ---------------- 포맷 유틸 ---------------- */
function formatCurrency(num) {
  const n = Number(num) || 0;
  return n.toLocaleString('ko-KR') + '원';
}

function formatNumber(num) {
  return (Number(num) || 0).toLocaleString('ko-KR');
}

function formatDate(dateVal) {
  if (!dateVal) return '-';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return String(dateVal);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function todayStr() {
  return formatDate(new Date());
}

function addDays(dateVal, days) {
  const d = new Date(dateVal);
  d.setDate(d.getDate() + days);
  return d;
}

function uid(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/* ---------------- 견적서 번호 생성 ----------------
   형식: QT-YYYY-MM-NNN (예: QT-2026-08-001) — 연/월별로 순번이 초기화됩니다. */
async function generateQuoteNumber() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const prefix = `QT-${year}-${month}-`;
  try {
    const { data } = await apiList('quotes', { limit: 1000 });
    const seqList = (data || [])
      .map(q => q.quote_number)
      .filter(n => n && n.startsWith(prefix))
      .map(n => parseInt(n.slice(prefix.length), 10))
      .filter(n => !isNaN(n));
    const next = seqList.length ? Math.max(...seqList) + 1 : 1;
    return `${prefix}${String(next).padStart(3, '0')}`;
  } catch (e) {
    return `${prefix}${String(Date.now()).slice(-3)}`;
  }
}

/* ---------------- 상태 배지 ---------------- */
const STATUS_CONFIG = {
  '발송전':   { cls: 'badge-draft', icon: 'fa-pen' },
  '발송됨': { cls: 'badge-sent', icon: 'fa-paper-plane' },
  '내부협의중': { cls: 'badge-negotiating', icon: 'fa-comments' },
  '계약됨': { cls: 'badge-approved', icon: 'fa-check' },
    '만료됨': { cls: 'badge-expired', icon: 'fa-clock' },
};

function statusBadge(status) {
  const cfg = STATUS_CONFIG[status] || { cls: 'badge-draft', icon: 'fa-circle' };
  return `<span class="badge ${cfg.cls}"><i class="fa-solid ${cfg.icon}"></i>${status || '-'}</span>`;
}

/* ---------------- 토스트 알림 ---------------- */
function ensureToastContainer() {
  let c = document.getElementById('toast-container');
  if (!c) {
    c = document.createElement('div');
    c.id = 'toast-container';
    document.body.appendChild(c);
  }
  return c;
}

function showToast(message, type = 'info') {
  const container = ensureToastContainer();
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity 0.3s';
    setTimeout(() => el.remove(), 300);
  }, 2600);
}

/* ---------------- 확인 모달 (간단 confirm 대체) ----------------
   브라우저 네이티브 window.confirm()은 다음과 같은 문제가 있어 자체 모달로 대체합니다:
   - 동기(synchronous) 호출이라 표시 위치가 브라우저마다 다르고 눈에 잘 안 띄는 경우가 있음
   - 이 페이지가 iframe 등 allow-modals 권한이 없는 컨테이너 안에서 열리면 호출 자체가
     무시(ignored)되어, 사용자 입장에서는 화면이 응답 없이 멈춘 것처럼 보임
     ("Ignored call to 'confirm()'. The document is sandboxed, ..." 콘솔 에러 발생)
   confirmAction()은 이제 Promise를 반환하는 비동기 함수이므로 호출부는 반드시
   `await confirmAction(...)` 형태로 사용해야 합니다. */
function ensureConfirmModal() {
  let modal = document.getElementById('app-confirm-modal');
  if (modal) return modal;

  modal = document.createElement('div');
  modal.id = 'app-confirm-modal';
  modal.className = 'modal-overlay hidden';
  modal.innerHTML = `
    <div class="modal-box" style="max-width: 400px;">
      <div class="p-5">
        <p id="app-confirm-message" class="text-slate-700 text-sm leading-relaxed whitespace-pre-line"></p>
      </div>
      <div class="p-4 border-t border-slate-100 flex justify-end gap-2">
        <button id="app-confirm-cancel" type="button" class="btn btn-secondary">취소</button>
        <button id="app-confirm-ok" type="button" class="btn btn-primary">확인</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  return modal;
}

function confirmAction(message) {
  const modal = ensureConfirmModal();
  const msgEl = document.getElementById('app-confirm-message');
  const okBtn = document.getElementById('app-confirm-ok');
  const cancelBtn = document.getElementById('app-confirm-cancel');
  msgEl.textContent = message;

  return new Promise((resolve) => {
    function cleanup(result) {
      modal.classList.add('hidden');
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
      modal.removeEventListener('click', onOverlayClick);
      document.removeEventListener('keydown', onKeydown);
      resolve(result);
    }
    function onOk() { cleanup(true); }
    function onCancel() { cleanup(false); }
    function onOverlayClick(e) { if (e.target === modal) cleanup(false); }
    function onKeydown(e) {
      if (e.key === 'Escape') cleanup(false);
      if (e.key === 'Enter') cleanup(true);
    }
    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
    modal.addEventListener('click', onOverlayClick);
    document.addEventListener('keydown', onKeydown);

    modal.classList.remove('hidden');
    okBtn.focus();
  });
}

/* ---------------- 사이드바 레이아웃 ---------------- */
const NAV_ITEMS = [
  { href: 'index.html', icon: 'fa-gauge-high', label: '대시보드' },
  { href: 'quote-new.html', icon: 'fa-file-circle-plus', label: '견적서 발급' },
  { href: 'quotes.html', icon: 'fa-file-invoice-dollar', label: '견적 이력 관리' },
  { href: 'customers.html', icon: 'fa-building-user', label: '고객사 관리' },
  { href: 'products.html', icon: 'fa-box-open', label: 'S/W 라이선스 관리' },
  { href: 'labor-rates.html', icon: 'fa-user-gear', label: '인건비 단가 관리' },
];

function renderSidebar(activePage) {
  const mount = document.getElementById('sidebar-mount');
  if (!mount) return;
  const items = NAV_ITEMS.map(item => {
    const active = item.href === activePage ? 'active' : '';
    return `<a href="${item.href}" class="nav-item ${active}" title="${item.label}"><i class="fa-solid ${item.icon}"></i><span class="collapsible-label">${item.label}</span></a>`;
  }).join('');

  mount.innerHTML = `
    <aside id="app-sidebar" class="sidebar w-full lg:w-64 bg-[var(--brand-navy)] lg:min-h-screen flex-shrink-0">
      <button id="sidebar-toggle-btn" class="hidden lg:flex sidebar-toggle-btn" title="메뉴 접기/펼치기" aria-label="메뉴 접기/펼치기">
        <i class="fa-solid fa-chevron-left"></i>
      </button>
      <div class="p-5 flex items-center gap-3 border-b border-white/10 sidebar-header">
        <div class="w-11 h-11 rounded-xl bg-white flex items-center justify-center flex-shrink-0 p-1.5">
          <img src="images/lomin-logo.png" alt="Lomin" class="w-full h-full object-contain">
        </div>
        <div class="collapsible-label">
          <p class="text-white font-bold text-sm leading-tight whitespace-nowrap">Lomin</p>
          <p class="text-slate-400 text-xs leading-tight whitespace-nowrap">견적관리 시스템</p>
        </div>
      </div>
      <nav class="p-3 flex flex-col gap-1">
        ${items}
      </nav>
      <div class="p-4 mt-4 mx-3 rounded-xl bg-white/5 hidden lg:block collapsible-label">
        <p class="text-slate-400 text-xs mb-1 whitespace-nowrap">로그인 계정</p>
        <p class="text-white text-sm font-semibold whitespace-nowrap">영업대표 · Sales Rep</p>
      </div>
    </aside>`;

  applySidebarCollapsedState();
  const toggleBtn = document.getElementById('sidebar-toggle-btn');
  if (toggleBtn) toggleBtn.addEventListener('click', toggleSidebar);
}

/* ---------------- 사이드바 접기/펼치기 ---------------- */
const SIDEBAR_COLLAPSE_KEY = 'lomin_sidebar_collapsed';

function applySidebarCollapsedState() {
  const aside = document.getElementById('app-sidebar');
  if (!aside) return;
  const collapsed = localStorage.getItem(SIDEBAR_COLLAPSE_KEY) === '1';
  aside.classList.toggle('collapsed', collapsed);
}

function toggleSidebar() {
  const aside = document.getElementById('app-sidebar');
  if (!aside) return;
  const collapsed = aside.classList.toggle('collapsed');
  localStorage.setItem(SIDEBAR_COLLAPSE_KEY, collapsed ? '1' : '0');
}

/* ---------------- Slack 알림 (견적서 발급) ----------------
   견적서 저장(발급) 성공 시 지정된 Slack 채널로 알림 메시지를 전송합니다.
   Webhook URL은 더 이상 클라이언트 코드에 두지 않고 서버(SLACK_WEBHOOK_URL 환경변수)에서만
   보관하며, 브라우저는 견적 요약 정보만 백엔드의 /api/slack/notify-quote로 전달합니다. */
async function notifySlackQuoteIssued(quote) {
  try {
    const detailUrl = new URL(`quote-detail.html?id=${quote.id}`, location.href).href;
    await fetch('api/slack/notify-quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quoteNumber: quote.quote_number,
        customerName: quote.customer_name,
        quoteTitle: quote.quote_title,
        totalAmount: formatCurrency(quote.total),
        salesRepName: quote.sales_rep_name,
        detailUrl
      })
    });
  } catch (e) {
    console.error('Slack 알림 전송 실패:', e);
  }
}

/* ---------------- 페이지 초기 실행 ---------------- */
document.addEventListener('DOMContentLoaded', () => {
  const page = document.body.getAttribute('data-page');
  renderSidebar(page);
});

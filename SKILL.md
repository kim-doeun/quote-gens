# 스킬: 견적서 발급·관리 시스템 (Quote/Estimate Management System)

> 이 문서는 "Lomin 견적관리 시스템"을 개발하면서 확립된 구조·패턴을 **재사용 가능한 스킬(설계 템플릿)**로 정리한 것입니다.
> 유사한 "견적서/제안서 발급 + 이력관리" 정적 웹앱을 새로 만들 때 이 문서를 참고하면 동일한 아키텍처를 빠르게 재현할 수 있습니다.

---

## 1. 스킬 개요

**언제 이 스킬을 쓰는가**
- 영업/사업부서가 고객사별 **견적서(제안서/청구서 등 문서형 산출물)** 를 표준 양식으로 발급해야 할 때
- 발급된 문서를 **이력으로 검색·필터·상태관리**해야 할 때
- 견적 항목이 **카테고리(예: 제품/서비스)** 로 나뉘고, 각 카테고리가 서로 다른 컬럼 구성을 가질 때
- 카탈로그성 마스터 데이터(제품, 인건비 단가, 고객사)를 **재사용해 입력 효율**을 높이고 싶을 때
- 최종 산출물을 **브라우저 인쇄(→PDF)** 로 제공하면 충분하고, 서버 PDF 생성이 필요 없을 때

**핵심 설계 원칙**
1. **입력 폼(발급 화면)과 인쇄 문서(상세 화면)를 분리**한다 — 같은 데이터를 서로 다른 두 개의 렌더러가 그린다.
2. **내부 관리용 필드(상태, 메모)는 인쇄 문서 DOM에 아예 넣지 않는다** — `no-print` CSS만으로는 안전하지 않다(가리는 것과 없는 것은 다름).
3. **항목(품목) 테이블은 타입별로 분리 저장**하되 하나의 테이블(`quote_items`)에 `item_type` 구분 필드로 통합한다.
4. **마스터 데이터(카탈로그) 선택 → 폼 자동 채움 → 직접 수정 가능**한 하이브리드 입력 방식을 기본으로 한다.
5. **행 렌더링은 항상 "전체 리렌더"** 방식(state 배열 → innerHTML 재생성)을 쓴다. 부분 DOM 조작보다 버그가 적고 코드가 짧다.

---

## 2. 기술 스택 (고정 조합)

| 영역 | 선택 | 이유 |
|---|---|---|
| 마크업/스타일 | HTML5 + Tailwind CSS(CDN) + 공통 `css/style.css` | 빠른 프로토타이핑 + 커스텀 컴포넌트(뱃지, 카드, 인쇄 스타일)는 별도 CSS로 |
| 폰트/아이콘 | Google Fonts(Noto Sans KR) + Font Awesome 6(CDN) | 한글 웹폰트 + 아이콘 무료 |
| 로직 | Vanilla JavaScript, **페이지별 스크립트 분리** (모듈 번들러 없음) | 정적 사이트 제약에 최적, 디버깅 쉬움 |
| 차트 | Chart.js (CDN) | 대시보드 수치 시각화 |
| 데이터 저장 | RESTful Table API (`tables/{table}`) | 백엔드 없이 CRUD 가능한 플랫폼 제공 API |
| 인쇄/PDF | `window.print()` + `@media print` CSS | 서버 PDF 렌더링 불가 환경의 표준 대안 |

---

## 3. 정보 구조 (사이트맵 패턴)

```
index.html          대시보드 (요약 통계 + 차트 + 최근 목록)
{entity}-new.html    신규 발급/등록 폼 (다단계 섹션 카드형 레이아웃)
{entity}s.html       이력/목록 관리 (검색 + 필터 + 정렬 + 상태변경)
{entity}-detail.html 상세 보기 겸 인쇄 문서 (?id= 쿼리 파라미터)
{master}.html        마스터 데이터 관리 (카탈로그성 CRUD, 반복되는 화면들)
```

이번 프로젝트 매핑:
| 스킬 상의 역할 | 실제 파일 |
|---|---|
| 대시보드 | `index.html` / `js/dashboard.js` |
| 신규 발급 폼 | `quote-new.html` / `js/quote-new.js` |
| 이력 관리 | `quotes.html` / `js/quotes.js` |
| 상세/인쇄 | `quote-detail.html` / `js/quote-detail.js` |
| 마스터: 고객사 | `customers.html` / `js/customers.js` |
| 마스터: 제품 카탈로그 | `products.html` / `js/products.js` |
| 마스터: 인건비 단가 | `labor-rates.html` / `js/labor-rates.js` |
| 공통 유틸/레이아웃 | `js/common.js`, `css/style.css` |

---

## 4. 데이터 모델 패턴

### 4.1 헤더(Header) + 항목(Line-items) 분리 구조
문서형 레코드는 **헤더 테이블 1개 + 항목 테이블 1개**로 분리한다. 항목 테이블은 `{header}_id` 외래키와 `item_type`(또는 `category`) 구분 필드로 여러 유형을 한 테이블에 통합한다.

```
quotes (헤더)
  id, quote_number, quote_title, reference,
  customer_*(스냅샷 6종), sales_rep_*(스냅샷 3종),
  issue_date, valid_until,
  status(내부관리 전용, 옵션 enum),
  tax_rate, license_subtotal, service_subtotal, subtotal, tax_amount, total,
  payment_terms, notes(고객 공개), internal_memo(비공개)

quote_items (항목, quote_id로 연결)
  id, quote_id, item_type(옵션: "제품(S/W라이선스)" | "서비스(개발/구축)"),
  name, description, remark,
  classification(제품 전용), grade(서비스 전용, 옵션 enum),
  quantity, list_price, list_amount, unit_price, amount,
  sort_order
```

**설계 포인트**
- 고객/영업담당 정보는 **발급 시점 스냅샷**으로 헤더에 복사 저장한다 (마스터 데이터가 나중에 바뀌어도 과거 발급 문서는 불변).
- 금액 필드는 **소비자단가(LP)/소비자금액 vs 제안단가(P)/제안금액**처럼 "정가-할인가" 페어로 둔다 → 인쇄 문서에서 정가 대비 할인 폭을 보여줄 수 있다.
- 상태(`status`)는 **enum 옵션이 있는 필드**로 두고, "발급 시 기본값(예: 발송전)"만 자동 지정, 이후 변경은 별도 이력관리 화면에서만.
- `sort_order`로 항목 표시 순서를 명시적으로 관리(등록 순서 의존 X).
- 필드를 나중에 제거해야 할 때도 **스키마에서 완전 삭제하지 말고 "레거시/미사용" 설명으로 남겨** 과거 데이터 호환성을 지킨다 (예: `assignee` 필드 사례).

### 4.2 마스터(카탈로그) 테이블 패턴
```
products (제품 카탈로그)      : name, category(옵션), unit, list_price, unit_price, description, is_active(bool)
labor_rates (등급별 단가표)   : grade(옵션 enum), default_role, monthly_rate, description
customers (고객사 마스터)     : company_name, business_number, industry, contact_*, phone, email, address, notes
```
마스터 레코드는 항목 추가 모달에서 **드롭다운으로 선택 시 관련 입력 필드를 자동 채움**하고, 사용자가 이후 자유롭게 덮어쓸 수 있게 한다(잠그지 않음).

---

## 5. 화면별 구현 패턴

### 5.1 발급/등록 폼 (`{entity}-new.html` + `.js`)
- 좌(2/3) 입력 폼 다단 섹션 카드 + 우(1/3) `sticky` 실시간 요약 패널의 2-컬럼 레이아웃.
- 항목 리스트는 **모듈 전역 배열(state)** 로 관리(`let licenseItems = []; let serviceItems = [];`) — 저장 전까지 API를 호출하지 않고 메모리에서만 조작.
- 항목 추가는 **모달**로: 카탈로그 선택 드롭다운(선택 시 필드 자동 채움) + 직접입력 필드 + "추가하기" 버튼 → `push()` 후 `render{Type}Table()` 호출.
- 각 행은 `<input onchange="update{Type}Field(id, field, value)">` 형태로 **인라인 편집 가능한 테이블**로 렌더링(읽기 전용 X).
- 합계는 항목 배열이 바뀔 때마다 `updateSummary()`를 호출해 전체 재계산(부분 계산 X, 항상 reduce로 재계산해 불일치 방지).
- 저장(`saveQuote()`) 시점에만 헤더 1건 `apiCreate` → 반환된 id로 항목들을 `Promise.all([...items.map(apiCreate)])`로 일괄 생성 → 완료 후 상세 페이지로 리다이렉트.
- **문서번호 자동 채번**: `연도-월` 단위로 접두어를 만들고, 같은 접두어를 가진 기존 레코드 중 최대 순번 다음 값을 3자리 zero-pad. API 실패 시 타임스탬프 fallback.
  ```js
  async function generateQuoteNumber() {
    const now = new Date();
    const prefix = `QT-${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-`;
    const { data } = await apiList('quotes', { limit: 1000 });
    const seq = (data||[]).map(q=>q.quote_number).filter(n=>n&&n.startsWith(prefix))
      .map(n=>parseInt(n.slice(prefix.length),10)).filter(n=>!isNaN(n));
    const next = seq.length ? Math.max(...seq)+1 : 1;
    return `${prefix}${String(next).padStart(3,'0')}`;
  }
  ```

### 5.2 이력/목록 관리 (`{entity}s.html` + `.js`)
- 검색창(통합 텍스트 검색) + 상태 필터 + 담당자 필터 + 정렬 드롭다운 → 모두 **클라이언트 사이드**에서 `Array.filter`/`sort` 처리(`apiList`는 전체를 한 번만 불러옴, `limit: 1000`).
- 상태 뱃지를 클릭하면 **별도 상태변경 모달**이 뜨는 패턴(목록 화면에서 바로 상태를 바꿀 수 있게 하되 실수로 안 바뀌게 확인 단계 추가).
- 삭제는 소프트 삭제(플랫폼 API가 기본 지원) + `confirmAction()`으로 확인.

### 5.3 상세/인쇄 문서 (`{entity}-detail.html?id=` + `.js`)
- `?id=` 쿼리에서 레코드를 읽어 `renderQuoteDocument()`가 **문서 전체를 innerHTML 하나로 조립**한다 — 입력 폼과 완전히 분리된 별도 렌더러.
- **인쇄 안전 분리 3원칙**:
  1. 화면 전용 컨트롤(상태 드롭다운, 인쇄/삭제 버튼, 사이드바)에는 `no-print` 클래스.
  2. `@media print { body * { visibility:hidden } #print-area, #print-area * { visibility:visible } ... }` 로 인쇄 시 그 외 모든 요소를 강제로 숨김.
  3. **내부 전용 데이터(상태, 내부메모 등)는 애초에 `#quote-content`의 innerHTML 문자열 자체에 넣지 않는다.** `no-print`만 믿으면 안 됨 — CSS가 깨지거나 사용자가 개발자도구로 열람 가능. "화면에서 안 보이면 끝"이 아니라 "인쇄 대상 DOM에 존재하지 않아야 함"이 원칙.
- 고정된 회사(발급 주체) 정보는 스크립트 상단에 상수로 박아둔다:
  ```js
  const COMPANY_INFO = { business_number:'...', company_name:'...', ceo_name:'...', address:'...', phone:'...' };
  ```
- 항목 타입별로 **섹션 렌더 함수를 분리**한다(`renderLicenseSection()`, `renderServiceSection()`) — 컬럼 구성이 다르기 때문에 공통화하지 않고 각자 thead/tbody/tfoot을 명시적으로 작성하는 편이 유지보수에 유리.
- `window.print()` 버튼 하나로 PDF 저장까지 커버(브라우저 인쇄창의 "PDF로 저장" 활용, 서버 PDF 생성 불필요).

### 5.4 마스터 데이터 관리 (`{master}.html` + `.js`)
- 목록(테이블 또는 카드 그리드) + 검색 + 등록/수정 모달 + 삭제, 전형적인 CRUD 반복 패턴.
- **⚠️ 필수 안전 패턴 — "ID만 넘기고 캐시에서 조회"**:
  객체 전체를 `onclick="openModal(${JSON.stringify(obj)})"` 식으로 속성에 직접 박으면 이름/설명에 줄바꿈·따옴표·백틱이 있을 때 HTML이 깨진다. 반드시 다음처럼 ID만 전달하고 메모리 캐시에서 찾는다:
  ```js
  function openModalById(id) {
    const item = allItems.find(i => i.id === id);
    if (!item) { showToast('정보를 찾을 수 없습니다.', 'error'); loadItems(); return; }
    openModal(item);
  }
  ```
  이 패턴은 프로젝트의 products/customers/labor-rates 세 화면에 동일하게 적용되어 있다.

---

## 6. 공통 레이아웃/UI 패턴 (`js/common.js`, `css/style.css`)

### 6.1 API 헬퍼 (모든 페이지 공통, `js/common.js`)
```js
const API_BASE = 'tables';
async function apiList(table, params={}) { ... }   // GET  tables/{table}?...
async function apiGet(table, id) { ... }            // GET  tables/{table}/{id}
async function apiCreate(table, data) { ... }       // POST tables/{table}
async function apiUpdate(table, id, data) { ... }   // PATCH tables/{table}/{id}
async function apiDelete(table, id) { ... }         // DELETE tables/{table}/{id}
```
포맷 유틸(`formatCurrency`, `formatNumber`, `formatDate`), 토스트(`showToast`), 확인모달(`confirmAction`), 상태뱃지(`statusBadge`+`STATUS_CONFIG`)도 여기에 모아 모든 페이지 `<script src="js/common.js">`로 공유한다.

### 6.2 사이드바 — 접기/펼치기(Collapsible) 패턴
- `NAV_ITEMS` 배열로 메뉴 항목을 선언 → `renderSidebar(activePage)`가 `#sidebar-mount`에 주입. `data-page` body 속성으로 활성 메뉴 표시.
- **접기/펼치기 구현**:
  - 라벨 텍스트를 `.collapsible-label` 클래스로 감싸고, 접힘 시 `display:none` 처리(아이콘만 남김).
  - 사이드바 우측에 원형 토글 버튼(`.sidebar-toggle-btn`), 클릭 시 `aside.classList.toggle('collapsed')`.
  - 상태는 `localStorage`에 저장해 **페이지 이동/새로고침 후에도 유지**.
  - 데스크톱(`lg:` 이상)에서만 토글 버튼 노출, 모바일에서는 항상 펼침 상태(기존 반응형 레이아웃 유지, 토글 UI로 인한 모바일 회귀 방지).
  ```css
  .sidebar { transition: width .2s ease; }
  @media (min-width:1024px){
    .sidebar.collapsed { width:5rem; }
    .sidebar.collapsed .collapsible-label { display:none; }
    .sidebar.collapsed .nav-item { justify-content:center; }
  }
  ```

### 6.3 인쇄 전용 CSS
```css
.quote-doc { background:#fff; }
@media print {
  body * { visibility:hidden; }
  #print-area, #print-area * { visibility:visible; }
  #print-area { position:absolute; top:0; left:0; width:100%; }
  .no-print { display:none !important; }
}
```

### 6.4 조밀한 입력 테이블(Compact Table) 패턴
발급 폼처럼 한 화면에 많은 입력 컬럼(항목/설명/구분/수량/단가/금액/비고 등)을 보여줘야 할 때, 기본 `.data-table` 패딩(목록 화면용, 넉넉함)을 그대로 쓰면 컬럼이 잘리거나 가로 스크롤이 심해진다. 이때는 **수식어 클래스**를 추가해 패딩만 좁힌다(마크업 구조는 그대로 유지):
```css
table.data-table.compact-table thead th { padding:.45rem .5rem; font-size:.68rem; }
table.data-table.compact-table tbody td { padding:.3rem .35rem; font-size:.8rem; }
table.data-table.compact-table tbody td .input { padding:.3rem .4rem !important; }
```
+ `<table class="data-table compact-table">`만 추가하면 되고, 셀 내부 입력창에 개별 인라인 `style="padding:..."`을 걸지 않는다(CSS 우선순위 충돌 방지).

### 6.5 모달 패턴
```css
.modal-overlay { position:fixed; inset:0; background:rgba(15,23,42,.5); display:flex; align-items:center; justify-content:center; }
.modal-box { background:#fff; border-radius:1rem; max-height:90vh; overflow-y:auto; }
```
`hidden` 클래스 토글로 열고 닫기, 열 때 폼 필드를 항상 리셋(신규) 또는 채움(수정)한다.

---

## 7. 안전/검증 체크리스트 (매번 확인)

- [ ] 인쇄 대상 DOM에 내부 전용 필드(상태값, 내부메모 등)가 **문자열 자체로도** 들어가지 않는지 확인 (`no-print`만으로 안심 금지).
- [ ] 목록/모달에서 객체를 `onclick` 속성에 직접 직렬화하지 않고 **id만 전달 + 캐시 조회** 패턴을 쓰는지 확인.
- [ ] 인라인 `<script>` 안에 `</script>`, `<script>`, `<!--` 리터럴이 들어가지 않는지 확인(복잡한 로직은 별도 `.js` 파일로 분리).
- [ ] 스키마 필드를 제거할 때 기존 데이터 호환을 깨지 않는지(필드 삭제 대신 "레거시" 표시로 유지) 확인.
- [ ] 반응형: 데스크톱 전용 기능(예: 사이드바 접기)이 모바일 레이아웃을 회귀시키지 않는지 `viewport=mobile` 스크린샷으로 확인.
- [ ] 화면 변경 후 `PlaywrightScreenshot`으로 실제 렌더링을 확인(콘솔 무오류 ≠ 정상 렌더).

---

## 8. 이 스킬을 새 프로젝트에 적용하는 순서

1. **엔티티 정의**: 헤더 엔티티(예: 견적서/계약서/청구서) + 그 안의 항목 유형들(예: 제품/서비스) 결정.
2. **테이블 스키마 설계**: 헤더 테이블 + 항목 테이블(`{header}_id`, `item_type`) + 필요한 마스터 테이블들.
3. **공통 레이아웃 이식**: `js/common.js`(API 헬퍼, 포맷, 토스트, 사이드바+접기 기능), `css/style.css`(카드/뱃지/버튼/테이블/모달/인쇄 스타일) 그대로 복사 후 `NAV_ITEMS`, `COMPANY_INFO`, 로고만 교체.
4. **마스터 관리 화면들**을 5.4 패턴대로 반복 생성(카탈로그가 여러 개면 여러 화면).
5. **발급 폼**을 5.1 패턴대로: 좌 입력폼(섹션 카드) + 우 sticky 요약, 항목은 전역 배열 + 모달 추가 + 인라인 편집 테이블.
6. **이력 관리 화면**을 5.2 패턴대로: 클라이언트 필터/정렬 + 상태변경 모달.
7. **상세/인쇄 화면**을 5.3 패턴대로: 별도 렌더 함수, 인쇄 안전 3원칙 준수, 항목 타입별 섹션 함수 분리.
8. **대시보드**(선택): 헤더 테이블 전체를 불러와 집계 카드 + Chart.js 그래프 + 최근 목록.
9. 체크리스트(7장)로 최종 검증 후 배포.

---

## 9. 참고: 이번 프로젝트에서 실제로 겪은 이슈와 해결

| 이슈 | 원인 | 해결 |
|---|---|---|
| 상태값이 인쇄물에 노출됨 | `no-print` 영역(드롭다운)은 안전했지만, 문서 본문 innerHTML 안에 별도로 상태 뱃지를 또 넣고 있었음 | 문서 조립 함수에서 해당 grid 셀 자체를 제거 |
| 제품/고객사 수정 시 간헐적 오류 | `onclick`에 객체를 JSON으로 직렬화 → 설명에 줄바꿈/따옴표 있으면 파싱 깨짐 | id만 전달 + `allItems.find()` 캐시 조회로 전환 |
| 로고 대비 문제 | 다크 텍스트 로고를 네이비 배경에 그대로 배치 → 저대비 | 로고를 흰색 원형/사각 박스로 감싸서 배치 |
| 스키마 필드 제거 요청(담당 컬럼 삭제) | 이미 저장된 과거 데이터 호환 문제 | 필드는 스키마에 유지하되 "레거시/미사용" 설명으로 변경, UI에서만 제거 |
| 편집 중 한글 텍스트 깨짐 | MultiEdit 적용 중 일부 문자열이 손상 | 파일 재확인(Read) 후 정확한 문자열로 재교정 |

---

## 10. 관련 파일 매핑 (이번 구현 기준)

```
index.html, js/dashboard.js                → 대시보드
quote-new.html, js/quote-new.js            → 발급 폼
quotes.html, js/quotes.js                  → 이력 관리
quote-detail.html, js/quote-detail.js      → 상세/인쇄
customers.html, js/customers.js            → 마스터: 고객사
products.html, js/products.js              → 마스터: 제품
labor-rates.html, js/labor-rates.js        → 마스터: 인건비 단가
js/common.js                               → API 헬퍼/포맷/토스트/사이드바(+접기)
css/style.css                              → 카드/뱃지/버튼/테이블(+compact)/모달/인쇄/사이드바 스타일
images/lomin-logo.png                      → 브랜드 로고 자산
.tables/schema.json                        → quotes, quote_items, customers, products, labor_rates 스키마
README.md                                  → 기능/URL/데이터모델 사용자 문서
SKILL.md (본 문서)                          → 재사용 가능한 설계 패턴 문서
```

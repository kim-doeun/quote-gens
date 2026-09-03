/**
 * Optional sample data for a fresh on-premise install.
 * Safe to run any time: it only inserts into tables that are currently
 * empty, so it never overwrites real data.
 *
 * Usage:
 *   node server/seed.js
 *   (in Docker) docker compose exec app node server/seed.js
 */
const crypto = require('crypto');
const { db, tables } = require('./db');

function insert(table, records) {
  const fields = tables[table];
  const count = db.prepare(`SELECT COUNT(*) AS c FROM "${table}"`).get().c;
  if (count > 0) {
    console.log(`[seed] "${table}" already has ${count} row(s), skipping.`);
    return {};
  }

  const columns = ['id', ...fields.map((f) => f.name), 'created_at', 'updated_at'];
  const stmt = db.prepare(
    `INSERT INTO "${table}" (${columns.map((c) => `"${c}"`).join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`
  );

  const ids = {};
  const now = new Date().toISOString();
  for (const record of records) {
    const id = record.id || crypto.randomUUID();
    ids[record._key || id] = id;
    const values = [
      id,
      ...fields.map((f) => {
        const v = record[f.name];
        if (v === undefined || v === null) return null;
        return f.type === 'bool' ? (v ? 1 : 0) : v;
      }),
      now,
      now,
    ];
    stmt.run(...values);
  }
  console.log(`[seed] Inserted ${records.length} row(s) into "${table}".`);
  return ids;
}

const productIds = insert('products', [
  { _key: 'ocr', name: 'LomOCR Standard', category: '라이선스', unit: 'License', list_price: 12000000, unit_price: 9800000, description: '문서 인식/추출 표준 라이선스 (온프레미스, 1개 서버 기준)', is_active: true },
  { _key: 'ocr-pro', name: 'LomOCR Professional', category: '라이선스', unit: 'License', list_price: 24000000, unit_price: 19800000, description: '고정밀 문서 인식 + 고급 후처리 라이선스', is_active: true },
  { _key: 'idp', name: 'LomIDP Platform', category: '구독', unit: 'Year', list_price: 36000000, unit_price: 30000000, description: '지능형 문서 처리 플랫폼 연간 구독', is_active: true },
  { _key: 'connector', name: 'ERP Connector Module', category: '라이선스', unit: 'EA', list_price: 5000000, unit_price: 4200000, description: '기존 ERP/그룹웨어 연동 모듈', is_active: true },
  { _key: 'support', name: '유지보수 지원(Standard)', category: '구독', unit: 'Year', list_price: 8000000, unit_price: 7000000, description: '연간 기술지원 및 버전 업그레이드', is_active: false },
]);

const laborIds = insert('labor_rates', [
  { _key: 'pm', grade: '특급', default_role: 'PM', monthly_rate: 12000000, description: '프로젝트 총괄, 고객 커뮤니케이션' },
  { _key: 'ml-senior', grade: '특급', default_role: 'ML 엔지니어', monthly_rate: 11000000, description: '모델 설계 및 고난도 튜닝' },
  { _key: 'ml', grade: '고급', default_role: 'ML 엔지니어', monthly_rate: 9000000, description: '모델 학습/평가/배포' },
  { _key: 'be', grade: '고급', default_role: 'BE 엔지니어', monthly_rate: 8500000, description: 'API/인프라 개발' },
  { _key: 'fe', grade: '중급', default_role: 'FE 엔지니어', monthly_rate: 6500000, description: '화면 개발 및 UX 구현' },
  { _key: 'qa', grade: '초급', default_role: 'QA', monthly_rate: 4500000, description: '테스트 및 품질 검증' },
]);

const customerIds = insert('customers', [
  { _key: 'c1', company_name: '한빛테크놀로지', business_number: '101-81-12345', industry: '제조', contact_name: '김한빛', contact_position: '팀장', phone: '02-1234-5678', email: 'hanbit@example.com', address: '서울시 강남구 테헤란로 123', notes: '' },
  { _key: 'c2', company_name: '서울금융그룹', business_number: '102-81-23456', industry: '금융', contact_name: '박서울', contact_position: '과장', phone: '02-2345-6789', email: 'seoul-fg@example.com', address: '서울시 영등포구 여의대로 45', notes: '연 1회 계약 갱신' },
  { _key: 'c3', company_name: '대한물류', business_number: '103-81-34567', industry: '물류', contact_name: '이대한', contact_position: '부장', phone: '031-345-6789', email: 'daehan-logi@example.com', address: '경기도 성남시 분당구 판교로 99', notes: '' },
  { _key: 'c4', company_name: '그린에너지', business_number: '104-81-45678', industry: '에너지', contact_name: '최그린', contact_position: '차장', phone: '042-456-7890', email: 'green-energy@example.com', address: '대전시 유성구 대학로 12', notes: '' },
  { _key: 'c5', company_name: '스마트헬스케어', business_number: '105-81-56789', industry: '의료', contact_name: '정건강', contact_position: '대리', phone: '051-567-8901', email: 'smart-health@example.com', address: '부산시 해운대구 센텀로 34', notes: '개인정보 취급 계약서 별도 필요' },
]);

const quoteIds = insert('quotes', [
  {
    _key: 'q1',
    quote_number: 'QT-2026-06-001',
    quote_title: '한빛테크놀로지 문서 자동화 도입',
    reference: '',
    customer_id: customerIds.c1,
    customer_name: '한빛테크놀로지',
    customer_contact: '김한빛',
    customer_email: 'hanbit@example.com',
    customer_phone: '02-1234-5678',
    customer_address: '서울시 강남구 테헤란로 123',
    sales_rep_name: '홍길동',
    sales_rep_email: 'gildong.hong@lomin.co.kr',
    sales_rep_phone: '010-1111-2222',
    issue_date: '2026-06-05',
    valid_until: '2026-07-05',
    status: '계약됨',
    tax_rate: 10,
    license_subtotal: 9800000,
    service_subtotal: 27000000,
    subtotal: 36800000,
    tax_amount: 3680000,
    total: 40480000,
    payment_terms: '계약금 50% / 검수 후 50%',
    notes: '1차 도입 범위: 본사 1개 부서',
    internal_memo: '2차 확장 논의 예정',
  },
  {
    _key: 'q2',
    quote_number: 'QT-2026-07-001',
    quote_title: '서울금융그룹 IDP 플랫폼 연간 구독',
    reference: 'RFP-2026-07',
    customer_id: customerIds.c2,
    customer_name: '서울금융그룹',
    customer_contact: '박서울',
    customer_email: 'seoul-fg@example.com',
    customer_phone: '02-2345-6789',
    customer_address: '서울시 영등포구 여의대로 45',
    sales_rep_name: '홍길동',
    sales_rep_email: 'gildong.hong@lomin.co.kr',
    sales_rep_phone: '010-1111-2222',
    issue_date: '2026-07-10',
    valid_until: '2026-08-09',
    status: '발송됨',
    tax_rate: 10,
    license_subtotal: 30000000,
    service_subtotal: 9000000,
    subtotal: 39000000,
    tax_amount: 3900000,
    total: 42900000,
    payment_terms: '월 정기결제',
    notes: '',
    internal_memo: '경쟁사 A사와 비교 검토 중',
  },
  {
    _key: 'q3',
    quote_number: 'QT-2026-08-001',
    quote_title: '대한물류 ERP 연동 구축',
    reference: '',
    customer_id: customerIds.c3,
    customer_name: '대한물류',
    customer_contact: '이대한',
    customer_email: 'daehan-logi@example.com',
    customer_phone: '031-345-6789',
    customer_address: '경기도 성남시 분당구 판교로 99',
    sales_rep_name: '김영업',
    sales_rep_email: 'sales.kim@lomin.co.kr',
    sales_rep_phone: '010-3333-4444',
    issue_date: '2026-08-12',
    valid_until: '2026-09-11',
    status: '발송전',
    tax_rate: 10,
    license_subtotal: 4200000,
    service_subtotal: 17500000,
    subtotal: 21700000,
    tax_amount: 2170000,
    total: 23870000,
    payment_terms: '검수 후 일괄 결제',
    notes: '',
    internal_memo: '',
  },
]);

insert('quote_items', [
  { quote_id: quoteIds.q1, item_type: '제품(S/W라이선스)', name: 'LomOCR Standard', classification: '운영', grade: '', description: '문서 인식 표준 라이선스 1식', remark: '', quantity: 1, list_price: 12000000, list_amount: 12000000, unit_price: 9800000, amount: 9800000, sort_order: 1 },
  { quote_id: quoteIds.q1, item_type: '서비스(개발/구축)', name: '요구사항 분석 및 PM', grade: '특급', description: '프로젝트 총괄 관리', remark: '', quantity: 1, list_price: 12000000, list_amount: 12000000, unit_price: 12000000, amount: 12000000, sort_order: 2 },
  { quote_id: quoteIds.q1, item_type: '서비스(개발/구축)', name: '연동 개발', grade: '고급', description: '기존 시스템 연동 개발', remark: '', quantity: 1.5, list_price: 8500000, list_amount: 12750000, unit_price: 8500000, amount: 12750000, sort_order: 3 },
  { quote_id: quoteIds.q1, item_type: '서비스(개발/구축)', name: 'QA/검수', grade: '초급', description: '통합 테스트', remark: '', quantity: 0.5, list_price: 4500000, list_amount: 2250000, unit_price: 4500000, amount: 2250000, sort_order: 4 },

  { quote_id: quoteIds.q2, item_type: '제품(S/W라이선스)', name: 'LomIDP Platform', classification: '운영', grade: '', description: '지능형 문서 처리 플랫폼 연간 구독', remark: '', quantity: 1, list_price: 36000000, list_amount: 36000000, unit_price: 30000000, amount: 30000000, sort_order: 1 },
  { quote_id: quoteIds.q2, item_type: '서비스(개발/구축)', name: '초기 구축 컨설팅', grade: '특급', description: '도입 컨설팅 및 초기 설정', remark: '', quantity: 1, list_price: 11000000, list_amount: 11000000, unit_price: 9000000, amount: 9000000, sort_order: 2 },

  { quote_id: quoteIds.q3, item_type: '제품(S/W라이선스)', name: 'ERP Connector Module', classification: '개발', grade: '', description: 'ERP 연동 모듈 라이선스', remark: '', quantity: 1, list_price: 5000000, list_amount: 5000000, unit_price: 4200000, amount: 4200000, sort_order: 1 },
  { quote_id: quoteIds.q3, item_type: '서비스(개발/구축)', name: 'ERP 연동 개발', grade: '고급', description: '대한물류 ERP API 연동', remark: '', quantity: 1, list_price: 8500000, list_amount: 8500000, unit_price: 8500000, amount: 8500000, sort_order: 2 },
  { quote_id: quoteIds.q3, item_type: '서비스(개발/구축)', name: '화면 개발', grade: '중급', description: '관리자 화면 개발', remark: '', quantity: 1, list_price: 6500000, list_amount: 6500000, unit_price: 6500000, amount: 6500000, sort_order: 3 },
  { quote_id: quoteIds.q3, item_type: '서비스(개발/구축)', name: '테스트/검수', grade: '초급', description: '기능 테스트', remark: '', quantity: 0.5, list_price: 4500000, list_amount: 2250000, unit_price: 4500000, amount: 2250000, sort_order: 4 },
]);

console.log('[seed] Done.');

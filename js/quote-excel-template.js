/* ============================================================
   견적서 엑셀 "템플릿" 정의 파일
   ------------------------------------------------------------
   이 파일은 견적서 엑셀 문서의 전체 레이아웃(표 구조, 병합 셀,
   테두리, 배경색, 폰트, 컬럼 너비, 로고 배치 등 모든 서식)을
   정의하는 "템플릿" 역할을 합니다.

   실제 다운로드 시에는 quote-detail.js가 buildQuoteWorkbook(quote, items)를
   호출하며, 이 함수는 아래 정의된 템플릿 구조에 실제 견적 데이터만
   주입하여 워크북(엑셀 파일)을 완성합니다.

   ⚠️ 문서 서식(레이아웃/색상/컬럼 너비 등)을 바꾸고 싶다면 이 파일의
      STYLE 상수와 각 build* 함수만 수정하면 되고, 데이터 채우는 로직
      (js/quote-detail.js의 exportQuoteToExcel)은 건드릴 필요가 없습니다.
   ============================================================ */

/* ---------------- 템플릿 상수 ---------------- */
const QUOTE_XLSX_COLUMN_WIDTHS = [16, 30, 14, 12, 14, 14, 14, 14, 14]; // A~I, 총 9열

const XLSX_COLORS = {
  headerBg: 'FFE0F2FE',   // 항목 표 헤더 배경 (sky-50 유사)
  labelBg: 'FFF1F5F9',    // 라벨 셀 배경 (slate-50 유사)
  subtotalBg: 'FFECFDF5', // 섹션 소계 배경 (emerald-50 유사)
  totalBg: 'FFFFF7ED',    // 총액(VAT 제외) 배경 (orange-50 유사)
  totalBg2: 'FFFFEDD5',   // 총액(VAT 포함) 배경 (orange-100 유사)
  border: 'FFCBD5E1',     // 일반 테두리 (slate-300 유사)
  borderDark: 'FF334155', // 강조 테두리 (slate-700 유사)
  textDark: 'FF1E293B',
  textGray: 'FF64748B',
  indigo: 'FF4338CA',
};

function thinBorder(color) {
  const style = { style: 'thin', color: { argb: color || XLSX_COLORS.border } };
  return { top: style, left: style, bottom: style, right: style };
}

/* ---------------- 자동 줄바꿈 행 높이 계산 ----------------
   ExcelJS/Excel은 wrapText:true를 켜도 행 높이를 자동으로 늘려주지 않으므로,
   텍스트 길이와 컬럼(병합) 너비를 기반으로 필요한 줄 수를 추정해
   행 높이를 계산합니다. 한글 등 전각 문자는 폭에 가중치를 두어 계산해
   텍스트가 잘리는 것을 방지합니다. */
const FULLWIDTH_CHAR_WEIGHT = 1.2; // 한글 등 전각 문자 폭 가중치(반각 문자 기준 배수)

function estimateWrappedLines(text, colWidthChars) {
  if (!text) return 1;
  const effectiveWidth = Math.max(colWidthChars - 2, 4); // 셀 좌우 여백 보정
  let totalLines = 0;
  String(text).split('\n').forEach(paragraph => {
    let width = 0;
    for (const ch of paragraph) {
      width += /[\u3131-\uD79D\uAC00-\uD7A3]/.test(ch) ? FULLWIDTH_CHAR_WEIGHT : 1; // 한글 등 전각 문자 가중치
    }
    totalLines += Math.max(1, Math.ceil(width / effectiveWidth));
  });
  return Math.max(1, totalLines);
}

function rowHeightForWrappedText(texts, minHeight) {
  // texts: [{ text, colWidthChars, fontSize }, ...] 중 가장 많은 줄 수를 요구하는 셀 기준으로 계산
  let maxLines = 1;
  let maxFontSize = 10;
  texts.forEach(({ text, colWidthChars, fontSize }) => {
    const lines = estimateWrappedLines(text, colWidthChars);
    if (lines > maxLines) maxLines = lines;
    if (fontSize) maxFontSize = Math.max(maxFontSize, fontSize);
  });
  const lineHeight = maxFontSize * 1.6; // pt 단위 근사치 (줄간격 포함)
  return Math.max(minHeight || 18, Math.round(maxLines * lineHeight + 6));
}

/* ---------------- 공통 헬퍼 ---------------- */
function applyBorderToRange(sheet, r1, c1, r2, c2, border) {
  for (let r = r1; r <= r2; r++) {
    for (let c = c1; c <= c2; c++) {
      sheet.getCell(r, c).border = border;
    }
  }
}

function setMergedCell(sheet, r1, c1, r2, c2, value, opts = {}) {
  if (r1 !== r2 || c1 !== c2) sheet.mergeCells(r1, c1, r2, c2);
  const cell = sheet.getCell(r1, c1);
  cell.value = value;
  if (opts.font) cell.font = opts.font;
  if (opts.fill) cell.fill = opts.fill;
  if (opts.alignment) cell.alignment = opts.alignment;
  if (opts.numFmt) cell.numFmt = opts.numFmt;
  if (opts.border) applyBorderToRange(sheet, r1, c1, r2, c2, opts.border);
  return cell;
}

async function fetchLogoBuffer() {
  try {
    const res = await fetch('images/lomin-logo.png');
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch (e) {
    console.warn('로고 이미지 로드 실패(무시하고 진행):', e);
    return null;
  }
}

/* ---------------- 섹션 1: 로고 + 문서 타이틀 ---------------- */
async function buildHeaderBanner(sheet, workbook, startRow) {
  const r1 = startRow, r2 = startRow + 2; // 3행 사용

  setMergedCell(sheet, r1, 2, r1, 3, 'Lomin Inc.', {
    font: { bold: true, size: 16, color: { argb: XLSX_COLORS.textDark } },
    alignment: { vertical: 'bottom', horizontal: 'left' },
  });
  setMergedCell(sheet, r1 + 1, 2, r2, 3, 'Document AI 솔루션 전문기업', {
    font: { size: 9, color: { argb: XLSX_COLORS.textGray } },
    alignment: { vertical: 'top', horizontal: 'left' },
  });
  setMergedCell(sheet, r1, 4, r1 + 1, 9, '견 적 서', {
    font: { bold: true, size: 22, color: { argb: XLSX_COLORS.textDark } },
    alignment: { vertical: 'middle', horizontal: 'right' },
  });
  setMergedCell(sheet, r2, 4, r2, 9, 'QUOTATION', {
    font: { size: 10, color: { argb: XLSX_COLORS.textGray } },
    alignment: { vertical: 'middle', horizontal: 'right' },
  });
  applyBorderToRange(sheet, r2, 1, r2, 9, { bottom: { style: 'medium', color: { argb: XLSX_COLORS.borderDark } } });

  sheet.getRow(r1).height = 22;
  sheet.getRow(r1 + 1).height = 16;
  sheet.getRow(r2).height = 16;

  try {
    const logoBuf = await fetchLogoBuffer();
    if (logoBuf) {
      const imageId = workbook.addImage({ buffer: logoBuf, extension: 'png' });
      sheet.addImage(imageId, { tl: { col: 0.75, row: r1 - 1 + 0.2 }, ext: { width: 96, height: 36 } });
    }
  } catch (e) {
    console.warn('로고 삽입 실패(무시하고 진행):', e);
  }

  return r2 + 1;
}

/* ---------------- 섹션 2: 견적 정보표 ----------------
   견적번호/발행일/유효기한을 별도 요약 카드로 분리하지 않고,
   견적 정보표의 첫 두 행에 통합하여 5행 x 3열 그리드로 구성합니다.
   좌(A~C): 견적번호/견적명/수신/참조/연락처(고객)
   중(D~F): 발행일/유효기한/견적담당/연락처(영업대표)/이메일
   우(G~I): 사업자등록번호/회사명/대표이사/주소/대표전화 (Lomin 고정 정보) */
function buildCompanyInfoTable(sheet, startRow, quote) {
  const r0 = startRow;
  const labelStyle = {
    font: { bold: true, size: 10, color: { argb: XLSX_COLORS.textDark } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: XLSX_COLORS.labelBg } },
    alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
    border: thinBorder(),
  };
  const valueStyle = {
    font: { size: 10, color: { argb: XLSX_COLORS.textDark } },
    alignment: { horizontal: 'left', vertical: 'middle', wrapText: true },
    border: thinBorder(),
  };

  const rowsDef = [
    ['견적번호', quote.quote_number || '-', '발행일', formatDate(quote.issue_date), '사업자등록번호', COMPANY_INFO.business_number],
    ['견적명', quote.quote_title || '-', '유효기간', formatDate(quote.valid_until), '회사명', COMPANY_INFO.company_name],
    ['수신', quote.customer_contact || '-', '견적담당', quote.sales_rep_name || '-', '대표이사', COMPANY_INFO.ceo_name],
    ['참조', quote.reference || '-', '연락처', quote.sales_rep_phone || '-', '주소', COMPANY_INFO.address],
    ['연락처', quote.customer_phone || '-', '이메일', quote.sales_rep_email || '-', '대표전화', COMPANY_INFO.phone],
  ];

  // 병합된 값 컬럼의 문자 단위 너비 (QUOTE_XLSX_COLUMN_WIDTHS 기준: B+C, E+F, H+I)
  const valueColWidthChars = QUOTE_XLSX_COLUMN_WIDTHS[1] + QUOTE_XLSX_COLUMN_WIDTHS[2]; // 컬럼 너비가 모두 동일하다는 전제하에 근사

  rowsDef.forEach((def, i) => {
    const r = r0 + i;
    const [labelA, valueA, labelD, valueD, labelG, valueG] = def;
    setMergedCell(sheet, r, 1, r, 1, labelA, labelStyle);
    setMergedCell(sheet, r, 2, r, 3, valueA, valueStyle);
    setMergedCell(sheet, r, 4, r, 4, labelD, labelStyle);
    setMergedCell(sheet, r, 5, r, 6, valueD, valueStyle);
    setMergedCell(sheet, r, 7, r, 7, labelG, labelStyle);
    setMergedCell(sheet, r, 8, r, 9, valueG, valueStyle);

    // 5개 행 모두 최소 30pt로 통일(주소 등 줄바꿈 내용이 가려지지 않도록). 내용이
    // 이보다 더 많은 줄을 필요로 하면 자동으로 더 커집니다.
    sheet.getRow(r).height = rowHeightForWrappedText([
      { text: valueA, colWidthChars: valueColWidthChars, fontSize: 10 },
      { text: valueD, colWidthChars: valueColWidthChars, fontSize: 10 },
      { text: valueG, colWidthChars: valueColWidthChars, fontSize: 10 },
    ], 30);
  });

  return r0 + rowsDef.length;
}

/* ---------------- 섹션 3: 항목 표 (01.S/W라이선스 / 02.개발비 공용) ---------------- */
function buildItemSection(sheet, startRow, opts) {
  const { title, items, headerLabels, numFmts, rowMapper, subtotalLabel, taxRate } = opts;
  let row = startRow;

  setMergedCell(sheet, row, 1, row, 9, title, {
    font: { bold: true, size: 13, color: { argb: XLSX_COLORS.textDark } },
    alignment: { horizontal: 'left', vertical: 'middle' },
  });
  sheet.getRow(row).height = 22;
  row += 1;

  const headerStyle = {
    font: { bold: true, size: 9, color: { argb: XLSX_COLORS.textGray } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: XLSX_COLORS.headerBg } },
    alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
    border: thinBorder(),
  };
  headerLabels.forEach((label, idx) => setMergedCell(sheet, row, idx + 1, row, idx + 1, label, headerStyle));
  sheet.getRow(row).height = 26;
  row += 1;

  const bodyBorder = thinBorder();
  items.forEach(item => {
    const values = rowMapper(item);
    values.forEach((val, idx) => {
      const cell = sheet.getCell(row, idx + 1);
      cell.value = val;
      cell.border = bodyBorder;
      const isNumber = typeof val === 'number';
      cell.alignment = {
        vertical: 'top',
        wrapText: idx === 0 || idx === 1, // 항목/업무활동, 설명 컬럼 모두 자동 줄바꿈
        horizontal: idx === 0 ? 'left' : (isNumber ? 'right' : 'center'),
      };
      cell.font = { size: 9, color: { argb: XLSX_COLORS.textDark }, bold: idx === 0 };
      if (isNumber && numFmts && numFmts[idx]) cell.numFmt = numFmts[idx];
    });
    // 항목/업무활동(A열), 설명(B열)이 길어 자동 줄바꿈되는 경우 행 높이를 자동 계산
    sheet.getRow(row).height = rowHeightForWrappedText([
      { text: values[0], colWidthChars: QUOTE_XLSX_COLUMN_WIDTHS[0], fontSize: 9 },
      { text: values[1], colWidthChars: QUOTE_XLSX_COLUMN_WIDTHS[1], fontSize: 9 },
    ], 18);
    row += 1;
  });

  const subtotal = items.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
  const withTax = Math.round(subtotal * (1 + (taxRate || 0) / 100));
  const subtotalStyle = {
    font: { bold: true, size: 10, color: { argb: XLSX_COLORS.textDark } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: XLSX_COLORS.subtotalBg } },
    alignment: { horizontal: 'right', vertical: 'middle' },
    border: thinBorder(),
  };

  setMergedCell(sheet, row, 1, row, 7, `${subtotalLabel} (VAT 제외)`, subtotalStyle);
  setMergedCell(sheet, row, 8, row, 9, subtotal, { ...subtotalStyle, numFmt: '#,##0"원"' });
  row += 1;

  setMergedCell(sheet, row, 1, row, 7, `${subtotalLabel} (VAT 포함)`, subtotalStyle);
  setMergedCell(sheet, row, 8, row, 9, withTax, { ...subtotalStyle, numFmt: '#,##0"원"' });
  row += 1;

  return row;
}

/* ---------------- 섹션 4: 총 제안 금액 ---------------- */
function buildGrandTotal(sheet, startRow, quote) {
  let row = startRow;
  const style1 = {
    font: { bold: true, size: 13, color: { argb: XLSX_COLORS.textDark } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: XLSX_COLORS.totalBg } },
    alignment: { horizontal: 'right', vertical: 'middle' },
    border: thinBorder(XLSX_COLORS.borderDark),
  };
  const style2 = {
    font: { bold: true, size: 13, color: { argb: XLSX_COLORS.indigo } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: XLSX_COLORS.totalBg2 } },
    alignment: { horizontal: 'right', vertical: 'middle' },
    border: thinBorder(XLSX_COLORS.borderDark),
  };

  setMergedCell(sheet, row, 1, row, 7, '총 제안 금액 (VAT 제외)', style1);
  setMergedCell(sheet, row, 8, row, 9, Number(quote.subtotal) || 0, { ...style1, numFmt: '#,##0"원"' });
  sheet.getRow(row).height = 22;
  row += 1;

  setMergedCell(sheet, row, 1, row, 7, '총 제안 금액 (VAT 포함)', style2);
  setMergedCell(sheet, row, 8, row, 9, Number(quote.total) || 0, { ...style2, numFmt: '#,##0"원"' });
  sheet.getRow(row).height = 24;
  row += 1;

  return row;
}

/* ---------------- 섹션 5: 결제조건 / 비고 ---------------- */
function buildNotesSection(sheet, startRow, quote) {
  let row = startRow;
  const labelStyle = { font: { bold: true, size: 9, color: { argb: XLSX_COLORS.textGray } }, alignment: { vertical: 'middle' } };
  const valueStyle = {
    font: { size: 10, color: { argb: XLSX_COLORS.textDark } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: XLSX_COLORS.labelBg } },
    alignment: { horizontal: 'left', vertical: 'top', wrapText: true },
    border: thinBorder(),
  };

  if (quote.payment_terms) {
    setMergedCell(sheet, row, 1, row, 9, '결제 조건', labelStyle);
    row += 1;
    setMergedCell(sheet, row, 1, row, 9, quote.payment_terms, valueStyle);
    sheet.getRow(row).height = Math.max(24, Math.ceil(quote.payment_terms.length / 90) * 15 + 10);
    row += 1;
  }
  if (quote.notes) {
    setMergedCell(sheet, row, 1, row, 9, '비고', labelStyle);
    row += 1;
    setMergedCell(sheet, row, 1, row, 9, quote.notes, valueStyle);
    const lineCount = quote.notes.split('\n').length;
    sheet.getRow(row).height = Math.max(24, lineCount * 15 + 10);
    row += 1;
  }
  return row;
}

/* ---------------- 섹션 6: 하단 안내문 ---------------- */
function buildFooter(sheet, startRow) {
  const row = startRow;
  setMergedCell(sheet, row, 1, row, 9,
    '본 견적서는 Lomin Inc.에서 발행하였으며, 명시된 유효기한 이후에는 가격 조건이 변경될 수 있습니다.', {
      font: { size: 8, italic: true, color: { argb: XLSX_COLORS.textGray } },
      alignment: { horizontal: 'center', vertical: 'middle' },
      border: { top: { style: 'thin', color: { argb: XLSX_COLORS.border } } },
    });
  sheet.getRow(row).height = 20;
  return row + 1;
}

/* ============================================================
   템플릿 조립 진입점
   견적(quote)과 항목 목록(items)을 받아 완성된 ExcelJS 워크북을 반환합니다.
   ============================================================ */
async function buildQuoteWorkbook(quote, items) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Lomin 견적관리 시스템';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('견적서', {
    views: [{ showGridLines: false }],
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToWidth: 1, fitToHeight: 0 },
  });
  QUOTE_XLSX_COLUMN_WIDTHS.forEach((w, i) => { sheet.getColumn(i + 1).width = w; });

  const licenseItems = items.filter(i => i.item_type === '제품(S/W라이선스)');
  const serviceItems = items.filter(i => i.item_type === '서비스(개발/구축)');
  const miscItems = items.filter(i => i.item_type === '기타(HW/3rd-party 등)');
  const taxRate = Number(quote.tax_rate) || 0;

  let row = 1;
  row = await buildHeaderBanner(sheet, workbook, row);
  row += 1;
  row = buildCompanyInfoTable(sheet, row, quote);
  row += 1;

  if (licenseItems.length) {
    row = buildItemSection(sheet, row, {
      title: '01. S/W 라이선스',
      items: licenseItems,
      headerLabels: ['항목', '설명', '구분', '수량(Q)', '소비자단가(LP)', '소비자금액(Q*LP)', '제안단가(P)', '제안금액(Q*P)', '비고'],
      numFmts: [null, null, null, '#,##0', '#,##0"원"', '#,##0"원"', '#,##0"원"', '#,##0"원"', null],
      rowMapper: item => [
        item.name || '-', item.description || '-', item.classification || '-',
        Number(item.quantity) || 0, Number(item.list_price) || 0, Number(item.list_amount) || 0,
        Number(item.unit_price) || 0, Number(item.amount) || 0, item.remark || '-',
      ],
      subtotalLabel: 'S/W 제안 금액',
      taxRate,
    });
    row += 1;
  }

  if (serviceItems.length) {
    row = buildItemSection(sheet, row, {
      title: '02. 개발비',
      items: serviceItems,
      headerLabels: ['업무활동', '설명', '등급', '수량(M/M)(Q)', '소비자단가(LP)', '소비자금액(MM*LP)', '제안단가(P)', '제안금액(Q*P)', '비고'],
      numFmts: [null, null, null, '0.00', '#,##0"원"', '#,##0"원"', '#,##0"원"', '#,##0"원"', null],
      rowMapper: item => [
        item.name || '-', item.description || '-', item.grade || '-',
        Number(item.quantity) || 0, Number(item.list_price) || 0, Number(item.list_amount) || 0,
        Number(item.unit_price) || 0, Number(item.amount) || 0, item.remark || '-',
      ],
      subtotalLabel: '개발비 제안금액',
      taxRate,
    });
    row += 1;
  }

  if (miscItems.length) {
    row = buildItemSection(sheet, row, {
      title: '03. 기타 품목',
      items: miscItems,
      headerLabels: ['항목', '설명', '구분', '수량(Q)', '소비자단가(LP)', '소비자금액(Q*LP)', '제안단가(P)', '제안금액(Q*P)', '비고'],
      numFmts: [null, null, null, '#,##0', '#,##0"원"', '#,##0"원"', '#,##0"원"', '#,##0"원"', null],
      rowMapper: item => [
        item.name || '-', item.description || '-', item.classification || '-',
        Number(item.quantity) || 0, Number(item.list_price) || 0, Number(item.list_amount) || 0,
        Number(item.unit_price) || 0, Number(item.amount) || 0, item.remark || '-',
      ],
      subtotalLabel: '기타 품목 제안금액',
      taxRate,
    });
    row += 1;
  }

  row = buildGrandTotal(sheet, row, quote);
  row += 1;
  row = buildNotesSection(sheet, row, quote);
  row += 1;
  buildFooter(sheet, row);

  return workbook;
}

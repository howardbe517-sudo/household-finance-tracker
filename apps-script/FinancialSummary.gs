/**
 * Financial Summary: the whole-household picture, right after the Dashboard. Averages over the
 * last N full months (N typed in B3), a month-by-month history, then Savings & Reserves, Debts,
 * Income by Person, Payroll Deductions, Credit Scores and Net Worth. All formulas; rebuilt by
 * buildWorkbook / upgradeWorkbook (the N input is kept).
 */

const FINSUM = {
  MONTHS_CELL: 'B3', MONTHS_DEFAULT: 3,
  CARD_LABEL: 5, CARD_VALUE: 6, CARD_SUB: 7,
  HIST_BAR: 9, HIST_HEADER: 10, HIST_FIRST: 11, HIST_COUNT: 12,
  FUNDS_BAR: 24, FUNDS_HEADER: 25, FUNDS_FIRST: 26, FUNDS_COUNT: 8,
  DEBT_BAR: 35, DEBT_LABEL: 36, DEBT_VALUE: 37, DEBT_NOTE: 38,
  INCOME_BAR: 40, INCOME_HEADER: 41, INCOME_BEN: 42, INCOME_VAL: 43, INCOME_HH: 44,
  PAYROLL_BAR: 46, PAYROLL_GROUPS: 47, PAYROLL_HEADER: 48, PAYROLL_FIRST: 49, PAYROLL_TOTAL: 55,
  CREDIT_BAR: 57, CREDIT_HEADER: 58, CREDIT_BEN: 59, CREDIT_VAL: 60, CREDIT_NOTE: 61,
  NW_BAR: 63, NW_LABEL: 64, NW_VALUE: 65, NW_NOTE: 66,
  LAST_ROW: 68,
};

function buildFinancialSummary_() {
  const sh = getOrCreateSheet_(SHEETS.FINSUM);
  const F = (t) => resolveFormula_(t, null, null);
  sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).breakApart();
  sh.clear(); // SAFETY-APPROVED: the Financial Summary is calculated (formulas only, one input kept by the upgrade); rebuilt by buildWorkbook / upgradeWorkbook
  sh.clearConditionalFormatRules();
  sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).clearDataValidations();
  sh.getProtections(SpreadsheetApp.ProtectionType.SHEET).forEach(p => p.remove());
  ensureSheetSize_(sh, FINSUM.LAST_ROW, 9);
  sh.setHiddenGridlines(true);
  sh.setColumnWidth(1, 200);
  for (let c = 2; c <= 9; c++) sh.setColumnWidth(c, 118);
  sh.getRange(1, 1, FINSUM.LAST_ROW, 9).setFontColor(COLORS.TEXT).setFontSize(10).setVerticalAlignment('middle');
  const put = (a1, v) => { const r = sh.getRange(a1); if (typeof v === 'string' && v.charAt(0) === '=') r.setFormula(v); else r.setValue(v); return r; };
  const mergePut = (a1, v) => { const r = sh.getRange(a1).merge(); if (typeof v === 'string' && v.charAt(0) === '=') r.setFormula(v); else r.setValue(v); return r; };
  const header = (a1, values) => { const r = sh.getRange(a1); r.setValues([values]); styleHeader_(r); r.setHorizontalAlignment('center'); };
  const N = '$B$3';
  const CUR = 'DATE(YEAR(TODAY()),MONTH(TODAY()),1)';
  const PSTART = 'EDATE(' + CUR + ',-' + N + ')', PEND = 'EDATE(' + CUR + ',-1)';
  const inPeriod = (tbl) => '[' + tbl + '.month],">="&' + PSTART + ',[' + tbl + '.month],"<="&' + PEND;
  const avg = (tbl, col, extra) => 'IFERROR(SUMIFS([' + tbl + '.' + col + '],' + inPeriod(tbl) + (extra || '') + ')/' + N + ',0)';

  /* --- title, period input --- */
  mergePut('A1:I1', 'Financial Summary').setBackground(COLORS.NAVY).setFontColor(COLORS.WHITE).setFontSize(16).setFontWeight('bold');
  sh.setRowHeight(1, 40);
  mergePut('A2:I2', 'The whole picture: averages over the last full months, the month-by-month history, savings funds, debts, income by person, payroll deductions, credit scores and net worth. The current month is left out of the averages because it is not finished.')
    .setFontStyle('italic').setFontColor(COLORS.MUTED_TEXT).setFontSize(9);
  put('A3', 'Averages over the last').setFontWeight('bold');
  put('B3', FINSUM.MONTHS_DEFAULT).setBackground(COLORS.INPUT).setFontWeight('bold').setHorizontalAlignment('center')
    .setBorder(true, true, true, true, false, false, COLORS.NAVY, SpreadsheetApp.BorderStyle.SOLID)
    .setDataValidation(SpreadsheetApp.newDataValidation().requireNumberBetween(1, 24).setAllowInvalid(false).setHelpText('How many full months to average (1–24).').build());
  mergePut('C3:I3', '="full months: "&TEXT(' + PSTART + ',"mmm yyyy")&" – "&TEXT(' + PEND + ',"mmm yyyy")').setFontColor(COLORS.MUTED_TEXT).setFontSize(9);

  /* --- four averages --- */
  const cards = [
    { cols: 'A:B', label: 'Average Monthly Gross', color: COLORS.CARD_GROSS, f: F('=' + avg('INCOME', 'gross')), sub: 'Income table' },
    { cols: 'C:D', label: 'Average Monthly Take-Home', color: COLORS.CARD_TAKEHOME, f: F('=' + avg('INCOME', 'takeHome')), sub: 'Income table' },
    { cols: 'E:F', label: 'Average Monthly Spending', color: COLORS.CARD_SPENDING, f: F('=' + avg('SUMMARY', 'spending')), sub: 'Monthly Summary · expenses − refunds' },
    { cols: 'G:H', label: 'Average Monthly Savings', color: COLORS.CARD_SAVINGS, f: F('=' + avg('SUMMARY', 'totalSavings')),
      sub: F('=IFERROR("cash savings + payroll retirement · "&TEXT(' + avg('SUMMARY', 'totalSavings') + '/' + avg('INCOME', 'takeHome') + ',"0.0%")&" of take-home","cash savings + payroll retirement")') },
  ];
  cards.forEach(card => {
    const [c1, c2] = card.cols.split(':');
    mergePut(c1 + FINSUM.CARD_LABEL + ':' + c2 + FINSUM.CARD_LABEL, card.label).setBackground(card.color).setFontWeight('bold').setHorizontalAlignment('center');
    mergePut(c1 + FINSUM.CARD_VALUE + ':' + c2 + FINSUM.CARD_VALUE, card.f).setBackground(card.color).setFontSize(18).setFontWeight('bold').setHorizontalAlignment('center').setNumberFormat('$#,##0');
    mergePut(c1 + FINSUM.CARD_SUB + ':' + c2 + FINSUM.CARD_SUB, card.sub).setBackground(card.color).setFontSize(8).setFontColor(COLORS.MUTED_TEXT).setHorizontalAlignment('center');
    sh.getRange(c1 + FINSUM.CARD_LABEL + ':' + c2 + FINSUM.CARD_SUB).setBorder(true, true, true, true, false, false, COLORS.WHITE, SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
  });
  sh.setRowHeight(FINSUM.CARD_VALUE, 42);

  /* --- month by month --- */
  styleSectionBar_(sh.getRange('A' + FINSUM.HIST_BAR + ':I' + FINSUM.HIST_BAR), 'Month by month — most recent first');
  header('A' + FINSUM.HIST_HEADER + ':G' + FINSUM.HIST_HEADER, ['Month', 'Gross', 'Take-Home', 'Spending', 'Savings', 'Debt Payments', 'Left Over']);
  for (let k = 0; k < FINSUM.HIST_COUNT; k++) {
    const r = FINSUM.HIST_FIRST + k;
    const m = 'EDATE(' + CUR + ',-' + (k + 1) + ')';
    put('A' + r, '=' + m).setNumberFormat('mmmm yyyy').setFontWeight('bold');
    put('B' + r, F('=SUMIFS([INCOME.gross],[INCOME.month],$A' + r + ')'));
    put('C' + r, F('=SUMIFS([INCOME.takeHome],[INCOME.month],$A' + r + ')'));
    put('D' + r, F('=SUMIFS([SUMMARY.spending],[SUMMARY.month],$A' + r + ')'));
    put('E' + r, F('=SUMIFS([SUMMARY.totalSavings],[SUMMARY.month],$A' + r + ')'));
    put('F' + r, F('=SUMIFS([SUMMARY.debtPayments],[SUMMARY.month],$A' + r + ')'));
    put('G' + r, F('=SUMIFS([SUMMARY.cashRemaining],[SUMMARY.month],$A' + r + ')'));
    sh.getRange('B' + r + ':G' + r).setNumberFormat(FORMATS.currency);
  }
  const histLast = FINSUM.HIST_FIRST + FINSUM.HIST_COUNT - 1;
  sh.getRange('A' + FINSUM.HIST_HEADER + ':G' + histLast).setBorder(true, true, true, true, true, true, COLORS.BORDER, SpreadsheetApp.BorderStyle.SOLID);
  mergePut('H' + FINSUM.HIST_HEADER + ':I' + histLast, 'Left Over = take-home − spending − cash savings − debt payments, from Monthly Summary. A month with no paychecks or transactions shows zeros.')
    .setFontSize(8).setFontColor(COLORS.MUTED_TEXT).setFontStyle('italic').setWrap(true).setVerticalAlignment('top');

  /* --- Savings & Reserves --- */
  styleSectionBar_(sh.getRange('A' + FINSUM.FUNDS_BAR + ':I' + FINSUM.FUNDS_BAR), 'Savings & Reserves');
  header('A' + FINSUM.FUNDS_HEADER + ':G' + FINSUM.FUNDS_HEADER, ['Fund Name', 'Target', 'Current', 'Amount Needed', '% Funded', 'Planned Monthly', 'Status']);
  const fundCols = [['name', 'A'], ['target', 'B'], ['current', 'C'], ['amountNeeded', 'D'], ['pctFunded', 'E'], ['plannedMonthly', 'F'], ['status', 'G']];
  for (let k = 1; k <= FINSUM.FUNDS_COUNT; k++) {
    const r = FINSUM.FUNDS_FIRST + k - 1;
    fundCols.forEach(fc => put(fc[1] + r, F('=IF(INDEX([FUNDS.id],' + k + ')="","",INDEX([FUNDS.' + fc[0] + '],' + k + '))')));
    sh.getRange('B' + r + ':D' + r).setNumberFormat(FORMATS.currency);
    sh.getRange('E' + r).setNumberFormat(FORMATS.percent);
    sh.getRange('F' + r).setNumberFormat(FORMATS.currency);
  }
  const fundsLast = FINSUM.FUNDS_FIRST + FINSUM.FUNDS_COUNT - 1;
  sh.getRange('A' + FINSUM.FUNDS_HEADER + ':G' + fundsLast).setBorder(true, true, true, true, true, true, COLORS.BORDER, SpreadsheetApp.BorderStyle.SOLID);
  mergePut('H' + FINSUM.FUNDS_HEADER + ':I' + fundsLast, F('="Planned savings per month: "&TEXT(SUM([FUNDS.plannedMonthly]),"$#,##0")&". Raise or lower Planned Monthly on the Savings & Reserves tab; the Monthly Plan\'s flexible target moves the other way."'))
    .setFontSize(8).setFontColor(COLORS.MUTED_TEXT).setFontStyle('italic').setWrap(true).setVerticalAlignment('top');

  /* --- Debts --- */
  styleSectionBar_(sh.getRange('A' + FINSUM.DEBT_BAR + ':I' + FINSUM.DEBT_BAR), 'Debts');
  const dk = [
    ['A', 'B', 'Household Debt (excl. student loans)', F('=SUMIFS([DEBTS.latestBalance],[DEBTS.group],"<>Student Loans")')],
    ['C', 'D', 'Student Loans', F('=SUMIFS([DEBTS.latestBalance],[DEBTS.group],"Student Loans")')],
    ['E', 'F', 'All Debt', F('=SUM([DEBTS.latestBalance])')],
    ['G', 'H', 'Estimated Monthly Interest', F('=SUM([DEBTS.estMonthlyInterest])')],
  ];
  dk.forEach(d => {
    mergePut(d[0] + FINSUM.DEBT_LABEL + ':' + d[1] + FINSUM.DEBT_LABEL, d[2]).setBackground(COLORS.PALE_BLUE).setFontWeight('bold').setHorizontalAlignment('center');
    mergePut(d[0] + FINSUM.DEBT_VALUE + ':' + d[1] + FINSUM.DEBT_VALUE, d[3]).setNumberFormat(FORMATS.currency).setFontSize(14).setFontWeight('bold').setHorizontalAlignment('center')
      .setBorder(true, true, true, true, false, false, COLORS.BORDER, SpreadsheetApp.BorderStyle.SOLID);
  });
  mergePut('A' + FINSUM.DEBT_NOTE + ':I' + FINSUM.DEBT_NOTE, F('="Minimum payments total "&TEXT(SUM([DEBTS.minPayment]),"$#,##0")&" per month"&IFERROR(" · PSLF (lowest loan) "&TEXTJOIN(", ",TRUE,MAP(UNIQUE(FILTER([DEBTS.owner],([DEBTS.group]="Student Loans")*([DEBTS.pslfEstimated]<>""))),LAMBDA(o,o&" "&MINIFS([DEBTS.pslfEstimated],[DEBTS.owner],o,[DEBTS.group],"Student Loans")&"/120"))),"")&". Balances are live where a lender is connected; otherwise the latest Quarterly Debt Review. Details on the Debts tab."'))
    .setFontSize(8).setFontColor(COLORS.MUTED_TEXT).setFontStyle('italic');

  /* --- Income by Person: average per month over the period, and last month --- */
  styleSectionBar_(sh.getRange('A' + FINSUM.INCOME_BAR + ':I' + FINSUM.INCOME_BAR), 'Income by Person — average per month over the period');
  header('A' + FINSUM.INCOME_HEADER + ':F' + FINSUM.INCOME_HEADER, ['Person', 'Avg Gross', 'Avg Take-Home', 'Avg Deductions', 'Take-Home %', 'Last Month Take-Home']);
  [{ row: FINSUM.INCOME_BEN, name: 'Ben', color: COLORS.BEN }, { row: FINSUM.INCOME_VAL, name: 'Valerie', color: COLORS.VALERIE }].forEach(p => {
    put('A' + p.row, p.name).setFontWeight('bold');
    put('B' + p.row, F('=' + avg('INCOME', 'gross', ',[INCOME.person],$A' + p.row)));
    put('C' + p.row, F('=' + avg('INCOME', 'takeHome', ',[INCOME.person],$A' + p.row)));
    put('D' + p.row, '=B' + p.row + '-C' + p.row);
    put('E' + p.row, '=IF(B' + p.row + '>0,C' + p.row + '/B' + p.row + ',"")');
    put('F' + p.row, F('=SUMIFS([INCOME.takeHome],[INCOME.month],' + PEND + ',[INCOME.person],$A' + p.row + ')'));
    sh.getRange('A' + p.row + ':F' + p.row).setBackground(p.color);
  });
  const hh = FINSUM.INCOME_HH;
  put('A' + hh, 'Household').setFontWeight('bold');
  put('B' + hh, '=SUM(B' + FINSUM.INCOME_BEN + ':B' + FINSUM.INCOME_VAL + ')');
  put('C' + hh, '=SUM(C' + FINSUM.INCOME_BEN + ':C' + FINSUM.INCOME_VAL + ')');
  put('D' + hh, '=B' + hh + '-C' + hh);
  put('E' + hh, '=IF(B' + hh + '>0,C' + hh + '/B' + hh + ',"")');
  put('F' + hh, '=SUM(F' + FINSUM.INCOME_BEN + ':F' + FINSUM.INCOME_VAL + ')');
  sh.getRange('A' + hh + ':F' + hh).setBackground(COLORS.HOUSEHOLD).setFontWeight('bold');
  sh.getRange('B' + FINSUM.INCOME_BEN + ':D' + hh).setNumberFormat(FORMATS.currency);
  sh.getRange('F' + FINSUM.INCOME_BEN + ':F' + hh).setNumberFormat(FORMATS.currency);
  sh.getRange('E' + FINSUM.INCOME_BEN + ':E' + hh).setNumberFormat(FORMATS.percent);
  sh.getRange('A' + FINSUM.INCOME_HEADER + ':F' + hh).setBorder(true, true, true, true, true, true, COLORS.BORDER, SpreadsheetApp.BorderStyle.SOLID);

  /* --- Payroll Deductions: average per month --- */
  styleSectionBar_(sh.getRange('A' + FINSUM.PAYROLL_BAR + ':I' + FINSUM.PAYROLL_BAR), 'Payroll Deductions — average per month over the period');
  const groups = [
    { c1: 'A', c2: 'B', c3: 'C', name: 'Ben', color: COLORS.BEN, person: 'Ben', grossCell: '$B$' + FINSUM.INCOME_BEN },
    { c1: 'D', c2: 'E', c3: 'F', name: 'Valerie', color: COLORS.VALERIE, person: 'Valerie', grossCell: '$B$' + FINSUM.INCOME_VAL },
    { c1: 'G', c2: 'H', c3: 'I', name: 'Household', color: COLORS.HOUSEHOLD, person: null, grossCell: '$B$' + FINSUM.INCOME_HH },
  ];
  const deductions = [
    ['Federal Tax', 'fedTax'], ['State / Local Tax', 'stateTax'], ['Social Security & Medicare', 'ssMed'],
    ['Health / Insurance', 'health'], ['Retirement', 'retirement'], ['Other Deductions', 'otherDed'], ['Total Deductions', 'totalDed'],
  ];
  groups.forEach(g => {
    mergePut(g.c1 + FINSUM.PAYROLL_GROUPS + ':' + g.c3 + FINSUM.PAYROLL_GROUPS, g.name).setBackground(g.color).setFontWeight('bold').setHorizontalAlignment('center');
    header(g.c1 + FINSUM.PAYROLL_HEADER + ':' + g.c3 + FINSUM.PAYROLL_HEADER, ['Deduction', 'Amount', '% of Gross']);
    deductions.forEach((d, i) => {
      const r = FINSUM.PAYROLL_FIRST + i;
      put(g.c1 + r, d[0]);
      put(g.c2 + r, F('=' + avg('INCOME', d[1], g.person ? ',[INCOME.person],"' + g.person + '"' : ''))).setNumberFormat(FORMATS.currency);
      put(g.c3 + r, '=IF(' + g.grossCell + '>0,' + g.c2 + r + '/' + g.grossCell + ',"")').setNumberFormat(FORMATS.percent);
    });
    sh.getRange(g.c1 + FINSUM.PAYROLL_FIRST + ':' + g.c3 + FINSUM.PAYROLL_TOTAL).setBackground(g.color);
    sh.getRange(g.c1 + FINSUM.PAYROLL_TOTAL + ':' + g.c3 + FINSUM.PAYROLL_TOTAL).setFontWeight('bold');
    sh.getRange(g.c1 + FINSUM.PAYROLL_HEADER + ':' + g.c3 + FINSUM.PAYROLL_TOTAL).setBorder(true, true, true, true, true, true, COLORS.BORDER, SpreadsheetApp.BorderStyle.SOLID);
  });

  /* --- Credit Scores — Latest --- */
  styleSectionBar_(sh.getRange('A' + FINSUM.CREDIT_BAR + ':E' + FINSUM.CREDIT_BAR), 'Credit Scores — Latest');
  header('A' + FINSUM.CREDIT_HEADER + ':E' + FINSUM.CREDIT_HEADER, ['Person', 'Score', 'Rating', 'Updated', 'Position (300–850)']);
  [{ row: FINSUM.CREDIT_BEN, name: 'Ben', color: COLORS.BEN }, { row: FINSUM.CREDIT_VAL, name: 'Valerie', color: COLORS.VALERIE }].forEach(p => {
    const r = p.row;
    put('A' + r, p.name).setFontWeight('bold');
    put('D' + r, F('=IF(MAXIFS([CREDIT.scoreDate],[CREDIT.person],$A' + r + ')=0,"",MAXIFS([CREDIT.scoreDate],[CREDIT.person],$A' + r + '))')).setNumberFormat(FORMATS.date);
    put('B' + r, F('=IF($D' + r + '="","",IFERROR(INDEX(FILTER([CREDIT.score],[CREDIT.person]=$A' + r + ',[CREDIT.scoreDate]=$D' + r + '),1),""))')).setNumberFormat(FORMATS.int).setFontWeight('bold');
    put('C' + r, '=IF($B' + r + '="","No score yet",IFS($B' + r + '<580,"Poor",$B' + r + '<670,"Fair",$B' + r + '<740,"Good",$B' + r + '<800,"Very Good",TRUE,"Exceptional"))');
    put('E' + r, '=IF($B' + r + '="","",SPARKLINE(($B' + r + '-300)/550,{"charttype","bar";"max",1;"color1","' + COLORS.TEAL + '"}))');
    sh.getRange('A' + r + ':E' + r).setBackground(p.color);
  });
  sh.getRange('A' + FINSUM.CREDIT_HEADER + ':E' + FINSUM.CREDIT_VAL).setBorder(true, true, true, true, true, true, COLORS.BORDER, SpreadsheetApp.BorderStyle.SOLID);
  mergePut('A' + FINSUM.CREDIT_NOTE + ':I' + FINSUM.CREDIT_NOTE, 'Enter scores on the Credit Scores tab. Scale: 300–579 Poor · 580–669 Fair · 670–739 Good · 740–799 Very Good · 800–850 Exceptional. The Reminders tab flags a score that is getting old.')
    .setFontSize(8).setFontColor(COLORS.MUTED_TEXT).setFontStyle('italic');

  /* --- Net worth --- */
  styleSectionBar_(sh.getRange('A' + FINSUM.NW_BAR + ':I' + FINSUM.NW_BAR), 'Net worth');
  const assets = 'SUMIFS([ACCOUNTS.currentBalance],[ACCOUNTS.includeNW],"Yes",[ACCOUNTS.accountType],"<>Credit Card",[ACCOUNTS.accountType],"<>Loan",[ACCOUNTS.accountType],"<>Pension")';
  const unlinked = 'IFERROR(SUMIFS([ACCOUNTS.currentBalance],[ACCOUNTS.accountType],"Credit Card",[ACCOUNTS.includeNW],"Yes")-SUMPRODUCT(SUMIFS([ACCOUNTS.currentBalance],[ACCOUNTS.id],FILTER([DEBTS.linkedAccount],[DEBTS.linkedAccount]<>""),[ACCOUNTS.accountType],"Credit Card",[ACCOUNTS.includeNW],"Yes")),0)';
  const nwk = [
    ['A', 'B', 'Tracked Net Worth', F('=' + assets + '-' + unlinked + '-SUM([DEBTS.latestBalance])')],
    ['C', 'D', 'Excluding Student Loans', F('=' + assets + '-' + unlinked + '-SUMIFS([DEBTS.latestBalance],[DEBTS.group],"<>Student Loans")')],
    ['E', 'F', 'Tracked Assets', F('=' + assets)],
    ['G', 'H', 'Investments & Retirement', F('=SUMIFS([ACCOUNTS.currentBalance],[ACCOUNTS.includeNW],"Yes",[ACCOUNTS.accountType],"Investment")+SUMIFS([ACCOUNTS.currentBalance],[ACCOUNTS.includeNW],"Yes",[ACCOUNTS.accountType],"Retirement")+SUMIFS([ACCOUNTS.currentBalance],[ACCOUNTS.includeNW],"Yes",[ACCOUNTS.accountType],"HSA")')],
  ];
  nwk.forEach(d => {
    mergePut(d[0] + FINSUM.NW_LABEL + ':' + d[1] + FINSUM.NW_LABEL, d[2]).setBackground(COLORS.PALE_BLUE).setFontWeight('bold').setHorizontalAlignment('center');
    mergePut(d[0] + FINSUM.NW_VALUE + ':' + d[1] + FINSUM.NW_VALUE, d[3]).setNumberFormat(FORMATS.currency).setFontSize(14).setFontWeight('bold').setHorizontalAlignment('center')
      .setBorder(true, true, true, true, false, false, COLORS.BORDER, SpreadsheetApp.BorderStyle.SOLID);
  });
  mergePut('A' + FINSUM.NW_NOTE + ':I' + FINSUM.NW_NOTE, 'Assets are Accounts with Include in Net Worth = Yes (cards, loans and pensions excluded); cards linked to a Debts row are counted once, through Debts. Finance Tracker → Record net worth snapshot saves a monthly point on Net Worth Snapshots. Debt is reviewed quarterly (Mar · Jun · Sep · Dec) on the Quarterly Debt Review tab.')
    .setFontSize(8).setFontColor(COLORS.MUTED_TEXT).setFontStyle('italic').setWrap(true);
  sh.setRowHeight(FINSUM.NW_NOTE, 30);

  sh.setConditionalFormatRules([
    cfRule_(sh.getRange('G' + FINSUM.FUNDS_FIRST + ':G' + fundsLast), '=G' + FINSUM.FUNDS_FIRST + '="Funded"', COLORS.UNDER_FILL, COLORS.UNDER_FONT, { bold: true }),
    cfRule_(sh.getRange('G' + FINSUM.FUNDS_FIRST + ':G' + fundsLast), '=OR(G' + FINSUM.FUNDS_FIRST + '="Behind",G' + FINSUM.FUNDS_FIRST + '="Past Target Date")', COLORS.OVER_FILL, COLORS.OVER_FONT),
    cfRule_(sh.getRange('G' + FINSUM.HIST_FIRST + ':G' + histLast), '=AND(ISNUMBER(G' + FINSUM.HIST_FIRST + '),G' + FINSUM.HIST_FIRST + '<0)', null, COLORS.OVER_FONT),
  ]);
  const prot = sh.protect().setDescription('The Financial Summary is calculated. Change the number of months in B3; edit data on the raw tabs.');
  prot.setWarningOnly(true);
  setNamedRange_('FINSUM_MONTHS', sh.getRange(FINSUM.MONTHS_CELL));
  prot.setUnprotectedRanges([sh.getRange(FINSUM.MONTHS_CELL)]);
}

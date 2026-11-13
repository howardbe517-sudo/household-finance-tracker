/**
 * Financial Summary: where the household stands. Tonight's account balances at the top (the
 * accounts block, moved here when the Dashboard tab was retired), then the whole-household picture. Averages over the
 * last N full months (N typed in B3), a month-by-month history, then Savings & Reserves, Debts,
 * Income by Person, Payroll Deductions, Credit Scores and Net Worth. All formulas; rebuilt by
 * buildWorkbook / upgradeWorkbook (the N input is kept).
 */

const FINSUM = {
  // rows 3–8: the accounts block (moved here from the retired Dashboard tab, 2026-11-12); everything below sits 7 rows lower than before
  ACCT_HEADER: 3, ACCT_FIRST: 4, ACCT_WITH_BILLS: 6, ACCT_NOTE: 8,
  // rows 10–13: coming in, fixed costs, flexible (average), likely left over (2026-11-12; the four 3-month averages they replaced are gone)
  CARD_LABEL: 10, CARD_VALUE: 11, CARD_SUB: 12, FLOW_LINE: 13,
  // rows 14–15: how many months the averages further down cover, and the calculated windows
  MONTHS_CELL: 'B14', MONTHS_DEFAULT: 3, WINDOW_ROW: 15, FLEX_MONTHS: 6,
  HIST_BAR: 16, HIST_HEADER: 17, HIST_FIRST: 18, HIST_COUNT: 12,
  FUNDS_BAR: 31, FUNDS_HEADER: 32, FUNDS_FIRST: 33, FUNDS_COUNT: 8,
  // debts: three cards, then every debt with a balance or a payment listed underneath; everything after sits 12 rows lower than before
  DEBT_BAR: 42, DEBT_LABEL: 43, DEBT_VALUE: 44, DEBT_LIST_HEADER: 46, DEBT_LIST_FIRST: 47, DEBT_LIST_ROWS: 10, DEBT_NOTE: 57,
  INCOME_BAR: 59, INCOME_HEADER: 60, INCOME_BEN: 61, INCOME_VAL: 62, INCOME_HH: 63,
  PAYROLL_BAR: 65, PAYROLL_GROUPS: 66, PAYROLL_HEADER: 67, PAYROLL_FIRST: 68, PAYROLL_TOTAL: 74,
  CREDIT_BAR: 76, CREDIT_HEADER: 77, CREDIT_BEN: 78, CREDIT_VAL: 79, CREDIT_NOTE: 80,
  CHILD_BAR: 82, CHILD_HEADER: 83, CHILD_CARE: 84, CHILD_OTHER: 85, CHILD_ALL: 86,
  FEES_BAR: 88, FEES_HEADER: 89, FEES_CARD: 90, FEES_LATE: 91, FEES_BANK: 92, FEES_TOTAL: 93, FEES_INTEREST: 94,
  NW_BAR: 96, NW_LABEL: 97, NW_VALUE: 98, NW_NOTE: 99,
  LAST_ROW: 101,
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
  [190, 100, 70, 110, 120, 130, 120, 120, 120].forEach((w, i) => sh.setColumnWidth(i + 1, w));
  sh.getRange(1, 1, FINSUM.LAST_ROW, 9).setFontColor(COLORS.TEXT).setFontSize(10).setVerticalAlignment('middle');
  const put = (a1, v) => { const r = sh.getRange(a1); if (typeof v === 'string' && v.charAt(0) === '=') r.setFormula(v); else r.setValue(v); return r; };
  const mergePut = (a1, v) => { const r = sh.getRange(a1).merge(); if (typeof v === 'string' && v.charAt(0) === '=') r.setFormula(v); else r.setValue(v); return r; };
  const header = (a1, values) => { const r = sh.getRange(a1); r.setValues([values]); styleHeader_(r); r.setHorizontalAlignment('center'); };
  const MR = Number(FINSUM.MONTHS_CELL.slice(1)), W = FINSUM.WINDOW_ROW;
  const N = '$B$' + MR;
  const CUR = 'DATE(YEAR(TODAY()),MONTH(TODAY()),1)';
  // The window ends with the latest month that has a paycheck (so a new workbook averages what it
  // has) and the divisor is the number of months in the window that have paychecks, never N when
  // fewer months exist. Once N full months of data exist this is simply the last N months.
  // Helper cells on the window row hold the window so every average stays short: B = last month with a
  // paycheck, C = first month of the window, D = months in the window that have paychecks.
  const PEND = '$B$' + W, PSTART = '$C$' + W, DIV = '$D$' + W;
  const inPeriod = (tbl) => '[' + tbl + '.month],">="&' + PSTART + ',[' + tbl + '.month],"<="&' + PEND;
  const avg = (tbl, col, extra) => 'IFERROR(SUMIFS([' + tbl + '.' + col + '],' + inPeriod(tbl) + (extra || '') + ')/' + DIV + ',0)';

  /* --- title, period input --- */
  mergePut('A1:I1', 'Financial Summary').setBackground(COLORS.NAVY).setFontColor(COLORS.WHITE).setFontSize(16).setFontWeight('bold');
  sh.setRowHeight(1, 40);
  mergePut('A2:I2', 'Where you stand: tonight\'s balances, then what comes in, what goes out and what is likely left over in a typical month, the month-by-month history, savings funds, debts, income by person, payroll deductions, credit scores and net worth. Averages settle as full months accumulate; a month still in progress counts as it stands.')
    .setFontStyle('italic').setFontColor(COLORS.MUTED_TEXT).setFontSize(9);
  /* --- accounts right now (moved from the Dashboard) --- */
  buildAccountsBlock_(sh, { header: FINSUM.ACCT_HEADER, first: FINSUM.ACCT_FIRST, withBills: FINSUM.ACCT_WITH_BILLS, note: FINSUM.ACCT_NOTE });

  put('A' + MR, 'Averages below cover the last').setFontWeight('bold');
  put('B' + MR, FINSUM.MONTHS_DEFAULT).setBackground(COLORS.INPUT).setFontWeight('bold').setHorizontalAlignment('center')
    .setBorder(true, true, true, true, false, false, COLORS.NAVY, SpreadsheetApp.BorderStyle.SOLID)
    .setDataValidation(SpreadsheetApp.newDataValidation().requireNumberBetween(1, 24).setAllowInvalid(false).setHelpText('How many full months to average (1–24).').build());
  mergePut('C' + MR + ':I' + MR, '="months: "&TEXT(' + PSTART + ',"mmm yyyy")&" – "&TEXT(' + PEND + ',"mmm yyyy")&" · "&' + DIV + '&" with paychecks counted"').setFontColor(COLORS.MUTED_TEXT).setFontSize(9);
  put('A' + W, 'Window (calculated)').setFontSize(8).setFontColor(COLORS.MUTED_TEXT);
  put('B' + W, F('=IFERROR(LET(e,MAX([INCOME.month]),IF(e=0,EDATE(' + CUR + ',-1),e)),EDATE(' + CUR + ',-1))')).setNumberFormat('mmm yyyy').setFontSize(8).setFontColor(COLORS.MUTED_TEXT);
  put('C' + W, '=EDATE(' + PEND + ',-(' + N + '-1))').setNumberFormat('mmm yyyy').setFontSize(8).setFontColor(COLORS.MUTED_TEXT);
  put('D' + W, F('=MAX(1,IFERROR(ROWS(UNIQUE(FILTER([INCOME.month],[INCOME.month]>=' + PSTART + ',[INCOME.month]<=' + PEND + '))),1))')).setNumberFormat('0').setFontSize(8).setFontColor(COLORS.MUTED_TEXT);
  setNamedRange_('FINSUM_WINDOW_END', sh.getRange('B' + W));
  setNamedRange_('FINSUM_WINDOW_START', sh.getRange('C' + W));
  setNamedRange_('FINSUM_MONTHS_COUNTED', sh.getRange('D' + W));
  // months, among the last FLEX_MONTHS full ones, that have any spending recorded: the divisor of the flexible average
  const FLEXK = '$F$' + W;
  const TXE = ',[TX.type],"Expense",[TX.isDeleted],"<>TRUE")', TXR = ',[TX.type],"Refund",[TX.isDeleted],"<>TRUE")';
  const FWS = 'EDATE(' + CUR + ',-' + FINSUM.FLEX_MONTHS + ')', FWE = 'EDATE(' + CUR + ',-1)';
  put('E' + W, 'Spending months (of ' + FINSUM.FLEX_MONTHS + ')').setFontSize(8).setFontColor(COLORS.MUTED_TEXT);
  // ROWS(UNIQUE(FILTER())) and not COUNTUNIQUE: COUNTUNIQUE counts FILTER's "nothing found" error as one month (fixed 2026-11-13)
  put('F' + W, F('=IFERROR(ROWS(UNIQUE(FILTER([TX.month],[TX.month]>=' + FWS + ',[TX.month]<=' + FWE + ',[TX.isDeleted]<>TRUE,(([TX.type]="Expense")+([TX.type]="Refund"))>0))),0)')).setNumberFormat('0').setFontSize(8).setFontColor(COLORS.MUTED_TEXT);

  /* --- coming in, going out, left over: the typical month at a glance --- */
  // spending that is not marked Fixed (flexible, planned irregular, unexpected, not marked yet), over a range of months or in one month
  const notFixed = (crit) => '((SUMIFS([TX.amount],' + crit + TXE + '-SUMIFS([TX.amount],' + crit + TXR + ')-(SUMIFS([TX.amount],' + crit + ',[TX.spendingType],"Fixed"' + TXE + '-SUMIFS([TX.amount],' + crit + ',[TX.spendingType],"Fixed"' + TXR + '))';
  const TAKE = 'SUM([EXPECT.monthlyTakeHome])';
  const BILLS = 'SUMIFS([RECUR.monthlyEq],[RECUR.active],TRUE,[RECUR.group],"<>Loans")';
  // the same debt-payment figure the Monthly Plan uses
  const DEBTPAY = '(MAX(SUM([DEBTS.minPayment]),SUMIFS([RECUR.monthlyEq],[RECUR.active],TRUE,[RECUR.group],"Loans"))+SUM([DEBTS.plannedExtra])+N(IFERROR(SETTING_DEBT_EXTRA_ALL,0)))';
  // gas, electric and water vary, so they are not on Recurring Payments: their monthly average over the last 12 months of bills
  const UTILAVG = 'IFERROR(LET(us,EDATE(' + CUR + ',-12),uf,MINIFS([UTIL.month],[UTIL.month],">="&us,[UTIL.month],"<"&' + CUR + '),IF(uf=0,0,SUMIFS([UTIL.amount],[UTIL.month],">="&us,[UTIL.month],"<"&' + CUR + ')/MAX(1,DATEDIF(uf,' + CUR + ',"M")))),0)';
  const FLEXAVG = 'IF(' + FLEXK + '=0,' + notFixed('[TX.month],' + CUR) + ',' + notFixed('[TX.month],">="&' + FWS + ',[TX.month],"<="&' + FWE) + '/' + FLEXK + ')';
  const V = FINSUM.CARD_VALUE;
  const cards = [
    { cols: ['A', 'B'], label: 'Coming In (typical month)', color: COLORS.CARD_TAKEHOME, f: F('=' + TAKE),
      sub: F('=IFERROR("take-home · "&TEXTJOIN(" · ",TRUE,MAP(UNIQUE(FILTER([EXPECT.person],[EXPECT.active]=TRUE,[EXPECT.person]<>"")),LAMBDA(p,p&" "&TEXT(SUMIFS([EXPECT.monthlyTakeHome],[EXPECT.person],p),"$#,##0")))),"take-home, from Expected Income")') },
    { cols: ['C', 'D'], label: 'Fixed Costs', color: COLORS.CARD_SPENDING, f: F('=' + BILLS + '+' + DEBTPAY + '+' + UTILAVG),
      sub: F('="bills "&TEXT(' + BILLS + ',"$#,##0")&" · debt payments "&TEXT(' + DEBTPAY + ',"$#,##0")&" · utilities avg "&TEXT(' + UTILAVG + ',"$#,##0")') },
    { cols: ['E', 'F'], label: 'Flexible Spending (average)', color: COLORS.CARD_SPENDING, f: F('=' + FLEXAVG),
      sub: '=IF(' + FLEXK + '=0,"this month so far · becomes an average after the first full month","average of "&' + FLEXK + '&" month"&IF(' + FLEXK + '=1,"","s")&" · everything not marked Fixed")' },
    { cols: ['G', 'I'], label: 'Likely Left Over', color: COLORS.CARD_SAVINGS, f: '=N($A$' + V + ')-N($C$' + V + ')-N($E$' + V + ')',
      sub: F('="coming in − fixed − flexible"&IF(SUM([FUNDS.plannedMonthly])>0," · "&TEXT(SUM([FUNDS.plannedMonthly]),"$#,##0")&" of it is planned savings","")&IF(' + FLEXK + '=0," · provisional","")') },
  ];
  cards.forEach(card => {
    const [c1, c2] = card.cols;
    mergePut(c1 + FINSUM.CARD_LABEL + ':' + c2 + FINSUM.CARD_LABEL, card.label).setBackground(card.color).setFontWeight('bold').setHorizontalAlignment('center');
    mergePut(c1 + FINSUM.CARD_VALUE + ':' + c2 + FINSUM.CARD_VALUE, card.f).setBackground(card.color).setFontSize(18).setFontWeight('bold').setHorizontalAlignment('center').setNumberFormat('$#,##0;-$#,##0');
    mergePut(c1 + FINSUM.CARD_SUB + ':' + c2 + FINSUM.CARD_SUB, card.sub).setBackground(card.color).setFontSize(8).setFontColor(COLORS.MUTED_TEXT).setHorizontalAlignment('center').setWrap(true);
    sh.getRange(c1 + FINSUM.CARD_LABEL + ':' + c2 + FINSUM.CARD_SUB).setBorder(true, true, true, true, false, false, COLORS.WHITE, SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
  });
  sh.setRowHeight(FINSUM.CARD_VALUE, 42); sh.setRowHeight(FINSUM.CARD_SUB, 30);
  mergePut('A' + FINSUM.FLOW_LINE + ':I' + FINSUM.FLOW_LINE, 'Coming in is a typical month of paychecks (Expected Income). Fixed costs are every active bill on Recurring Payments, the debt payments, and the average gas, electric and water bill. Flexible is the average of everything else that was spent. The Spending tab has the breakdown.')
    .setFontSize(8).setFontColor(COLORS.MUTED_TEXT).setFontStyle('italic').setWrap(true);
  sh.setRowHeight(FINSUM.FLOW_LINE, 26);

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

  /* --- Debts: one household total, the two monthly figures, then each debt underneath --- */
  styleSectionBar_(sh.getRange('A' + FINSUM.DEBT_BAR + ':I' + FINSUM.DEBT_BAR), 'Debts');
  const dk = [
    ['A', 'C', 'Household Debt', F('=SUM([DEBTS.latestBalance])')],
    ['D', 'F', 'Estimated Monthly Interest', F('=SUM([DEBTS.estMonthlyInterest])')],
    ['G', 'I', 'Total Minimum Payments', F('=SUM([DEBTS.minPayment])')],
  ];
  dk.forEach(d => {
    mergePut(d[0] + FINSUM.DEBT_LABEL + ':' + d[1] + FINSUM.DEBT_LABEL, d[2]).setBackground(COLORS.PALE_BLUE).setFontWeight('bold').setHorizontalAlignment('center');
    mergePut(d[0] + FINSUM.DEBT_VALUE + ':' + d[1] + FINSUM.DEBT_VALUE, d[3]).setNumberFormat(FORMATS.currency).setFontSize(14).setFontWeight('bold').setHorizontalAlignment('center')
      .setBorder(true, true, true, true, false, false, COLORS.BORDER, SpreadsheetApp.BorderStyle.SOLID);
  });
  const dlFirst = FINSUM.DEBT_LIST_FIRST, dlLast = FINSUM.DEBT_LIST_FIRST + FINSUM.DEBT_LIST_ROWS - 1;
  header('A' + FINSUM.DEBT_LIST_HEADER + ':F' + FINSUM.DEBT_LIST_HEADER, ['Debt', 'Balance', 'Rate', 'Minimum', 'Est. Interest / mo', 'Next Due']);
  // every debt that has a balance or a payment, largest first (a blank cell is text and would pass ">0", so each test checks for a number)
  const has = (col) => '(ISNUMBER([DEBTS.' + col + '])*([DEBTS.' + col + ']>0))';
  put('A' + dlFirst, F('=IFERROR(ARRAY_CONSTRAIN(SORT(FILTER({[DEBTS.name],[DEBTS.latestBalance],[DEBTS.apr],[DEBTS.minPayment],[DEBTS.estMonthlyInterest],[DEBTS.nextDue]},[DEBTS.id]<>"",(' + has('latestBalance') + '+' + has('minPayment') + ')>0),2,FALSE),' + FINSUM.DEBT_LIST_ROWS + ',6),"No debt with a balance")'));
  sh.getRange('B' + dlFirst + ':B' + dlLast).setNumberFormat(FORMATS.currency);
  sh.getRange('C' + dlFirst + ':C' + dlLast).setNumberFormat(FORMATS.percent);
  sh.getRange('D' + dlFirst + ':E' + dlLast).setNumberFormat(FORMATS.currency);
  sh.getRange('F' + dlFirst + ':F' + dlLast).setNumberFormat('mmm d');
  sh.getRange('A' + FINSUM.DEBT_LIST_HEADER + ':F' + dlLast).setBorder(true, true, true, true, true, false, COLORS.BORDER, SpreadsheetApp.BorderStyle.SOLID);
  mergePut('A' + FINSUM.DEBT_NOTE + ':I' + FINSUM.DEBT_NOTE, F('="Household debt is every debt entered on the Debts tab; a loan left without a balance there is not counted"&IFERROR(" · PSLF (lowest loan) "&TEXTJOIN(", ",TRUE,MAP(UNIQUE(FILTER([DEBTS.owner],([DEBTS.group]="Student Loans")*([DEBTS.pslfEstimated]<>""))),LAMBDA(o,o&" "&MINIFS([DEBTS.pslfEstimated],[DEBTS.owner],o,[DEBTS.group],"Student Loans")&"/120"))),"")&". Balances are live where a lender is connected; otherwise the latest Quarterly Debt Review. Details on the Debts tab."'))
    .setFontSize(8).setFontColor(COLORS.MUTED_TEXT).setFontStyle('italic');

  /* --- Income by Person: average per month over the period, and last month --- */
  styleSectionBar_(sh.getRange('A' + FINSUM.INCOME_BAR + ':I' + FINSUM.INCOME_BAR), 'Income by Person — average per month over the period');
  header('A' + FINSUM.INCOME_HEADER + ':F' + FINSUM.INCOME_HEADER, ['Person', 'Avg Gross', 'Avg Take-Home', 'Avg Deductions', 'Take-Home %', 'Latest Month Take-Home']);
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

  /* --- Payroll Deductions: per paycheck, one group per job, from that job's latest real pay stub --- */
  // The owner's view (2026-11-13): what comes out of a paycheck is a share of that paycheck, so each job is shown on
  // its own, as amounts per paycheck and % of that paycheck's gross. How many paychecks a month has does not matter.
  // Jobs are the active Expected Income rows, by person and then largest typical gross; rows made from a bank deposit
  // are estimates and are left out (their deductions are scaled copies of a stub anyway).
  styleSectionBar_(sh.getRange('A' + FINSUM.PAYROLL_BAR + ':I' + FINSUM.PAYROLL_BAR), 'Payroll Deductions — per paycheck, from each job\'s latest pay stub');
  const NOT_DEP = ',[INCOME.notes],"<>*' + INCOME_FROM_DEPOSIT_MARK + '*"';
  // p = person, e = employer, d = pay date of the latest real stub (0 when none) for the k-th job
  const job = (k) => 'LET(js,SORT(FILTER({[EXPECT.id],[EXPECT.person],[EXPECT.typicalGross]},[EXPECT.active]=TRUE,[EXPECT.id]<>""),2,TRUE,3,FALSE),' +
    'id,INDEX(js,' + k + ',1),p,INDEX([EXPECT.person],MATCH(id,[EXPECT.id],0)),e,INDEX([EXPECT.employer],MATCH(id,[EXPECT.id],0)),' +
    'd,MAXIFS([INCOME.payDate],[INCOME.person],p,[INCOME.employer],e' + NOT_DEP + '),';
  const onStub = (col) => 'SUMIFS([INCOME.' + col + '],[INCOME.person],p,[INCOME.employer],e,[INCOME.payDate],d' + NOT_DEP + ')';
  const groups = [{ c1: 'A', c2: 'B', c3: 'C', k: 1 }, { c1: 'D', c2: 'E', c3: 'F', k: 2 }, { c1: 'G', c2: 'H', c3: 'I', k: 3 }];
  const deductions = [
    ['Federal Tax', 'fedTax'], ['State / Local Tax', 'stateTax'], ['Social Security & Medicare', 'ssMed'],
    ['Health / Insurance', 'health'], ['Retirement', 'retirement'], ['Other Deductions', 'otherDed'], ['Total Deductions', 'totalDed'],
  ];
  groups.forEach(g => {
    mergePut(g.c1 + FINSUM.PAYROLL_GROUPS + ':' + g.c3 + FINSUM.PAYROLL_GROUPS,
      F('=IFERROR(' + job(g.k) + 'p&" · "&e&IF(d=0," · no pay stub yet"," · stub of "&TEXT(d,"mmm d, yyyy"))),"")'))
      .setBackground(COLORS.PALE_BLUE).setFontWeight('bold').setHorizontalAlignment('center').setWrap(true);
    header(g.c1 + FINSUM.PAYROLL_HEADER + ':' + g.c3 + FINSUM.PAYROLL_HEADER, ['Deduction', 'Per Paycheck', '% of Gross']);
    deductions.forEach((d, i) => {
      const r = FINSUM.PAYROLL_FIRST + i;
      put(g.c1 + r, d[0]);
      put(g.c2 + r, F('=IFERROR(' + job(g.k) + 'IF(d=0,"",' + onStub(d[1]) + ')),"")')).setNumberFormat(FORMATS.currency);
      put(g.c3 + r, F('=IFERROR(' + job(g.k) + 'g,' + onStub('gross') + ',IF(OR(d=0,g=0),"",' + onStub(d[1]) + '/g)),"")')).setNumberFormat(FORMATS.percent);
    });
    sh.getRange(g.c1 + FINSUM.PAYROLL_TOTAL + ':' + g.c3 + FINSUM.PAYROLL_TOTAL).setFontWeight('bold');
    sh.getRange(g.c1 + FINSUM.PAYROLL_HEADER + ':' + g.c3 + FINSUM.PAYROLL_TOTAL).setBorder(true, true, true, true, true, true, COLORS.BORDER, SpreadsheetApp.BorderStyle.SOLID);
  });
  sh.setRowHeight(FINSUM.PAYROLL_GROUPS, 30);

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

  /* --- Children: childcare apart from the other child costs, and the two combined --- */
  styleSectionBar_(sh.getRange('A' + FINSUM.CHILD_BAR + ':I' + FINSUM.CHILD_BAR), 'Children — childcare and other child costs');
  header('A' + FINSUM.CHILD_HEADER + ':D' + FINSUM.CHILD_HEADER, ['', 'This Month', 'Average per Month', 'Share of Spending']);
  const catSpend = (cat, monthCrit) => 'SUMIFS([TX.amount],[TX.category],"' + cat + '",[TX.type],"Expense",[TX.isDeleted],"<>TRUE",' + monthCrit + ')-SUMIFS([TX.amount],[TX.category],"' + cat + '",[TX.type],"Refund",[TX.isDeleted],"<>TRUE",' + monthCrit + ')';
  const thisMonth = '[TX.month],' + CUR;
  [{ row: FINSUM.CHILD_CARE, label: 'Childcare (nanny)', cat: 'Childcare' }, { row: FINSUM.CHILD_OTHER, label: 'Other child expenses', cat: 'Child Expenses' }].forEach(c => {
    put('A' + c.row, c.label).setFontWeight('bold');
    put('B' + c.row, F('=' + catSpend(c.cat, thisMonth)));
    put('C' + c.row, F('=IFERROR((' + catSpend(c.cat, inPeriod('TX')) + ')/' + DIV + ',0)'));
    put('D' + c.row, F('=IFERROR(C' + c.row + '/' + avg('SUMMARY', 'spending') + ',"")'));
  });
  put('A' + FINSUM.CHILD_ALL, 'All children combined').setFontWeight('bold');
  put('B' + FINSUM.CHILD_ALL, '=B' + FINSUM.CHILD_CARE + '+B' + FINSUM.CHILD_OTHER);
  put('C' + FINSUM.CHILD_ALL, '=C' + FINSUM.CHILD_CARE + '+C' + FINSUM.CHILD_OTHER);
  put('D' + FINSUM.CHILD_ALL, F('=IFERROR(C' + FINSUM.CHILD_ALL + '/' + avg('SUMMARY', 'spending') + ',"")'));
  sh.getRange('B' + FINSUM.CHILD_CARE + ':C' + FINSUM.CHILD_ALL).setNumberFormat(FORMATS.currency);
  sh.getRange('D' + FINSUM.CHILD_CARE + ':D' + FINSUM.CHILD_ALL).setNumberFormat(FORMATS.percent);
  sh.getRange('A' + FINSUM.CHILD_ALL + ':D' + FINSUM.CHILD_ALL).setBackground(COLORS.PALE_BLUE).setFontWeight('bold');
  sh.getRange('A' + FINSUM.CHILD_HEADER + ':D' + FINSUM.CHILD_ALL).setBorder(true, true, true, true, true, true, COLORS.BORDER, SpreadsheetApp.BorderStyle.SOLID);
  mergePut('E' + FINSUM.CHILD_CARE + ':I' + FINSUM.CHILD_ALL, 'Childcare is what you pay someone to watch the children (the nanny). Child Expenses is everything else for them (Clothing, Medical, Activities, Education, Supplies, Toys). Each has its own line on the Monthly Budget; this block shows both and the total. Share of Spending compares the average with average monthly spending over the same months.')
    .setFontSize(8).setFontColor(COLORS.MUTED_TEXT).setFontStyle('italic').setWrap(true).setVerticalAlignment('top');

  /* --- Fees: what paying costs (card processing fees, late fees, bank fees), this year and the last 12 months --- */
  styleSectionBar_(sh.getRange('A' + FINSUM.FEES_BAR + ':I' + FINSUM.FEES_BAR), 'Fees — what paying costs');
  header('A' + FINSUM.FEES_HEADER + ':C' + FINSUM.FEES_HEADER, ['', 'This Year', 'Last 12 Months']);
  const YTD = 'DATE(YEAR(TODAY()),1,1)', L12 = 'EDATE(TODAY(),-12)';
  const txFee = (sub, from) => '(SUMIFS([TX.amount],[TX.subcategory],"' + sub + '",[TX.type],"Expense",[TX.isDeleted],"<>TRUE",[TX.date],">="&' + from + ')-SUMIFS([TX.amount],[TX.subcategory],"' + sub + '",[TX.type],"Refund",[TX.isDeleted],"<>TRUE",[TX.date],">="&' + from + '))';
  const billFee = (col, from) => 'SUMIFS([UTIL.' + col + '],[UTIL.dueDate],">="&' + from + ')';
  [
    { row: FINSUM.FEES_CARD, label: 'Card and processing fees', f: (from) => billFee('cardFee', from) + '+' + txFee('Card & Processing Fees', from) },
    { row: FINSUM.FEES_LATE, label: 'Late fees', f: (from) => billFee('lateFee', from) + '+' + txFee('Late Fees', from) },
    { row: FINSUM.FEES_BANK, label: 'Bank fees', f: (from) => txFee('Bank Fees', from) },
  ].forEach(x => {
    put('A' + x.row, x.label).setFontWeight('bold');
    put('B' + x.row, F('=' + x.f(YTD)));
    put('C' + x.row, F('=' + x.f(L12)));
  });
  put('A' + FINSUM.FEES_TOTAL, 'All fees').setFontWeight('bold');
  put('B' + FINSUM.FEES_TOTAL, '=SUM(B' + FINSUM.FEES_CARD + ':B' + FINSUM.FEES_BANK + ')');
  put('C' + FINSUM.FEES_TOTAL, '=SUM(C' + FINSUM.FEES_CARD + ':C' + FINSUM.FEES_BANK + ')');
  sh.getRange('A' + FINSUM.FEES_TOTAL + ':C' + FINSUM.FEES_TOTAL).setBackground(COLORS.PALE_BLUE).setFontWeight('bold');
  put('A' + FINSUM.FEES_INTEREST, 'Interest on debts (estimate)').setFontColor(COLORS.MUTED_TEXT);
  mergePut('B' + FINSUM.FEES_INTEREST + ':C' + FINSUM.FEES_INTEREST, F('=SUM([DEBTS.estAnnualInterest])')).setFontColor(COLORS.MUTED_TEXT).setHorizontalAlignment('center');
  sh.getRange('B' + FINSUM.FEES_CARD + ':C' + FINSUM.FEES_INTEREST).setNumberFormat(FORMATS.currency);
  sh.getRange('A' + FINSUM.FEES_HEADER + ':C' + FINSUM.FEES_INTEREST).setBorder(true, true, true, true, true, true, COLORS.BORDER, SpreadsheetApp.BorderStyle.SOLID);
  mergePut('D' + FINSUM.FEES_CARD + ':I' + FINSUM.FEES_INTEREST, 'Card and processing fees: what a payment ran over its bill when paid by card (Card Fee on Utility Bills, filled in by the sync) plus any transaction categorized Miscellaneous / Card & Processing Fees. Late fees: Late Fee on Utility Bills plus transactions categorized Miscellaneous / Late Fees. A fee hidden inside another payment can be split off with Finance Tracker → Split the selected row. Interest is a year at today\'s balances and rates from the Debts tab, not added into All fees.')
    .setFontSize(8).setFontColor(COLORS.MUTED_TEXT).setFontStyle('italic').setWrap(true).setVerticalAlignment('top');

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
    cfRule_(sh.getRange('G' + FINSUM.CARD_VALUE + ':I' + FINSUM.CARD_VALUE), '=AND(ISNUMBER($G$' + FINSUM.CARD_VALUE + '),$G$' + FINSUM.CARD_VALUE + '<0)', COLORS.OVER_FILL, COLORS.OVER_FONT),
  ]);
  const prot = sh.protect().setDescription('The Financial Summary is calculated. Change the number of months in ' + FINSUM.MONTHS_CELL + '; edit data on the raw tabs.');
  prot.setWarningOnly(true);
  setNamedRange_('FINSUM_MONTHS', sh.getRange(FINSUM.MONTHS_CELL));
  prot.setUnprotectedRanges([sh.getRange(FINSUM.MONTHS_CELL)]);
}

/**
 * The flexible figure on the Financial Summary, recomputed in plain JavaScript. Pure.
 * Average monthly spending that is not marked Fixed over the last FINSUM.FLEX_MONTHS full months,
 * counting only months that have spending; with no such month, this month so far.
 * Returns { months, average, provisional }.
 */
function typicalFlexible_(txRows, today) {
  const cur = new Date(today.getFullYear(), today.getMonth(), 1);
  const key = (d) => d.getFullYear() * 12 + d.getMonth();
  const lo = key(cur) - FINSUM.FLEX_MONTHS, hi = key(cur) - 1;
  const seen = {};
  let win = 0, now = 0;
  (txRows || []).forEach(t => {
    if (t.isDeleted === true || !(t.date instanceof Date) || (t.type !== 'Expense' && t.type !== 'Refund')) return;
    const k = key(t.date), amt = (t.type === 'Expense' ? 1 : -1) * Number(t.amount || 0), flex = t.spendingType !== 'Fixed';
    if (k >= lo && k <= hi) { seen[k] = true; if (flex) win += amt; }
    else if (k === key(cur) && flex) now += amt;
  });
  const months = Object.keys(seen).length;
  return { months, average: Math.round((months ? win / months : now) * 100) / 100, provisional: months === 0 };
}

/** Average monthly utility bill over the last 12 months of Utility Bills (by due month), as the Financial Summary counts it. Pure. */
function averageUtilities_(utilRows, today) {
  const cur = new Date(today.getFullYear(), today.getMonth(), 1);
  const key = (d) => d.getFullYear() * 12 + d.getMonth();
  const lo = key(cur) - 12, hi = key(cur) - 1;
  let sum = 0, first = null;
  (utilRows || []).forEach(u => {
    if (!(u.dueDate instanceof Date)) return;
    const k = key(u.dueDate);
    if (k < lo || k > hi) return;
    sum += Number(u.amount || 0);
    if (first === null || k < first) first = k;
  });
  return first === null ? 0 : Math.round(sum / Math.max(1, key(cur) - first) * 100) / 100;
}

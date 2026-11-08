/**
 * Household Finance Tracker — Dashboard.gs
 * Phase 5: Dashboard. Built last; a summary only, never a second database.
 *
 * Layout (columns A:I)
 *   1–3   title, subtitle, Selected Month (B3)
 *   5–7   four equal cards A:B C:D E:F G:H  (Gross · Take-Home · Spending · Total Savings)
 *   9–13  Income by Person (A:E)
 *  15–19  Credit Scores — Latest (A:E)
 *  21–30  Payroll Deductions: Ben A:C · Valerie D:F · Household G:I
 *  32–35  Current Flexible Spending (A:I) — follows TODAY(), not B3
 *  37–46  Savings & Reserves (A:F) + Monthly Review Checklist (G:I)
 *  48     quarterly debt footnote
 */

const DASH = {
  SELECTED_MONTH: 'B3',
  CARD_ROW_LABEL: 5, CARD_ROW_VALUE: 6, CARD_ROW_SUB: 7,
  INCOME_HEADER: 10, INCOME_BEN: 11, INCOME_VAL: 12, INCOME_HH: 13,
  CREDIT_HEADER: 16, CREDIT_BEN: 17, CREDIT_VAL: 18,
  PAYROLL_GROUPS: 22, PAYROLL_HEADER: 23, PAYROLL_FIRST: 24, PAYROLL_TOTAL: 30,
  FLEX_BAR: 32, FLEX_LABEL: 33, FLEX_VALUE: 34, FLEX_SUB: 35,
  FUNDS_BAR: 37, FUNDS_HEADER: 38, FUNDS_FIRST: 39, FUNDS_COUNT: 8,
  FOOTNOTE: 48,
  // Reminders panel (columns K:N) beside the cards
  SIDE_COL: 11, SIDE_WIDTH: 4, REMINDERS_BAR: 1, REMINDERS_FIRST: 3, REMINDERS_ROWS: 10,
};

/* Financial Goals live on their own tab (Goals); see buildGoals_. */
const GOALS = { COUNT: 5, FIRST_ROW: 4, BOX_ROWS: 5, ROW_HEIGHT: 30, WIDTH: 8 };

/** A1 range of goal box n (1-based) on the Goals tab, e.g. A5:H9. */
function goalBoxRange_(n) {
  const top = GOALS.FIRST_ROW + (n - 1) * (GOALS.BOX_ROWS + 1) + 1;
  return 'A' + top + ':' + colLetter_(GOALS.WIDTH) + (top + GOALS.BOX_ROWS - 1);
}

/** Goals tab: a title, a short note and five large text boxes (named GOAL_1…GOAL_5). Rebuilt by the upgrade with the text put back. */
function buildGoals_() {
  const sh = getOrCreateSheet_(SHEETS.GOALS);
  sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).breakApart();
  sh.clear(); // SAFETY-APPROVED: the Goals tab is rebuilt by buildWorkbook / upgradeWorkbook; the upgrade reads the goal text first and writes it back
  sh.getProtections(SpreadsheetApp.ProtectionType.SHEET).forEach(p => p.remove());
  const lastRow = GOALS.FIRST_ROW + GOALS.COUNT * (GOALS.BOX_ROWS + 1) + 2;
  ensureSheetSize_(sh, lastRow, GOALS.WIDTH);
  sh.setHiddenGridlines(true);
  for (let c = 1; c <= GOALS.WIDTH; c++) sh.setColumnWidth(c, 120);
  sh.getRange(1, 1, lastRow, GOALS.WIDTH).setFontColor(COLORS.TEXT).setFontSize(10).setVerticalAlignment('middle');
  sh.getRange(1, 1, 1, GOALS.WIDTH).merge().setValue('Financial Goals').setBackground(COLORS.NAVY).setFontColor(COLORS.WHITE).setFontSize(18).setFontWeight('bold');
  sh.setRowHeight(1, 44);
  sh.getRange(2, 1, 1, GOALS.WIDTH).merge().setValue('Write a goal in each box, in your own words and at any length; the box wraps the text. These boxes are yours: upgrades keep what you wrote. Monthly, yearly and five-year breakdowns can be added later.')
    .setFontSize(10).setFontColor(COLORS.MUTED_TEXT).setWrap(true);
  sh.setRowHeight(2, 36);
  for (let n = 1; n <= GOALS.COUNT; n++) {
    const top = GOALS.FIRST_ROW + (n - 1) * (GOALS.BOX_ROWS + 1);
    sh.getRange(top, 1, 1, GOALS.WIDTH).merge().setValue('Goal ' + n).setBackground(COLORS.PALE_BLUE).setFontWeight('bold').setFontSize(12);
    sh.setRowHeight(top, 26);
    const box = sh.getRange(goalBoxRange_(n)).merge();
    box.setBackground(COLORS.INPUT).setWrap(true).setVerticalAlignment('top').setHorizontalAlignment('left').setFontSize(12)
      .setBorder(true, true, true, true, false, false, COLORS.BORDER, SpreadsheetApp.BorderStyle.SOLID);
    for (let r = top + 1; r <= top + GOALS.BOX_ROWS; r++) sh.setRowHeight(r, GOALS.ROW_HEIGHT);
    setNamedRange_('GOAL_' + n, box);
  }
}

function buildDashboard_() {
  const sh = getOrCreateSheet_(SHEETS.DASH);
  const F = (t) => resolveFormula_(t, null, null);
  sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).breakApart();
  sh.clear(); // SAFETY-APPROVED: Dashboard is rebuilt from scratch by buildWorkbook; it holds no entered data
  sh.clearConditionalFormatRules();
  sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).clearDataValidations();
  sh.getProtections(SpreadsheetApp.ProtectionType.SHEET).forEach(p => p.remove());
  ensureSheetSize_(sh, 52, DASH.SIDE_COL + DASH.SIDE_WIDTH - 1);
  sh.setHiddenGridlines(true);
  sh.setColumnWidth(1, 200);
  for (let c = 2; c <= 9; c++) sh.setColumnWidth(c, 118);
  sh.setColumnWidth(10, 24);
  for (let c = DASH.SIDE_COL; c < DASH.SIDE_COL + DASH.SIDE_WIDTH; c++) sh.setColumnWidth(c, 130);
  sh.getRange(1, 1, 52, DASH.SIDE_COL + DASH.SIDE_WIDTH - 1).setFontColor(COLORS.TEXT).setFontSize(10).setVerticalAlignment('middle');

  const put = (a1, v) => { const r = sh.getRange(a1); if (typeof v === 'string' && v.charAt(0) === '=') r.setFormula(v); else r.setValue(v); return r; };
  const mergePut = (a1, v) => { const r = sh.getRange(a1).merge(); if (typeof v === 'string' && v.charAt(0) === '=') r.setFormula(v); else r.setValue(v); return r; };
  const header = (a1, values) => { const r = sh.getRange(a1); r.setValues([values]); styleHeader_(r); r.setHorizontalAlignment('center'); };
  const SEL = '$B$3';
  const CUR_MONTH = 'DATE(YEAR(TODAY()),MONTH(TODAY()),1)';

  /* --- title & selected month --- */
  mergePut('A1:I1', 'Household Finance Dashboard').setBackground(COLORS.NAVY).setFontColor(COLORS.WHITE).setFontSize(16).setFontWeight('bold');
  sh.setRowHeight(1, 40);
  mergePut('A2:I2', 'Monthly cards, Income by Person and Payroll Deductions follow the Selected Month. Current Flexible Spending always follows today\'s month and week.')
    .setFontStyle('italic').setFontColor(COLORS.MUTED_TEXT).setFontSize(9);
  put('A3', 'Selected Month').setFontWeight('bold');
  const sel = put('B3', monthStart_(new Date()));
  sel.setNumberFormat('mmmm yyyy').setBackground(COLORS.INPUT).setFontWeight('bold')
    .setBorder(true, true, true, true, false, false, COLORS.NAVY, SpreadsheetApp.BorderStyle.SOLID)
    .setDataValidation(SpreadsheetApp.newDataValidation().requireDate().setAllowInvalid(false).setHelpText('Enter any date in the month you want to view; use the first of the month.').build());
  mergePut('C3:E3', '="Showing "&TEXT(' + SEL + ',"mmmm yyyy")&IF(' + SEL + '<>' + CUR_MONTH + ',"  (not the current month)","")').setFontColor(COLORS.MUTED_TEXT).setFontSize(9);
  mergePut('F3:I3', F('=IFERROR(LET(n,COUNTIF([STAGING.status],"Needs Review")+COUNTIF([STAGING.status],"Needs Split"),IF(n=0,"Import Staging: nothing awaiting review",n&" imported transaction(s) awaiting review on Import Staging")),"")'))
    .setFontSize(9).setHorizontalAlignment('right').setFontColor(COLORS.MUTED_TEXT);

  /* --- four cards --- */
  const cards = [
    { cols: 'A:B', label: 'Household Gross Income', color: COLORS.CARD_GROSS, sub: 'Income table · gross pay',
      f: F('=SUMIFS([INCOME.gross],[INCOME.month],' + SEL + ')') },
    { cols: 'C:D', label: 'Household Take-Home', color: COLORS.CARD_TAKEHOME, sub: 'Income table · take-home pay',
      f: F('=SUMIFS([INCOME.takeHome],[INCOME.month],' + SEL + ')') },
    { cols: 'E:F', label: 'Spending', color: COLORS.CARD_SPENDING, sub: 'Monthly Summary · expenses − refunds',
      f: F('=IFERROR(INDEX([SUMMARY.spending],MATCH(' + SEL + ',[SUMMARY.month],0)),0)') },
    { cols: 'G:H', label: 'Total Savings', color: COLORS.CARD_SAVINGS, sub: 'Monthly Summary · cash savings + payroll retirement',
      f: F('=IFERROR(INDEX([SUMMARY.totalSavings],MATCH(' + SEL + ',[SUMMARY.month],0)),0)') },
  ];
  cards.forEach(card => {
    const [c1, c2] = card.cols.split(':');
    mergePut(c1 + DASH.CARD_ROW_LABEL + ':' + c2 + DASH.CARD_ROW_LABEL, card.label).setBackground(card.color).setFontWeight('bold').setHorizontalAlignment('center');
    mergePut(c1 + DASH.CARD_ROW_VALUE + ':' + c2 + DASH.CARD_ROW_VALUE, card.f).setBackground(card.color).setFontSize(18).setFontWeight('bold').setHorizontalAlignment('center').setNumberFormat('$#,##0');
    mergePut(c1 + DASH.CARD_ROW_SUB + ':' + c2 + DASH.CARD_ROW_SUB, card.sub).setBackground(card.color).setFontSize(8).setFontColor(COLORS.MUTED_TEXT).setHorizontalAlignment('center');
    sh.getRange(c1 + DASH.CARD_ROW_LABEL + ':' + c2 + DASH.CARD_ROW_SUB).setBorder(true, true, true, true, false, false, COLORS.WHITE, SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
  });
  sh.setRowHeight(DASH.CARD_ROW_VALUE, 42);

  /* --- Income by Person (A:E) --- */
  styleSectionBar_(sh.getRange('A9:E9'), '="Income by Person — "&TEXT(' + SEL + ',"mmmm yyyy")');
  sh.getRange('A9').setFormula('="Income by Person — "&TEXT(' + SEL + ',"mmmm yyyy")');
  header('A10:E10', ['Person', 'Gross', 'Take-Home', 'Deductions', 'Take-Home %']);
  const personRows = [
    { row: DASH.INCOME_BEN, name: 'Ben', color: COLORS.BEN },
    { row: DASH.INCOME_VAL, name: 'Valerie', color: COLORS.VALERIE },
  ];
  personRows.forEach(p => {
    put('A' + p.row, p.name).setFontWeight('bold');
    put('B' + p.row, F('=SUMIFS([INCOME.gross],[INCOME.month],' + SEL + ',[INCOME.person],$A' + p.row + ')'));
    put('C' + p.row, F('=SUMIFS([INCOME.takeHome],[INCOME.month],' + SEL + ',[INCOME.person],$A' + p.row + ')'));
    put('D' + p.row, '=B' + p.row + '-C' + p.row);
    put('E' + p.row, '=IF(B' + p.row + '>0,C' + p.row + '/B' + p.row + ',"")');
    sh.getRange('A' + p.row + ':E' + p.row).setBackground(p.color);
  });
  const hh = DASH.INCOME_HH;
  put('A' + hh, 'Household').setFontWeight('bold');
  put('B' + hh, '=SUM(B' + DASH.INCOME_BEN + ':B' + DASH.INCOME_VAL + ')');
  put('C' + hh, '=SUM(C' + DASH.INCOME_BEN + ':C' + DASH.INCOME_VAL + ')');
  put('D' + hh, '=B' + hh + '-C' + hh);
  put('E' + hh, '=IF(B' + hh + '>0,C' + hh + '/B' + hh + ',"")');
  sh.getRange('A' + hh + ':E' + hh).setBackground(COLORS.HOUSEHOLD).setFontWeight('bold');
  sh.getRange('B11:D13').setNumberFormat(FORMATS.currency);
  sh.getRange('E11:E13').setNumberFormat(FORMATS.percent);
  sh.getRange('A10:E13').setBorder(true, true, true, true, true, true, COLORS.BORDER, SpreadsheetApp.BorderStyle.SOLID);

  /* --- Credit Scores — Latest (A:E) --- */
  styleSectionBar_(sh.getRange('A15:E15'), 'Credit Scores — Latest');
  header('A16:E16', ['Person', 'Score', 'Rating', 'Updated', 'Position (300–850)']);
  [{ row: DASH.CREDIT_BEN, name: 'Ben', color: COLORS.BEN }, { row: DASH.CREDIT_VAL, name: 'Valerie', color: COLORS.VALERIE }].forEach(p => {
    const r = p.row;
    put('A' + r, p.name).setFontWeight('bold');
    put('D' + r, F('=IF(MAXIFS([CREDIT.scoreDate],[CREDIT.person],$A' + r + ')=0,"",MAXIFS([CREDIT.scoreDate],[CREDIT.person],$A' + r + '))')).setNumberFormat(FORMATS.date);
    put('B' + r, F('=IF($D' + r + '="","",IFERROR(INDEX(FILTER([CREDIT.score],[CREDIT.person]=$A' + r + ',[CREDIT.scoreDate]=$D' + r + '),1),""))')).setNumberFormat(FORMATS.int).setFontWeight('bold');
    put('C' + r, '=IF($B' + r + '="","No score yet",IFS($B' + r + '<580,"Poor",$B' + r + '<670,"Fair",$B' + r + '<740,"Good",$B' + r + '<800,"Very Good",TRUE,"Exceptional"))');
    put('E' + r, '=IF($B' + r + '="","",SPARKLINE(($B' + r + '-300)/550,{"charttype","bar";"max",1;"color1","' + COLORS.TEAL + '"}))');
    sh.getRange('A' + r + ':E' + r).setBackground(p.color);
  });
  sh.getRange('A16:E18').setBorder(true, true, true, true, true, true, COLORS.BORDER, SpreadsheetApp.BorderStyle.SOLID);
  mergePut('A19:I19', 'Enter scores on the Credit Scores tab (monthly). Scale: 300–579 Poor · 580–669 Fair · 670–739 Good · 740–799 Very Good · 800–850 Exceptional.')
    .setFontSize(8).setFontColor(COLORS.MUTED_TEXT).setFontStyle('italic');

  /* --- Payroll Deductions --- */
  styleSectionBar_(sh.getRange('A21:I21'), '');
  sh.getRange('A21').setFormula('="Payroll Deductions — "&TEXT(' + SEL + ',"mmmm yyyy")');
  const groups = [
    { c1: 'A', c2: 'B', c3: 'C', name: 'Ben', color: COLORS.BEN, person: 'Ben', grossCell: '$B$' + DASH.INCOME_BEN },
    { c1: 'D', c2: 'E', c3: 'F', name: 'Valerie', color: COLORS.VALERIE, person: 'Valerie', grossCell: '$B$' + DASH.INCOME_VAL },
    { c1: 'G', c2: 'H', c3: 'I', name: 'Household', color: COLORS.HOUSEHOLD, person: null, grossCell: '$B$' + DASH.INCOME_HH },
  ];
  const deductions = [
    ['Federal Tax', 'fedTax'], ['State / Local Tax', 'stateTax'], ['Social Security & Medicare', 'ssMed'],
    ['Health / Insurance', 'health'], ['Retirement', 'retirement'], ['Other Deductions', 'otherDed'], ['Total Deductions', 'totalDed'],
  ];
  groups.forEach(g => {
    mergePut(g.c1 + DASH.PAYROLL_GROUPS + ':' + g.c3 + DASH.PAYROLL_GROUPS, g.name).setBackground(g.color).setFontWeight('bold').setHorizontalAlignment('center');
    header(g.c1 + DASH.PAYROLL_HEADER + ':' + g.c3 + DASH.PAYROLL_HEADER, ['Deduction', 'Amount', '% of Gross']);
    deductions.forEach((d, i) => {
      const r = DASH.PAYROLL_FIRST + i;
      put(g.c1 + r, d[0]);
      const crit = g.person ? ',[INCOME.person],"' + g.person + '"' : '';
      put(g.c2 + r, F('=SUMIFS([INCOME.' + d[1] + '],[INCOME.month],' + SEL + crit + ')')).setNumberFormat(FORMATS.currency);
      put(g.c3 + r, '=IF(' + g.grossCell + '>0,' + g.c2 + r + '/' + g.grossCell + ',"")').setNumberFormat(FORMATS.percent);
    });
    const block = sh.getRange(g.c1 + DASH.PAYROLL_FIRST + ':' + g.c3 + DASH.PAYROLL_TOTAL);
    block.setBackground(g.color);
    sh.getRange(g.c1 + DASH.PAYROLL_TOTAL + ':' + g.c3 + DASH.PAYROLL_TOTAL).setFontWeight('bold');
    sh.getRange(g.c1 + DASH.PAYROLL_HEADER + ':' + g.c3 + DASH.PAYROLL_TOTAL).setBorder(true, true, true, true, true, true, COLORS.BORDER, SpreadsheetApp.BorderStyle.SOLID);
  });

  /* --- Current Flexible Spending (follows TODAY) --- */
  styleSectionBar_(sh.getRange('A32:I32'), '');
  sh.getRange('A32').setFormula('="Current Flexible Spending — "&TEXT(TODAY(),"mmmm yyyy")');
  const planMatch = 'MATCH(' + CUR_MONTH + ',[PLAN.month],0)';
  const flex = [
    { cols: ['A', 'C'], label: 'Amount Available This Month', f: F('=IFERROR(INDEX([PLAN.available],' + planMatch + '),"No plan row")'),
      sub: F('=IFERROR("Target "&TEXT(INDEX([PLAN.target],' + planMatch + '),"$#,##0")&" · Flexible spent "&TEXT(INDEX([PLAN.flexSpent],' + planMatch + '),"$#,##0"),"Add a row for this month on the Monthly Plan tab")') },
    { cols: ['D', 'F'], label: 'Suggested This Week', f: F('=IFERROR(INDEX([PLAN.suggestedWeek],' + planMatch + '),"No plan row")'),
      sub: '="Week of "&TEXT(TODAY()-WEEKDAY(TODAY(),2)+1,"ddd mmm d")&" – "&TEXT(MIN(TODAY()-WEEKDAY(TODAY(),2)+7,EOMONTH(TODAY(),0)),"ddd mmm d")&" · Flexible only"' },
    { cols: ['G', 'I'], label: 'Spent This Week', f: F('=IFERROR(INDEX([PLAN.spentWeek],' + planMatch + '),"No plan row")'),
      sub: 'Monday through today · Spending Type = Flexible' },
  ];
  flex.forEach(b => {
    mergePut(b.cols[0] + DASH.FLEX_LABEL + ':' + b.cols[1] + DASH.FLEX_LABEL, b.label).setBackground(COLORS.PALE_BLUE).setFontWeight('bold').setHorizontalAlignment('center');
    mergePut(b.cols[0] + DASH.FLEX_VALUE + ':' + b.cols[1] + DASH.FLEX_VALUE, b.f).setFontSize(18).setFontWeight('bold').setHorizontalAlignment('center').setNumberFormat('$#,##0');
    mergePut(b.cols[0] + DASH.FLEX_SUB + ':' + b.cols[1] + DASH.FLEX_SUB, b.sub).setFontSize(8).setFontColor(COLORS.MUTED_TEXT).setHorizontalAlignment('center');
    sh.getRange(b.cols[0] + DASH.FLEX_LABEL + ':' + b.cols[1] + DASH.FLEX_SUB).setBorder(true, true, true, true, false, false, COLORS.BORDER, SpreadsheetApp.BorderStyle.SOLID);
  });
  sh.setRowHeight(DASH.FLEX_VALUE, 42);
  sh.setConditionalFormatRules([
    cfRule_(sh.getRange('A34:C34'), '=AND(ISNUMBER(A34),A34<0)', COLORS.OVER_FILL, COLORS.OVER_FONT),
    cfRule_(sh.getRange('A34:C34'), '=AND(ISNUMBER(A34),A34>=0)', COLORS.UNDER_FILL, COLORS.UNDER_FONT),
    cfRule_(sh.getRange('F39:F46'), '=F39="Funded"', COLORS.UNDER_FILL, COLORS.UNDER_FONT, { bold: true }),
    cfRule_(sh.getRange('F39:F46'), '=OR(F39="Behind",F39="Past Target Date")', COLORS.OVER_FILL, COLORS.OVER_FONT),
    cfRule_(sh.getRange('B11:D13'), '=AND(B11=0,$B$3<>"")', null, COLORS.MUTED_TEXT),
    cfRule_(sh.getRange('F3:I3'), '=ISNUMBER(SEARCH("awaiting review on",F3))', COLORS.WARN_FILL, COLORS.WARN_FONT, { bold: true }),
  ]);

  /* --- Savings & Reserves + checklist --- */
  styleSectionBar_(sh.getRange('A37:F37'), 'Savings & Reserves');
  styleSectionBar_(sh.getRange('G37:I37'), 'Monthly Review Checklist');
  header('A38:F38', ['Fund Name', 'Target', 'Current', 'Amount Needed', '% Funded', 'Status']);
  header('G38:G38', ['Done']);
  sh.getRange('H38:I38').merge().setValue('Item');
  styleHeader_(sh.getRange('H38:I38'));
  const fundCols = [['name', 'A'], ['target', 'B'], ['current', 'C'], ['amountNeeded', 'D'], ['pctFunded', 'E'], ['status', 'F']];
  for (let k = 1; k <= DASH.FUNDS_COUNT; k++) {
    const r = DASH.FUNDS_FIRST + k - 1;
    fundCols.forEach(fc => {
      put(fc[1] + r, F('=IF(INDEX([FUNDS.id],' + k + ')="","",INDEX([FUNDS.' + fc[0] + '],' + k + '))'));
    });
    sh.getRange('B' + r + ':D' + r).setNumberFormat(FORMATS.currency);
    sh.getRange('E' + r).setNumberFormat(FORMATS.percent);
  }
  const checklist = [
    'Categorize every new transaction (no blank categories).',
    'Clear all Validation Flags on Transactions.',
    'Confirm this month\'s paychecks are in Income.',
    'Compare Monthly Budget planned vs. actual.',
    'Review Planned Irregular and Unexpected purchases.',
    'Set next month\'s flexible target on Monthly Plan.',
    'Adjust Savings & Reserves targets if needed.',
    'Complete this month\'s Monthly Review row.',
  ];
  checklist.forEach((item, i) => {
    const r = DASH.FUNDS_FIRST + i;
    sh.getRange('G' + r).setDataValidation(SpreadsheetApp.newDataValidation().requireCheckbox().build()).setHorizontalAlignment('center');
    sh.getRange('H' + r + ':I' + r).merge().setValue(item).setFontSize(9).setWrap(true);
  });
  sh.getRange('A38:F46').setBorder(true, true, true, true, true, true, COLORS.BORDER, SpreadsheetApp.BorderStyle.SOLID);
  sh.getRange('G38:I46').setBorder(true, true, true, true, true, true, COLORS.BORDER, SpreadsheetApp.BorderStyle.SOLID);

  /* --- footnote --- */
  mergePut('A48:I48', F('="Debt is reviewed quarterly (Mar · Jun · Sep · Dec) on the Quarterly Debt Review tab — household debt "&TEXT(SUMIFS([DEBTS.latestBalance],[DEBTS.group],"<>Student Loans"),"$#,##0")&" · student loans "&TEXT(SUMIFS([DEBTS.latestBalance],[DEBTS.group],"Student Loans"),"$#,##0")&IFERROR(" · PSLF (lowest loan) "&TEXTJOIN(", ",TRUE,MAP(UNIQUE(FILTER([DEBTS.owner],([DEBTS.group]="Student Loans")*([DEBTS.pslfEstimated]<>""))),LAMBDA(o,o&" "&MINIFS([DEBTS.pslfEstimated],[DEBTS.owner],o,[DEBTS.group],"Student Loans")&"/120"))),"")&". Balances are kept off the everyday Dashboard on purpose."'))
    .setFontSize(8).setFontColor(COLORS.MUTED_TEXT).setFontStyle('italic');

  /* --- Reminders (calculated, beside the cards): what needs a hand, e.g. a PSLF count that is due a check --- */
  const gc = DASH.SIDE_COL, gw = DASH.SIDE_WIDTH;
  styleSectionBar_(sh.getRange(DASH.REMINDERS_BAR, gc, 1, gw), 'Reminders');
  sh.setRowHeight(DASH.REMINDERS_BAR, 40);
  sh.getRange(2, gc, 1, gw).merge().setValue('Things only you can do. Financial goals are on the Goals tab.').setFontSize(9).setFontColor(COLORS.MUTED_TEXT);
  const remBox = sh.getRange(DASH.REMINDERS_FIRST, gc, DASH.REMINDERS_ROWS, gw).merge();
  const personsList = (LISTS.filter(l => l.key === 'PERSONS')[0] || { values: [] }).values;
  const creditLines = personsList.map(pn => 'IF(MAXIFS([CREDIT.scoreDate],[CREDIT.person],"' + pn + '")<EDATE(TODAY(),-c),"Credit score for ' + pn + ': "&IF(MAXIFS([CREDIT.scoreDate],[CREDIT.person],"' + pn + '")=0,"never entered","last entered "&TEXT(MAXIFS([CREDIT.scoreDate],[CREDIT.person],"' + pn + '"),"mmm d, yyyy"))&". Enter it on the Credit Scores tab.","")').join(',');
  remBox.setFormula(F('=LET(m,IFERROR(N(SETTING_PSLF_REMINDER_MONTHS),12),c,IFERROR(N(SETTING_CREDIT_REMINDER_MONTHS),3),due,TEXTJOIN(CHAR(10),TRUE,ARRAYFORMULA(IF(([DEBTS.id]<>"")*([DEBTS.group]="Student Loans")*(([DEBTS.pslfAsOf]="")+([DEBTS.pslfAsOf]<EDATE(TODAY(),-m))),"PSLF count for "&[DEBTS.name]&": "&IF([DEBTS.pslfAsOf]="","never entered","last confirmed "&TEXT([DEBTS.pslfAsOf],"mmm d, yyyy"))&". Read it on studentaid.gov and update Debts.","")),' + creditLines + '),IF(due="","Nothing due. PSLF counts are flagged after "&m&" months and credit scores after "&c&" months (App Setup).","• "&SUBSTITUTE(due,CHAR(10),CHAR(10)&"• ")))'));
  remBox.setWrap(true).setVerticalAlignment('top').setFontSize(10).setBackground(COLORS.WARN_FILL).setFontColor(COLORS.WARN_FONT)
    .setBorder(true, true, true, true, false, false, COLORS.BORDER, SpreadsheetApp.BorderStyle.SOLID);
  setNamedRange_('DASH_REMINDERS', remBox);

  /* --- protection: warning-only, except inputs --- */
  const prot = sh.protect().setDescription('Dashboard is calculated. Change the Selected Month in B3 or tick the checklist; write goals on the Goals tab; edit data on the raw tabs.');
  prot.setWarningOnly(true);
  prot.setUnprotectedRanges([sh.getRange('B3'), sh.getRange('G' + DASH.FUNDS_FIRST + ':G' + (DASH.FUNDS_FIRST + DASH.FUNDS_COUNT - 1))]);
}

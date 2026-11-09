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

// Rows of the Dashboard. The accounts block (rows 3–7) and the "This month" bar (row 9) come first;
// everything the handoff specified follows, DASH.SHIFT rows lower than its original position.
const DASH = {
  SHIFT: 7,
  ACCT_HEADER: 3, ACCT_FIRST: 4, MONTH_BAR: 9,
  SELECTED_MONTH: 'B10',
  CARD_ROW_LABEL: 12, CARD_ROW_VALUE: 13, CARD_ROW_SUB: 14,
  INCOME_HEADER: 17, INCOME_BEN: 18, INCOME_VAL: 19, INCOME_HH: 20,
  CREDIT_HEADER: 23, CREDIT_BEN: 24, CREDIT_VAL: 25,
  PAYROLL_GROUPS: 29, PAYROLL_HEADER: 30, PAYROLL_FIRST: 31, PAYROLL_TOTAL: 37,
  FLEX_BAR: 39, FLEX_LABEL: 40, FLEX_VALUE: 41, FLEX_SUB: 42,
  FUNDS_BAR: 44, FUNDS_HEADER: 45, FUNDS_FIRST: 46, FUNDS_COUNT: 8,
  FOOTNOTE: 55,
  LAST_ROW: 59,
  // where the inputs sat before the accounts block existed (read once by the upgrade)
  LEGACY_SELECTED_MONTH: 'B3', LEGACY_FUNDS_FIRST: 39,
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
  ensureSheetSize_(sh, DASH.LAST_ROW, 9);
  sh.setHiddenGridlines(true);
  sh.setColumnWidth(1, 200);
  for (let c = 2; c <= 9; c++) sh.setColumnWidth(c, 118);
  sh.getRange(1, 1, DASH.LAST_ROW, 9).setFontColor(COLORS.TEXT).setFontSize(10).setVerticalAlignment('middle');

  const put = (a1, v) => { const r = sh.getRange(a1); if (typeof v === 'string' && v.charAt(0) === '=') r.setFormula(v); else r.setValue(v); return r; };
  const mergePut = (a1, v) => { const r = sh.getRange(a1).merge(); if (typeof v === 'string' && v.charAt(0) === '=') r.setFormula(v); else r.setValue(v); return r; };
  const header = (a1, values) => { const r = sh.getRange(a1); r.setValues([values]); styleHeader_(r); r.setHorizontalAlignment('center'); };
  const SEL = '$B$10';
  const CUR_MONTH = 'DATE(YEAR(TODAY()),MONTH(TODAY()),1)';

  /* --- title & selected month --- */
  mergePut('A1:I1', 'Household Finance Dashboard').setBackground(COLORS.NAVY).setFontColor(COLORS.WHITE).setFontSize(16).setFontWeight('bold');
  sh.setRowHeight(1, 40);
  mergePut('A2:I2', 'Accounts show tonight\'s balances from the bank feed. The monthly cards, Income by Person and Payroll Deductions follow the Selected Month. Current Flexible Spending always follows today\'s month and week.')
    .setFontStyle('italic').setFontColor(COLORS.MUTED_TEXT).setFontSize(9);
  /* --- accounts block: checking and savings (left), credit cards with due dates (right) --- */
  const q = (s) => String(s).replace(/"/g, '""');
  const accCrit = (line) => '[ACCOUNTS.institution],"*' + q(line.institution) + '*",[ACCOUNTS.accountType],"' + q(line.type) + '",[ACCOUNTS.includeNW],"Yes"';
  const balanceOf = (line) => 'IF(COUNTIFS(' + accCrit(line) + ',[ACCOUNTS.connectionId],"<>")=0,"not connected yet",SUMIFS([ACCOUNTS.currentBalance],' + accCrit(line) + '))';
  header('A' + DASH.ACCT_HEADER + ':B' + DASH.ACCT_HEADER, ['Account', 'Balance']);
  sh.getRange('C' + DASH.ACCT_HEADER + ':D' + DASH.ACCT_HEADER).merge(); styleHeader_(sh.getRange('C' + DASH.ACCT_HEADER + ':D' + DASH.ACCT_HEADER));
  sh.getRange('C' + DASH.ACCT_HEADER).setValue('Updated');
  header('F' + DASH.ACCT_HEADER + ':H' + DASH.ACCT_HEADER, ['Credit card', 'Owed', 'Due']);
  sh.getRange('I' + DASH.ACCT_HEADER).setValue('').setBackground(COLORS.PALE_BLUE);
  sh.getRange('B' + DASH.ACCT_HEADER).setHorizontalAlignment('right');
  sh.getRange('G' + DASH.ACCT_HEADER).setHorizontalAlignment('right');
  DASH_ACCOUNTS.main.forEach((line, i) => {
    const r = DASH.ACCT_FIRST + i;
    put('A' + r, line.label + (line.sub ? ' (' + line.sub + ')' : '')).setFontWeight('bold').setBackground(COLORS.CARD_GROSS);
    put('B' + r, F('=' + balanceOf(line))).setNumberFormat(FORMATS.currency).setFontWeight('bold').setFontSize(14).setHorizontalAlignment('right').setBackground(COLORS.CARD_GROSS);
    mergePut('C' + r + ':D' + r, F('=IFERROR(LET(d,MAXIFS([ACCOUNTS.lastSynced],' + accCrit(line) + '),IF(d=0,"",TEXT(d,"mmm d, h:mm am/pm"))),"")')).setFontSize(9).setFontColor(COLORS.MUTED_TEXT).setBackground(COLORS.CARD_GROSS);
    sh.setRowHeight(r, 28);
  });
  DASH_ACCOUNTS.cards.forEach((inst, i) => {
    const r = DASH.ACCT_FIRST + i;
    const line = { institution: inst, type: 'Credit Card' };
    put('F' + r, inst).setFontWeight('bold').setBackground(COLORS.CARD_SPENDING);
    put('G' + r, F('=' + balanceOf(line))).setNumberFormat(FORMATS.currency).setFontWeight('bold').setFontSize(14).setHorizontalAlignment('right').setBackground(COLORS.CARD_SPENDING);
    const idOf = 'IFERROR(INDEX(FILTER([ACCOUNTS.id],[ACCOUNTS.accountType]="Credit Card",ISNUMBER(SEARCH("' + q(inst) + '",[ACCOUNTS.institution])),[ACCOUNTS.includeNW]="Yes"),1),"")';
    mergePut('H' + r + ':I' + r, F('=IFERROR(LET(id,' + idOf + ',nd,IFERROR(INDEX([DEBTS.nextDue],MATCH(id,[DEBTS.linkedAccount],0)),""),IF(id="","",IF(AND(ISNUMBER($G' + r + '),$G' + r + '<=0),"paid in full",IF(nd="","","due "&TEXT(nd,"mmm d"))))),"")'))
      .setFontSize(9).setFontColor(COLORS.MUTED_TEXT).setBackground(COLORS.CARD_SPENDING);
    sh.setRowHeight(r, 28);
  });
  const cardTotalRow = DASH.ACCT_FIRST + DASH_ACCOUNTS.cards.length;
  put('F' + cardTotalRow, 'Total owed on cards').setFontWeight('bold').setBackground(COLORS.PALE_BLUE);
  put('G' + cardTotalRow, '=SUMPRODUCT(N(+G' + DASH.ACCT_FIRST + ':G' + (cardTotalRow - 1) + '))').setNumberFormat(FORMATS.currency).setFontWeight('bold').setHorizontalAlignment('right').setBackground(COLORS.PALE_BLUE);
  sh.getRange('H' + cardTotalRow + ':I' + cardTotalRow).merge().setBackground(COLORS.PALE_BLUE);
  sh.getRange('A' + DASH.ACCT_HEADER + ':D' + (DASH.ACCT_FIRST + DASH_ACCOUNTS.main.length - 1)).setBorder(true, true, true, true, true, true, COLORS.BORDER, SpreadsheetApp.BorderStyle.SOLID);
  sh.getRange('F' + DASH.ACCT_HEADER + ':I' + cardTotalRow).setBorder(true, true, true, true, true, true, COLORS.BORDER, SpreadsheetApp.BorderStyle.SOLID);
  mergePut('A8:I8', 'Balances arrive from the bank feed each night; a line reads "not connected yet" until its bank is connected. Card due dates come from the lender.')
    .setFontSize(8).setFontColor(COLORS.MUTED_TEXT).setFontStyle('italic');

  /* --- This month --- */
  styleSectionBar_(sh.getRange('A' + DASH.MONTH_BAR + ':I' + DASH.MONTH_BAR), 'This month');

  put('A10', 'Selected Month').setFontWeight('bold');
  const sel = put('B10', monthStart_(new Date()));
  sel.setNumberFormat('mmmm yyyy').setBackground(COLORS.INPUT).setFontWeight('bold')
    .setBorder(true, true, true, true, false, false, COLORS.NAVY, SpreadsheetApp.BorderStyle.SOLID)
    .setDataValidation(SpreadsheetApp.newDataValidation().requireDate().setAllowInvalid(false).setHelpText('Enter any date in the month you want to view; use the first of the month.').build());
  mergePut('C10:E10', '="Showing "&TEXT(' + SEL + ',"mmmm yyyy")&IF(' + SEL + '<>' + CUR_MONTH + ',"  (not the current month)","")').setFontColor(COLORS.MUTED_TEXT).setFontSize(9);
  mergePut('F10:I10', F('=IFERROR(LET(n,COUNTIF([STAGING.status],"Needs Review")+COUNTIF([STAGING.status],"Needs Split"),IF(n=0,"Import Staging: nothing awaiting review",n&" imported transaction(s) awaiting review on Import Staging")),"")'))
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
  styleSectionBar_(sh.getRange('A16:E16'), '="Income by Person — "&TEXT(' + SEL + ',"mmmm yyyy")');
  sh.getRange('A16').setFormula('="Income by Person — "&TEXT(' + SEL + ',"mmmm yyyy")');
  header('A17:E17', ['Person', 'Gross', 'Take-Home', 'Deductions', 'Take-Home %']);
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
  sh.getRange('B18:D20').setNumberFormat(FORMATS.currency);
  sh.getRange('E18:E20').setNumberFormat(FORMATS.percent);
  sh.getRange('A17:E20').setBorder(true, true, true, true, true, true, COLORS.BORDER, SpreadsheetApp.BorderStyle.SOLID);

  /* --- Credit Scores — Latest (A:E) --- */
  styleSectionBar_(sh.getRange('A22:E22'), 'Credit Scores — Latest');
  header('A23:E23', ['Person', 'Score', 'Rating', 'Updated', 'Position (300–850)']);
  [{ row: DASH.CREDIT_BEN, name: 'Ben', color: COLORS.BEN }, { row: DASH.CREDIT_VAL, name: 'Valerie', color: COLORS.VALERIE }].forEach(p => {
    const r = p.row;
    put('A' + r, p.name).setFontWeight('bold');
    put('D' + r, F('=IF(MAXIFS([CREDIT.scoreDate],[CREDIT.person],$A' + r + ')=0,"",MAXIFS([CREDIT.scoreDate],[CREDIT.person],$A' + r + '))')).setNumberFormat(FORMATS.date);
    put('B' + r, F('=IF($D' + r + '="","",IFERROR(INDEX(FILTER([CREDIT.score],[CREDIT.person]=$A' + r + ',[CREDIT.scoreDate]=$D' + r + '),1),""))')).setNumberFormat(FORMATS.int).setFontWeight('bold');
    put('C' + r, '=IF($B' + r + '="","No score yet",IFS($B' + r + '<580,"Poor",$B' + r + '<670,"Fair",$B' + r + '<740,"Good",$B' + r + '<800,"Very Good",TRUE,"Exceptional"))');
    put('E' + r, '=IF($B' + r + '="","",SPARKLINE(($B' + r + '-300)/550,{"charttype","bar";"max",1;"color1","' + COLORS.TEAL + '"}))');
    sh.getRange('A' + r + ':E' + r).setBackground(p.color);
  });
  sh.getRange('A23:E25').setBorder(true, true, true, true, true, true, COLORS.BORDER, SpreadsheetApp.BorderStyle.SOLID);
  mergePut('A26:I26', 'Enter scores on the Credit Scores tab (monthly). Scale: 300–579 Poor · 580–669 Fair · 670–739 Good · 740–799 Very Good · 800–850 Exceptional.')
    .setFontSize(8).setFontColor(COLORS.MUTED_TEXT).setFontStyle('italic');

  /* --- Payroll Deductions --- */
  styleSectionBar_(sh.getRange('A28:I28'), '');
  sh.getRange('A28').setFormula('="Payroll Deductions — "&TEXT(' + SEL + ',"mmmm yyyy")');
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
  styleSectionBar_(sh.getRange('A39:I39'), '');
  sh.getRange('A39').setFormula('="Current Flexible Spending — "&TEXT(TODAY(),"mmmm yyyy")');
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
    cfRule_(sh.getRange('A41:C41'), '=AND(ISNUMBER(A41),A41<0)', COLORS.OVER_FILL, COLORS.OVER_FONT),
    cfRule_(sh.getRange('A41:C41'), '=AND(ISNUMBER(A41),A41>=0)', COLORS.UNDER_FILL, COLORS.UNDER_FONT),
    cfRule_(sh.getRange('F46:F53'), '=F46="Funded"', COLORS.UNDER_FILL, COLORS.UNDER_FONT, { bold: true }),
    cfRule_(sh.getRange('F46:F53'), '=OR(F46="Behind",F46="Past Target Date")', COLORS.OVER_FILL, COLORS.OVER_FONT),
    cfRule_(sh.getRange('B18:D20'), '=AND(B18=0,$B$10<>"")', null, COLORS.MUTED_TEXT),
    cfRule_(sh.getRange('F10:I10'), '=ISNUMBER(SEARCH("awaiting review on",F10))', COLORS.WARN_FILL, COLORS.WARN_FONT, { bold: true }),
  ]);

  /* --- Savings & Reserves + checklist --- */
  styleSectionBar_(sh.getRange('A44:F44'), 'Savings & Reserves');
  styleSectionBar_(sh.getRange('G44:I44'), 'Monthly Review Checklist');
  header('A45:F45', ['Fund Name', 'Target', 'Current', 'Amount Needed', '% Funded', 'Status']);
  header('G45:G45', ['Done']);
  sh.getRange('H45:I45').merge().setValue('Item');
  styleHeader_(sh.getRange('H45:I45'));
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
  sh.getRange('A45:F53').setBorder(true, true, true, true, true, true, COLORS.BORDER, SpreadsheetApp.BorderStyle.SOLID);
  sh.getRange('G45:I53').setBorder(true, true, true, true, true, true, COLORS.BORDER, SpreadsheetApp.BorderStyle.SOLID);

  /* --- footnote --- */
  mergePut('A55:I55', F('="Debt is reviewed quarterly (Mar · Jun · Sep · Dec) on the Quarterly Debt Review tab — household debt "&TEXT(SUMIFS([DEBTS.latestBalance],[DEBTS.group],"<>Student Loans"),"$#,##0")&" · student loans "&TEXT(SUMIFS([DEBTS.latestBalance],[DEBTS.group],"Student Loans"),"$#,##0")&IFERROR(" · PSLF (lowest loan) "&TEXTJOIN(", ",TRUE,MAP(UNIQUE(FILTER([DEBTS.owner],([DEBTS.group]="Student Loans")*([DEBTS.pslfEstimated]<>""))),LAMBDA(o,o&" "&MINIFS([DEBTS.pslfEstimated],[DEBTS.owner],o,[DEBTS.group],"Student Loans")&"/120"))),"")&". Balances are kept off the everyday Dashboard on purpose."'))
    .setFontSize(8).setFontColor(COLORS.MUTED_TEXT).setFontStyle('italic');

  /* --- protection: warning-only, except inputs --- */
  const prot = sh.protect().setDescription('Dashboard is calculated. Change the Selected Month in B10 or tick the checklist; write goals on the Goals tab; edit data on the raw tabs.');
  prot.setWarningOnly(true);
  setNamedRange_('DASH_SELECTED_MONTH', sh.getRange(DASH.SELECTED_MONTH));
  setNamedRange_('DASH_CHECKLIST', sh.getRange('G' + DASH.FUNDS_FIRST + ':G' + (DASH.FUNDS_FIRST + DASH.FUNDS_COUNT - 1)));
  prot.setUnprotectedRanges([sh.getRange(DASH.SELECTED_MONTH), sh.getRange('G' + DASH.FUNDS_FIRST + ':G' + (DASH.FUNDS_FIRST + DASH.FUNDS_COUNT - 1))]);
}

/* Reminders tab: the few things only the owner can do, calculated from the tables. Rebuilt by buildWorkbook / upgradeWorkbook. */
const REMINDERS = { WIDTH: 8, BOX_FIRST: 4, BOX_ROWS: 14 };

function buildReminders_() {
  const sh = getOrCreateSheet_(SHEETS.REMINDERS);
  const F = (t) => resolveFormula_(t, null, null);
  sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).breakApart();
  sh.clear(); // SAFETY-APPROVED: the Reminders tab is calculated (one formula box); rebuilt by buildWorkbook / upgradeWorkbook
  sh.getProtections(SpreadsheetApp.ProtectionType.SHEET).forEach(p => p.remove());
  const lastRow = REMINDERS.BOX_FIRST + REMINDERS.BOX_ROWS + 3;
  ensureSheetSize_(sh, lastRow, REMINDERS.WIDTH);
  sh.setHiddenGridlines(true);
  for (let c = 1; c <= REMINDERS.WIDTH; c++) sh.setColumnWidth(c, 120);
  sh.getRange(1, 1, lastRow, REMINDERS.WIDTH).setFontColor(COLORS.TEXT).setFontSize(10).setVerticalAlignment('middle');
  sh.getRange(1, 1, 1, REMINDERS.WIDTH).merge().setValue('Reminders').setBackground(COLORS.NAVY).setFontColor(COLORS.WHITE).setFontSize(18).setFontWeight('bold');
  sh.setRowHeight(1, 44);
  sh.getRange(2, 1, 1, REMINDERS.WIDTH).merge().setValue('The few things the bank feed cannot do for you. This list is calculated: it clears itself when you update the value. The nightly sync emails it at most once a month while something is listed (switch and timings on App Setup). Finance Tracker → Show reminders shows the same list.')
    .setFontSize(10).setFontColor(COLORS.MUTED_TEXT).setWrap(true);
  sh.setRowHeight(2, 48);
  const personsList = (LISTS.filter(l => l.key === 'PERSONS')[0] || { values: [] }).values;
  const creditLines = personsList.map(pn => 'IF(MAXIFS([CREDIT.scoreDate],[CREDIT.person],"' + pn + '")<EDATE(TODAY(),-c),"Credit score for ' + pn + ': "&IF(MAXIFS([CREDIT.scoreDate],[CREDIT.person],"' + pn + '")=0,"never entered","last entered "&TEXT(MAXIFS([CREDIT.scoreDate],[CREDIT.person],"' + pn + '"),"mmm d, yyyy"))&". Enter it on the Credit Scores tab.","")').join(',');
  const remBox = sh.getRange(REMINDERS.BOX_FIRST, 1, REMINDERS.BOX_ROWS, REMINDERS.WIDTH).merge();
  remBox.setFormula(F('=LET(m,IFERROR(N(SETTING_PSLF_REMINDER_MONTHS),12),c,IFERROR(N(SETTING_CREDIT_REMINDER_MONTHS),3),due,TEXTJOIN(CHAR(10),TRUE,ARRAYFORMULA(IF(([DEBTS.id]<>"")*([DEBTS.group]="Student Loans")*(([DEBTS.pslfAsOf]="")+([DEBTS.pslfAsOf]<EDATE(TODAY(),-m))),"PSLF count for "&[DEBTS.name]&": "&IF([DEBTS.pslfAsOf]="","never entered","last confirmed "&TEXT([DEBTS.pslfAsOf],"mmm d, yyyy"))&". Read it on studentaid.gov and update Debts.","")),' + creditLines + '),IF(due="","Nothing due. PSLF counts are flagged after "&m&" months and credit scores after "&c&" months (App Setup).","• "&SUBSTITUTE(due,CHAR(10),CHAR(10)&"• ")))'));
  remBox.setWrap(true).setVerticalAlignment('top').setFontSize(12).setBackground(COLORS.WARN_FILL).setFontColor(COLORS.WARN_FONT)
    .setBorder(true, true, true, true, false, false, COLORS.BORDER, SpreadsheetApp.BorderStyle.SOLID);
  for (let r = REMINDERS.BOX_FIRST; r < REMINDERS.BOX_FIRST + REMINDERS.BOX_ROWS; r++) sh.setRowHeight(r, 26);
  setNamedRange_('REMINDERS_BOX', remBox);
  const note = REMINDERS.BOX_FIRST + REMINDERS.BOX_ROWS + 1;
  sh.getRange(note, 1, 1, REMINDERS.WIDTH).merge().setValue('Where to update each item: PSLF counts on Debts (PSLF Official Count and PSLF Count As Of), credit scores on the Credit Scores tab, the pension note on Accounts, the tax debt balance on Quarterly Debt Review.')
    .setFontSize(9).setFontColor(COLORS.MUTED_TEXT).setWrap(true);
  sh.setRowHeight(note, 36);
  const prot = sh.protect().setDescription('Reminders are calculated. Update the values on their own tabs.');
  prot.setWarningOnly(true);
}

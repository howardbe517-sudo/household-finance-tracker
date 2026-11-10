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
// Rows of the Dashboard: the accounts block (rows 3–7), then this month only. The whole-household
// view (averages, income by person, payroll deductions, credit scores, funds, net worth) lives
// on the Financial Summary tab (FINSUM in FinancialSummary.gs).
// paydays of each Expected Income source inside the month [ms, me] (see Config EXPECT / PLAN notes)
const PD = 'IFERROR(IF([EXPECT.frequency]="Biweekly",IF(N([EXPECT.lastPayDate])=0,26/12,INT((me-N([EXPECT.lastPayDate]))/14)+INT((N([EXPECT.lastPayDate])-ms)/14)+1),IF([EXPECT.frequency]="Weekly",IF(N([EXPECT.lastPayDate])=0,52/12,INT((me-N([EXPECT.lastPayDate]))/7)+INT((N([EXPECT.lastPayDate])-ms)/7)+1),IF([EXPECT.frequency]="Semimonthly",2,IF([EXPECT.frequency]="Monthly",1,0)))),0)';

const DASH = {
  ACCT_HEADER: 3, ACCT_FIRST: 4, ACCT_WITH_BILLS: 6, MONTH_BAR: 9,
  SELECTED_MONTH: 'B10', REVIEW_LINE: 11,
  CARD_ROW_LABEL: 12, CARD_ROW_VALUE: 13, CARD_ROW_SUB: 14, EXPECT_LINE: 15,
  FLEX_BAR: 17, FLEX_LABEL: 18, FLEX_VALUE: 19, FLEX_SUB: 20,
  CHECK_BAR: 22, CHECK_HEADER: 23, CHECK_FIRST: 24, CHECK_COUNT: 8,
  LAST_ROW: 34,
  // where the inputs sat in older layouts (read once by the upgrade when no named range exists)
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
  // three equal thirds (A:C, D:F, G:I = 360px each) so the cards and the flexible boxes line up; F wide enough for a card issuer's name
  [190, 100, 70, 110, 120, 130, 120, 120, 120].forEach((w, i) => sh.setColumnWidth(i + 1, w));
  sh.getRange(1, 1, DASH.LAST_ROW, 9).setFontColor(COLORS.TEXT).setFontSize(10).setVerticalAlignment('middle');

  const put = (a1, v) => { const r = sh.getRange(a1); if (typeof v === 'string' && v.charAt(0) === '=') r.setFormula(v); else r.setValue(v); return r; };
  const mergePut = (a1, v) => { const r = sh.getRange(a1).merge(); if (typeof v === 'string' && v.charAt(0) === '=') r.setFormula(v); else r.setValue(v); return r; };
  const header = (a1, values) => { const r = sh.getRange(a1); r.setValues([values]); styleHeader_(r); r.setHorizontalAlignment('center'); };
  const SEL = '$B$10';
  const CUR_MONTH = 'DATE(YEAR(TODAY()),MONTH(TODAY()),1)';

  /* --- title & selected month --- */
  mergePut('A1:I1', 'Household Finance Dashboard').setBackground(COLORS.NAVY).setFontColor(COLORS.WHITE).setFontSize(16).setFontWeight('bold');
  sh.setRowHeight(1, 40);
  mergePut('A2:I2', 'This month\'s working numbers: tonight\'s balances, what is coming in, what is suggested, what has been spent. The whole picture (averages, income by person, deductions, credit scores, funds, net worth) is on the Financial Summary tab.')
    .setFontStyle('italic').setFontColor(COLORS.MUTED_TEXT).setFontSize(9);
  /* --- accounts block: checking and savings (left), credit cards with due dates (right) --- */
  const q = (s) => String(s).replace(/"/g, '""');
  const pats = (line) => line.patterns || [line.institution];
  const crit = (pat, type) => '[ACCOUNTS.institution],"*' + q(pat) + '*",[ACCOUNTS.accountType],"' + q(type) + '",[ACCOUNTS.includeNW],"Yes"';
  const countOf = (line, type) => pats(line).map(pt => 'COUNTIFS(' + crit(pt, type) + ',[ACCOUNTS.connectionId],"<>")').join('+');
  const sumOf = (line, type, col) => pats(line).map(pt => 'SUMIFS([ACCOUNTS.' + col + '],' + crit(pt, type) + ')').join('+');
  const maxOf = (line, type, col) => 'MAX(' + pats(line).map(pt => 'MAXIFS([ACCOUNTS.' + col + '],' + crit(pt, type) + ')').join(',') + ')';
  const balanceOf = (line, type) => 'IF(' + countOf(line, type) + '=0,"—",' + sumOf(line, type, 'currentBalance') + ')';
  header('A' + DASH.ACCT_HEADER + ':B' + DASH.ACCT_HEADER, ['Account', 'Balance']);
  sh.getRange('C' + DASH.ACCT_HEADER + ':D' + DASH.ACCT_HEADER).merge(); styleHeader_(sh.getRange('C' + DASH.ACCT_HEADER + ':D' + DASH.ACCT_HEADER));
  sh.getRange('C' + DASH.ACCT_HEADER).setValue('Updated');
  header('F' + DASH.ACCT_HEADER + ':H' + DASH.ACCT_HEADER, ['Credit card', 'Owed', 'Due']);
  sh.getRange('I' + DASH.ACCT_HEADER).setValue('').setBackground(COLORS.PALE_BLUE);
  sh.getRange('B' + DASH.ACCT_HEADER).setHorizontalAlignment('right');
  sh.getRange('G' + DASH.ACCT_HEADER).setHorizontalAlignment('right');
  // Savings shows what is yours to keep: the bank balance minus the Parked for Bills pots on that account
  // (money passing through for a bill). The row under it shows the bank balance itself, faded.
  const savingsLine = DASH_ACCOUNTS.main.filter(l => l.type === 'Savings')[0];
  const anySav = savingsLine ? '(' + pats(savingsLine).map(pt => 'ISNUMBER(SEARCH("' + q(pt) + '",[ACCOUNTS.institution]))').join('+') + ')>0' : 'FALSE';
  const savId = 'IFERROR(INDEX(FILTER([ACCOUNTS.id],[ACCOUNTS.accountType]="Savings",' + anySav + ',[ACCOUNTS.includeNW]="Yes",[ACCOUNTS.connectionId]<>""),1),"")';
  const parkedOf = (col) => 'SUMIFS([FUNDS.' + col + '],[FUNDS.fundType],"Parked for Bills",[FUNDS.backingAccount],id)';
  const parkedExpr = 'IFERROR(LET(id,' + savId + ',IF(id="",0,' + parkedOf('starting') + '+' + parkedOf('contributions') + '-' + parkedOf('withdrawals') + ')),0)';
  DASH_ACCOUNTS.main.forEach((line, i) => {
    const r = DASH.ACCT_FIRST + i;
    const isSav = line === savingsLine;
    put('A' + r, line.label + (line.sub ? ' (' + line.sub + ')' : '')).setFontWeight('bold').setBackground(COLORS.CARD_GROSS);
    const bal = balanceOf(line, line.type);
    put('B' + r, F('=' + (isSav ? 'LET(b,' + bal + ',IF(ISNUMBER(b),b-' + parkedExpr + ',b))' : bal))).setNumberFormat(FORMATS.currency).setFontWeight('bold').setFontSize(14).setHorizontalAlignment('right').setBackground(COLORS.CARD_GROSS);
    mergePut('C' + r + ':D' + r, F('=IF(' + countOf(line, line.type) + '=0,"not connected yet",IFERROR(LET(d,' + maxOf(line, line.type, 'lastSynced') + ',IF(d=0,"",TEXT(d,"mmm d, h:mm am/pm"))),""))')).setFontSize(9).setFontColor(COLORS.MUTED_TEXT).setBackground(COLORS.CARD_GROSS);
    sh.setRowHeight(r, 28);
  });
  if (savingsLine) {
    const bal = balanceOf(savingsLine, 'Savings');
    put('A' + DASH.ACCT_WITH_BILLS, 'Savings + bill transfers').setFontWeight('bold').setFontColor(COLORS.FADED_TEXT).setBackground(COLORS.CARD_GROSS);
    put('B' + DASH.ACCT_WITH_BILLS, F('=' + bal)).setNumberFormat(FORMATS.currency).setFontWeight('bold').setFontSize(14).setFontColor(COLORS.FADED_TEXT).setHorizontalAlignment('right').setBackground(COLORS.CARD_GROSS);
    mergePut('C' + DASH.ACCT_WITH_BILLS + ':D' + DASH.ACCT_WITH_BILLS, F('=LET(p,' + parkedExpr + ',"bank balance · "&TEXT(p,"$#,##0")&" parked for bills")')).setFontSize(9).setFontColor(COLORS.FADED_TEXT).setBackground(COLORS.CARD_GROSS);
    sh.setRowHeight(DASH.ACCT_WITH_BILLS, 26);
  }
  DASH_ACCOUNTS.cards.forEach((card, i) => {
    const r = DASH.ACCT_FIRST + i;
    put('F' + r, card.label).setFontWeight('bold').setBackground(COLORS.CARD_SPENDING);
    put('G' + r, F('=' + balanceOf(card, 'Credit Card'))).setNumberFormat(FORMATS.currency).setFontWeight('bold').setFontSize(14).setHorizontalAlignment('right').setBackground(COLORS.CARD_SPENDING);
    const anyPat = '(' + pats(card).map(pt => 'ISNUMBER(SEARCH("' + q(pt) + '",[ACCOUNTS.institution]))').join('+') + ')>0';
    const idOf = 'IFERROR(INDEX(FILTER([ACCOUNTS.id],[ACCOUNTS.accountType]="Credit Card",' + anyPat + ',[ACCOUNTS.includeNW]="Yes",[ACCOUNTS.connectionId]<>""),1),"")';
    mergePut('H' + r + ':I' + r, F('=IFERROR(LET(id,' + idOf + ',nd,IFERROR(INDEX([DEBTS.nextDue],MATCH(id,[DEBTS.linkedAccount],0)),""),IF(id="","not connected yet",IF(AND(ISNUMBER($G' + r + '),$G' + r + '<=0),"paid in full",IF(nd="","","due "&TEXT(nd,"mmm d"))))),"")'))
      .setFontSize(9).setFontColor(COLORS.MUTED_TEXT).setBackground(COLORS.CARD_SPENDING);
    sh.setRowHeight(r, 28);
  });
  const cardTotalRow = DASH.ACCT_FIRST + DASH_ACCOUNTS.cards.length;
  put('F' + cardTotalRow, 'Total owed on cards').setFontWeight('bold').setBackground(COLORS.PALE_BLUE);
  put('G' + cardTotalRow, '=SUMPRODUCT(N(+G' + DASH.ACCT_FIRST + ':G' + (cardTotalRow - 1) + '))').setNumberFormat(FORMATS.currency).setFontWeight('bold').setHorizontalAlignment('right').setBackground(COLORS.PALE_BLUE);
  sh.getRange('H' + cardTotalRow + ':I' + cardTotalRow).merge().setBackground(COLORS.PALE_BLUE);
  sh.getRange('A' + DASH.ACCT_HEADER + ':D' + (savingsLine ? DASH.ACCT_WITH_BILLS : DASH.ACCT_FIRST + DASH_ACCOUNTS.main.length - 1)).setBorder(true, true, true, true, true, true, COLORS.BORDER, SpreadsheetApp.BorderStyle.SOLID);
  sh.getRange('F' + DASH.ACCT_HEADER + ':I' + cardTotalRow).setBorder(true, true, true, true, true, true, COLORS.BORDER, SpreadsheetApp.BorderStyle.SOLID);
  mergePut('A8:I8', 'Balances arrive from the bank feed each night; a line shows — and "not connected yet" until its bank is connected. Card due dates come from the lender. Savings is what is yours to keep; the faded line under it is the bank balance, which also holds money moved in for bills (Parked for Bills pots on Savings & Reserves) that has not gone out yet.')
    .setFontSize(8).setFontColor(COLORS.MUTED_TEXT).setFontStyle('italic');

  /* --- This month --- */
  styleSectionBar_(sh.getRange('A' + DASH.MONTH_BAR + ':I' + DASH.MONTH_BAR), 'This month');

  put('A10', 'Selected Month').setFontWeight('bold');
  const sel = put('B10', monthStart_(new Date()));
  sel.setNumberFormat('mmmm yyyy').setBackground(COLORS.INPUT).setFontWeight('bold')
    .setBorder(true, true, true, true, false, false, COLORS.NAVY, SpreadsheetApp.BorderStyle.SOLID)
    .setDataValidation(SpreadsheetApp.newDataValidation().requireDate().setAllowInvalid(false).setHelpText('Enter any date in the month you want to view; use the first of the month.').build());
  mergePut('C10:E10', '="Showing "&TEXT(' + SEL + ',"mmmm yyyy")&IF(' + SEL + '<>' + CUR_MONTH + ',"  (not the current month)","")').setFontColor(COLORS.MUTED_TEXT).setFontSize(9);
  // bank rows waiting for review: a full-width banner that links to the Import Staging tab (amber while anything waits)
  const stagingGid = getOrCreateSheet_(SHEETS.STAGING).getSheetId();
  mergePut('A' + DASH.REVIEW_LINE + ':I' + DASH.REVIEW_LINE, F('=IFERROR(LET(n,COUNTIF([STAGING.status],"Needs Review")+COUNTIF([STAGING.status],"Needs Split"),HYPERLINK("#gid=' + stagingGid + '",IF(n=0,"Bank imports: nothing waiting for your review","' + '\u26A0 ' + '"&n&" bank transaction(s) waiting for your review \u2014 click here to open Import Staging, then Finance Tracker \u2192 Import reviewed rows"))),"")'))
    .setFontSize(10).setFontWeight('bold').setHorizontalAlignment('center').setBackground(COLORS.UNDER_FILL).setFontColor(COLORS.UNDER_FONT);
  sh.setRowHeight(DASH.REVIEW_LINE, 26);

  /* --- two cards: expected take-home (the one that matters) and spent so far; column E is the gap.
         The owner dropped the gross card (2026-11-09): gross lives on the Financial Summary. --- */
  const selMatch = 'MATCH(' + SEL + ',[PLAN.month],0)';
  const paydaysSel = 'LET(ms,' + SEL + ',me,EOMONTH(ms,0),SUMPRODUCT(([EXPECT.active]=TRUE)*N(+[EXPECT.{col}])*' + PD + '))';
  const countsSel = 'IFERROR(TEXTJOIN(", ",TRUE,LET(ms,' + SEL + ',me,EOMONTH(ms,0),ARRAYFORMULA(IF([EXPECT.active]=TRUE,[EXPECT.person]&" "&LET(pc,' + PD + ',IF(pc=INT(pc),TEXT(pc,"0"),TEXT(pc,"0.0")))&" paycheck"&IF(' + PD + '=1,"","s"),"")))),"")';
  const cards = [
    { cols: 'A:D', label: 'Expected Take-Home', color: COLORS.CARD_TAKEHOME,
      f: F('=IFERROR(INDEX([PLAN.expectedIncome],' + selMatch + ')+N(INDEX([PLAN.incomeAdjustment],' + selMatch + ')),' + paydaysSel.replace('{col}', 'typicalTakeHome') + ')'),
      sub: F('="landed so far "&TEXT(SUMIFS([INCOME.takeHome],[INCOME.month],' + SEL + '),"$#,##0")&IFERROR(IF(N(INDEX([PLAN.incomeAdjustment],' + selMatch + '))<>0," · incl. "&TEXT(INDEX([PLAN.incomeAdjustment],' + selMatch + '),"+$#,##0;-$#,##0")&" adjustment",""),"")&IFERROR(" · "&' + countsSel + ',"")') },
    { cols: 'F:I', label: 'Spent So Far', color: COLORS.CARD_SPENDING,
      f: F('=IFERROR(INDEX([SUMMARY.spending],MATCH(' + SEL + ',[SUMMARY.month],0)),0)'),
      sub: F('="expenses − refunds · flexible "&TEXT(IFERROR(INDEX([PLAN.flexSpent],' + selMatch + '),0),"$#,##0")') },
  ];
  cards.forEach(card => {
    const [c1, c2] = card.cols.split(':');
    const fg = COLORS.TEXT;
    mergePut(c1 + DASH.CARD_ROW_LABEL + ':' + c2 + DASH.CARD_ROW_LABEL, card.label).setBackground(card.color).setFontWeight('bold').setFontColor(fg).setHorizontalAlignment('center');
    mergePut(c1 + DASH.CARD_ROW_VALUE + ':' + c2 + DASH.CARD_ROW_VALUE, card.f).setBackground(card.color).setFontSize(20).setFontWeight('bold').setFontColor(fg).setHorizontalAlignment('center').setNumberFormat('$#,##0');
    mergePut(c1 + DASH.CARD_ROW_SUB + ':' + c2 + DASH.CARD_ROW_SUB, card.sub).setBackground(card.color).setFontSize(8).setFontColor(COLORS.MUTED_TEXT).setHorizontalAlignment('center');
    sh.getRange(c1 + DASH.CARD_ROW_LABEL + ':' + c2 + DASH.CARD_ROW_SUB).setBorder(true, true, true, true, false, false, COLORS.WHITE, SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
  });
  sh.setRowHeight(DASH.CARD_ROW_VALUE, 44);
  // how the flexible figure is reached
  mergePut('A' + DASH.EXPECT_LINE + ':I' + DASH.EXPECT_LINE, F('=IFERROR(LET(ei,INDEX([PLAN.expectedIncome],' + selMatch + '),adj,N(INDEX([PLAN.incomeAdjustment],' + selMatch + ')),b,INDEX([PLAN.bills],' + selMatch + '),dp,INDEX([PLAN.debtPayments],' + selMatch + '),ps,INDEX([PLAN.plannedSavings],' + selMatch + '),tu,INDEX([PLAN.effectiveTarget],' + selMatch + '),ov,N(INDEX([PLAN.target],' + selMatch + ')),' +
    '"Take-home "&TEXT(ei+adj,"$#,##0")&" − bills "&TEXT(b,"$#,##0")&" − debt payments "&TEXT(dp,"$#,##0")&" − planned savings "&TEXT(ps,"$#,##0")&" = flexible "&TEXT(tu,"$#,##0")&" this month"&IF(ov>0," (target set by hand on Monthly Plan)"," (automatic)")),"The flexible figure appears once this month has a Monthly Plan row (the nightly sync adds one).")'))
    .setFontSize(9).setFontColor(COLORS.MUTED_TEXT).setHorizontalAlignment('center');

  /* --- Current Flexible Spending (follows TODAY) --- */
  styleSectionBar_(sh.getRange('A' + DASH.FLEX_BAR + ':I' + DASH.FLEX_BAR), '');
  sh.getRange('A' + DASH.FLEX_BAR).setFormula('="Current Flexible Spending — "&TEXT(TODAY(),"mmmm yyyy")');
  const planMatch = 'MATCH(' + CUR_MONTH + ',[PLAN.month],0)';
  const flex = [
    { cols: ['A', 'C'], label: 'Amount Available This Month', f: F('=IFERROR(INDEX([PLAN.available],' + planMatch + '),"No plan row")'),
      sub: F('=IFERROR("Target "&TEXT(INDEX([PLAN.effectiveTarget],' + planMatch + '),"$#,##0")&IF(N(INDEX([PLAN.target],' + planMatch + '))>0," (set by hand)"," (automatic)")&" · Flexible spent "&TEXT(INDEX([PLAN.flexSpent],' + planMatch + '),"$#,##0"),"Add a row for this month on the Monthly Plan tab")') },
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
  const av = 'A' + DASH.FLEX_VALUE;
  sh.setConditionalFormatRules([
    cfRule_(sh.getRange(av + ':C' + DASH.FLEX_VALUE), '=AND(ISNUMBER(' + av + '),' + av + '<0)', COLORS.OVER_FILL, COLORS.OVER_FONT),
    cfRule_(sh.getRange(av + ':C' + DASH.FLEX_VALUE), '=AND(ISNUMBER(' + av + '),' + av + '>=0)', COLORS.UNDER_FILL, COLORS.UNDER_FONT),
    cfRule_(sh.getRange('A' + DASH.REVIEW_LINE + ':I' + DASH.REVIEW_LINE), '=ISNUMBER(SEARCH("waiting for your review",A' + DASH.REVIEW_LINE + '))', COLORS.WARN_FILL, COLORS.WARN_FONT, { bold: true }),
  ]);

  /* --- Monthly Review Checklist --- */
  styleSectionBar_(sh.getRange('A' + DASH.CHECK_BAR + ':I' + DASH.CHECK_BAR), 'Monthly Review Checklist');
  header('A' + DASH.CHECK_HEADER + ':A' + DASH.CHECK_HEADER, ['Done']);
  sh.getRange('B' + DASH.CHECK_HEADER + ':I' + DASH.CHECK_HEADER).merge().setValue('Item');
  styleHeader_(sh.getRange('B' + DASH.CHECK_HEADER + ':I' + DASH.CHECK_HEADER));
  const checklist = [
    'Categorize every new transaction (no blank categories).',
    'Clear all Validation Flags on Transactions.',
    'Confirm this month\'s paychecks are in Income.',
    'Compare Monthly Budget planned vs. actual.',
    'Review Planned Irregular and Unexpected purchases.',
    'Check next month\'s flexible target on Monthly Plan (automatic unless you set one).',
    'Adjust Savings & Reserves targets if needed.',
    'Complete this month\'s Monthly Review row.',
  ];
  checklist.forEach((item, i) => {
    const r = DASH.CHECK_FIRST + i;
    sh.getRange('A' + r).setDataValidation(SpreadsheetApp.newDataValidation().requireCheckbox().build()).setHorizontalAlignment('center');
    sh.getRange('B' + r + ':I' + r).merge().setValue(item).setFontSize(10);
  });
  const checkLast = DASH.CHECK_FIRST + DASH.CHECK_COUNT - 1;
  sh.getRange('A' + DASH.CHECK_HEADER + ':I' + checkLast).setBorder(true, true, true, true, true, true, COLORS.BORDER, SpreadsheetApp.BorderStyle.SOLID);
  mergePut('A' + (checkLast + 2) + ':I' + (checkLast + 2), 'Averages, income by person, payroll deductions, credit scores, savings funds and net worth are on the Financial Summary tab.')
    .setFontSize(8).setFontColor(COLORS.MUTED_TEXT).setFontStyle('italic');

  /* --- protection: warning-only, except inputs --- */
  const prot = sh.protect().setDescription('Dashboard is calculated. Change the Selected Month in B10 or tick the checklist; write goals on the Goals tab; edit data on the raw tabs.');
  prot.setWarningOnly(true);
  setNamedRange_('DASH_SELECTED_MONTH', sh.getRange(DASH.SELECTED_MONTH));
  setNamedRange_('DASH_CHECKLIST', sh.getRange('A' + DASH.CHECK_FIRST + ':A' + checkLast));
  prot.setUnprotectedRanges([sh.getRange(DASH.SELECTED_MONTH), sh.getRange('A' + DASH.CHECK_FIRST + ':A' + checkLast)]);
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

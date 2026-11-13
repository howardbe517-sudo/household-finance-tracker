/**
 * Household Finance Tracker — Spending.gs
 * The Spending tab: how this month is going. Since 2026-11-12 it also holds what used to be the
 * Dashboard's month view, so the Selected Month is typed here (B3).
 *
 *   3      Month (input, named DASH_SELECTED_MONTH) and Compare with (input, named SPEND_COMPARE)
 *   4      banner: bank rows waiting for review on Import Staging
 *   6–9    Expected Take-Home and Spent So Far, and how the flexible figure is reached
 *   11–13  Fixed vs flexible, Needs vs wants, Recurring bills
 *   15–18  Current Flexible Spending (follows today's week, not the Selected Month)
 *   20–52  by category: this month beside a typical month, with how much of it is used
 *   54–70  recurring payments (paid this month?) and the flexible subcategories
 *   72–79  six months by category
 *   81–97  average spending by category, a sideways bar per category
 *   99–108 Monthly Review Checklist (ticks named DASH_CHECKLIST)
 *
 * "Typical month" everywhere on the tab is the average of the months chosen by Compare with: the 3,
 * 6 or 12 full months before the Selected Month, or the same three months one year back. Months
 * with no spending recorded are skipped rather than counted as zero. Nothing here predicts: every
 * figure is something that has already happened.
 *
 * Formulas over Transactions, Monthly Plan, Monthly Summary, Monthly Budget, Recurring Payments and
 * Categories; rebuilt by buildWorkbook / upgradeWorkbook, which keep the three inputs.
 */

const SPEND = {
  MONTH_CELL: 'B3', COMPARE_CELL: 'E3', REVIEW_LINE: 4,
  CARD_LABEL: 6, CARD_VALUE: 7, CARD_SUB: 8, EXPECT_LINE: 9,
  TILE_LABEL: 11, TILE_VALUE: 12, TILE_SUB: 13,
  FLEX_BAR: 15, FLEX_LABEL: 16, FLEX_VALUE: 17, FLEX_SUB: 18,
  CAT_BAR: 20, CAT_HEADER: 21, CAT_FIRST: 22, CAT_ROWS: 30,       // 22–51, total on 52
  REC_BAR: 54, REC_HEADER: 55, REC_FIRST: 56, REC_ROWS: 15,       // 56–70 (flexible subcategories share these rows, G:I)
  HIST_BAR: 72, HIST_HEADER: 73, HIST_FIRST: 74, HIST_COUNT: 6,   // 74–79
  AVG_BAR: 81, AVG_HEADER: 82, AVG_FIRST: 83, AVG_ROWS: 14, AVG_NOTE: 97, // 83–96
  CHECK_BAR: 99, CHECK_HEADER: 100, CHECK_FIRST: 101, CHECK_COUNT: 8, // 101–108
  NOTE_ROW: 110,
  HELP_ROW: 112, // the Compare with window, calculated: B first month, C last month, D months that have spending
  LAST_ROW: 112,
  COMPARE: ['Last 3 full months', 'Last 6 full months', 'Last 12 full months', 'Same 3 months last year'],
  COLOR_CHILDCARE: '#6E5FA8', COLOR_CHILD: '#B9A6E8', COLOR_BAR: '#17324D', COLOR_OVER: '#B3402E', COLOR_TRACK: '#E6ECF2',
  HIST_CATS: ['Housing', 'Childcare', 'Child Expenses', 'Food', 'Transportation', 'Insurance', 'Utilities'],
};

function buildSpending_() {
  const sh = getOrCreateSheet_(SHEETS.SPEND);
  const F = (t) => resolveFormula_(t, null, null);
  sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).breakApart();
  sh.clear(); // SAFETY-APPROVED: the Spending tab is calculated; its three inputs (Selected Month, Compare with, checklist ticks) are read by the upgrade first and written back
  sh.clearConditionalFormatRules();
  sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).clearDataValidations();
  sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).clearNote(); // the tiles' hover lists are rewritten by refreshSpendingNotes_
  sh.getProtections(SpreadsheetApp.ProtectionType.SHEET).forEach(p => p.remove());
  ensureSheetSize_(sh, SPEND.LAST_ROW, 9);
  sh.setHiddenGridlines(true);
  [210, 105, 105, 105, 105, 80, 150, 110, 110].forEach((w, i) => sh.setColumnWidth(i + 1, w));
  sh.getRange(1, 1, SPEND.LAST_ROW, 9).setFontColor(COLORS.TEXT).setFontSize(10).setVerticalAlignment('middle');
  const put = (a1, v) => { const r = sh.getRange(a1); if (typeof v === 'string' && v.charAt(0) === '=') r.setFormula(v); else r.setValue(v); return r; };
  const mergePut = (a1, v) => { const r = sh.getRange(a1).merge(); if (typeof v === 'string' && v.charAt(0) === '=') r.setFormula(v); else r.setValue(v); return r; };
  const header = (a1, values) => { const r = sh.getRange(a1); r.setValues([values]); styleHeader_(r); r.setHorizontalAlignment('center'); };
  const M = '$B$3';
  const CMP = '$E$3';
  const CUR_MONTH = 'DATE(YEAR(TODAY()),MONTH(TODAY()),1)';
  const WS = '$B$' + SPEND.HELP_ROW, WE = '$C$' + SPEND.HELP_ROW, K = '$D$' + SPEND.HELP_ROW;
  const q = (s) => String(s).replace(/"/g, '""');
  const EXP = ',[TX.type],"Expense",[TX.isDeleted],"<>TRUE")', REF = ',[TX.type],"Refund",[TX.isDeleted],"<>TRUE")';
  // spending (expenses − refunds) for one category in one month; the month may be an expression
  const spend = (cat, m) => '(SUMIFS([TX.amount],[TX.month],' + m + ',[TX.category],"' + q(cat) + '"' + EXP + '-SUMIFS([TX.amount],[TX.month],' + m + ',[TX.category],"' + q(cat) + '"' + REF + ')';
  const spendBy = (col, val, m) => '(SUMIFS([TX.amount],[TX.month],' + m + ',[TX.' + col + '],"' + q(val) + '"' + EXP + '-SUMIFS([TX.amount],[TX.month],' + m + ',[TX.' + col + '],"' + q(val) + '"' + REF + ')';
  const spendAll = (m) => '(SUMIFS([TX.amount],[TX.month],' + m + EXP + '-SUMIFS([TX.amount],[TX.month],' + m + REF + ')';
  const LM = 'EDATE(' + M + ',-1)';
  // the same three sums over the Compare with window (all its months together), and the typical month they give
  const inWin = '[TX.month],">="&' + WS + ',[TX.month],"<="&' + WE;
  const winBy = (col, valExpr, extra) => '(SUMIFS([TX.amount],' + inWin + ',[TX.' + col + '],' + valExpr + (extra || '') + EXP + '-SUMIFS([TX.amount],' + inWin + ',[TX.' + col + '],' + valExpr + (extra || '') + REF + ')';
  const winAll = '(SUMIFS([TX.amount],' + inWin + EXP + '-SUMIFS([TX.amount],' + inWin + REF + ')';
  const typ = (expr) => 'IF(' + K + '=0,0,' + expr + '/' + K + ')';
  const winCat = 'IF(c="Children",' + winBy('category', '"Childcare"') + '+' + winBy('category', '"Child Expenses"') + ',' + winBy('category', 'c') + ')';
  const TYP_FMT = '$#,##0.00;-$#,##0.00;"—"'; // a dash while there is no full month to average

  /* --- title, month, compare with --- */
  mergePut('A1:I1', 'Spending').setBackground(COLORS.NAVY).setFontColor(COLORS.WHITE).setFontSize(16).setFontWeight('bold');
  sh.setRowHeight(1, 40);
  mergePut('A2:I2', 'How this month is going: what is coming in, what has been spent, this week\'s flexible money, each category beside a typical month, the regular bills, and the averages. Spending is expenses minus refunds; debt payments, savings and transfers are not spending. Account balances and the long view are on the Financial Summary tab.')
    .setFontStyle('italic').setFontColor(COLORS.MUTED_TEXT).setFontSize(9);
  put('A3', 'Month').setFontWeight('bold');
  put('B3', monthStart_(new Date())).setNumberFormat('mmmm yyyy').setBackground(COLORS.INPUT).setFontWeight('bold').setHorizontalAlignment('center')
    .setBorder(true, true, true, true, false, false, COLORS.NAVY, SpreadsheetApp.BorderStyle.SOLID)
    .setDataValidation(SpreadsheetApp.newDataValidation().requireDate().setAllowInvalid(false).setHelpText('Enter any date in the month you want to view; use the first of the month.').build());
  put('C3', '=IF(' + M + '<>' + CUR_MONTH + ',"not the current month","")').setFontColor(COLORS.MUTED_TEXT).setFontSize(8);
  put('D3', 'Compare with').setFontWeight('bold').setHorizontalAlignment('right');
  mergePut('E3:F3', SPEND.COMPARE[0]).setBackground(COLORS.INPUT).setFontWeight('bold').setHorizontalAlignment('center')
    .setBorder(true, true, true, true, false, false, COLORS.NAVY, SpreadsheetApp.BorderStyle.SOLID)
    .setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(SPEND.COMPARE, true).setAllowInvalid(false).setHelpText('Which months make up the "typical month" on this tab.').build());
  mergePut('G3:I3', '=IF(' + K + '=0,"typical month: no full month recorded yet in "&TEXT(' + WS + ',"mmm yyyy")&" – "&TEXT(' + WE + ',"mmm yyyy"),"typical month = average of "&' + K + '&" month"&IF(' + K + '=1,"","s")&" with spending, "&TEXT(' + WS + ',"mmm yyyy")&" – "&TEXT(' + WE + ',"mmm yyyy"))')
    .setFontColor(COLORS.MUTED_TEXT).setFontSize(8).setWrap(true);
  sh.setRowHeight(3, 30);

  // bank rows waiting for review: a full-width banner that links to the Import Staging tab (amber while anything waits)
  const stagingGid = getOrCreateSheet_(SHEETS.STAGING).getSheetId();
  mergePut('A' + SPEND.REVIEW_LINE + ':I' + SPEND.REVIEW_LINE, F('=IFERROR(LET(n,COUNTIF([STAGING.status],"Needs Review")+COUNTIF([STAGING.status],"Needs Split"),HYPERLINK("#gid=' + stagingGid + '",IF(n=0,"Bank imports: nothing waiting for your review","' + '⚠ ' + '"&n&" bank transaction(s) waiting for your review — click here to open Import Staging; tick Reviewed? and the next sync imports them"))),"")'))
    .setFontSize(10).setFontWeight('bold').setHorizontalAlignment('center').setBackground(COLORS.UNDER_FILL).setFontColor(COLORS.UNDER_FONT);
  sh.setRowHeight(SPEND.REVIEW_LINE, 26);

  /* --- two cards: expected take-home and spent so far (moved from the Dashboard as they were) --- */
  const selMatch = 'MATCH(' + M + ',[PLAN.month],0)';
  const paydaysSel = 'LET(ms,' + M + ',me,EOMONTH(ms,0),SUMPRODUCT(([EXPECT.active]=TRUE)*N(+[EXPECT.{col}])*' + PD + '))';
  const countsSel = 'IFERROR(TEXTJOIN(", ",TRUE,LET(ms,' + M + ',me,EOMONTH(ms,0),ARRAYFORMULA(IF([EXPECT.active]=TRUE,[EXPECT.person]&" "&LET(pc,' + PD + ',IF(pc=INT(pc),TEXT(pc,"0"),TEXT(pc,"0.0")))&" paycheck"&IF(' + PD + '=1,"","s"),"")))),"")';
  const spentCell = '$E$' + SPEND.CARD_VALUE;
  const cards = [
    { cols: ['A', 'D'], label: 'Expected Take-Home', color: COLORS.CARD_TAKEHOME,
      f: F('=IFERROR(INDEX([PLAN.expectedIncome],' + selMatch + ')+N(INDEX([PLAN.incomeAdjustment],' + selMatch + ')),' + paydaysSel.replace('{col}', 'typicalTakeHome') + ')'),
      sub: F('="landed so far "&TEXT(SUMIFS([INCOME.takeHome],[INCOME.month],' + M + '),"$#,##0")&IFERROR(IF(N(INDEX([PLAN.incomeAdjustment],' + selMatch + '))<>0," · incl. "&TEXT(INDEX([PLAN.incomeAdjustment],' + selMatch + '),"+$#,##0;-$#,##0")&" adjustment",""),"")&IFERROR(" · "&' + countsSel + ',"")') },
    { cols: ['E', 'I'], label: 'Spent So Far', color: COLORS.CARD_SPENDING,
      f: F('=IFERROR(INDEX([SUMMARY.spending],MATCH(' + M + ',[SUMMARY.month],0)),0)'),
      sub: F('="typical month "&IF(' + K + '=0,"— (after the first full month)",TEXT(' + typ(winAll) + ',"$#,##0")&" · "&IFERROR(TEXT(N(' + spentCell + ')/' + typ(winAll) + ',"0%"),"—")&" of it used")&" · last month "&TEXT(' + spendAll(LM) + ',"$#,##0")') },
  ];
  cards.forEach(card => {
    const [c1, c2] = card.cols;
    mergePut(c1 + SPEND.CARD_LABEL + ':' + c2 + SPEND.CARD_LABEL, card.label).setBackground(card.color).setFontWeight('bold').setHorizontalAlignment('center');
    mergePut(c1 + SPEND.CARD_VALUE + ':' + c2 + SPEND.CARD_VALUE, card.f).setBackground(card.color).setFontSize(20).setFontWeight('bold').setHorizontalAlignment('center').setNumberFormat('$#,##0');
    mergePut(c1 + SPEND.CARD_SUB + ':' + c2 + SPEND.CARD_SUB, card.sub).setBackground(card.color).setFontSize(8).setFontColor(COLORS.MUTED_TEXT).setHorizontalAlignment('center').setWrap(true);
    sh.getRange(c1 + SPEND.CARD_LABEL + ':' + c2 + SPEND.CARD_SUB).setBorder(true, true, true, true, false, false, COLORS.WHITE, SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
  });
  sh.setRowHeight(SPEND.CARD_VALUE, 44); sh.setRowHeight(SPEND.CARD_SUB, 30);
  // how the flexible figure is reached
  mergePut('A' + SPEND.EXPECT_LINE + ':I' + SPEND.EXPECT_LINE, F('=IFERROR(LET(ei,INDEX([PLAN.expectedIncome],' + selMatch + '),adj,N(INDEX([PLAN.incomeAdjustment],' + selMatch + ')),b,INDEX([PLAN.bills],' + selMatch + '),dp,INDEX([PLAN.debtPayments],' + selMatch + '),ps,INDEX([PLAN.plannedSavings],' + selMatch + '),tu,INDEX([PLAN.effectiveTarget],' + selMatch + '),ov,N(INDEX([PLAN.target],' + selMatch + ')),' +
    '"Take-home "&TEXT(ei+adj,"$#,##0")&" − bills "&TEXT(b,"$#,##0")&" − debt payments "&TEXT(dp,"$#,##0")&" − planned savings "&TEXT(ps,"$#,##0")&" = flexible "&TEXT(tu,"$#,##0")&" this month"&IF(ov>0," (target set by hand on Monthly Plan)"," (automatic)")),"The flexible figure appears once this month has a Monthly Plan row (the nightly sync adds one).")'))
    .setFontSize(9).setFontColor(COLORS.MUTED_TEXT).setHorizontalAlignment('center');

  /* --- three tiles --- */
  const recLastRow = SPEND.REC_FIRST + SPEND.REC_ROWS - 1;
  const tiles = [
    { cols: ['A', 'B'], label: 'Fixed vs flexible', f: F('=TEXT(' + spendBy('spendingType', 'Fixed', M) + ',"$#,##0")&" / "&TEXT(' + spendBy('spendingType', 'Flexible', M) + ',"$#,##0")'), fmt: '@',
      sub: F('="typical "&IF(' + K + '=0,"—",TEXT(' + typ(winBy('spendingType', '"Fixed"')) + ',"$#,##0")&" / "&TEXT(' + typ(winBy('spendingType', '"Flexible"')) + ',"$#,##0"))&" · planned irregular "&TEXT(' + spendBy('spendingType', 'Planned Irregular', M) + ',"$#,##0")&" · unexpected "&TEXT(' + spendBy('spendingType', 'Unexpected', M) + ',"$#,##0")') },
    { cols: ['C', 'E'], label: 'Needs vs wants', f: F('=IFERROR(TEXT(' + spendBy('needWant', 'Need', M) + '/' + spendAll(M) + ',"0%")&" / "&TEXT(' + spendBy('needWant', 'Want', M) + '/' + spendAll(M) + ',"0%"),"—")'), fmt: '@',
      sub: F('=TEXT(' + spendBy('needWant', 'Need', M) + ',"$#,##0")&" needs · "&TEXT(' + spendBy('needWant', 'Want', M) + ',"$#,##0")&" wants · typical "&IF(' + K + '=0,"—",IFERROR(TEXT(' + winBy('needWant', '"Need"') + '/' + winAll + ',"0%")&" / "&TEXT(' + winBy('needWant', '"Want"') + '/' + winAll + ',"0%"),"—"))') },
    { cols: ['F', 'I'], label: 'Recurring bills', f: F('=SUMIFS([RECUR.monthlyEq],[RECUR.active],TRUE)'), fmt: '$#,##0" / mo"',
      sub: F('="subscriptions "&TEXT(SUMIFS([RECUR.monthlyEq],[RECUR.active],TRUE,[RECUR.group],"Subscriptions"),"$#,##0")&" · memberships "&TEXT(SUMIFS([RECUR.monthlyEq],[RECUR.active],TRUE,[RECUR.group],"Memberships"),"$#,##0")&" · "&COUNTIFS([RECUR.active],TRUE)&" active, "&COUNTIF($E$' + SPEND.REC_FIRST + ':$E$' + recLastRow + ',"yes")&" paid this month"') },
  ];
  tiles.forEach(t => {
    mergePut(t.cols[0] + SPEND.TILE_LABEL + ':' + t.cols[1] + SPEND.TILE_LABEL, t.label).setBackground(COLORS.PALE_BLUE).setFontWeight('bold').setHorizontalAlignment('center');
    mergePut(t.cols[0] + SPEND.TILE_VALUE + ':' + t.cols[1] + SPEND.TILE_VALUE, t.f).setFontSize(18).setFontWeight('bold').setHorizontalAlignment('center').setNumberFormat(t.fmt);
    mergePut(t.cols[0] + SPEND.TILE_SUB + ':' + t.cols[1] + SPEND.TILE_SUB, t.sub).setFontSize(8).setFontColor(COLORS.MUTED_TEXT).setHorizontalAlignment('center').setWrap(true);
    sh.getRange(t.cols[0] + SPEND.TILE_LABEL + ':' + t.cols[1] + SPEND.TILE_SUB).setBorder(true, true, true, true, false, false, COLORS.BORDER, SpreadsheetApp.BorderStyle.SOLID);
  });
  sh.setRowHeight(SPEND.TILE_VALUE, 40); sh.setRowHeight(SPEND.TILE_SUB, 30);

  /* --- Current Flexible Spending (follows TODAY, not the Selected Month) --- */
  styleSectionBar_(sh.getRange('A' + SPEND.FLEX_BAR + ':I' + SPEND.FLEX_BAR), '');
  sh.getRange('A' + SPEND.FLEX_BAR).setFormula('="Current Flexible Spending — "&TEXT(TODAY(),"mmmm yyyy")');
  const planMatch = 'MATCH(' + CUR_MONTH + ',[PLAN.month],0)';
  const flex = [
    { cols: ['A', 'B'], label: 'Amount Available This Month', f: F('=IFERROR(INDEX([PLAN.available],' + planMatch + '),"No plan row")'),
      sub: F('=IFERROR("Target "&TEXT(INDEX([PLAN.effectiveTarget],' + planMatch + '),"$#,##0")&IF(N(INDEX([PLAN.target],' + planMatch + '))>0," (set by hand)"," (automatic)")&" · Flexible spent "&TEXT(INDEX([PLAN.flexSpent],' + planMatch + '),"$#,##0"),"Add a row for this month on the Monthly Plan tab")') },
    { cols: ['C', 'E'], label: 'Suggested This Week', f: F('=IFERROR(INDEX([PLAN.suggestedWeek],' + planMatch + '),"No plan row")'),
      sub: '="Week of "&TEXT(TODAY()-WEEKDAY(TODAY(),2)+1,"ddd mmm d")&" – "&TEXT(MIN(TODAY()-WEEKDAY(TODAY(),2)+7,EOMONTH(TODAY(),0)),"ddd mmm d")&" · Flexible only"' },
    { cols: ['F', 'I'], label: 'Spent This Week', f: F('=IFERROR(INDEX([PLAN.spentWeek],' + planMatch + '),"No plan row")'),
      sub: 'Monday through today · Spending Type = Flexible' },
  ];
  flex.forEach(b => {
    mergePut(b.cols[0] + SPEND.FLEX_LABEL + ':' + b.cols[1] + SPEND.FLEX_LABEL, b.label).setBackground(COLORS.PALE_BLUE).setFontWeight('bold').setHorizontalAlignment('center');
    mergePut(b.cols[0] + SPEND.FLEX_VALUE + ':' + b.cols[1] + SPEND.FLEX_VALUE, b.f).setFontSize(18).setFontWeight('bold').setHorizontalAlignment('center').setNumberFormat('$#,##0');
    mergePut(b.cols[0] + SPEND.FLEX_SUB + ':' + b.cols[1] + SPEND.FLEX_SUB, b.sub).setFontSize(8).setFontColor(COLORS.MUTED_TEXT).setHorizontalAlignment('center').setWrap(true);
    sh.getRange(b.cols[0] + SPEND.FLEX_LABEL + ':' + b.cols[1] + SPEND.FLEX_SUB).setBorder(true, true, true, true, false, false, COLORS.BORDER, SpreadsheetApp.BorderStyle.SOLID);
  });
  sh.setRowHeight(SPEND.FLEX_VALUE, 42); sh.setRowHeight(SPEND.FLEX_SUB, 26);

  /* --- by category, sorted by this month; Childcare + Child Expenses shown together as "Children" --- */
  styleSectionBar_(sh.getRange('A' + SPEND.CAT_BAR + ':I' + SPEND.CAT_BAR), 'By category — this month beside a typical month, largest first');
  header('A' + SPEND.CAT_HEADER + ':I' + SPEND.CAT_HEADER, ['Category', 'This Month', 'Budget', 'Last Month', 'Typical Month', 'Used', 'Bar', 'Childcare', 'Child Expenses']);
  put('G' + SPEND.CAT_HEADER, '=IF(' + K + '=0,"Bar","Of a typical month")');
  sh.getRange('H' + SPEND.CAT_HEADER).setFontColor(SPEND.COLOR_CHILDCARE);
  sh.getRange('I' + SPEND.CAT_HEADER).setFontColor(SPEND.COLOR_CHILD);
  const catFirst = SPEND.CAT_FIRST, catLast = SPEND.CAT_FIRST + SPEND.CAT_ROWS - 1, catTotal = catLast + 1;
  const amt = (m) => 'LAMBDA(c,IF(c="Children",' + spend('Childcare', m) + '+' + spend('Child Expenses', m) + ',SUMIFS([TX.amount],[TX.month],' + m + ',[TX.category],c' + EXP + '-SUMIFS([TX.amount],[TX.month],' + m + ',[TX.category],c' + REF + '))';
  const bud = 'LAMBDA(c,IF(c="Children",SUMIFS([BUDGET.planned],[BUDGET.month],' + M + ',[BUDGET.category],"Childcare")+SUMIFS([BUDGET.planned],[BUDGET.month],' + M + ',[BUDGET.category],"Child Expenses"),SUMIFS([BUDGET.planned],[BUDGET.month],' + M + ',[BUDGET.category],c)))';
  const rawCats = 'UNIQUE(FILTER([CATS.category],[CATS.active]=TRUE,[CATS.category]<>"",[CATS.category]<>"Income",[CATS.category]<>"Savings",[CATS.category]<>"Debt Payments"))';
  const catsExpr = 'UNIQUE(ARRAYFORMULA(IF((raw="Childcare")+(raw="Child Expenses"),"Children",raw)))';
  const avMap = 'MAP(cats,LAMBDA(c,' + typ(winCat) + '))';
  put('A' + catFirst, F('=IFERROR(LET(raw,' + rawCats + ',cats,' + catsExpr + ',' +
    'tm,MAP(cats,' + amt(M) + '),lm,MAP(cats,' + amt(LM) + '),av,' + avMap + ',bd,MAP(cats,' + bud + '),' +
    'ARRAY_CONSTRAIN(SORT(FILTER({cats,tm,bd,lm,av},(tm+lm+av+bd)>0),2,FALSE),' + SPEND.CAT_ROWS + ',5)),"")'));
  const largest = 'MAX(1,MAX($B$' + catFirst + ':$B$' + catLast + '))';
  for (let r = catFirst; r <= catLast; r++) {
    put('F' + r, '=IF(OR($A' + r + '="",N($E' + r + ')=0),"",$B' + r + '/$E' + r + ')').setNumberFormat('0%').setHorizontalAlignment('right');
    // with a typical month the bar fills toward it (red once past it); before there is one, bars compare the categories with each other
    put('G' + r, F('=IF($A' + r + '="","",LET(mx,IF(N($E' + r + ')>0,MAX(N($B' + r + '),N($E' + r + ')),' + largest + '),IF($A' + r + '="Children",SPARKLINE({' + spend('Childcare', M) + ',' + spend('Child Expenses', M) + '},{"charttype","bar";"color1","' + SPEND.COLOR_CHILDCARE + '";"color2","' + SPEND.COLOR_CHILD + '";"max",mx}),' +
      'SPARKLINE({N($B' + r + ')},{"charttype","bar";"color1",IF(AND(N($E' + r + ')>0,N($B' + r + ')>N($E' + r + ')),"' + SPEND.COLOR_OVER + '","' + SPEND.COLOR_BAR + '");"max",mx}))))'));
    put('H' + r, F('=IF($A' + r + '="Children",' + spend('Childcare', M) + ',"")')).setFontColor(SPEND.COLOR_CHILDCARE).setFontWeight('bold');
    put('I' + r, F('=IF($A' + r + '="Children",' + spend('Child Expenses', M) + ',"")')).setFontColor(SPEND.COLOR_CHILD).setFontWeight('bold');
  }
  sh.getRange('B' + catFirst + ':D' + catTotal).setNumberFormat(FORMATS.currency);
  sh.getRange('E' + catFirst + ':E' + catTotal).setNumberFormat(TYP_FMT);
  sh.getRange('H' + catFirst + ':I' + catLast).setNumberFormat(FORMATS.currency);
  put('A' + catTotal, 'Total spending').setFontWeight('bold');
  put('B' + catTotal, F('=' + spendAll(M))).setFontWeight('bold');
  put('C' + catTotal, F('=SUMIFS([BUDGET.planned],[BUDGET.month],' + M + ')')).setFontWeight('bold');
  put('D' + catTotal, F('=' + spendAll(LM))).setFontWeight('bold');
  put('E' + catTotal, F('=' + typ(winAll))).setFontWeight('bold');
  put('F' + catTotal, '=IF(N($E' + catTotal + ')=0,"",$B' + catTotal + '/$E' + catTotal + ')').setNumberFormat('0%').setFontWeight('bold').setHorizontalAlignment('right');
  sh.getRange('A' + catTotal + ':I' + catTotal).setBackground(COLORS.PALE_BLUE);
  sh.getRange('A' + SPEND.CAT_HEADER + ':I' + catTotal).setBorder(true, true, true, true, true, false, COLORS.BORDER, SpreadsheetApp.BorderStyle.SOLID);

  /* --- recurring payments (A:E) and flexible subcategories (G:I) --- */
  styleSectionBar_(sh.getRange('A' + SPEND.REC_BAR + ':E' + SPEND.REC_BAR), 'Recurring payments — every regular bill in one place');
  header('A' + SPEND.REC_HEADER + ':E' + SPEND.REC_HEADER, ['Name', 'Group', 'Monthly', 'Next Payment', 'Paid This Month?']);
  const recFirst = SPEND.REC_FIRST, recLast = recLastRow;
  put('A' + recFirst, F('=IFERROR(ARRAY_CONSTRAIN(SORT(FILTER({[RECUR.name],[RECUR.group],[RECUR.monthlyEq],[RECUR.nextPayment]},[RECUR.active]=TRUE,[RECUR.name]<>""),4,TRUE),' + SPEND.REC_ROWS + ',4),"")'));
  for (let r = recFirst; r <= recLast; r++) {
    put('E' + r, F('=IF($A' + r + '="","",IFERROR(LET(i,MATCH($A' + r + ',[RECUR.name],0),cat,INDEX([RECUR.category],i),sub,INDEX([RECUR.subcategory],i),a,N(INDEX([RECUR.amount],i)),' +
      // paid = real payments this month (an entry recorded automatically is not a payment) reach 90% of the bill; several part payments count together
      'IF(SUMIFS([TX.amount],[TX.month],' + M + ',[TX.category],cat,[TX.subcategory],sub,[TX.type],"Expense",[TX.isDeleted],"<>TRUE",[TX.notes],"<>*' + AUTO_RECORD_MARK + '*")>=MAX(0.01,a*0.9),"yes","not yet")),""))')).setHorizontalAlignment('center');
  }
  sh.getRange('C' + recFirst + ':C' + recLast).setNumberFormat(FORMATS.currency);
  sh.getRange('D' + recFirst + ':D' + recLast).setNumberFormat('mmm d');
  sh.getRange('A' + SPEND.REC_HEADER + ':E' + recLast).setBorder(true, true, true, true, true, false, COLORS.BORDER, SpreadsheetApp.BorderStyle.SOLID);
  styleSectionBar_(sh.getRange('G' + SPEND.REC_BAR + ':I' + SPEND.REC_BAR), 'Where the flexible money went');
  header('G' + SPEND.REC_HEADER + ':I' + SPEND.REC_HEADER, ['Subcategory', 'This Month', 'Typical Month']);
  const FLEXQ = ',[TX.spendingType],"Flexible"';
  const flexSpend = (m) => 'LAMBDA(s,SUMIFS([TX.amount],[TX.month],' + m + ',[TX.subcategory],s' + FLEXQ + EXP + '-SUMIFS([TX.amount],[TX.month],' + m + ',[TX.subcategory],s' + FLEXQ + REF + ')';
  put('G' + recFirst, F('=IFERROR(LET(subs,UNIQUE(FILTER([TX.subcategory],(([TX.month]=' + M + ')+(([TX.month]>=' + WS + ')*([TX.month]<=' + WE + ')))>0,[TX.spendingType]="Flexible",[TX.type]="Expense",[TX.isDeleted]<>TRUE,[TX.subcategory]<>"")),' +
    'tm,MAP(subs,' + flexSpend(M) + '),av,MAP(subs,LAMBDA(s,' + typ(winBy('subcategory', 's', FLEXQ)) + ')),' +
    'ARRAY_CONSTRAIN(SORT(FILTER({subs,tm,av},(tm+av)>0),2,FALSE),' + SPEND.REC_ROWS + ',3)),"")'));
  sh.getRange('H' + recFirst + ':H' + recLast).setNumberFormat(FORMATS.currency);
  sh.getRange('I' + recFirst + ':I' + recLast).setNumberFormat(TYP_FMT);
  sh.getRange('G' + SPEND.REC_HEADER + ':I' + recLast).setBorder(true, true, true, true, true, false, COLORS.BORDER, SpreadsheetApp.BorderStyle.SOLID);

  /* --- six months by category --- */
  styleSectionBar_(sh.getRange('A' + SPEND.HIST_BAR + ':I' + SPEND.HIST_BAR), 'Month by month — the selected month and the five before it');
  const histCats = SPEND.HIST_CATS.slice(0, 7);
  header('A' + SPEND.HIST_HEADER + ':I' + SPEND.HIST_HEADER, ['Month'].concat(histCats).concat(['Everything Else']));
  for (let k = 0; k < SPEND.HIST_COUNT; k++) {
    const r = SPEND.HIST_FIRST + k;
    const m = '$A' + r;
    put('A' + r, '=EDATE(' + M + ',-' + k + ')').setNumberFormat('mmmm yyyy').setFontWeight('bold');
    histCats.forEach((cat, j) => put(colLetter_(2 + j) + r, F('=' + spend(cat, m))));
    put('I' + r, F('=' + spendAll(m) + '-SUM(B' + r + ':H' + r + ')'));
  }
  sh.getRange('B' + SPEND.HIST_FIRST + ':I' + (SPEND.HIST_FIRST + SPEND.HIST_COUNT - 1)).setNumberFormat(FORMATS.currency);
  sh.getRange('B' + SPEND.HIST_HEADER).setFontColor(COLORS.TEXT);
  sh.getRange('C' + SPEND.HIST_HEADER).setFontColor(SPEND.COLOR_CHILDCARE);
  sh.getRange('D' + SPEND.HIST_HEADER).setFontColor(SPEND.COLOR_CHILD);
  sh.getRange('A' + SPEND.HIST_HEADER + ':I' + (SPEND.HIST_FIRST + SPEND.HIST_COUNT - 1)).setBorder(true, true, true, true, true, false, COLORS.BORDER, SpreadsheetApp.BorderStyle.SOLID);

  /* --- average spending by category: one sideways bar per category, largest first --- */
  styleSectionBar_(sh.getRange('A' + SPEND.AVG_BAR + ':I' + SPEND.AVG_BAR), 'Average spending by category — a typical month, largest first');
  header('A' + SPEND.AVG_HEADER + ':B' + SPEND.AVG_HEADER, ['Category', 'Per Month']);
  styleHeader_(sh.getRange('C' + SPEND.AVG_HEADER + ':I' + SPEND.AVG_HEADER).merge());
  const avgFirst = SPEND.AVG_FIRST, avgLast = SPEND.AVG_FIRST + SPEND.AVG_ROWS - 1;
  put('A' + avgFirst, F('=IFERROR(LET(raw,' + rawCats + ',cats,' + catsExpr + ',av,' + avMap + ',ARRAY_CONSTRAIN(SORT(FILTER({cats,av},av>0),2,FALSE),' + SPEND.AVG_ROWS + ',2)),"")'));
  const avgMax = 'MAX(1,MAX($B$' + avgFirst + ':$B$' + avgLast + '))';
  for (let r = avgFirst; r <= avgLast; r++) {
    mergePut('C' + r + ':I' + r, F('=IF($A' + r + '="","",IF($A' + r + '="Children",SPARKLINE({' + typ(winBy('category', '"Childcare"')) + ',' + typ(winBy('category', '"Child Expenses"')) + '},{"charttype","bar";"color1","' + SPEND.COLOR_CHILDCARE + '";"color2","' + SPEND.COLOR_CHILD + '";"max",' + avgMax + '}),' +
      'SPARKLINE({N($B' + r + ')},{"charttype","bar";"color1","' + SPEND.COLOR_BAR + '";"max",' + avgMax + '})))'));
  }
  sh.getRange('B' + avgFirst + ':B' + avgLast).setNumberFormat(FORMATS.currency).setFontWeight('bold');
  sh.getRange('A' + SPEND.AVG_HEADER + ':I' + avgLast).setBorder(true, true, true, true, false, false, COLORS.BORDER, SpreadsheetApp.BorderStyle.SOLID);
  mergePut('A' + SPEND.AVG_NOTE + ':I' + SPEND.AVG_NOTE, '=IF(' + K + '=0,"Averages appear here after the first full month of transactions. Compare with (top of this tab) chooses which months are averaged.","Average per month over "&' + K + '&" month"&IF(' + K + '=1,"","s")&" with spending, "&TEXT(' + WS + ',"mmm yyyy")&" – "&TEXT(' + WE + ',"mmm yyyy")&". Change Compare with at the top of this tab to average other months.")')
    .setFontSize(8).setFontColor(COLORS.MUTED_TEXT).setFontStyle('italic');

  /* --- Monthly Review Checklist (moved from the Dashboard; the ticks are inputs) --- */
  styleSectionBar_(sh.getRange('A' + SPEND.CHECK_BAR + ':I' + SPEND.CHECK_BAR), 'Monthly Review Checklist');
  header('A' + SPEND.CHECK_HEADER + ':A' + SPEND.CHECK_HEADER, ['Done']);
  sh.getRange('B' + SPEND.CHECK_HEADER + ':I' + SPEND.CHECK_HEADER).merge().setValue('Item');
  styleHeader_(sh.getRange('B' + SPEND.CHECK_HEADER + ':I' + SPEND.CHECK_HEADER));
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
  checklist.slice(0, SPEND.CHECK_COUNT).forEach((item, i) => {
    const r = SPEND.CHECK_FIRST + i;
    sh.getRange('A' + r).setDataValidation(SpreadsheetApp.newDataValidation().requireCheckbox().build()).setHorizontalAlignment('center');
    sh.getRange('B' + r + ':I' + r).merge().setValue(item).setFontSize(10);
  });
  const checkLast = SPEND.CHECK_FIRST + SPEND.CHECK_COUNT - 1;
  sh.getRange('A' + SPEND.CHECK_HEADER + ':I' + checkLast).setBorder(true, true, true, true, true, true, COLORS.BORDER, SpreadsheetApp.BorderStyle.SOLID);

  mergePut('A' + SPEND.NOTE_ROW + ':I' + SPEND.NOTE_ROW, 'Spending Type: Fixed = the same every month and already committed (rent, insurance, the nanny, subscriptions); Flexible = day-to-day spending you steer week by week (groceries, dining out, fuel); Planned Irregular = expected but not monthly (property tax, registration, travel); Unexpected = could not be planned (doctor visits, repairs). Need/Want: could it be cut if it had to be? Both come from the subcategory\'s defaults on the Categories tab and can be changed on any transaction. Budget is the Monthly Budget row for the month; a blank means none set. Typical Month is the average of the months chosen by Compare with; months with no spending recorded are left out. Full definitions on the Start Here tab.')
    .setFontSize(8).setFontColor(COLORS.MUTED_TEXT).setFontStyle('italic').setWrap(true).setVerticalAlignment('top');
  sh.setRowHeight(SPEND.NOTE_ROW, 64);

  /* --- the Compare with window (calculated; every "typical" figure above reads these three cells) --- */
  const help = SPEND.HELP_ROW;
  put('A' + help, 'Compare with window (calculated)');
  put('B' + help, '=IF(' + CMP + '="' + SPEND.COMPARE[3] + '",EDATE(' + M + ',-13),EDATE(' + M + ',-SWITCH(' + CMP + ',"' + SPEND.COMPARE[1] + '",6,"' + SPEND.COMPARE[2] + '",12,3)))').setNumberFormat('mmm yyyy');
  put('C' + help, '=IF(' + CMP + '="' + SPEND.COMPARE[3] + '",EDATE(' + M + ',-11),EDATE(' + M + ',-1))').setNumberFormat('mmm yyyy');
  // ROWS(UNIQUE(FILTER())) and not COUNTUNIQUE: COUNTUNIQUE counts FILTER's "nothing found" error as one month (fixed 2026-11-13)
  put('D' + help, F('=IFERROR(ROWS(UNIQUE(FILTER([TX.month],[TX.month]>=' + WS + ',[TX.month]<=' + WE + ',[TX.isDeleted]<>TRUE,(([TX.type]="Expense")+([TX.type]="Refund"))>0))),0)')).setNumberFormat('0');
  sh.getRange('A' + help + ':D' + help).setFontSize(8).setFontColor(COLORS.MUTED_TEXT);

  const av = 'A' + SPEND.FLEX_VALUE;
  sh.setConditionalFormatRules([
    cfRule_(sh.getRange('B' + catFirst + ':B' + catLast), '=AND(ISNUMBER($C' + catFirst + '),$C' + catFirst + '>0,$B' + catFirst + '>$C' + catFirst + ')', COLORS.OVER_FILL, COLORS.OVER_FONT),
    cfRule_(sh.getRange('B' + catFirst + ':B' + catLast), '=AND(ISNUMBER($C' + catFirst + '),$C' + catFirst + '>0,$B' + catFirst + '<=$C' + catFirst + ')', COLORS.UNDER_FILL, COLORS.UNDER_FONT),
    cfRule_(sh.getRange('F' + catFirst + ':F' + catTotal), '=AND(ISNUMBER($F' + catFirst + '),$F' + catFirst + '>1)', COLORS.OVER_FILL, COLORS.OVER_FONT),
    cfRule_(sh.getRange('G' + catFirst + ':G' + catLast), '=AND($A' + catFirst + '<>"",N($E' + catFirst + ')>0)', SPEND.COLOR_TRACK, COLORS.TEXT),
    cfRule_(sh.getRange('E' + recFirst + ':E' + recLast), '=$E' + recFirst + '="yes"', COLORS.UNDER_FILL, COLORS.UNDER_FONT),
    cfRule_(sh.getRange('E' + recFirst + ':E' + recLast), '=$E' + recFirst + '="not yet"', COLORS.WARN_FILL, COLORS.WARN_FONT),
    cfRule_(sh.getRange(av + ':B' + SPEND.FLEX_VALUE), '=AND(ISNUMBER(' + av + '),' + av + '<0)', COLORS.OVER_FILL, COLORS.OVER_FONT),
    cfRule_(sh.getRange(av + ':B' + SPEND.FLEX_VALUE), '=AND(ISNUMBER(' + av + '),' + av + '>=0)', COLORS.UNDER_FILL, COLORS.UNDER_FONT),
    cfRule_(sh.getRange('A' + SPEND.REVIEW_LINE + ':I' + SPEND.REVIEW_LINE), '=ISNUMBER(SEARCH("waiting for your review",$A$' + SPEND.REVIEW_LINE + '))', COLORS.WARN_FILL, COLORS.WARN_FONT, { bold: true }),
  ]);

  /* --- protection: warning-only, except the three inputs --- */
  const prot = sh.protect().setDescription('The Spending tab is calculated. Change the Month (B3) or Compare with (E3), or tick the checklist; edit data on Transactions, Monthly Budget and Recurring Payments.');
  prot.setWarningOnly(true);
  const checks = sh.getRange('A' + SPEND.CHECK_FIRST + ':A' + checkLast);
  setNamedRange_('DASH_SELECTED_MONTH', sh.getRange(SPEND.MONTH_CELL));
  setNamedRange_('SPEND_COMPARE', sh.getRange(SPEND.COMPARE_CELL));
  setNamedRange_('DASH_CHECKLIST', checks);
  prot.setUnprotectedRanges([sh.getRange(SPEND.MONTH_CELL), sh.getRange('E3:F3'), checks]);
}

/* ---------- hover notes on the three tiles: the lists behind the numbers ---------- */

function moneyNote_(n) {
  const v = Math.round(Number(n || 0) * 100) / 100;
  return (v < 0 ? '-$' : '$') + Math.abs(v).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * The text of the three hover notes. Pure.
 *   txRows     Transactions rows ({ date, amount, type, category, subcategory, description, spendingType, needWant, isDeleted })
 *   recurRows  Recurring Payments rows ({ name, group, category, subcategory, amount, frequency, monthlyEq, dueDay, active })
 *   month      any date in the month to describe
 *   stamp      text for the "as of" line (may be '')
 * Returns { fixedFlex, needsWants, recurring }. Spending is expenses minus refunds; deleted rows,
 * transfers, savings, debt payments and Split Parents are left out, as everywhere else.
 */
function spendingNoteTexts_(txRows, recurRows, month, stamp) {
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const inMonth = (d) => d instanceof Date && month instanceof Date && d.getFullYear() === month.getFullYear() && d.getMonth() === month.getMonth();
  const label = month instanceof Date ? MONTHS[month.getMonth()] + ' ' + month.getFullYear() : 'this month';
  const rows = (txRows || []).filter(t => t.isDeleted !== true && inMonth(t.date) && (t.type === 'Expense' || t.type === 'Refund'));
  const foot = (stamp ? 'As of ' + stamp + '. ' : '') + 'This list refreshes with every sync and when you change the month.';
  // one block per value of a column: a heading with the total, then each subcategory with its amount and who was paid
  const blocks = (col, order, missing) => {
    const groups = {};
    rows.forEach(t => {
      const g = t[col] || missing;
      const sub = t.subcategory || t.category || 'No category yet';
      const amt = (t.type === 'Refund' ? -1 : 1) * Number(t.amount || 0);
      const G = groups[g] = groups[g] || { total: 0, subs: {} };
      const S = G.subs[sub] = G.subs[sub] || { total: 0, names: [] };
      G.total += amt; S.total += amt;
      const nm = String(t.description || '').trim();
      if (nm && S.names.indexOf(nm) < 0) S.names.push(nm);
    });
    const keys = order.filter(k => groups[k]).concat(Object.keys(groups).filter(k => order.indexOf(k) < 0).sort());
    if (!keys.length) return ['Nothing recorded yet for ' + label + '.'];
    const out = [];
    keys.forEach(k => {
      out.push(k.toUpperCase() + ': ' + moneyNote_(groups[k].total));
      Object.keys(groups[k].subs).map(s => [s, groups[k].subs[s]]).sort((a, b) => b[1].total - a[1].total).slice(0, 25).forEach(p => {
        const names = p[1].names;
        out.push('  ' + p[0] + '  ' + moneyNote_(p[1].total) + (names.length ? '  (' + names.slice(0, 4).join(', ') + (names.length > 4 ? ', +' + (names.length - 4) + ' more' : '') + ')' : ''));
      });
      out.push('');
    });
    return out;
  };
  const fixedFlex = [label + ': what counts as fixed and what counts as flexible', ''].concat(blocks('spendingType', ['Fixed', 'Flexible', 'Planned Irregular', 'Unexpected'], 'No spending type yet'))
    .concat(['To move something, change its Spending Type on Transactions (or the default on Categories).', foot]).join('\n');
  const needsWants = [label + ': what counts as a need and what counts as a want', ''].concat(blocks('needWant', ['Need', 'Want'], 'Not marked yet'))
    .concat(['To move something, change its Need/Want on Transactions (or the default on Categories).', foot]).join('\n');

  // recurring bills: every active row by group, with whether this month's payment has been seen
  const active = (recurRows || []).filter(r => r.active === true && r.name);
  const ord = (n) => { const d = Number(n); if (!d) return ''; const s = (d % 100 >= 11 && d % 100 <= 13) ? 'th' : ['th', 'st', 'nd', 'rd'][d % 10] || 'th'; return d + s; };
  const perMonth = (r) => {
    if (typeof r.monthlyEq === 'number') return r.monthlyEq;
    const a = Number(r.amount || 0);
    return ({ Weekly: a * 52 / 12, Biweekly: a * 26 / 12, Monthly: a, Quarterly: a / 3, Semiannual: a / 6, Annual: a / 12 })[r.frequency] || a;
  };
  // real payments this month toward a bill; an entry recorded automatically is not a payment
  const paidSum = (r) => rows.filter(t => t.type === 'Expense' && t.category === r.category && t.subcategory === r.subcategory && String(t.notes || '').indexOf(AUTO_RECORD_MARK) < 0).reduce((s, t) => s + Number(t.amount || 0), 0);
  const total = active.reduce((s, r) => s + perMonth(r), 0);
  const rec = ['Recurring bills: ' + moneyNote_(total) + ' a month, ' + active.length + ' active', ''];
  const byGroup = {};
  active.forEach(r => { (byGroup[r.group || 'Other'] = byGroup[r.group || 'Other'] || []).push(r); });
  Object.keys(byGroup).map(g => [g, byGroup[g].reduce((s, r) => s + perMonth(r), 0)]).sort((a, b) => b[1] - a[1]).forEach(p => {
    rec.push(p[0].toUpperCase() + ': ' + moneyNote_(p[1]) + ' a month');
    byGroup[p[0]].sort((a, b) => perMonth(b) - perMonth(a)).forEach(r => {
      const amt = r.amount === '' || r.amount === null || r.amount === undefined ? 'amount not set' : moneyNote_(r.amount) + ' ' + String(r.frequency || 'Monthly').toLowerCase() + (r.frequency && r.frequency !== 'Monthly' ? ' (' + moneyNote_(perMonth(r)) + ' a month)' : '');
      const due = r.frequency === 'Weekly' || r.frequency === 'Biweekly' || !ord(r.dueDay) ? '' : ', due the ' + ord(r.dueDay);
      const got = r.category && r.subcategory && Number(r.amount) > 0 ? paidSum(r) : -1;
      const state = got < 0 ? '' : got >= Number(r.amount) * 0.9 ? '  · paid in ' + label : got > 0 ? '  · ' + moneyNote_(got) + ' paid so far in ' + label : '  · not seen yet in ' + label;
      const auto = r.autoRecord === true ? '  · counted automatically from its due day' : '';
      rec.push('  ' + String(r.name).trim() + '  ' + amt + due + state + auto);
    });
    rec.push('');
  });
  if (!active.length) rec.push('No active rows on Recurring Payments.', '');
  rec.push('Add or change a bill on the Recurring Payments tab.', foot);
  return { fixedFlex, needsWants, recurring: rec.join('\n') };
}

/**
 * Writes the three hover notes on the Spending tiles, one per tile on its big number (the label and the
 * small line under it carry none). Runs after a build or upgrade, with every sync, after
 * reviewed rows are imported, and from onEdit when the Month, a transaction or a recurring bill is
 * edited. Changes notes only. Returns true when it wrote them.
 */
function refreshSpendingNotes_() {
  const ss = ss_();
  const sh = ss.getSheetByName(SHEETS.SPEND);
  if (!sh || sh.getRange('A' + SPEND.TILE_LABEL).getValue() !== 'Fixed vs flexible') return false;
  const sel = sh.getRange(SPEND.MONTH_CELL).getValue();
  const month = sel instanceof Date ? sel : new Date();
  const stamp = Utilities.formatDate(new Date(), 'America/Detroit', 'MMM d, h:mm a');
  const t = spendingNoteTexts_(readTable_(tdef_('TX')), readTable_(tdef_('RECUR')), month, stamp);
  [['A', t.fixedFlex], ['C', t.needsWants], ['F', t.recurring]].forEach(p => {
    // one note per tile, on the big number; the label and small line carry none (three triangles looked like three different notes)
    sh.getRange(p[0] + SPEND.TILE_LABEL + ':' + p[0] + SPEND.TILE_SUB).setNotes([[''], [p[1]], ['']]);
  });
  return true;
}

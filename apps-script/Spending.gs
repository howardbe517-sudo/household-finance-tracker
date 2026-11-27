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
  // wider, to use more of the screen (the owner, 2026-11-26)
  [240, 120, 120, 120, 120, 95, 170, 125, 125].forEach((w, i) => sh.setColumnWidth(i + 1, w));
  sh.getRange(1, 1, SPEND.LAST_ROW, 9).setFontColor(COLORS.TEXT).setFontSize(11).setVerticalAlignment('middle');
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
  // bank charges still waiting on Import Staging count as flexible spending, as WAITING_LABEL (the owner, 2026-11-27)
  const WAIT = (m) => waitingSpendExpr_(m, 'EOMONTH(' + m + ',0)');
  const WL = '"' + WAITING_LABEL + '"';
  const spend = (cat, m) => '(SUMIFS([TX.amount],[TX.month],' + m + ',[TX.category],"' + q(cat) + '"' + EXP + '-SUMIFS([TX.amount],[TX.month],' + m + ',[TX.category],"' + q(cat) + '"' + REF + ')';
  const spendBy = (col, val, m) => '(SUMIFS([TX.amount],[TX.month],' + m + ',[TX.' + col + '],"' + q(val) + '"' + EXP + '-SUMIFS([TX.amount],[TX.month],' + m + ',[TX.' + col + '],"' + q(val) + '"' + REF +
    (col === 'spendingType' && val === 'Flexible' ? '+' + WAIT(m) : '') + ')';
  const spendAll = (m) => '(SUMIFS([TX.amount],[TX.month],' + m + EXP + '-SUMIFS([TX.amount],[TX.month],' + m + REF + '+' + WAIT(m) + ')';
  const LM = 'EDATE(' + M + ',-1)';
  // the same three sums over the Compare with window (all its months together), and the typical month they give
  const inWin = '[TX.month],">="&' + WS + ',[TX.month],"<="&' + WE;
  const WAITWIN = waitingSpendExpr_(WS, 'EOMONTH(' + WE + ',0)');
  const winBy = (col, valExpr, extra) => '(SUMIFS([TX.amount],' + inWin + ',[TX.' + col + '],' + valExpr + (extra || '') + EXP + '-SUMIFS([TX.amount],' + inWin + ',[TX.' + col + '],' + valExpr + (extra || '') + REF +
    (col === 'spendingType' && valExpr === '"Flexible"' && !extra ? '+' + WAITWIN : '') + ')';
  const winAll = '(SUMIFS([TX.amount],' + inWin + EXP + '-SUMIFS([TX.amount],' + inWin + REF + '+' + WAITWIN + ')';
  const typ = (expr) => 'IF(' + K + '=0,0,' + expr + '/' + K + ')';
  const winCat = 'IF(c="Children",' + winBy('category', '"Childcare"') + '+' + winBy('category', '"Child Expenses"') + ',IF(c=' + WL + ',' + WAITWIN + ',' + winBy('category', 'c') + '))';
  const TYP_FMT = '$#,##0.00;-$#,##0.00;"—"'; // a dash while there is no full month to average

  /* --- title, month, compare with --- */
  mergePut('A1:I1', 'Spending').setBackground(COLORS.NAVY).setFontColor(COLORS.WHITE).setFontSize(16).setFontWeight('bold');
  sh.setRowHeight(1, 40);
  // explanations as a hover note on the title (the owner, 2026-11-26: as little to read on the tab as possible)
  hoverNote_(sh, 'A1', 'How this month is going: what is coming in, what has been spent, this week\'s flexible money, each category beside a typical month, the regular bills, and the averages. Spending is expenses minus refunds; debt payments, savings and transfers are not spending. Bank charges still waiting on Import Staging count right away as flexible spending, under "' + WAITING_LABEL + '", until you review them and the next sync moves each into its category (money coming in and $0 or $1 card holds are left out). Under each box, what makes it up is listed one item per line, each rounded to the dollar. Account balances and the long view are on the Financial Summary tab.' + '\n\n' + 'Spending Type: Fixed = the same every month and already committed (rent, insurance, the nanny, subscriptions); Flexible = day-to-day spending you steer week by week (groceries, dining out, fuel); Planned Irregular = expected but not monthly (property tax, registration, travel); Unexpected = could not be planned (doctor visits, repairs). Need/Want: could it be cut if it had to be? Both come from the subcategory\'s defaults on the Categories tab and can be changed on any transaction. Budget is the Monthly Budget row for the month; a blank means none set. Typical Month is the average of the months chosen by Compare with; months with no spending recorded are left out. Full definitions on the Start Here tab.', 2);
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
  // Option A (the owner, 2026-11-26): the number, then what makes it up, one item per line: names on the left, amounts on the right
  const adjE = 'IFERROR(N(INDEX([PLAN.incomeAdjustment],' + selMatch + ')),0)';
  const landedE = 'SUMIFS([INCOME.takeHome],[INCOME.month],' + M + ')';
  const payLines = (each) => 'LET(ms,' + M + ',me,EOMONTH(ms,0),pc,ARRAYFORMULA(' + PD + '),TEXTJOIN(CHAR(10),TRUE,ARRAYFORMULA(IF(([EXPECT.active]=TRUE)*(pc>0),' + each + ',""))))';
  const cards = [
    { cols: ['A', 'D'], names: 'A:C', amounts: 'D:D', label: 'Expected Take-Home', color: COLORS.CARD_TAKEHOME,
      f: F('=IFERROR(INDEX([PLAN.expectedIncome],' + selMatch + ')+N(INDEX([PLAN.incomeAdjustment],' + selMatch + ')),' + paydaysSel.replace('{col}', 'typicalTakeHome') + ')'),
      // the paychecks (and any adjustment) add up to the number; "landed so far" is progress toward it, so it says so
      namesF: F('=IFERROR(' + payLines('[EXPECT.person]&" · "&[EXPECT.employer]&" ("&IF(pc=INT(pc),TEXT(pc,"0"),TEXT(pc,"0.0"))&" paycheck"&IF(pc=1,"","s")&")"') + '&CHAR(10),"")&IF(' + adjE + '<>0,"Adjustment"&CHAR(10),"")&"Landed so far (part of the total)"'),
      amountsF: F('=IFERROR(' + payLines('TEXT(N(+[EXPECT.typicalTakeHome])*pc,"$#,##0")') + '&CHAR(10),"")&IF(' + adjE + '<>0,TEXT(' + adjE + ',"+$#,##0;-$#,##0")&CHAR(10),"")&TEXT(' + landedE + ',"$#,##0")') },
    { cols: ['E', 'I'], names: 'E:H', amounts: 'I:I', label: 'Spent So Far', color: COLORS.CARD_SPENDING,
      f: F('=IFERROR(INDEX([SUMMARY.spending],MATCH(' + M + ',[SUMMARY.month],0)),0)'),
      // the charges still waiting on Import Staging are in the number; how much of it they are is shown last
      namesF: F('="Last month"&CHAR(10)&IF(' + K + '=0,"Typical month (after the first full month)","Typical month")&CHAR(10)&"Used of a typical month"&CHAR(10)&"Includes not categorized yet"'),
      amountsF: F('=TEXT(' + spendAll(LM) + ',"$#,##0")&CHAR(10)&IF(' + K + '=0,"—",TEXT(' + typ(winAll) + ',"$#,##0"))&CHAR(10)&IF(' + K + '=0,"—",IFERROR(TEXT(N(' + spentCell + ')/' + typ(winAll) + ',"0%"),"—"))&CHAR(10)&TEXT(' + WAIT(M) + ',"$#,##0")') },
  ];
  let earners = 1;
  try { earners = readTable_(tdef_('EXPECT')).filter(x => x.id && x.active === true).length; } catch (e) { /* a new workbook */ }
  cards.forEach(card => {
    const [c1, c2] = card.cols;
    mergePut(c1 + SPEND.CARD_LABEL + ':' + c2 + SPEND.CARD_LABEL, card.label).setBackground(card.color).setFontSize(11).setFontWeight('bold').setHorizontalAlignment('center');
    mergePut(c1 + SPEND.CARD_VALUE + ':' + c2 + SPEND.CARD_VALUE, card.f).setBackground(card.color).setFontSize(20).setFontWeight('bold').setHorizontalAlignment('center').setNumberFormat('$#,##0');
    putBoxLines_(sh, SPEND.CARD_SUB, card.names, card.amounts, card.namesF, card.amountsF, card.color);
    sh.getRange(c1 + SPEND.CARD_LABEL + ':' + c2 + SPEND.CARD_SUB).setBorder(true, true, true, true, false, false, COLORS.WHITE, SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
  });
  sh.setRowHeight(SPEND.CARD_LABEL, 24); sh.setRowHeight(SPEND.CARD_VALUE, 40); sh.setRowHeight(SPEND.CARD_SUB, boxLinesHeight_(Math.max(4, earners + 3)));
  // how the flexible figure is reached
  sh.setRowHeight(SPEND.EXPECT_LINE, 6); // how the flexible figure is reached is listed in the Amount Available box

  /* --- three tiles --- */
  const recLastRow = SPEND.REC_FIRST + SPEND.REC_ROWS - 1;
  const soFar = '"~spent so far in "&TEXT(' + M + ',"mmmm")';
  const money0 = (e) => 'TEXT(' + e + ',"$#,##0")';
  // the regular bills by group, largest first: the same list (and order) in both cells
  const recGroups = (each) => 'IFERROR(LET(g,UNIQUE(FILTER([RECUR.group],[RECUR.active]=TRUE,[RECUR.group]<>"")),m,MAP(g,LAMBDA(x,SUMIFS([RECUR.monthlyEq],[RECUR.active],TRUE,[RECUR.group],x))),s,SORT(FILTER({g,m},m>0),2,FALSE),TEXTJOIN(CHAR(10),TRUE,' + each + ')&CHAR(10)),"")';
  const recNoGroup = 'SUMIFS([RECUR.monthlyEq],[RECUR.active],TRUE,[RECUR.group],"")';
  const tiles = [
    { cols: ['A', 'B'], names: 'A:A', amounts: 'B:B', label: 'Fixed vs flexible', f: F('=TEXT(' + spendBy('spendingType', 'Fixed', M) + ',"$#,##0")&" / "&TEXT(' + spendBy('spendingType', 'Flexible', M) + ',"$#,##0")'), fmt: '@',
      // says what it adds up (the owner, 2026-11-26: easy to mix up with Fixed Costs on the Financial Summary, a typical month)
      namesF: F('="Fixed spending (bills, subscriptions)"&CHAR(10)&"Flexible (everyday)"&CHAR(10)&"Planned irregular"&CHAR(10)&"Unexpected"&CHAR(10)&"Not marked yet"&CHAR(10)&"Typical fixed / flexible"&CHAR(10)&' + soFar +
        '&IF(ROUND(' + WAIT(M) + ',2)>0,CHAR(10)&"~flexible incl. "&TEXT(' + WAIT(M) + ',"$#,##0")&" not categorized yet","")'),
      amountsF: F('=' + money0(spendBy('spendingType', 'Fixed', M)) + '&CHAR(10)&' + money0(spendBy('spendingType', 'Flexible', M)) + '&CHAR(10)&' + money0(spendBy('spendingType', 'Planned Irregular', M)) + '&CHAR(10)&' + money0(spendBy('spendingType', 'Unexpected', M)) +
        '&CHAR(10)&' + money0('ROUND(' + spendAll(M) + '-' + spendBy('spendingType', 'Fixed', M) + '-' + spendBy('spendingType', 'Flexible', M) + '-' + spendBy('spendingType', 'Planned Irregular', M) + '-' + spendBy('spendingType', 'Unexpected', M) + ',2)') +
        '&CHAR(10)&IF(' + K + '=0,"—",' + money0(typ(winBy('spendingType', '"Fixed"'))) + '&" / "&' + money0(typ(winBy('spendingType', '"Flexible"'))) + ')&CHAR(10)&""&IF(ROUND(' + WAIT(M) + ',2)>0,CHAR(10)&"","")') },
    { cols: ['C', 'E'], names: 'C:D', amounts: 'E:E', label: 'Needs vs wants', f: F('=IFERROR(TEXT(' + spendBy('needWant', 'Need', M) + '/' + spendAll(M) + ',"0%")&" / "&TEXT(' + spendBy('needWant', 'Want', M) + '/' + spendAll(M) + ',"0%"),"—")'), fmt: '@',
      namesF: F('="Needs"&CHAR(10)&"Wants"&CHAR(10)&"Not marked yet"&CHAR(10)&"Typical needs / wants"&CHAR(10)&' + soFar),
      amountsF: F('=' + money0(spendBy('needWant', 'Need', M)) + '&CHAR(10)&' + money0(spendBy('needWant', 'Want', M)) + '&CHAR(10)&' + money0('ROUND(' + spendAll(M) + '-' + spendBy('needWant', 'Need', M) + '-' + spendBy('needWant', 'Want', M) + ',2)') + '&CHAR(10)&IF(' + K + '=0,"—",IFERROR(TEXT(' + winBy('needWant', '"Need"') + '/' + winAll + ',"0%")&" / "&TEXT(' + winBy('needWant', '"Want"') + '/' + winAll + ',"0%"),"—"))&CHAR(10)&""') },
    { cols: ['F', 'I'], names: 'F:H', amounts: 'I:I', label: 'Recurring bills', f: F('=SUMIFS([RECUR.monthlyEq],[RECUR.active],TRUE)'), fmt: '$#,##0" / mo"',
      // a bill with no group is in the number too, so it gets its own line when there is one
      namesF: F('=' + recGroups('INDEX(s,0,1)') + '&IF(ROUND(' + recNoGroup + ',2)<>0,"No group"&CHAR(10),"")&"Active bills"&CHAR(10)&"Paid this month"'),
      amountsF: F('=' + recGroups('ARRAYFORMULA(TEXT(INDEX(s,0,2),"$#,##0"))') + '&IF(ROUND(' + recNoGroup + ',2)<>0,TEXT(' + recNoGroup + ',"$#,##0")&CHAR(10),"")&COUNTIFS([RECUR.active],TRUE)&CHAR(10)&COUNTIF($E$' + SPEND.REC_FIRST + ':$E$' + recLastRow + ',"yes")') },
  ];
  let groups = 6;
  try { const rr = readTable_(tdef_('RECUR')).filter(r => r.active === true && r.group && Number(r.monthlyEq) > 0); groups = rr.map(r => r.group).filter((g, i, a) => a.indexOf(g) === i).length; } catch (e) { /* a new workbook */ }
  tiles.forEach(t => {
    mergePut(t.cols[0] + SPEND.TILE_LABEL + ':' + t.cols[1] + SPEND.TILE_LABEL, t.label).setBackground(COLORS.PALE_BLUE).setFontSize(11).setFontWeight('bold').setHorizontalAlignment('center');
    mergePut(t.cols[0] + SPEND.TILE_VALUE + ':' + t.cols[1] + SPEND.TILE_VALUE, t.f).setFontSize(18).setFontWeight('bold').setHorizontalAlignment('center').setNumberFormat(t.fmt);
    putBoxLines_(sh, SPEND.TILE_SUB, t.names, t.amounts, t.namesF, t.amountsF, null);
    sh.getRange(t.cols[0] + SPEND.TILE_LABEL + ':' + t.cols[1] + SPEND.TILE_SUB).setBorder(true, true, true, true, false, false, COLORS.BORDER, SpreadsheetApp.BorderStyle.SOLID);
  });
  sh.setRowHeight(SPEND.TILE_LABEL, 24); sh.setRowHeight(SPEND.TILE_VALUE, 36); sh.setRowHeight(SPEND.TILE_SUB, boxLinesHeight_(Math.max(8, groups + 4)));

  /* --- Current Flexible Spending (follows TODAY, not the Selected Month) --- */
  styleSectionBar_(sh.getRange('A' + SPEND.FLEX_BAR + ':I' + SPEND.FLEX_BAR), '');
  sh.getRange('A' + SPEND.FLEX_BAR).setFormula('="Current Flexible Spending — "&TEXT(TODAY(),"mmmm yyyy")');
  const planMatch = 'MATCH(' + CUR_MONTH + ',[PLAN.month],0)';
  const monday = 'TODAY()-WEEKDAY(TODAY(),2)+1', weekEnd = 'MIN(TODAY()-WEEKDAY(TODAY(),2)+7,EOMONTH(TODAY(),0))';
  const flex = [
    { cols: ['A', 'B'], names: 'A:A', amounts: 'B:B', label: 'Amount Available This Month', f: F('=IFERROR(INDEX([PLAN.available],' + planMatch + '),"No plan row")'),
      // how the flexible figure is reached, one step per line (it was a line of its own under the cards); when the target is set by
      // hand, the automatic one the steps give is shown first, then the hand-set target, so the lines still add up
      namesF: F('=IFERROR(LET(pm,' + planMatch + ',adj,N(INDEX([PLAN.incomeAdjustment],pm)),hand,N(INDEX([PLAN.target],pm))>0,"Take-home (expected"&IF(adj<>0,", incl. adjustment","")&")"&CHAR(10)&"− Bills"&CHAR(10)&"− Debt payments"&CHAR(10)&"− Planned savings"&CHAR(10)&IF(hand,"= Automatic target"&CHAR(10)&"Target set by hand instead","= Flexible target")&CHAR(10)&"− Flexible spent so far"&IF(ROUND(' + WAIT(CUR_MONTH) + ',2)>0,CHAR(10)&"~incl. "&TEXT(' + WAIT(CUR_MONTH) + ',"$#,##0")&" not categorized yet","")),"~Add a row for this month on Monthly Plan")'),
      amountsF: F('=IFERROR(LET(pm,' + planMatch + ',ei,INDEX([PLAN.expectedIncome],pm)+N(INDEX([PLAN.incomeAdjustment],pm)),b,INDEX([PLAN.bills],pm),dp,INDEX([PLAN.debtPayments],pm),ps,INDEX([PLAN.plannedSavings],pm),hand,N(INDEX([PLAN.target],pm))>0,TEXT(ei,"$#,##0")&CHAR(10)&TEXT(b,"$#,##0")&CHAR(10)&TEXT(dp,"$#,##0")&CHAR(10)&TEXT(ps,"$#,##0")&CHAR(10)&IF(hand,TEXT(ei-b-dp-ps,"$#,##0")&CHAR(10),"")&TEXT(INDEX([PLAN.effectiveTarget],pm),"$#,##0")&CHAR(10)&TEXT(INDEX([PLAN.flexSpent],pm),"$#,##0")&IF(ROUND(' + WAIT(CUR_MONTH) + ',2)>0,CHAR(10)&"","")),"")') },
    { cols: ['C', 'E'], names: 'C:D', amounts: 'E:E', label: 'Suggested This Week', f: F('=IFERROR(INDEX([PLAN.suggestedWeek],' + planMatch + '),"No plan row")'),
      namesF: '="Week"&CHAR(10)&"Counts"', amountsF: '=TEXT(' + monday + ',"mmm d")&" – "&TEXT(' + weekEnd + ',"mmm d")&CHAR(10)&"Flexible only"' },
    { cols: ['F', 'I'], names: 'F:H', amounts: 'I:I', label: 'Spent This Week', f: F('=IFERROR(INDEX([PLAN.spentWeek],' + planMatch + '),"No plan row")'),
      namesF: '="Week so far, from"&CHAR(10)&"Counts"&CHAR(10)&"Includes not categorized yet"',
      amountsF: F('=TEXT(' + monday + ',"ddd mmm d")&CHAR(10)&"Flexible only"&CHAR(10)&TEXT(' + waitingSpendExpr_('MAX(' + monday + ',' + CUR_MONTH + ')', 'TODAY()') + ',"$#,##0")') },
  ];
  flex.forEach(b => {
    mergePut(b.cols[0] + SPEND.FLEX_LABEL + ':' + b.cols[1] + SPEND.FLEX_LABEL, b.label).setBackground(COLORS.PALE_BLUE).setFontSize(11).setFontWeight('bold').setHorizontalAlignment('center');
    mergePut(b.cols[0] + SPEND.FLEX_VALUE + ':' + b.cols[1] + SPEND.FLEX_VALUE, b.f).setFontSize(18).setFontWeight('bold').setHorizontalAlignment('center').setNumberFormat('$#,##0');
    putBoxLines_(sh, SPEND.FLEX_SUB, b.names, b.amounts, b.namesF, b.amountsF, null);
    sh.getRange(b.cols[0] + SPEND.FLEX_LABEL + ':' + b.cols[1] + SPEND.FLEX_SUB).setBorder(true, true, true, true, false, false, COLORS.BORDER, SpreadsheetApp.BorderStyle.SOLID);
  });
  sh.setRowHeight(SPEND.FLEX_LABEL, 24); sh.setRowHeight(SPEND.FLEX_VALUE, 36); sh.setRowHeight(SPEND.FLEX_SUB, boxLinesHeight_(8));

  /* --- by category, sorted by this month; Childcare + Child Expenses shown together as "Children" --- */
  styleSectionBar_(sh.getRange('A' + SPEND.CAT_BAR + ':I' + SPEND.CAT_BAR), 'By category — this month beside a typical month, largest first');
  header('A' + SPEND.CAT_HEADER + ':I' + SPEND.CAT_HEADER, ['Category', 'This Month', 'Budget', 'Last Month', 'Typical Month', 'Used', 'Bar', 'Childcare', 'Child Expenses']);
  put('G' + SPEND.CAT_HEADER, '=IF(' + K + '=0,"Bar","Of a typical month")');
  sh.getRange('H' + SPEND.CAT_HEADER).setFontColor(SPEND.COLOR_CHILDCARE);
  sh.getRange('I' + SPEND.CAT_HEADER).setFontColor(SPEND.COLOR_CHILD);
  const catFirst = SPEND.CAT_FIRST, catLast = SPEND.CAT_FIRST + SPEND.CAT_ROWS - 1, catTotal = catLast + 1;
  const amt = (m) => 'LAMBDA(c,IF(c="Children",' + spend('Childcare', m) + '+' + spend('Child Expenses', m) + ',IF(c=' + WL + ',' + WAIT(m) + ',SUMIFS([TX.amount],[TX.month],' + m + ',[TX.category],c' + EXP + '-SUMIFS([TX.amount],[TX.month],' + m + ',[TX.category],c' + REF + ')))';
  const bud = 'LAMBDA(c,IF(c="Children",SUMIFS([BUDGET.planned],[BUDGET.month],' + M + ',[BUDGET.category],"Childcare")+SUMIFS([BUDGET.planned],[BUDGET.month],' + M + ',[BUDGET.category],"Child Expenses"),SUMIFS([BUDGET.planned],[BUDGET.month],' + M + ',[BUDGET.category],c)))';
  const rawCats = 'UNIQUE(FILTER([CATS.category],[CATS.active]=TRUE,[CATS.category]<>"",[CATS.category]<>"Income",[CATS.category]<>"Savings",[CATS.category]<>"Debt Payments"))';
  const catsExpr = 'UNIQUE(ARRAYFORMULA(IF((raw="Childcare")+(raw="Child Expenses"),"Children",raw)))';
  const avMap = 'MAP(cats,LAMBDA(c,' + typ(winCat) + '))';
  // the charges still waiting on Import Staging get a row of their own, so the rows add up to the total
  put('A' + catFirst, F('=IFERROR(LET(raw,' + rawCats + ',cats,{' + catsExpr + ';' + WL + '},' +
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
  // Next Payment steps forward past dates by the bill's frequency (recurNextDueExpr_), so a weekly bill never shows a date gone by
  put('A' + recFirst, F('=IFERROR(ARRAY_CONSTRAIN(SORT(FILTER({[RECUR.name],[RECUR.group],[RECUR.monthlyEq],' + recurNextDueExpr_(k => '[RECUR.' + k + ']') + '},[RECUR.active]=TRUE,[RECUR.name]<>""),4,TRUE),' + SPEND.REC_ROWS + ',4),"")'));
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
  // the waiting charges are flexible, so they are a line here too (WAITING_LABEL)
  const flexSpend = (m) => 'LAMBDA(s,IF(s=' + WL + ',' + WAIT(m) + ',SUMIFS([TX.amount],[TX.month],' + m + ',[TX.subcategory],s' + FLEXQ + EXP + '-SUMIFS([TX.amount],[TX.month],' + m + ',[TX.subcategory],s' + FLEXQ + REF + '))';
  put('G' + recFirst, F('=IFERROR(LET(subs,UNIQUE({IFERROR(UNIQUE(FILTER([TX.subcategory],(([TX.month]=' + M + ')+(([TX.month]>=' + WS + ')*([TX.month]<=' + WE + ')))>0,[TX.spendingType]="Flexible",[TX.type]="Expense",[TX.isDeleted]<>TRUE,[TX.subcategory]<>"")),' + WL + ');' + WL + '}),' +
    'tm,MAP(subs,' + flexSpend(M) + '),av,MAP(subs,LAMBDA(s,' + typ('IF(s=' + WL + ',' + WAITWIN + ',' + winBy('subcategory', 's', FLEXQ) + ')') + ')),' +
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
  hoverNote_(sh, 'A' + SPEND.AVG_BAR, 'Average per month over the months chosen by Compare with (top of this tab), counting only months with spending. Nothing shows until the first full month of transactions.', SPEND.AVG_NOTE);

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

  sh.setRowHeight(SPEND.NOTE_ROW, 6); // its explanation is in the title's hover note

  /* --- the Compare with window (calculated; every "typical" figure above reads these three cells) --- */
  const help = SPEND.HELP_ROW;
  put('A' + help, 'Compare with window (calculated)');
  put('B' + help, '=IF(' + CMP + '="' + SPEND.COMPARE[3] + '",EDATE(' + M + ',-13),EDATE(' + M + ',-SWITCH(' + CMP + ',"' + SPEND.COMPARE[1] + '",6,"' + SPEND.COMPARE[2] + '",12,3)))').setNumberFormat('mmm yyyy');
  put('C' + help, '=IF(' + CMP + '="' + SPEND.COMPARE[3] + '",EDATE(' + M + ',-11),EDATE(' + M + ',-1))').setNumberFormat('mmm yyyy');
  // ROWS(UNIQUE(FILTER())) and not COUNTUNIQUE: COUNTUNIQUE counts FILTER's "nothing found" error as one month (fixed 2026-11-13)
  put('D' + help, F('=IFERROR(ROWS(UNIQUE(FILTER([TX.month],[TX.month]>=' + WS + ',[TX.month]<=' + WE + ',[TX.isDeleted]<>TRUE,(([TX.type]="Expense")+([TX.type]="Refund"))>0))),0)')).setNumberFormat('0');
  sh.getRange('A' + help + ':D' + help).setFontSize(8).setFontColor(COLORS.MUTED_TEXT);
  sh.hideRows(help); // calculated helpers, out of sight (the owner, 2026-11-26)

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
  // every other row a shade darker in the tables (the owner, 2026-11-27); the totals row is left as it is
  [[catFirst, catLast], [recFirst, recLast], [SPEND.HIST_FIRST, SPEND.HIST_FIRST + SPEND.HIST_COUNT - 1], [SPEND.AVG_FIRST, SPEND.AVG_FIRST + SPEND.AVG_ROWS - 1],
    [SPEND.CHECK_FIRST, SPEND.CHECK_FIRST + SPEND.CHECK_COUNT - 1]].forEach(b => addBandRule_(sh, sh.getRange('A' + b[0] + ':I' + b[1])));

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
  // the charges still waiting on Import Staging are in the numbers, so they are in the lists too (as WAITING_LABEL)
  const t = spendingNoteTexts_(readTable_(tdef_('TX')).concat(waitingAsTransactions_(readTable_(tdef_('STAGING')))), readTable_(tdef_('RECUR')), month, stamp);
  [['A', t.fixedFlex], ['C', t.needsWants], ['F', t.recurring]].forEach(p => {
    // one note per tile, on the big number; the label and small line carry none (three triangles looked like three different notes)
    sh.getRange(p[0] + SPEND.TILE_LABEL + ':' + p[0] + SPEND.TILE_SUB).setNotes([[''], [p[1]], ['']]);
  });
  return true;
}

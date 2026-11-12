/**
 * Household Finance Tracker — Spending.gs
 * The Spending tab: a spending dashboard for the Selected Month (it follows the Dashboard's month).
 * Four tiles (spent so far, fixed vs flexible, needs vs wants, recurring bills), spending by
 * category sorted by amount with Childcare and Child Expenses shown together, the recurring
 * payments with a paid-this-month check, the flexible subcategories, and six months by category.
 * All formulas over Transactions, Monthly Budget, Recurring Payments and the Categories tab; rebuilt
 * by buildWorkbook / upgradeWorkbook. Nothing is typed here.
 */

const SPEND = {
  MONTH_CELL: 'B3',
  TILE_LABEL: 5, TILE_VALUE: 6, TILE_SUB: 7,
  CAT_BAR: 9, CAT_HEADER: 10, CAT_FIRST: 11, CAT_ROWS: 30,   // 11–40, total on 41
  REC_BAR: 43, REC_HEADER: 44, REC_FIRST: 45, REC_ROWS: 15,  // 45–59 (flexible subcategories share these rows, F:I)
  HIST_BAR: 61, HIST_HEADER: 62, HIST_FIRST: 63, HIST_COUNT: 6, // 63–68
  NOTE_ROW: 70,
  LAST_ROW: 72,
  COLOR_CHILDCARE: '#6E5FA8', COLOR_CHILD: '#B9A6E8', COLOR_BAR: '#17324D',
  HIST_CATS: ['Housing', 'Childcare', 'Child Expenses', 'Food', 'Transportation', 'Insurance', 'Utilities'],
};

function buildSpending_() {
  const sh = getOrCreateSheet_(SHEETS.SPEND);
  const F = (t) => resolveFormula_(t, null, null);
  sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).breakApart();
  sh.clear(); // SAFETY-APPROVED: the Spending tab is calculated (formulas only, no inputs); rebuilt by buildWorkbook / upgradeWorkbook
  sh.clearConditionalFormatRules();
  sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).clearDataValidations();
  sh.getProtections(SpreadsheetApp.ProtectionType.SHEET).forEach(p => p.remove());
  ensureSheetSize_(sh, SPEND.LAST_ROW, 9);
  sh.setHiddenGridlines(true);
  [210, 105, 105, 105, 105, 80, 150, 110, 110].forEach((w, i) => sh.setColumnWidth(i + 1, w));
  sh.getRange(1, 1, SPEND.LAST_ROW, 9).setFontColor(COLORS.TEXT).setFontSize(10).setVerticalAlignment('middle');
  const put = (a1, v) => { const r = sh.getRange(a1); if (typeof v === 'string' && v.charAt(0) === '=') r.setFormula(v); else r.setValue(v); return r; };
  const mergePut = (a1, v) => { const r = sh.getRange(a1).merge(); if (typeof v === 'string' && v.charAt(0) === '=') r.setFormula(v); else r.setValue(v); return r; };
  const header = (a1, values) => { const r = sh.getRange(a1); r.setValues([values]); styleHeader_(r); r.setHorizontalAlignment('center'); };
  const M = '$B$3';
  const q = (s) => String(s).replace(/"/g, '""');
  // spending (expenses − refunds) for one category in one month; the month may be an expression
  const spend = (cat, m) => '(SUMIFS([TX.amount],[TX.month],' + m + ',[TX.category],"' + q(cat) + '",[TX.type],"Expense",[TX.isDeleted],"<>TRUE")-SUMIFS([TX.amount],[TX.month],' + m + ',[TX.category],"' + q(cat) + '",[TX.type],"Refund",[TX.isDeleted],"<>TRUE"))';
  const spendBy = (col, val, m) => '(SUMIFS([TX.amount],[TX.month],' + m + ',[TX.' + col + '],"' + q(val) + '",[TX.type],"Expense",[TX.isDeleted],"<>TRUE")-SUMIFS([TX.amount],[TX.month],' + m + ',[TX.' + col + '],"' + q(val) + '",[TX.type],"Refund",[TX.isDeleted],"<>TRUE"))';
  const spendAll = (m) => '(SUMIFS([TX.amount],[TX.month],' + m + ',[TX.type],"Expense",[TX.isDeleted],"<>TRUE")-SUMIFS([TX.amount],[TX.month],' + m + ',[TX.type],"Refund",[TX.isDeleted],"<>TRUE"))';
  const LM = 'EDATE(' + M + ',-1)';

  /* --- title, month --- */
  mergePut('A1:I1', 'Spending').setBackground(COLORS.NAVY).setFontColor(COLORS.WHITE).setFontSize(16).setFontWeight('bold');
  sh.setRowHeight(1, 40);
  mergePut('A2:I2', 'Where the money went: this month by category and by kind, the regular bills, the flexible spending, and six months side by side. Spending is expenses minus refunds; debt payments, savings and transfers are not spending. Follows the Dashboard\'s Selected Month.')
    .setFontStyle('italic').setFontColor(COLORS.MUTED_TEXT).setFontSize(9);
  put('A3', 'Month').setFontWeight('bold');
  put('B3', '=IFERROR(DASH_SELECTED_MONTH,DATE(YEAR(TODAY()),MONTH(TODAY()),1))').setNumberFormat('mmmm yyyy').setFontWeight('bold').setBackground(COLORS.PALE_BLUE).setHorizontalAlignment('center');
  mergePut('C3:I3', '="compared with "&TEXT(' + LM + ',"mmmm yyyy")&" and the average of "&TEXT(EDATE(' + M + ',-3),"mmm")&"–"&TEXT(' + LM + ',"mmm yyyy")&" · change the month on the Dashboard (B10)"').setFontColor(COLORS.MUTED_TEXT).setFontSize(9);

  /* --- tiles --- */
  const tiles = [
    { cols: ['A', 'B'], label: 'Spent so far', f: F('=' + spendAll(M)), fmt: '$#,##0',
      sub: F('="last month "&TEXT(' + spendAll(LM) + ',"$#,##0")&" · 3-month average "&TEXT((' + spendAll('EDATE(' + M + ',-1)') + '+' + spendAll('EDATE(' + M + ',-2)') + '+' + spendAll('EDATE(' + M + ',-3)') + ')/3,"$#,##0")') },
    { cols: ['C', 'D'], label: 'Fixed vs flexible', f: F('=TEXT(' + spendBy('spendingType', 'Fixed', M) + ',"$#,##0")&" / "&TEXT(' + spendBy('spendingType', 'Flexible', M) + ',"$#,##0")'), fmt: '@',
      sub: F('="bills and set payments / day-to-day · planned irregular "&TEXT(' + spendBy('spendingType', 'Planned Irregular', M) + ',"$#,##0")&" · unexpected "&TEXT(' + spendBy('spendingType', 'Unexpected', M) + ',"$#,##0")') },
    { cols: ['E', 'F'], label: 'Needs vs wants', f: F('=IFERROR(TEXT(' + spendBy('needWant', 'Need', M) + '/' + spendAll(M) + ',"0%")&" / "&TEXT(' + spendBy('needWant', 'Want', M) + '/' + spendAll(M) + ',"0%"),"—")'), fmt: '@',
      sub: F('=TEXT(' + spendBy('needWant', 'Need', M) + ',"$#,##0")&" needs · "&TEXT(' + spendBy('needWant', 'Want', M) + ',"$#,##0")&" wants"') },
    { cols: ['G', 'I'], label: 'Recurring bills', f: F('=SUMIFS([RECUR.monthlyEq],[RECUR.active],TRUE)'), fmt: '$#,##0" / mo"',
      sub: F('="subscriptions "&TEXT(SUMIFS([RECUR.monthlyEq],[RECUR.active],TRUE,[RECUR.group],"Subscriptions"),"$#,##0")&" · memberships "&TEXT(SUMIFS([RECUR.monthlyEq],[RECUR.active],TRUE,[RECUR.group],"Memberships"),"$#,##0")&" · "&COUNTIFS([RECUR.active],TRUE)&" active, "&COUNTIF($E$' + SPEND.REC_FIRST + ':$E$' + (SPEND.REC_FIRST + SPEND.REC_ROWS - 1) + ',"yes")&" paid this month"') },
  ];
  tiles.forEach(t => {
    mergePut(t.cols[0] + SPEND.TILE_LABEL + ':' + t.cols[1] + SPEND.TILE_LABEL, t.label).setBackground(COLORS.PALE_BLUE).setFontWeight('bold').setHorizontalAlignment('center');
    mergePut(t.cols[0] + SPEND.TILE_VALUE + ':' + t.cols[1] + SPEND.TILE_VALUE, t.f).setFontSize(18).setFontWeight('bold').setHorizontalAlignment('center').setNumberFormat(t.fmt);
    mergePut(t.cols[0] + SPEND.TILE_SUB + ':' + t.cols[1] + SPEND.TILE_SUB, t.sub).setFontSize(8).setFontColor(COLORS.MUTED_TEXT).setHorizontalAlignment('center').setWrap(true);
    sh.getRange(t.cols[0] + SPEND.TILE_LABEL + ':' + t.cols[1] + SPEND.TILE_SUB).setBorder(true, true, true, true, false, false, COLORS.BORDER, SpreadsheetApp.BorderStyle.SOLID);
  });
  sh.setRowHeight(SPEND.TILE_VALUE, 40); sh.setRowHeight(SPEND.TILE_SUB, 30);

  /* --- by category, sorted by this month; Childcare + Child Expenses shown together as "Children" --- */
  styleSectionBar_(sh.getRange('A' + SPEND.CAT_BAR + ':I' + SPEND.CAT_BAR), 'By category — this month, largest first');
  header('A' + SPEND.CAT_HEADER + ':I' + SPEND.CAT_HEADER, ['Category', 'This Month', 'Budget', 'Last Month', '3-Month Avg', 'Share', 'Bar', 'Childcare', 'Child Expenses']);
  sh.getRange('H' + SPEND.CAT_HEADER).setFontColor(SPEND.COLOR_CHILDCARE);
  sh.getRange('I' + SPEND.CAT_HEADER).setFontColor(SPEND.COLOR_CHILD);
  const catFirst = SPEND.CAT_FIRST, catLast = SPEND.CAT_FIRST + SPEND.CAT_ROWS - 1, catTotal = catLast + 1;
  const amt = (m) => 'LAMBDA(c,IF(c="Children",' + spend('Childcare', m) + '+' + spend('Child Expenses', m) + ',SUMIFS([TX.amount],[TX.month],' + m + ',[TX.category],c,[TX.type],"Expense",[TX.isDeleted],"<>TRUE")-SUMIFS([TX.amount],[TX.month],' + m + ',[TX.category],c,[TX.type],"Refund",[TX.isDeleted],"<>TRUE")))';
  const bud = 'LAMBDA(c,IF(c="Children",SUMIFS([BUDGET.planned],[BUDGET.month],' + M + ',[BUDGET.category],"Childcare")+SUMIFS([BUDGET.planned],[BUDGET.month],' + M + ',[BUDGET.category],"Child Expenses"),SUMIFS([BUDGET.planned],[BUDGET.month],' + M + ',[BUDGET.category],c)))';
  const catsExpr = 'UNIQUE(ARRAYFORMULA(IF((raw="Childcare")+(raw="Child Expenses"),"Children",raw)))';
  put('A' + catFirst, F('=IFERROR(LET(raw,UNIQUE(FILTER([CATS.category],[CATS.active]=TRUE,[CATS.category]<>"",[CATS.category]<>"Income",[CATS.category]<>"Savings",[CATS.category]<>"Debt Payments")),cats,' + catsExpr + ',' +
    'tm,MAP(cats,' + amt(M) + '),lm,MAP(cats,' + amt(LM) + '),av,MAP(cats,LAMBDA(c,(' + amt('EDATE(' + M + ',-1)') + '(c)+' + amt('EDATE(' + M + ',-2)') + '(c)+' + amt('EDATE(' + M + ',-3)') + '(c))/3)),bd,MAP(cats,' + bud + '),' +
    'ARRAY_CONSTRAIN(SORT(FILTER({cats,tm,bd,lm,av},(tm+lm+av+bd)>0),2,FALSE),' + SPEND.CAT_ROWS + ',5)),"")'));
  for (let r = catFirst; r <= catLast; r++) {
    put('F' + r, '=IF(OR($A' + r + '="",N($B$' + catTotal + ')=0),"",$B' + r + '/$B$' + catTotal + ')').setNumberFormat('0%').setFontColor(COLORS.MUTED_TEXT);
    put('G' + r, F('=IF($A' + r + '="","",IF($A' + r + '="Children",SPARKLINE({' + spend('Childcare', M) + ',' + spend('Child Expenses', M) + '},{"charttype","bar";"color1","' + SPEND.COLOR_CHILDCARE + '";"color2","' + SPEND.COLOR_CHILD + '";"max",MAX(1,MAX($B$' + catFirst + ':$B$' + catLast + '))}),SPARKLINE({N($B' + r + ')},{"charttype","bar";"color1","' + SPEND.COLOR_BAR + '";"max",MAX(1,MAX($B$' + catFirst + ':$B$' + catLast + '))})))'));
    put('H' + r, F('=IF($A' + r + '="Children",' + spend('Childcare', M) + ',"")')).setFontColor(SPEND.COLOR_CHILDCARE).setFontWeight('bold');
    put('I' + r, F('=IF($A' + r + '="Children",' + spend('Child Expenses', M) + ',"")')).setFontColor(SPEND.COLOR_CHILD).setFontWeight('bold');
  }
  sh.getRange('B' + catFirst + ':E' + catTotal).setNumberFormat(FORMATS.currency);
  sh.getRange('H' + catFirst + ':I' + catLast).setNumberFormat(FORMATS.currency);
  put('A' + catTotal, 'Total spending').setFontWeight('bold');
  put('B' + catTotal, F('=' + spendAll(M))).setFontWeight('bold');
  put('C' + catTotal, F('=SUMIFS([BUDGET.planned],[BUDGET.month],' + M + ')')).setFontWeight('bold');
  put('D' + catTotal, F('=' + spendAll(LM))).setFontWeight('bold');
  put('E' + catTotal, F('=(' + spendAll('EDATE(' + M + ',-1)') + '+' + spendAll('EDATE(' + M + ',-2)') + '+' + spendAll('EDATE(' + M + ',-3)') + ')/3')).setFontWeight('bold');
  sh.getRange('A' + catTotal + ':I' + catTotal).setBackground(COLORS.PALE_BLUE);
  sh.getRange('A' + SPEND.CAT_HEADER + ':I' + catTotal).setBorder(true, true, true, true, true, false, COLORS.BORDER, SpreadsheetApp.BorderStyle.SOLID);

  /* --- recurring payments (A:E) and flexible subcategories (G:I) --- */
  styleSectionBar_(sh.getRange('A' + SPEND.REC_BAR + ':E' + SPEND.REC_BAR), 'Recurring payments — every regular bill in one place');
  header('A' + SPEND.REC_HEADER + ':E' + SPEND.REC_HEADER, ['Name', 'Group', 'Monthly', 'Next Payment', 'Paid This Month?']);
  const recFirst = SPEND.REC_FIRST, recLast = SPEND.REC_FIRST + SPEND.REC_ROWS - 1;
  put('A' + recFirst, F('=IFERROR(ARRAY_CONSTRAIN(SORT(FILTER({[RECUR.name],[RECUR.group],[RECUR.monthlyEq],[RECUR.nextPayment]},[RECUR.active]=TRUE,[RECUR.name]<>""),4,TRUE),' + SPEND.REC_ROWS + ',4),"")'));
  for (let r = recFirst; r <= recLast; r++) {
    put('E' + r, F('=IF($A' + r + '="","",IFERROR(LET(i,MATCH($A' + r + ',[RECUR.name],0),cat,INDEX([RECUR.category],i),sub,INDEX([RECUR.subcategory],i),a,N(INDEX([RECUR.amount],i)),' +
      'IF(COUNTIFS([TX.month],' + M + ',[TX.category],cat,[TX.subcategory],sub,[TX.amount],">="&a*0.9,[TX.isDeleted],"<>TRUE")>0,"yes","not yet")),""))')).setHorizontalAlignment('center');
  }
  sh.getRange('C' + recFirst + ':C' + recLast).setNumberFormat(FORMATS.currency);
  sh.getRange('D' + recFirst + ':D' + recLast).setNumberFormat('mmm d');
  sh.getRange('A' + SPEND.REC_HEADER + ':E' + recLast).setBorder(true, true, true, true, true, false, COLORS.BORDER, SpreadsheetApp.BorderStyle.SOLID);
  styleSectionBar_(sh.getRange('G' + SPEND.REC_BAR + ':I' + SPEND.REC_BAR), 'Where the flexible money went');
  header('G' + SPEND.REC_HEADER + ':I' + SPEND.REC_HEADER, ['Subcategory', 'This Month', '3-Month Avg']);
  const flexSpend = (m) => 'LAMBDA(s,SUMIFS([TX.amount],[TX.month],' + m + ',[TX.subcategory],s,[TX.spendingType],"Flexible",[TX.type],"Expense",[TX.isDeleted],"<>TRUE")-SUMIFS([TX.amount],[TX.month],' + m + ',[TX.subcategory],s,[TX.spendingType],"Flexible",[TX.type],"Refund",[TX.isDeleted],"<>TRUE"))';
  put('G' + recFirst, F('=IFERROR(LET(subs,UNIQUE(FILTER([TX.subcategory],[TX.month]>=EDATE(' + M + ',-3),[TX.month]<=' + M + ',[TX.spendingType]="Flexible",[TX.type]="Expense",[TX.isDeleted]<>TRUE,[TX.subcategory]<>"")),' +
    'tm,MAP(subs,' + flexSpend(M) + '),av,MAP(subs,LAMBDA(s,(' + flexSpend('EDATE(' + M + ',-1)') + '(s)+' + flexSpend('EDATE(' + M + ',-2)') + '(s)+' + flexSpend('EDATE(' + M + ',-3)') + '(s))/3)),' +
    'ARRAY_CONSTRAIN(SORT(FILTER({subs,tm,av},(tm+av)>0),2,FALSE),' + SPEND.REC_ROWS + ',3)),"")'));
  sh.getRange('H' + recFirst + ':I' + recLast).setNumberFormat(FORMATS.currency);
  sh.getRange('G' + SPEND.REC_HEADER + ':I' + recLast).setBorder(true, true, true, true, true, false, COLORS.BORDER, SpreadsheetApp.BorderStyle.SOLID);

  /* --- six months by category --- */
  styleSectionBar_(sh.getRange('A' + SPEND.HIST_BAR + ':I' + SPEND.HIST_BAR), 'Month by month — the selected month and the five before it');
  const histCats = SPEND.HIST_CATS.slice(0, 7);
  header('A' + SPEND.HIST_HEADER + ':I' + SPEND.HIST_HEADER, ['Month'].concat(histCats).concat(['Everything Else']));
  // Total goes in the Month column's note row? Keep nine columns: Month + 7 categories + Everything else; the total is in the tile above.
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

  mergePut('A' + SPEND.NOTE_ROW + ':I' + SPEND.NOTE_ROW, 'Spending Type: Fixed = the same every month and already committed (rent, insurance, the nanny, subscriptions); Flexible = day-to-day spending you steer week by week (groceries, dining out, fuel); Planned Irregular = expected but not monthly (property tax, registration, travel); Unexpected = could not be planned (doctor visits, repairs). Need/Want: could it be cut if it had to be? Both come from the subcategory\'s defaults on the Categories tab and can be changed on any transaction. Budget is the Monthly Budget row for the month; a blank means none set. Full definitions on the Start Here tab.')
    .setFontSize(8).setFontColor(COLORS.MUTED_TEXT).setFontStyle('italic').setWrap(true).setVerticalAlignment('top');
  sh.setRowHeight(SPEND.NOTE_ROW, 56);

  sh.setConditionalFormatRules([
    cfRule_(sh.getRange('B' + catFirst + ':B' + catLast), '=AND(ISNUMBER($C' + catFirst + '),$C' + catFirst + '>0,$B' + catFirst + '>$C' + catFirst + ')', COLORS.OVER_FILL, COLORS.OVER_FONT),
    cfRule_(sh.getRange('B' + catFirst + ':B' + catLast), '=AND(ISNUMBER($C' + catFirst + '),$C' + catFirst + '>0,$B' + catFirst + '<=$C' + catFirst + ')', COLORS.UNDER_FILL, COLORS.UNDER_FONT),
    cfRule_(sh.getRange('E' + recFirst + ':E' + recLast), '=$E' + recFirst + '="yes"', COLORS.UNDER_FILL, COLORS.UNDER_FONT),
    cfRule_(sh.getRange('E' + recFirst + ':E' + recLast), '=$E' + recFirst + '="not yet"', COLORS.WARN_FILL, COLORS.WARN_FONT),
  ]);
  const prot = sh.protect().setDescription('The Spending tab is calculated. Change the month on the Dashboard (B10); edit data on Transactions, Monthly Budget and Recurring Payments.');
  prot.setWarningOnly(true);
}

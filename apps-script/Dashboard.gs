/**
 * Household Finance Tracker — Dashboard.gs
 *
 * The Dashboard tab was retired on 2026-11-12 (the owner's choice): its "this month" half (Selected
 * Month, review banner, Expected Take-Home, Spent So Far, Current Flexible Spending, the Monthly
 * Review Checklist) is now the top of the Spending tab (Spending.gs), and its accounts block is the
 * top of the Financial Summary (FinancialSummary.gs). The named ranges kept their names
 * (DASH_SELECTED_MONTH, DASH_CHECKLIST) and now sit on the Spending tab.
 *
 * What is left here: the paydays expression both tabs share, the accounts block builder, the
 * function that retires an existing Dashboard tab, and the Goals and Reminders tabs.
 */

// paydays of each Expected Income source inside the month [ms, me] (see Config EXPECT / PLAN notes)
const PD = 'IFERROR(IF([EXPECT.frequency]="Biweekly",IF(N([EXPECT.lastPayDate])=0,26/12,INT((me-N([EXPECT.lastPayDate]))/14)+INT((N([EXPECT.lastPayDate])-ms)/14)+1),IF([EXPECT.frequency]="Weekly",IF(N([EXPECT.lastPayDate])=0,52/12,INT((me-N([EXPECT.lastPayDate]))/7)+INT((N([EXPECT.lastPayDate])-ms)/7)+1),IF([EXPECT.frequency]="Semimonthly",2,IF([EXPECT.frequency]="Monthly",1,0)))),0)';

// Only what the upgrade needs to find the two inputs of a Dashboard tab from an older layout.
const DASH = { CHECK_COUNT: 8, LEGACY_SELECTED_MONTH: 'B3', LEGACY_FUNDS_FIRST: 39 };
const DASH_RETIRED_TEXT = 'This tab has moved. This month (take-home, spending, flexible money, checklist) is on the Spending tab; account balances are at the top of the Financial Summary. This empty tab is hidden and can be deleted.';

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
  // Goals & Progress (rows with amounts, dates and progress) took its place on 2026-11-27; this tab stays, hidden, with its text
  sh.hideSheet();
}

/**
 * The accounts block: checking and savings on the left (columns A:D), the credit cards with what is
 * owed and when it is due on the right (E:H). Lines come from DASH_ACCOUNTS in Config.gs. Drawn on the
 * Financial Summary; R = { header, first, note } are the rows to use. The sheet needs the
 * column widths [190, 100, 70, 110, 120, 130, 120, 120, 120].
 */
function buildAccountsBlock_(sh, R) {
  const F = (t) => resolveFormula_(t, null, null);
  const put = (a1, v) => { const r = sh.getRange(a1); if (typeof v === 'string' && v.charAt(0) === '=') r.setFormula(v); else r.setValue(v); return r; };
  const mergePut = (a1, v) => { const r = sh.getRange(a1).merge(); if (typeof v === 'string' && v.charAt(0) === '=') r.setFormula(v); else r.setValue(v); return r; };
  const header = (a1, values) => { const r = sh.getRange(a1); r.setValues([values]); styleHeader_(r); r.setHorizontalAlignment('center'); };
  /* --- accounts block: checking and savings (left), credit cards with due dates (right) --- */
  const q = (s) => String(s).replace(/"/g, '""');
  const pats = (line) => line.patterns || [line.institution];
  const crit = (pat, type) => '[ACCOUNTS.institution],"*' + q(pat) + '*",[ACCOUNTS.accountType],"' + q(type) + '",[ACCOUNTS.includeNW],"Yes"';
  // An account whose institution matches more than one pattern (e.g. "Elan … Independent Bank") must count
  // once: match any pattern with one OR test per row instead of adding a SUMIFS per pattern (2026-11-12).
  // "+0" matters: with a single name the test would be TRUE/FALSE compared with 0, and in Sheets a
  // boolean is greater than any number, so FALSE>0 is TRUE and every account would match (2026-11-12).
  const namesHit = (line) => '((' + pats(line).map(pt => 'ISNUMBER(SEARCH("' + q(pt) + '",[ACCOUNTS.institution]))').join('+') + '+0)>0)';
  const anyPat = namesHit;
  const rowsOf = (line, type) => anyPat(line) + '*([ACCOUNTS.accountType]="' + q(type) + '")*([ACCOUNTS.includeNW]="Yes")';
  const countOf = (line, type) => 'SUMPRODUCT(' + rowsOf(line, type) + '*([ACCOUNTS.connectionId]<>""))';
  const sumOf = (line, type, col) => 'SUMPRODUCT(' + rowsOf(line, type) + '*N(+[ACCOUNTS.' + col + ']))';
  const maxOf = (line, type, col) => 'MAX(' + pats(line).map(pt => 'MAXIFS([ACCOUNTS.' + col + '],' + crit(pt, type) + ')').join(',') + ')';
  const balanceOf = (line, type) => 'IF(' + countOf(line, type) + '=0,"—",' + sumOf(line, type, 'currentBalance') + ')';
  header('A' + R.header + ':B' + R.header, ['Account', 'Balance']);
  sh.getRange('C' + R.header + ':D' + R.header).merge(); styleHeader_(sh.getRange('C' + R.header + ':D' + R.header));
  sh.getRange('C' + R.header).setValue('Updated');
  // the cards sit right beside the accounts, no empty column between them (the owner, 2026-11-27): E card, F owed, G:H due
  header('E' + R.header + ':G' + R.header, ['Credit card', 'Owed', 'Due']);
  sh.getRange('G' + R.header + ':H' + R.header).merge();
  sh.getRange('B' + R.header).setHorizontalAlignment('right');
  sh.getRange('F' + R.header).setHorizontalAlignment('right');
  // Each line is the bank balance. (Until 2026-11-15 the savings line subtracted money parked in savings for bills;
  // the owner now pays every bill from checking.)
  DASH_ACCOUNTS.main.forEach((line, i) => {
    const r = R.first + i;
    put('A' + r, line.label + (line.sub ? ' (' + line.sub + ')' : '')).setFontWeight('bold').setBackground(COLORS.CARD_GROSS);
    const bal = balanceOf(line, line.type);
    put('B' + r, F('=' + bal)).setNumberFormat(FORMATS.currency).setFontWeight('bold').setFontSize(14).setHorizontalAlignment('right').setBackground(COLORS.CARD_GROSS);
    mergePut('C' + r + ':D' + r, F('=IF(' + countOf(line, line.type) + '=0,"not connected yet",IFERROR(LET(d,' + maxOf(line, line.type, 'lastSynced') + ',IF(d=0,"",TEXT(d,"mmm d, h:mm am/pm"))),""))')).setFontSize(9).setFontColor(COLORS.MUTED_TEXT).setBackground(COLORS.CARD_GROSS);
    sh.setRowHeight(r, 28);
  });
  DASH_ACCOUNTS.cards.forEach((card, i) => {
    const r = R.first + i;
    put('E' + r, card.label).setFontWeight('bold').setBackground(COLORS.CARD_SPENDING);
    // what will be owed (the owner, 2026-11-16): the card's posted balance plus its charges still pending at the bank
    const cardIds = 'FILTER([ACCOUNTS.id],[ACCOUNTS.accountType]="Credit Card",' + namesHit(card) + ',[ACCOUNTS.includeNW]="Yes")';
    // pending charges are read from Import Staging, where every bank charge lands first (most wait there for review
    // until after they post); the bank's own sign: a charge is positive, a payment or credit negative. A pending row
    // is replaced (Superseded) when its posted version arrives, so nothing counts twice; one older than
    // CARD_PENDING_DAYS is left out (a charge that never posted).
    const pendingOf = 'IFERROR(SUMPRODUCT(([STAGING.pending]=TRUE)*([STAGING.status]<>"Superseded")*([STAGING.status]<>"Removed")*([STAGING.date]>=TODAY()-' + CARD_PENDING_DAYS + ')*ISNUMBER(MATCH([STAGING.accountId],' + cardIds + ',0)),IF(ISNUMBER([STAGING.amount]),[STAGING.amount],0)),0)';
    put('F' + r, F('=LET(b,' + balanceOf(card, 'Credit Card') + ',IF(ISNUMBER(b),b+' + pendingOf + ',b))')).setNumberFormat(FORMATS.currency).setFontWeight('bold').setFontSize(14).setHorizontalAlignment('right').setBackground(COLORS.CARD_SPENDING);
    const anyPat = namesHit(card);
    const idOf = 'IFERROR(INDEX(FILTER([ACCOUNTS.id],[ACCOUNTS.accountType]="Credit Card",' + anyPat + ',[ACCOUNTS.includeNW]="Yes",[ACCOUNTS.connectionId]<>""),1),"")';
    mergePut('G' + r + ':H' + r, F('=IFERROR(LET(id,' + idOf + ',nd,IFERROR(INDEX([DEBTS.nextDue],MATCH(id,[DEBTS.linkedAccount],0)),""),IF(id="","not connected yet",IF(AND(ISNUMBER($F' + r + '),$F' + r + '<=0),"paid in full",IF(nd="","","due "&TEXT(nd,"mmm d"))))&LET(p,' + pendingOf + ',IF(p=0,"",IF(nd="",""," · ")&"incl. "&TEXT(p,"$#,##0.00")&" pending"))),"")'))
      .setFontSize(9).setFontColor(COLORS.MUTED_TEXT).setBackground(COLORS.CARD_SPENDING);
    sh.setRowHeight(r, 28);
  });
  const cardTotalRow = R.first + DASH_ACCOUNTS.cards.length;
  put('E' + cardTotalRow, 'Total owed on cards').setFontWeight('bold').setBackground(COLORS.PALE_BLUE);
  put('F' + cardTotalRow, '=SUMPRODUCT(N(+F' + R.first + ':F' + (cardTotalRow - 1) + '))').setNumberFormat(FORMATS.currency).setFontWeight('bold').setHorizontalAlignment('right').setBackground(COLORS.PALE_BLUE);
  sh.getRange('G' + cardTotalRow + ':H' + cardTotalRow).merge().setBackground(COLORS.PALE_BLUE);
  sh.getRange('A' + R.header + ':D' + (R.first + DASH_ACCOUNTS.main.length - 1)).setBorder(true, true, true, true, true, true, COLORS.BORDER, SpreadsheetApp.BorderStyle.SOLID);
  sh.getRange('E' + R.header + ':H' + cardTotalRow).setBorder(true, true, true, true, true, true, COLORS.BORDER, SpreadsheetApp.BorderStyle.SOLID);
  hoverNote_(sh, 'A' + R.header, 'Balances arrive from the bank feed each night; a line shows — and "not connected yet" until its bank is connected. Card due dates come from the lender. Checking and savings are the available balances, with pending items already taken out; what a card shows as owed includes its charges still pending at the bank (they post in a day or two). Net worth and Debts use posted balances.', R.note);
}

/**
 * Empties and hides a Dashboard tab left by an older build. Runs only after the Spending tab holds
 * the Selected Month (the named range points there), so nothing typed is lost: the tab's two inputs
 * were read by the upgrade and written to Spending first. Returns true when it retired the tab.
 */
function retireDashboard_() {
  const ss = ss_();
  const sh = ss.getSheetByName(SHEETS.DASH);
  if (!sh) return false;
  const sel = ss.getRangeByName('DASH_SELECTED_MONTH');
  if (!sel || sel.getSheet().getName() !== SHEETS.SPEND) return false;
  if (sh.isSheetHidden() && sh.getRange('A1').getValue() === DASH_RETIRED_TEXT) return false;
  sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).breakApart();
  sh.clear(); // SAFETY-APPROVED: the Dashboard tab is calculated; its only inputs (Selected Month, checklist ticks) are already on the Spending tab (checked above), and the tab is retired
  sh.clearConditionalFormatRules();
  sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).clearDataValidations();
  sh.getProtections(SpreadsheetApp.ProtectionType.SHEET).forEach(p => p.remove());
  sh.getRange('A1').setValue(DASH_RETIRED_TEXT).setFontColor(COLORS.MUTED_TEXT);
  sh.hideSheet();
  return true;
}

/* Reminders tab: the few things only the owner can do, calculated from the tables. Rebuilt by buildWorkbook / upgradeWorkbook.
   Hidden since 2026-11-27: the To-Do & Reminders tab (first) shows its box beside the checklist; the email and Show reminders read it here. */
const REMINDERS = { WIDTH: 8, BOX_FIRST: 4, BOX_ROWS: 14 };
// account types whose balance, when the bank feed cannot reach them, the owner types by hand: retirement plans, HSA, investments
const BALANCE_REMINDER_TYPES = ['Retirement', 'HSA', 'Investment'];

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
  // one line per regular paycheck (active Expected Income row) whose last real stub is older than the setting; rows made from a bank deposit do not count as stubs
  const stubLines = 'MAP([EXPECT.id],[EXPECT.person],[EXPECT.employer],[EXPECT.active],LAMBDA(xi,xp,xe,xa,IF(AND(xi<>"",xa=TRUE),LET(xd,MAXIFS([INCOME.payDate],[INCOME.person],xp,[INCOME.employer],xe,[INCOME.notes],"<>*' + INCOME_FROM_DEPOSIT_MARK + '*"),IF(xd<EDATE(TODAY(),-s),"Pay stub for "&xp&" at "&xe&": "&IF(xd=0,"none entered yet","last one dated "&TEXT(xd,"mmm d, yyyy"))&". Give Claude a recent stub (Import from Claude) so gross pay and deductions stay accurate.","")),"")))';
  // one line per retirement, HSA or investment account the bank feed does not update whose balance is older than the setting
  const balTypes = BALANCE_REMINDER_TYPES.map(t => '(xt="' + t + '")').join('+');
  const balanceLines = 'MAP([ACCOUNTS.id],[ACCOUNTS.name],[ACCOUNTS.accountType],[ACCOUNTS.connectionId],[ACCOUNTS.includeNW],[ACCOUNTS.lastUpdated],LAMBDA(xi,xn,xt,xc,xw,xd,IF(AND(xi<>"",xc="",xw="Yes",(' + balTypes + ')>0,N(xd)<EDATE(TODAY(),-b)),"Balance for "&xn&": "&IF(N(xd)=0,"never entered","last updated "&TEXT(xd,"mmm d, yyyy"))&". Type the balance from the provider\'s website on Accounts (Current Balance).","")))';
  const remBox = sh.getRange(REMINDERS.BOX_FIRST, 1, REMINDERS.BOX_ROWS, REMINDERS.WIDTH).merge();
  remBox.setFormula(F('=LET(m,IFERROR(N(SETTING_PSLF_REMINDER_MONTHS),12),c,IFERROR(N(SETTING_CREDIT_REMINDER_MONTHS),3),s,IF(IFERROR(N(SETTING_PAYSTUB_REMINDER_MONTHS),0)>0,N(SETTING_PAYSTUB_REMINDER_MONTHS),6),b,IF(IFERROR(N(SETTING_BALANCE_REMINDER_MONTHS),0)>0,N(SETTING_BALANCE_REMINDER_MONTHS),6),due,TEXTJOIN(CHAR(10),TRUE,ARRAYFORMULA(IF(([DEBTS.id]<>"")*([DEBTS.group]="Student Loans")*(([DEBTS.pslfAsOf]="")+([DEBTS.pslfAsOf]<EDATE(TODAY(),-m))),"PSLF count for "&[DEBTS.name]&": "&IF([DEBTS.pslfAsOf]="","never entered","last confirmed "&TEXT([DEBTS.pslfAsOf],"mmm d, yyyy"))&". Read it on studentaid.gov and update Debts.","")),' + creditLines + ',' + stubLines + ',' + balanceLines + '),IF(due="","Nothing due. PSLF counts are flagged after "&m&" months, credit scores after "&c&" months, pay stubs after "&s&" months and balances typed by hand after "&b&" months (App Setup).","• "&SUBSTITUTE(due,CHAR(10),CHAR(10)&"• ")))'));
  remBox.setWrap(true).setVerticalAlignment('top').setFontSize(12).setBackground(COLORS.WARN_FILL).setFontColor(COLORS.WARN_FONT)
    .setBorder(true, true, true, true, false, false, COLORS.BORDER, SpreadsheetApp.BorderStyle.SOLID);
  for (let r = REMINDERS.BOX_FIRST; r < REMINDERS.BOX_FIRST + REMINDERS.BOX_ROWS; r++) sh.setRowHeight(r, 26);
  setNamedRange_('REMINDERS_BOX', remBox);
  const note = REMINDERS.BOX_FIRST + REMINDERS.BOX_ROWS + 1;
  sh.getRange(note, 1, 1, REMINDERS.WIDTH).merge().setValue('Where to update each item: PSLF counts on Debts (PSLF Official Count and PSLF Count As Of), credit scores on the Credit Scores tab, pay stubs through Finance Tracker → Import from Claude, balances typed by hand on Accounts (Current Balance), the pension note on Accounts, the tax debt balance on Quarterly Debt Review.')
    .setFontSize(9).setFontColor(COLORS.MUTED_TEXT).setWrap(true);
  sh.setRowHeight(note, 36);
  const prot = sh.protect().setDescription('Reminders are calculated. Update the values on their own tabs.');
  prot.setWarningOnly(true);
  // shown beside the to-do checklist on the first tab (the owner, 2026-11-27); this tab stays, hidden, for the email and Show reminders
  sh.hideSheet();
}

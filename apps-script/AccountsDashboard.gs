/**
 * Accounts Dashboard: the tab after the main Dashboard. Live balances for the everyday accounts
 * (left) and the credit cards (right), with 30-day trend lines drawn from Balance History.
 * Every cell is a formula over Accounts, Debts, Connections, Import Staging and Balance History;
 * the layout comes from ACCOUNTS_DASH in Config.gs. Rebuilt by buildWorkbook / upgradeWorkbook.
 */

const ACCTDASH = { TITLE_ROW: 1, SUB_ROW: 2, BAR_ROW: 4, HEADER_ROW: 5, FIRST_ROW: 6, WIDTH: 8 };

function buildAccountsDashboard_() {
  const sh = getOrCreateSheet_(SHEETS.ACCTDASH);
  const F = (t) => resolveFormula_(t, null, null);
  const q = (s) => String(s).replace(/"/g, '""');
  sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).breakApart();
  sh.clear(); // SAFETY-APPROVED: the Accounts Dashboard is calculated (formulas only); rebuilt by buildWorkbook / upgradeWorkbook
  sh.clearConditionalFormatRules();
  sh.getProtections(SpreadsheetApp.ProtectionType.SHEET).forEach(p => p.remove());
  const mainRows = ACCOUNTS_DASH.main.length, cardRows = ACCOUNTS_DASH.cards.length;
  const lastRow = ACCTDASH.FIRST_ROW + Math.max(mainRows + 2, cardRows + 2) + 4;
  ensureSheetSize_(sh, lastRow, ACCTDASH.WIDTH);
  sh.setHiddenGridlines(true);
  [230, 120, 120, 95, 24, 190, 115, 190].forEach((w, i) => sh.setColumnWidth(i + 1, w));
  sh.getRange(1, 1, lastRow, ACCTDASH.WIDTH).setFontColor(COLORS.TEXT).setFontSize(11).setVerticalAlignment('middle');

  sh.getRange(ACCTDASH.TITLE_ROW, 1, 1, ACCTDASH.WIDTH).merge().setValue('Accounts Dashboard').setBackground(COLORS.NAVY).setFontColor(COLORS.WHITE).setFontSize(16).setFontWeight('bold');
  sh.setRowHeight(ACCTDASH.TITLE_ROW, 40);
  sh.getRange(ACCTDASH.SUB_ROW, 1, 1, ACCTDASH.WIDTH).merge()
    .setFormula(F('="Live balances from the bank feed. Last sync "&IFERROR(TEXT(MAX([CONN.lastSync]),"mmm d, h:mm am/pm"),"never")&" · "&(COUNTIF([STAGING.status],"Needs Review")+COUNTIF([STAGING.status],"Needs Split"))&" imported transaction(s) awaiting review. Trends cover the last 30 days of saved balances."'))
    .setFontSize(9).setFontColor(COLORS.MUTED_TEXT);

  styleSectionBar_(sh.getRange(ACCTDASH.BAR_ROW, 1, 1, 4), 'Main accounts');
  styleSectionBar_(sh.getRange(ACCTDASH.BAR_ROW, 6, 1, 3), 'Credit cards');
  const hdr = (a1, vals) => { const r = sh.getRange(a1); r.setValues([vals]); styleHeader_(r); };
  hdr('A' + ACCTDASH.HEADER_ROW + ':D' + ACCTDASH.HEADER_ROW, ['Account', 'Balance', '30 days', 'Change']);
  hdr('F' + ACCTDASH.HEADER_ROW + ':H' + ACCTDASH.HEADER_ROW, ['Card', 'Owed', 'Minimum · due']);
  sh.getRange(ACCTDASH.HEADER_ROW, 2, 1, 3).setHorizontalAlignment('right');
  sh.getRange(ACCTDASH.HEADER_ROW, 7).setHorizontalAlignment('right');

  // criteria shared by the formulas: institution contains the text; type when given; Include in Net Worth = Yes (skips duplicate rows)
  const accCrit = (line) => '[ACCOUNTS.institution],"*' + q(line.institution) + '*"' + (line.type ? ',[ACCOUNTS.accountType],"' + q(line.type) + '"' : '') + ',[ACCOUNTS.includeNW],"Yes"';
  const histCrit = (line) => '[HIST.institution],"*' + q(line.institution) + '*"' + (line.type ? ',[HIST.accountType],"' + q(line.type) + '"' : '');
  const histFilter = (line) => 'ISNUMBER(SEARCH("' + q(line.institution) + '",[HIST.institution]))' + (line.type ? ',[HIST.accountType]="' + q(line.type) + '"' : '');
  const balanceOf = (line) => 'IF(COUNTIFS(' + accCrit(line) + ',[ACCOUNTS.connectionId],"<>")=0,"not connected yet",SUMIFS([ACCOUNTS.currentBalance],' + accCrit(line) + '))';
  const sparkOf = (line, color) => '=IFERROR(SPARKLINE(MAP(UNIQUE(FILTER([HIST.date],' + histFilter(line) + ',[HIST.date]>=TODAY()-30)),LAMBDA(d,SUMIFS([HIST.balance],[HIST.date],d,' + histCrit(line) + '))),{"charttype","line";"color","' + color + '";"linewidth",1.5}),"")';
  const changeOf = (line, balCell) => '=IFERROR(IF(NOT(ISNUMBER(' + balCell + ')),"",LET(d0,MAXIFS([HIST.date],[HIST.date],"<="&(TODAY()-30),' + histCrit(line) + '),d1,IF(d0=0,MINIFS([HIST.date],' + histCrit(line) + '),d0),IF(d1=0,"",' + balCell + '-SUMIFS([HIST.balance],[HIST.date],d1,' + histCrit(line) + ')))),"")';

  ACCOUNTS_DASH.main.forEach((line, i) => {
    const r = ACCTDASH.FIRST_ROW + i;
    sh.getRange(r, 1).setValue(line.label + (line.sub ? ' (' + line.sub + ')' : '')).setFontWeight('bold');
    sh.getRange(r, 2).setFormula(F('=' + balanceOf(line))).setNumberFormat(FORMATS.currency).setFontWeight('bold').setFontSize(13).setHorizontalAlignment('right');
    sh.getRange(r, 3).setFormula(F(sparkOf(line, COLORS.TEAL)));
    sh.getRange(r, 4).setFormula(F(changeOf(line, '$B' + r))).setNumberFormat('+$#,##0;-$#,##0;$0').setHorizontalAlignment('right').setFontColor(COLORS.MUTED_TEXT);
    sh.setRowHeight(r, 30);
  });
  sh.getRange(ACCTDASH.FIRST_ROW, 1, mainRows, 4).setBorder(true, true, true, true, true, false, COLORS.BORDER, SpreadsheetApp.BorderStyle.SOLID);
  const mainNote = ACCTDASH.FIRST_ROW + mainRows;
  sh.getRange(mainNote, 1, 1, 4).merge().setValue('Venmo adds both Venmo logins together. Change is over 30 days, or since the first saved balance while history is shorter than that. A row reads "not connected yet" until its bank is connected.')
    .setFontSize(8).setFontColor(COLORS.MUTED_TEXT).setFontStyle('italic').setWrap(true);
  sh.setRowHeight(mainNote, 34);

  ACCOUNTS_DASH.cards.forEach((inst, i) => {
    const r = ACCTDASH.FIRST_ROW + i;
    const line = { institution: inst, type: 'Credit Card' };
    sh.getRange(r, 6).setValue(inst).setFontWeight('bold');
    sh.getRange(r, 7).setFormula(F('=' + balanceOf(line))).setNumberFormat(FORMATS.currency).setFontWeight('bold').setFontSize(13).setHorizontalAlignment('right');
    const idOf = 'IFERROR(INDEX(FILTER([ACCOUNTS.id],[ACCOUNTS.accountType]="Credit Card",ISNUMBER(SEARCH("' + q(inst) + '",[ACCOUNTS.institution])),[ACCOUNTS.includeNW]="Yes"),1),"")';
    sh.getRange(r, 8).setFormula(F('=IFERROR(LET(id,' + idOf + ',mp,IFERROR(INDEX([DEBTS.minPayment],MATCH(id,[DEBTS.linkedAccount],0)),""),nd,IFERROR(INDEX([DEBTS.nextDue],MATCH(id,[DEBTS.linkedAccount],0)),""),' +
      'IF(id="","",IF(AND(ISNUMBER($G' + r + '),$G' + r + '<=0),"paid in full",IF(mp="","","min "&TEXT(mp,"$#,##0")&IF(nd="",""," · due "&TEXT(nd,"mmm d")))))),"")'))
      .setFontSize(9).setFontColor(COLORS.MUTED_TEXT);
    sh.setRowHeight(r, 30);
  });
  const totalRow = ACCTDASH.FIRST_ROW + cardRows;
  sh.getRange(totalRow, 6).setValue('Total owed on cards').setFontWeight('bold');
  sh.getRange(totalRow, 7).setFormula('=SUMPRODUCT(N(+G' + ACCTDASH.FIRST_ROW + ':G' + (totalRow - 1) + '))').setNumberFormat(FORMATS.currency).setFontWeight('bold').setHorizontalAlignment('right');
  sh.getRange(totalRow, 6, 1, 3).setBackground(COLORS.PALE_BLUE);
  sh.getRange(ACCTDASH.FIRST_ROW, 6, cardRows + 1, 3).setBorder(true, true, true, true, true, false, COLORS.BORDER, SpreadsheetApp.BorderStyle.SOLID);
  sh.setConditionalFormatRules([
    cfRule_(sh.getRange(ACCTDASH.FIRST_ROW, 7, cardRows + 1, 1), '=AND(ISNUMBER(G' + ACCTDASH.FIRST_ROW + '),G' + ACCTDASH.FIRST_ROW + '>0)', null, COLORS.OVER_FONT),
    cfRule_(sh.getRange(ACCTDASH.FIRST_ROW, 4, mainRows, 1), '=AND(ISNUMBER(D' + ACCTDASH.FIRST_ROW + '),D' + ACCTDASH.FIRST_ROW + '<0)', null, COLORS.OVER_FONT),
  ]);
  const prot = sh.protect().setDescription('The Accounts Dashboard is calculated. Balances arrive from the bank feed; the layout is set in the script (ACCOUNTS_DASH).');
  prot.setWarningOnly(true);
}

/**
 * Remembers each connected account's balance for the day in Balance History (the same account on
 * the same day is overwritten, never duplicated). Called by the sync after balances are written.
 * rows = [{ accountId, accountName, accountType, institution, balance }]. Returns rows written.
 */
function recordBalanceHistory_(rows) {
  if (!rows || !rows.length) return 0;
  const def = tdef_('HIST');
  syncLastRow_(def);
  const sh = getOrCreateSheet_(def.sheet);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const key = (d) => (d instanceof Date) ? Utilities.formatDate(d, 'America/Detroit', 'yyyy-MM-dd') : '';
  const todayKey = key(today);
  const existing = {};
  readTable_(def).forEach(h => { if (key(h.date) === todayKey) existing[h.accountId] = h.__row; });
  const fresh = [];
  rows.forEach(x => {
    if (existing[x.accountId]) sh.getRange(existing[x.accountId], colIndex_(def, 'balance')).setValue(Number(x.balance));
    else fresh.push({ date: today, accountId: x.accountId, accountName: x.accountName, accountType: x.accountType, institution: x.institution, balance: Number(x.balance), source: 'Plaid' });
  });
  if (fresh.length) writeRows_(def, fresh);
  return rows.length;
}

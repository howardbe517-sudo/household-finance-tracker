/**
 * Household Finance Tracker — Main.gs
 * Entry points: build/rebuild, custom menu, onEdit change-log trigger,
 * and the maintenance helpers (link deposits, split, snapshot, extend, clear sample).
 *
 * FIRST RUN: with a brand-new blank spreadsheet open, run buildWorkbookWithSample()
 * (or buildWorkbookEmpty()) from the Apps Script editor and authorize when asked.
 */

function buildWorkbookWithSample() { return buildWorkbook({ sample: true }); }
function buildWorkbookEmpty() { return buildWorkbook({ sample: false }); }

function buildWorkbook(options) {
  const opts = Object.assign({ sample: true }, options || {});
  const ss = ss_();
  const started = new Date();
  toast_('Building workbook… this takes a minute or two.', 'Finance Tracker');

  // Keep a scratch sheet so the spreadsheet is never empty while we rebuild.
  let scratch = ss.getSheetByName('_build');
  if (!scratch) scratch = ss.insertSheet('_build');
  ss.getSheets().forEach(sh => { if (sh.getName() !== '_build') ss.deleteSheet(sh); }); // SAFETY-APPROVED: buildWorkbook runs on a blank spreadsheet or after the owner confirms a full rebuild
  ss.getNamedRanges().forEach(nr => nr.remove());
  TAB_ORDER.forEach(name => ss.insertSheet(name));

  // Phase 1 — reference tables
  buildCategories_();
  buildAccounts_(opts.sample);
  // Phase 2 — core raw tables
  buildCoreTables_();
  // Phase 3 — import / app infrastructure
  buildInfrastructureTables_();
  // Phase 4 — derived reporting
  buildDerivedTables_();
  // Phase 5 — dashboard & docs
  buildDashboard_();
  buildGoals_();
  buildAppSetup_(opts.sample);
  buildSources_();
  buildStartHere_(opts.sample);
  // Sample data
  if (opts.sample) writeSampleData_();

  // Tab order, cleanup
  TAB_ORDER.forEach((name, i) => { ss.setActiveSheet(ss.getSheetByName(name)); ss.moveActiveSheet(i + 1); });
  ss.deleteSheet(ss.getSheetByName('_build')); // SAFETY-APPROVED: removes the temporary _build scratch sheet only
  if (ss.getName().indexOf('Untitled') === 0) ss.rename(HFT.TITLE);
  ss.setActiveSheet(ss.getSheetByName(SHEETS.DASH));
  SpreadsheetApp.flush();

  // Phase 6 — QA
  const qa = qaReport_();
  const secs = Math.round((new Date() - started) / 1000);
  const summary = 'Build finished in ' + secs + 's. QA: ' + (qa.failures === 0 ? 'all ' + qa.checks + ' checks passed.' : qa.failures + ' of ' + qa.checks + ' checks failed — open Finance Tracker → Run QA checks for details.');
  try {
    const r1 = ss.getRangeByName('QA_LAST_RUN'); if (r1) r1.setValue(new Date());
    const r2 = ss.getRangeByName('QA_LAST_RESULT'); if (r2) r2.setValue(qa.failures === 0 ? 'PASS (' + qa.checks + ' checks)' : 'FAIL — ' + qa.failures + ' of ' + qa.checks + ' checks');
  } catch (e) { /* ignore */ }
  Logger.log(summary + '\n' + qa.lines.join('\n'));
  toast_(summary, 'Finance Tracker');
  return { seconds: secs, qa };
}

/* ---------- menu ---------- */

function onOpen() {
  const ui = ui_();
  if (!ui) return;
  ui.createMenu('Finance Tracker')
    .addItem('Import reviewed rows', 'importReviewedRows')
    .addItem('Split the selected row…', 'showSplitPanel')
    .addItem('Make a rule from the selected row…', 'makeRuleFromRow')
    .addItem('Re-apply rules to waiting rows', 'reapplyRules')
    .addSeparator()
    .addSubMenu(ui.createMenu('Bank feed')
      .addItem('Status', 'plaidStatus')
      .addItem('Set history start date…', 'setPlaidStartDate')
      .addItem('Connect a bank…', 'connectBank')
      .addItem('Finish connecting', 'finishConnectingPrompt')
      .addItem('Repair a connection…', 'repairConnection')
      .addSeparator()
      .addItem('Sync now', 'syncNow')
      .addItem('Turn nightly sync on', 'enableNightlySync')
      .addItem('Turn nightly sync off', 'disableNightlySync'))
    .addSeparator()
    .addItem('Copy financial snapshot for AI…', 'exportSnapshot')
    .addItem('Show reminders', 'showReminders')
    .addItem('Run QA checks', 'runQA')
    .addItem('Link income deposits to paychecks', 'linkIncomeDeposits')
    .addItem('Record net worth snapshot', 'recordNetWorthSnapshot')
    .addSeparator()
    .addItem('Upgrade workbook (keeps data)', 'upgradeWorkbook')
    .addItem('Extend formula rows (+500 per table)', 'extendFormulaRows')
    .addItem('Clear sample data…', 'clearSampleData')
    .addSeparator()
    .addItem('Rebuild workbook (destructive)…', 'rebuildWorkbookPrompt')
    .addToUi();
}

function rebuildWorkbookPrompt() {
  const ui = ui_();
  if (!ui) return buildWorkbook({ sample: true });
  const a = ui.alert('Rebuild workbook', 'This deletes EVERY tab and rebuilds the workbook from the script. All data in this spreadsheet will be lost.\n\nContinue?', ui.ButtonSet.YES_NO);
  if (a !== ui.Button.YES) return;
  const b = ui.alert('Sample data', 'Include tagged sample data so formulas and the Dashboard have something to show?', ui.ButtonSet.YES_NO_CANCEL);
  if (b === ui.Button.CANCEL) return;
  buildWorkbook({ sample: b === ui.Button.YES });
  ui.alert('Rebuild complete', 'The workbook was rebuilt. Review the QA result on App Setup.', ui.ButtonSet.OK);
}

/* ---------- onEdit: change log + timestamps ---------- */

function onEdit(e) {
  try {
    if (!e || !e.range) return;
    const sh = e.range.getSheet();
    const name = sh.getName();
    const key = Object.keys(TABLES).filter(k => TABLES[k].sheet === name && TABLES[k].logChanges)[0];
    if (!key) return;
    const def = TABLES[key];
    const r = e.range;
    if (r.getRow() < def.firstRow) return;
    const now = new Date();
    const who = userEmail_();
    if (!changeLogEnabled_()) { stampTx_(def, sh, r, e, now, who); return; }
    if (r.getNumRows() > 1 || r.getNumColumns() > 1) {
      appendChangeLog_({ table: key, recordId: '', field: r.getA1Notation(), action: 'Bulk Edit', notes: r.getNumRows() + 'x' + r.getNumColumns() + ' cells edited', user: who });
      return;
    }
    const col = r.getColumn();
    if (col > def.columns.length) return;
    const c = def.columns[col - 1];
    if (c.f || c.arrayFormula) return;
    const id = sh.getRange(r.getRow(), 1).getValue();
    const newVal = e.value === undefined ? r.getValue() : e.value;
    appendChangeLog_({ table: key, recordId: id, field: c.h, oldValue: e.oldValue === undefined ? '' : e.oldValue, newValue: newVal, action: 'Update', user: who });
    stampTx_(def, sh, r, e, now, who);
  } catch (err) { /* never block the user's edit */ }
}

function stampTx_(def, sh, r, e, now, who) {
  if (def.key !== 'TX' || r.getNumRows() > 1 || r.getNumColumns() > 1) return;
  const c = def.columns[r.getColumn() - 1];
  if (!c || c.key === 'updatedAt' || c.key === 'updatedBy' || c.key === 'deletedAt') return;
  const row = r.getRow();
  sh.getRange(row, colIndex_(def, 'updatedAt')).setValue(now);
  if (who) sh.getRange(row, colIndex_(def, 'updatedBy')).setValue(who);
  if (c.key === 'isDeleted') {
    const v = String(e.value === undefined ? r.getValue() : e.value).toUpperCase();
    sh.getRange(row, colIndex_(def, 'deletedAt')).setValue(v === 'TRUE' ? now : '');
  }
}

/* ---------- maintenance helpers ---------- */

/** Detect how far formulas currently extend (the sheet may have grown/shrunk since the build). */
function syncLastRow_(def) {
  const sh = getOrCreateSheet_(def.sheet);
  const fcol = def.columns.findIndex(c => c.f);
  if (fcol < 0) { def.lastRow = Math.max(def.lastRow, sh.getLastRow()); return def.lastRow; }
  const maxR = sh.getMaxRows();
  const formulas = sh.getRange(def.firstRow, fcol + 1, maxR - def.firstRow + 1, 1).getFormulas();
  let last = def.firstRow - 1;
  for (let i = formulas.length - 1; i >= 0; i--) if (formulas[i][0]) { last = def.firstRow + i; break; }
  def.lastRow = Math.max(last, def.firstRow);
  return def.lastRow;
}

function extendFormulaRows() {
  let n = 0;
  BUILD_ORDER.forEach(key => {
    const def = tdef_(key);
    syncLastRow_(def);
    extendTable_(def, def.lastRow + 500);
    n++;
  });
  alert_('Extend formula rows', 'Added 500 calculated rows to ' + n + ' tables.');
}

/** Fill Source Income ID on Income-type transactions that match exactly one paycheck. */
function linkIncomeDeposits() {
  const txDef = tdef_('TX'), incDef = tdef_('INCOME');
  const tx = readTable_(txDef);
  const inc = readTable_(incDef);
  const used = {};
  tx.forEach(t => { if (t.sourceIncomeId && t.isDeleted !== true) used[t.sourceIncomeId] = true; });
  const sh = getOrCreateSheet_(txDef.sheet);
  const col = colIndex_(txDef, 'sourceIncomeId');
  let linked = 0, ambiguous = 0, none = 0;
  const details = [];
  tx.filter(t => t.type === 'Income' && !t.sourceIncomeId && t.isDeleted !== true && t.date instanceof Date).forEach(t => {
    const cands = inc.filter(i => !used[i.id] && i.payDate instanceof Date
      && Math.abs(Number(i.takeHome) - Number(t.amount)) <= 0.01
      && Math.abs((i.payDate - t.date) / 86400000) <= 5
      && (!t.accountId || !i.depositAccount || i.depositAccount === t.accountId));
    if (cands.length === 1) {
      sh.getRange(t.__row, col).setValue(cands[0].id);
      used[cands[0].id] = true;
      linked++;
      details.push(t.id + ' → ' + cands[0].id);
      if (changeLogEnabled_()) appendChangeLog_({ table: 'TX', recordId: t.id, field: 'Source Income ID', oldValue: '', newValue: cands[0].id, action: 'Update', notes: 'linkIncomeDeposits' });
    } else if (cands.length > 1) ambiguous++; else none++;
  });
  alert_('Link income deposits', linked + ' deposit(s) linked.\n' + ambiguous + ' had more than one matching paycheck (link by hand).\n' + none + ' had no matching paycheck within 5 days.' + (details.length ? '\n\n' + details.slice(0, 20).join('\n') : ''));
}

/** Guided split: turn one bank transaction into a Split Parent with balanced children. */
function splitTransactionPrompt() {
  const ui = ui_();
  if (!ui) throw new Error('splitTransactionPrompt needs the Sheets UI.');
  const def = tdef_('TX');
  const sh = getOrCreateSheet_(def.sheet);
  const p1 = ui.prompt('Split a transaction', 'Transaction ID of the original bank transaction (e.g. TX-000123):', ui.ButtonSet.OK_CANCEL);
  if (p1.getSelectedButton() !== ui.Button.OK) return;
  const parentId = p1.getResponseText().trim();
  const row = findRowById_(def, parentId);
  if (row < 0) { ui.alert('Not found', 'No transaction with ID ' + parentId, ui.ButtonSet.OK); return; }
  const parent = {};
  const vals = sh.getRange(row, 1, 1, def.columns.length).getValues()[0];
  def.columns.forEach((c, i) => { parent[c.key] = vals[i]; });
  const p2 = ui.prompt('Child lines for ' + parentId + ' (' + Number(parent.amount).toFixed(2) + ')',
    'One child per line:  amount | Category | Subcategory | Spending Type (optional, default Flexible)\n\nExample:\n62.50 | Food | Groceries\n48 | Child Expenses | Supplies\n32 | Personal | Personal Care',
    ui.ButtonSet.OK_CANCEL);
  if (p2.getSelectedButton() !== ui.Button.OK) return;
  const lines = p2.getResponseText().split('\n').map(s => s.trim()).filter(Boolean);
  if (!lines.length) return;
  const children = [];
  let sum = 0;
  for (let i = 0; i < lines.length; i++) {
    const parts = lines[i].split('|').map(s => s.trim());
    const amt = parseFloat(parts[0]);
    if (isNaN(amt) || !parts[1] || !parts[2]) { ui.alert('Could not read line ' + (i + 1), lines[i], ui.ButtonSet.OK); return; }
    let defaults = { needWant: '', fixedVariable: '', spendingType: 'Flexible' };
    try { defaults = taxonomyDefaults_(parts[1], parts[2]); } catch (e) { /* unknown pair: validation flag will show it */ }
    sum += amt;
    children.push({
      date: parent.date, description: String(parent.description) + ' — ' + parts[2], amount: amt, type: 'Expense',
      category: parts[1], subcategory: parts[2], accountId: parent.accountId, person: parent.person, hhPersonal: parent.hhPersonal,
      needWant: defaults.needWant, fixedVariable: defaults.fixedVariable, status: parent.status || 'Posted',
      notes: 'Split child of ' + parentId, createdAt: new Date(), createdBy: userEmail_() || 'split-helper',
      spendingType: parts[3] || defaults.spendingType || 'Flexible', fundingSource: parent.fundingSource || 'Monthly Cash Flow',
      splitRole: 'Child', parentTxId: parentId, receiptRef: parent.receiptRef,
    });
  }
  const diff = Number(parent.amount) - sum;
  if (Math.abs(diff) > 0.01) {
    const go = ui.alert('Children do not balance', 'Children total ' + sum.toFixed(2) + ' vs parent ' + Number(parent.amount).toFixed(2) + ' (difference ' + diff.toFixed(2) + ').\n\nCreate anyway? The parent will show "Split Does Not Balance" until fixed.', ui.ButtonSet.YES_NO);
    if (go !== ui.Button.YES) return;
  }
  syncLastRow_(def);
  let nextNum = parseInt(nextId_(def, 6).split('-')[1], 10);
  children.forEach(c => { c.id = 'TX-' + String(nextNum++).padStart(6, '0'); });
  writeRows_(def, children);
  sh.getRange(row, colIndex_(def, 'type')).setValue('Split Parent');
  sh.getRange(row, colIndex_(def, 'splitRole')).setValue('Parent');
  sh.getRange(row, colIndex_(def, 'updatedAt')).setValue(new Date());
  if (changeLogEnabled_()) {
    appendChangeLog_({ table: 'TX', recordId: parentId, field: 'Type', oldValue: parent.type, newValue: 'Split Parent', action: 'Split', notes: children.length + ' children: ' + children.map(c => c.id).join(', ') });
  }
  ui.alert('Split created', children.length + ' child rows added under ' + parentId + '. Difference: ' + diff.toFixed(2), ui.ButtonSet.OK);
}

/** Append (or refresh) this month's Net Worth Snapshot from Accounts + Debts. */
function recordNetWorthSnapshot() {
  const accounts = readTable_(tdef_('ACCOUNTS')).filter(a => a.includeNW === 'Yes' && a.accountType !== 'Pension'); // a pension has no balance
  const debts = readTable_(tdef_('DEBTS'));
  const linked = {};
  debts.forEach(d => { if (d.linkedAccount) linked[d.linkedAccount] = true; });
  const sumType = (types) => accounts.filter(a => types.indexOf(a.accountType) >= 0).reduce((s, a) => s + Number(a.currentBalance || 0), 0);
  const unlinkedCC = accounts.filter(a => a.accountType === 'Credit Card' && !linked[a.id]).reduce((s, a) => s + Number(a.currentBalance || 0), 0);
  const unlinkedLoans = accounts.filter(a => a.accountType === 'Loan' && !linked[a.id]).reduce((s, a) => s + Number(a.currentBalance || 0), 0);
  const debtTotal = debts.reduce((s, d) => s + Number(d.latestBalance || 0), 0);
  const snap = {
    month: monthStart_(new Date()),
    cash: sumType(['Checking', 'Cash']),
    savings: sumType(['Savings', 'HSA']),
    retirement: sumType(['Retirement']),
    investments: sumType(['Investment']),
    property: sumType(['Property', 'Vehicle', 'Other']),
    otherDeprecated: '',
    totalDebt: unlinkedCC + unlinkedLoans + debtTotal,
    notes: 'Recorded ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd') + ' from Accounts + Debts' + (unlinkedLoans ? ' (includes ' + unlinkedLoans.toFixed(2) + ' of Loan-type accounts not in Debts)' : ''),
  };
  const def = tdef_('NW');
  const existing = readTable_(def).filter(r => r.month instanceof Date && r.month.getTime() === snap.month.getTime())[0];
  const ui = ui_();
  if (existing) {
    if (ui && ui.alert('Snapshot exists', 'A snapshot for this month already exists. Overwrite it?', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
    writeRows_(def, [snap], existing.__row);
  } else {
    syncLastRow_(def);
    writeRows_(def, [snap]);
  }
  const nw = snap.cash + snap.savings + snap.retirement + snap.investments + snap.property - snap.totalDebt;
  alert_('Net worth snapshot recorded', 'Assets ' + (nw + snap.totalDebt).toFixed(2) + ' − debt ' + snap.totalDebt.toFixed(2) + ' = ' + nw.toFixed(2));
}

/** Remove every row tagged SAMPLE once real data is ready. */
function clearSampleData() {
  const ui = ui_();
  if (ui && ui.alert('Clear sample data', 'Delete every row whose Notes start with "SAMPLE" (and sample accounts ACC-001…ACC-005)? Real rows are kept.', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  const removed = {};
  SAMPLE_TABLES.forEach(key => {
    const def = tdef_(key);
    syncLastRow_(def);
    const sh = getOrCreateSheet_(def.sheet);
    const rows = readTable_(def).filter(r => isSampleRow_(def, r)).map(r => r.__row).sort((a, b) => b - a);
    if (!rows.length) return;
    // delete contiguous blocks from the bottom up
    let i = 0;
    while (i < rows.length) {
      let j = i;
      while (j + 1 < rows.length && rows[j + 1] === rows[j] - 1) j++;
      sh.deleteRows(rows[j], j - i + 1); // SAFETY-APPROVED: clearSampleData removes only rows tagged SAMPLE, after the owner confirms
      i = j + 1;
    }
    // restore the formula/format rows that moved off the end
    const k = rows.length;
    sh.insertRowsAfter(sh.getMaxRows(), k);
    applyColumnRules_(def, def.lastRow - k + 1, def.lastRow);
    setNamedRange_('TBL_' + def.key, sh.getRange(def.headerRow, 1, def.lastRow - def.headerRow + 1, def.columns.length));
    if (CF_BUILDERS[def.key]) CF_BUILDERS[def.key](sh, def);
    if (def.key === 'NW') buildNetWorthHelper_(sh, def); // deleting rows took the live net-worth box with them; redraw it
    removed[def.sheet] = k;
  });
  const flag = ss_().getRangeByName('SETTING_SAMPLE_PRESENT');
  if (flag) flag.setValue(false);
  buildStartHere_(false);
  const lines = Object.keys(removed).map(s => s + ': ' + removed[s] + ' row(s)');
  alert_('Sample data cleared', lines.length ? lines.join('\n') : 'No sample rows found.');
}

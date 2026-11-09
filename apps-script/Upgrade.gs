/**
 * Household Finance Tracker — Upgrade.gs
 * upgradeWorkbook(): brings a live workbook up to the current schema WITHOUT
 * touching entered rows. Adds missing tabs, missing columns (appended after
 * the existing ones, exactly where Config.gs puts them), missing dropdown
 * lists, refreshes formulas/validations/conditional formatting and the
 * documentation tabs. Safe to run more than once. Never deletes.
 *
 * A header that exists but differs from the schema stops the upgrade before
 * anything is written, with a message naming the column.
 */

function upgradeWorkbook() {
  const ui = ui_();
  if (ui) {
    const a = ui.alert('Upgrade workbook', 'This adds any new tabs, columns and lists the current script expects, and refreshes formulas, dropdowns and the documentation tabs. Entered rows are not changed. Continue?', ui.ButtonSet.YES_NO);
    if (a !== ui.Button.YES) return;
  }
  const report = upgradeWorkbook_();
  alert_('Upgrade complete', report.join('\n'));
  return report;
}

function upgradeWorkbook_() {
  // One upgrade at a time: a second copy started while the first is still
  // running would try to create tabs the first one has just made.
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(3000)) throw new Error('An upgrade is already running. Wait for the "Running script" banner to disappear, then run Upgrade workbook once.');
  try {
    return upgradeWorkbookLocked_();
  } finally {
    lock.releaseLock();
  }
}

function upgradeWorkbookLocked_() {
  const ss = ss_();
  const report = [];
  // 1. dry pass: every existing header must match the schema
  const conflicts = [];
  BUILD_ORDER.forEach(key => {
    const def = tdef_(key);
    const sh = ss.getSheetByName(def.sheet);
    if (!sh) return;
    const width = Math.min(def.columns.length, sh.getMaxColumns());
    const hdr = sh.getRange(def.headerRow, 1, 1, width).getValues()[0];
    def.columns.forEach((c, i) => {
      if (i >= width) return;
      if (hdr[i] !== '' && hdr[i] !== c.h && hdr[i] !== c.renamedFrom) conflicts.push(def.sheet + ' column ' + colLetter_(i + 1) + ': expected "' + c.h + '", found "' + hdr[i] + '"');
    });
  });
  if (conflicts.length) throw new Error('Upgrade stopped before changing anything. These headers differ from the schema:\n' + conflicts.join('\n') + '\nRestore the header text (or tell me which change was intended) and run the upgrade again.');

  // 2. reference lists first (dropdowns depend on them)
  report.push(...withRetry_('reference lists', () => upgradeLists_()));
  report.push(...withRetry_('Categories', () => ensureCategories_()));
  SpreadsheetApp.flush();

  // 3. tables, one at a time, letting the Sheet recalculate between them
  BUILD_ORDER.forEach(key => {
    toast_('Upgrading ' + tdef_(key).sheet + '…', 'Upgrade workbook');
    withRetry_(tdef_(key).sheet, () => upgradeTable_(key, report));
    SpreadsheetApp.flush();
  });

  // 4. documentation + dashboard tabs (rebuilt; settings and inputs preserved)
  const settings = readSettings_();
  withRetry_('App Setup', () => { buildAppSetup_(settings.samplePresent); restoreSettings_(settings); });
  const goals = readGoals_(); // wherever they are now: the Goals tab, or the Dashboard panel of an older build
  const dash = readDashboardInputs_();
  withRetry_('Debts pause labels', () => refreshDebtPauseFormats_());
  const exp = withRetry_('Expected Income rows', () => ensureExpectedIncome_());
  const fnd = withRetry_('Savings & Reserves rows', () => ensureFunds_());
  if (fnd && fnd.created) report.push('Savings & Reserves: ' + fnd.created + ' fund row(s) created from savings, investment, retirement and HSA accounts');
  if (exp && exp.created) report.push('Expected Income: ' + exp.created + ' row(s) created from the paychecks on Income');
  withRetry_('Dashboard', () => { buildDashboard_(); restoreDashboardInputs_(dash); });
  const fsMonths = (ss.getRangeByName('FINSUM_MONTHS') || { getValue: () => '' }).getValue();
  withRetry_('Financial Summary', () => { buildFinancialSummary_(); if (Number(fsMonths) >= 1) ss.getRangeByName('FINSUM_MONTHS').setValue(Number(fsMonths)); });
  withRetry_('Goals', () => { buildGoals_(); restoreGoals_(goals); });
  if (!ss.getSheetByName(SHEETS.PASTE)) { withRetry_('Paste Import', () => buildPasteImport_()); report.push('Added tab: ' + SHEETS.PASTE); }
  withRetry_('Reminders', () => buildReminders_());
  withRetry_('Start Here', () => buildStartHere_(settings.samplePresent));
  withRetry_('Sources', () => buildSources_());
  report.push('Refreshed App Setup, Dashboard, Start Here and Sources (settings kept).');

  // 5. tab order
  TAB_ORDER.forEach((name, i) => { const sh = ss.getSheetByName(name); if (sh) { ss.setActiveSheet(sh); ss.moveActiveSheet(i + 1); } });
  ss.setActiveSheet(ss.getSheetByName(SHEETS.DASH));
  SpreadsheetApp.flush();
  report.unshift('Schema ' + HFT.SCHEMA_VERSION + ' · script ' + HFT.BUILD_VERSION);
  return report;
}

/** Run fn; if the Spreadsheet service times out, wait and try again (up to 3 attempts). */
function withRetry_(label, fn) {
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try { return fn(); } catch (e) {
      lastErr = e;
      const msg = String(e && e.message || e);
      if (!/timed out|Service error|Internal error|Too many simultaneous/i.test(msg)) throw e;
      Logger.log('Retrying ' + label + ' after: ' + msg);
      SpreadsheetApp.flush();
      Utilities.sleep(2000 * attempt);
    }
  }
  throw new Error(label + ' kept timing out (' + String(lastErr && lastErr.message || lastErr) + '). Reload the Sheet, wait a minute, and run Upgrade workbook again; it continues where it stopped.');
}

/** Upgrade one table in place (idempotent). */
function upgradeTable_(key, report) {
  const ss = ss_();
  {
    const def = tdef_(key);
    let sh = ss.getSheetByName(def.sheet);
    // A sheet created empty by a dropdown reference (idsRange_) counts as new.
    if (sh && sh.getRange(def.headerRow, 1).getValue() === '' && sh.getLastRow() === 0) { sh = null; }
    if (!sh) {
      sh = buildTableSheet_(def); // getOrCreateSheet_ reuses an existing tab of that name; it never duplicates
      if (CF_BUILDERS[key]) CF_BUILDERS[key](sh, def);
      report.push('Added tab: ' + def.sheet);
      return;
    }
    syncLastRow_(def);
    const needCols = def.columns.length;
    if (sh.getMaxColumns() < needCols) sh.insertColumnsAfter(sh.getMaxColumns(), needCols - sh.getMaxColumns());
    const hdr = sh.getRange(def.headerRow, 1, 1, needCols).getValues()[0];
    const addedCols = [];
    def.columns.forEach((c, i) => {
      if (hdr[i] === c.h) return;
      const col = i + 1;
      const renamed = hdr[i] !== '' && hdr[i] === c.renamedFrom;
      sh.getRange(def.headerRow, col).setValue(c.h);
      if (c.w) sh.setColumnWidth(col, c.w);
      addedCols.push(renamed ? c.h + ' (renamed from "' + c.renamedFrom + '")' : c.h);
    });
    styleHeader_(sh.getRange(def.headerRow, 1, 1, needCols));
    // Full rules only for new columns; existing columns get a formula rewrite only when the template changed.
    const changedFormulas = upgradeColumnRules_(def, sh, hdr);
    if (changedFormulas.length) report.push(def.sheet + ': updated formula(s) ' + changedFormulas.join(', '));
    setNamedRange_('TBL_' + def.key, sh.getRange(def.headerRow, 1, def.lastRow - def.headerRow + 1, needCols));
    if (CF_BUILDERS[key]) CF_BUILDERS[key](sh, def);
    if (addedCols.length) report.push(def.sheet + ': added column(s) ' + addedCols.join(', '));
    // Presentation strips hold no entered data, so they are simply redrawn to the current design.
    if (key === 'DEBTS') buildDebtsTop_(sh, def);
    if (key === 'RECUR') buildRecurringTop_(sh, def);
    if (key === 'NW') buildNetWorthHelper_(sh, def);
  }
}

/**
 * Apply formats, validations and formulas only where needed:
 *  - a column whose header was missing (new, or renamed) gets everything for every row;
 *  - an existing calculated column is rewritten only if its first-row formula differs from the template;
 *  - an existing input column is left alone (one validation check, no rewrite).
 * Keeps the upgrade well inside the 6-minute limit on a full workbook.
 */
function upgradeColumnRules_(def, sh, hdrBefore) {
  const n = def.lastRow - def.firstRow + 1;
  const changed = [];
  def.columns.forEach((c, i) => {
    const col = i + 1;
    const isNew = hdrBefore[i] !== c.h;
    const rng = sh.getRange(def.firstRow, col, n, 1);
    if (isNew) {
      if (c.fmt) setFormat_(rng, c.fmt);
      if (c.v) { const dv = buildValidation_(c.v); if (dv) rng.setDataValidation(dv); }
      if (c.f) {
        const formulas = [];
        for (let r = def.firstRow; r <= def.lastRow; r++) formulas.push([resolveFormula_(c.f, def, r)]);
        rng.setFormulas(formulas);
        rng.setBackground('#FAFBFC');
      }
      if (c.arrayFormula) { sh.getRange(def.firstRow, col).setFormula(resolveFormula_(c.arrayFormula, def, def.firstRow)); rng.setBackground('#FAFBFC'); }
      rng.setFontColor(COLORS.TEXT).setFontSize(10).setVerticalAlignment('middle');
      return;
    }
    if (c.f) {
      const want = resolveFormula_(c.f, def, def.firstRow);
      if (!sameFormula_(sh.getRange(def.firstRow, col).getFormula(), want)) {
        const formulas = [];
        for (let r = def.firstRow; r <= def.lastRow; r++) formulas.push([resolveFormula_(c.f, def, r)]);
        rng.setFormulas(formulas);
        changed.push(c.h);
      }
    } else if (c.arrayFormula) {
      const want = resolveFormula_(c.arrayFormula, def, def.firstRow);
      if (!sameFormula_(sh.getRange(def.firstRow, col).getFormula(), want)) { sh.getRange(def.firstRow, col).setFormula(want); changed.push(c.h); }
    } else if (c.v && !sh.getRange(def.firstRow, col).getDataValidation()) {
      const dv = buildValidation_(c.v); if (dv) rng.setDataValidation(dv);
    }
  });
  return changed;
}

/**
 * Google rewrites a stored formula slightly: quotes around one-word tab names are dropped
 * ('Income'!$C$5 becomes Income!$C$5). Compare formulas with that normalized away so an
 * unchanged formula is not rewritten on every upgrade.
 */
function normalizeFormula_(f) {
  return String(f || '').replace(/'([A-Za-z0-9_]+)'!/g, '$1!').replace(/\s+/g, ' ').trim();
}
function sameFormula_(a, b) { return normalizeFormula_(a) === normalizeFormula_(b); }

/** Add any dropdown list that has no named range yet (new lists go after the existing ones). */
function upgradeLists_() {
  const ss = ss_();
  const def = tdef_('CATS');
  const sh = ss.getSheetByName(def.sheet);
  const report = [];
  if (!sh) return report;
  const listSpan = LIST_LAST_ROW - LIST_FIRST_ROW + 1;
  const nextFreeCol = () => {
    let col = LIST_FIRST_COL;
    while (col <= sh.getMaxColumns() && sh.getRange(4, col).getValue() !== '') col++;
    if (col > sh.getMaxColumns()) sh.insertColumnsAfter(sh.getMaxColumns(), col - sh.getMaxColumns() + 2);
    return col;
  };
  LISTS.forEach(list => {
    const existing = ss.getRangeByName('LIST_' + list.key);
    if (existing) {
      // append any new values the schema added to an existing list
      const current = existing.getValues().map(r => r[0]).filter(v => v !== '');
      const missing = list.values.filter(v => current.indexOf(v) < 0);
      if (missing.length && current.length + missing.length <= listSpan) {
        existing.getSheet().getRange(existing.getRow() + current.length, existing.getColumn(), missing.length, 1).setValues(missing.map(v => [v]));
        report.push('List ' + list.header + ': added ' + missing.join(', '));
      }
      return;
    }
    const col = nextFreeCol();
    sh.getRange(4, col).setValue(list.header).setBackground(COLORS.TEAL).setFontColor(COLORS.WHITE).setFontWeight('bold').setWrap(true);
    sh.getRange(LIST_FIRST_ROW, col, list.values.length, 1).setValues(list.values.map(v => [v]));
    sh.setColumnWidth(col, 150);
    setNamedRange_('LIST_' + list.key, sh.getRange(LIST_FIRST_ROW, col, listSpan, 1));
    report.push('Added list: ' + list.header);
  });
  DERIVED_LISTS.forEach(list => {
    if (ss.getRangeByName('LIST_' + list.key)) return;
    const col = nextFreeCol();
    sh.getRange(4, col).setValue(list.header).setBackground(COLORS.NAVY).setFontColor(COLORS.WHITE).setFontWeight('bold').setWrap(true);
    sh.getRange(LIST_FIRST_ROW, col).setFormula(list.formula);
    sh.setColumnWidth(col, 170);
    setNamedRange_('LIST_' + list.key, sh.getRange(LIST_FIRST_ROW, col, listSpan, 1));
    report.push('Added list: ' + list.header);
  });
  return report;
}

function readSettings_() {
  const ss = ss_();
  const get = (name, dflt) => { const r = ss.getRangeByName(name); return r ? r.getValue() : dflt; };
  return {
    changeLog: get('SETTING_CHANGE_LOG', true),
    samplePresent: get('SETTING_SAMPLE_PRESENT', false) === true,
    autoPairs: get('SETTING_AUTO_PAIRS', true),
    pslfMonths: get('SETTING_PSLF_REMINDER_MONTHS', 12),
    creditMonths: get('SETTING_CREDIT_REMINDER_MONTHS', 3),
    reminderEmail: get('SETTING_REMINDER_EMAIL', true),
    qaRun: get('QA_LAST_RUN', ''),
    qaResult: get('QA_LAST_RESULT', ''),
  };
}

function restoreSettings_(s) {
  const ss = ss_();
  const set = (name, v) => { const r = ss.getRangeByName(name); if (r && v !== undefined && v !== '') r.setValue(v); };
  set('SETTING_CHANGE_LOG', s.changeLog);
  set('SETTING_SAMPLE_PRESENT', s.samplePresent);
  set('SETTING_AUTO_PAIRS', s.autoPairs);
  set('SETTING_PSLF_REMINDER_MONTHS', s.pslfMonths);
  set('SETTING_CREDIT_REMINDER_MONTHS', s.creditMonths);
  set('SETTING_REMINDER_EMAIL', s.reminderEmail);
  set('QA_LAST_RUN', s.qaRun);
  set('QA_LAST_RESULT', s.qaResult);
}

function readDashboardInputs_() {
  const sh = ss_().getSheetByName(SHEETS.DASH);
  if (!sh) return null;
  // named ranges when the current layout built them; otherwise the addresses of the older layout
  const ss = ss_();
  const monthRange = ss.getRangeByName('DASH_SELECTED_MONTH') || sh.getRange(DASH.LEGACY_SELECTED_MONTH);
  const checksRange = ss.getRangeByName('DASH_CHECKLIST') || sh.getRange('G' + DASH.LEGACY_FUNDS_FIRST + ':G' + (DASH.LEGACY_FUNDS_FIRST + DASH.CHECK_COUNT - 1));
  return { month: monthRange.getValue(), checks: checksRange.getValues() };
}

/** The goal texts by their named ranges (GOAL_1…), from whichever tab holds them. */
function readGoals_() {
  const ss = ss_();
  const goals = [];
  for (let n = 1; n <= GOALS.COUNT; n++) { const r = ss.getRangeByName('GOAL_' + n); goals.push(r ? r.getValue() : ''); }
  return goals;
}

function restoreGoals_(goals) {
  const ss = ss_();
  (goals || []).forEach((g, i) => { if (g !== '' && g !== null && g !== undefined) { const r = ss.getRangeByName('GOAL_' + (i + 1)); if (r) r.setValue(g); } });
}

function restoreDashboardInputs_(d) {
  if (!d) return;
  const sh = ss_().getSheetByName(SHEETS.DASH);
  if (d.month instanceof Date) sh.getRange(DASH.SELECTED_MONTH).setValue(d.month);
  if (d.checks) { const r = ss_().getRangeByName('DASH_CHECKLIST'); if (r && r.getNumRows() === d.checks.length) r.setValues(d.checks.map(x => [x[0] === true])); }
}

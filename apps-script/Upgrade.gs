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
  report.push(...upgradeLists_());

  // 3. tables
  BUILD_ORDER.forEach(key => {
    const def = tdef_(key);
    let sh = ss.getSheetByName(def.sheet);
    // A sheet created empty by a dropdown reference (idsRange_) counts as new.
    if (sh && sh.getRange(def.headerRow, 1).getValue() === '' && sh.getLastRow() === 0) { sh = null; }
    if (!sh) {
      sh = buildTableSheet_(def);
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
    // formulas, formats and validations for every row, including the new columns (idempotent)
    applyColumnRules_(def, def.firstRow, def.lastRow);
    setNamedRange_('TBL_' + def.key, sh.getRange(def.headerRow, 1, def.lastRow - def.headerRow + 1, needCols));
    if (CF_BUILDERS[key]) CF_BUILDERS[key](sh, def);
    if (addedCols.length) report.push(def.sheet + ': added column(s) ' + addedCols.join(', '));
  });

  // 4. documentation + dashboard tabs (rebuilt; settings and inputs preserved)
  const settings = readSettings_();
  buildAppSetup_(settings.samplePresent);
  restoreSettings_(settings);
  const dash = readDashboardInputs_();
  buildDashboard_();
  restoreDashboardInputs_(dash);
  buildStartHere_(settings.samplePresent);
  buildSources_();
  report.push('Refreshed App Setup, Dashboard, Start Here and Sources (settings kept).');

  // 5. tab order
  TAB_ORDER.forEach((name, i) => { const sh = ss.getSheetByName(name); if (sh) { ss.setActiveSheet(sh); ss.moveActiveSheet(i + 1); } });
  ss.setActiveSheet(ss.getSheetByName(SHEETS.DASH));
  SpreadsheetApp.flush();
  report.unshift('Schema ' + HFT.SCHEMA_VERSION + ' · script ' + HFT.BUILD_VERSION);
  return report;
}

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
  set('QA_LAST_RUN', s.qaRun);
  set('QA_LAST_RESULT', s.qaResult);
}

function readDashboardInputs_() {
  const sh = ss_().getSheetByName(SHEETS.DASH);
  if (!sh) return null;
  return {
    month: sh.getRange(DASH.SELECTED_MONTH).getValue(),
    checks: sh.getRange('G' + DASH.FUNDS_FIRST + ':G' + (DASH.FUNDS_FIRST + DASH.FUNDS_COUNT - 1)).getValues(),
  };
}

function restoreDashboardInputs_(d) {
  if (!d) return;
  const sh = ss_().getSheetByName(SHEETS.DASH);
  if (d.month instanceof Date) sh.getRange(DASH.SELECTED_MONTH).setValue(d.month);
  if (d.checks) sh.getRange('G' + DASH.FUNDS_FIRST + ':G' + (DASH.FUNDS_FIRST + DASH.FUNDS_COUNT - 1)).setValues(d.checks.map(r => [r[0] === true]));
}

/**
 * Paste Import: a scratch tab where the owner pastes a block that a Claude skill produced from
 * photos (pay stubs first; receipts and schedules later), and a menu action that turns the block
 * into rows of the right table with IDs, formulas, change-log entries and a duplicate check.
 *
 * Block layout (tab-separated, pasted at A5):
 *   HFT-IMPORT  v1  INCOME            ← marker, format version, table key
 *   payDate  person  employer  ...    ← column keys or the exact header text
 *   2026-11-07  Ben  ...              ← one row per record; dates yyyy-mm-dd; money as plain numbers
 * Formula columns are ignored. For INCOME an extra column stubTakeHome (the net pay printed on
 * the stub) is checked against gross − deductions and noted when it differs.
 */

function buildPasteImport_() {
  const sh = getOrCreateSheet_(SHEETS.PASTE);
  sh.clear(); // SAFETY-APPROVED: Paste Import is a scratch tab (the pasted block is a copy of what Claude produced); rebuilt by buildWorkbook, left alone by the upgrade when it exists
  sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).breakApart();
  sh.getProtections(SpreadsheetApp.ProtectionType.SHEET).forEach(p => p.remove());
  ensureSheetSize_(sh, 300, 26);
  styleTitleRow_(sh, 1, 'Paste Import — Rows from Photos', 12);
  styleNoteRow_(sh, 2, 'The usual way is Finance Tracker → Import from Claude (paste)…, which opens a window. This tab is the fallback: paste the block into cell A5 (the first line starts with HFT-IMPORT), then run Finance Tracker → Import the Paste Import tab. Rows go to the right table with IDs; a block pasted twice adds nothing.', 12);
  sh.getRange(3, 1).setValue('Last import').setFontWeight('bold');
  sh.getRange(3, 2, 1, 11).mergeAcross();
  setNamedRange_('PASTE_STATUS', sh.getRange(3, 2));
  sh.getRange(4, 1).setValue('Paste at A5 ↓').setFontColor(COLORS.MUTED_TEXT).setFontStyle('italic');
  sh.setColumnWidth(1, 130);
  for (let c = 2; c <= 26; c++) sh.setColumnWidth(c, 120);
  sh.setFrozenRows(4);
}

/** Finance Tracker → Import from Claude (paste)…: a window to paste the block into. */
function showPasteImportDialog() {
  const html = HtmlService.createHtmlOutputFromFile('PasteImportDialog').setWidth(640).setHeight(560);
  ui_().showModalDialog(html, 'Import from Claude');
}

/** Dialog step 1: what the pasted text would add (nothing is written). */
function previewPastedText(text) {
  return importGrid_(parsePastedText_(text), { dryRun: true });
}

/** Dialog step 2: write it. */
function importPastedText(text) {
  return importGrid_(parsePastedText_(text), {});
}

/** Finance Tracker → Import the Paste Import tab (the block pasted at A5). */
function importPastedRows() {
  const res = importPastedRows_({ confirm: true });
  if (res && res.message) alert_('Import pasted rows', res.message);
  return res;
}

/** The block as typed or pasted: lines of tab-separated cells (a comma-separated block is accepted when no tabs are present). */
function parsePastedText_(text) {
  const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n').filter(l => l.trim() !== '');
  const sep = lines.some(l => l.indexOf('\t') >= 0) ? '\t' : ',';
  const grid = lines.map(l => l.split(sep).map(c => c.trim()));
  const width = grid.reduce((m, r) => Math.max(m, r.length), 3);
  return grid.map(r => { while (r.length < width) r.push(''); return r; });
}

/** Reads the block from the Paste Import tab and imports it (opts.confirm shows the YES/NO summary). */
function importPastedRows_(opts) {
  opts = opts || {};
  const sh = ss_().getSheetByName(SHEETS.PASTE);
  if (!sh) return { status: 'error', message: 'The Paste Import tab is missing. Run Upgrade workbook first.' };
  const last = sh.getLastRow(), lastCol = Math.max(sh.getLastColumn(), 3);
  if (last < PASTE_IMPORT.firstRow + 2) return { status: 'nothing', message: 'Nothing to import: paste the block from Claude into A5 first.' };
  const grid = sh.getRange(PASTE_IMPORT.firstRow, 1, last - PASTE_IMPORT.firstRow + 1, lastCol).getValues();
  return importGrid_(grid, opts);
}

/**
 * The import itself, from a grid of cells (first row the marker line, second the headers).
 * opts.dryRun returns the summary without writing; opts.confirm asks YES/NO in the Sheet first.
 * Returns { status: 'imported' | 'preview' | 'nothing' | 'cancelled' | 'error', table, imported, skipped, warnings, message }.
 */
function importGrid_(grid, opts) {
  opts = opts || {};
  if (!grid || grid.length < 3) return { status: 'nothing', message: 'Nothing to import: the block needs the HFT-IMPORT line, a header line and at least one row.' };
  const head = grid[0].map(v => String(v === null || v === undefined ? '' : v).trim());
  if (head[0] !== PASTE_IMPORT.marker) return { status: 'error', message: 'The block must start with ' + PASTE_IMPORT.marker + '. Paste exactly what Claude produced (the whole code block).' };
  if (head[1] !== PASTE_IMPORT.version) return { status: 'error', message: 'This block is format ' + head[1] + '; the Sheet understands ' + PASTE_IMPORT.version + '. Ask for a current block.' };
  const key = head[2].toUpperCase();
  const spec = PASTE_IMPORT.tables[key];
  if (!spec || !TABLES[key]) return { status: 'error', message: 'Unknown table "' + head[2] + '". Tables that accept pasted rows: ' + Object.keys(PASTE_IMPORT.tables).join(', ') + '.' };
  const def = tdef_(key);
  const hash = pasteHash_(grid);
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('PASTE_LAST_HASH') === hash) return { status: 'nothing', table: key, message: 'This exact block was already imported (' + (props.getProperty('PASTE_LAST_WHEN') || '') + '). Paste a new block to import more.' };

  // headers → column keys
  const byHeader = {}; def.columns.forEach(c => { byHeader[c.h.toLowerCase()] = c; byHeader[c.key.toLowerCase()] = c; });
  const extras = spec.extras || [];
  const headers = grid[1].map(v => String(v === null || v === undefined ? '' : v).trim());
  const map = [];
  const unknown = [], formulaCols = [];
  headers.forEach((h, i) => {
    if (!h) { map.push(null); return; }
    const c = byHeader[h.toLowerCase()];
    if (c) { if (c.f || c.arrayFormula) { formulaCols.push(c.h); map.push(null); } else map.push({ key: c.key, col: c }); }
    else if (extras.indexOf(h) >= 0) map.push({ key: h, extra: true });
    else { unknown.push(h); map.push(null); }
  });
  if (unknown.length) return { status: 'error', table: key, message: 'These column names are not in ' + def.sheet + ': ' + unknown.join(', ') + '. Use the column keys or the exact header text.' };
  if (!map.some(m => m && !m.extra)) return { status: 'error', table: key, message: 'No usable columns in the header line.' };

  // rows
  const lists = {}; LISTS.forEach(l => { lists[l.key] = l.values; });
  const warnings = [];
  const parsed = [];
  for (let r = 2; r < grid.length; r++) {
    const raw = grid[r];
    if (raw.every(v => v === '' || v === null || v === undefined)) continue;
    const row = {}, extra = {};
    let problems = [];
    map.forEach((m, i) => {
      if (!m) return;
      const v = raw[i];
      if (m.extra) { extra[m.key] = parseNumber_(v); return; }
      const c = m.col;
      if (v === '' || v === null || v === undefined) return;
      if (c.fmt === 'date' || c.fmt === 'month' || c.fmt === 'datetime' || (c.v && c.v.date)) { const d = parseDate_(v); if (d) row[c.key] = d; else problems.push(c.h + ' "' + v + '" is not a date (use yyyy-mm-dd)'); return; }
      if (c.fmt === 'currency' || c.fmt === 'int' || c.fmt === 'percent') { const n = parseNumber_(v); if (n === null) problems.push(c.h + ' "' + v + '" is not a number'); else row[c.key] = n; return; }
      if (c.v && c.v.checkbox) { row[c.key] = /^(true|yes|y|1|x)$/i.test(String(v).trim()); return; }
      if (c.v && c.v.list && lists[c.v.list]) {
        const hit = lists[c.v.list].filter(x => String(x).toLowerCase() === String(v).trim().toLowerCase())[0];
        if (hit) row[c.key] = hit; else { row[c.key] = String(v).trim(); warnings.push('Row ' + (r - 1) + ': ' + c.h + ' "' + v + '" is not one of ' + lists[c.v.list].join(' / ')); }
        return;
      }
      row[c.key] = typeof v === 'string' ? v.trim() : v;
    });
    if (problems.length) return { status: 'error', table: key, message: 'Row ' + (r - 1) + ' of the block: ' + problems.join('; ') + '. Nothing was imported.' };
    parsed.push({ row, extra, line: r - 1 });
  }
  if (!parsed.length) return { status: 'nothing', table: key, message: 'The block has a header but no rows.' };

  // table-specific checks and defaults
  const today = todayMidnight_();
  parsed.forEach(p => {
    const row = p.row;
    if (key === 'INCOME') {
      if (!row.payDate || !row.person) { p.reject = 'Pay Date and Person are required'; return; }
      if (!row.incomeType) row.incomeType = 'Salary';
      const ded = ['fedTax', 'stateTax', 'ssMed', 'health', 'retirement', 'otherDed'].reduce((s, k) => s + Number(row[k] || 0), 0);
      const computed = Number(row.gross || 0) - ded;
      if (p.extra.stubTakeHome !== null && p.extra.stubTakeHome !== undefined && Math.abs(p.extra.stubTakeHome - computed) > 1) {
        const note = 'CHECK: stub net pay ' + money_(p.extra.stubTakeHome) + ' differs from gross − deductions ' + money_(computed) + ' by ' + money_(p.extra.stubTakeHome - computed) + '.';
        row.notes = (row.notes ? row.notes + ' ' : '') + note;
        warnings.push('Row ' + p.line + ': ' + note);
      }
      row.lastUpdated = today;
    }
    if (key === 'CREDIT' && (!row.scoreDate || !row.person || !row.score)) p.reject = 'Score Date, Person and Score are required';
    if (key === 'RECUR') { if (!row.name) p.reject = 'Name is required'; if (row.active === undefined) row.active = true; }
    if (key === 'QDR' && (!row.debtId || !row.quarterEnd)) p.reject = 'Debt ID and Quarter End are required';
    if (key === 'TX') { if (!row.date || row.amount === undefined || !row.type) p.reject = 'Date, Amount and Type are required'; if (!row.status) row.status = 'Posted'; }
    row.notes = ((row.notes ? row.notes + ' ' : '') + 'Imported from Paste Import ' + Utilities.formatDate(today, 'America/Detroit', 'yyyy-MM-dd') + '.').trim();
  });
  const rejected = parsed.filter(p => p.reject);
  if (rejected.length) return { status: 'error', table: key, message: rejected.map(p => 'Row ' + p.line + ': ' + p.reject).join('\n') + '\nNothing was imported.' };

  // duplicates against what is already in the table
  syncLastRow_(def);
  const existing = readTable_(def);
  const keyOf = (o) => (spec.dedupe || []).map(k => { const v = o[k]; return v instanceof Date ? Utilities.formatDate(v, 'America/Detroit', 'yyyy-MM-dd') : String(v === undefined || v === null ? '' : v).trim().toLowerCase(); }).join('|');
  const seen = {}; existing.forEach(e => { seen[keyOf(e)] = e.id || true; });
  const fresh = [], dupes = [];
  parsed.forEach(p => { const k = keyOf(p.row); if (seen[k]) dupes.push('Row ' + p.line + ' (already ' + (seen[k] === true ? 'present' : seen[k]) + ')'); else { seen[k] = true; fresh.push(p.row); } });
  if (!fresh.length) { return { status: 'nothing', table: key, skipped: dupes.length, message: 'Every row in the block is already in ' + def.sheet + ':\n' + dupes.join('\n') }; }

  if (opts.dryRun) {
    return { status: 'preview', table: key, sheet: def.sheet, imported: fresh.length, skipped: dupes.length, dupes, warnings,
      preview: fresh.slice(0, 12).map(row => previewLine_(key, row)),
      message: fresh.length + ' row(s) will be added to ' + def.sheet + (dupes.length ? '; ' + dupes.length + ' already present will be skipped' : '') + '.' };
  }
  if (opts.confirm) {
    const ui = ui_();
    const summary = 'Import ' + fresh.length + ' row(s) into ' + def.sheet + '?' + (dupes.length ? '\n\nSkipping ' + dupes.length + ' already present: ' + dupes.join(', ') : '') + (warnings.length ? '\n\nPlease check afterwards:\n' + warnings.slice(0, 8).join('\n') : '') + '\n\nRows are added, never overwritten; the Change Log records each one.';
    if (ui && ui.alert('Import pasted rows', summary, ui.ButtonSet.YES_NO) !== ui.Button.YES) return { status: 'cancelled', table: key, message: 'Nothing was imported.' };
  }

  // write
  const width = (def.idPattern || '').split('-').pop().length || 3;
  let nextNum = parseInt(nextId_(def, width).split('-')[1], 10);
  const who = userEmail_() || 'paste-import';
  fresh.forEach(row => { row.id = def.idPrefix + '-' + String(nextNum++).padStart(width, '0'); });
  writeRows_(def, fresh);
  fresh.forEach(row => appendChangeLog_({ table: key, recordId: row.id, field: '(row)', newValue: 'Imported from Paste Import', action: 'Import', user: who }));
  let linked = null;
  if (key === 'INCOME') { try { linked = linkIncomeDeposits_(); } catch (e) { linked = null; } }
  const when = Utilities.formatDate(new Date(), 'America/Detroit', 'yyyy-MM-dd HH:mm');
  props.setProperty('PASTE_LAST_HASH', hash); props.setProperty('PASTE_LAST_WHEN', when);
  const status = fresh.length + ' row(s) → ' + def.sheet + ' at ' + when + (dupes.length ? ' · ' + dupes.length + ' skipped as already present' : '') + ' · IDs ' + fresh[0].id + (fresh.length > 1 ? '–' + fresh[fresh.length - 1].id : '');
  const st = ss_().getRangeByName('PASTE_STATUS'); if (st) st.setValue(status);
  return { status: 'imported', table: key, imported: fresh.length, skipped: dupes.length, warnings, ids: fresh.map(r => r.id),
    message: status + (warnings.length ? '\n\nPlease check:\n' + warnings.slice(0, 8).join('\n') : '') + (linked ? '\n\nPaycheck deposits: ' + linked.linked + ' linked to these paychecks.' : '') };
}

function pasteHash_(grid) {
  const text = grid.map(r => r.map(v => v instanceof Date ? v.toISOString().slice(0, 10) : String(v === null || v === undefined ? '' : v)).join('\t')).join('\n');
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, text, Utilities.Charset.UTF_8);
  return bytes.map(b => ('0' + ((b + 256) % 256).toString(16)).slice(-2)).join('');
}

function parseNumber_(v) {
  if (v === '' || v === null || v === undefined) return null;
  if (typeof v === 'number') return v;
  const s = String(v).replace(/[$,\s]/g, '').replace(/^\((.*)\)$/, '-$1');
  if (s === '' || isNaN(Number(s))) return null;
  return Number(s);
}

function parseDate_(v) {
  if (v instanceof Date && !isNaN(v)) return new Date(v.getFullYear(), v.getMonth(), v.getDate());
  const s = String(v || '').trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (m) return new Date(Number(m[3]), Number(m[1]) - 1, Number(m[2]));
  return null;
}

function money_(n) { const v = Number(n || 0); return (v < 0 ? '-$' : '$') + Math.abs(v).toFixed(2); }

/** One line of the preview shown in the dialog. */
function previewLine_(key, row) {
  const d = (v) => (v instanceof Date) ? Utilities.formatDate(v, 'America/Detroit', 'yyyy-MM-dd') : String(v || '');
  if (key === 'INCOME') return d(row.payDate) + ' · ' + (row.person || '') + ' · ' + (row.employer || '') + ' · gross ' + money_(row.gross) + ' · deductions ' + money_(['fedTax', 'stateTax', 'ssMed', 'health', 'retirement', 'otherDed'].reduce((s, k) => s + Number(row[k] || 0), 0));
  if (key === 'CREDIT') return d(row.scoreDate) + ' · ' + (row.person || '') + ' · ' + (row.score || '');
  if (key === 'RECUR') return (row.name || '') + ' · ' + money_(row.amount) + ' · ' + (row.frequency || '');
  if (key === 'QDR') return (row.debtId || '') + ' · ' + d(row.quarterEnd) + ' · ' + money_(row.endingBalance);
  if (key === 'TX') return d(row.date) + ' · ' + (row.description || '') + ' · ' + money_(row.amount) + ' · ' + (row.type || '');
  return JSON.stringify(row).slice(0, 120);
}

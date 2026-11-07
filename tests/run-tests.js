#!/usr/bin/env node
/**
 * Executes the Apps Script build end-to-end against the in-memory mock,
 * then checks structure and formula hygiene. Run: node scripts/test-build.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { makeGlobals, colLetter, parseA1 } = require('./mock-sheet');

const SRC_DIR = path.join(__dirname, '..', 'apps-script');
const files = fs.readdirSync(SRC_DIR).filter(f => f.endsWith('.gs')).sort();
const source = files.map(f => `// ---- ${f} ----\n` + fs.readFileSync(path.join(SRC_DIR, f), 'utf8')).join('\n\n');

const g = makeGlobals();
const ctx = vm.createContext(g);
vm.runInContext(source, ctx, { filename: 'bundle.gs' });

let failures = 0;
const ok = (m) => console.log('  ok   ' + m);
const bad = (m) => { failures++; console.log('  FAIL ' + m); };

console.log('Running buildWorkbook({sample:true}) against the mock…');
const t0 = Date.now();
const result = vm.runInContext('buildWorkbook({ sample: true })', ctx);
console.log(`Build completed in ${Date.now() - t0} ms (mock). QA inside mock: ${result.qa.checks} checks (formula values are not evaluated here).`);

const ss = g.__ss;
const TABLES = vm.runInContext('TABLES', ctx);
const TAB_ORDER = vm.runInContext('TAB_ORDER', ctx);
const SHEETS = vm.runInContext('SHEETS', ctx);

/* 1. tabs */
const names = ss.getSheets().map(s => s.getName());
if (names.length === 20 && JSON.stringify(names) === JSON.stringify(TAB_ORDER)) ok('20 tabs in the specified order'); else bad('tab order/count: ' + names.join(' | '));

/* 2. schema expectations from the handoff */
const expectCols = { TX: 32, INCOME: 19, CATS: 8, ACCOUNTS: 10, STAGING: 16, LOG: 10, BUDGET: 8, PLAN: 8, SUMMARY: 14, FUNDS: 16, RECUR: 19 };
Object.keys(expectCols).forEach(k => {
  const n = TABLES[k].columns.length;
  if (n === expectCols[k]) ok(`${TABLES[k].sheet}: ${n} columns`); else bad(`${TABLES[k].sheet}: expected ${expectCols[k]} columns, got ${n}`);
});
const txLast = colLetter(TABLES.TX.columns.length);
if (txLast === 'AF') ok('Transactions spans A:AF'); else bad('Transactions last column is ' + txLast);
const txHeaders = TABLES.TX.columns.map(c => c.h);
['Transaction ID', 'Date', 'Description', 'Amount ($)', 'Type', 'Category', 'Subcategory', 'Account ID', 'Person', 'Household/Personal', 'Fixed/Variable (Deprecated)', 'Need/Want', 'Fund ID', 'Debt ID', 'Recurring?', 'Status', 'Month', 'Notes', 'Created At', 'Updated At', 'Spending Type', 'Funding Source', 'Source Income ID', 'Is Deleted', 'Deleted At', 'Validation Flag', 'Created By', 'Updated By', 'Split Role', 'Parent Transaction ID', 'Split Difference ($)', 'Receipt Reference']
  .forEach((h, i) => { if (txHeaders[i] !== h) bad(`Transactions column ${colLetter(i + 1)} should be "${h}" but is "${txHeaders[i]}"`); });
ok('Transactions column order matches the handoff (A:AF)');

/* 3. headers written where the schema says */
Object.values(TABLES).forEach(def => {
  const sh = ss.getSheetByName(def.sheet);
  const hdr = sh.getRange(def.headerRow, 1, 1, def.columns.length).getValues()[0];
  const mism = def.columns.filter((c, i) => hdr[i] !== c.h);
  if (mism.length) bad(`${def.sheet}: header mismatch ${mism.map(c => c.h).join(', ')}`); else ok(`${def.sheet}: header row ${def.headerRow} written`);
  // formulas present on first and last data rows of formula columns
  def.columns.forEach((c, i) => {
    if (!c.f) return;
    const f1 = sh.getRange(def.firstRow, i + 1).getFormula();
    const fN = sh.getRange(def.lastRow, i + 1).getFormula();
    if (!f1 || !fN) bad(`${def.sheet}.${c.h}: formula missing at row ${!f1 ? def.firstRow : def.lastRow}`);
    if (/\[@|\{r\}|\[[A-Z]+\./.test(f1)) bad(`${def.sheet}.${c.h}: unresolved token in ${f1}`);
  });
  // validations
  def.columns.forEach((c, i) => { if (c.v && !sh.getRange(def.firstRow, i + 1).getDataValidation()) bad(`${def.sheet}.${c.h}: validation missing`); });
  // no merges inside the table
  const merged = sh.getRange(def.headerRow, 1, def.lastRow - def.headerRow + 1, def.columns.length).getMergedRanges();
  if (merged.length) bad(`${def.sheet}: merged cells inside raw table`);
});

/* 4. formula hygiene across the whole workbook */
const KNOWN_FUNCS = new Set(['IF', 'IFS', 'IFERROR', 'AND', 'OR', 'NOT', 'SUM', 'SUMIF', 'SUMIFS', 'COUNTIF', 'COUNTIFS', 'MAXIFS', 'MAX', 'MIN', 'N', 'ABS', 'ROUND', 'INDEX', 'MATCH', 'FILTER', 'SORT', 'UNIQUE', 'ARRAY_CONSTRAIN', 'ARRAYFORMULA', 'SUMPRODUCT', 'DATE', 'YEAR', 'MONTH', 'DAY', 'TODAY', 'EOMONTH', 'EDATE', 'WEEKDAY', 'TEXT', 'LEFT', 'UPPER', 'LOWER', 'REGEXREPLACE', 'ISNUMBER', 'ISBLANK', 'ROW', 'LET', 'SWITCH', 'SPARKLINE', 'CEILING', 'TRIM', 'VLOOKUP', 'COUNTA']);
const funcRe = /([A-Z_][A-Z0-9_\.]*)\s*\(/g;
const unknown = new Map();
let unbalanced = 0, stray = 0, badSheetRef = 0;
const sheetNames = new Set(names);
ss.allFormulas.forEach(({ sheet, a1, f }) => {
  let depth = 0, inStr = false;
  for (const ch of f) { if (ch === '"') inStr = !inStr; else if (!inStr) { if (ch === '(' || ch === '{') depth++; else if (ch === ')' || ch === '}') depth--; if (depth < 0) break; } }
  if (depth !== 0 || inStr) { unbalanced++; if (unbalanced <= 3) console.log(`    unbalanced: ${sheet}!${a1}: ${f.slice(0, 120)}`); }
  if (/\[@|\{r\}|\[[A-Z]+\.\w+\]/.test(f)) { stray++; if (stray <= 3) console.log(`    stray token: ${sheet}!${a1}: ${f.slice(0, 120)}`); }
  const stripped = f.replace(/"[^"]*"/g, '""');
  let m; funcRe.lastIndex = 0;
  while ((m = funcRe.exec(stripped))) { if (!KNOWN_FUNCS.has(m[1])) unknown.set(m[1], (unknown.get(m[1]) || 0) + 1); }
  const refs = stripped.match(/'[^']+'!/g) || [];
  refs.forEach(r => { const nm = r.slice(1, -2); if (!sheetNames.has(nm)) { badSheetRef++; if (badSheetRef <= 3) console.log(`    bad sheet ref ${nm} in ${sheet}!${a1}`); } });
});
console.log(`  ${ss.allFormulas.length} formula cells written`);
if (unbalanced) bad(`${unbalanced} formulas with unbalanced parentheses/braces or quotes`); else ok('all formulas have balanced parentheses, braces and quotes');
if (stray) bad(`${stray} formulas with unresolved template tokens`); else ok('no unresolved template tokens');
if (badSheetRef) bad(`${badSheetRef} references to non-existent sheets`); else ok('every cross-sheet reference names an existing tab');
if (unknown.size) bad('unknown function names: ' + [...unknown.entries()].map(e => e.join('×')).join(', ')); else ok('every function name is a known Google Sheets function');

/* 5. column letters in cross-table references resolve to the intended header */
function checkRef(formula, expectations) {
  expectations.forEach(([sheetName, letter, header]) => {
    const def = Object.values(TABLES).find(d => d.sheet === sheetName);
    const idx = def.columns.findIndex(c => c.h === header);
    const want = `'${sheetName}'!$${letter}$${def.firstRow}:$${letter}`;
    if (colLetter(idx + 1) !== letter) bad(`${header} is column ${colLetter(idx + 1)} on ${sheetName}, not ${letter}`);
    if (formula.indexOf(want) < 0) bad(`expected ${want} in formula: ${formula.slice(0, 100)}…`);
  });
}
const tx = ss.getSheetByName(SHEETS.TX);
const splitDiffF = tx.getRange(5, TABLES.TX.columns.findIndex(c => c.key === 'splitDiff') + 1).getFormula();
if (splitDiffF.indexOf('N($D5)-SUMIFS($D$5:$D,$AD$5:$AD,$A5,$X$5:$X,"<>TRUE")') >= 0) ok('Split Difference formula matches the handoff pattern (with N() guard on Amount)'); else bad('Split Difference formula: ' + splitDiffF);
const budget = ss.getSheetByName(SHEETS.BUDGET);
const actualF = budget.getRange(5, 5).getFormula();
checkRef(actualF, [[SHEETS.TX, 'D', 'Amount ($)'], [SHEETS.TX, 'Q', 'Month'], [SHEETS.TX, 'F', 'Category'], [SHEETS.TX, 'E', 'Type'], [SHEETS.TX, 'X', 'Is Deleted']]);
if (actualF.indexOf('"<>TRUE"') >= 0) ok('Monthly Budget Actual excludes soft-deleted rows'); else bad('Monthly Budget Actual lacks the soft-delete filter');
const dash = ss.getSheetByName(SHEETS.DASH);
const fedBen = dash.getRange('B24').getFormula(), fedVal = dash.getRange('E24').getFormula(), fedHH = dash.getRange('H24').getFormula();
if (fedBen.indexOf("'Income'!$H$5:$H") >= 0 && fedBen.indexOf('"Ben"') >= 0 && fedVal.indexOf('"Valerie"') >= 0 && fedHH.indexOf("'Income'!$H$5:$H") >= 0 && fedHH.indexOf('person') < 0) ok('Dashboard Federal Tax formulas present for Ben, Valerie, Household (Income col H)'); else bad('Dashboard Federal Tax formulas: ' + fedBen + ' | ' + fedVal + ' | ' + fedHH);
['A23:C23', 'D23:F23', 'G23:I23'].forEach(r => { const h = dash.getRange(r).getValues()[0]; if (h.join('|') !== 'Deduction|Amount|% of Gross') bad('Payroll header ' + r + ' = ' + h.join('|')); });
ok('Payroll headers Deduction | Amount | % of Gross present in all three groups');
if (dash.getRange('A32').getFormula().indexOf('TEXT(TODAY(),"mmmm yyyy")') >= 0) ok('Current Flexible Spending label uses TODAY()'); else bad('Flexible label formula: ' + dash.getRange('A32').getFormula());
if (dash.getRange('E17').getFormula().indexOf('SPARKLINE(($B17-300)/550') >= 0) ok('Credit score SPARKLINE position bar'); else bad('Credit sparkline: ' + dash.getRange('E17').getFormula());
if (dash.getRange('A6').getFormula() === "=SUMIFS('Income'!$G$5:$G,'Income'!$C$5:$C,$B$3)") ok('Gross card = SUMIFS(Income gross, Income month, Selected Month)'); else bad('Gross card: ' + dash.getRange('A6').getFormula());

/* 6. sample data landed */
const txRows = vm.runInContext("readTable_(TABLES.TX)", ctx);
const incRows = vm.runInContext("readTable_(TABLES.INCOME)", ctx);
console.log(`  sample: ${incRows.length} paychecks, ${txRows.length} transactions`);
const parents = txRows.filter(r => r.splitRole === 'Parent');
const kids = txRows.filter(r => r.splitRole === 'Child');
const kidSum = kids.reduce((s, k) => s + k.amount, 0);
if (parents.length === 1 && Math.abs(parents[0].amount - kidSum) < 0.005 && kids.every(k => k.parentTxId === parents[0].id)) ok(`split sample: parent ${parents[0].amount} = children ${kidSum.toFixed(2)}`); else bad('split sample inconsistent');
if (txRows.some(r => r.isDeleted === true)) ok('sample includes a soft-deleted row'); else bad('no soft-deleted sample row');
if (txRows.some(r => r.type === 'Refund') && txRows.some(r => r.type === 'Transfer') && txRows.some(r => r.type === 'Savings') && txRows.some(r => r.type === 'Debt Payment')) ok('sample covers Refund, Transfer, Savings, Debt Payment'); else bad('sample scenario coverage incomplete');
const incomeTx = txRows.filter(r => r.type === 'Income');
if (incomeTx.length === incRows.length && incomeTx.every(t => incRows.some(i => i.id === t.sourceIncomeId && Math.abs(i.gross - (i.fedTax + i.stateTax + i.ssMed + i.health + i.retirement + i.otherDed) - t.amount) < 0.005))) ok('every paycheck has a linked deposit transaction with matching take-home'); else bad('income/deposit linkage mismatch');
const uncategorized = txRows.filter(r => r.type === 'Expense' && !r.category);
if (uncategorized.length <= 1) ok(`uncategorized sample rows: ${uncategorized.length} (intentional)`); else bad('too many uncategorized sample rows');
const taxonomyPairs = new Set(vm.runInContext('TAXONOMY', ctx).map(t => t[0] + '|' + t[1]));
const badPairs = txRows.filter(r => r.category && r.subcategory && !taxonomyPairs.has(r.category + '|' + r.subcategory));
if (badPairs.length) bad('sample rows with category/subcategory not in taxonomy: ' + badPairs.map(r => r.category + '/' + r.subcategory).join(', ')); else ok('every sample category/subcategory exists in the taxonomy');
const credit = vm.runInContext("readTable_(TABLES.CREDIT)", ctx);
if (credit.length === 0) ok('no credit scores invented'); else bad('credit scores were pre-filled');
const accounts = vm.runInContext("readTable_(TABLES.ACCOUNTS)", ctx);
const real = accounts.filter(a => /^ACC-0(0[6-9]|1[0-3])$/.test(a.id));
if (real.length === 8 && real.every(a => a.owner === '' && a.currentBalance === '')) ok('8 real accounts present with blank owner/balance'); else bad('real accounts: ' + JSON.stringify(real.map(a => [a.id, a.owner, a.currentBalance])));

/* 7. named ranges */
const nr = [...ss.namedRanges.keys()];
['LIST_TRANSACTION_TYPES', 'LIST_SPENDING_TYPES', 'LIST_ALL_CATEGORIES', 'LIST_EXPENSE_CATEGORIES', 'TBL_TX', 'TBL_INCOME', 'SETTING_CHANGE_LOG', 'QA_LAST_RESULT'].forEach(n => { if (!nr.includes(n)) bad('named range missing: ' + n); });
ok(`${nr.length} named ranges defined`);

/* 8. helper routines run without throwing */
vm.runInContext('linkIncomeDeposits()', ctx); ok('linkIncomeDeposits() runs');
vm.runInContext('recordNetWorthSnapshot()', ctx); ok('recordNetWorthSnapshot() runs');
vm.runInContext('extendFormulaRows()', ctx); ok('extendFormulaRows() runs');
vm.runInContext('onOpen()', ctx); ok('onOpen() runs');
vm.runInContext(`onEdit({ range: SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Transactions').getRange(5, 3), value: 'Edited', oldValue: 'Old', source: SpreadsheetApp.getActiveSpreadsheet() })`, ctx);
const logRows = vm.runInContext("readTable_(TABLES.LOG)", ctx);
if (logRows.length >= 1 && logRows.some(r => r.table === 'TX' && r.field === 'Description')) ok('onEdit appended a Change Log row'); else bad('onEdit did not log: ' + JSON.stringify(logRows.slice(0, 2)));
const before = vm.runInContext("readTable_(TABLES.TX).length", ctx);
vm.runInContext(`apiAppend_('TX', { date: '2026-11-07', description: 'API test', amount: 12.5, type: 'Expense', category: 'Food', subcategory: 'Groceries', spendingType: 'Flexible', accountId: 'ACC-007' }, 'tester')`, ctx);
const after = vm.runInContext("readTable_(TABLES.TX).length", ctx);
if (after === before + 1) ok('apiAppend_ adds a transaction row with a generated ID'); else bad('apiAppend_ failed');
const newId = vm.runInContext("readTable_(TABLES.TX).slice(-1)[0].id", ctx);
vm.runInContext(`apiSoftDelete_('TX', '${newId}', 'tester')`, ctx);
if (vm.runInContext(`readTable_(TABLES.TX).slice(-1)[0].isDeleted`, ctx) === true) ok('apiSoftDelete_ sets Is Deleted (no hard delete)'); else bad('apiSoftDelete_ failed');
try { vm.runInContext(`apiAppend_('SUMMARY', { month: '2026-11-01' })`, ctx); bad('API allowed a write to Monthly Summary'); } catch (e) { ok('API rejects writes to Monthly Summary'); }
vm.runInContext('clearSampleData()', ctx);
const left = vm.runInContext("readTable_(TABLES.TX).filter(r => r.createdBy === 'sample-data').length", ctx);
const realLeft = vm.runInContext("readTable_(TABLES.ACCOUNTS).length", ctx);
if (left === 0 && realLeft === 8) ok('clearSampleData() removes tagged rows and keeps the 8 real accounts'); else bad(`clearSampleData left ${left} sample tx and ${realLeft} accounts`);

console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll mock checks passed.');
process.exit(failures ? 1 : 0);

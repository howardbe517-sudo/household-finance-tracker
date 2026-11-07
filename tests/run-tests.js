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
if (names.length === 22 && JSON.stringify(names) === JSON.stringify(TAB_ORDER)) ok('22 tabs in the specified order (20 from the handoff + Import Rules + Connections)'); else bad('tab order/count: ' + names.join(' | '));

/* 2. schema expectations from the handoff (3.1 adds columns only at the end of a table) */
const expectCols = { TX: 32, INCOME: 19, CATS: 8, ACCOUNTS: 14, STAGING: 27, LOG: 10, BUDGET: 8, PLAN: 8, SUMMARY: 15, FUNDS: 16, RECUR: 19, RULES: 17, CONN: 12 };
const handoffFirst = { ACCOUNTS: ['Account ID', 'Account Name', 'Institution', 'Account Type', 'Owner', 'Include in Net Worth?', 'Starting Balance', 'Current Balance', 'Last Updated', 'Notes'],
  STAGING: ['Import ID', 'Provider', 'External Transaction ID', 'Account ID', 'Date', 'Raw Description', 'Amount', 'Pending?', 'Suggested Category', 'Suggested Subcategory', 'Suggested Spending Type', 'Fingerprint', 'Reviewed?', 'Duplicate?', 'Imported Transaction ID', 'Notes'] };
Object.keys(handoffFirst).forEach(k => { const hs = TABLES[k].columns.map(c => c.h); handoffFirst[k].forEach((h, i) => { if (hs[i] !== h) bad(`${TABLES[k].sheet} column ${colLetter(i + 1)} should still be "${h}" (handoff order), got "${hs[i]}"`); }); });
ok('Accounts and Import Staging keep the handoff column order; new columns are appended');
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
/* 9. bank-import engine: classification, pairing, review, rules, split panel */
const R = (code) => vm.runInContext(code, ctx);
const near = (a, b) => Math.abs(Number(a) - Number(b)) < 0.005;
const c1 = R(`classifyRow_({ importId:'T1', accountId:'ACC-001', rawDescription:'SAMPLE ELECTRIC CO ONLINE PMT', merchantName:'', amount:120 }, importContext_())`);
if (c1.ruleId === 'RULE-001' && c1.status === 'Ready' && c1.autoImport && c1.suggestedCategory === 'Housing' && c1.suggestedSubcategory === 'Electric') ok('rule match: utility bill → Housing/Electric, auto-import'); else bad('classifyRow_ utility: ' + JSON.stringify(c1));
const c2 = R(`classifyRow_({ importId:'T2', accountId:'ACC-003', rawDescription:'SOMETHING NEW', merchantName:'', amount:-12 }, importContext_())`);
if (!c2.ruleId && c2.status === 'Needs Review' && c2.suggestedType === 'Refund' && !c2.suggestedCategory) ok('no rule: card credit → Refund, Needs Review, category left blank'); else bad('classifyRow_ unknown: ' + JSON.stringify(c2));
const c3 = R(`classifyRow_({ importId:'T3', accountId:'ACC-002', rawDescription:'SAMPLE EMPLOYER A PAYROLL', merchantName:'', amount:-2070.2 }, importContext_())`);
if (!c3.ruleId && c3.suggestedType === 'Income') ok('account-scoped paycheck rule does not fire on another account'); else bad('classifyRow_ scope: ' + JSON.stringify(c3));
const c4 = R(`classifyRow_({ importId:'T4', accountId:'ACC-001', rawDescription:'SAMPLE EMPLOYER A PAYROLL DEP', merchantName:'', amount:-2070.2 }, importContext_())`);
if (c4.ruleId === 'RULE-002' && c4.suggestedType === 'Income' && c4.suggestedPerson === 'Ben' && c4.autoImport) ok('paycheck rule matches by source text on the right account'); else bad('classifyRow_ paycheck: ' + JSON.stringify(c4));
const pairs = R(`(function(){ var d=new Date(); var rows=[
  { importId:'P1', accountId:'ACC-001', amount:350, date:d, status:'Needs Review' },
  { importId:'P2', accountId:'ACC-003', amount:-350, date:new Date(d.getTime()-86400000), status:'Needs Review' },
  { importId:'P3', accountId:'ACC-001', amount:500, date:d, status:'Needs Review' },
  { importId:'P4', accountId:'ACC-002', amount:-500, date:d, status:'Needs Review' },
  { importId:'P5', accountId:'ACC-001', amount:77, date:d, status:'Needs Review' } ];
  var ps = pairTransfers_(rows, importContext_()); ps.forEach(applyPair_); return { ps: ps.map(function(p){ return { kind:p.kind, debtId:p.debtId, out:p.out.importId, inn:p.in.importId }; }), rows: rows }; })()`);
const cp = pairs.ps.filter(p => p.kind === 'card-payment')[0], tr = pairs.ps.filter(p => p.kind === 'transfer')[0];
if (cp && cp.debtId === 'DEBT-003' && cp.out === 'P1' && cp.inn === 'P2') ok('card payment pair: checking debit → Debt Payment linked to DEBT-003, card credit → Transfer'); else bad('card pair: ' + JSON.stringify(pairs.ps));
if (tr && tr.out === 'P3' && tr.inn === 'P4' && pairs.rows[2].suggestedType === 'Transfer' && pairs.rows[3].suggestedType === 'Transfer') ok('checking → savings pair: both sides Transfer'); else bad('transfer pair: ' + JSON.stringify(pairs.ps));
if (!pairs.rows[4].pairedImportId) ok('unmatched amount stays unpaired'); else bad('P5 was paired');
const st = R(`readTable_(TABLES.STAGING)`);
const byId = {}; st.forEach(s => { byId[s.importId] = s; });
if (byId['IMP-000001'].status === 'Ready' && byId['IMP-000002'].status === 'Needs Split' && byId['IMP-000003'].status === 'Needs Review' && byId['IMP-000005'].status === 'Needs Review' && byId['IMP-000005'].suggestedSubcategory === 'Fuel') ok('sample staged rows classified: Ready / Needs Split / Needs Review / pre-filled'); else bad('sample staging statuses: ' + st.map(s => s.importId + '=' + s.status).join(', '));
if (byId['IMP-000006'].suggestedType === 'Debt Payment' && byId['IMP-000006'].suggestedDebtId === 'DEBT-003' && byId['IMP-000007'].suggestedType === 'Transfer' && byId['IMP-000006'].pairedImportId === 'IMP-000007') ok('sample card payment pair detected across checking and card'); else bad('sample pair: ' + JSON.stringify([byId['IMP-000006'], byId['IMP-000007']].map(s => [s.suggestedType, s.pairedImportId])));

// review: tick the pre-filled fuel row and import it
const txBefore = R(`readTable_(TABLES.TX).length`);
R(`(function(){ var def=TABLES.STAGING; var r=findRowById_(def,'IMP-000005'); getOrCreateSheet_(def.sheet).getRange(r, colIndex_(def,'reviewed')).setValue(true); })()`);
const imp1 = R(`importReviewedRows()`);
const after1 = R(`readTable_(TABLES.STAGING).filter(function(s){ return s.importId==='IMP-000005'; })[0]`);
const newTx = R(`readTable_(TABLES.TX).slice(-1)[0]`);
if (imp1.imported === 1 && after1.status === 'Imported' && after1.importedTxId === newTx.id && newTx.category === 'Transportation' && newTx.subcategory === 'Fuel' && newTx.spendingType === 'Flexible' && near(newTx.amount, 51.3) && newTx.createdBy === 'bank-import') ok('Import reviewed rows: pre-filled row became a Transactions row (' + newTx.id + ')'); else bad('importReviewedRows: ' + JSON.stringify([imp1, after1.status, newTx]));
if (R(`readTable_(TABLES.TX).length`) === txBefore + 1) ok('only the ticked row was imported'); else bad('unexpected transaction count after import');
// a ticked row with no category is refused, not imported
R(`(function(){ var def=TABLES.STAGING; var r=findRowById_(def,'IMP-000004'); getOrCreateSheet_(def.sheet).getRange(r, colIndex_(def,'reviewed')).setValue(true); })()`);
const imp2 = R(`importReviewedRows()`);
if (imp2.imported === 0 && imp2.problems.length === 1 && /no Category/.test(imp2.problems[0])) ok('a reviewed row without a category is held back with a reason'); else bad('importReviewedRows problems: ' + JSON.stringify(imp2));
R(`(function(){ var def=TABLES.STAGING; var r=findRowById_(def,'IMP-000004'); getOrCreateSheet_(def.sheet).getRange(r, colIndex_(def,'reviewed')).setValue(false); })()`);
// make a rule from the coffee row → it auto-imports
const rule = R(`saveRuleFromDialog({ pattern:'SAMPLE COFFEE', matchType:'Contains', type:'Expense', category:'Food', subcategory:'Coffee & Snacks', spendingType:'Flexible', person:'Ben', autoImport:true })`);
const coffee = R(`readTable_(TABLES.STAGING).filter(function(s){ return s.importId==='IMP-000003'; })[0]`);
if (rule.ruleId === 'RULE-005' && rule.updatedRows >= 1 && coffee.status === 'Imported' && coffee.ruleId === 'RULE-005') ok('Make a rule: new auto-import rule applied to the waiting coffee row and imported it'); else bad('saveRuleFromDialog: ' + JSON.stringify([rule, coffee.status, coffee.ruleId]));
const coffeeTx = R(`readTable_(TABLES.TX).filter(function(t){ return t.id==='${coffee.importedTxId}'; })[0]`);
if (coffeeTx && coffeeTx.status === 'Pending' && coffeeTx.subcategory === 'Coffee & Snacks') ok('pending charge imported with Status = Pending'); else bad('coffee tx: ' + JSON.stringify(coffeeTx));
// split panel on the superstore row
R(`(function(){ var ss=SpreadsheetApp.getActiveSpreadsheet(); var sh=ss.getSheetByName('Import Staging'); ss.setActiveSheet(sh); ss.activeRange = sh.getRange(findRowById_(TABLES.STAGING,'IMP-000002'), 3); })()`);
const sctx = R(`getSplitContext()`);
if (sctx.selected && sctx.selected.source === 'staging' && near(sctx.selected.amount, 86.4) && sctx.taxonomy.length > 50) ok('split panel sees the selected staged row'); else bad('getSplitContext: ' + JSON.stringify(sctx.selected));
const split = R(`saveSplitFromPanel({ source:'staging', id:'IMP-000002', children:[{ amount:50, category:'Food', subcategory:'Groceries', spendingType:'Flexible' }, { amount:36.4, category:'Child Expenses', subcategory:'Supplies', spendingType:'Flexible', note:'wipes' }] })`);
const parentTx = R(`readTable_(TABLES.TX).filter(function(t){ return t.id==='${split.parentId}'; })[0]`);
const splitKids = R(`readTable_(TABLES.TX).filter(function(t){ return t.parentTxId==='${split.parentId}'; })`);
if (parentTx && parentTx.type === 'Split Parent' && parentTx.splitRole === 'Parent' && splitKids.length === 2 && near(splitKids[0].amount + splitKids[1].amount, 86.4) && split.difference === 0 && R(`readTable_(TABLES.STAGING).filter(function(s){ return s.importId==='IMP-000002'; })[0].status`) === 'Imported') ok('split panel: staged row → Split Parent + 2 children, difference 0.00, staging Imported'); else bad('saveSplitFromPanel: ' + JSON.stringify([split, parentTx && parentTx.type, splitKids.length]));

/* 10. Plaid: connect, map, sync, pending→posted, removals, layout check, triggers */
const todayIso = new Date().toISOString().slice(0, 10);
const dIso = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
R(`PropertiesService.getScriptProperties().setProperty('PLAID_CLIENT_ID','test-client'); PropertiesService.getScriptProperties().setProperty('PLAID_SECRET','test-secret'); PropertiesService.getScriptProperties().setProperty('PLAID_START_DATE','${dIso(30)}')`);
let syncPhase = 1;
g.__fetchHandler.fn = (url, payload) => {
  if (!payload.client_id || !payload.secret) return { code: 400, body: { error_code: 'INVALID_API_KEYS', error_message: 'missing keys' } };
  if (url.endsWith('/link/token/create')) return { body: { link_token: 'lt-1', hosted_link_url: 'https://secure.plaid.com/hl/test', expiration: '2026-12-31T00:00:00Z' } };
  if (url.endsWith('/link/token/get')) return { body: { link_sessions: [{ finished_at: todayIso, results: { item_add_results: [{ public_token: 'public-1', institution: { institution_id: 'ins_1', name: 'Sample Bank' } }] } }] } };
  if (url.endsWith('/item/public_token/exchange')) return { body: { access_token: 'access-1', item_id: 'item-1' } };
  if (url.endsWith('/accounts/get')) return { body: { accounts: [{ account_id: 'pa1', name: 'Everyday Checking', mask: '1111', type: 'depository', subtype: 'checking', balances: { current: 1234.56 } }, { account_id: 'pa2', name: 'Rewards Card', mask: '2222', type: 'credit', subtype: 'credit card', balances: { current: 420 } }] } };
  if (url.endsWith('/transactions/sync')) {
    if (payload.access_token !== 'access-1') return { code: 400, body: { error_code: 'INVALID_ACCESS_TOKEN', error_message: 'bad token' } };
    const accounts = [{ account_id: 'pa1', balances: { current: 1200.1 } }, { account_id: 'pa2', balances: { current: 480.25 } }];
    if (syncPhase === 1) {
      if (!payload.cursor) return { body: { added: [
        { transaction_id: 't1', account_id: 'pa1', amount: 100, date: dIso(1), name: 'SAMPLE ELECTRIC CO ONLINE PMT', merchant_name: 'Sample Electric Co', pending: false, personal_finance_category: { primary: 'RENT_AND_UTILITIES', detailed: 'GAS_AND_ELECTRICITY' } },
        { transaction_id: 't2', account_id: 'pa2', amount: 60, date: dIso(1), name: 'SAMPLE SUPERSTORE #9', merchant_name: 'Sample Superstore', pending: true },
        { transaction_id: 't3', account_id: 'pa1', amount: 15, date: dIso(45), name: 'OLD CHARGE', pending: false } ], modified: [], removed: [], next_cursor: 'c1', has_more: true, accounts } };
      return { body: { added: [
        { transaction_id: 't4', account_id: 'pa1', amount: 200, date: dIso(2), name: 'PAYMENT TO REWARDS CARD', pending: false },
        { transaction_id: 't5', account_id: 'pa2', amount: -200, date: dIso(2), name: 'PAYMENT THANK YOU', pending: false } ], modified: [], removed: [], next_cursor: 'c2', has_more: false, accounts } };
    }
    if (syncPhase === 2) return { body: { added: [{ transaction_id: 't6', account_id: 'pa2', amount: 61.5, date: dIso(1), name: 'SAMPLE SUPERSTORE #9', merchant_name: 'Sample Superstore', pending: false, pending_transaction_id: 't2' }], modified: [], removed: [{ transaction_id: 't1', account_id: 'pa1' }], next_cursor: 'c3', has_more: false, accounts } };
    return { body: { added: [], modified: [], removed: [], next_cursor: 'c3', has_more: false, accounts } };
  }
  return { code: 404, body: { error_code: 'NOT_FOUND', error_message: url } };
};
const hl = R(`startHostedLink({ mode:'spending' })`);
if (hl.url === 'https://secure.plaid.com/hl/test' && g.__fetches.slice(-1)[0].payload.products[0] === 'transactions' && g.__fetches.slice(-1)[0].payload.transactions.days_requested === 31) ok('Hosted Link session created with transactions and days_requested from the start date'); else bad('startHostedLink: ' + JSON.stringify([hl, g.__fetches.slice(-1)[0].payload]));
const fin = R(`finishHostedLink()`);
if (fin.status === 'connected' && fin.connectionId === 'CONN-001' && fin.institution === 'Sample Bank' && fin.accounts.length === 2 && g.__props['PLAID_ACCESS_TOKEN_CONN-001'] === 'access-1' && !g.__props.PLAID_PENDING_LINK) ok('finishHostedLink: token exchanged, stored in Script Properties, Connections row CONN-001 created'); else bad('finishHostedLink: ' + JSON.stringify(fin) + ' props=' + JSON.stringify(Object.keys(g.__props)));
const conn1 = R(`readTable_(TABLES.CONN)[0]`);
if (conn1 && conn1.id === 'CONN-001' && conn1.itemId === 'item-1' && conn1.status === 'Pending' && !/access/.test(JSON.stringify(conn1))) ok('Connections row holds the item id, never the access token'); else bad('conn row: ' + JSON.stringify(conn1));
const map = R(`finishAccountMapping({ connectionId:'CONN-001', institution:'Sample Bank', mappings:[ { externalId:'pa1', accountId:'ACC-007', name:'Everyday Checking', mask:'1111', type:'depository', subtype:'checking', importTx:true, current:1234.56 }, { externalId:'pa2', accountId:'new', name:'Rewards Card', mask:'2222', type:'credit', subtype:'credit card', importTx:true, current:420 } ] })`);
const acc7 = R(`readTable_(TABLES.ACCOUNTS).filter(function(a){ return a.id==='ACC-007'; })[0]`);
const acc14 = R(`readTable_(TABLES.ACCOUNTS).filter(function(a){ return a.externalAccountId==='pa2'; })[0]`);
if (map.linked === 1 && map.created === 1 && acc7.externalAccountId === 'pa1' && acc7.connectionId === 'CONN-001' && acc7.importTx === true && acc14 && acc14.accountType === 'Credit Card' && acc14.connectionId === 'CONN-001') ok('account mapping: ACC-007 linked, new credit-card row created (' + acc14.id + ')'); else bad('finishAccountMapping: ' + JSON.stringify([map, acc7, acc14]));
const s1 = map.synced;
if (s1 && !s1.error && s1.added === 4 && s1.skippedBeforeStart === 1 && s1.balances === 2) ok('first sync: 2 pages read, 4 rows staged, 1 skipped before the start date, 2 balances updated'); else bad('first sync: ' + JSON.stringify(s1));
const st2 = R(`readTable_(TABLES.STAGING).filter(function(s){ return s.provider==='Plaid'; })`);
const byExt = {}; st2.forEach(s => { byExt[s.externalTxId] = s; });
if (byExt.t1 && byExt.t1.status === 'Imported' && byExt.t1.ruleId === 'RULE-001') ok('auto-import rule promoted the utility bill straight to Transactions'); else bad('t1: ' + JSON.stringify(byExt.t1));
if (byExt.t2 && byExt.t2.status === 'Needs Split' && byExt.t2.accountId === acc14.id) ok('split-required merchant held in staging on the new card account'); else bad('t2: ' + JSON.stringify(byExt.t2));
if (byExt.t4 && byExt.t5 && byExt.t4.pairedImportId === byExt.t5.importId && byExt.t4.suggestedType === 'Transfer' && byExt.t5.suggestedType === 'Transfer' && byExt.t4.status === 'Imported' && byExt.t5.status === 'Imported') ok('card payment to an unlinked card auto-paired as Transfer on both sides and imported'); else bad('pair t4/t5: ' + JSON.stringify([byExt.t4, byExt.t5].map(s => s && [s.suggestedType, s.status, s.pairedImportId])));
if (!byExt.t3) ok('transaction before the start date was not staged'); else bad('t3 staged despite start date');
if (near(R(`readTable_(TABLES.ACCOUNTS).filter(function(a){ return a.id==='ACC-007'; })[0].currentBalance`), 1200.1)) ok('balances from the sync written to Accounts'); else bad('balance not updated');
const conn2 = R(`readTable_(TABLES.CONN)[0]`);
if (conn2.status === 'Active' && conn2.syncCursor === 'c2' && !conn2.lastError) ok('connection Active with cursor saved after a successful sync'); else bad('conn after sync: ' + JSON.stringify(conn2));
// second sync: posted replaces pending, bank removes t1
syncPhase = 2;
const s2 = R(`syncAllConnections()`)[0];
const st3 = R(`readTable_(TABLES.STAGING).filter(function(s){ return s.provider==='Plaid'; })`);
const byExt3 = {}; st3.forEach(s => { byExt3[s.externalTxId] = s; });
if (s2.added === 1 && s2.removed === 1 && byExt3.t2.status === 'Superseded' && byExt3.t6.status === 'Needs Split' && byExt3.t6.pendingTxId === 't2') ok('posted charge superseded its pending version and kept the split-required status'); else bad('second sync: ' + JSON.stringify([s2, byExt3.t2 && byExt3.t2.status, byExt3.t6 && byExt3.t6.status]));
const t1tx = R(`readTable_(TABLES.TX).filter(function(t){ return t.id==='${byExt.t1.importedTxId}'; })[0]`);
if (byExt3.t1.status === 'Removed' && t1tx && t1tx.isDeleted === true) ok('a transaction the bank removed is soft-deleted, never erased'); else bad('removal: ' + JSON.stringify([byExt3.t1.status, t1tx && t1tx.isDeleted]));
if (R(`readTable_(TABLES.CONN)[0].syncCursor`) === 'c3') ok('cursor advanced to c3'); else bad('cursor not advanced');
// re-running with nothing new changes nothing
syncPhase = 3;
const before3 = R(`readTable_(TABLES.STAGING).length`);
R(`syncAllConnections()`);
if (R(`readTable_(TABLES.STAGING).length`) === before3) ok('a sync with nothing new adds no rows'); else bad('idempotent sync failed');
// layout check pauses the sync
R(`SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Import Staging').getRange(4, 3).setValue('Renamed by hand')`);
const sBad = R(`syncAllConnections()`)[0];
const connBad = R(`readTable_(TABLES.CONN)[0]`);
if (/Layout changed/.test(sBad.error) && /Layout changed/.test(connBad.lastError) && R(`readTable_(TABLES.STAGING).length`) === before3) ok('a changed header pauses the sync with a plain message and writes nothing'); else bad('layout check: ' + JSON.stringify([sBad.error, connBad.lastError]));
R(`SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Import Staging').getRange(4, 3).setValue('External Transaction ID')`);
// triggers & status
R(`enableNightlySync()`);
if (g.__triggers.length === 1 && g.__triggers[0].getHandlerFunction() === 'syncAllConnections') ok('nightly trigger installed once'); else bad('triggers: ' + g.__triggers.length);
R(`enableNightlySync()`);
if (g.__triggers.length === 1) ok('enabling twice keeps one trigger'); else bad('duplicate triggers');
R(`disableNightlySync()`);
if (g.__triggers.length === 0) ok('nightly trigger removed'); else bad('trigger not removed');
const statusLines = R(`plaidStatus()`);
if (statusLines.join('\n').indexOf('test-secret') < 0 && /PLAID_SECRET: set/.test(statusLines.join('\n'))) ok('status never reveals secret values'); else bad('plaidStatus leaked: ' + statusLines.join(' | '));
// repair flow uses update mode (access_token, no products)
R(`startHostedLink({ connectionId:'CONN-001' })`);
const repairPayload = g.__fetches.slice(-1)[0].payload;
if (repairPayload.access_token === 'access-1' && !repairPayload.products) ok('repair uses Link update mode on the same connection (no new slot)'); else bad('repair payload: ' + JSON.stringify(repairPayload));
R(`PropertiesService.getScriptProperties().deleteProperty('PLAID_PENDING_LINK')`);

/* 11. upgrade path: an older workbook gains the 3.1 tabs, columns and lists without losing rows */
(function () {
  const ssx = g.__ss;
  const del = (sheet, start, n) => ssx.getSheetByName(sheet).deleteColumns(start, n); // SAFETY-APPROVED: test only, on the in-memory mock, to simulate an older workbook
  const snapshotAcc = R(`readTable_(TABLES.ACCOUNTS).map(function(a){ return [a.id, a.name, a.currentBalance]; })`);
  const txCount = R(`readTable_(TABLES.TX).length`);
  ssx.deleteSheet(ssx.getSheetByName('Import Rules')); // SAFETY-APPROVED: test only, mock workbook
  ssx.deleteSheet(ssx.getSheetByName('Connections')); // SAFETY-APPROVED: test only, mock workbook
  del('Accounts', 11, 4); del('Import Staging', 17, 11); del('Monthly Summary', 15, 1); del('Monthly Review', 18, 1); del('Debts', 17, 1); del('Quarterly Debt Review', 11, 1);
  ssx.getSheetByName('Monthly Summary').getRange(4, 8).setValue('Reviewed Debt Balance');
  ssx.getSheetByName('Monthly Review').getRange(4, 11).setValue('Total Debt Balance');
  ['LIST_DEBT_GROUPS', 'LIST_MATCH_TYPES', 'LIST_STAGING_STATUSES', 'LIST_CONNECTION_STATUSES', 'TBL_RULES', 'TBL_CONN'].forEach(n => { const nr = ssx.namedRanges.get(n); if (nr) nr.remove(); });
  const rep = R(`upgradeWorkbook()`);
  const repText = rep.join('\n');
  let good = true;
  Object.values(TABLES).forEach(def => {
    const sh = ssx.getSheetByName(def.sheet);
    if (!sh) { good = false; bad('upgrade: missing ' + def.sheet); return; }
    const hdr = sh.getRange(def.headerRow, 1, 1, def.columns.length).getValues()[0];
    def.columns.forEach((c, i) => { if (hdr[i] !== c.h) { good = false; bad(`upgrade: ${def.sheet} ${colLetter(i + 1)} = "${hdr[i]}" expected "${c.h}"`); } });
    def.columns.forEach((c, i) => { if (c.f && !sh.getRange(def.firstRow, i + 1).getFormula()) { good = false; bad(`upgrade: ${def.sheet}.${c.h} formula missing`); } });
  });
  if (good) ok('upgrade restored every tab, header and calculated column of the 3.1 schema');
  const accAfter = R(`readTable_(TABLES.ACCOUNTS).map(function(a){ return [a.id, a.name, a.currentBalance]; })`);
  if (JSON.stringify(accAfter) === JSON.stringify(snapshotAcc) && R(`readTable_(TABLES.TX).length`) === txCount) ok('upgrade kept every Accounts and Transactions row unchanged'); else bad('upgrade changed data rows');
  if (/renamed from "Reviewed Debt Balance"/.test(repText) && /Added tab: Import Rules/.test(repText) && /Added list: Debt Groups/.test(repText)) ok('upgrade report lists the rename, new tabs and new lists'); else bad('upgrade report: ' + repText);
  if (['LIST_DEBT_GROUPS', 'LIST_MATCH_TYPES', 'LIST_STAGING_STATUSES', 'LIST_CONNECTION_STATUSES'].every(n => ssx.namedRanges.has(n))) ok('new dropdown lists have named ranges after upgrade'); else bad('list named ranges missing after upgrade');
  const debtTypes = ssx.getRangeByName('LIST_DEBT_TYPES').getValues().map(r => r[0]);
  if (debtTypes.indexOf('Tax Debt') >= 0) ok('existing list gained the new value Tax Debt'); else bad('Tax Debt not appended: ' + debtTypes.join(','));
  const namesAfter = ssx.getSheets().map(s => s.getName());
  if (JSON.stringify(namesAfter) === JSON.stringify(TAB_ORDER)) ok('tab order restored after upgrade'); else bad('tab order after upgrade: ' + namesAfter.join(' | '));
  if (ssx.getRangeByName('SETTING_CHANGE_LOG').getValue() === true && ssx.getRangeByName('SETTING_AUTO_PAIRS').getValue() === true) ok('settings preserved through the App Setup rebuild'); else bad('settings lost in upgrade');
  const rep2 = R(`upgradeWorkbook()`).join('\n');
  if (!/added column|Added tab|Added list/.test(rep2)) ok('running the upgrade again changes nothing'); else bad('second upgrade not idempotent: ' + rep2);
  ssx.getSheetByName('Transactions').getRange(4, 2).setValue('Day');
  let threw = '';
  try { R(`upgradeWorkbook_()`); } catch (e) { threw = String(e.message || e); }
  if (/Transactions column B/.test(threw)) ok('a hand-renamed header stops the upgrade before any change'); else bad('conflict not detected: ' + threw);
  ssx.getSheetByName('Transactions').getRange(4, 2).setValue('Date');
})();

/* 12. financial snapshot for AI */
const snap = R(`getSnapshotText()`);
const must = ['# Household Finance Snapshot', '## Income (paychecks)', '## Monthly cash flow', '## Spending by category', '## Savings & reserves', '## Debts', 'Student loans:', '## Accounts and net worth', 'tracked net worth', '## Recurring obligations', '## Credit scores', '## Data quality notes', 'SAMPLE data'];
const missing = must.filter(m => snap.indexOf(m) < 0);
if (!missing.length) ok('snapshot has every section, separates student loans, and warns about sample data'); else bad('snapshot missing: ' + missing.join(', '));
if (snap.indexOf('Sample Student Loan') >= 0 && snap.indexOf('Student loans: $11,405.00') >= 0 && snap.indexOf('| October 2026 | $7,641.60 | $4,774.19 | $550.00 | $570.00 |') >= 0 && snap.indexOf('Emergency Fund') >= 0 && snap.indexOf('no score entered yet') >= 0) ok('snapshot numbers come from the raw tables (October cash flow matches QA, student loans $11,405.00 from the latest review, funds, credit scores)'); else bad('snapshot content check failed');
if (!/access-|PLAID_|pa1|item-1/.test(snap)) ok('snapshot contains no tokens, external IDs or item IDs'); else bad('snapshot leaked an identifier');
if (R(`buildSnapshotText_({ asOf:new Date(), tz:'UTC', persons:['Ben','Valerie'], samplePresent:false, income:[], tx:[], accounts:[], debts:[], qdr:[], funds:[], budgets:[], plans:[], recurring:[], credit:[], nw:[], staging:[], reviews:[] })`).indexOf('# Household Finance Snapshot') === 0) ok('snapshot builder copes with an empty workbook'); else bad('snapshot on empty data failed');

vm.runInContext('clearSampleData()', ctx);
const left = vm.runInContext("readTable_(TABLES.TX).filter(r => r.createdBy === 'sample-data').length", ctx);
const realLeft = vm.runInContext("readTable_(TABLES.ACCOUNTS).filter(a => /^ACC-0(0[6-9]|1[0-3])$/.test(a.id)).length", ctx);
const stagedLeft = vm.runInContext("readTable_(TABLES.STAGING).filter(s => String(s.notes).indexOf('SAMPLE') === 0).length", ctx);
if (left === 0 && realLeft === 8 && stagedLeft === 0) ok('clearSampleData() removes tagged rows (incl. sample rules and staged rows) and keeps the 8 real accounts'); else bad(`clearSampleData left ${left} sample tx, ${stagedLeft} sample staged rows, ${realLeft} real accounts`);

console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll mock checks passed.');
process.exit(failures ? 1 : 0);

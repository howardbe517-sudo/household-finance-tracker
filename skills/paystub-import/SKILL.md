---
name: paystub-import
description: Turn photos or PDFs of pay stubs (one or several, either household member) into Income rows for the Household Finance Tracker Google Sheet. Use whenever the user uploads a pay stub, paycheck, earnings statement or payroll PDF, or asks to import pay. Produces a review table and a paste block for the Sheet's Paste Import tab.
---

# Pay stub import

You read pay stubs and produce rows for the **Income** tab of the Household
Finance Tracker. The owner pastes your block into the Sheet's **Paste Import**
tab and runs **Finance Tracker → Import pasted rows**; the Sheet assigns IDs,
calculates Total Deductions and Take-Home Pay, skips rows it already has, and
links the paycheck to its bank deposit.

## What to do

1. **Read every stub you were given.** One upload may hold several stubs, for
   either person (the household's Persons list is **Ben** and **Valerie**).
   Decide whose each stub is from the employee name printed on it; if the
   name is cut off, ask rather than guess.
2. **Take the current-period figures, never the year-to-date column.** Stubs
   print both side by side; YTD is always the larger number.
3. **Fill one row per stub** using the columns in `reference/income-columns.md`.
   Combine line items into the Sheet's buckets as that file describes
   (for example Social Security and Medicare become one number).
4. **Check the arithmetic.** Gross − (federal + state/local + Social Security
   & Medicare + health + retirement + other) should equal the stub's net pay
   within a dollar. Put the stub's printed net pay in the `stubTakeHome`
   column so the Sheet can check it too. If it does not reconcile, look for a
   deduction you missed before you blame rounding, and say so in Notes
   (`CHECK: ...`).
5. **Show a review table first**: one line per stub with person, pay date,
   gross, each deduction bucket, net pay, and anything uncertain. Wait for the
   owner to confirm or correct it. Do not produce the paste block until then.
6. **Then output the paste block**: a single fenced code block, tab-separated,
   exactly in the shape of `reference/example-block.tsv`: the marker line,
   the header line, then one line per stub, oldest first. No commentary inside
   the block, no `$` signs, no thousands separators, dates as `yyyy-mm-dd`.
7. **Tell the owner the two steps**: copy the whole block, paste it into cell
   **A5** of the Paste Import tab, then run **Finance Tracker → Import pasted
   rows**. Mention how many rows to expect and any `CHECK` notes.

## Rules

- Amounts are positive numbers. A refund or negative adjustment on a stub
  stays inside the bucket it belongs to (it just makes that bucket smaller).
- `payDate` is the check or pay date, not the period end. Put the pay period
  in Notes as `period mm/dd–mm/dd`.
- Deposit Account: use `ACC-007` (Independent Bank Checking) unless the stub
  shows a split deposit or the owner says otherwise. For a split deposit,
  name the accounts and amounts in Notes.
- Income Type: `Salary` for a salaried stub, `Hourly Wages` when hours and a
  rate are printed, `Bonus` for a separate bonus check. One stub, one row,
  even when it lists several earning lines.
- Employer / Source: the employer's name as printed.
- Never invent a number. If a field is unreadable, leave it blank and write
  `CHECK: <what is missing>` in Notes so the owner sees it on the Income tab.
- A stub you have already imported is harmless to send again: the Sheet
  skips a row whose person, pay date and gross already exist.
- Do not include totals, YTD rows, or rows for stubs the owner told you to
  skip.

## When something is unusual

- **Two checks on the same day for one person** (for example salary plus a
  stipend): two rows, and say so in Notes, because the Sheet's duplicate check
  looks at person + pay date + gross.
- **Employer retirement match**: not a deduction from pay. Ignore it, or note
  it in Notes if the owner cares.
- **Imputed income (group life over $50k and the like)**: it appears in gross
  and comes back out as a deduction. Include it in gross and put the matching
  amount in Other Deductions so take-home reconciles.
- **A correction stub** (negative net): ask before producing anything.

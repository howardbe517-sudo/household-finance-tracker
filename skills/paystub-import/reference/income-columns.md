# Income columns (what the Sheet accepts)

Header line of the paste block: use these keys, in any order. Columns not
listed here are calculated by the Sheet and must not be sent (Income ID,
Month, Total Deductions, Take-Home Pay, Linked Deposit TX, Last Updated).

| Key | Sheet header | Put here |
|---|---|---|
| `payDate` | Pay Date | Check / pay date, `yyyy-mm-dd` |
| `person` | Person | `Ben` or `Valerie` |
| `employer` | Employer / Source | Employer name as printed |
| `incomeType` | Income Type | `Salary`, `Hourly Wages`, `Bonus`, `Commission`, `Side Income`, `Reimbursement`, `Other` |
| `gross` | Gross Pay | Current-period gross: every earnings line added together, including imputed income |
| `fedTax` | Federal Tax | Federal income tax withheld |
| `stateTax` | State / Local Tax | State income tax + any city tax, added together |
| `ssMed` | Social Security & Medicare | OASDI / Social Security + Medicare (FICA), added together |
| `health` | Health / Insurance | Medical, dental and vision premiums, added together |
| `retirement` | Retirement Contribution | Employee pension and plan contributions: MIP / DC / MPSERS, 401(k), 403(b), 457, Roth 403(b). Not the employer match |
| `otherDed` | Other Deductions | Everything else taken from pay: union dues, HSA or FSA contributions, life or disability insurance, garnishments, parking, imputed-income offsets |
| `depositAccount` | Deposit Account ID | `ACC-007` (Independent Bank Checking) unless told otherwise |
| `notes` | Notes | `period mm/dd–mm/dd`, split deposits, anything uncertain as `CHECK: ...` |
| `stubTakeHome` | (check only) | The net pay printed on the stub. Not stored; the Sheet compares it to gross − deductions and notes a mismatch |

## Bucket decisions that come up often

- An HSA payroll contribution is *not* health insurance; it goes in Other
  Deductions, and the Notes can say `HSA 120.00` so it can be traced.
- Pre-tax and after-tax versions of the same thing (Roth 403(b) and 403(b))
  both go in Retirement.
- "Total Taxes" on a stub is not a bucket: split it into federal, state/local
  and Social Security & Medicare.
- Reimbursements paid through payroll (mileage, cell phone) are in gross on
  the stub; keep them in gross and mention the amount in Notes so the owner
  can move it to a Reimbursement row later if they want.

# Data Import and Export

## Import

Every import screen works the same way: upload a file, **or paste or dictate** the rows into the box, check the text, then create the records.

| What | Where | Formats |
|---|---|---|
| **Logframe** | Project → Logframe → **Import logframe from Excel** | XLSX, CSV, TXT (Logframe sheet of the template) |
| **Indicators** | Logframe → **Import indicators from Excel** | XLSX, CSV, TXT (Indicators sheet). Codes must match logframe items. |
| **Activities** | Project → Activities → **Import activities from Excel** | XLSX, CSV, TXT. Each row goes to the reporting period containing its date; a **Logframe Code (Output or Activity)** column links it to an output or planned activity. |
| **Evidence records** | Project → Evidence → import | Evidence template (XLSX/CSV) |
| **Indicator values** | Reporting period → Update Project → **Import from Google Sheets**, or Data & story inputs (paste CSV) | Google Sheets; CSV |
| **Indicator values, all periods** | Project → **Data → Import / export** | XLSX or CSV from the downloaded data sheet. Preview first; verified values are never overwritten. See [How to use the Data Center](/support/how-to/use-the-data-center). |
| **Donor template** | Project → Templates | Word, PDF, text, Markdown, Excel, CSV |

Every import page has **Download template**. DonorDesk shows the **parsed content for review** before creating records, and rows whose codes or titles already exist are **skipped**, so re-importing is safe.

## Export

| What | Where | Formats |
|---|---|---|
| Report | Report editor → **Export report** | Word, PDF (donor-native rendering when mapped) |
| Indicator table | Export Center | Excel |
| Data sheet (all periods, finance) | Project → **Data** → Download Excel / CSV | XLSX, CSV |
| Evidence checklist | Export Center | Excel/document |
| Evidence pack | Export Center | ZIP |

Exports go through the report gate and are stored with history. See [How to export reports](/support/how-to/export-reports).

## Your data is portable

You can export at any time, and cancelling or downgrading never removes your data.

See [File formats](/support/reference-file-formats).

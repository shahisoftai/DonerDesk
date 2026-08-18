# Advanced: Understanding Data Import and Export

DonorDesk supports importing and exporting data in various formats. This guide covers the advanced options.

## Import Capabilities

### What Can Be Imported

| Data type | Formats | How |
|----------|--------|-----|
| Logframe | XLSX, CSV, TXT | Logframe → Import |
| Indicators | XLSX, CSV | Indicators → Import |
| Indicator data | Google Sheets | Indicators → Import from Sheets |
| Activities | XLSX, CSV | Activities → Bulk import |

### Preparing Data for Import

**File Requirements:**
- First row must be headers
- No merged cells in Excel
- Consistent column structure
- Date format: YYYY-MM-DD or MM/DD/YYYY

**Data Quality:**
- Remove extra spaces
- Use consistent codes
- Fill in all required fields
- Remove empty rows

## Export Capabilities

### What Can Be Exported

| Data type | Formats | How |
|----------|--------|-----|
| Reports | PDF, DOCX | Reports → Export |
| Indicator data | XLSX, CSV | Indicators → Export |
| Evidence | ZIP (with files) | Evidence → Export Pack |
| Audit log | CSV, PDF | Settings → Audit Log → Export |
| Compliance | PDF | Compliance → Export |

### Large Export Handling

For large exports (many files, large evidence packs):
1. Export during off-peak hours
2. Use the ZIP format for evidence packs
3. Consider exporting in batches (by period, by project)

## CSV Formatting Tips

### Standard CSV Format

```
code,name,type,baseline,target,unit
OUT-1,Women receiving ANC,number,0,400,women
OUT-2,% exclusive breastfeeding,percentage,0,75,%
OUT-3,Children screened for malnutrition,number,0,1000,children
```

### UTF-8 Encoding

Always save CSV files as UTF-8 to preserve special characters:
- In Excel: Save As → More Options → Tools → Web Options → Encoding → UTF-8
- In Google Sheets: File → Download → CSV

### Handling Commas and Quotes

If your data contains commas:
- Wrap the field in quotes: `"This, that, and more"`
- Use a different delimiter: tab-separated (TSV)

## Google Sheets Integration

### Connecting Google Sheets

1. Go to **Settings → Integrations**
2. Click **Connect Google Sheets**
3. Authorise access to your Google Drive
4. Choose which sheets DonorDesk can access

### Importing from Google Sheets

1. Go to the data section (Indicators, Activities)
2. Click **Import from Google Sheets**
3. Select the spreadsheet
4. Map columns to fields
5. Preview and confirm

### Live Connection

Some imports create a live connection:
- The data updates when the sheet is updated
- Changes in the sheet reflect in DonorDesk
- Breaking the sheet link will not remove existing data

## API Access (Enterprise)

Enterprise plans may include API access for custom integrations.

### What the API Provides

- Read access to all DonorDesk data
- Write access for supported entities
- Custom report generation
- Integration with other systems

### Getting API Access

Contact **support@donordesk.online** to discuss API requirements.

## Data Validation on Import

### Validation Rules

DonorDesk validates imports against:
- Required fields are present
- Data types are correct (numbers, dates)
- Codes are unique
- Foreign keys exist (e.g., project code exists)

### Handling Validation Errors

If import fails:
1. Download the error report
2. Fix errors in your source file
3. Re-upload

Common errors:
- Missing required columns
- Invalid date formats
- Duplicate codes
- Codes referencing non-existent items

## Scheduled Exports

Coming soon: Set up automatic exports on a schedule.

Example use cases:
- Export indicator data monthly
- Generate reports automatically at period end
- Back up evidence weekly

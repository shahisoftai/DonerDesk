# Understanding Imported vs Linked Data

DonorDesk handles different types of data connections. Understanding the difference helps you manage your data effectively.

## Data Connection Types

### 1. Uploaded Data

Data you transfer from your device to DonorDesk.

**Examples:**
- Evidence files uploaded from your computer
- Logframe imported from Excel
- Indicators imported from CSV

**Characteristics:**
- Stored on DonorDesk servers
- Uses your storage quota
- Managed entirely within DonorDesk
- Backed up by DonorDesk

### 2. Linked Data

Data that stays in its original location with only a reference stored in DonorDesk.

**Examples:**
- Files linked from Google Drive
- Indicators imported from Google Sheets (live connection)

**Characteristics:**
- Original data stays in its source system
- Does not use DonorDesk storage quota
- Access depends on source system permissions
- Backup depends on source system

### 3. Synced Data

Data kept in sync between systems automatically.

**Currently limited in DonorDesk:**
- Google Sheets import is one-way (Sheets → DonorDesk)
- No live bidirectional sync

## Comparing Data Types

| Aspect | Uploaded | Linked |
|--------|----------|--------|
| Storage location | DonorDesk servers | Your Google Drive |
| Storage quota | Uses quota | No quota impact |
| Access requires | DonorDesk login | Drive access + DonorDesk |
| Backup by DonorDesk | Yes | No (relies on Drive) |
| Works offline | Yes | No |
| Updates reflect | Manual re-upload | Automatic (for live links) |

## Google Drive Linking

### Benefits of Linking

1. **No storage quota used** — Files stay in your Drive
2. **Single source of truth** — No duplicate files
3. **Familiar tools** — Work in Drive as normal
4. **Access control** — Use Drive sharing settings

### Limitations of Linking

1. **Requires internet** — Cannot access without connection
2. **Permission dependency** — If Drive access is removed, link breaks
3. **Less control** — Cannot enforce DonorDesk permissions on Drive files

### When to Use Linking

- Large files that would use quota
- Files your team edits frequently
- Files that multiple people need to access
- Files already stored in Drive

### When to Use Upload

- Small files you rarely change
- Critical files you want DonorDesk to manage
- Files you want backed up with DonorDesk

## Google Sheets Import

### How It Works

1. You connect your Google Sheets
2. You select which sheet to import
3. You map columns to DonorDesk fields
4. Data is imported into DonorDesk

### Import vs Live Link

| Feature | One-time Import | Live Connection |
|---------|----------------|----------------|
| Updates from Sheet | No | Yes (re-import needed) |
| Storage | DonorDesk | DonorDesk |
| Works offline | Yes | Yes (imported data) |
| Setup effort | Per-import | One-time setup |

## Managing Mixed Data

Most projects use a mix:

**Example:**
- Donor reports (uploaded — important, needs backup)
- Attendance sheets (linked from Drive — large, frequently edited)
- Photos (linked from Drive — large, rarely edited)
- Indicator data (imported from Sheets — updated regularly)

## What Happens If...

### Linked Drive file is deleted?

The link in DonorDesk breaks and shows as unavailable. You need to relink or re-upload.

### Linked Drive file permissions change?

If someone loses Drive access, the link may not work for them. They need to be given Drive access.

### You disconnect Google Drive?

All Drive links become unavailable. Upload files to DonorDesk or reconnect Drive.

### Sheet data changes after import?

Changes in Google Sheets do NOT automatically update DonorDesk. You need to re-import.

## Best Practices

1. **Know what is linked vs uploaded** — Check the Evidence library for link icons
2. **Document your data connections** — Note which files are linked from where
3. **Maintain source file access** — Ensure team members have Drive access
4. **Re-import when needed** — Update imported data before report deadlines
5. **Back up critical files** — For important evidence, consider uploading as backup

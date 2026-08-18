# Understanding Evidence in DonorDesk

Evidence is the proof that your project activities actually happened and achieved their results. Donors require evidence to verify that funds were used correctly and that promised activities were delivered.

## What Counts as Evidence?

DonorDesk accepts many types of evidence files:

| Type | Examples |
|------|---------|
| **Attendance sheets** | Sign-in sheets, participant lists |
| **Photos** | Field activities, training sessions, events |
| **Reports** | Monitoring reports, field visit reports |
| **Training records** | Training materials, session reports |
| **Distribution lists** | Beneficiaries who received items |
| **Procurement documents** | Purchase orders, receipts, invoices |
| **Approval documents** | Sign-offs, permits, authorisations |
| **Financial documents** | Expenditure reports, payment records |
| **Meeting minutes** | Community meetings, stakeholder consultations |
| **Kobo/ODK exports** | Data exports from mobile data collection |
| **Case studies** | Success stories, beneficiary testimonials |
| **Other** | Any other supporting document |

## Supported File Formats

DonorDesk accepts:
- **PDF** (.pdf)
- **Word documents** (.docx, .doc)
- **Excel spreadsheets** (.xlsx, .csv)
- **Images** (.jpg, .jpeg, .png)
- **Text files** (.txt)

Maximum file size depends on your plan and storage method.

## Evidence Metadata

When you upload evidence, you fill in important details:

- **Title** — A short, clear name for the file
- **Evidence type** — What kind of evidence it is (from the list above)
- **Project** — Which project it belongs to
- **Reporting period** — Which reporting period it relates to
- **Related activity** — Which activity it supports
- **Related output/indicator** — Optional link to a specific output or indicator
- **Location** — Where the activity took place
- **Date of activity** — When the activity happened
- **Confidentiality level** — Public, Internal, Sensitive, or Highly Sensitive
- **Notes** — Any additional information

## Confidentiality Levels

| Level | What it means |
|-------|--------------|
| **Public** | Can be shared openly, included in donor reports |
| **Internal** | For organisation use only, not shared with beneficiaries |
| **Sensitive** | Contains personal data, needs restricted access |
| **Highly Sensitive** | Contains highly personal or protected data (e.g., beneficiary addresses, case files) |

When exporting reports, DonorDesk warns you if sensitive evidence is included so you can make an informed decision.

## Evidence Verification Status

Each piece of evidence goes through a verification process:

| Status | Meaning |
|--------|---------|
| **Uploaded** | Just uploaded, not yet reviewed |
| **AI Tagged** | AI has suggested tags for classification |
| **Pending Review** | Awaiting human review |
| **Verified** | Reviewed and confirmed as valid |
| **Needs Correction** | Has an issue that needs to be fixed |
| **Rejected** | Cannot be used as evidence |
| **Archived** | Old or superseded evidence |

## How to Upload Evidence

### Upload from your computer:

1. Go to your project → **Evidence** tab
2. Click **Upload Evidence**
3. Select the file from your computer
4. Fill in the metadata fields
5. Click **Upload**

### Link from Google Drive:

If you have connected your Google Drive:

1. Go to your project → **Evidence** tab
2. Click **Link from Drive**
3. Browse to your file in Google Drive
4. Select it
5. Fill in the metadata
6. Click **Link**

This creates a reference to your Drive file — no extra storage is used in DonorDesk.

## AI Evidence Tagging

When you upload evidence, DonorDesk automatically analyses it to suggest tags:

1. The AI reads the document content
2. It suggests relevant tags based on the content
3. Tags cover: sector, activity type, location, beneficiary group, etc.
4. You review and accept or adjust the suggestions

This helps you organise large volumes of evidence quickly and makes search more effective.

## Linking Evidence to Activities and Indicators

Evidence becomes more powerful when linked:

1. Upload the evidence
2. In the metadata, select the **related activity**
3. Optionally select the **related output** and **indicator**
4. Save

Linked evidence appears in the compliance checklist and in report drafts automatically.

## Evidence Verification Workflow

### Step 1: Upload

Anyone on the project team can upload evidence. It starts with status "Uploaded".

### Step 2: AI Tagging

Within a few moments of upload, AI automatically suggests tags. Status becomes "AI Tagged".

### Step 3: Review

A designated reviewer (M&E Officer, Compliance Officer) reviews the evidence:
- Check the file is genuine and relevant
- Verify the metadata is correct
- Accept or adjust the AI tags

Status changes to "Verified" or "Needs Correction".

### Step 4: Use in Reports

Verified evidence can be cited in report drafts and exported to donors.

## Searching and Filtering Evidence

The Evidence Library has powerful search and filter tools:

**Filter by:**
- Project
- Reporting period
- Activity
- Indicator
- Evidence type
- Upload date
- Verification status
- Confidentiality level
- Location

**Search by:**
- File name
- Evidence title
- Notes
- Extracted text content (DonorDesk reads the text inside documents)
- Tags

## Evidence in the Compliance Checklist

The compliance checklist automatically identifies evidence gaps:

- It checks if each activity has supporting evidence
- It flags activities with no evidence or weak evidence
- It links verified evidence to compliance items
- Items are marked as resolved when sufficient evidence is uploaded

## Storage: Google Drive vs DonorDesk Storage

| Storage Type | How it works | Uses your quota? | Best for |
|-------------|-------------|-----------------|---------|
| **Google Drive (link-first)** | File stays in your Drive, DonorDesk stores only a link | No | Most files, especially large ones |
| **DonorDesk storage (Local/R2)** | File is stored on DonorDesk servers | Yes | Quick access, offline uploads |

We recommend using Google Drive for most files to save your storage quota for files that cannot be stored externally.

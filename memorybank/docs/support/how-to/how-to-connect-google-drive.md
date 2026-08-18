# How to Connect Google Drive

Connecting Google Drive lets you link evidence files from your own Drive instead of uploading them to DonorDesk. This saves storage space and keeps files in your control.

## What "Link-First" Means

When you link a file from Google Drive:
- The file stays in your Google Drive
- DonorDesk stores only a link (not a copy)
- No storage quota is used
- The file can be accessed through your Drive

## Before You Start

- You need Owner or Admin role
- Your organisation must have a Google account (Google Workspace or personal Gmail)
- The person setting this up must have access to the Google Drive folder they want to use

## Step-by-Step

### Step 1: Go to Storage Settings

1. Click your name → **Settings**
2. Click **Storage** or **Google Drive**
3. Click **Connect Google Drive**

### Step 2: Authorise Access

1. You will be redirected to Google
2. Sign in with your Google account
3. Click **Allow** to give DonorDesk permission to:
   - See your Google Drive files
   - Access file links for evidence
   - Create folders in your Drive

### Step 3: Choose the Main Folder

Select which Google Drive folder DonorDesk should use as the root for project evidence.

We recommend creating a dedicated folder, e.g., "DonorDesk Evidence".

### Step 4: Confirm

Click **Confirm** to save the connection.

## How DonorDesk Uses Your Drive

When you link evidence from Drive:

1. DonorDesk creates a structured folder hierarchy in your Drive:
   ```
   DonorDesk Evidence/
     ProjectName/
       ReportingPeriod/
         01_Attendance/
         02_Photos/
         03_Reports/
         ...
   ```

2. Files you link appear in DonorDesk as references
3. When exporting evidence packs, DonorDesk downloads from your Drive and packages them

## Linking Evidence from Drive

### Step 1: Go to Evidence

1. Open your project
2. Click **Evidence** tab
3. Click **Link from Drive**

### Step 2: Browse and Select

1. Browse through your Google Drive
2. Select the file you want to link
3. Click **Select**

### Step 3: Fill in Metadata

Fill in the evidence details (title, type, date, etc.) as you would for an uploaded file.

### Step 4: Save

Click **Link Evidence**.

The file appears in your Evidence Library with a Drive icon, indicating it is linked (not stored in DonorDesk).

## Organisation vs Project Drive Access

You can set up Drive connection at two levels:

| Level | Who it affects | What is stored |
|-------|---------------|---------------|
| **Organisation** | All projects in the workspace | One Drive root folder, shared across projects |
| **Project** | One project only | Project-specific subfolder |

The organisation-level connection is recommended for most teams.

## Disconnecting Google Drive

To remove the Drive connection:

1. Go to **Settings → Storage**
2. Click **Disconnect Google Drive**
3. Confirm

**Note:** This does not delete any files from your Google Drive. It only removes the link from DonorDesk. Existing linked evidence files remain accessible but will show as disconnected.

## Permissions Needed

For the Google Drive connection to work:
- The Google account used must have access to the Drive folder
- If Drive access is revoked, linked evidence files will show as unavailable

## Troubleshooting

### "Access denied" when browsing Drive

The Google account does not have access to the selected folder. Grant access in Google Drive sharing settings.

### Files not appearing in Drive

DonorDesk creates folders automatically. If a folder does not appear:
1. Check that the account has edit access to the parent folder
2. Try refreshing the Drive connection in Settings

### Linked evidence shows as unavailable

The Google account may have lost access. Re-authorise in Settings → Storage.

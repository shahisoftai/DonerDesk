# Error Codes Explained

When something goes wrong in DonorDesk, you may see an error code. Here is what they mean and how to fix them.

## Authentication Errors

### ERR_AUTH_001 — "Invalid credentials"
Your email or password is incorrect.
**Fix:** Use "Forgot password" to reset, or check for typos.

### ERR_AUTH_002 — "Account suspended"
Your account has been suspended.
**Fix:** Contact the workspace Owner to restore your account.

### ERR_AUTH_003 — "Email not verified"
You must verify your email before logging in.
**Fix:** Check your inbox for the verification email, or use "Resend verification email."

### ERR_AUTH_004 — "Session expired"
Your login session has timed out.
**Fix:** Log in again.

## Permission Errors

### ERR_PERM_001 — "Insufficient permissions"
Your role does not allow this action.
**Fix:** Ask an Admin to give you a higher role or the specific permission.

### ERR_PERM_002 — "Project access denied"
You do not have access to this project.
**Fix:** Ask the project owner or admin to add you to the project.

### ERR_PERM_003 — "Billing access denied"
Only the Owner can manage billing.
**Fix:** The Owner must make the billing change, or transfer ownership.

## Upload Errors

### ERR_UPLOAD_001 — "File too large"
Your file exceeds the size limit for your plan.
**Fix:** Compress the file, split it, or upgrade your plan.

### ERR_UPLOAD_002 — "Unsupported file type"
The file format is not accepted.
**Fix:** Convert to a supported format (PDF, DOCX, XLSX, JPG, PNG, TXT).

### ERR_UPLOAD_003 — "Storage quota exceeded"
You have used all your storage.
**Fix:** Delete old files or link from Google Drive.

### ERR_UPLOAD_004 — "Upload failed"
The upload process encountered an error.
**Fix:** Try again. If it persists, contact support.

## Report Errors

### ERR_REPORT_001 — "No data for this period"
There is no data to generate a report.
**Fix:** Add activities, upload evidence, and update indicators before generating.

### ERR_REPORT_002 — "AI generation failed"
The AI service could not complete the request.
**Fix:** Try again. If it persists, check your internet connection or try later.

### ERR_REPORT_003 — "Credits exhausted"
You have used all your AI credits for this month.
**Fix:** Wait for credits to reset on the 1st, or upgrade your plan.

### ERR_REPORT_004 — "Sections not reviewed"
AI-generated sections must be reviewed before export.
**Fix:** Review each section and mark as reviewed.

### ERR_REPORT_005 — "Critical items unresolved"
Critical compliance items are blocking export.
**Fix:** Resolve or accept the critical items in the compliance checklist.

## Billing Errors

### ERR_BILL_001 — "Payment declined"
Your card was declined.
**Fix:** Try a different card or contact your bank.

### ERR_BILL_002 — "Plan limit reached"
You have reached your plan's project or user limit.
**Fix:** Archive old projects or upgrade your plan.

### ERR_BILL_003 — "Invoice not found"
The requested invoice does not exist.
**Fix:** Contact support with your invoice details.

## Data Errors

### ERR_DATA_001 — "Indicator not found"
The indicator code does not exist in this project.
**Fix:** Check for typos in the code, or create the indicator first.

### ERR_DATA_002 — "Duplicate entry"
This record already exists.
**Fix:** Check if the item was already created.

### ERR_DATA_003 — "Required field missing"
A required field was not filled in.
**Fix:** Go back and fill in all required fields (marked with *).

### ERR_DATA_004 — "Invalid value"
The value entered is not valid for this field.
**Fix:** Check the field type — for example, numeric fields cannot accept text.

## General Errors

### ERR_GEN_001 — "Something went wrong"
An unexpected error occurred.
**Fix:** Try refreshing the page. If it persists, contact support with the error reference number.

### ERR_GEN_002 — "Service temporarily unavailable"
The server is undergoing maintenance or experiencing high load.
**Fix:** Wait a few minutes and try again.

### ERR_GEN_003 — "Too many requests"
You are making requests too quickly.
**Fix:** Slow down your actions and wait before retrying.

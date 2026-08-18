# Understanding Compliance in DonorDesk

The compliance checklist is one of DonorDesk's most powerful features. It automatically checks whether your project has all the evidence and documentation it needs before you submit a report to your donor.

## What is the Compliance Checklist?

The compliance checklist is a list of items that DonorDesk generates to identify gaps in your evidence and documentation. It compares what your donor requires against what you have actually uploaded and verified.

The checklist is generated automatically when you create a reporting period and is continuously updated as you upload evidence, log activities, and update indicators.

## Types of Compliance Items

The checklist identifies several types of gaps:

### Missing Evidence
- "Attendance sheet missing for caregiver training on 12 July"
- "No photo evidence for the distribution event on 3 August"

### Incomplete Metadata
- "Evidence 'Training Report Aug' is missing location information"
- "Activity 'Health camp' has no date set"

### Unverified Indicators
- "Indicator OUT-1 (Women receiving ANC) is not updated for Q3"
- "Indicator ACT-3 (Sessions conducted) is still in draft status"

### Unsupported Report Claims
- "Report section 'Achievements' states '500 beneficiaries reached' but no linked evidence found"

### Missing Annexes
- "Donor template requires 'Procurement tracker' annex but no file uploaded"

### Unreviewed AI Content
- "AI-generated section 'Challenges' has not been reviewed by a human"

### Late Activity Updates
- "Activity 'Community meeting' was logged 15 days after the event date"

### Sensitive Data Warnings
- "Evidence 'Beneficiary case file' is marked Highly Sensitive — ensure proper handling before export"

## Severity Levels

Each compliance item has a severity level:

| Level | What it means | Action needed |
|-------|-------------|--------------|
| **Low** | Minor issue, does not block export | Review when convenient |
| **Medium** | Should be addressed before submission | Fix within a few days |
| **High** | Important gap that donors will notice | Fix before export |
| **Critical** | Will cause donor concern or report rejection | Fix immediately |

## Checklist Statuses

Each item on the checklist has one of these statuses:

| Status | Meaning |
|--------|---------|
| **Open** | Identified gap, not yet addressed |
| **In Progress** | Work is underway to resolve it |
| **Resolved** | Evidence or documentation has been provided |
| **Accepted Risk** | Team has decided to accept this gap with justification |
| **Not Applicable** | This item does not apply to this project |

## How the Checklist Works

### Automatic Generation

When you create a reporting period, DonorDesk automatically generates checklist items by:

1. Reading your donor template requirements
2. Checking your logframe (each activity/output needs evidence)
3. Verifying that AI-generated content has been reviewed
4. Comparing uploaded evidence to activities
5. Checking indicator update status

### Ongoing Updates

As you work in DonorDesk:
- Uploading verified evidence → marks related items as resolved
- Updating indicators → removes unverified indicator items
- Reviewing AI content → removes unreviewed AI items
- Logging activities with evidence → resolves missing evidence items

### Manual Additions

You can also manually add checklist items:
1. Go to the **Compliance** tab
2. Click **Add Item**
3. Fill in the type, title, description, and severity
4. Assign to a team member
5. Set a due date

## Resolving Checklist Items

### Resolve by Uploading Evidence

The most common way to resolve an item:
1. Click on the compliance item
2. See what evidence is missing
3. Upload and verify the required evidence
4. The item automatically resolves

### Resolve by Updating Indicators

1. Open the indicator update
2. Fill in the period values
3. Submit to verify
4. The item resolves

### Accept Risk

If you cannot resolve a gap (e.g., donor agreed verbally to waive a requirement):

1. Click on the compliance item
2. Click **Accept Risk**
3. Write a justification (e.g., "Donor confirmed in email dated 15 Aug that this annex is not required")
4. The item moves to "Accepted Risk" status

### Mark as Not Applicable

If the item does not apply to your project:

1. Click on the compliance item
2. Click **Not Applicable**
3. Add a note explaining why
4. The item moves to "N/A" status

## Pre-Export Warnings

Before you export a report, DonorDesk shows a summary of all open compliance items:

- Unresolved critical items
- Unverified indicators
- Unreviewed AI sections
- Sensitive evidence included

You must acknowledge these warnings before downloading. Only "Accepted Risk" items do not block export.

## The Readiness Score

The readiness score (0-100%) tells you how close you are to a submittable report:

| Score | Meaning |
|-------|---------|
| 0-30% | Major gaps — report is not ready |
| 31-60% | Some gaps — address high/critical items first |
| 61-80% | Mostly ready — only minor items remain |
| 81-95% | Ready — only low/medium items may remain |
| 96-100% | Fully ready — all items resolved or accepted |

The score is calculated from:
- Section completion (25%)
- Indicator updates (20%)
- Evidence completeness (25%)
- Compliance checklist (20%)
- Approval status (10%)

## Assigning Checklist Items

You can assign compliance items to team members:

1. Click on the item
2. Select **Assign to**
3. Choose the team member
4. Set a due date
5. They will receive a notification

This helps distribute workload across your M&E and programme team.

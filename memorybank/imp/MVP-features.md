# DonorDesk — Full MVP Feature Specification

## 1. Product Name

**DonorDesk**

## 2. MVP Objective

DonorDesk MVP is an AI-assisted donor reporting and evidence management platform for NGOs, humanitarian programmes, and donor-funded projects.

The MVP must enable an organization to:

1. Create a donor-funded project workspace.
2. Upload a donor reporting template.
3. Upload or enter a project logframe.
4. Upload and organize field evidence.
5. Submit activity updates.
6. Map evidence to activities, indicators, outputs, and donor requirements.
7. Generate a donor-ready report draft.
8. Identify missing evidence and compliance gaps.
9. Export the final report and evidence checklist.

The MVP should solve one core workflow:

**Turn scattered field evidence and project updates into a donor-ready report with an evidence-backed compliance checklist.**

## 3. MVP Positioning

DonorDesk is not a full NGO ERP, CRM, accounting system, or project management platform.

The MVP should position itself as:

**“An AI-powered donor reporting and evidence compliance workspace for NGOs and humanitarian programmes.”**

The MVP must remain focused on reporting readiness, evidence mapping, and source-linked report generation.

## 4. Primary Users

### 4.1 Organization Admin

Responsible for setting up the organization account, adding users, and managing projects.

### 4.2 Project Manager

Responsible for project setup, implementation oversight, report review, and final approval.

### 4.3 M&E Officer

Responsible for logframe setup, indicator tracking, data verification, and evidence validation.

### 4.4 Grants / Reporting Officer

Responsible for drafting, editing, and submitting donor reports.

### 4.5 Field Officer

Responsible for submitting activity updates and uploading evidence.

### 4.6 Compliance / Finance Officer

Responsible for attaching procurement, approval, finance, and audit-related documents.

## 5. User Roles and Permissions

### 5.1 Admin

Can:

Create organization profile
Invite users
Assign roles
Create projects
Edit all organization projects
Delete projects
Manage subscription settings
View all reports and evidence
Export reports and evidence packs
Access audit logs

### 5.2 Project Manager

Can:

Create and edit assigned projects
Add project activities
Review activity updates
Review evidence
Generate report drafts
Approve final reports
Export report packages
View project dashboard

Cannot:

Manage billing
Delete organization account
Access projects not assigned to them

### 5.3 M&E Officer

Can:

Create and edit logframe
Add indicators
Update indicator achievements
Link evidence to indicators
Verify evidence
Review data quality alerts
Generate indicator tables

Cannot:

Manage users
Delete projects
Approve final donor report unless given permission

### 5.4 Grants / Reporting Officer

Can:

Upload donor templates
Create reporting periods
Generate report drafts
Edit report sections
Request missing evidence
Export draft reports
Add review comments

Cannot:

Delete projects
Manage billing
Modify organization-level settings

### 5.5 Field Officer

Can:

Submit activity updates
Upload evidence
View own submissions
Respond to missing-evidence requests
Edit own drafts before submission

Cannot:

Generate final report
Approve evidence
View sensitive finance files unless allowed

### 5.6 Compliance / Finance Officer

Can:

Upload compliance documents
Upload procurement documents
Verify finance-related evidence
Review compliance checklist
Add audit notes
Export compliance pack

Cannot:

Modify technical project settings
Manage subscription
Delete other users’ files

## 6. MVP Modules

The MVP should include the following modules:

1. Authentication and onboarding
2. Organization workspace
3. User and role management
4. Project setup
5. Donor template manager
6. Logframe and indicator manager
7. Evidence library
8. AI evidence tagging
9. Activity update capture
10. Reporting period manager
11. AI report draft generator
12. Missing evidence and compliance checklist
13. Review and approval workflow
14. Export module
15. Dashboard
16. Audit log
17. Basic settings

## 7. Authentication and Onboarding

### 7.1 Sign Up

Users can create an account using:

Name
Email
Password
Organization name
Organization type
Country
Primary sector

Organization type options:

Local NGO
National NGO
INGO
UN implementing partner
Consulting firm
Government programme unit
Other

Primary sector options:

Nutrition
Food Security
WASH
Health
Protection
Education
Livelihoods
Shelter
Multi-sector
Other

### 7.2 Login

Users can log in with:

Email
Password

### 7.3 Password Reset

Users can request password reset through email.

### 7.4 First-Time Setup Wizard

After sign up, Admin sees a setup wizard:

Step 1: Create organization profile
Step 2: Create first project
Step 3: Upload donor template
Step 4: Upload or create logframe
Step 5: Invite team members
Step 6: Start evidence upload

The user should be allowed to skip optional steps and return later.

## 8. Organization Workspace

### 8.1 Organization Profile

Fields:

Organization name
Organization logo
Organization type
Country
Main office location
Sectors
Contact person
Contact email
Website
Donor types served
Default language

### 8.2 Organization Dashboard

Displays:

Active projects
Upcoming reports
Reports due this month
Missing evidence items
Pending evidence reviews
Draft reports
Completed reports
Storage usage
Recent activity

## 9. User Management

### 9.1 Invite Users

Admin can invite users by email.

Invite fields:

Email address
Role
Assigned project or projects

### 9.2 Manage Users

Admin can:

View user list
Change user role
Assign projects
Deactivate user
Reactivate user
Remove user

### 9.3 User Status

User statuses:

Invited
Active
Suspended
Removed

## 10. Project Setup Module

### 10.1 Create Project

Fields:

Project title
Project code
Donor name
Implementing organization
Partner organization, optional
Country
Province / region
District / location
Sector
Project start date
Project end date
Total budget, optional
Reporting frequency
Project description
Primary contact person
Project manager
M&E focal person
Grants/reporting focal person

Reporting frequency options:

Monthly
Quarterly
Semi-annual
Annual
Final report
Custom

### 10.2 Project Detail Page

Project page includes tabs:

Overview
Logframe
Activities
Evidence
Reports
Compliance
Team
Settings

### 10.3 Project Overview

Displays:

Project status
Project duration
Days remaining
Current reporting period
Next report deadline
Report readiness score
Indicator progress summary
Evidence completeness summary
Compliance gaps
Recent updates

### 10.4 Project Statuses

Draft
Active
Paused
Completed
Archived

## 11. Donor Template Manager

### 11.1 Upload Donor Template

Supported MVP file formats:

DOCX
PDF
TXT
Manual copy-paste text

The system should allow users to upload one donor reporting template per report type.

### 11.2 Template Metadata

Fields:

Template name
Donor name
Report type
Reporting frequency
Language
Required annexes
Notes

Report type options:

Monthly report
Quarterly report
Annual report
Final report
Activity report
Situation report
Custom donor report

### 11.3 AI Template Extraction

The system analyzes the donor template and extracts:

Report title
Section headings
Narrative questions
Required tables
Required annexes
Indicator reporting requirements
Compliance requirements
Submission instructions

### 11.4 Human Review of Extracted Template

After AI extraction, user sees an editable structured version:

Section name
Section description
Input needed
Required or optional
Evidence needed
Related logframe element, optional

User can:

Accept AI extraction
Edit extracted sections
Add missing sections
Delete incorrect sections
Save as reusable donor template

### 11.5 Template Versioning

MVP should store:

Original uploaded file
Extracted structured template
Date uploaded
Uploaded by
Version number

## 12. Logframe and Indicator Manager

### 12.1 Logframe Creation Options

Users can:

Upload logframe file
Import from Excel/CSV
Manually create logframe
Use AI to structure pasted logframe text

Supported file formats:

XLSX
CSV
DOCX
PDF
TXT

### 12.2 Logframe Structure

The MVP should support:

Goal
Outcome
Output
Activity
Indicator
Means of verification
Baseline
Target
Achievement
Reporting period achievement
Responsible person
Data source
Notes

### 12.3 Indicator Fields

Each indicator includes:

Indicator code
Indicator name
Indicator type
Level
Baseline
Target
Current achievement
Unit of measurement
Disaggregation required
Means of verification
Data source
Frequency
Responsible user
Status

Indicator type options:

Number
Percentage
Yes/No
Text
Ratio
Currency
Custom

Level options:

Goal
Outcome
Output
Activity

### 12.4 Indicator Update

M&E Officer can update:

Reporting period achievement
Cumulative achievement
Comments
Data source
Attached evidence
Verification status

### 12.5 Indicator Verification Status

Draft
Submitted
Verified
Needs correction
Rejected

## 13. Evidence Library

### 13.1 Upload Evidence

Users can upload:

PDF
DOCX
XLSX
CSV
JPG
PNG
TXT

Later phases may support:

Video
Audio
WhatsApp imports
Kobo/ODK direct sync

### 13.2 Evidence Metadata

Each evidence file includes:

File name
Evidence title
Project
Reporting period
Activity
Output
Indicator
Location
Date of activity
Evidence type
Uploaded by
Upload date
Verification status
Confidentiality level
Notes

### 13.3 Evidence Type Options

Attendance sheet
Photo
Distribution list
Training record
Field visit report
Monitoring report
Kobo/ODK export
Procurement document
Approval document
Beneficiary list
Meeting minutes
Case study
Financial document
Supplier document
Donor communication
Other

### 13.4 Confidentiality Levels

Public
Internal
Sensitive
Highly sensitive

### 13.5 Evidence Verification Status

Uploaded
AI tagged
Pending review
Verified
Needs correction
Rejected
Archived

### 13.6 Evidence Detail Page

The evidence detail page shows:

File preview
Metadata
AI-suggested tags
Linked activity
Linked indicators
Linked donor requirements
Verification status
Reviewer comments
Upload history
Download button

### 13.7 Evidence Search and Filters

Users can filter by:

Project
Reporting period
Activity
Indicator
Evidence type
Location
Uploaded by
Verification status
Confidentiality level
Date range

Search should support:

File name
Evidence title
Notes
Extracted text
Tags

## 14. AI Evidence Tagging

### 14.1 Purpose

AI assists users by classifying evidence and suggesting where it belongs.

### 14.2 AI Suggested Tags

For each uploaded evidence file, AI may suggest:

Evidence type
Related project
Related activity
Related output
Related indicator
Related location
Reporting period
Possible donor requirement
Summary of content
Potential sensitivity warning

### 14.3 Human Approval Required

AI tags must not become final automatically.

User can:

Accept all suggestions
Accept selected suggestions
Edit suggestions
Reject suggestions
Mark evidence for later review

### 14.4 AI Confidence Score

Each suggestion should show:

High confidence
Medium confidence
Low confidence

Low-confidence suggestions should be highlighted for manual review.

### 14.5 Sensitive Data Warning

AI should flag possible sensitive content, such as:

Beneficiary names
Phone numbers
CNIC/National ID/passport numbers
Children’s information
Medical records
Financial records
Location-sensitive data
Protection case details

The warning should say:

“This file may contain sensitive personal data. Please verify access level before sharing or exporting.”

## 15. Activity Update Capture

### 15.1 Create Activity Update

Field Officer or Project Staff can submit an activity update.

Fields:

Project
Reporting period
Activity title
Activity date
Location
Related output
Related indicator
Participants reached
Male participants
Female participants
Children reached
Persons with disabilities reached, optional
Other disaggregation, optional
Summary of activity
Key achievements
Challenges
Lessons learned
Next steps
Attachments
Submitted by

### 15.2 Draft and Submit

Statuses:

Draft
Submitted
Needs revision
Accepted
Rejected

### 15.3 AI Writing Assistance

AI can help convert rough notes into:

Clean activity summary
Donor-friendly narrative
Achievement paragraph
Challenge paragraph
Lessons learned paragraph

User must review and approve.

### 15.4 Link Activity Update to Evidence

Each activity update can have multiple evidence files attached.

Example:

Training activity update
Attendance sheet
Training photos
Pre/post-test results
Field visit note

## 16. Reporting Period Manager

### 16.1 Create Reporting Period

Fields:

Project
Report type
Start date
End date
Report deadline
Donor template
Responsible reporting officer
Internal review deadline
Status

### 16.2 Reporting Period Statuses

Not started
In progress
Evidence collection
Draft generated
Under review
Approved
Submitted
Closed

### 16.3 Reporting Period Page

Shows:

Report readiness score
Required sections
Indicator updates
Evidence completeness
Missing evidence
Open review comments
Draft report
Export options

## 17. AI Report Draft Generator

### 17.1 Report Generation Inputs

The AI report generator uses:

Donor template
Project overview
Logframe
Indicator updates
Activity updates
Verified evidence
Challenges
Lessons learned
Risk notes
Previous reporting period, optional
Compliance checklist

### 17.2 Generate Report Draft

User can click:

**Generate Draft Report**

The system creates:

Executive summary
Project progress summary
Activities completed
Indicator progress table
Achievements section
Challenges section
Lessons learned section
Risk and mitigation section
Beneficiary reach summary
Evidence annex list
Missing information notes

### 17.3 Source-Linked Drafting

Each generated paragraph should show source references where possible.

Example:

Paragraph: “During the reporting period, the project conducted three IYCF counselling sessions reaching 142 caregivers.”

Source links:

Activity Update #14
Attendance Sheet #22
Indicator NUT-02 update
Photo Evidence #31

### 17.4 Unsupported Claim Warning

If AI generates a statement without supporting evidence, it should be flagged as:

“Needs source verification”

### 17.5 Report Editor

Users can edit generated report sections.

Editor features:

Rich text editing
Section-by-section layout
AI rewrite button
AI shorten button
AI make more donor-friendly button
Insert indicator table
Insert evidence reference
Add comment
Resolve comment
Mark section complete

### 17.6 Report Section Status

Each section can be marked as:

Not started
Drafted
Needs evidence
Needs review
Approved

## 18. Missing Evidence and Compliance Checklist

### 18.1 Checklist Purpose

The checklist compares donor template requirements, logframe means of verification, activity records, and uploaded evidence.

### 18.2 Checklist Item Types

Missing evidence
Incomplete evidence metadata
Unverified indicator
Unsupported report claim
Missing annex
Missing procurement document
Missing approval
Missing disaggregation
Late activity update
Sensitive data warning
Unreviewed AI output

### 18.3 Checklist Item Fields

Project
Reporting period
Checklist item title
Description
Related donor requirement
Related activity
Related indicator
Severity
Assigned to
Due date
Status
Resolution notes

### 18.4 Severity Levels

Low
Medium
High
Critical

### 18.5 Checklist Statuses

Open
In progress
Resolved
Accepted risk
Not applicable

### 18.6 Example Checklist Items

Attendance sheet missing for caregiver training on 12 July
Indicator NUT-03 updated but no supporting evidence attached
Distribution photos uploaded but not linked to activity
Procurement approval missing for nutrition supplies
Beneficiary list contains personal data and needs restricted access
Donor annex table incomplete
Report paragraph has no source evidence

## 19. Review and Approval Workflow

### 19.1 Review Flow

Basic flow:

Draft created
Internal review requested
Reviewer comments
Revisions made
M&E verification
Compliance verification
Project Manager approval
Final export
Submitted externally
Closed

### 19.2 Comments

Users can comment on:

Report sections
Evidence files
Indicator updates
Checklist items
Activity updates

Comment fields:

Comment text
Author
Date
Mentioned user
Status

Comment statuses:

Open
Resolved

### 19.3 Approval Roles

M&E Officer approves indicator data.
Compliance Officer approves compliance evidence.
Project Manager approves final report.
Grants Officer prepares final export.

### 19.4 Final Approval

Before final export, the system checks:

All required report sections completed
Critical checklist items resolved or accepted
Indicator updates verified
Required evidence attached
Sensitive files reviewed
Final approver selected

## 20. Export Module

### 20.1 Export Types

MVP should support:

Word report export
PDF report export
Excel indicator table export
Evidence checklist export
Evidence pack ZIP export

### 20.2 Export Package Contents

A full export package may include:

Final donor report
Indicator table
Evidence checklist
Annex list
Selected evidence files
Compliance summary
Report metadata

### 20.3 Export History

Each export should store:

Export type
Exported by
Export date
Project
Reporting period
Report version
Files included

### 20.4 Export Warning

Before export, display warnings:

Unresolved critical checklist items
Unsupported claims
Unverified indicators
Sensitive evidence included
Missing annexes

User can proceed only if they have permission.

## 21. Dashboard Requirements

### 21.1 Main Dashboard

Cards:

Active projects
Reports due soon
Reports overdue
Missing evidence items
Pending reviews
Draft reports
Submitted reports
High-risk compliance gaps

### 21.2 Project Dashboard

Cards:

Report readiness score
Evidence completeness
Indicator verification status
Checklist status
Recent uploads
Open comments
Upcoming deadlines
Assigned tasks

### 21.3 Report Readiness Score

The score is calculated from:

Required sections completed
Indicators updated
Evidence attached
Evidence verified
Checklist items resolved
Review completed
Approval completed

Example score:

**Monthly Report: 76% Ready**

Breakdown:

Sections: 80%
Indicators: 70%
Evidence: 75%
Compliance: 65%
Review: 90%

## 22. Notifications

### 22.1 In-App Notifications

Users receive notifications for:

New assignment
Evidence needs review
Report deadline approaching
Comment mention
Checklist item assigned
Report approved
Report returned for revision
Export completed

### 22.2 Email Notifications

MVP should support basic email notifications for:

User invitation
Password reset
Report deadline reminder
Assigned checklist item
Review request

### 22.3 Notification Timing

Deadline reminders:

7 days before deadline
3 days before deadline
1 day before deadline
On deadline day
Overdue

## 23. Audit Log

### 23.1 Logged Events

The MVP should log:

User login
Project created
Project edited
File uploaded
File deleted
Evidence metadata changed
AI tags accepted
AI tags rejected
Indicator updated
Report generated
Report edited
Checklist item resolved
Approval completed
Export generated
User role changed

### 23.2 Audit Log Fields

Event type
User
Date/time
Project
Entity affected
Old value, where relevant
New value, where relevant
IP address, optional
System note

### 23.3 Audit Log Access

Admin can view all logs.
Project Manager can view assigned project logs.
Other users have restricted access.

## 24. Data Model Specification

### 24.1 Organization

Fields:

id
name
logoUrl
organizationType
country
sectors
contactName
contactEmail
website
defaultLanguage
createdAt
updatedAt

### 24.2 User

Fields:

id
organizationId
name
email
passwordHash
role
status
lastLoginAt
createdAt
updatedAt

### 24.3 Project

Fields:

id
organizationId
title
projectCode
donorName
implementingOrganization
partnerOrganization
country
region
district
sector
startDate
endDate
budget
reportingFrequency
description
status
projectManagerId
meOfficerId
reportingOfficerId
createdAt
updatedAt

### 24.4 DonorTemplate

Fields:

id
organizationId
projectId
templateName
donorName
reportType
language
originalFileUrl
extractedStructureJson
version
uploadedById
createdAt
updatedAt

### 24.5 LogframeItem

Fields:

id
projectId
parentId
level
code
title
description
createdAt
updatedAt

Levels:

Goal
Outcome
Output
Activity

### 24.6 Indicator

Fields:

id
projectId
logframeItemId
code
name
type
baseline
target
unit
meansOfVerification
dataSource
frequency
responsibleUserId
createdAt
updatedAt

### 24.7 IndicatorUpdate

Fields:

id
indicatorId
reportingPeriodId
periodAchievement
cumulativeAchievement
comments
verificationStatus
verifiedById
verifiedAt
createdById
createdAt
updatedAt

### 24.8 ReportingPeriod

Fields:

id
projectId
donorTemplateId
reportType
startDate
endDate
deadline
internalReviewDeadline
status
readinessScore
createdAt
updatedAt

### 24.9 EvidenceFile

Fields:

id
organizationId
projectId
reportingPeriodId
fileName
title
fileUrl
fileType
evidenceType
activityId
indicatorId
location
activityDate
uploadedById
verificationStatus
confidentialityLevel
aiSummary
aiSuggestedTagsJson
sensitivityWarning
createdAt
updatedAt

### 24.10 ActivityUpdate

Fields:

id
projectId
reportingPeriodId
activityTitle
activityDate
location
outputId
indicatorId
participantsTotal
participantsMale
participantsFemale
participantsChildren
participantsDisability
summary
achievements
challenges
lessonsLearned
nextSteps
status
submittedById
createdAt
updatedAt

### 24.11 ReportDraft

Fields:

id
projectId
reportingPeriodId
title
status
version
generatedByAi
createdById
approvedById
approvedAt
createdAt
updatedAt

### 24.12 ReportSection

Fields:

id
reportDraftId
sectionTitle
sectionOrder
content
sourceReferencesJson
status
createdAt
updatedAt

### 24.13 ChecklistItem

Fields:

id
projectId
reportingPeriodId
type
title
description
severity
relatedEntityType
relatedEntityId
assignedToId
dueDate
status
resolutionNotes
createdAt
updatedAt

### 24.14 Comment

Fields:

id
entityType
entityId
commentText
authorId
mentionedUserId
status
createdAt
updatedAt

### 24.15 ExportPackage

Fields:

id
projectId
reportingPeriodId
exportType
fileUrl
version
exportedById
createdAt

### 24.16 AuditLog

Fields:

id
organizationId
projectId
userId
eventType
entityType
entityId
oldValueJson
newValueJson
createdAt

Data Connection & Storage Mode

Users choose one mode during project setup:

Mode	Description	Best For
DonorDesk Cloud Upload	Files uploaded into DonorDesk	Small NGOs / pilots
Private Workspace	Data stays on NGO-controlled server/cloud	sensitive projects
Bring-Your-Own-Storage	Connect selected Drive/OneDrive/Dropbox folders	NGOs already using cloud folders

## 25. AI Feature Specification

### 25.1 AI Template Extraction

Input:

Donor reporting template

Output:

Structured report sections
Required evidence
Required annexes
Required indicators
Compliance requirements

Acceptance criteria:

User can review and edit extraction before saving.
Original file remains attached.
Extracted template is saved as structured JSON.

### 25.2 AI Evidence Tagging

Input:

Uploaded evidence file

Output:

Suggested evidence type
Suggested activity
Suggested indicator
Suggested reporting period
Content summary
Sensitivity warning
Confidence score

Acceptance criteria:

AI tags remain pending until approved by a human.
User can edit tags.
All accepted AI tags are logged.

### 25.3 AI Activity Narrative Generator

Input:

Rough activity update

Output:

Clean donor-style narrative paragraph

Acceptance criteria:

User can accept, edit, regenerate, or discard output.
Original text is preserved.

### 25.4 AI Report Draft Generator

Input:

Template
Logframe
Indicators
Activity updates
Evidence
Checklist

Output:

Complete draft report

Acceptance criteria:

Each section is editable.
Source references are attached where available.
Unsupported statements are flagged.
User can regenerate individual sections.

### 25.5 AI Missing Evidence Detector

Input:

Donor requirements
Logframe means of verification
Activity updates
Evidence library
Indicator updates

Output:

Checklist of missing or weak evidence

Acceptance criteria:

Checklist items are editable.
User can mark items resolved, accepted risk, or not applicable.
Critical gaps appear on dashboard.

## 26. Non-Functional Requirements

### 26.1 Performance

Dashboard should load within 3 seconds for normal projects.
File upload should support at least 25MB per file in MVP.
Evidence search should return results within 3 seconds for typical project size.
AI generation may take longer but should show progress status.

### 26.2 Security

Password hashing required.
Role-based access control required.
Project-level access required.
Sensitive files must respect confidentiality levels.
File URLs should not be publicly exposed.
Audit logging required for important changes.

### 26.3 Privacy

The system should warn users when files may contain personal data.
Sensitive evidence should be excluded from export unless intentionally selected.
Beneficiary data should not be used for AI training.
Admins should be able to delete files if uploaded incorrectly.

### 26.4 Reliability

Uploaded files should not be lost after submission.
Report drafts should auto-save.
Export history should be retained.
AI failure should not block manual report editing.

### 26.5 Usability

The product must be usable by non-technical NGO staff.
Forms should be simple.
Dashboards should prioritize actions, not vanity charts.
Every page should answer: “What needs attention now?”

## 27. MVP Pages and Screens

### 27.1 Public Pages

Landing page
Pricing page
Login page
Sign-up page
Forgot password page

### 27.2 Application Pages

Organization dashboard
Project list
Create project
Project overview
Logframe manager
Indicator manager
Evidence library
Evidence detail page
Activity updates list
Create activity update
Reporting periods list
Report workspace
Compliance checklist
Report export page
User management
Settings
Audit log

## 28. Main Navigation

Suggested left navigation:

Dashboard
Projects
Reports
Evidence
Indicators
Checklist
Team
Settings

Inside project:

Overview
Logframe
Activities
Evidence
Reports
Compliance
Team
Settings

## 29. MVP User Stories

### 29.1 Project Setup

As an Admin, I want to create a project so that my team can organize reporting work under one donor-funded project.

Acceptance criteria:

Project can be created with required fields.
Project appears in project list.
Project has its own dashboard.

### 29.2 Donor Template Upload

As a Reporting Officer, I want to upload a donor template so that DonorDesk can structure the report requirements.

Acceptance criteria:

Template can be uploaded.
AI extracts sections.
User can edit extracted sections.
Template can be saved.

### 29.3 Logframe Setup

As an M&E Officer, I want to upload or create a logframe so that indicators and evidence can be linked to project results.

Acceptance criteria:

User can create goal, outcome, output, activity, and indicators.
Indicators can be edited.
Indicators appear in report workspace.

### 29.4 Evidence Upload

As a Field Officer, I want to upload evidence so that project activities can be supported with proof.

Acceptance criteria:

File can be uploaded.
Metadata can be added.
AI suggests tags.
User can submit evidence for review.

### 29.5 Evidence Verification

As an M&E Officer, I want to verify evidence so that only approved files support donor reports.

Acceptance criteria:

Evidence can be marked verified, needs correction, or rejected.
Reviewer comments can be added.
Evidence status is visible.

### 29.6 Activity Update

As a Field Officer, I want to submit activity updates so that reporting staff can use them for donor reports.

Acceptance criteria:

Activity update form can be submitted.
Evidence can be attached.
AI can polish the narrative.
Update appears in reporting period.

### 29.7 Report Generation

As a Reporting Officer, I want to generate a report draft so that I can save time preparing donor submissions.

Acceptance criteria:

AI generates report sections.
User can edit sections.
Sources are shown where available.
Unsupported claims are flagged.

### 29.8 Missing Evidence Checklist

As a Project Manager, I want to see missing evidence so that I can fix gaps before submitting the report.

Acceptance criteria:

Checklist items are automatically generated.
Items show severity and responsible person.
Items can be resolved or accepted as risk.

### 29.9 Report Approval

As a Project Manager, I want to approve the final report so that the team can export a controlled version.

Acceptance criteria:

Report can be approved.
Approval date and approver are saved.
Approved version can be exported.

### 29.10 Export

As a Reporting Officer, I want to export the report and evidence pack so that I can submit them to the donor.

Acceptance criteria:

Word/PDF report can be exported.
Evidence checklist can be exported.
Export history is saved.

## 30. MVP Exclusions

The MVP should not include:

Full accounting system
Full procurement system
Payroll
Beneficiary case management
CRM
Donor fundraising database
Advanced mobile app
Offline sync
WhatsApp bot
Kobo/ODK integration
DHIS2 integration
Power BI integration
SSO
Enterprise custom deployment
Multi-language interface
Complex workflow builder
AI autonomous agents
Blockchain audit trail
Advanced GIS mapping

These can be considered later, but adding them now would create product obesity. MVP should stay lean.

## 31. Suggested Technical Stack

### 31.1 Frontend

Next.js
TypeScript
Tailwind CSS
shadcn/ui
React Hook Form
Zod validation

### 31.2 Backend

Next.js API routes or NestJS
PostgreSQL
Prisma ORM
Object storage for uploaded files
Redis queue, optional for AI jobs
Background job processor for file parsing and AI generation

### 31.3 AI / Document Processing

LLM API for extraction and drafting
PDF parser
DOCX parser
XLSX/CSV parser
OCR later, optional
Embedding search for evidence retrieval
Prompt templates by task
Source-reference layer

### 31.4 Storage

PostgreSQL for structured data
Object storage for files
Vector store for searchable evidence chunks

### 31.5 Auth

Email/password authentication
JWT or secure session-based auth
Role-based access control

## 32. Core Workflows

### 32.1 Project Setup Workflow

Admin creates project
Admin assigns team
Reporting Officer uploads donor template
M&E Officer creates logframe
Project becomes active

### 32.2 Evidence Workflow

Field Officer uploads evidence
AI suggests tags
M&E Officer reviews tags
Evidence becomes verified
Verified evidence becomes available for report generation

### 32.3 Reporting Workflow

Reporting period is created
Activity updates are submitted
Indicators are updated
Evidence is attached
AI generates report draft
Team reviews sections
Checklist gaps are resolved
Project Manager approves
Report is exported

### 32.4 Compliance Workflow

System reads donor requirements
System compares against available evidence
Checklist items are created
Responsible users resolve gaps
Compliance Officer verifies
Final export includes checklist

## 33. Readiness Score Logic

The MVP can calculate report readiness using weighted components.

Suggested weights:

Report sections completed: 25%
Indicator updates verified: 20%
Required evidence attached: 25%
Checklist items resolved: 20%
Approval workflow completed: 10%

Formula:

Readiness Score =
Sections Score × 0.25

* Indicator Score × 0.20
* Evidence Score × 0.25
* Checklist Score × 0.20
* Approval Score × 0.10

Example:

Sections: 80
Indicators: 70
Evidence: 60
Checklist: 50
Approval: 0

Readiness =
80 × 0.25 + 70 × 0.20 + 60 × 0.25 + 50 × 0.20 + 0 × 0.10
= 59%

## 34. Report Workspace Layout

The report workspace should have three columns:

### Left Column

Report sections
Section status
Missing sections
Template structure

### Middle Column

Editable report content
AI generation tools
Comments
Source references

### Right Column

Evidence suggestions
Checklist alerts
Indicator data
Review status
Unsupported claims

This layout keeps writing, evidence, and compliance connected.

## 35. Evidence Pack Export Structure

When exporting a ZIP evidence pack, suggested folder structure:

Project Name
Reporting Period
01_Final_Report
02_Indicator_Table
03_Evidence_Checklist
04_Attendance_Sheets
05_Photos
06_Distribution_Records
07_Field_Visit_Reports
08_Procurement_Documents
09_Approvals
10_Other_Annexes

Each folder should include a simple index file listing:

File name
Evidence type
Related activity
Related indicator
Date
Verification status

## 36. Initial AI Prompt Templates

### 36.1 Activity Summary Prompt

Convert the following field activity notes into a clear donor-reporting paragraph. Preserve factual meaning. Do not invent numbers, locations, beneficiaries, or outcomes. Flag missing details separately.

### 36.2 Evidence Tagging Prompt

Review this evidence file text and suggest the most likely evidence type, related activity, indicator, location, reporting period, and sensitivity level. Provide confidence level for each suggestion. Do not mark suggestions as final.

### 36.3 Report Section Prompt

Using only the verified sources provided, draft the donor report section below. Do not invent activities, results, or numbers. Add “Needs verification” where evidence is insufficient.

### 36.4 Missing Evidence Prompt

Compare the donor requirement, logframe means of verification, activity updates, and available evidence. Identify missing, weak, or unverified evidence required before report submission.

## 37. MVP Acceptance Criteria

The MVP is successful when a real NGO user can:

Create an organization account
Create a project
Upload a donor report template
Create or upload a logframe
Upload at least 20 evidence files
Submit at least 5 activity updates
Map evidence to activities and indicators
Generate a report draft
See missing evidence checklist
Resolve checklist items
Export a donor report and evidence checklist

## 38. Pilot Testing Plan

### 38.1 Pilot Users

Recruit:

2 local NGOs
1 humanitarian consultant
1 M&E officer
1 grants/reporting officer

### 38.2 Pilot Scenario

Each pilot user should test:

One real or sample project
One donor template
One logframe
One reporting period
At least 10 evidence files
One generated report

### 38.3 Pilot Questions

Did DonorDesk reduce report preparation time?
Was the AI draft useful?
Were evidence gaps correctly identified?
Was evidence tagging accurate?
Was the dashboard understandable?
Would you pay for this?
What part felt unnecessary?
What feature was missing?
What would make this operationally useful?

## 39. MVP Success Metrics

### 39.1 Product Metrics

Time to create first project
Number of evidence files uploaded
Percentage of AI tags accepted
Number of activity updates submitted
Number of report drafts generated
Percentage of checklist items resolved
Number of exports completed
Average readiness score improvement

### 39.2 Business Metrics

Pilot signups
Paid pilot conversions
Monthly active organizations
Average revenue per organization
Churn risk feedback
Support requests
Time saved per report

### 39.3 Quality Metrics

AI hallucination rate
Unsupported claim count
Evidence tagging accuracy
Template extraction accuracy
User correction frequency
Export error rate
Report approval completion rate

## 40. Suggested Build Phases

### Phase 1 — Foundation

Authentication
Organization setup
User roles
Project creation
Basic dashboard
File upload infrastructure

### Phase 2 — Project Intelligence

Donor template upload
Template extraction
Logframe manager
Indicator manager
Reporting period setup

### Phase 3 — Evidence and Activity Flow

Evidence library
Evidence metadata
AI evidence tagging
Activity update form
Evidence verification

### Phase 4 — Report Generation

AI report draft generator
Report editor
Source references
Unsupported claim warnings
Section status

### Phase 5 — Compliance and Export

Missing evidence checklist
Review comments
Approval workflow
PDF/Word export
Evidence checklist export
Audit log

## 41. First MVP Version Recommendation

The absolute first usable version should include only:

Organization account
Project setup
Donor template upload
Logframe entry
Evidence upload
Manual evidence tagging
Activity update form
AI report draft
Missing evidence checklist
PDF/Word export

AI evidence tagging, advanced dashboards, and full approval workflows can be improved after pilot validation.

## 42. Final MVP Principle

The MVP should not try to impress users with too many features.

It should make them say:

**“This would save me serious time before donor reporting deadlines.”**

That is the core buying trigger.

The product should win by being practical, evidence-backed, and easy for NGO teams to adopt.

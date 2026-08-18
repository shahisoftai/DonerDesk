# AI in DonorDesk

DonorDesk uses AI to assist your team in three main ways. AI is always an assistant — your team makes the final decisions.

## 1. AI Evidence Tagging

When you upload evidence, AI automatically analyses the document and suggests tags.

**How it works:**
1. You upload an evidence file (PDF, DOCX, etc.)
2. DonorDesk extracts the text content using Apache Tika
3. The AI analyses the content
4. It suggests relevant tags: sector, activity type, location, beneficiary group, etc.
5. You review and accept or adjust the tags

**Why it helps:**
- Organises large volumes of evidence quickly
- Makes evidence searchable by content
- Helps link evidence to report sections
- Saves time on manual classification

**AI-generated tags are suggestions only.** You can accept, modify, or ignore them. Human review is required to verify the evidence.

## 2. AI Report Draft Generation

DonorDesk can generate a full or partial donor report draft using your project data.

**What goes into an AI draft:**
- Your logframe and indicator values
- Activity narratives you have logged
- Evidence content (from uploaded files)
- Indicator update comments and data sources
- Compliance checklist status
- Previous period comparisons (where available)
- Project context (donor, locations, sector, dates)
- Donor template structure

**What the AI produces:**
- Executive summary
- Project progress narrative
- Activities completed section
- Indicator progress table with performance notes
- Achievements and challenges sections
- Evidence summary

**Source references:**
Every paragraph in an AI draft shows which evidence, activities, or indicators it came from. You can click the reference to open the source directly.

**Always human-reviewed:**
AI-generated sections must be reviewed by a team member before approval. The compliance checklist flags unreviewed AI content.

## 3. AI Section Editing

Within the report editor, you can use AI to improve individual sections:

| Action | What it does |
|--------|-------------|
| **AI Rewrite** | Rewrites the selected text in a different style |
| **AI Shorten** | Makes the text more concise |
| **Make Donor-Friendly** | Adjusts tone for a specific donor audience |

These actions use one AI credit each.

## AI Credits and Your Plan

AI credits are consumed when you successfully generate or rewrite report content. Your plan determines how many you get per month:

| Plan | AI Draft Credits/Month |
|------|----------------------|
| Starter | 5 |
| Team | 100 |
| Growth | 500 |
| Enterprise | Unlimited |

**What counts as one credit:**
- Generating a full report draft (all sections at once)
- Generating a single section
- AI Rewrite (per action)
- AI Shorten (per action)

**What does NOT consume a credit:**
- AI evidence tagging (automatic, no charge)
- Using the free "stub" response (when AI is unavailable)
- Failed generation attempts (credit is released)

## How to Use AI Draft Generation

1. Go to your reporting period
2. Make sure you have updated indicators and uploaded evidence
3. Click **Generate Report Draft**
4. Wait a moment while DonorDesk prepares the draft (usually 30-60 seconds)
5. Review each section
6. Accept, edit, or regenerate individual sections
7. Mark each section as reviewed
8. Approve the full report

## AI Model Configuration

Your organisation's system administrator can configure which AI model DonorDesk uses:

- **MiniMax** — Default, good for most workloads
- **DeepSeek** — Alternative option

Configuration is at: **Settings → AI Settings** (admin only)

## AI and Data Security

Your project data is used only to generate the specific output you requested. Evidence text is processed to generate citations and summaries. AI providers process this data only for the generation task.

DonorDesk does not use your project data to train AI models.

If your donor requires that data never leaves your organisation, contact DonorDesk support to discuss configuration options.

## Limitations

AI is an assistant, not an author:
- All AI output must be reviewed by a human
- AI can make errors — always verify facts
- AI may produce generic-sounding text — edit for your context
- Some technical or very specific language may need manual correction
- AI cannot verify that your evidence is genuine — that is a human task

## Stub Mode (Fallback)

If the AI service is temporarily unavailable, DonorDesk uses a "stub" response that provides a basic structure based on your data. This does not use credits. The output is clearly marked as a stub and should be replaced with a real AI generation when the service is available.

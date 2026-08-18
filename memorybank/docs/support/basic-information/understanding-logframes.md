# Understanding Logframes in DonorDesk

A logframe (Logical Framework) is a tool that helps your team plan and track how your project will achieve its goals. It is a standard tool used by most donors and NGOs worldwide.

## The Four Levels

A logframe has a hierarchy of four levels:

```
Goal
  └── Outcome(s)
        └── Output(s)
              └── Activity/Actions
                    └── Indicator(s)
```

### Goal

The Goal is the overall aim of your project — the big-picture change you want to see.

**Example:**
"Reduce maternal and neonatal mortality in District Kubwa by 30% by December 2027"

The Goal is usually written by your organisation and donor together during proposal development. It is rarely changed once set.

### Outcome

An Outcome is the change that happens as a result of your project's outputs. Outcomes are usually written in past tense (the change that occurred).

**Example:**
"400 pregnant women in target communities accessed quality antenatal care services"

A project usually has one Goal but can have several Outcomes.

### Output

An Output is the concrete product or service that your project produces. Unlike outcomes (which describe changes in people's lives), outputs are tangible things the project delivers.

**Example:**
"20 community health workers trained in Antenatal Care screening protocols"

### Activity

Activities are the day-to-day tasks your team carries out to produce outputs.

**Example:**
"Conduct 10-day training programme for 20 community health workers on ANC screening"

### Indicator

An Indicator is a measurement that tells you whether you are making progress. Each indicator is linked to a specific level (Goal, Outcome, Output, or Activity).

**Example indicators:**
- Number of pregnant women accessing ANC (Outcome level)
- Number of health workers trained (Output level)
- Number of training sessions conducted (Activity level)

## How to Build a Logframe in DonorDesk

### Method 1: Upload a File

If you already have a logframe in Excel, CSV, or Word format:

1. Go to your project → **Logframe** tab
2. Click **Import Logframe**
3. Upload your file
4. DonorDesk will read the structure and create the hierarchy automatically
5. Review and confirm the mapping

### Method 2: Build Manually

1. Go to your project → **Logframe** tab
2. Click **Add item**
3. Choose the **level** (Goal, Outcome, Output, Activity)
4. Enter a **code** (e.g., GOAL-1, OUT-1, OUT-2)
5. Enter a **title**
6. Add a description if needed
7. Click **Save**

To add a child item under an existing item:
1. Hover over the parent item
2. Click the **+** icon
3. Choose the child level

### Method 3: Use AI to Structure Your Logframe

If you have a logframe description or narrative text:

1. Go to your project → **Logframe** tab
2. Click **AI Structure Logframe**
3. Paste your logframe text
4. Click **Generate**
5. AI will identify the goal, outcomes, outputs, and activities
6. Review and confirm each item

## Indicators in the Logframe

Each logframe item can have one or more indicators:

1. Go to the **Logframe** tab
2. Click **Add Indicator** next to the relevant item
3. Fill in:
   - **Code** (e.g., IND-1, OUT-IND-1)
   - **Name** (e.g., "Number of pregnant women receiving 4+ ANC visits")
   - **Type** (Number, Percentage, Yes/No, Text, Ratio, Currency)
   - **Baseline** (the starting value — often 0)
   - **Target** (what you aim to achieve)
   - **Unit** (e.g., "women", "children", "%")
   - **Means of Verification** (how you will measure it — e.g., "ANC register")
   - **Data Source** (e.g., "DHIS2", "Health facility records")

## Indicator Types Explained

| Type | When to use | Example |
|------|------------|---------|
| **Number** | Counting discrete items | "Number of people trained: 50" |
| **Percentage** | Proportions or rates | "Percentage of women delivering with skilled birth attendant: 75%" |
| **Yes/No** | Binary outcomes | "Community committee established: Yes" |
| **Text** | Descriptive updates | "Quality of services: Good, with minor stockouts noted" |
| **Ratio** | Comparing two numbers | "Boy-girl ratio in training: 1:3" |
| **Currency** | Financial values | "Total expenditure: USD 45,000" |

## Updating Indicator Values

Indicator values are updated **per reporting period**:

1. Go to your reporting period
2. Click **Indicators** tab
3. You will see a spreadsheet-style grid
4. Enter the **period achievement** (what was achieved in this period)
5. Enter the **cumulative achievement** (total to date)
6. Add any comments or notes
7. Click **Save Draft** (or submit to verify)

You can also import values from Google Sheets:
1. Click **Import from Google Sheets**
2. Authorise access to your Google Drive
3. Select your spreadsheet
4. Map the columns to indicator codes
5. Preview and apply

## Logframe Hierarchy Display

In DonorDesk, the logframe displays as an expandable tree:

- Click the **arrow** next to an item to expand/collapse its children
- Drag items to reorder them (within the same level)
- Click an item to view and edit its details
- Indicators appear as sub-items under each logframe element

## Tips for Good Logframe Design

1. **SMART indicators** — Make each indicator Specific, Measurable, Achievable, Relevant, and Time-bound
2. **Start from the bottom** — Build activities first, then outputs, then outcomes, then goal
3. **Keep it simple** — Too many items makes reporting overwhelming
4. **Align with your donor's format** — Some donors have required logframe templates
5. **Update regularly** — Keep indicator values current so AI reports are accurate

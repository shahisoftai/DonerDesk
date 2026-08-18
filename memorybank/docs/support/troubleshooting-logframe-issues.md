# Troubleshooting Logframe Issues

## Cannot Add Items to Logframe

### "You do not have permission"

Only these roles can add logframe items:
- Owner
- Admin
- Project Manager

Ask your admin to give you the right role.

### Parent Item Not Found

When adding a child item (e.g., Output under an Outcome):
1. Make sure the parent item exists
2. Click on the parent item first
3. Then click **Add Child**

## Import Not Creating the Right Hierarchy

### File Format Issues

The most common problem when importing logframes from files.

**Good file formats:**
- Excel (.xlsx) with clear columns
- CSV with consistent formatting
- Tab-separated text files

**Bad file formats:**
- PDF (DonorDesk cannot read tables from PDF reliably)
- Scanned documents
- Images of logframes

### How the Import Detects Hierarchy

DonorDesk looks for:
- **Keywords:** GOAL, OUTCOME, OUTPUT, ACTIVITY
- **Indentation:** Items indented under others are treated as children
- **Code patterns:** Dotted codes (1.1, 1.1.2) or lettered codes (A, B, a, b)

### Tips for a Good Import

**In Excel:**
```
Level        Code    Title
Goal         GOAL-1  Reduce maternal mortality
Outcome      OUT-1   400 women access ANC
Output       OUT-1.1 Health workers trained
Activity     ACT-1   Conduct training
```

**In CSV:**
```
Level,Code,Title
Goal,GOAL-1,Reduce maternal mortality
Outcome,OUT-1,400 women access ANC
Output,OUT-1.1,Health workers trained
Activity,ACT-1,Conduct training
```

## Items in the Wrong Order

### Reordering Items

1. Find the item you want to move
2. Click and hold the **drag handle** (six dots on the left)
3. Drag to the new position
4. Release

**Note:** Items can only be reordered within the same level (e.g., outcomes can be reordered among outcomes, but an outcome cannot be moved to be under another goal).

## Cannot Delete an Item

### Item Has Children

You cannot delete an item that has child items. Either:
1. Delete the children first, or
2. Move children to another parent before deleting

### Item Has Indicators

Deleting an item with indicators will also delete the indicators. If you need the indicator data:
1. Export the indicator data first
2. Then delete the item

### Item Is Linked to Evidence or Reports

If the item is linked to activities, evidence, or reports:
1. Unlink the item first (if possible), or
2. Be aware that deleting will also remove those links

## Indicator Not Saving

### Required Fields Missing

When saving an indicator, these fields are required:
- **Code** — Must be unique within the project
- **Name** — The indicator name
- **Type** — Number, Percentage, Yes/No, etc.

### Code Already Exists

Each indicator code must be unique. If you get an error:
1. Check if an indicator with this code already exists
2. Use a different code
3. Or edit the existing indicator

## Logframe Structure Looks Wrong

### Items at the Wrong Level

If an Output appears at the Goal level:
1. Check the Level field when creating the item
2. Edit the item and change the level

### Missing Hierarchy Lines

If the tree structure is not showing:
1. Refresh the page
2. Make sure you are not filtering by a specific level
3. Click **Expand All** to see the full hierarchy

## AI Structure Not Working

### Text Not Recognised

AI logframe structuring works best with clear text descriptions. Poor input:

```
maternal health project in district x. we will train health workers, conduct
sessions, distribute supplies. goal is to reduce mortality.
```

Good input:

```
Goal: Reduce maternal mortality in District X by 30% by 2027

Outcomes:
- 400 pregnant women access quality antenatal care
- 200 births attended by skilled birth attendant

Outputs:
- 20 health workers trained in ANC
- 10 community health committees established

Activities:
- Conduct 5-day training for 20 health workers
- Hold monthly community meetings
```

## Cannot Link Indicator to Logframe Item

1. Make sure the item and indicator both exist
2. When creating the indicator, select the correct parent item
3. Or open the indicator and change its parent in the **Logframe Item** field

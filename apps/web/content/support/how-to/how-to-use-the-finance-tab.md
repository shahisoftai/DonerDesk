# How to Track Money in the Finance Tab

The **Finance** tab of a project is its finance register: what was promised, what has arrived, what was spent and what is still to come. It is a **record of figures you enter**, not an accounting system. Every amount names its currency, and amounts in different currencies are never added together.

Open **Projects → your project → Finance**.

Who can do what:
- **Approving or rejecting** an entry: Admin and Project Manager.
- Your administrator sets the currencies and who may approve in **Settings → Finance** ([How to set up finance for your organisation](/support/how-to/set-up-finance-for-your-organisation)).

## Read the top of the page: Where the money stands

Four figures, each with a plain explanation underneath:

| Figure | Means |
|---|---|
| **Obligated** | Committed to this project by **your own funding sources** (the funding you entered below) |
| **Received** | **Approved** money received from those funding sources |
| **Still to receive** | Obligated minus received |
| **Spent** | **Approved** expenses only |

If nothing has been entered, the page says **None recorded**. It never shows 0 for something nobody has recorded.

## Step 1: Add the funding

1. In **Funding sources**, find **Add funding**.
2. Choose the **Source** from the list (your funders; the list comes from **Settings → Finance**), then the **Date**, **Amount**, **Currency** and an optional **Note**.
3. Click **Add funding**. Use **Remove** on a row to take it out.

A source marked **Counts in totals** is added into the figures at the top. A source marked **Listed only** (for example a partner's cost-share) is listed but never added.

## Step 2: Check the budget against spending

**Budget against spending** lists each **budget line** with its **Budget**, **Spent** and **Remaining**, with the percentage spent. The lines come from the project's setup (the wizard's budget slide). If the page says **Set a project budget to compare spending with time**, no budget lines exist yet.

## Step 3: Record an expense

1. Under **Expenses and money received**, find **Add an expense**.
2. Pick the **Budget line**, the **Date**, **Paid to**, the **Amount** and **What for**.
3. Optional: the **Funding source** that paid, and **Proof**, a file already in this project.
4. Click **Add an expense**.

You can also reach this form from **Record → An expense**.

## Step 4: Record money received

Use **Record money received** in the same section when a funder pays: choose the **Source**, **Date**, **Amount** and **Currency**.

## Approval: nothing counts until it is approved

Every new expense and every amount received starts as **Waiting for approval**. Only **Approved** entries count in **Spent** and **Received**. Someone with approval rights (Admin or Project Manager):

1. Finds the entry in the list.
2. Clicks **Approve**, or **Reject** (a reason is required).

Each entry is decided once. If your organisation turned on **The person who entered an entry cannot approve it**, a second person must decide. Until then the page says how many entries are waiting. You can edit an entry that is still waiting.

## Add many entries at once: Import from a spreadsheet

1. Click **Download the template** and fill in one row per expense or amount received.
2. Click **Choose a file (.csv)**, or paste the rows into **Or paste the rows here**.
3. Click **Check the sheet**. Nothing is saved yet.
4. If any row has a problem, **none** is stored. You get your own sheet back with only the rows to fix and a **Problems** column. Fix and check again.
5. When the check is clean, confirm. The entries are added and wait for approval.

## Advances

An **advance** is money given to someone to spend later. Click **Record an advance**, fill in **Held by**, **Given** (the date), **Amount**, **Currency** and a **Note**.

## Payment milestones

A **payment milestone** is a payment the donor makes when you deliver something. Click **Add a milestone**: **Milestone** (what must be delivered), **Amount**, **Currency** and **Due**. A milestone is approved when delivered; only then can it be paid.

## When a total says "Rate needed"

If you ask for a total in your reporting currency and some amounts are in other currencies, DonorDesk converts only with an **exchange rate dated on the day of the payment**. With no rate, the total says **Rate needed** and names what is missing. It never guesses. Ask an administrator to add the rate in **Settings → Finance → Exchange rates**.

## Tips

- Enter funding first. The top of the page is empty until at least one funding source exists.
- Enter expenses with a **Proof** file where you can. It helps at audit time.
- Only approved entries count, so approve regularly.

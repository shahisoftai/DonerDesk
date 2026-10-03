# Data Security

How DonorDesk protects your organisation's data. The public [Security & trust](/security) page has the current summary.

## Tenant isolation

Every organisation is a separate **tenant**. Each row of tenant data carries your organisation's ID, and the **database itself enforces row-level security**: a session scoped to one organisation cannot read or change another's rows, even if application code had a bug. The application's database role has no bypass.

## Access control

- **Roles** control what each person can see and do (see [User roles and permissions](/support/getting-started/user-roles-and-permissions)).
- **Project assignments** limit which projects a member works on.
- Sessions use secure, httpOnly cookies that page scripts cannot read.
- Passwords are stored hashed, never in plain text.
- Sign in with email and password or with Google. DonorDesk does not currently offer two-factor authentication.

## Encryption

Data is encrypted in transit (TLS). Data at rest is encrypted where supported by the storage infrastructure.

## Your files

- **Google Drive (link-first):** evidence stays in your own Drive. DonorDesk keeps references and access, not a copy of the file.
- **DonorDesk storage (optional):** managed object storage for organisations that choose it.

## Confidential evidence

Files marked **Sensitive** or **Highly sensitive**:
- are withheld from AI drafting;
- trigger an export block if a report cites them, until an Admin or Grants Officer confirms;
- are flagged in the compliance checklist.

## AI and your data

AI providers receive only what is needed to draft the section you request, and are required to process it only for that purpose. Drafts are checked against your verified data, and prompts and model versions are recorded. You can turn AI off entirely in **Settings**, and Growth/Enterprise workspaces can use their own AI provider. AI Writing Style learns wording only, never facts or numbers.

## Audit trail

Actions are recorded in an audit log (Admin, Project Manager and Compliance Officer can view it). Records cannot be edited.

## Data residency

Choose a data-residency setting when you sign up or in **Settings** (Platform default, EU, US, Africa, Asia). It restricts where your organisation's data may be written. Custom data residency is part of the Enterprise plan; contact us if you have a specific requirement.

## Subprocessors

Creem (payments), Google Drive (optional storage), Cloudflare R2 (optional managed storage) and AI providers configured for your workspace. No subprocessor is used for your content unless your configuration selects it. A full list is available from legal@donordesk.online.

## Report a concern

Email privacy@donordesk.online. To request a Data Processing Agreement (Growth/Enterprise), email the same address or use the [sales contact form](/contact-sales).

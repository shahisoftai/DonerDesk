# Data Security in DonorDesk

DonorDesk is built with security as a core requirement. This guide explains how your data is protected.

## Multi-Tenant Architecture

DonorDesk uses a **multi-tenant** architecture. This means:

- All organisations share the same database server
- But each organisation's data is completely isolated from others
- A technical mechanism called **Row-Level Security (RLS)** enforces this isolation at the database level
- No organisation can ever see, access, or modify another organisation's data

Even if someone tried to bypass application-level controls, the database itself would block access to other tenants' data.

## Data Encryption

| Data state | Protection |
|------------|------------|
| **In transit** | All data is encrypted using TLS when sent between your browser and DonorDesk servers |
| **At rest** | Data stored on DonorDesk servers is encrypted at rest |
| **In backups** | Backup data is also encrypted |

## Server Infrastructure

DonorDesk runs on secure cloud infrastructure:
- Firewalls block unauthorized access
- Regular security updates are applied to the operating system
- Database access requires authentication
- Sensitive services run in isolated network zones

## Authentication

DonorDesk uses:
- **Password hashing** — Your password is never stored in plain text. It is hashed using a strong algorithm before storage.
- **JWT sessions** — Authentication uses short-lived JSON Web Tokens that expire automatically
- **Secure cookies** — Session tokens use httpOnly cookies that cannot be read by JavaScript

## Google Sign-In

If your organisation uses Google Sign-In:
- DonorDesk receives only your email and name from Google
- DonorDesk does not access your Gmail, Google Drive (unless explicitly connected), or any other Google data
- You can revoke DonorDesk's access at any time from your Google account settings

## Role-Based Access Control

Access in DonorDesk is controlled at two levels:

1. **Organisation-wide roles** — Your role (Admin, Project Manager, etc.) determines what you can see across the organisation
2. **Project-level permissions** — Within each project, you may have additional permissions or restrictions

You only see the projects and data that your role allows.

## Evidence and Sensitive Data

When handling evidence marked as Sensitive or Highly Sensitive:
- DonorDesk warns you before including such evidence in exports
- You can set file-level confidentiality levels
- Sensitive evidence is excluded from public download links
- Access to Highly Sensitive evidence may be restricted to specific roles

## Audit Logging

Every significant action in DonorDesk is recorded:
- Who did it (user identity)
- What they did (action type)
- When it happened (timestamp)
- What data was affected (entity and ID)

Audit logs are:
- Stored immutably (cannot be deleted or altered)
- Accessible to organisation admins and compliance officers
- Retained for security and compliance purposes

This means if something goes wrong, there is a complete record of what happened.

## AI and Your Data

When you use AI report generation:
- Evidence text and activity data are sent to the AI service to generate your draft
- Data is used only for the specific generation task requested
- Your project data is not used to train AI models
- AI providers are selected with data sensitivity in mind

## No Data Selling

DonorDesk does not sell, rent, or share your project data with third parties for marketing or advertising purposes.

Your data is used only to provide the DonorDesk service to your organisation.

## Your Responsibilities

To keep your data safe:
- Use a **strong, unique password**
- **Never share** your login credentials
- **Enable** two-factor authentication (when available)
- Only invite people you **trust** to your workspace
- Set **appropriate confidentiality levels** on evidence files
- **Log out** when using shared devices
- Report any suspicious activity to **support@donordesk.online** immediately

## Data Residency

By default, DonorDesk processes data on servers in Europe. If your organisation has specific data residency requirements (e.g., data must stay in your country), contact DonorDesk about custom data residency configurations.

## Security Contact

If you discover a security vulnerability or have a security concern, please contact **support@donordesk.online** with details. DonorDesk takes all security reports seriously and will respond promptly.

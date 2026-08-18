# Advanced: Understanding Roles and Permissions

This guide provides a deeper understanding of DonorDesk's role-based access control system.

## Permission Model

DonorDesk uses a two-level permission system:

### Level 1: Organisation-Wide Roles

These roles apply across your entire organisation workspace:

| Role | Scope |
|------|-------|
| Owner | Full access, including billing and deletion |
| Admin | Full access except billing and deletion |
| Project Manager | Project-level access with some organisation features |
| M&E Officer | Data entry and verification focused |
| Field Officer | Limited, activity-focused access |
| Grants Officer | Reporting and compliance focused |
| Compliance Officer | Quality and compliance focused |

### Level 2: Project-Level Permissions

Within each project, users can have additional specific permissions:
- View project
- Edit project
- Manage team
- Submit reports
- Verify evidence
- Approve reports

## Permission Categories

### Authentication Permissions
- `auth.login` — Can log in
- `auth.signup` — Can create new accounts (admin only)

### Organisation Permissions
- `org.view` — View organisation settings
- `org.manage` — Edit organisation settings
- `org.delete` — Delete organisation (owner only)

### Project Permissions
- `project.create` — Create new projects
- `project.view` — View project details
- `project.edit` — Edit project settings
- `project.delete` — Delete project
- `project.archive` — Archive project

### Evidence Permissions
- `evidence.upload` — Upload evidence
- `evidence.view` — View evidence
- `evidence.verify` — Verify evidence
- `evidence.delete` — Delete evidence

### Indicator Permissions
- `indicator.view` — View indicators
- `indicator.update` — Update indicator values
- `indicator.verify` — Verify indicator updates
- `indicator.delete` — Delete indicators

### Report Permissions
- `report.view` — View reports
- `report.create` — Create reports
- `report.edit` — Edit reports
- `report.submit` — Submit for approval
- `report.approve` — Approve reports
- `report.export` — Export reports

### Billing Permissions
- `billing.view` — View billing information
- `billing.manage` — Manage subscription and payments

## Role Hierarchy

Think of roles as layers:

```
Owner (top — everything)
  └── Admin (everything except ownership transfer)
        └── Project Manager (project management)
              └── Grants Officer (reporting focus)
                    └── Compliance Officer (quality focus)
                          └── M&E Officer (data focus)
                                └── Field Officer (limited access)
```

Higher roles inherit all permissions of lower roles.

## Custom Roles (Coming Soon)

Future versions will allow custom roles with specific permission sets.

## Checking Your Permissions

### As a User

1. Click your name → **Settings**
2. Look for **My Permissions** or **Access**
3. See a list of what you can do

### As an Admin

1. Go to **Team**
2. Click on any team member
3. View their role and permissions

## Common Role Assignments

### Small NGO (Starter/Team plan)

| Person | Role |
|--------|------|
| Director/Manager | Admin |
| M&E staff | M&E Officer |
| Field coordinators | Field Officer |
| Programme staff | Field Officer |

### Medium NGO (Growth plan)

| Person | Role |
|--------|------|
| Executive Director | Admin |
| M&E Manager | M&E Officer (with broader access) |
| M&E Officers | M&E Officer |
| Field Officers | Field Officer |
| Grants Manager | Grants Officer |
| Compliance Officer | Compliance Officer |

## Principle of Least Privilege

Always give the minimum permissions needed:
- Do not make everyone an Admin
- Field officers rarely need Admin access
- M&E Officers do not need billing access
- Use project-level permissions for fine control

## Permission Denied Errors

### "You do not have permission"

Your role does not allow this action. Either:
- Ask an admin to perform the action
- Request a role change

### "Access denied to this project"

You are not a member of this project. Ask the project owner to add you.

### "Billing access restricted"

Only the Owner can manage billing. Contact the workspace Owner.

## Elevating Permissions

### Temporary Elevation

In some cases, you may need temporary elevated access:
1. Ask an Admin to temporarily change your role
2. The Admin performs the needed action
3. Your role is restored

### Break-Glass Access

In emergencies, Admins can use "break-glass" access:
1. Admin logs in with elevated justification
2. Performs the necessary action
3. All actions are logged in the audit trail

# Feature 1: Authentication and Onboarding

## Overview

Users can create accounts, log in, reset passwords, and complete a first-time setup wizard to configure their organization.

## Specification (from MVP-features.md)

### Sign Up
Fields:
- Name
- Email
- Password
- Organization name
- Organization type
- Country
- Primary sector

Organization type options: Local NGO, National NGO, INGO, UN implementing partner, Consulting firm, Government programme unit, Other

Primary sector options: Nutrition, Food Security, WASH, Health, Protection, Education, Livelihoods, Shelter, Multi-sector, Other

### Login
- Email + Password authentication

### Password Reset
- Request via email

### First-Time Setup Wizard
Steps:
1. Create organization profile
2. Create first project
3. Upload donor template
4. Upload or create logframe
5. Invite team members
6. Start evidence upload

## Implementation Technical Details

### Data Model

**User Entity** (`packages/domain/src/entities/User.ts`):
- `id: string` (UUID)
- `organizationId: string`
- `name: string`
- `email: string`
- `passwordHash: string`
- `role: UserRole` (Admin, ProjectManager, MEOfficer, GrantsOfficer, FieldOfficer, ComplianceOfficer)
- `status: UserStatus` (Invited, Active, Suspended, Removed)
- `lastLoginAt: Date | null`
- `tenantId: string`
- `createdAt: Date`
- `updatedAt: Date`

**Organization Entity** (`packages/domain/src/entities/Organization.ts`):
- `id: string`
- `name: string`
- `logoUrl: string | null`
- `organizationType: string`
- `country: string`
- `sectors: string[]`
- `contactName: string`
- `contactEmail: string`
- `website: string | null`
- `defaultLanguage: string`
- `tenantId: string`
- `createdAt: Date`
- `updatedAt: Date`

### API Endpoints

| Method | Endpoint | Handler |
|--------|----------|---------|
| POST | `/api/auth/signup` | `signupHandler` |
| POST | `/api/auth/login` | `loginHandler` |
| POST | `/api/auth/logout` | `logoutHandler` |
| POST | `/api/auth/password-reset` | `passwordResetHandler` |
| GET | `/api/auth/me` | `meHandler` |

### Authentication Strategy
- Email/password authentication
- JWT or secure session-based auth
- Password hashing via bcrypt

### Frontend Pages
- `/login` - Login page
- `/signup` - Signup page
- `/forgot-password` - Password reset page
- First-time setup wizard at `/onboarding`

## Status

| Component | Status | Notes |
|-----------|--------|-------|
| Sign Up | Implemented | Basic implementation complete |
| Login | Implemented | Fixed 2026-08-12 (see memorybank/Fixes.md) |
| Google Sign-In | Implemented | Login page button (env-gated); existing accounts by email. See `gdrive.md` §9. Auto-provisioning (sign-up with Google) pending |
| Password Reset | Not implemented | Stub only |
| Onboarding Wizard | Implemented | Account-wide steps only (2026-08-15): Connect Google Drive, Organization profile, Default reporting profile, Invite your team, Accept ToS. Project-specific setup (logframe, donor template, indicators, evidence) moved to the per-project setup checklist (`/projects/[id]/setup`, Feature 18) |
| Session Management | Implemented | JWT-based |
| User Status Management | Implemented | Invited/Active/Suspended/Removed states |

## Pending Enhancements

- [ ] Complete password reset flow with email delivery
- [ ] Email verification on signup
- [ ] Multi-language support in onboarding
- [ ] Organization type/sector dropdown options from database
- [ ] Onboarding wizard progress persistence
- [ ] Account-wide notification preferences step (deadline reminder recipients/lead time) — anticipated, deferred
- [ ] Account-wide timezone + default currency step — anticipated, deferred
- [ ] Sign-up with Google (auto-provisioning) — needs `googleSubject` column + org creation flow
- [ ] Full SSO integration (OIDC start/callback exists; additional providers per Phase 5)

## Notes

The `LlmModel` and `LlmPrompt` tables are global (no `tenantId`) and intentionally not RLS-tenant-isolated per `memorybank/pending.md`.

# Feature 17: Basic Settings

## Overview

Organization and project-level settings, user preferences, and system configuration.

## Specification (from MVP-features.md)

### Organization Settings
From Organization Profile section:
- Organization name
- Organization logo
- Organization type
- Country
- Main office location
- Sectors
- Contact person
- Contact email
- Website
- Donor types served
- Default language

### User Settings
- Profile information
- Password change
- Notification preferences
- Theme preference (light/dark)

### Project Settings
- Project metadata editing
- Team member management
- Reporting frequency configuration
- Deadline settings

### Access Control
- Role-based access control
- Project-level permissions

## Implementation Technical Details

### Settings Categories

**Organization Settings**
- Location: `apps/web/src/app/settings/page.tsx`
- API: `/api/organizations/:id`

**User Settings**
- Location: `apps/web/src/app/settings/profile/page.tsx`
- API: `/api/users/:id`

**Project Settings**
- Location: `apps/web/src/app/projects/:id/settings/page.tsx`
- API: `/api/projects/:id`

### API Endpoints

| Method | Endpoint | Handler |
|--------|----------|---------|
| GET | `/api/settings/organization` | `getOrganizationSettings` |
| PATCH | `/api/settings/organization` | `updateOrganizationSettings` |
| GET | `/api/settings/user` | `getUserSettings` |
| PATCH | `/api/settings/user` | `updateUserSettings` |
| GET | `/api/settings/user/notifications` | `getNotificationPreferences` |
| PATCH | `/api/settings/user/notifications` | `updateNotificationPreferences` |
| POST | `/api/settings/user/password` | `changePassword` |
| GET | `/api/projects/:id/settings` | `getProjectSettings` |
| PATCH | `/api/projects/:id/settings` | `updateProjectSettings` |

### Theme Implementation
- `apps/web/src/components/ThemeScript.tsx` - No-FOUC script
- `apps/web/src/components/ThemeToggle.tsx` - Toggle component
- Persists to `localStorage["donordesk-theme"]`
- Respects system `prefers-color-scheme`

## Status

| Component | Status | Notes |
|-----------|--------|-------|
| Organization Settings | Implemented | Full CRUD |
| User Profile | Implemented | Basic fields |
| Password Change | Implemented | Hash update |
| Notification Preferences | Implemented | Preferences stored |
| Theme Toggle | Implemented | Light/dark |
| Project Settings | Implemented | Metadata + team |
| Theme Persistence | Implemented | localStorage + script |

## Pending Enhancements

- [ ] Email notification delivery (currently logs only per `memorybank/pending.md`)
- [ ] Two-factor authentication settings
- [ ] API key management for integrations
- [ ] Data export (GDPR compliance)
- [ ] Account deletion
- [ ] Organization deletion
- [ ] Session management UI
- [ ] Default project templates
- [ ] Storage quota settings

## Notes

Theme implementation was completed 2026-08-12 with the dark theme redesign. The toggle and persistence work across all pages including auth pages.

Per `memorybank/pending.md`, email/notification delivery is not implemented - notifications currently log only.

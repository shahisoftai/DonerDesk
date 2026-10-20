# Feature 28: Outside partners — access for implementing partners

**DonorDesk Version 2.006**

**Author:** Claude (agent) · **Date:** 2026-10-21
**Status:** Built, tested and deployed 2026-10-20 (batch 3, audit finding H-15; CG-12). The partner's invitation and first screens still need a browser check on the live site. Builds on [Feature 03](03-User-And-Role-Management.md) and the project membership rule in [Feature 04](04-Project-Setup.md).

## 1. What a user gets

| In plain words | Where it shows |
|---|---|
| Invite someone from **another organisation** as an outside partner, to the projects you choose | Team → Invite member → **Outside partner** |
| They are a **field officer** (they report on activities and enter values) or a **viewer** (they only read) | The role list is limited to these two for a partner |
| They see only **those projects**, and only the screens a partner needs | Their navigation; anything else answers "This page is not part of your account" |
| The team list marks them **Outside partner** | Team page |

No new role is added. A partner is an ordinary user with a flag, so every existing permission and project rule still applies to them.

## 2. Rules that matter

- **Only field officers and viewers** can be outside partners. An administrator or manager cannot be.
- **At least one project must be chosen.** A partner with no project would see nothing, so it is refused.
- **Named projects become project memberships** when the invitation is accepted (`AcceptInvitationHandler`). Membership is what opens a project (Feature 04/H-14), so a partner reaches exactly those projects and no others.
- **Every project in an invitation must exist** in the organisation, for any role.
- **Allow-list, not block-list.** `EXTERNAL_ALLOWED` (`apps/api/src/middleware/external-access.ts`) names the routes a partner may use: reading their projects, activities, reporting periods and the framework; reporting activities; uploading evidence; viewing files of their projects; entering indicator values; their notifications and consent. A route added later is closed to partners until someone lists it. A test checks that every allowed route also has an ordinary permission rule.
- **Files** are reachable only when they belong to one of the partner's projects.
- **Project-scoped routes** follow the same membership rule as everyone else (Feature 04, project boundary).
- **The web menu is not yet trimmed.** A partner can see navigation items that answer "not part of your account". Trimming it is open.

## 3. Where it lives

| Layer | Path |
|---|---|
| Domain | `contexts/identity/user.ts`, `invitation.ts` (`external`) |
| Application | `use-cases/identity/invite-user.ts` (validation), `accept-invitation.ts` (memberships on accept), `list-users.ts` (flag) |
| Infrastructure | `repositories/identity.ts`; columns `User.external`, `Invitation.external` (migration `20261021200000_external_partners`) |
| API | `apps/api/src/middleware/external-access.ts`, `middleware/auth.ts` (flag from the directory on each request), `routes/evidence.ts` (multipart project check) |
| Web | `features/team/presentation/TeamPanel.tsx` (form and badge), `app/(portal)/team/page.tsx` (projects list) |

## 4. Limits

- Partner-specific screens and a trimmed menu are not built.
- Partners cannot see comments, the audit trail, reports' approval status, or funding (all outside the allow-list).
- No automatic expiry of a partner's access; remove them from the Team page or change the role.

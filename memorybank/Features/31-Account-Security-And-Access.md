# Feature 31: Account security and project access

**DonorDesk Version 2.006**

**Author:** Claude (agent) · **Date:** 2026-10-21
**Status:** Built, tested and deployed 2026-10-20 (batch 3, audit findings H-12 and H-14). **Multi-factor sign-in is not built** (open). Builds on [Feature 01](01-Authentication-And-Onboarding.md) and [Feature 03](03-User-And-Role-Management.md).

## 1. What a user gets

| In plain words | Where it shows |
|---|---|
| New passwords need **at least 12 characters** and three of: lowercase, uppercase, a number, a symbol. No spaces | Sign-up, invitation acceptance, password change and reset |
| After **five wrong passwords in a row**, sign-in is paused for **15 minutes**. A reset or a correct sign-in clears the count | Sign-in page message: "Too many failed sign-in attempts. Try again in N minutes, or reset your password." |
| An **unknown address** gets the same answer as a wrong password | Sign-in page |
| If a person's role changes, or their account is suspended or removed, it takes effect on their **next request**, not when their session expires | Everywhere |
| Someone who is not an administrator sees a project **only if they are on it** (a member, or named as manager, M&E or reporting officer) | Project list, project pages, and every record inside a project |

A person who is not on a project gets "not found" for it, so the answer does not reveal that the project exists.

## 2. Rules that matter

- **Lockout is kept in the database** (`User.failedLoginCount`, `lockedUntil`), so it survives a restart and works across instances. The cost: someone who knows an address can pause that account for 15 minutes. Operators can see repeated lockouts in the audit trail (`identity.user.locked`, `identity.user.login_failed`).
- **Administrators are never checked against project membership**; they see every project as before.
- **The project boundary covers three places:** the project in the path (`/v1/projects/:id/…`), the record in the path (a report period, a section, an evidence file, an indicator value, a work-plan item), and the project named in a request body. A multipart upload is checked in its route.
- **Creating a project makes its creator a member**, so a non-administrator can open what they made.
- **Sign-up and invitation** use the same policy as a password change.

## 3. Where it lives

| Layer | Path |
|---|---|
| Domain | `policies/login-lockout.ts`; `contexts/identity/user.ts` (`recordFailedLogin`, `lockedAt`); `policies/password-policy.ts` (existing) |
| Application | `use-cases/identity/login.ts`, `sign-up.ts`, `accept-invitation.ts`; `use-cases/projects/create-project.ts` (creator membership) |
| Infrastructure | `repositories/identity.ts`; columns `User.failedLoginCount`, `User.lockedUntil` (migration `20261021160000_login_lockout`) |
| API | `middleware/auth.ts` (role and status from the directory on each request), `middleware/project-boundary.ts`, `routes/evidence.ts` (upload project check) |
| Web | `app/signup/SignupForm.tsx`, `app/invite/accept/InviteAcceptForm.tsx` (12-character minimum) |

## 4. Limits

- **MFA is not built.** Tenant users sign in with a password only (SSO, where configured, is the alternative).
- The password policy applies to new passwords; existing passwords are not forced to change.
- Project membership does not yet control reading the audit trail or the team directory for non-administrators (both are administrator-only today).

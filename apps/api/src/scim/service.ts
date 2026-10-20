import { Email, hashScimToken, TenantId, User, UserId, type Role, type UserStatus } from "@donordesk/domain";
import { randomBytes } from "node:crypto";
import type { ScimRouteOptions } from "./routes.js";
import type { Container } from "@donordesk/infrastructure";

/**
 * The SCIM endpoint's view of the platform.
 *
 * The credential is looked up by token hash on the **admin** connection: the
 * caller does not yet know which organisation it is, and the token is what
 * tells it. Every operation after that is scoped to that organisation by an
 * explicit tenant filter, which is the same isolation the runtime role gets
 * from row-level security.
 */
export function scimRouteOptions(admin: Container): ScimRouteOptions {
  const tenant = (id: string): TenantId => TenantId.create(id);

  return {
    authenticate: async (apiKey: string): Promise<string | null> => {
      const found = await admin.scimCredentials.findByTokenHash(hashScimToken(apiKey));
      if (!found.ok || !found.value) return null;
      if (!found.value.isUsable()) return null;
      found.value.markUsed();
      await admin.scimCredentials.update(found.value);
      return found.value.tenantId.toString();
    },

    listUsers: async (tenantId: string) => {
      const listed = await admin.users.listByTenant(tenant(tenantId));
      if (!listed.ok) return [];
      return listed.value.map((u) => ({
        id: u.id.toString(),
        email: u.email.toString(),
        name: u.name,
        role: u.role,
        active: u.status === "ACTIVE",
      }));
    },

    createUser: async (tenantId: string, input: { email: string; name: string; role?: string }) => {
      const existing = await admin.users.findByEmail(input.email, tenant(tenantId));
      if (existing.ok && existing.value) {
        return { id: existing.value.id.toString() };
      }
      // A provisioned person has no password: they sign in through the
      // identity provider. The hash is of a value nobody has, so the account
      // cannot be signed into with a password.
      const passwordHash = await admin.auth.hashPassword(randomBytes(32).toString("hex"));
      const user = User.create({
        id: UserId.create(admin.ids.generate()),
        tenantId: tenant(tenantId),
        email: Email.create(input.email),
        name: input.name,
        passwordHash,
        role: (input.role ?? "FIELD_OFFICER") as Role,
      });
      const created = await admin.users.create(user);
      if (!created.ok) throw new Error(created.error.message);
      return { id: created.value.id.toString() };
    },

    updateUser: async (
      tenantId: string,
      userId: string,
      input: { email?: string; name?: string; role?: string; active?: boolean },
    ) => {
      const found = await admin.users.findById(userId, tenant(tenantId));
      if (!found.ok) throw new Error(found.error.message);
      if (!found.value) throw new Error("User not found");
      const user = found.value;
      if (input.name !== undefined) user.rename(input.name);
      if (input.email !== undefined) user.changeEmail(Email.create(input.email));
      if (input.role !== undefined) user.changeRole(input.role as Role);
      if (input.active !== undefined) {
        const target: UserStatus = input.active ? "ACTIVE" : "SUSPENDED";
        if (target === "ACTIVE") user.activate();
        else user.suspend();
      }
      const saved = await admin.users.update(user);
      if (!saved.ok) throw new Error(saved.error.message);
    },

    deleteUser: async (tenantId: string, userId: string) => {
      const removed = await admin.users.setStatus(userId, tenant(tenantId), "REMOVED");
      if (!removed.ok) throw new Error(removed.error.message);
    },
  };
}

import type { Result } from "@donordesk/domain";
import { DomainError, Email, PasswordResetToken, TenantId } from "@donordesk/domain";
import type { IUserRepository, IPasswordResetTokenRepository, IPasswordResetRateLimiter } from "../../ports/identity.js";
import type { IIdGenerator, IAuditLogger, INotificationPort, IClock } from "../../ports/core.js";

export interface RequestPasswordResetCommand {
  email: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface RequestPasswordResetOptions {
  /** Base URL used to build the deep-link reset URL (e.g. https://donordesk.online). */
  webBaseUrl: string;
}

const IP_LIMIT = 5;
const IP_WINDOW_MS = 60_000;
const EMAIL_LIMIT = 3;
const EMAIL_WINDOW_MS = 60 * 60_000;

export class RequestPasswordResetHandler {
  constructor(
    private readonly ids: IIdGenerator,
    private readonly users: IUserRepository,
    private readonly tokens: IPasswordResetTokenRepository,
    private readonly rateLimiter: IPasswordResetRateLimiter,
    private readonly audit: IAuditLogger,
    private readonly notify: INotificationPort,
    private readonly clock: IClock,
    private readonly options: RequestPasswordResetOptions,
  ) {}

  async handle(cmd: RequestPasswordResetCommand): Promise<Result<{ accepted: true; deepLink?: string }, DomainError>> {
    const ipKey = `ip:${cmd.ipAddress ?? "unknown"}`;
    const ipAllowed = await this.rateLimiter.check(ipKey, IP_LIMIT, IP_WINDOW_MS);
    if (!ipAllowed) {
      await this.audit.record({
        tenantId: TenantId.create("platform"),
        actorId: "anonymous",
        eventType: "auth.password.reset_rate_limited",
        entityType: "user",
        entityId: "anonymous",
        ipAddress: cmd.ipAddress,
        systemNote: "IP rate limit exceeded",
      });
      return { ok: true, value: { accepted: true } };
    }

    let email: Email | null = null;
    try {
      email = Email.create(cmd.email);
    } catch {
      await this.audit.record({
        tenantId: TenantId.create("platform"),
        actorId: "anonymous",
        eventType: "auth.password.reset_requested",
        entityType: "user",
        entityId: "anonymous",
        ipAddress: cmd.ipAddress,
        newValue: JSON.stringify({ userFound: false, emailValid: false }),
      });
      return { ok: true, value: { accepted: true } };
    }

    const emailKey = `email:${email.toString()}`;
    const emailAllowed = await this.rateLimiter.check(emailKey, EMAIL_LIMIT, EMAIL_WINDOW_MS);
    if (!emailAllowed) {
      await this.audit.record({
        tenantId: TenantId.create("platform"),
        actorId: "anonymous",
        eventType: "auth.password.reset_requested",
        entityType: "user",
        entityId: "anonymous",
        ipAddress: cmd.ipAddress,
        newValue: JSON.stringify({ userFound: false, rateLimited: true }),
      });
      return { ok: true, value: { accepted: true } };
    }

    const userResult = await this.users.findByEmailGlobal(email.toString());
    if (!userResult.ok) return userResult;
    const user = userResult.value;
    if (!user) {
      await this.audit.record({
        tenantId: TenantId.create("platform"),
        actorId: "anonymous",
        eventType: "auth.password.reset_requested",
        entityType: "user",
        entityId: "anonymous",
        ipAddress: cmd.ipAddress,
        newValue: JSON.stringify({ userFound: false }),
      });
      return { ok: true, value: { accepted: true } };
    }

    const tenantId = user.tenantId;
    const expiresAt = new Date(this.clock.now().getTime() + 60 * 60_000);
    const { token, plaintextToken } = PasswordResetToken.create({
      id: this.ids.generate(),
      tenantId,
      userId: user.id.toString(),
      expiresAt,
      ipAddress: cmd.ipAddress,
      userAgent: cmd.userAgent,
    });
    const persisted = await this.tokens.create(token);
    if (!persisted.ok) return persisted;

    const baseUrl = this.options.webBaseUrl.replace(/\/+$/, "");
    const deepLink = `${baseUrl}/reset-password/${plaintextToken}`;

    let notificationSent = true;
    try {
      await this.notify.notify({
        tenantId,
        recipientId: user.id.toString(),
        type: "PASSWORD_RESET",
        title: "Reset your DonorDesk password",
        message: "Use the secure link below to reset your DonorDesk password. The link is valid for 60 minutes and can be used once.",
        relatedEntityType: "password_reset_token",
        relatedEntityId: token.id.toString(),
      });
    } catch {
      notificationSent = false;
    }

    await this.audit.record({
      tenantId,
      actorId: "anonymous",
      eventType: "auth.password.reset_requested",
      entityType: "user",
      entityId: user.id.toString(),
      ipAddress: cmd.ipAddress,
      newValue: JSON.stringify({ userFound: true, notificationSent, tokenId: token.id.toString() }),
    });

    if (!notificationSent && process.env.NODE_ENV !== "production") {
      return { ok: true, value: { accepted: true, deepLink } };
    }
    return { ok: true, value: { accepted: true } };
  }
}

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { IAuthProvider, AuthenticatedUser } from "@donordesk/application";
import { ALL_ROLES, type Role } from "@donordesk/domain";

const SECRET = process.env.JWT_SECRET ?? "dev-only-secret-change-me-in-production-please";
const ISSUER = "donordesk";
const AUDIENCE = "donordesk-api";

export class JwtAuthProvider implements IAuthProvider {
  constructor() {
    if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is required in production");
    }
  }
  async hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, 10);
  }

  async verifyPassword(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }

  async sign(
    payload: { sub: string; tid: string; role: Role; name: string; email: string },
    ttlSeconds: number,
  ): Promise<string> {
    return jwt.sign(payload, SECRET, {
      expiresIn: ttlSeconds,
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithm: "HS256",
    });
  }

  async verify(token: string): Promise<AuthenticatedUser | null> {
    try {
      const decoded = jwt.verify(token, SECRET, {
        issuer: ISSUER,
        audience: AUDIENCE,
        algorithms: ["HS256"],
      }) as {
        sub: string;
        tid: string;
        role: Role;
        name: string;
        email: string;
      };
      if (!decoded.sub || !decoded.tid || !decoded.email || !ALL_ROLES.includes(decoded.role)) return null;
      return {
        userId: decoded.sub,
        tenantId: { toString: () => decoded.tid } as unknown as import("@donordesk/domain").TenantId,
        role: decoded.role,
        email: decoded.email,
        name: decoded.name,
      };
    } catch {
      return null;
    }
  }
}

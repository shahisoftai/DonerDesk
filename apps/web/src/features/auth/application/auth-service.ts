import "server-only";
import { z } from "zod";
import { apiBaseUrl } from "@/lib/server/api-gateway";
import { AuthResponseSchema, type AuthFormState } from "./auth-schemas";

const GENERIC_LOGIN_ERROR = "Unable to sign you in. Please check your email and password and try again.";
const GENERIC_SIGNUP_ERROR = "We could not create your account. Please check your details and try again.";

export class AuthService {
  private readonly baseUrl = apiBaseUrl();

  async login(email: string, password: string): Promise<{ token: string }> {
    const body = z.object({ email: z.string(), password: z.string() }).parse({ email, password });
    const response = await fetch(`${this.baseUrl}/v1/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    return await this.parseAuthResponse(response, GENERIC_LOGIN_ERROR);
  }

  async googleSignIn(code: string, requestedPlan?: "STARTER" | "TEAM" | "GROWTH"): Promise<{ token: string; provisioned: boolean }> {
    const response = await fetch(`${this.baseUrl}/v1/auth/google`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code, ...(requestedPlan ? { requestedPlan } : {}) }),
      cache: "no-store",
    });
    return await this.parseGoogleResponse(response);
  }

  async signup(input: SignupInput): Promise<{ token: string }> {
    const response = await fetch(`${this.baseUrl}/v1/auth/signup`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
      cache: "no-store",
    });
    return await this.parseAuthResponse(response, GENERIC_SIGNUP_ERROR);
  }

  private async parseAuthResponse(response: Response, genericMessage: string): Promise<{ token: string }> {
    const data = await this.parseResponseData(response, genericMessage);
    return { token: data.token };
  }

  private async parseGoogleResponse(response: Response): Promise<{ token: string; provisioned: boolean }> {
    const data = await this.parseResponseData(response, GENERIC_LOGIN_ERROR);
    return { token: data.token, provisioned: data.provisioned === true };
  }

  private async parseResponseData(response: Response, genericMessage: string): Promise<{ token: string; provisioned?: boolean }> {
    if (!response.ok) {
      const message = await this.safeProblemTitle(response);
      if (response.status === 422 || response.status === 400) {
        const fields = await this.safeFieldErrors(response);
        const error: AuthFormState = { error: message ?? "Please correct the highlighted fields.", fields };
        throw new AuthValidationError(error);
      }
      if (response.status === 429) {
        throw new AuthFormError({ error: "Too many attempts. Please wait a moment and try again." });
      }
      throw new AuthFormError({ error: message ?? genericMessage });
    }
    const data = await response.json().catch(() => null);
    const parsed = AuthResponseSchema.safeParse(data);
    if (!parsed.success) {
      throw new AuthFormError({ error: genericMessage });
    }
    return { token: parsed.data.token, provisioned: parsed.data.provisioned };
  }

  private async safeProblemTitle(response: Response): Promise<string | null> {
    const text = await response.text().catch(() => "");
    try {
      const body = JSON.parse(text) as { title?: unknown };
      return typeof body.title === "string" ? body.title : null;
    } catch {
      return null;
    }
  }

  private async safeFieldErrors(response: Response): Promise<Record<string, string[]>> {
    try {
      const body = JSON.parse(await response.text()) as { errors?: Record<string, unknown> };
      const fields: Record<string, string[]> = {};
      if (body.errors) {
        for (const [key, value] of Object.entries(body.errors)) {
          fields[key] = Array.isArray(value) ? value.map(String) : [String(value)];
        }
      }
      return fields;
    } catch {
      return {};
    }
  }
}

export type SignupInput = {
  name: string;
  email: string;
  password: string;
  requestedPlan?: "STARTER" | "TEAM" | "GROWTH";
  organization: {
    name: string;
    organizationType: string;
    country: string;
    primarySector: string;
    defaultLanguage: string;
    dataResidency: string;
    aiEnabled: boolean;
  };
};

export class AuthFormError extends Error {
  readonly state: AuthFormState;
  constructor(state: AuthFormState) {
    super(state.error ?? "Authentication failed");
    this.state = state;
  }
}

export class AuthValidationError extends AuthFormError {
  constructor(state: AuthFormState) {
    super(state);
  }
}

import { randomUUID } from "node:crypto";

export interface ScimUser {
  schemas: string[];
  id?: string;
  externalId?: string;
  userName: string;
  name: {
    givenName: string;
    familyName: string;
    formatted?: string;
  };
  displayName?: string;
  emails?: Array<{
    value: string;
    type?: string;
    primary?: boolean;
  }>;
  active?: boolean;
  groups?: Array<{
    value: string;
    display: string;
  }>;
  meta?: {
    resourceType?: string;
    created?: string;
    lastModified?: string;
  };
}

export interface ScimListResponse {
  schemas: string[];
  totalResults: number;
  startIndex: number;
  itemsPerPage: number;
  Resources: ScimUser[];
}

export interface ScimError {
  schemas: string[];
  status: string;
  detail: string;
}

export const SCIM_USER_SCHEMA = "urn:ietf:params:scim:schemas:core:2.0:User";
export const SCIM_ERROR_SCHEMA = "urn:ietf:params:scim:api:messages:2.0:Error";
export const SCIM_LIST_SCHEMA = "urn:ietf:params:scim:api:messages:2.0:ListResponse";

export function createScimUser(input: {
  id?: string;
  externalId?: string;
  userName: string;
  email: string;
  firstName: string;
  lastName: string;
  active?: boolean;
  groups?: Array<{ value: string; display: string }>;
}): ScimUser {
  return {
    schemas: [SCIM_USER_SCHEMA],
    id: input.id ?? randomUUID(),
    externalId: input.externalId,
    userName: input.userName,
    name: {
      givenName: input.firstName,
      familyName: input.lastName,
      formatted: `${input.firstName} ${input.lastName}`,
    },
    displayName: `${input.firstName} ${input.lastName}`,
    emails: [
      {
        value: input.email,
        type: "work",
        primary: true,
      },
    ],
    active: input.active ?? true,
    groups: input.groups,
    meta: {
      resourceType: "User",
      created: new Date().toISOString(),
      lastModified: new Date().toISOString(),
    },
  };
}

export function parseScimUser(body: unknown): ScimUser {
  if (typeof body !== "object" || body === null) {
    throw new ScimValidationError("Invalid SCIM user payload");
  }
  const user = body as Record<string, unknown>;

  if (!user.userName || typeof user.userName !== "string" || !isEmail(user.userName)) {
    throw new ScimValidationError("userName is required");
  }

  if (user.name !== undefined && (typeof user.name !== "object" || user.name === null || Array.isArray(user.name))) {
    throw new ScimValidationError("name must be an object");
  }
  if (user.emails !== undefined && !Array.isArray(user.emails)) {
    throw new ScimValidationError("emails must be an array");
  }
  if (user.active !== undefined && typeof user.active !== "boolean") {
    throw new ScimValidationError("active must be a boolean");
  }
  const name = user.name as Record<string, unknown> | undefined;
  const emails = user.emails as Array<Record<string, unknown>> | undefined;
  if (emails?.some((email) => typeof email?.value !== "string" || !isEmail(email.value))) {
    throw new ScimValidationError("Every email entry must contain a valid email address");
  }

  return {
    schemas: [SCIM_USER_SCHEMA],
    id: user.id as string | undefined,
    externalId: user.externalId as string | undefined,
    userName: user.userName as string,
    name: {
      givenName: (name?.givenName as string) ?? "",
      familyName: (name?.familyName as string) ?? "",
      formatted: (name?.formatted as string) ?? "",
    },
    displayName: user.displayName as string | undefined,
    emails: emails?.map((e) => ({
      value: e.value as string,
      type: e.type as string | undefined,
      primary: e.primary as boolean | undefined,
    })),
    active: user.active as boolean | undefined,
    groups: (user.groups as Array<Record<string, unknown>>)?.map((g) => ({
      value: g.value as string,
      display: g.display as string,
    })),
    meta: user.meta as ScimUser["meta"],
  };
}

function isEmail(value: unknown): value is string {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export class ScimValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScimValidationError";
  }
}

export function createScimError(status: number, detail: string): ScimError {
  return {
    schemas: [SCIM_ERROR_SCHEMA],
    status: status.toString(),
    detail,
  };
}

export function createScimListResponse(
  users: ScimUser[],
  totalResults: number,
  startIndex = 1,
): ScimListResponse {
  return {
    schemas: [SCIM_LIST_SCHEMA],
    totalResults,
    startIndex,
    itemsPerPage: users.length,
    Resources: users,
  };
}

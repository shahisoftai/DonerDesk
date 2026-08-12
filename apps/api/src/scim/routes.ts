import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { ScimUser, ScimListResponse, ScimError } from "./scim-types.js";
import {
  createScimUser,
  parseScimUser,
  createScimError,
  createScimListResponse,
  SCIM_USER_SCHEMA,
} from "./scim-types.js";

export interface ScimRouteOptions {
  /** Resolve a tenant from a provisioned SCIM credential. Return null on failure. */
  authenticate: (apiKey: string) => Promise<string | null>;
  listUsers: (tenantId: string) => Promise<Array<{
    id: string;
    email: string;
    name: string;
    role: string;
    active: boolean;
  }>>;
  createUser: (tenantId: string, input: {
    email: string;
    name: string;
    role?: string;
  }) => Promise<{ id: string }>;
  updateUser: (tenantId: string, userId: string, input: {
    email?: string;
    name?: string;
    role?: string;
    active?: boolean;
  }) => Promise<void>;
  deleteUser: (tenantId: string, userId: string) => Promise<void>;
}

export function parseBasicAuth(authHeader: string): { user: string; pass: string } | null {
  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Basic") return null;
  try {
    const encodedPart = parts[1] ?? "";
    const decoded = Buffer.from(encodedPart, "base64").toString("utf8");
    const colonIdx = decoded.indexOf(":");
    if (colonIdx === -1) return null;
    return {
      user: decoded.slice(0, colonIdx),
      pass: decoded.slice(colonIdx + 1),
    };
  } catch {
    return null;
  }
}

function scimResponse(reply: FastifyReply, status: number, body: ScimUser | ScimListResponse | ScimError): void {
  reply.status(status).send(body);
}

export async function registerScimRoutes(
  app: FastifyInstance,
  options: ScimRouteOptions,
): Promise<void> {
  const requestTenants = new WeakMap<FastifyRequest, string>();
  const tenantFor = (request: FastifyRequest): string => {
    const tenantId = requestTenants.get(request);
    if (!tenantId) throw new Error("SCIM request was not authenticated");
    return tenantId;
  };
  app.addHook("preHandler", async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      return scimResponse(reply, 401, createScimError(401, "Authorization required"));
    }

    const credentials = parseBasicAuth(authHeader);
    if (!credentials) {
      return scimResponse(reply, 401, createScimError(401, "Invalid authorization header"));
    }

    if (credentials.user !== "scim" || credentials.pass.length < 32) {
      return scimResponse(reply, 401, createScimError(401, "Invalid SCIM credentials"));
    }
    const tenantId = await options.authenticate(credentials.pass);
    if (!tenantId) return scimResponse(reply, 401, createScimError(401, "Invalid SCIM credentials"));
    requestTenants.set(request, tenantId);
  });

  app.get("/scim/v2/Users", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { filter, startIndex: rawStart, count: rawCount } = request.query as {
        filter?: string; startIndex?: string; count?: string;
      };
      const users = await options.listUsers(tenantFor(request));

      let filtered = users;
      if (filter) {
        const match = filter.match(/userName eq "([^"]+)"/);
        if (!match) return scimResponse(reply, 400, createScimError(400, "Unsupported SCIM filter"));
        filtered = users.filter((u) => u.email.toLowerCase() === (match[1] ?? "").toLowerCase());
      }

      const startIndex = Math.max(1, Number.parseInt(rawStart ?? "1", 10) || 1);
      const count = Math.min(100, Math.max(0, Number.parseInt(rawCount ?? "100", 10) || 100));
      const page = filtered.slice(startIndex - 1, startIndex - 1 + count);

      const scimUsers: ScimUser[] = page.map((u) =>
        createScimUser({
          id: u.id,
          userName: u.email,
          email: u.email,
          firstName: u.name.split(" ")[0] ?? "",
          lastName: u.name.split(" ").slice(1).join(" ") || "",
          active: u.active,
        }),
      );

      scimResponse(reply, 200, createScimListResponse(scimUsers, filtered.length, startIndex));
    } catch {
      scimResponse(reply, 500, createScimError(500, "SCIM request failed"));
    }
  });

  app.post("/scim/v2/Users", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const scimUser = parseScimUser(request.body);

      const nameParts = scimUser.name?.givenName
        ? { firstName: scimUser.name.givenName, lastName: scimUser.name.familyName }
        : { firstName: "", lastName: "" };

      const result = await options.createUser(tenantFor(request), {
        email: scimUser.emails?.[0]?.value ?? scimUser.userName,
        name: `${nameParts.firstName} ${nameParts.lastName}`.trim() || (scimUser.displayName ?? scimUser.userName),
        role: "FIELD_OFFICER",
      });

      const created = createScimUser({
        id: result.id,
        userName: scimUser.userName,
        email: scimUser.emails?.[0]?.value ?? scimUser.userName,
        firstName: nameParts.firstName,
        lastName: nameParts.lastName,
        active: scimUser.active ?? true,
      });

      scimResponse(reply, 201, created);
    } catch (err) {
      if (err instanceof Error && err.name === "ScimValidationError") {
        scimResponse(reply, 400, createScimError(400, err.message));
      } else {
        scimResponse(reply, 500, createScimError(500, "SCIM request failed"));
      }
    }
  });

  app.get("/scim/v2/Users/:id", async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const users = await options.listUsers(tenantFor(request));
      const user = users.find((u) => u.id === request.params.id);

      if (!user) {
        return scimResponse(reply, 404, createScimError(404, "User not found"));
      }

      const firstName = user.name.split(" ")[0] ?? "";
      const lastName = user.name.split(" ").slice(1).join(" ") || "";

      scimResponse(reply, 200, createScimUser({
        id: user.id,
        userName: user.email,
        email: user.email,
        firstName,
        lastName,
        active: user.active,
      }));
    } catch {
      scimResponse(reply, 500, createScimError(500, "SCIM request failed"));
    }
  });

  app.put("/scim/v2/Users/:id", async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const scimUser = parseScimUser(request.body);

      await options.updateUser(tenantFor(request), request.params.id, {
        email: scimUser.emails?.[0]?.value,
        name: scimUser.displayName ?? `${scimUser.name?.givenName ?? ""} ${scimUser.name?.familyName ?? ""}`.trim(),
        active: scimUser.active,
      });

      const nameParts = scimUser.name?.givenName
        ? { firstName: scimUser.name.givenName, lastName: scimUser.name.familyName }
        : { firstName: "", lastName: "" };

      scimResponse(reply, 200, createScimUser({
        id: request.params.id,
        userName: scimUser.userName,
        email: scimUser.emails?.[0]?.value ?? scimUser.userName,
        firstName: nameParts.firstName,
        lastName: nameParts.lastName,
        active: scimUser.active ?? true,
      }));
    } catch (err) {
      if (err instanceof Error && err.name === "ScimValidationError") {
        scimResponse(reply, 400, createScimError(400, err.message));
      } else {
        scimResponse(reply, 500, createScimError(500, "SCIM request failed"));
      }
    }
  });

  app.delete("/scim/v2/Users/:id", async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      await options.deleteUser(tenantFor(request), request.params.id);
      reply.status(204).send();
    } catch {
      scimResponse(reply, 500, createScimError(500, "Failed to delete user"));
    }
  });

  app.get("/scim/v2/ServiceProviderConfig", async (_request: FastifyRequest, reply: FastifyReply) => {
    reply.send({
      schemas: ["urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig"],
      documentationUri: "https://donordesk.org/docs/scim",
      patch: { supported: false },
      bulk: { supported: false, maxOperations: 0, maxPayloadSize: 0 },
      filter: { supported: true, maxResults: 100 },
      changePassword: { supported: false },
      sort: { supported: false },
      etag: { supported: false },
      authenticationSchemes: [
        {
          type: "basicauth",
          name: "HTTP Basic",
          description: "Authentication scheme using HTTP Basic",
          specUri: "https://www.rfc-editor.org/rfc/rfc7617",
        },
      ],
    });
  });

  app.get("/scim/v2/ResourceTypes", async (_request: FastifyRequest, reply: FastifyReply) => {
    reply.send({
      schemas: ["urn:ietf:params:scim:schemas:core:2.0:ResourceTypeList"],
      totalResults: 1,
      Resources: [
        {
          schemas: ["urn:ietf:params:scim:schemas:core:2.0:ResourceType"],
          id: "User",
          name: "User",
          endpoint: "/scim/v2/Users",
          description: "User account",
          schema: SCIM_USER_SCHEMA,
          schemaExtensions: [],
        },
      ],
    });
  });

  app.get("/scim/v2/Schemas", async (_request: FastifyRequest, reply: FastifyReply) => {
    reply.send({
      schemas: ["urn:ietf:params:scim:schemas:core:2.0:SchemaList"],
      totalResults: 1,
      Resources: [
        {
          id: SCIM_USER_SCHEMA,
          name: "User",
          description: "User account",
          attributes: [
            { name: "userName", type: "string", required: true, mutability: "readWrite", uniqueness: "server" },
            { name: "name", type: "complex", required: true, mutability: "readWrite" },
            { name: "displayName", type: "string", mutability: "readWrite" },
            { name: "emails", type: "complex", multiValued: true, mutability: "readWrite" },
            { name: "active", type: "boolean", mutability: "readWrite" },
            { name: "groups", type: "complex", multiValued: true, mutability: "readOnly" },
          ],
        },
      ],
    });
  });
}

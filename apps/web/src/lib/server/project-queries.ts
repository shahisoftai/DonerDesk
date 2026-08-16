import "server-only";
import { cache } from "react";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { ProjectDetailSchema, ProjectMembersResponseSchema, type ProjectDetail, type ProjectMember } from "@/lib/server/schemas";
import type { Result } from "@/lib/shared/result";
import type { AppError } from "@/lib/shared/app-error";

export const getProject = cache(
  (token: string, projectId: string): Promise<Result<ProjectDetail, AppError>> => {
    return gatewayRequest(`/v1/projects/${projectId}`, ProjectDetailSchema, token);
  },
);

export const getProjectMembers = cache(
  (token: string, projectId: string): Promise<Result<ProjectMember[], AppError>> => {
    return gatewayRequest(`/v1/projects/${projectId}/members`, ProjectMembersResponseSchema, token).then((r) =>
      r.ok ? { ok: true, value: r.value.items } : r,
    );
  },
);

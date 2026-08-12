import "server-only";
import { cache } from "react";
import { gatewayRequest } from "@/lib/server/api-gateway";
import {
  ProjectsResponseSchema,
  TemplatesResponseSchema,
  LogframeResponseSchema,
  TeamResponseSchema,
  EvidenceResponseSchema,
  OrganizationSchema,
} from "@/lib/server/schemas";
import type { Result } from "@/lib/shared/result";
import type { AppError } from "@/lib/shared/app-error";

export type OnboardingSnapshot = {
  orgName: string;
  hasOrg: boolean;
  projectCount: number;
  firstProjectId: string | null;
  templateCount: number;
  logframeItemCount: number;
  teamCount: number;
  evidenceCount: number;
};

export type OnboardingLoad = {
  snapshot: Result<OnboardingSnapshot, AppError>;
};

export const loadOnboarding = cache(async (token: string): Promise<OnboardingLoad> => {
  const [orgResult, projectsResult, teamResult] = await Promise.all([
    gatewayRequest("/v1/organization", OrganizationSchema, token),
    gatewayRequest("/v1/projects", ProjectsResponseSchema, token),
    gatewayRequest("/v1/users", TeamResponseSchema, token),
  ]);

  const projects = projectsResult.ok ? projectsResult.value.items : [];
  const firstProjectId = projects[0]?.id ?? null;

  const [templatesResult, logframeResult, evidenceResult] = firstProjectId
    ? await Promise.all([
        gatewayRequest(`/v1/projects/${firstProjectId}/templates`, TemplatesResponseSchema, token),
        gatewayRequest(`/v1/projects/${firstProjectId}/logframe`, LogframeResponseSchema, token),
        gatewayRequest("/v1/evidence/search", EvidenceResponseSchema, token, {
          method: "POST",
          body: { projectId: firstProjectId, page: 1, pageSize: 1 },
        }),
      ])
    : [null, null, null];

  const primaryError = projectsResult.ok ? null : projectsResult.error;
  if (!projectsResult.ok && !teamResult.ok && !orgResult.ok) {
    return {
      snapshot: {
        ok: false,
        error: primaryError ?? { kind: "unavailable", message: "Could not load onboarding status.", retryable: true },
      },
    };
  }

  const orgName = orgResult.ok ? (orgResult.value.name ?? "") : "";

  const snapshot: OnboardingSnapshot = {
    orgName,
    hasOrg: orgResult.ok && orgName.length > 0,
    projectCount: projectsResult.ok ? projects.length : 0,
    firstProjectId,
    templateCount: templatesResult?.ok ? templatesResult.value.items.length : 0,
    logframeItemCount: logframeResult?.ok ? logframeResult.value.items.length : 0,
    teamCount: teamResult.ok ? teamResult.value.items.length : 0,
    evidenceCount: evidenceResult?.ok ? evidenceResult.value.items.length : 0,
  };

  return { snapshot: { ok: true, value: snapshot } };
});

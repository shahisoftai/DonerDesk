import "server-only";
import { cache } from "react";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { ProjectDetailSchema } from "@/lib/server/schemas";
import type { Result } from "@/lib/shared/result";
import type { AppError } from "@/lib/shared/app-error";

export type ProjectDetail = {
  id: string;
  title: string;
  projectCode: string;
  donorName: string;
  country: string;
  sector: string;
  status: string;
  reportingFrequency: string;
  daysRemaining: number;
};

export const getProject = cache(
  (token: string, projectId: string): Promise<Result<ProjectDetail, AppError>> => {
    return gatewayRequest(`/v1/projects/${projectId}`, ProjectDetailSchema, token);
  },
);

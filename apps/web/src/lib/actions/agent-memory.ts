"use server";

import { ApproveAgentMemorySchema, AgentMemorySchema, type AgentMemoryOutput } from "@donordesk/contracts";
import { z } from "zod";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import type { Result } from "@/lib/shared/result";
import type { AppError } from "@/lib/shared/app-error";
import { OkResponseSchema } from "./_schemas";

export type { AgentMemoryOutput };

export async function listAgentMemoryAction(status: "PROPOSED" | "ACTIVE"): Promise<Result<AgentMemoryOutput[], AppError>> {
  const context = await requireSession();
  return gatewayRequest(`/v1/agent-memory?status=${status}`, z.array(AgentMemorySchema), context.token);
}

export async function approveAgentMemoryAction(id: string, input: unknown = {}): Promise<Result<undefined, AppError>> {
  const context = await requireSession();
  const parsed = ApproveAgentMemorySchema.safeParse(input);
  const body = parsed.success ? parsed.data : {};
  const result = await gatewayRequest(`/v1/agent-memory/${id}/approve`, OkResponseSchema, context.token, {
    method: "POST",
    body,
  });
  if (!result.ok) return result;
  return { ok: true, value: undefined };
}

export async function rejectAgentMemoryAction(id: string): Promise<Result<undefined, AppError>> {
  const context = await requireSession();
  const result = await gatewayRequest(`/v1/agent-memory/${id}/reject`, OkResponseSchema, context.token, { method: "POST" });
  if (!result.ok) return result;
  return { ok: true, value: undefined };
}

export async function deactivateAgentMemoryAction(id: string): Promise<Result<undefined, AppError>> {
  const context = await requireSession();
  const result = await gatewayRequest(`/v1/agent-memory/${id}/deactivate`, OkResponseSchema, context.token, { method: "POST" });
  if (!result.ok) return result;
  return { ok: true, value: undefined };
}

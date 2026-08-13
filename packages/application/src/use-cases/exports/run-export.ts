import type { Result } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { CreateExportInput } from "@donordesk/contracts";
import { CreateExportHandler } from "./create-export.js";

/**
 * Thin internal entry point for an automated export on period close. Delegates
 * to the existing export builder so export behaviour is not duplicated.
 */
export class RunExportHandler {
  constructor(private readonly delegate: CreateExportHandler) {}

  handle(ctx: AuthenticatedContext, input: CreateExportInput): ReturnType<CreateExportHandler["handle"]> {
    return this.delegate.handle(ctx, input);
  }
}

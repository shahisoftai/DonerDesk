import type { Result } from "@donordesk/domain";
import { DomainError, ActivityUpdate, parseActivityText } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IActivityUpdateRepository } from "../../ports/activities.js";
import type { ILogframeRepository, IIndicatorRepository } from "../../ports/logframe.js";
import type { IIdGenerator, IAuditLogger } from "../../ports/core.js";
import type { ImportActivitiesTextInput } from "@donordesk/contracts";

const MAX_IMPORT_ROWS = 1000;

export interface ImportedActivity {
  id: string;
  activityTitle: string;
  activityDate: string;
}

export interface ImportActivitiesResult {
  created: number;
  skipped: number;
  warnings: string[];
  items: ImportedActivity[];
}

/**
 * Parses activity content (from an upload or template) and persists each row
 * as a submitted ActivityUpdate. Output and indicator links are resolved from
 * the project's logframe item codes and indicator codes; rows whose title
 * already exists in the project are skipped with a warning.
 */
export class ImportActivitiesHandler {
  constructor(
    private readonly ids: IIdGenerator,
    private readonly activities: IActivityUpdateRepository,
    private readonly logframe: ILogframeRepository,
    private readonly indicators: IIndicatorRepository,
    private readonly audit: IAuditLogger,
  ) {}

  async handle(
    ctx: AuthenticatedContext,
    input: ImportActivitiesTextInput,
  ): Promise<Result<ImportActivitiesResult, DomainError>> {
    const { rows, warnings, structured } = parseActivityText(input.text);
    if (rows.length === 0 || !structured) {
      return {
        ok: false,
        error: DomainError.validation(
          "No activities could be parsed. Expected columns for Activity Title, Activity Date, and Summary.",
        ),
      };
    }
    if (rows.length > MAX_IMPORT_ROWS) {
      return {
        ok: false,
        error: DomainError.validation(
          `Too many activities (${rows.length}). Imports are limited to ${MAX_IMPORT_ROWS} rows; split the file and import in batches.`,
        ),
      };
    }

    const logframeResult = await this.logframe.findByProject(input.projectId, ctx.tenant.tenantId);
    if (!logframeResult.ok) return logframeResult;
    const itemByCode = new Map<string, string>();
    for (const item of logframeResult.value) {
      if (!item.code) continue;
      itemByCode.set(item.code.trim().toLowerCase(), item.id);
    }

    const indicatorResult = await this.indicators.findByProject(input.projectId, ctx.tenant.tenantId);
    if (!indicatorResult.ok) return indicatorResult;
    const indicatorByCode = new Map<string, string>();
    for (const ind of indicatorResult.value) {
      indicatorByCode.set(ind.code.trim().toLowerCase(), ind.id);
    }

    const existingResult = await this.activities.findByProject(input.projectId, ctx.tenant.tenantId);
    if (!existingResult.ok) return existingResult;
    const existingTitles = new Set(existingResult.value.map((a) => a.activityTitle.trim().toLowerCase()));

    const created: ImportedActivity[] = [];
    let skipped = 0;
    const importWarnings: string[] = [...warnings];

    for (const row of rows) {
      const titleKey = row.activityTitle.trim().toLowerCase();
      if (existingTitles.has(titleKey)) {
        skipped++;
        continue;
      }

      const outputId = row.outputCode ? itemByCode.get(row.outputCode.trim().toLowerCase()) : undefined;
      if (row.outputCode && !outputId) {
        importWarnings.push(`Activity "${row.activityTitle}": output code "${row.outputCode}" does not match any logframe item; left unlinked.`);
      }
      const indicatorId = row.indicatorCode ? indicatorByCode.get(row.indicatorCode.trim().toLowerCase()) : undefined;
      if (row.indicatorCode && !indicatorId) {
        importWarnings.push(`Activity "${row.activityTitle}": indicator code "${row.indicatorCode}" does not match any indicator; left unlinked.`);
      }

      const id = this.ids.generate();
      const activity = ActivityUpdate.create({
        id,
        tenantId: ctx.tenant.tenantId.toString(),
        projectId: input.projectId,
        reportingPeriodId: input.reportingPeriodId,
        activityTitle: row.activityTitle,
        activityDate: new Date(row.activityDate),
        location: row.location,
        outputId,
        indicatorId,
        participantsTotal: row.participantsTotal,
        participantsMale: row.participantsMale,
        participantsFemale: row.participantsFemale,
        participantsChildren: row.participantsChildren,
        participantsDisability: row.participantsDisability,
        participantsOther: row.participantsOther,
        summary: row.summary,
        achievements: row.achievements ?? "",
        challenges: row.challenges ?? "",
        lessonsLearned: row.lessonsLearned ?? "",
        nextSteps: row.nextSteps ?? "",
        submittedById: ctx.tenant.userId,
      });
      activity.submit();
      const saved = await this.activities.create(activity);
      if (!saved.ok) return saved;

      existingTitles.add(titleKey);
      created.push({
        id,
        activityTitle: activity.activityTitle,
        activityDate: activity.activityDate.toISOString(),
      });
    }

    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "activity.bulk.imported",
      entityType: "activity_update",
      entityId: input.projectId,
      projectId: input.projectId,
      newValue: JSON.stringify({ created: created.length, skipped, sourceName: input.sourceName }),
    });

    return {
      ok: true,
      value: {
        created: created.length,
        skipped,
        warnings: importWarnings,
        items: created,
      },
    };
  }
}

import type { IJobQueue } from "@donordesk/application";
import { type JobName } from "@donordesk/contracts";

export interface KestraFlowRef {
  namespace: string;
  flowId: string;
}

/**
 * Flow mapping table — the single place that maps a job class to the Kestra
 * flow that owns it. OCP: to add a job, add a row here (and a name to
 * `JOB_NAMES`); no code in the dispatcher/use-cases changes.
 */
const FLOW_BY_JOB: Record<JobName, KestraFlowRef> = {
  "evidence.ingest": { namespace: "donor_desk.phase1", flowId: "evidence_ingest" },
  "evidence.suggest_tags": { namespace: "donor_desk.phase1", flowId: "evidence_ingest" },
  "activity.polish": { namespace: "donor_desk.phase1", flowId: "activity_polish" },
  "report.draft_section": { namespace: "donor_desk.phase1", flowId: "report_draft_section" },
  "readiness.recompute": { namespace: "donor_desk.phase1", flowId: "readiness_recompute" },
  "checklist.generate": { namespace: "donor_desk.phase1", flowId: "checklist_generate" },
  "export.run": { namespace: "donor_desk.phase1", flowId: "export_on_close" },
  "reminder.deadline": { namespace: "donor_desk.phase1", flowId: "deadline_reminders" },
};

export interface KestraJobQueueOptions {
  baseUrl?: string;
  tenant?: string;
  username?: string;
  password?: string;
  /** Inject for tests; defaults to the global fetch. */
  fetchImpl?: typeof fetch;
}

/**
 * Enqueues jobs by triggering a Kestra flow execution over HTTP. Bound to
 * `KESTRA_URL` (loopback), `KESTRA_TENANT`, and Kestra Basic Auth credentials —
 * all kept in the deployment environment so the queue is never public.
 */
export class KestraJobQueue implements IJobQueue {
  private readonly baseUrl: string;
  private readonly tenant: string;
  private readonly username: string;
  private readonly password: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options?: KestraJobQueueOptions) {
    this.baseUrl = (options?.baseUrl ?? process.env.KESTRA_URL ?? "http://127.0.0.1:8080").replace(/\/+$/, "");
    this.tenant = options?.tenant ?? process.env.KESTRA_TENANT ?? "main";
    this.username = options?.username ?? process.env.KESTRA_USER ?? "admin@donordesk.local";
    this.password = options?.password ?? process.env.KESTRA_PASSWORD ?? "";
    this.fetchImpl = options?.fetchImpl ?? fetch;
  }

  private executionUrl(ref: KestraFlowRef): string {
    const ns = encodeURIComponent(ref.namespace);
    const flow = encodeURIComponent(ref.flowId);
    if (this.tenant) {
      return `${this.baseUrl}/api/v1/${encodeURIComponent(this.tenant)}/executions/${ns}/${flow}`;
    }
    return `${this.baseUrl}/api/v1/executions/${ns}/${flow}`;
  }

  async enqueue(name: string, payload: Record<string, unknown>): Promise<void> {
    const flow = FLOW_BY_JOB[name as JobName];
    if (!flow) throw new Error(`No Kestra flow mapped for job: ${name}`);
    if (!this.password) throw new Error("KestraJobQueue requires KESTRA_PASSWORD");

    const form = new FormData();
    for (const [key, value] of Object.entries(payload)) {
      if (value !== undefined && value !== null) {
        form.append(key, typeof value === "string" ? value : JSON.stringify(value));
      }
    }

    const response = await this.fetchImpl(this.executionUrl(flow), {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.username}:${this.password}`).toString("base64")}`,
      },
      body: form,
    });
    if (!response.ok) {
      throw new Error(`Kestra execution create failed: HTTP ${response.status}`);
    }
  }
}

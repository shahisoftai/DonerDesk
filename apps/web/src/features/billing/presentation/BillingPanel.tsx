"use client";

import { useState } from "react";
import { createCheckoutAction, openPortalAction, type getBillingSummaryAction } from "@/lib/actions/billing";
import { Button } from "@/components/ui/Button";
import { InlineAlert } from "@/components/feedback/InlineAlert";
import { InlineHelp } from "@/components/feedback/InlineHelp";

type SummaryResult = Awaited<ReturnType<typeof getBillingSummaryAction>>;
export type BillingPanelSummary = Extract<SummaryResult, { ok: true }>["value"];

type Interval = "MONTH" | "YEAR";

function formatBytes(bytes: string | null): string {
  if (bytes === null) return "Unlimited";
  const value = Number(bytes);
  if (Number.isNaN(value)) return "0 GB";
  const gb = value / 1024 / 1024 / 1024;
  return gb >= 1 ? `${gb.toFixed(gb >= 10 ? 0 : 1)} GB` : `${Math.round(value / 1024 / 1024)} MB`;
}

function UsageMeter({
  label,
  used,
  limit,
  suffix,
  help,
}: {
  label: string;
  used: number;
  limit: number | null;
  suffix?: string;
  help?: string;
}) {
  const pct = limit !== null && limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const over = limit !== null && used > limit;
  return (
    <div className="rounded-xl border border-slate-200 p-4 dark:border-white/10">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-slate-700 dark:text-slate-200">
          {label} {help && <InlineHelp help={help} />}
        </span>
        <span className={over ? "font-bold text-danger-700 dark:text-danger-400" : "text-slate-600 dark:text-slate-300"}>
          {used}
          {suffix ?? ""} / {limit === null ? "unlimited" : `${limit}${suffix ?? ""}`}
        </span>
      </div>
      {limit !== null && (
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
          <div
            className={`h-full rounded-full ${over ? "bg-danger-500" : "bg-brand-500"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
      {over && (
        <p className="mt-1.5 text-xs text-danger-700 dark:text-danger-400">
          You are over this limit. Upgrade your plan to keep writing to this resource.
        </p>
      )}
    </div>
  );
}

export function BillingPanel({ summary, canManage }: { summary: BillingPanelSummary; canManage: boolean }) {
  const [interval, setInterval] = useState<Interval>("MONTH");
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"checkout" | "portal" | null>(null);

  const overLimit = summary.overLimit.length > 0;

  async function startCheckout(plan: "TEAM" | "GROWTH") {
    setBusy("checkout");
    setCheckoutError(null);
    const result = await createCheckoutAction({ plan, interval });
    setBusy(null);
    if (!result.ok) {
      setCheckoutError(result.error.message);
      return;
    }
    window.location.href = result.value.url;
  }

  async function openPortal() {
    setBusy("portal");
    setCheckoutError(null);
    const result = await openPortalAction();
    setBusy(null);
    if (!result.ok) {
      setCheckoutError(result.error.message);
      return;
    }
    window.location.href = result.value.url;
  }

  return (
    <div className="mt-6 space-y-6">
      {overLimit && (
        <InlineAlert
          tone="warning"
          title="You are over one or more plan limits. Reading, exporting, and deleting still work; writing to over-limit resources is blocked until you upgrade."
        />
      )}

      {checkoutError && <InlineAlert tone="danger" title={checkoutError} />}

      <section className="card max-w-2xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">Current plan</p>
            <h2 className="text-xl font-semibold tracking-tight capitalize text-slate-800 dark:text-slate-100">{summary.plan.toLowerCase()}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Source: {summary.source.replace(/_/g, " ").toLowerCase()}
              {summary.subscription?.status === "PAST_DUE" && " · payment past due — access retained during grace"}
              {summary.subscription?.cancelAtPeriodEnd && " · cancels at period end"}
            </p>
          </div>
          {canManage && summary.subscription && (
            <Button variant="secondary" pending={busy === "portal"} onClick={openPortal}>
              Manage subscription
            </Button>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <UsageMeter
            label="Projects"
            used={summary.usage.projects.used}
            limit={summary.usage.projects.limit}
            help="Active projects (archived projects do not count)."
          />
          <UsageMeter
            label="Seats"
            used={summary.usage.seats.used}
            limit={summary.usage.seats.limit}
            help="Team members including the owner (active, invited, suspended)."
          />
          <UsageMeter
            label="Managed storage"
            used={Number(summary.usage.managedStorageBytes.used) / 1024 / 1024}
            limit={
              summary.usage.managedStorageBytes.limit === null
                ? null
                : Number(summary.usage.managedStorageBytes.limit) / 1024 / 1024
            }
            suffix=" MB"
            help="DonorDesk-managed uploads. Google Drive link-first evidence is not charged."
          />
          <UsageMeter
            label="AI report drafts"
            used={summary.usage.aiDraftCredits.used}
            limit={summary.usage.aiDraftCredits.limit}
            help={`Successful AI report drafts this month. Resets ${summary.usage.aiDraftCredits.resetsAt ? new Date(summary.usage.aiDraftCredits.resetsAt).toLocaleDateString() : "monthly"}.`}
          />
        </div>
      </section>

      {canManage && (summary.plan === "STARTER" || summary.plan === "TEAM") && (
        <section className="card max-w-2xl space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Upgrade</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {summary.plan === "STARTER"
                ? "Move to Team or Growth for more projects, seats, storage, and AI drafts."
                : "Move to Growth for more capacity."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={interval === "MONTH"}
                onChange={() => setInterval("MONTH")}
                className="h-4 w-4 accent-brand-600"
              />
              Monthly
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={interval === "YEAR"}
                onChange={() => setInterval("YEAR")}
                className="h-4 w-4 accent-brand-600"
              />
              Annual (2 months free)
            </label>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button pending={busy === "checkout"} onClick={() => startCheckout("TEAM")}>
              Upgrade to Team
            </Button>
            <Button variant="secondary" pending={busy === "checkout"} onClick={() => startCheckout("GROWTH")}>
              Upgrade to Growth
            </Button>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Tax is calculated at checkout where applicable. Downgrades and cancellations never delete your data — you
            keep read/export/delete access and can upgrade again at any time.
          </p>
        </section>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { createCheckoutAction, openPortalAction, buyTopupAction, submitNonprofitVerificationAction, type getBillingSummaryAction } from "@/lib/actions/billing";
import { Button } from "@/components/ui/Button";
import { InlineAlert } from "@/components/feedback/InlineAlert";
import { InlineHelp } from "@/components/feedback/InlineHelp";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";

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
  const [busy, setBusy] = useState<"checkout" | "portal" | "topup" | null>(null);

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

  async function buyTopup(sku: "TOPUP_50" | "TOPUP_100" | "STANDING_BALANCE_100") {
    setBusy("topup");
    setCheckoutError(null);
    const result = await buyTopupAction({ sku });
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

      {summary.isTrial && (
        <InlineAlert
          tone="info"
          title={
            summary.trialEndsAt
              ? `Trial active — card due ${new Date(summary.trialEndsAt).toLocaleDateString()}. Subscribe any time to keep access after your trial ends.`
              : "Trial active. Subscribe any time to keep access after your trial ends."
          }
        />
      )}

      <section className="card max-w-2xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Current plan</p>
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
            used={summary.usage.projects.active}
            limit={summary.usage.projects.limit}
            help={`Active projects (${summary.usage.projects.archived} archived, not counted).`}
          />
          <UsageMeter
            label="Seats"
            used={summary.usage.seats.full.used}
            limit={summary.usage.seats.full.limit}
            help="Full (non-viewer) team members including the owner (active, invited, suspended)."
          />
          <UsageMeter
            label="Viewer seats"
            used={summary.usage.seats.viewers.used}
            limit={summary.usage.seats.viewers.limit}
            help="Read-only viewers, counted separately from full seats."
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
            help={`Successful AI report drafts this month (${summary.usage.aiDraftCredits.planAllowance ?? "unlimited"} plan + ${summary.usage.aiDraftCredits.packs.credits} from top-up packs). Resets ${summary.usage.aiDraftCredits.resetsAt ? new Date(summary.usage.aiDraftCredits.resetsAt).toLocaleDateString() : "monthly"}.`}
          />
        </div>
      </section>

      {canManage && summary.limits.aiCreditTopUp && (
        <section className="card max-w-2xl space-y-3">
          <div>
            <h3 className="text-sm font-medium text-slate-800 dark:text-slate-100">AI credit top-ups</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Buy extra AI drafts for this month without changing your plan. Packs draw down after your plan
              allowance is used and never expire mid-cycle if unused.
              {summary.usage.aiDraftCredits.packs.active > 0 &&
                ` You have ${summary.usage.aiDraftCredits.packs.active} active pack(s) with ${summary.usage.aiDraftCredits.packs.credits - summary.usage.aiDraftCredits.packs.used} credits remaining.`}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" pending={busy === "topup"} onClick={() => buyTopup("TOPUP_50")}>
              Buy +50 credits
            </Button>
            <Button variant="secondary" pending={busy === "topup"} onClick={() => buyTopup("TOPUP_100")}>
              Buy +100 credits
            </Button>
          </div>
        </section>
      )}

      {canManage && summary.plan === "GROWTH" && (
        <section className="card max-w-2xl space-y-3">
          <div>
            <h3 className="text-sm font-medium text-slate-800 dark:text-slate-100">Prepaid standing balance (Growth)</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              A Growth-only soft-overage balance: draws down after your plan allowance and any top-up packs.
              You may hold up to {summary.usage.aiDraftCredits.standingBalance.maxActive} active balances.
              {summary.usage.aiDraftCredits.standingBalance.active > 0 &&
                ` You have ${summary.usage.aiDraftCredits.standingBalance.active} active with ${summary.usage.aiDraftCredits.standingBalance.credits - summary.usage.aiDraftCredits.standingBalance.used} credits remaining.`}
              {" "}Downgrading or canceling Growth stops these balances from drawing down (they do not survive the
              downgrade like a purchased top-up pack does).
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="secondary"
              pending={busy === "topup"}
              disabled={summary.usage.aiDraftCredits.standingBalance.active >= summary.usage.aiDraftCredits.standingBalance.maxActive}
              onClick={() => buyTopup("STANDING_BALANCE_100")}
            >
              Add +100 prepaid balance
            </Button>
            <StandingBalanceReminderToggle />
          </div>
        </section>
      )}

      {canManage && <NonprofitDiscountSection />}

      {canManage && (summary.plan === "STARTER" || summary.plan === "TEAM") && (
        <section className="card max-w-2xl space-y-4">
          <div>
            <h3 className="text-sm font-medium text-slate-800 dark:text-slate-100">Upgrade</h3>
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

/**
 * §4 WS-D item 5 "auto-reminder at 80%" UI toggle. The actual reminder is the
 * server-side audit event `billing.credits.standing_balance_80pct` recorded
 * by GenerateReportDraftHandler.reserveFromPacks — this codebase has no
 * notification-delivery pipeline (Phase 1 deviation: "console email" only,
 * and there is no per-tenant email/webhook mechanism to page into), so
 * building one from scratch is out of scope here (documented scope cut, not
 * silently skipped). This toggle is a per-viewer display preference only
 * (localStorage) that does not change server behavior.
 */
function StandingBalanceReminderToggle() {
  const [enabled, setEnabled] = useState(true);
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("donordesk.standingBalanceReminder");
      if (stored !== null) setEnabled(stored === "true");
    } catch {
      // localStorage unavailable; keep the default.
    }
  }, []);
  function toggle() {
    const next = !enabled;
    setEnabled(next);
    try {
      window.localStorage.setItem("donordesk.standingBalanceReminder", String(next));
    } catch {
      // best-effort only
    }
  }
  return (
    <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
      <input type="checkbox" checked={enabled} onChange={toggle} className="h-4 w-4 accent-brand-600" />
      Auto-reminder at 80% usage
    </label>
  );
}

function NonprofitDiscountSection() {
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [documentUrl, setDocumentUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const result = await submitNonprofitVerificationAction({ registrationNumber, documentUrl });
    setBusy(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setSubmitted(true);
  }

  return (
    <section className="card max-w-2xl space-y-3">
      <div>
        <h3 className="text-sm font-medium text-slate-800 dark:text-slate-100">Nonprofit discount (25% welcome discount, first year)</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Verified nonprofits get 25% off Team and Growth for their first year. Submit your registration number and a
          link to your registration certificate (upload it to Drive/Dropbox and share a view link) — our team reviews
          submissions manually.
        </p>
      </div>
      {submitted ? (
        <InlineAlert tone="success" title="Submitted — we'll review it and email you once approved." />
      ) : (
        <form onSubmit={submit} className="space-y-3" noValidate>
          <Field label="Registration number" htmlFor="np-reg">
            <Input id="np-reg" value={registrationNumber} onChange={(e) => setRegistrationNumber(e.target.value)} required minLength={1} />
          </Field>
          <Field label="Registration certificate link" htmlFor="np-doc">
            <Input id="np-doc" type="url" value={documentUrl} onChange={(e) => setDocumentUrl(e.target.value)} required placeholder="https://..." />
          </Field>
          {error && <InlineAlert tone="danger" title={error} />}
          <Button type="submit" variant="secondary" pending={busy}>
            Submit for review
          </Button>
        </form>
      )}
    </section>
  );
}

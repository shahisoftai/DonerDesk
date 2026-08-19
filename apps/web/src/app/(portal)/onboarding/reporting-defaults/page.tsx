import Link from "next/link";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { OrganizationProfileSchema } from "@/lib/server/schemas";
import { InlineError } from "@/components/feedback/PageState";
import { ReportingDefaultsForm } from "./ReportingDefaultsForm";

export const dynamic = "force-dynamic";

export default async function OnboardingReportingDefaultsPage() {
  const ctx = await requireSession();
  const result = await gatewayRequest("/v1/organization", OrganizationProfileSchema, ctx.token);
  if (!result.ok) {
    return (
      <div className="animate-fade-in">
        <h1 className="text-xl font-semibold tracking-tight">Default reporting profile</h1>
        <div className="mt-6"><InlineError title={result.error.message} referenceId={result.error.referenceId} /></div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <Link href="/onboarding" className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-400">
        ← Back to setup
      </Link>
      <h1 className="mt-2 text-xl font-semibold tracking-tight">Default reporting profile</h1>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        These settings are applied to every new project you create. You can always
        override them per project from the project setup checklist.
      </p>
      <div className="mt-6">
        <ReportingDefaultsForm
          initialDefaults={result.value.reportingDefaults ?? { tone: "FORMAL", formattingRules: [], autoPeriodCreation: false }}
          defaultLanguage={result.value.defaultLanguage ?? "en"}
        />
      </div>
    </div>
  );
}

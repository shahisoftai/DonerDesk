import { requireSession } from "@/lib/server/auth-context";
import { listSetupProposalsAction } from "@/lib/actions/project-setup";
import { SetupWizard } from "@/features/project-setup/presentation/SetupWizard";

export const dynamic = "force-dynamic";

export default async function SetupFromDocumentPage({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  await requireSession();
  const { s } = await searchParams;
  const list = await listSetupProposalsAction();
  const recent = list.ok ? list.value.proposals.slice(0, 10) : [];
  return <SetupWizard view={null} recent={recent} asked={s ?? null} />;
}

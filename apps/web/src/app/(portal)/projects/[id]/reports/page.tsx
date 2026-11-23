import { ProjectPeriodsPage } from "@/features/reporting/presentation/ProjectPeriodsPage";

export const dynamic = "force-dynamic";

export default async function ReportsPage({ params }: { params: Promise<{ id: string }> }) {
  return <ProjectPeriodsPage projectId={(await params).id} variant="REPORTS" />;
}

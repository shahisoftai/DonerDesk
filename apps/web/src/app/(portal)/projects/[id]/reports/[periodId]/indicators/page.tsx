import { redirect } from "next/navigation";

/** Indicator entry now lives on the report inputs page (Report Editor P5). */
export default async function IndicatorEntryRedirect({ params }: { params: Promise<{ id: string; periodId: string }> }) {
  const { id, periodId } = await params;
  redirect(`/projects/${id}/reports/${periodId}/inputs?tab=indicators`);
}

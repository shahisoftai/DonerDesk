import { ChartStudioPanel } from "@/features/visual-studio/presentation/ChartStudioPanel";

export const dynamic = "force-dynamic";

/** The Chart Studio (Phase 34.1): any chart from the project's data, with the editing tools, saved to the project's library. The Visual Studio hosts the same panel. */
export default async function ChartStudioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ChartStudioPanel projectId={id} />;
}

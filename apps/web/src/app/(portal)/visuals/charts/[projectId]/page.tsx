import { ShellTabs } from "@/features/visual-studio/presentation/ShellTabs";
import { ChartStudioPanel } from "@/features/visual-studio/presentation/ChartStudioPanel";

export const dynamic = "force-dynamic";

/** The Chart Studio inside the Visual Studio: the same panel the project page draws, under the Studio's tabs. */
export default async function VisualChartStudioPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return (
    <div className="animate-fade-in space-y-4">
      <h1 className="text-xl font-semibold tracking-tight">Visual Studio</h1>
      <ShellTabs active="charts" />
      <ChartStudioPanel projectId={projectId} />
    </div>
  );
}

import { ShellTabs } from "@/features/visual-studio/presentation/ShellTabs";
import { MapStudioPanel } from "@/features/visual-studio/presentation/MapStudioPanel";

export const dynamic = "force-dynamic";

/** The map explorer inside the Visual Studio: the same panel the project page draws, under the Studio's tabs. */
export default async function VisualMapStudioPage({ params, searchParams }: { params: Promise<{ projectId: string }>; searchParams: Promise<{ indicator?: string }> }) {
  const { projectId } = await params;
  const { indicator } = await searchParams;
  return (
    <div className="page-stack animate-fade-in">
      <h1 className="page-title">Visual Studio</h1>
      <ShellTabs active="maps" />
      <MapStudioPanel indicatorId={indicator} projectId={projectId} studioHref={`/visuals/charts/${projectId}`} />
    </div>
  );
}

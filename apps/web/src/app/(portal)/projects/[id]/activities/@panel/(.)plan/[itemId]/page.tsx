import PlannedActivityPage from "../../../plan/[itemId]/page";
import { PanelFrame } from "@/features/workplan/presentation/PanelFrame";

export const dynamic = "force-dynamic";

/** The same details page as the full-page route, shown in the slide-in panel. */
export default function PlannedActivityPanel(props: { params: Promise<{ id: string; itemId: string }> }) {
  return (
    <PanelFrame>
      <PlannedActivityPage {...props} />
    </PanelFrame>
  );
}

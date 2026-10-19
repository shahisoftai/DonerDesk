import type { ReactNode } from "react";

/**
 * The activities pages, plus a `panel` slot: opening a planned activity from this section shows its details in a panel that
 * slides in from the right, over the list or timeline. Opening the same address directly, or from elsewhere, shows the full page.
 */
export default function ActivitiesLayout({ children, panel }: { children: ReactNode; panel: ReactNode }) {
  return (
    <>
      {children}
      {panel}
    </>
  );
}

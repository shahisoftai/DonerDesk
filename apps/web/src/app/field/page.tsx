import type { Metadata } from "next";
import { FieldApp } from "@/features/offline/presentation/FieldApp";

export const metadata: Metadata = {
  title: "DonorDesk Field",
  robots: { index: false, follow: false },
  // Its own manifest: an icon added from this page is "DonorDesk Field" and always opens the field app.
  manifest: "/manifest-field.webmanifest",
  appleWebApp: { capable: true, title: "DonorDesk Field", statusBarStyle: "default" },
};

/**
 * The field app's page. It renders no signed-in data on the server: everything it shows comes from this phone's own storage, so
 * the page can be kept by the service worker and opened with no connection.
 */
export default function FieldPage() {
  return <FieldApp />;
}

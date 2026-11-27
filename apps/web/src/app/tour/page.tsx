import type { Metadata } from "next";
import { PublicTour } from "@/features/tour/presentation/PublicTour";
import { SiteShell } from "@/components/site/SiteShell";
import { SiteFooter } from "@/components/site/SiteFooter";

export const metadata: Metadata = {
  alternates: { canonical: "/tour" },
  title: "Product Tour",
  description: "Tour DonorDesk in six steps, or by role: plan from your documents, collect offline in the field, track results by place, build dashboards, prove every figure and report to donors. No signup required.",
};

export default function TourPage() {
  return (
    <SiteShell footer={<SiteFooter />}>
      <PublicTour />
    </SiteShell>
  );
}

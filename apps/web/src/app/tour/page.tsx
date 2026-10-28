import type { Metadata } from "next";
import { PublicTour } from "@/features/tour/presentation/PublicTour";

export const metadata: Metadata = {
  alternates: { canonical: "/tour" },
  title: "Product Tour",
  description: "See how DonorDesk manages a project from logframe and work plan to field data, evidence and donor-ready reports. No signup required.",
};

export default function TourPage() {
  return <PublicTour />;
}

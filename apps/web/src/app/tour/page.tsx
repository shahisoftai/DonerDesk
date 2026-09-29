import type { Metadata } from "next";
import { PublicTour } from "@/features/tour/presentation/PublicTour";

export const metadata: Metadata = {
  title: "Product Tour — DonorDesk",
  description: "See how DonorDesk turns project data and evidence into donor-ready reports. No signup required.",
};

export default function TourPage() {
  return <PublicTour />;
}

import type { MetadataRoute } from "next";

/**
 * Lets DonorDesk be added to a phone's home screen and opened full screen like an app. Field staff record activities and
 * photos from a phone; the offline outbox keeps what they finish without a connection until it can be sent.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "DonorDesk",
    short_name: "DonorDesk",
    description: "Donor reporting, evidence and compliance for NGOs.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}

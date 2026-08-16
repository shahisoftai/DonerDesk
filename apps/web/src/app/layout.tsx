import "./globals.css";
import type { ReactNode } from "react";
import { ThemeScript } from "@/components/ThemeScript";

export const metadata = {
  metadataBase: new URL("https://donordesk.online"),
  applicationName: "DonorDesk",
  title: {
    default: "DonorDesk — AI-assisted donor reporting for NGOs",
    template: "%s · DonorDesk",
  },
  description:
    "DonorDesk is the AI-assisted donor reporting platform for NGOs. It turns scattered field evidence, activity notes, and logframe data into audit-ready donor reports — with source-linked AI drafting and a live compliance checklist.",
  openGraph: {
    title: "DonorDesk — Donor reporting for NGOs",
    description:
      "From scattered field evidence to donor-ready reports, with source-linked AI and a live compliance checklist.",
    url: "https://donordesk.online",
    siteName: "DonorDesk",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "DonorDesk — Donor reporting for NGOs",
    description:
      "From scattered field evidence to donor-ready reports, with source-linked AI and a live compliance checklist.",
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      name: "DonorDesk",
      url: "https://donordesk.online",
      logo: "https://donordesk.online/brand/donordesk-logo.png",
      description:
        "AI-assisted donor reporting platform for NGOs, humanitarian programmes, and compliance teams.",
    },
    {
      "@type": "WebApplication",
      name: "DonorDesk",
      url: "https://donordesk.online",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      description:
        "DonorDesk is the AI-assisted donor reporting platform for NGOs. It turns messy field evidence, activity notes, and logframe data into audit-ready donor reports with source-linked AI drafting, a live compliance checklist, and donor-ready exports.",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      publisher: { "@type": "Organization", name: "DonorDesk" },
    },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        <ThemeScript />
        {children}
      </body>
    </html>
  );
}

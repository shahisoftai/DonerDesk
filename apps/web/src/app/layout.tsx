import "./globals.css";
import type { ReactNode } from "react";
import { ThemeScript } from "@/components/ThemeScript";

export const metadata = {
  metadataBase: new URL("https://donordesk.online"),
  applicationName: "DonorDesk",
  title: {
    default: "DonorDesk — AI-assisted grant and donor reporting",
    template: "%s · DonorDesk",
  },
  description:
    "Turn programme data, field evidence, and indicator results into professional, source-linked reports for donors, grantmakers, and funding authorities.",
  openGraph: {
    title: "DonorDesk — AI-assisted grant and donor reporting",
    description:
      "Turn programme data, field evidence, and indicator results into professional, source-linked reports.",
    url: "https://donordesk.online",
    siteName: "DonorDesk",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "DonorDesk — AI-assisted grant and donor reporting",
    description:
      "Turn programme data, field evidence, and indicator results into professional, source-linked reports.",
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
        "AI-assisted grant and donor reporting for humanitarian, development, and other evidence-heavy funded programmes.",
    },
    {
      "@type": "WebApplication",
      name: "DonorDesk",
      url: "https://donordesk.online",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      description:
        "DonorDesk turns programme data, activity records, indicator results, and supporting evidence into source-linked reports with compliance checks and human approval.",
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

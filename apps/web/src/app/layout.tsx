import "./globals.css";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { GeistSans } from "geist/font/sans";
import { ThemeScript } from "@/components/ThemeScript";

const DESCRIPTION =
  "Turn programme data, field evidence, and indicator results into professional, source-linked reports for donors, grantmakers, and funding authorities.";

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#020617" },
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL("https://donordesk.online"),
  applicationName: "DonorDesk",
  title: {
    default: "DonorDesk — AI-assisted grant and donor reporting",
    template: "%s · DonorDesk",
  },
  description: DESCRIPTION,
  keywords: [
    "donor reporting software",
    "grant reporting",
    "NGO reporting tool",
    "logframe software",
    "indicator tracking",
    "humanitarian reporting",
    "donor compliance checklist",
    "AI report writing for NGOs",
  ],
  alternates: { canonical: "/" },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 },
  },
  openGraph: {
    title: "DonorDesk — AI-assisted grant and donor reporting",
    description:
      "Turn programme data, field evidence, and indicator results into professional, source-linked reports.",
    url: "/",
    siteName: "DonorDesk",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
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
      "@id": "https://donordesk.online/#organization",
      name: "DonorDesk",
      url: "https://donordesk.online",
      logo: {
        "@type": "ImageObject",
        url: "https://donordesk.online/brand/donordesk-logo.png",
        width: 552,
        height: 600,
      },
      description:
        "AI-assisted grant and donor reporting for humanitarian, development, and other evidence-heavy funded programmes.",
    },
    {
      "@type": "WebSite",
      "@id": "https://donordesk.online/#website",
      url: "https://donordesk.online",
      name: "DonorDesk",
      inLanguage: "en",
      publisher: { "@id": "https://donordesk.online/#organization" },
    },
    {
      "@type": "WebApplication",
      "@id": "https://donordesk.online/#app",
      name: "DonorDesk",
      url: "https://donordesk.online",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      description:
        "DonorDesk turns programme data, activity records, indicator results, and supporting evidence into source-linked reports with compliance checks and human approval.",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      publisher: { "@id": "https://donordesk.online/#organization" },
    },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={GeistSans.variable}>
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

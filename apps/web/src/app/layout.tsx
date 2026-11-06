import "./globals.css";
import { I18nProvider } from "@/features/i18n/presentation/I18nProvider";
import { ServiceWorkerRegistrar } from "@/features/offline/presentation/ServiceWorkerRegistrar";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { GeistSans } from "geist/font/sans";
import { ThemeScript } from "@/components/ThemeScript";

const DESCRIPTION =
  "Manage your projects and programmes in one place: logframe, work plan, field data collection, indicators, maps, dashboards, evidence and compliance. Donor reports are drafted from that record, checked against it and approved by a person.";

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0b1614" },
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL("https://donordesk.online"),
  applicationName: "DonorDesk",
  title: {
    default: "DonorDesk — project and programme management",
    template: "%s · DonorDesk",
  },
  description: DESCRIPTION,
  keywords: [
    "project management software for NGOs",
    "grant programme management software",
    "field data collection",
    "work plan and timeline",
    "NGO programme management",
    "logframe software",
    "indicator tracking",
    "donor compliance checklist",
    "grant reporting",
    "donor reporting software",
    "AI report drafting for NGOs",
  ],
  alternates: { canonical: "/" },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 },
  },
  openGraph: {
    title: "DonorDesk — project and programme management",
    description:
      "Plan, deliver, measure and report grant-funded programmes from one record, with source-linked donor reports.",
    url: "/",
    siteName: "DonorDesk",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "DonorDesk — project and programme management",
    description:
      "Plan, deliver, measure and report grant-funded programmes from one record, with source-linked donor reports.",
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
        "Project and programme management, with source-linked donor reporting, for humanitarian, development, and other evidence-heavy funded programmes.",
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
        "DonorDesk manages grant-funded projects and programmes: logframe, work plan, field data collection, indicators, maps, dashboards and evidence, with source-linked reports, compliance checks and human approval.",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      publisher: { "@id": "https://donordesk.online/#organization" },
    },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={GeistSans.variable}>
      <body>
        <ServiceWorkerRegistrar />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        <ThemeScript />
        <I18nProvider initialLocale="en">{children}</I18nProvider>
      </body>
    </html>
  );
}

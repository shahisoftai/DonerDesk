import "./globals.css";
import type { ReactNode } from "react";
import { ThemeScript } from "@/components/ThemeScript";

export const metadata = {
  metadataBase: new URL("https://DonerDesk.online"),
  title: {
    default: "DonorDesk — AI-assisted donor reporting for NGOs",
    template: "%s · DonorDesk",
  },
  description:
    "DonorDesk turns scattered field evidence, activity notes, and logframe data into audit-ready donor reports — with source-linked AI drafting and a live compliance checklist.",
  openGraph: {
    title: "DonorDesk — Donor reporting for NGOs",
    description:
      "From scattered field evidence to donor-ready reports, with source-linked AI and a live compliance checklist.",
    url: "https://DonerDesk.online",
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

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeScript />
        {children}
      </body>
    </html>
  );
}

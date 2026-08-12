import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "DonorDesk — Donor reporting for NGOs",
  description: "AI-assisted donor reporting and evidence management.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

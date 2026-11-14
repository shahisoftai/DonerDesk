import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";

/** Self-hosted by Next at build time: no request to a font host when a visitor opens the site. */
/** Version 4.000: one family for the site and the app (IBM Plex Sans), Plex Mono for figures and labels. */
const display = IBM_Plex_Sans({ subsets: ["latin", "latin-ext"], weight: ["500", "600", "700"], variable: "--sx-font-display", display: "swap" });
const body = IBM_Plex_Sans({ subsets: ["latin", "latin-ext"], weight: ["400", "500", "600"], variable: "--sx-font-body", display: "swap" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--sx-font-mono", display: "swap" });

export const SITE_FONT_CLASSES = `${display.variable} ${body.variable} ${mono.variable}`;

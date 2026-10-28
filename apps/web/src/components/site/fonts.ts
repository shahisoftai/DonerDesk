import { Bricolage_Grotesque, IBM_Plex_Mono, Public_Sans } from "next/font/google";

/** Self-hosted by Next at build time: no request to a font host when a visitor opens the site. */
const display = Bricolage_Grotesque({ subsets: ["latin"], weight: ["500", "700", "800"], variable: "--sx-font-display", display: "swap" });
const body = Public_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--sx-font-body", display: "swap" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--sx-font-mono", display: "swap" });

export const SITE_FONT_CLASSES = `${display.variable} ${body.variable} ${mono.variable}`;

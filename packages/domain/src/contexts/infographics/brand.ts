/**
 * The organization brand kit (Phase 32.3): the colours, logos and standard lines an organization
 * uses on everything it publishes. A kit is stored once per organization; a design opts in with
 * `themeId: "BRAND"` (and `branding: true` for the footer and funder lines). The theme is derived,
 * not stored: the primary colour is darkened until text in it passes the contrast check, so a
 * brand colour that is too light for body text still yields a readable page.
 */
import { DomainError } from "../../core/domain-error.js";
import type { Result } from "../../core/result.js";
import { contrastRatio, INFOGRAPHIC_THEMES, type InfographicTheme } from "./theme.js";

export interface OrganizationBrandKit {
  /** `#rrggbb`. */
  primaryColor: string;
  secondaryColor?: string;
  /** The organization's own logo (an uploaded asset). */
  logoAssetId?: string;
  /** A funder or partner library, up to six logos the Studio offers when a design names its funders. */
  partnerLogoAssetIds?: string[];
  /** One line under every page (address, website, contact). */
  footerLine?: string;
  /** Standard funder acknowledgement, offered as the default for new designs. */
  acknowledgement?: string;
}

const HEX = /^#[0-9a-f]{6}$/i;

export function validateBrandKit(input: OrganizationBrandKit): Result<OrganizationBrandKit, DomainError> {
  if (!HEX.test(input.primaryColor ?? "")) return { ok: false, error: DomainError.validation("Choose the main colour as a six-digit hex value, such as #0b66b3") };
  if (input.secondaryColor && !HEX.test(input.secondaryColor)) return { ok: false, error: DomainError.validation("Choose the second colour as a six-digit hex value") };
  if ((input.partnerLogoAssetIds?.length ?? 0) > 6) return { ok: false, error: DomainError.validation("Keep at most 6 partner logos") };
  if ((input.footerLine?.length ?? 0) > 160) return { ok: false, error: DomainError.validation("Keep the footer line under 160 characters") };
  if ((input.acknowledgement?.length ?? 0) > 200) return { ok: false, error: DomainError.validation("Keep the acknowledgement under 200 characters") };
  return {
    ok: true,
    value: {
      primaryColor: input.primaryColor.toLowerCase(),
      ...(input.secondaryColor ? { secondaryColor: input.secondaryColor.toLowerCase() } : {}),
      ...(input.logoAssetId ? { logoAssetId: input.logoAssetId } : {}),
      ...(input.partnerLogoAssetIds?.length ? { partnerLogoAssetIds: [...input.partnerLogoAssetIds] } : {}),
      ...(input.footerLine?.trim() ? { footerLine: input.footerLine.trim() } : {}),
      ...(input.acknowledgement?.trim() ? { acknowledgement: input.acknowledgement.trim() } : {}),
    },
  };
}

const rgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const toHex = (c: readonly [number, number, number]): string => `#${c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")}`;
const mix = (a: string, b: string, weightOfB: number): string => {
  const [ar, ag, ab] = rgb(a);
  const [br, bg, bb] = rgb(b);
  return toHex([ar + (br - ar) * weightOfB, ag + (bg - ag) * weightOfB, ab + (bb - ab) * weightOfB]);
};

/** The colour darkened (mixed with black) until it reads on `background` at 4.5:1. */
export function readableOn(color: string, background: string): string {
  let current = color.toLowerCase();
  for (let i = 0; i < 20 && contrastRatio(current, background) < 4.5; i += 1) current = mix(current, "#000000", 0.08);
  return current;
}

/** The brand theme: Humanitarian blue's structure with the organization's colours. */
export function themeFromBrand(brand: OrganizationBrandKit, base: InfographicTheme = INFOGRAPHIC_THEMES.HUMANITARIAN_BLUE): InfographicTheme {
  const accent = readableOn(brand.primaryColor, base.card);
  const accent2 = readableOn(brand.secondaryColor ?? base.accent2, base.card);
  return {
    ...base,
    id: "BRAND",
    label: "Organization brand",
    description: "Your organization's colours on a clean, readable page.",
    accent,
    accentSoft: mix(accent, "#ffffff", 0.9),
    accent2,
    palette: [accent, accent2, ...base.palette.slice(2)],
    signals: { ...base.signals, DONE: accent },
  };
}

import { Entity } from "../../core/entity.js";
import { DomainError } from "../../core/domain-error.js";

export interface BrandingConfig {
  logoUrl?: string;
  faviconUrl?: string;
  brandColorPrimary: string;
  brandColorSecondary: string;
  brandColorAccent: string;
  fontFamilyHeading?: string;
  fontFamilyBody?: string;
  emailSenderName?: string;
  emailSenderAddress?: string;
  customDomain?: string;
  customDomainVerified: boolean;
  privacyPolicyUrl?: string;
  termsOfServiceUrl?: string;
}

export interface WhiteLabelConfig {
  enabled: boolean;
  subdomain?: string;
  branding: BrandingConfig;
  dmarCStatus?: "pending" | "valid" | "invalid" | "none";
  dkimStatus?: "pending" | "valid" | "invalid" | "none";
  spfStatus?: "pending" | "valid" | "invalid" | "none";
  customSSLCert?: boolean;
}

export class OrganizationBranding extends Entity<string> {
  private constructor(
    id: string,
    readonly tenantIdValue: string,
    private props: WhiteLabelConfig & { organizationId: string },
    createdAt?: Date,
  ) {
    super(id, createdAt);
  }

  static create(input: {
    id: string;
    tenantId: string;
    organizationId: string;
    subdomain?: string;
    brandColorPrimary?: string;
    brandColorSecondary?: string;
    brandColorAccent?: string;
  }): OrganizationBranding {
    if (!input.id.trim() || !input.tenantId.trim() || !input.organizationId.trim()) {
      throw DomainError.validation("Branding identifiers are required");
    }
    const DEFAULT_COLORS = {
      primary: "#2563EB",
      secondary: "#1E40AF",
      accent: "#F59E0B",
    };

    for (const color of [input.brandColorPrimary, input.brandColorSecondary, input.brandColorAccent]) {
      if (color !== undefined && !WhiteLabelThemingEngine.isValidBrandColor(color)) {
        throw DomainError.validation("Brand colors must use hexadecimal notation");
      }
    }
    if (input.subdomain !== undefined && !isValidHostname(input.subdomain)) {
      throw DomainError.validation("Invalid branding subdomain");
    }
    return new OrganizationBranding(
      input.id,
      input.tenantId,
      {
        enabled: true,
        organizationId: input.organizationId,
        subdomain: input.subdomain,
        branding: {
          brandColorPrimary: input.brandColorPrimary ?? DEFAULT_COLORS.primary,
          brandColorSecondary: input.brandColorSecondary ?? DEFAULT_COLORS.secondary,
          brandColorAccent: input.brandColorAccent ?? DEFAULT_COLORS.accent,
          customDomainVerified: false,
        },
      },
    );
  }

  static rehydrate(input: {
    id: string;
    tenantId: string;
    props: WhiteLabelConfig & { organizationId: string };
    createdAt: Date;
  }): OrganizationBranding {
    return new OrganizationBranding(input.id, input.tenantId, input.props, input.createdAt);
  }

  get organizationId(): string { return this.props.organizationId; }
  get enabled(): boolean { return this.props.enabled; }
  get subdomain(): string | undefined { return this.props.subdomain; }
  get branding(): BrandingConfig { return { ...this.props.branding }; }
  get whiteLabelConfig(): WhiteLabelConfig { return { ...this.props, branding: { ...this.props.branding } }; }
  get customDomain(): string | undefined { return this.props.branding.customDomain; }
  get dmarCStatus() { return this.props.dmarCStatus ?? "none"; }
  get dkimStatus() { return this.props.dkimStatus ?? "pending"; }
  get spfStatus() { return this.props.spfStatus ?? "pending"; }

  setBranding(branding: Partial<BrandingConfig>): void {
    for (const color of [branding.brandColorPrimary, branding.brandColorSecondary, branding.brandColorAccent]) {
      if (color !== undefined && !WhiteLabelThemingEngine.isValidBrandColor(color)) {
        throw DomainError.validation("Brand colors must use hexadecimal notation");
      }
    }
    for (const url of [branding.logoUrl, branding.faviconUrl, branding.privacyPolicyUrl, branding.termsOfServiceUrl]) {
      if (url !== undefined && !isSafeHttpsUrl(url)) {
        throw DomainError.validation("Branding URLs must be public HTTPS URLs");
      }
    }
    for (const font of [branding.fontFamilyHeading, branding.fontFamilyBody]) {
      if (font !== undefined && !/^[a-zA-Z0-9 ,'-]{1,100}$/.test(font)) {
        throw DomainError.validation("Invalid font family");
      }
    }
    this.props.branding = {
      ...this.props.branding,
      ...branding,
    };
    this.touch();
  }

  setCustomDomain(domain: string): void {
    const normalized = domain.trim().toLowerCase();
    if (!isValidHostname(normalized)) {
      throw DomainError.validation("Invalid custom domain format");
    }
    this.props.branding.customDomain = normalized;
    this.props.branding.customDomainVerified = false;
    this.touch();
  }

  verifyCustomDomain(verifiedDomain: string): void {
    if (!this.props.branding.customDomain) {
      throw DomainError.validation("No custom domain configured");
    }
    if (verifiedDomain.trim().toLowerCase() !== this.props.branding.customDomain) {
      throw DomainError.validation("Domain verification result does not match configured domain");
    }
    this.props.branding.customDomainVerified = true;
    this.touch();
  }

  setEmailSender(name: string, address: string): void {
    const normalizedName = name.trim();
    const normalizedAddress = address.trim().toLowerCase();
    if (!normalizedName || /[\r\n]/.test(normalizedName) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedAddress)) {
      throw DomainError.validation("Invalid email address");
    }
    this.props.branding.emailSenderName = normalizedName;
    this.props.branding.emailSenderAddress = normalizedAddress;
    this.touch();
  }

  updateDmarCStatus(status: WhiteLabelConfig["dmarCStatus"]): void {
    this.props.dmarCStatus = status;
    this.touch();
  }

  updateDkimStatus(status: WhiteLabelConfig["dkimStatus"]): void {
    this.props.dkimStatus = status;
    this.touch();
  }

  updateSpfStatus(status: WhiteLabelConfig["spfStatus"]): void {
    this.props.spfStatus = status;
    this.touch();
  }

  disable(): void {
    this.props.enabled = false;
    this.touch();
  }

  enable(): void {
    this.props.enabled = true;
    this.touch();
  }

  generateCSSVariables(): string {
    const b = this.props.branding;
    return `
      :root {
        --brand-color-primary: ${b.brandColorPrimary};
        --brand-color-secondary: ${b.brandColorSecondary};
        --brand-color-accent: ${b.brandColorAccent};
        --brand-font-heading: ${b.fontFamilyHeading ?? "system-ui, sans-serif"};
        --brand-font-body: ${b.fontFamilyBody ?? "system-ui, sans-serif"};
        --brand-logo-url: ${b.logoUrl ? `url('${b.logoUrl}')` : "none"};
        --brand-favicon-url: ${b.faviconUrl ? `url('${b.faviconUrl}')` : "none"};
      }
    `;
  }

  generateEmailHeaders(): Record<string, string> {
    const b = this.props.branding;
    const headers: Record<string, string> = {
      "X-Branding-Primary": b.brandColorPrimary,
      "X-Organization-ID": this.props.organizationId,
    };

    if (b.emailSenderName && b.emailSenderAddress) {
      headers["From"] = `${b.emailSenderName} <${b.emailSenderAddress}>`;
      headers["Reply-To"] = b.emailSenderAddress;
    }

    if (b.customDomain && b.customDomainVerified) {
      headers["X-Mailer"] = `DonorDesk (${b.customDomain})`;
    }

    return headers;
  }
}

function isValidHostname(value: string): boolean {
  return value.length <= 253
    && value.includes(".")
    && value.split(".").every((label) => /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/.test(label));
}

function isSafeHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && isValidHostname(url.hostname);
  } catch {
    return false;
  }
}

export interface ThemingContext {
  organizationId: string;
  subdomain?: string;
  customDomain?: string;
  branding: BrandingConfig;
  cssVariables: string;
}

export class WhiteLabelThemingEngine {
  static buildThemingContext(branding: OrganizationBranding): ThemingContext {
    return {
      organizationId: branding.organizationId,
      subdomain: branding.subdomain,
      customDomain: branding.customDomain,
      branding: branding.branding,
      cssVariables: branding.generateCSSVariables(),
    };
  }

  static buildSubdomain(organizationSlug: string, environment: "prod" | "staging" = "prod"): string | undefined {
    if (environment === "prod") {
      return `${organizationSlug}.donordesk.com`;
    }
    return `${organizationSlug}.donordesk-staging.com`;
  }

  static isValidBrandColor(color: string): boolean {
    return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
  }
}

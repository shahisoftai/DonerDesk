import type { ReactNode } from "react";
import { NOINDEX_METADATA } from "@/lib/seo";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { navFor } from "@/features/navigation/domain/role-navigation";
import { translateNav } from "@/features/i18n/domain/nav-keys";
import { I18nProvider } from "@/features/i18n/presentation/I18nProvider";
import { getLocale, getTranslator } from "@/lib/server/locale";
import { requireSession, hasCapability } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { shortMemo } from "@/lib/server/short-memo";
import { OrganizationSchema, NotificationsResponseSchema, LegalConsentSchema, MfaStatusSchema } from "@/lib/server/schemas";
import { decodeSessionPayload } from "@/lib/shared/jwt-session";
import { AppShell } from "@/components/layout/AppShell";
import { ToastProvider } from "@/components/feedback/Toast";
import { TourOverlay } from "@/features/tour/presentation/TourOverlay";
import { OutboxProvider } from "@/features/offline/presentation/OutboxProvider";
import { OutboxBanner } from "@/features/offline/presentation/OutboxBanner";

export const dynamic = "force-dynamic";
export const metadata = NOINDEX_METADATA;

export default async function PortalLayout({ children }: { children: ReactNode }) {
  const ctx = await requireSession();

  const [orgResult, notificationsResult, consentResult, mfaResult] = await Promise.all([
    shortMemo(`org:${ctx.token}`, 60_000, () => gatewayRequest("/v1/organization", OrganizationSchema, ctx.token), (r) => r.ok),
    gatewayRequest("/v1/notifications", NotificationsResponseSchema, ctx.token),
    // Accepting the terms is permanent, so only an accepted answer is remembered; a pending one is asked again every time.
    shortMemo(`consent:${ctx.token}`, 300_000, () => gatewayRequest("/v1/legal/consent", LegalConsentSchema, ctx.token), (r) => r.ok && r.value.accepted),
    gatewayRequest("/v1/auth/mfa", MfaStatusSchema, ctx.token),
  ]);

  // An organization that requires two-step sign-in lets a person without it do one thing: set it up.
  if (mfaResult.ok && mfaResult.value.requirement === "SETUP_REQUIRED") {
    const pathname = (await headers()).get("x-pathname") ?? "";
    if (!pathname.startsWith("/settings/security") && !pathname.startsWith("/logout")) redirect("/settings/security");
  }

  // Terms-of-Reference consent gate: until the user accepts the Terms of
  // Service and Privacy Policy during onboarding, only the onboarding flow
  // and logout are reachable.
  if (consentResult.ok && !consentResult.value.accepted) {
    const header = await headers();
    const pathname = header.get("x-pathname") ?? "";
    const allowed = pathname.startsWith("/onboarding") || pathname.startsWith("/logout");
    if (!allowed) {
      redirect("/onboarding");
    }
  }

  const orgName = orgResult.ok ? (orgResult.value.name ?? "") : "";
  const identity = decodeSessionPayload(ctx.token);
  const user = { name: identity?.name ?? "", email: identity?.email ?? "" };
  const bellItems = (notificationsResult.ok ? notificationsResult.value.items : []).map((n) => ({
    id: n.id,
    title: n.title ?? "",
    read: n.read ?? false,
  }));

  // Which entries appear is one table per role (role-navigation.ts); an outside partner sees only their projects.
  const [locale, translator] = [await getLocale(), await getTranslator()];
  const navItems = translateNav(navFor({ role: ctx.role, capabilities: ctx.capabilities, external: ctx.external }), translator.t);

  return (
    <I18nProvider initialLocale={locale}>
    <ToastProvider>
      <OutboxProvider scope={identity?.sub ?? user.email ?? "user"}>
      <AppShell
        orgName={orgName}
        user={user}
        navItems={navItems}
        canCreate={hasCapability(ctx, "project.create")}
        bellItems={bellItems}
      >
        {mfaResult.ok && mfaResult.value.requirement === "REQUIRED_SOON" && mfaResult.value.requiredFrom && (
          <p role="status" className="mb-4 rounded-lg bg-amber-50 p-3 text-sm dark:bg-amber-500/10">
            Your organization will require two-step sign-in from {new Date(mfaResult.value.requiredFrom).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}. <a className="font-medium underline" href="/settings/security">Set it up now</a>.
          </p>
        )}
        {children}
      </AppShell>
      <TourOverlay />
      <OutboxBanner />
      </OutboxProvider>
    </ToastProvider>
    </I18nProvider>
  );
}

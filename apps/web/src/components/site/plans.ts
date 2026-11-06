import { ENTERPRISE_PRICE_FLOOR_ANNUAL_USD, PLAN_CATALOG } from "@donordesk/domain";

/** The plan cards on the home page, built from the one commercial catalogue so the home page cannot drift from what is enforced. Server use only (it imports the domain root). */
export interface HomePlan { name: string; price: string; per: string; tagline: string; points: string[]; cta: string; href: string; primary: boolean }

const usd = (n: number) => `$${n.toLocaleString("en-US")}`;
const ngo = (n: number) => `$${(n * 0.75).toFixed(2)}`;
const drafts = (n: number | null) => (n === null ? "AI report drafts by contract" : `${n} successful AI report drafts / month`);
const projects = (n: number | null) => (n === null ? "Unlimited active projects" : `${n} active project${n === 1 ? "" : "s"}`);

export function homePlans(): HomePlan[] {
  const { STARTER: s, TEAM: t, GROWTH: g } = PLAN_CATALOG;
  return [
    { name: "Starter", price: usd(s.monthlyPriceUsd ?? 0), per: "forever", tagline: "For a first funded programme.", points: [projects(s.maxActiveProjects), `${s.maxSeats} seat and ${s.viewerSeats} viewers`, drafts(s.monthlyAiDraftCredits), "Evidence vault and audit trail"], cta: "Start free", href: "/signup", primary: false },
    { name: "Team", price: usd(t.monthlyPriceUsd!), per: "/ month", tagline: "For several grants, one team.", points: [projects(t.maxActiveProjects), `${t.maxSeats} seats, unlimited viewers`, drafts(t.monthlyAiDraftCredits), `NGO price ${ngo(t.monthlyPriceUsd!)} a month (verified 25% welcome discount, first year)`], cta: "Start with Team", href: "/signup?plan=team", primary: true },
    { name: "Growth", price: usd(g.monthlyPriceUsd!), per: "/ month", tagline: "For several donors and heavy reporting.", points: [projects(g.maxActiveProjects), `${g.maxSeats} seats, unlimited viewers`, drafts(g.monthlyAiDraftCredits), "Bring your own AI provider", `NGO price ${ngo(g.monthlyPriceUsd!)} a month (verified 25% welcome discount, first year)`], cta: "Start with Growth", href: "/signup?plan=growth", primary: false },
    { name: "Enterprise", price: "Custom", per: `from ${usd(ENTERPRISE_PRICE_FLOOR_ANNUAL_USD)} a year`, tagline: "For consortia and multi-country programmes.", points: ["Unlimited projects and seats", "SSO and SCIM, data residency", "SLA and dedicated support"], cta: "Talk to us", href: "/contact-sales", primary: false },
  ];
}

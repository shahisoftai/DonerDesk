import type { Metadata } from "next";
import SignupForm from "./SignupForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Create your DonorDesk account",
  description: "Start using DonorDesk to turn programme data and evidence into donor-ready reports.",
  alternates: { canonical: "/signup" },
};

/** Validated plans a visitor may request at signup (Starter/Team/Growth). */
const VALID_PLANS = ["starter", "team", "growth"] as const;
type RequestedPlan = (typeof VALID_PLANS)[number];

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const params = await searchParams;
  const rawPlan = typeof params?.plan === "string" ? params.plan.toLowerCase() : "starter";
  const plan: RequestedPlan = (VALID_PLANS as readonly string[]).includes(rawPlan)
    ? (rawPlan as RequestedPlan)
    : "starter";
  return <SignupForm initialPlan={plan} />;
}

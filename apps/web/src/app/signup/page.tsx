import SignupForm from "./SignupForm";

export const dynamic = "force-dynamic";

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

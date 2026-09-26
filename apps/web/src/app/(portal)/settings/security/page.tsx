import { requireSession } from "@/lib/server/auth-context";
import { SecurityPanel } from "@/features/settings/presentation/SecurityPanel";

export const dynamic = "force-dynamic";

export default async function SecurityPage() {
  await requireSession();
  return (
    <div className="animate-fade-in">
      <h1 className="text-xl font-semibold tracking-tight">Security</h1>
      <SecurityPanel />
    </div>
  );
}

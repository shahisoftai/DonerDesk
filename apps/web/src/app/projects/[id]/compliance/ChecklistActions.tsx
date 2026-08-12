"use client";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { getSessionToken } from "@/lib/session-client";

export function ChecklistActions({ itemId, periodId, projectId }: { itemId: string; periodId: string; projectId: string }) {
  const router = useRouter();
  async function decide(decision: "RESOLVE" | "ACCEPT_RISK" | "NOT_APPLICABLE" | "START") {
    const token = getSessionToken();
    if (!token) return router.push("/login");
    await api(`/v1/checklist/${itemId}/resolve`, { method: "POST", token, body: JSON.stringify({ decision }) });
    router.refresh();
  }
  return (
    <div className="flex gap-2">
      <button className="btn-secondary text-xs" onClick={() => decide("START")}>Start</button>
      <button className="btn text-xs" onClick={() => decide("RESOLVE")}>Resolve</button>
      <button className="btn-secondary text-xs" onClick={() => decide("ACCEPT_RISK")}>Accept risk</button>
      <button className="btn-secondary text-xs" onClick={() => decide("NOT_APPLICABLE")}>N/A</button>
    </div>
  );
}

import { createRoot } from "react-dom/client";
import type { ProjectFinance } from "@/lib/server/schemas-finance";
import { FinanceSummary } from "@/features/finance/presentation/FinanceSummary";
import { BudgetSection } from "@/features/finance/presentation/BudgetSection";
import { FundingSection } from "@/features/finance/presentation/FundingSection";
import { RegisterSection } from "@/features/finance/presentation/RegisterSection";
import { ImportSection } from "@/features/finance/presentation/ImportSection";
import { AdvancesSection } from "@/features/finance/presentation/AdvancesSection";
import { DeliverablesSection } from "@/features/finance/presentation/DeliverablesSection";

const usd = (minor: number) => ({ minor, currency: "USD" });
const eur = (minor: number) => ({ minor, currency: "EUR" });
const f: ProjectFinance = {
  primaryCurrency: "USD",
  funding: [
    { id: "f1", sourceId: "s1", sourceName: "Donor A", ownFunding: true, date: "2026-01-05", amount: usd(1000000), note: "" },
    { id: "f2", sourceId: "s1", sourceName: "Donor A", ownFunding: true, date: "2026-01-06", amount: eur(50000), note: "top-up" },
    { id: "f3", sourceId: "s2", sourceName: "Partner cost-share", ownFunding: false, date: "2026-01-06", amount: usd(9900), note: "" },
  ],
  index: { obligated: [usd(1000000), eur(50000)], disbursed: [usd(300000)], remaining: [usd(700000), eur(50000)], spent: [eur(12000)], otherFunding: [usd(9900)] },
  inPrimary: { obligated: { total: null, needsRate: [{ date: "2026-01-06", amount: eur(50000) }] }, disbursed: { total: usd(300000), needsRate: [] }, spent: { total: null, needsRate: [{ date: "2026-02-01", amount: eur(12000) }] } },
  register: [
    { id: "d1", date: "2026-02-01", kind: "DISBURSEMENT", memo: "Tranche 1", amount: usd(300000), balanceMinor: 300000, ageDays: 28, status: "APPROVED", canDecide: false },
    { id: "e1", date: "2026-02-10", kind: "EXPENSE", memo: "Fuel", amount: eur(12000), balanceMinor: -12000, ageDays: 19, status: "APPROVED", vendor: "Acme", hasEvidence: false, canDecide: false },
    { id: "e2", date: "2026-02-20", kind: "EXPENSE", memo: "Training venue", amount: eur(8000), balanceMinor: -12000, ageDays: 9, status: "DRAFT", vendor: "Hall Ltd", hasEvidence: true, canDecide: true, canEdit: true, enteredByMe: true, evidenceId: "ev1" },
  ],
  totals: { spent: [eur(12000)], disbursed: [usd(300000)], pending: [eur(8000)], rejectedCount: 0, outstandingAdvances: [usd(60000)], unclassifiedExpenses: 1, withoutEvidence: 1 },
  advances: [{ id: "a1", heldBy: "Field team", givenOn: "2026-01-10", amount: usd(100000), note: "", position: { accountedMinor: 40000, outstandingMinor: 60000, overAccounted: false, ageDays: 50, overdue: true } }],
  deliverables: [
    { id: "dl1", name: "Baseline", amount: usd(500000), dueOn: "2026-02-01", state: "OVERDUE" },
    { id: "dl2", name: "Midline", amount: usd(300000), dueOn: "2026-06-01", state: "APPROVED", approvedAt: "2026-02-15T10:00:00Z" },
  ],
  budgetLines: [{ lineId: "L1", code: "1.1", description: "Travel", category: "TRAVEL", budget: eur(10000), spentMinor: 12000, remainingMinor: -2000, spentPercent: 120, overspent: true, otherCurrencySpent: 1 }],
  burn: { spentPercent: 60, timeElapsedPercent: 40, gapPoints: 20 },
  sources: [{ id: "s1", name: "Donor A", ownFunding: true, archived: false }, { id: "s2", name: "Partner cost-share", ownFunding: false, archived: false }],
  evidence: [{ id: "ev1", name: "Venue invoice.pdf" }, { id: "ev2", name: "Receipt.jpg" }],
  separateApprover: false,
};

const params = new URLSearchParams(window.location.search);
const viewer = params.get("role") === "viewer";
(window as unknown as { __h: object }).__h = { calls: [], refreshes: 0 };
createRoot(document.getElementById("root")!).render(
  <div style={{ padding: 16, maxWidth: 1200 }} className="space-y-8">
    <FinanceSummary f={f} />
    <FundingSection projectId="p1" f={f} canEdit={!viewer} today="2026-03-01" />
    <BudgetSection f={f} />
    <RegisterSection projectId="p1" f={viewer ? { ...f, register: f.register.map((r) => ({ ...r, canDecide: false, canEdit: false })) } : f} canEnterExpense={!viewer} canEnterMoney={!viewer} today="2026-03-01" />
    {!viewer && <ImportSection projectId="p1" />}
    <AdvancesSection projectId="p1" f={f} canEdit={!viewer} today="2026-03-01" />
    <DeliverablesSection projectId="p1" f={f} canEdit={!viewer} canApprove={!viewer} today="2026-03-01" />
  </div>,
);

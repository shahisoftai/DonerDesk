import type { RiskItem } from "@/lib/server/schemas";
import type { ProjectPerson } from "../domain/ask-people";

/** What the project decided and why, read-only, from the decisions recorded in "Problems and risks". Shown only when there are any. */
export function DecisionLog({ risks, people }: { risks: RiskItem[]; people: ProjectPerson[] }) {
  const decisions = risks.filter((r) => r.kind === "DECISION");
  if (decisions.length === 0) return null;
  const names = Object.fromEntries(people.map((p) => [p.id, p.label.replace(/ \(you\)$/, "")]));
  return (
    <section className="card" aria-labelledby="decisions-title">
      <h2 id="decisions-title" className="font-medium">What we decided</h2>
      <ul className="mt-3 divide-y divide-slate-200 dark:divide-white/10">
        {decisions.map((d) => (
          <li key={d.id} className="py-2 text-sm">
            <p className="font-medium">{d.title}</p>
            {d.action && <p className="mt-0.5 text-slate-600 dark:text-slate-300">{d.action}</p>}
            <p className="mt-0.5 text-xs text-slate-500">Recorded by {names[d.raisedById] ?? "a team member"}{d.status === "CLOSED" ? " · No longer in force" : ""}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

"use client";

import { useState } from "react";
import type { PendingInvitation } from "@/lib/server/schemas";
import { Badge } from "@/components/data/Badge";
import { Button } from "@/components/ui/Button";
import { ROLE_LABEL } from "@/lib/labels";
import { formatDate } from "@/lib/shared/dates";

/** People invited who have not joined yet, each with the link to send them again. */
export function PendingInvitations({ invitations }: { invitations: PendingInvitation[] }) {
  const [copied, setCopied] = useState<string | null>(null);

  async function copy(invitation: PendingInvitation) {
    const link = `${window.location.origin}${invitation.acceptPath}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(invitation.id);
      setTimeout(() => setCopied((c) => (c === invitation.id ? null : c)), 2000);
    } catch {
      window.prompt("Copy this link and send it to the invitee:", link);
    }
  }

  return (
    <section aria-labelledby="pending-invitations-title" className="space-y-2">
      <h2 id="pending-invitations-title" className="text-sm font-medium text-slate-700 dark:text-slate-200">
        Invited, not joined yet ({invitations.length})
      </h2>
      <div className="table-shell">
        <table className="w-full text-sm">
          <thead className="thead">
            <tr>
              <th className="px-3 py-2 text-left">Email</th>
              <th className="px-3 py-2 text-left">Role</th>
              <th className="px-3 py-2 text-left">Link</th>
              <th className="px-3 py-2 text-right">Share</th>
            </tr>
          </thead>
          <tbody>
            {invitations.map((inv) => (
              <tr key={inv.id} className="trow">
                <td className="px-3 py-2">{inv.email}</td>
                <td className="px-3 py-2">{ROLE_LABEL[inv.role as keyof typeof ROLE_LABEL] ?? inv.role}</td>
                <td className="px-3 py-2">
                  {inv.expired ? <Badge tone="warning">Expired {formatDate(inv.expiresAt)}</Badge> : <Badge tone="info">Valid until {formatDate(inv.expiresAt)}</Badge>}
                </td>
                <td className="px-3 py-2 text-right">
                  <Button size="sm" variant="secondary" disabled={inv.expired} onClick={() => void copy(inv)}>
                    {copied === inv.id ? "Copied" : "Copy link"}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

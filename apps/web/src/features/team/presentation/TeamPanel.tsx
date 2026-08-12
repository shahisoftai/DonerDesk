"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { changeRoleAction, inviteUserAction } from "@/lib/actions/team";
import { useActionState } from "@/lib/client/action-state";
import { can, capabilitiesForRole, type Capability } from "@/lib/shared/capabilities";
import { Badge } from "@/components/data/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Field } from "@/components/ui/Field";
import { FormSummary } from "@/components/ui/FormSummary";
import { ROLE_LABEL, ROLE_OPTIONS, CAPABILITY_LABEL } from "@/lib/labels";
import { filterTeamMembers, type TeamMember } from "@/features/team/application/team-view";

export function TeamPanel({
  members,
  capabilities,
}: {
  members: TeamMember[];
  capabilities: readonly Capability[];
}) {
  const router = useRouter();
  const actionState = useActionState();
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("FIELD_OFFICER");
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [roleChange, setRoleChange] = useState<{ user: TeamMember; target: string } | null>(null);
  const [localErrors, setLocalErrors] = useState<Record<string, string[]>>({});

  const canInvite = can(capabilities, "team.invite");
  const canManage = can(capabilities, "team.manage");

  const filtered = useMemo(() => filterTeamMembers(members, { query, role: roleFilter }), [members, query, roleFilter]);
  const fields = actionState.fields ?? localErrors;
  const errorCount = Object.keys(fields).reduce((sum, k) => sum + (fields[k]?.length ?? 0), 0);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    const next: Record<string, string[]> = {};
    if (!inviteEmail.trim()) next.email = ["Email is required."];
    if (Object.keys(next).length > 0) {
      setLocalErrors(next);
      return;
    }
    setLocalErrors({});
    const result = await actionState.run(() => inviteUserAction({ email: inviteEmail.trim(), role: inviteRole, projectIds: [] }));
    if (result) {
      setInviteToken(result.token);
      setInviteEmail("");
    }
  }

  async function confirmRoleChange() {
    if (!roleChange) return;
    const result = await actionState.run(() => changeRoleAction(roleChange.user.id, roleChange.target));
    if (result !== undefined) {
      setRoleChange(null);
      router.refresh();
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {members.length} team member(s).
        </p>
        {canInvite && (
          <Button size="sm" variant="secondary" onClick={() => setShowInvite((v) => !v)}>
            {showInvite ? "Close invite" : "Invite member"}
          </Button>
        )}
      </div>

      {showInvite && canInvite && (
        <form onSubmit={invite} className="card max-w-lg space-y-3" noValidate>
          <FormSummary errors={fields} count={errorCount} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Email" htmlFor="invite-email" error={fields.email?.[0]}>
              <Input id="invite-email" type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} invalid={Boolean(fields.email)} required />
            </Field>
            <Field label="Role" htmlFor="invite-role" error={fields.role?.[0]}>
              <Select id="invite-role" value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
                {ROLE_OPTIONS.map((r) => (
                  <option key={r} value={r}>{ROLE_LABEL[r as keyof typeof ROLE_LABEL] ?? r}</option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="flex justify-end">
            <Button type="submit" size="sm" pending={actionState.busy}>Send invite</Button>
          </div>

          {inviteToken && (
            <div className="rounded-lg border border-brand-500/30 bg-brand-500/5 p-3">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Invitation created</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Email delivery is not active in this build. Share the invite token with the invitee; the acceptance flow is not wired yet.
              </p>
              <code className="mt-2 block break-all rounded bg-slate-900/5 p-2 text-xs dark:bg-slate-900/60">{inviteToken}</code>
            </div>
          )}
        </form>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1">
          <label className="label" htmlFor="team-search">Search</label>
          <Input id="team-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name or email" />
        </div>
        <div>
          <label className="label" htmlFor="team-role-filter">Role</label>
          <Select id="team-role-filter" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
            <option value="">All roles</option>
            {ROLE_OPTIONS.map((r) => (
              <option key={r} value={r}>{ROLE_LABEL[r as keyof typeof ROLE_LABEL] ?? r}</option>
            ))}
          </Select>
        </div>
      </div>

      <div className="table-shell">
        <table className="w-full text-sm">
          <thead className="thead">
            <tr>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">Email</th>
              <th className="px-3 py-2 text-left">Role</th>
              <th className="px-3 py-2 text-left">Status</th>
              {canManage && <th className="px-3 py-2 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={canManage ? 5 : 4} className="px-3 py-4 text-slate-500 dark:text-slate-400">No team members match.</td></tr>
            )}
            {filtered.map((u) => (
              <tr key={u.id} className="trow">
                <td className="px-3 py-2 font-medium">{u.name}</td>
                <td className="px-3 py-2">{u.email}</td>
                <td className="px-3 py-2">{ROLE_LABEL[u.role as keyof typeof ROLE_LABEL] ?? u.role}</td>
                <td className="px-3 py-2">
                  <Badge tone={u.status === "ACTIVE" ? "success" : u.status === "INVITED" ? "info" : "warning"}>{u.status.replace(/_/g, " ")}</Badge>
                </td>
                {canManage && (
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      className="btn-secondary py-1 text-xs"
                      onClick={() => setRoleChange({ user: u, target: u.role })}
                    >
                      Change role
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {roleChange && canManage && (
        <RoleChangeDialog
          user={roleChange.user}
          currentRole={roleChange.user.role}
          target={roleChange.target}
          onTarget={(r) => setRoleChange({ user: roleChange.user, target: r })}
          onClose={() => setRoleChange(null)}
          onConfirm={confirmRoleChange}
          busy={actionState.busy}
        />
      )}

      {!canManage && (
        <p className="text-xs text-slate-500 dark:text-slate-400">You do not have permission to manage team roles.</p>
      )}

      {actionState.error && (
        <p role="alert" className="text-sm font-medium text-danger-700 dark:text-danger-400">{actionState.error}</p>
      )}
    </div>
  );
}

function RoleChangeDialog({
  user,
  currentRole,
  target,
  onTarget,
  onClose,
  onConfirm,
  busy,
}: {
  user: TeamMember;
  currentRole: string;
  target: string;
  onTarget: (role: string) => void;
  onClose: () => void;
  onConfirm: () => void;
  busy: boolean;
}) {
  const gained = Array.from(capabilitiesForRole(target)).filter((c) => !Array.from(capabilitiesForRole(currentRole)).includes(c));
  const lost = Array.from(capabilitiesForRole(currentRole)).filter((c) => !Array.from(capabilitiesForRole(target)).includes(c));

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="role-dialog-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card w-full max-w-md">
        <h3 id="role-dialog-title" className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          Change role for {user.name}
        </h3>
        <div className="mt-3">
          <label className="label" htmlFor="role-target">New role</label>
          <Select id="role-target" value={target} onChange={(e) => onTarget(e.target.value)}>
            {ROLE_OPTIONS.map((r) => (
              <option key={r} value={r}>{ROLE_LABEL[r as keyof typeof ROLE_LABEL] ?? r}</option>
            ))}
          </Select>
        </div>

        {gained.length > 0 && (
          <div className="mt-3">
            <p className="text-xs font-semibold text-success-700 dark:text-success-400">Will gain</p>
            <ul className="mt-1 list-inside list-disc text-sm text-slate-600 dark:text-slate-300">
              {gained.map((c) => <li key={c}>{CAPABILITY_LABEL[c] ?? c}</li>)}
            </ul>
          </div>
        )}
        {lost.length > 0 && (
          <div className="mt-3">
            <p className="text-xs font-semibold text-danger-700 dark:text-danger-400">Will lose</p>
            <ul className="mt-1 list-inside list-disc text-sm text-slate-600 dark:text-slate-300">
              {lost.map((c) => <li key={c}>{CAPABILITY_LABEL[c] ?? c}</li>)}
            </ul>
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <Button size="sm" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={onConfirm} pending={busy}>Confirm change</Button>
        </div>
      </div>
    </div>
  );
}

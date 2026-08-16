"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  assignProjectMemberAction,
  updateProjectMemberAction,
  removeProjectMemberAction,
} from "@/lib/actions/projects-team";
import { useActionState } from "@/lib/client/action-state";
import { can, type Capability } from "@/lib/shared/capabilities";
import { Badge } from "@/components/data/Badge";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Field } from "@/components/ui/Field";
import { ROLE_LABEL, ROLE_OPTIONS } from "@/lib/labels";

export type ProjectMemberView = {
  id: string;
  projectId: string;
  userId: string;
  role: string;
  status: string;
  assignedAt: string;
};

export type ProjectUserView = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
};

const ASSIGNABLE_ROLES = ROLE_OPTIONS.filter((r) => r !== "ADMIN");

export function ProjectTeamPanel({
  projectId,
  members,
  users,
  capabilities,
}: {
  projectId: string;
  members: ProjectMemberView[];
  users: ProjectUserView[];
  capabilities: readonly Capability[];
}) {
  const router = useRouter();
  const actionState = useActionState();
  const canManage = can(capabilities, "team.manage") || can(capabilities, "team.invite");

  const [showAssign, setShowAssign] = useState(false);
  const [assignUserId, setAssignUserId] = useState("");
  const [assignRole, setAssignRole] = useState("FIELD_OFFICER");
  const [roleChange, setRoleChange] = useState<{ member: ProjectMemberView; target: string } | null>(null);
  const [removing, setRemoving] = useState<ProjectMemberView | null>(null);

  const unassignedUsers = useMemo(() => {
    const assigned = new Set(members.filter((m) => m.status === "ACTIVE").map((m) => m.userId));
    return users.filter((u) => u.status === "ACTIVE" && !assigned.has(u.id));
  }, [members, users]);

  const rows = useMemo(
    () =>
      members.map((m) => ({
        member: m,
        user: users.find((u) => u.id === m.userId),
      })),
    [members, users],
  );

  async function assign(e: React.FormEvent) {
    e.preventDefault();
    if (!assignUserId) return;
    const result = await actionState.run(() =>
      assignProjectMemberAction(projectId, { userId: assignUserId, role: assignRole }),
    );
    if (result !== undefined) {
      setAssignUserId("");
      setShowAssign(false);
      router.refresh();
    }
  }

  async function confirmRoleChange() {
    if (!roleChange) return;
    const result = await actionState.run(() =>
      updateProjectMemberAction(roleChange.member.id, roleChange.target),
    );
    if (result !== undefined) {
      setRoleChange(null);
      router.refresh();
    }
  }

  async function confirmRemove() {
    if (!removing) return;
    const result = await actionState.run(() => removeProjectMemberAction(removing.id));
    if (result !== undefined) {
      setRemoving(null);
      router.refresh();
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {members.filter((m) => m.status === "ACTIVE").length} active member(s) on this project.
        </p>
        {canManage && (
          <Button size="sm" variant="secondary" onClick={() => setShowAssign((v) => !v)}>
            {showAssign ? "Close assignment" : "Assign member"}
          </Button>
        )}
      </div>

      {showAssign && canManage && (
        <form onSubmit={assign} className="card max-w-lg space-y-3" noValidate>
          <Field
            label="Member"
            htmlFor="assign-user"
            description={unassignedUsers.length === 0 ? "All active team members are already assigned." : undefined}
          >
            <Select id="assign-user" value={assignUserId} onChange={(e) => setAssignUserId(e.target.value)} required>
              <option value="">Select a team member…</option>
              {unassignedUsers.map((u) => (
                <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
              ))}
            </Select>
          </Field>
          <Field label="Project role" htmlFor="assign-role">
            <Select id="assign-role" value={assignRole} onChange={(e) => setAssignRole(e.target.value)}>
              {ASSIGNABLE_ROLES.map((r) => (
                <option key={r} value={r}>{ROLE_LABEL[r as keyof typeof ROLE_LABEL] ?? r}</option>
              ))}
            </Select>
          </Field>
          <div className="flex justify-end">
            <Button type="submit" size="sm" pending={actionState.busy}>Assign</Button>
          </div>
        </form>
      )}

      <div className="table-shell">
        <table className="w-full text-sm">
          <thead className="thead">
            <tr>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">Email</th>
              <th className="px-3 py-2 text-left">Project role</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Assigned</th>
              {canManage && <th className="px-3 py-2 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={canManage ? 6 : 5} className="px-3 py-4 text-slate-500 dark:text-slate-400">No members assigned yet.</td></tr>
            )}
            {rows.map(({ member, user }) => (
              <tr key={member.id} className="trow">
                <td className="px-3 py-2 font-medium">{user?.name ?? member.userId}</td>
                <td className="px-3 py-2">{user?.email ?? "—"}</td>
                <td className="px-3 py-2">{ROLE_LABEL[member.role as keyof typeof ROLE_LABEL] ?? member.role}</td>
                <td className="px-3 py-2">
                  <Badge tone={member.status === "ACTIVE" ? "success" : "warning"}>{member.status.replace(/_/g, " ")}</Badge>
                </td>
                <td className="px-3 py-2">{member.assignedAt.slice(0, 10)}</td>
                {canManage && (
                  <td className="px-3 py-2 text-right">
                    {member.status === "ACTIVE" && (
                      <div className="flex justify-end gap-2">
                        <button type="button" className="btn-secondary py-1 text-xs" onClick={() => setRoleChange({ member, target: member.role })}>
                          Change role
                        </button>
                        <button type="button" className="btn-secondary py-1 text-xs text-danger-700 dark:text-danger-400" onClick={() => setRemoving(member)}>
                          Remove
                        </button>
                      </div>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {roleChange && canManage && (
        <div role="dialog" aria-modal="true" aria-labelledby="project-role-dialog" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="card w-full max-w-md">
            <h3 id="project-role-dialog" className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              Change project role
            </h3>
            <div className="mt-3">
              <label className="label" htmlFor="project-role-target">New role</label>
              <Select id="project-role-target" value={roleChange.target} onChange={(e) => setRoleChange({ member: roleChange.member, target: e.target.value })}>
                {ASSIGNABLE_ROLES.map((r) => (
                  <option key={r} value={r}>{ROLE_LABEL[r as keyof typeof ROLE_LABEL] ?? r}</option>
                ))}
              </Select>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button size="sm" variant="secondary" onClick={() => setRoleChange(null)}>Cancel</Button>
              <Button size="sm" onClick={confirmRoleChange} pending={actionState.busy}>Confirm change</Button>
            </div>
          </div>
        </div>
      )}

      {removing && canManage && (
        <div role="dialog" aria-modal="true" aria-labelledby="project-remove-dialog" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="card w-full max-w-md">
            <h3 id="project-remove-dialog" className="text-sm font-semibold text-slate-800 dark:text-slate-100">Remove member</h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Remove {removing ? users.find((u) => u.id === removing.userId)?.name ?? "this member" : ""} from this project? Their access to this project is revoked.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button size="sm" variant="secondary" onClick={() => setRemoving(null)}>Cancel</Button>
              <Button size="sm" variant="danger" onClick={confirmRemove} pending={actionState.busy}>Remove</Button>
            </div>
          </div>
        </div>
      )}

      {!canManage && (
        <p className="text-xs text-slate-500 dark:text-slate-400">You do not have permission to manage project assignments.</p>
      )}

      {actionState.error && (
        <p role="alert" className="text-sm font-medium text-danger-700 dark:text-danger-400">{actionState.error}</p>
      )}
    </div>
  );
}

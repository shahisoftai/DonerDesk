"use client";

import { useEffect, useMemo, useState } from "react";

type Tab = "overview" | "tenants" | "users" | "tiers" | "billing" | "nonprofit" | "ai" | "email" | "storage" | "backups" | "connectors" | "kestra" | "audit" | "system";
type AnyRow = Record<string, any>;

const tierPlanCodes = ["STARTER", "TEAM", "GROWTH", "ENTERPRISE"];

const roles = ["ADMIN", "PROJECT_MANAGER", "ME_OFFICER", "GRANTS_OFFICER", "FIELD_OFFICER", "COMPLIANCE_OFFICER", "VIEWER"];
const providerGroups = {
  ai: { category: "LLM", providers: ["anthropic", "gemini", "deepseek", "minimax", "glm", "openai"] },
  email: { category: "EMAIL", providers: ["brevo", "postmark", "resend", "ses", "smtp"] },
  storage: { category: "OBJECT_STORAGE", providers: ["cloudflare-r2", "backblaze-b2", "aws-s3", "s3-compatible"] },
  backups: { category: "BACKUP", providers: ["cloudflare-r2", "backblaze-b2", "aws-s3", "s3-compatible"] },
  connectors: { category: "CONNECTOR", providers: ["kobotoolbox", "odk-central", "google-drive", "google-drive-oauth", "sharepoint", "s3-drop-folder"] },
} as const;

const fields: Record<string, { config: string[]; secrets: string[] }> = {
  openai: { config: ["model", "baseUrl", "organizationId"], secrets: ["apiKey"] },
  anthropic: { config: ["model", "effort", "baseUrl"], secrets: ["apiKey"] },
  gemini: { config: ["model", "baseUrl"], secrets: ["apiKey"] },
  deepseek: { config: ["model", "baseUrl"], secrets: ["apiKey"] },
  minimax: { config: ["model", "baseUrl", "groupId"], secrets: ["apiKey"] },
  glm: { config: ["model", "baseUrl"], secrets: ["apiKey"] },
  brevo: { config: ["senderEmail", "senderName"], secrets: ["apiKey"] },
  postmark: { config: ["senderEmail", "messageStream"], secrets: ["serverToken"] },
  resend: { config: ["senderEmail", "senderName"], secrets: ["apiKey"] },
  ses: { config: ["region", "senderEmail"], secrets: ["accessKeyId", "secretAccessKey"] },
  smtp: { config: ["host", "port", "senderEmail", "secure"], secrets: ["username", "password"] },
  "cloudflare-r2": { config: ["accountId", "bucket", "region", "endpoint", "prefix"], secrets: ["accessKeyId", "secretAccessKey"] },
  "backblaze-b2": { config: ["bucket", "region", "endpoint", "prefix"], secrets: ["keyId", "applicationKey"] },
  "aws-s3": { config: ["bucket", "region", "prefix"], secrets: ["accessKeyId", "secretAccessKey"] },
  "s3-compatible": { config: ["bucket", "region", "endpoint", "prefix"], secrets: ["accessKeyId", "secretAccessKey"] },
  kobotoolbox: { config: ["baseUrl", "assetUid", "tenantId", "schedule"], secrets: ["apiToken"] },
  "odk-central": { config: ["baseUrl", "projectId", "formId", "tenantId", "schedule"], secrets: ["username", "password"] },
  "google-drive": { config: ["folderId", "tenantId", "schedule"], secrets: ["serviceAccountJson"] },
  "google-drive-oauth": { config: ["redirectUri"], secrets: ["clientId", "clientSecret"] },
  sharepoint: { config: ["tenantId", "siteUrl", "driveId", "folderPath", "schedule"], secrets: ["clientId", "clientSecret"] },
  "s3-drop-folder": { config: ["bucket", "region", "endpoint", "prefix", "tenantId", "schedule"], secrets: ["accessKeyId", "secretAccessKey"] },
};

async function api(path: string, init?: RequestInit) {
  const response = await fetch(`/api/control/${path}`, { ...init, headers: { ...(init?.body ? { "content-type": "application/json" } : {}), ...init?.headers } });
  if (response.status === 401) { location.reload(); throw new Error("Session expired"); }
  const data = response.status === 204 ? null : await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.message || data?.title || "Request failed");
  return data;
}

export function Dashboard({ enterprisePriceFloorAnnualUsd = 12000 }: { enterprisePriceFloorAnnualUsd?: number }) {
  const [tab, setTab] = useState<Tab>("overview");
  const [data, setData] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [modal, setModal] = useState<null | { kind: "tenant" | "user" | "provider" | "tier" | "tierTenant" | "resetPassword" | "creditPacks" | "tenantDelete"; row?: AnyRow }>(null);
  const [tenants, setTenants] = useState<AnyRow[]>([]);
  const [byoStatus, setByoStatus] = useState<AnyRow[]>([]);

  const endpoint = tab === "ai" || tab === "email" || tab === "storage" || tab === "backups" || tab === "connectors" ? "configurations" : tab === "nonprofit" ? "billing/nonprofit-verifications" : tab;
  async function load() {
    try {
      const result = await api(endpoint);
      setData(tab === "nonprofit" ? result.items : result);
      if (tab === "users" || tab === "overview") setTenants(await api("tenants"));
      // WS-K item 6: cross-reference tenant-scoped LLM configs against each
      // tenant's resolved byoLlmEnabled entitlement, so the AI tab can flag a
      // configured-but-ignored provider inline.
      if (tab === "ai") setByoStatus(await api("billing/byo-llm-status"));
    } catch (error) { flash("error", String(error)); }
  }
  useEffect(() => { void load(); }, [tab]);
  function flash(type: "ok" | "error", text: string) { setNotice({ type, text }); window.setTimeout(() => setNotice(null), 5000); }
  async function action(task: () => Promise<any>, message: string) { setBusy(true); try { await task(); flash("ok", message); setModal(null); await load(); } catch (e) { flash("error", e instanceof Error ? e.message : String(e)); } finally { setBusy(false); } }
  function changeTab(next: Tab) { setData(null); setModal(null); setTab(next); }

  const navigation: Array<[Tab, string, string]> = [
    ["overview", "Overview", "⌂"], ["tenants", "Tenants", "▦"], ["users", "Users", "♙"],
    ["tiers", "Tier management", "◈"], ["billing", "Billing & credits", "¤"],
    ["nonprofit", "Nonprofit verification", "♥"],
    ["ai", "AI & LLM", "✦"], ["email", "Email", "✉"], ["storage", "Object storage", "▤"],
    ["backups", "Off-host backups", "↥"], ["connectors", "Inbound connectors", "⇄"],
    ["kestra", "Kestra plugins", "⚙"], ["audit", "Audit trail", "◷"], ["system", "System health", "●"],
  ];

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="logo"><span className="logo-mark">D</span><div>DonorDesk<small>SUPERADMIN</small></div></div>
      <nav>{navigation.map(([id, label, icon]) => <button key={id} className={tab === id ? "selected" : ""} onClick={() => changeTab(id)}><span>{icon}</span>{label}</button>)}</nav>
      <div className="identity"><span className="avatar">MP</span><div><strong>Platform owner</strong><small>mnpiracha@gmail.com</small></div></div>
    </aside>
    <main className="content">
      <header className="topbar"><div><h1>{navigation.find(x => x[0] === tab)?.[1]}</h1><p>DonorDesk global platform control plane</p></div><div className="top-actions"><div className="secure">● SECURE SESSION</div><button onClick={async()=>{await api("auth/logout",{method:"POST"});location.reload()}}>Sign out</button></div></header>
      {notice && <div className={`toast ${notice.type}`}>{notice.text}</div>}
      {tab === "overview" && <Overview data={data} onNavigate={changeTab} />}
      {tab === "tenants" && <Tenants rows={Array.isArray(data) ? data : []} onAdd={() => setModal({ kind: "tenant" })} onEdit={(row: AnyRow) => setModal({ kind: "tenant", row })} onDelete={(row: AnyRow) => setModal({ kind: "tenantDelete", row })} />}
      {tab === "tiers" && <Tiers data={data || {}} onEditTier={(tier: AnyRow) => setModal({ kind: "tier", row: tier })} onResetTier={(tier: AnyRow) => confirm(`Revert ${tier.name} (${tier.planCode}) to the static catalog? Any global overrides are removed.`) && void action(() => api(`tiers/${tier.planCode}/reset`, { method: "POST" }), "Tier reset to catalog")} onManageTenant={(row: AnyRow) => setModal({ kind: "tierTenant", row })}       onProvisionEnterprise={(row: AnyRow) => {
        // Server-provided floor (from ENTERPRISE_PRICE_FLOOR_ANNUAL_USD via
        // the server page) so the client bundle never imports the domain pkg.
        const floor = enterprisePriceFloorAnnualUsd;
        const floorLabel = floor.toLocaleString("en-US");
        const annualPriceUsd = Number(prompt(`Annual contract price (USD, floor $${floorLabel}):`, String(floor)));
        if (!annualPriceUsd || annualPriceUsd < floor) { flash("error", `Annual price must be at least $${floorLabel}`); return; }
        const contractStart = prompt("Contract start date (YYYY-MM-DD):", new Date().toISOString().slice(0, 10));
        if (!contractStart) return;
        const contractEnd = prompt("Contract end date (YYYY-MM-DD):");
        if (!contractEnd) return;
        void action(() => api(`tenants/${row.tenantId}/enterprise-contract`, { method: "POST", body: JSON.stringify({ annualPriceUsd, contractStart, contractEnd }) }), "Enterprise contract provisioned");
      }} />}
      {tab === "billing" && <Billing rows={Array.isArray(data) ? data : []} onManagePacks={(row: AnyRow) => setModal({ kind: "creditPacks", row })} onSetCredits={(row: AnyRow) => { const value = prompt(`Set monthly AI draft credits for ${row.name} (current: ${row.monthlyAiDraftCredits})`, String(row.monthlyAiDraftCredits)); if (value !== null && value.trim() !== "") { const parsed = Number(value); if (Number.isInteger(parsed) && parsed >= 0) void action(() => api(`tenants/${row.tenantId}/credits`, { method: "POST", body: JSON.stringify({ mode: "SET", value: parsed, reason: "superadmin" }) }), "Credits updated"); else flash("error", "Credit value must be a non-negative integer"); } }} onAdjustCredits={(row: AnyRow, mode: "INCREASE" | "DECREASE") => { const value = prompt(mode === "INCREASE" ? `Increase AI draft credits for ${row.name} by:` : `Reduce AI draft credits for ${row.name} by:`); if (value !== null && value.trim() !== "") { const parsed = Number(value); if (Number.isInteger(parsed) && parsed >= 0) void action(() => api(`tenants/${row.tenantId}/credits`, { method: "POST", body: JSON.stringify({ mode, value: parsed, reason: "superadmin" }) }), "Credits updated"); else flash("error", "Credit value must be a non-negative integer"); } }} onResetCounter={(row: AnyRow) => confirm(`Reset the current month's AI credit usage for ${row.name}? This does not change the allowance.`) && void action(() => api(`tenants/${row.tenantId}/credits/reset`, { method: "POST" }), "Usage counter reset")}
        onGrantTrial={(row: AnyRow) => { const planCode = prompt("Grant a trial of which plan? (TEAM or GROWTH)", "TEAM"); if (!planCode || (planCode !== "TEAM" && planCode !== "GROWTH")) return; const days = prompt("Trial length in days:", "14"); if (days === null) return; void action(() => api(`tenants/${row.tenantId}/trial`, { method: "POST", body: JSON.stringify({ planCode, days: Number(days) || 14 }) }), "Trial granted"); }}
        onExtendTrial={(row: AnyRow) => { const days = prompt(`Extend ${row.name}'s trial by how many days?`, "14"); if (days === null) return; void action(() => api(`tenants/${row.tenantId}/trial/extend`, { method: "POST", body: JSON.stringify({ days: Number(days) || 14 }) }), "Trial extended"); }}
        onEndTrial={(row: AnyRow) => confirm(`End ${row.name}'s trial now? The tenant falls back to Starter (or its subscription) immediately.`) && void action(() => api(`tenants/${row.tenantId}/trial/end`, { method: "POST" }), "Trial ended")}
        onOverrideFingerprint={() => { const email = prompt("Email to clear the trial-abuse fingerprint for (lets that email start another trial):"); if (!email) return; void action(() => api("trial-fingerprint/override", { method: "POST", body: JSON.stringify({ email }) }), "Trial fingerprint cleared"); }}
      />}
      {tab === "nonprofit" && <NonprofitVerifications rows={Array.isArray(data) ? data : []} busy={busy} onApprove={(row: AnyRow) => confirm(`Approve nonprofit verification for tenant ${row.tenantId}? This unlocks the discounted checkout product.`) && void action(() => api(`billing/nonprofit-verifications/${row.id}/approve`, { method: "POST" }), "Verification approved")} onReject={(row: AnyRow) => { const reason = prompt("Reason for rejection (recorded in the audit trail):"); if (reason && reason.trim()) void action(() => api(`billing/nonprofit-verifications/${row.id}/reject`, { method: "POST", body: JSON.stringify({ reason: reason.trim() }) }), "Verification rejected"); }} onRunByoLlmGrandfather={() => confirm("Run the BYO-LLM grandfather migration? This grants a permanent MANUAL override to any tenant with a working tenant-scoped LLM configuration whose plan does not include byoLlmEnabled. Safe to re-run.") && void action(() => api("billing/grandfather-byo-llm", { method: "POST" }), "BYO-LLM grandfather migration run")} />}
      {tab === "users" && <Users rows={Array.isArray(data) ? data : []} tenants={tenants} onAdd={() => setModal({ kind: "user" })} onEdit={(row: AnyRow) => setModal({ kind: "user", row })} onReset={(row: AnyRow) => setModal({ kind: "resetPassword", row })} onDelete={(row: AnyRow) => confirm(`Delete ${row.email}? This cannot be undone.`) && void action(() => api(`users/${row.id}`, { method: "DELETE" }), "User deleted")} />}
      {(tab in providerGroups) && <Providers tab={tab as keyof typeof providerGroups} rows={(Array.isArray(data) ? data : []).filter((x: AnyRow) => x.category === providerGroups[tab as keyof typeof providerGroups].category)} byoStatus={byoStatus} onAdd={() => setModal({ kind: "provider" })} onEdit={(row: AnyRow) => setModal({ kind: "provider", row })} onTest={(row: AnyRow) => action(() => api(`configurations/${row.id}/test`, { method: "POST" }), "Connection test completed")} onToggle={(row: AnyRow) => action(() => api("configurations", { method: "PUT", body: JSON.stringify(configurationPayload(row, { enabled: !row.enabled })) }), row.enabled ? "Provider disabled" : "Provider enabled")} onDelete={(row: AnyRow) => confirm(`Delete ${row.displayName}? Encrypted credentials will also be removed.`) && void action(() => api(`configurations/${row.id}`, { method: "DELETE" }), "Configuration deleted")} />}
      {tab === "audit" && <Audit rows={Array.isArray(data) ? data : []} />}
      {tab === "kestra" && <Kestra data={data || {}} />}
      {tab === "system" && <System data={data || {}} />}
    </main>
    {modal?.kind === "tenant" && <TenantModal row={modal.row} busy={busy} onClose={() => setModal(null)} onSave={(value: AnyRow) => action(() => api(modal.row ? `tenants/${modal.row.id}` : "tenants", { method: modal.row ? "PATCH" : "POST", body: JSON.stringify(value) }), modal.row ? "Tenant updated" : "Tenant created")} />}
    {modal?.kind === "tenantDelete" && modal.row && <TenantDeleteModal row={modal.row} busy={busy} onClose={() => setModal(null)} onDelete={(body: AnyRow) => action(() => api(`tenants/${modal.row!.id}`, { method: "DELETE", body: JSON.stringify(body) }), "Tenant deleted")} />}
    {modal?.kind === "user" && <UserModal row={modal.row} tenants={tenants} busy={busy} onClose={() => setModal(null)} onSave={(value: AnyRow) => action(() => api(modal.row ? `users/${modal.row.id}` : "users", { method: modal.row ? "PATCH" : "POST", body: JSON.stringify(value) }), modal.row ? "User updated" : "User created")} />}
    {modal?.kind === "resetPassword" && modal.row && <UserResetPasswordModal row={modal.row} busy={busy} onClose={() => setModal(null)} />}
    {modal?.kind === "provider" && <ProviderModal group={providerGroups[tab as keyof typeof providerGroups]} row={modal.row} tenants={tenants} busy={busy} onClose={() => setModal(null)} onSave={(value: AnyRow) => action(() => api("configurations", { method: "PUT", body: JSON.stringify(value) }), modal.row ? "Configuration updated and secrets rotated" : "Credentials encrypted and saved")} />}
    {modal?.kind === "tier" && (() => { const row = modal.row!; return <TierModal row={row} busy={busy} onClose={() => setModal(null)} onSave={(value: AnyRow) => action(() => api(`tiers/${row.planCode}`, { method: "PUT", body: JSON.stringify(value) }), "Tier updated globally")} />; })()}
    {modal?.kind === "tierTenant" && (() => { const row = modal.row!; return <TenantTierModal row={row} busy={busy} onClose={() => setModal(null)} onSave={(value: AnyRow) => action(() => api(`tenants/${row.tenantId}/tier`, { method: "POST", body: JSON.stringify({ planCode: value.planCode, reason: value.reason, limits: value.customLimits ? value.limits : undefined }) }), "Tenant tier updated")} onReset={() => action(() => api(`tenants/${row.tenantId}/tier/reset`, { method: "POST" }), "Tenant tier overrides reset")} />; })()}
    {modal?.kind === "creditPacks" && modal.row && <CreditPacksModal row={modal.row} busy={busy} onClose={() => setModal(null)} onComp={(credits: number, reason: string) => action(() => api(`billing/credit-packs/${modal.row!.tenantId}/comp`, { method: "POST", body: JSON.stringify({ credits, reason: reason || undefined }) }), "Comped credit pack granted")} onRefund={(packId: string) => action(() => api(`billing/credit-packs/${modal.row!.tenantId}/${packId}/refund`, { method: "POST" }), "Credit pack refunded")} />}
  </div>;
}

function Overview({ data, onNavigate }: { data: any; onNavigate: (tab: Tab) => void }) {
  const cards: Array<[string, any, Tab, string]> = [["Tenants", data?.tenants ?? "—", "tenants", "Organizations"], ["Users", data?.users ?? "—", "users", "Across all tenants"], ["Integrations", data?.configurations ?? "—", "ai", "Encrypted configurations"], ["Backup runs", data?.backups?.length ?? 0, "backups", "Recent activity"]];
  return <><section className="hero"><div><span className="eyebrow">PLATFORM OPERATIONS</span><h2>Everything that runs DonorDesk,<br />under your control.</h2><p>Manage tenants, identities, AI, communications, storage, backups and data ingestion from one secured console.</p></div><span className="health-orb">✓<small>All systems<br />operational</small></span></section><div className="stat-grid">{cards.map(([label, value, target, sub]) => <button className="stat-card" onClick={() => onNavigate(target)} key={label}><small>{label}</small><strong>{value}</strong><span>{sub} →</span></button>)}</div><section className="panel"><div className="panel-title"><div><h3>Quick actions</h3><p>Common platform administration tasks</p></div></div><div className="quick-grid">{[["Add tenant", "tenants"], ["Create user", "users"], ["Configure an LLM", "ai"], ["Set up backup", "backups"], ["Connect data source", "connectors"]].map(([label, target]) => <button key={label} onClick={() => onNavigate(target as Tab)}>＋ {label}</button>)}</div></section></>;
}

function Tenants({ rows, onAdd, onEdit, onDelete }: any) { return <Resource title="Tenant organizations" description="Create and manage every organization using DonorDesk." add="Add tenant" onAdd={onAdd}><table><thead><tr><th>Organization</th><th>Tenant ID</th><th>Country</th><th>Contact</th><th>Users</th><th>Projects</th><th>AI</th><th /></tr></thead><tbody>{rows.map((r: AnyRow) => <tr key={r.id}><td><strong>{r.name}</strong><small>{r.organizationType}</small></td><td><code>{r.tenantId}</code></td><td>{r.country}</td><td>{r.contactEmail}</td><td>{r._count?.users ?? 0}</td><td>{r._count?.projects ?? 0}{r.archivedProjects ? ` (${r.archivedProjects} archived)` : ""}</td><td><Badge ok={r.aiEnabled}>{r.aiEnabled ? "Enabled" : "Disabled"}</Badge></td><td><Actions edit={() => onEdit(r)} remove={() => onDelete(r)} /></td></tr>)}</tbody></table></Resource>; }

function Users({ rows, tenants, onAdd, onEdit, onReset, onDelete }: any) { const names = Object.fromEntries(tenants.map((x: AnyRow) => [x.tenantId, x.name])); return <Resource title="Users and access" description="Control identities, tenant membership, roles, status and credentials." add="Create user" onAdd={onAdd}><table><thead><tr><th>User</th><th>Tenant</th><th>Role</th><th>Status</th><th>Last login</th><th /></tr></thead><tbody>{rows.map((r: AnyRow) => <tr key={r.id}><td><strong>{r.name}</strong><small>{r.email}</small></td><td>{names[r.tenantId] || r.tenantId}</td><td>{pretty(r.role)}</td><td><Badge ok={r.status === "ACTIVE"}>{pretty(r.status)}</Badge></td><td>{date(r.lastLoginAt)}</td><td><div className="row-actions"><button onClick={() => onReset(r)}>Reset password</button><Actions edit={() => onEdit(r)} remove={() => onDelete(r)} /></div></td></tr>)}</tbody></table></Resource>; }

function Billing({ rows, onManagePacks, onSetCredits, onAdjustCredits, onResetCounter, onGrantTrial, onExtendTrial, onEndTrial, onOverrideFingerprint }: any) {
  return <Resource title="Billing & AI credits" description="Per-tenant plan, monthly AI-draft allowance and current usage. Manual grants take effect immediately.">
    <div style={{ marginBottom: 12 }}><button onClick={onOverrideFingerprint}>Clear a trial-abuse fingerprint</button></div>
    <table>
      <thead><tr><th>Organization</th><th>Plan</th><th>Source</th><th>AI credits / month</th><th>Used this month</th><th>Remaining</th><th>Top-up packs</th><th>Subscription</th><th /></tr></thead>
      <tbody>{rows.map((r: AnyRow) => {
        const remaining = r.monthlyAiDraftCredits == null ? null : Number(r.monthlyAiDraftCredits) - Number(r.aiCreditsUsed);
        return <tr key={r.tenantId}>
          <td><strong>{r.name}</strong><small><code>{r.tenantId}</code>{r.overrideApplied ? " · manual override" : ""}</small></td>
          <td><Badge ok>{r.planName}</Badge>{r.source === "TRIAL" && r.trialEndsAt ? <small> trial ends {date(r.trialEndsAt)}</small> : null}</td>
          <td>{pretty(r.source)}</td>
          <td>{r.monthlyAiDraftCredits == null ? "Unlimited" : r.monthlyAiDraftCredits}</td>
          <td>{Number(r.aiCreditsUsed)}{Number(r.aiCreditsReserved) > 0 ? ` (+${r.aiCreditsReserved} reserved)` : ""}</td>
          <td>{remaining == null ? "—" : remaining}</td>
          <td>{r.creditPacks?.active ? `${r.creditPacks.active} active (${r.creditPacks.credits - r.creditPacks.used}/${r.creditPacks.credits} left)${r.creditPacks.suspended ? ` · ${r.creditPacks.suspended} suspended` : ""}` : (r.creditPacks?.suspended ? `${r.creditPacks.suspended} suspended` : "—")}</td>
          <td>{r.subscription ? <span><Badge ok={r.subscription.status === "ACTIVE"}>{pretty(r.subscription.status)}</Badge><small>{pretty(r.subscription.planCode)} · {pretty(r.subscription.interval)}</small></span> : <span className="muted">None</span>}</td>
          <td><div className="row-actions">
            <button onClick={() => onSetCredits(r)}>Set allowance</button>
            <button onClick={() => onAdjustCredits(r, "INCREASE")}>+ Increase</button>
            <button onClick={() => onAdjustCredits(r, "DECREASE")}>− Reduce</button>
            <button className="danger-link" onClick={() => onResetCounter(r)}>Reset month usage</button>
            <button onClick={() => onManagePacks(r)}>Manage credit packs</button>
            {r.source === "TRIAL" ? <><button onClick={() => onExtendTrial(r)}>Extend trial</button><button className="danger-link" onClick={() => onEndTrial(r)}>End trial</button></> : <button onClick={() => onGrantTrial(r)}>Grant trial</button>}
          </div></td>
        </tr>;
      })}</tbody>
    </table>
    <p className="help-note">Adjusting the allowance writes a MANUAL entitlement grant (highest precedence); resetting month usage zeroes the current UTC-month counter. Both actions are recorded in the audit trail.</p>
  </Resource>;
}

function NonprofitVerifications({ rows, busy, onApprove, onReject, onRunByoLlmGrandfather }: any) {
  return <Resource title="Nonprofit verification queue" description="Pending submissions for the 40% verified nonprofit discount. Approving unlocks the discounted Creem checkout product for that tenant; it never changes plan limits.">
    <div style={{ marginBottom: 12 }}><button onClick={onRunByoLlmGrandfather} disabled={busy}>Run BYO-LLM grandfather migration</button></div>
    {rows.length === 0 && <Empty text="No pending nonprofit verifications." />}
    {rows.length > 0 && <table>
      <thead><tr><th>Tenant</th><th>Registration number</th><th>Document</th><th>Submitted</th><th /></tr></thead>
      <tbody>{rows.map((r: AnyRow) => <tr key={r.id}>
        <td><code>{r.tenantId}</code></td>
        <td>{r.registrationNumber}</td>
        <td><a href={r.documentUrl} target="_blank" rel="noreferrer">View document</a></td>
        <td>{date(r.submittedAt)}</td>
        <td><div className="row-actions"><button onClick={() => onApprove(r)} disabled={busy}>Approve</button><button className="danger-link" onClick={() => onReject(r)} disabled={busy}>Reject</button></div></td>
      </tr>)}</tbody>
    </table>}
    <p className="help-note">Approval sets Organization.nonprofitVerifiedAt, which the checkout handler reads to offer the CREEM_PRODUCT_*_NONPROFIT product when configured. It never writes an entitlement grant or changes plan limits.</p>
  </Resource>;
}

function Providers({ tab, rows, byoStatus, onAdd, onEdit, onTest, onToggle, onDelete }: any) { const allMeta: Record<string, string[]> = { ai: ["AI and language models", "The enabled all-tenants provider drafts every tenant's reports. A tenant-scoped provider (the tenant's own API) overrides it for that tenant. Enabling a provider switches off the previous one in the same scope.", "Add LLM provider"], email: ["Transactional email", "Control outbound invitations, alerts and notifications.", "Add email provider"], storage: ["Object storage", "Manage evidence and export storage destinations.", "Add storage"], backups: ["Encrypted off-host backups", "Configure independent disaster-recovery destinations.", "Add backup target"], connectors: ["Inbound data connectors", "Ingest evidence and field data from external systems.", "Add connector"] }; const meta = allMeta[String(tab)]!; const byoById = new Map((Array.isArray(byoStatus) ? byoStatus : []).map((s: AnyRow) => [s.configId, s])); return <Resource title={meta[0]} description={meta[1]} add={meta[2]} onAdd={onAdd}><div className="provider-grid">{rows.length === 0 && <Empty text="No provider configured yet." />}{rows.map((r: AnyRow) => { const byo = r.scopeType === "TENANT" ? byoById.get(r.id) : undefined; return <article className="provider-card" key={r.id}><div className="provider-head"><span className="provider-icon">{providerIcon(r.provider)}</span><div><h3>{r.displayName}</h3><p>{pretty(r.provider)} · {r.scopeType === "TENANT" ? `Tenant's own API · ${r.scopeId}` : "All tenants"}{r.category === "LLM" && safeJson(r.configurationJson, {}).model ? ` · ${safeJson(r.configurationJson, {}).model}` : ""}</p></div><Badge ok={r.enabled}>{r.enabled ? (r.category === "LLM" ? (r.scopeType === "TENANT" ? "Active for tenant" : "Default for all tenants") : "Active") : "Disabled"}</Badge></div><div className="provider-meta"><span>Credentials <strong>{r.secretConfigured ? "✓ Encrypted" : "Not set"}</strong></span><span>Last test <strong>{r.lastTestStatus || "Never"}</strong></span><span>Updated <strong>{date(r.updatedAt)}</strong></span></div>{byo?.ignoredByPlan && <p className="test-result fail">⚠ Ignored: this tenant's plan does not include byoLlmEnabled, so drafts fall back to the platform default provider (see audit event billing.byo_llm.blocked_by_plan).</p>}{r.lastTestMessage && <p className={`test-result ${r.lastTestStatus === "SUCCESS" ? "pass" : "fail"}`}>{r.lastTestMessage}</p>}<div className="card-actions"><button onClick={() => onTest(r)}>Test connection</button><button onClick={() => onToggle(r)}>{r.enabled ? "Disable" : "Enable"}</button><button onClick={() => onEdit(r)}>Edit / rotate keys</button><button className="danger-link" onClick={() => onDelete(r)}>Delete</button></div></article>; })}</div></Resource>; }

function Tiers({ data, onEditTier, onResetTier, onManageTenant, onProvisionEnterprise }: any) {
  const catalog: AnyRow[] = Array.isArray(data.catalog) ? data.catalog : [];
  const tenants: AnyRow[] = Array.isArray(data.tenants) ? data.tenants : [];
  return <div className="tiers-wrap">
    <section className="panel resource">
      <div className="panel-title"><div><h2>Tier catalog</h2><p>Global feature allocation for every tier. Overrides apply to all tenants on the tier immediately; static values are the shipped defaults.</p></div></div>
      <div className="table-wrap"><table>
        <thead><tr><th>Tier</th><th>Monthly</th><th>Annual</th><th>Trial</th><th>Projects</th><th>Seats</th><th>Managed storage</th><th>AI drafts / month</th><th>Tenants</th><th>State</th><th /></tr></thead>
        <tbody>{catalog.map((t: AnyRow) => <tr key={t.planCode}>
          <td><strong>{t.name}</strong><small><code>{t.planCode}</code>{t.overridden ? " · overridden" : ""}</small></td>
          <td>{t.monthlyPriceUsd == null ? "Custom" : `$${t.monthlyPriceUsd}`}</td>
          <td>{t.annualPriceUsd == null ? "Custom" : `$${t.annualPriceUsd}`}</td>
          <td>{t.trialDays == null ? "—" : `${t.trialDays} days`}</td>
          <td>{t.limits?.maxActiveProjects ?? "Unlimited"}</td>
          <td>{t.limits?.maxSeats ?? "Unlimited"}</td>
          <td>{bytes(t.limits?.maxManagedStorageBytes)}</td>
          <td>{t.limits?.monthlyAiDraftCredits ?? "Unlimited"}</td>
          <td>{t.tenantCount}</td>
          <td><Badge ok={t.enabled}>{t.enabled ? "Enabled" : "Disabled"}</Badge></td>
          <td><div className="row-actions"><button onClick={() => onEditTier(t)}>Edit tier</button>{t.overridden && <button className="danger-link" onClick={() => onResetTier(t)}>Reset to catalog</button>}</div></td>
        </tr>)}</tbody>
      </table></div>
      <p className="help-note">Editing a tier writes a global <code>PlanCatalogOverride</code>; feature allocations take effect on next entitlement resolution. Disabling a tier hides it from new assignments and checkout options.</p>
    </section>
    <section className="panel resource">
      <div className="panel-title"><div><h2>Tenant tier assignments</h2><p>Change any tenant's tier or override its feature allocation within the current tier.</p></div></div>
      <div className="table-wrap"><table>
        <thead><tr><th>Organization</th><th>Effective tier</th><th>Source</th><th>Projects</th><th>Seats</th><th>Storage</th><th>AI drafts</th><th /></tr></thead>
        <tbody>{tenants.map((r: AnyRow) => <tr key={r.tenantId}>
          <td><strong>{r.name}</strong><small><code>{r.tenantId}</code>{r.overrideApplied ? " · manual override" : ""}</small></td>
          <td><Badge ok>{r.planName}</Badge></td>
          <td>{pretty(r.source)}</td>
          <td>{r.usage?.projects ?? 0} / {r.limits?.maxActiveProjects ?? "∞"}{r.usage?.archivedProjects ? <small> ({r.usage.archivedProjects} archived)</small> : null}</td>
          <td>{r.usage?.seats ?? 0} / {r.limits?.maxSeats ?? "∞"}</td>
          <td>{bytes(r.usage?.managedStorageBytes)} / {bytes(r.limits?.maxManagedStorageBytes)}</td>
          <td>{r.usage?.aiDraftCredits ?? r.aiCreditsUsed ?? 0} / {r.monthlyAiDraftCredits ?? "∞"}</td>
          <td><div className="row-actions"><button onClick={() => onManageTenant(r)}>Manage tier</button>{r.planCode === "ENTERPRISE" && <button onClick={() => onProvisionEnterprise(r)}>Provision contract</button>}</div></td>
        </tr>)}</tbody>
      </table></div>
      <p className="help-note">"Manage tier" lets you move the tenant to another tier (writes a MANUAL grant) and, optionally, set a per-tenant feature allocation. Reset restores the tenant to its subscription / trial / Starter entitlement.</p>
    </section>
  </div>;
}

function TierModal({ row, busy, onClose, onSave }: any) {
  const [form, setForm] = useState({
    name: row?.name || "",
    monthlyPriceUsd: row?.monthlyPriceUsd == null ? "" : String(row.monthlyPriceUsd),
    annualPriceUsd: row?.annualPriceUsd == null ? "" : String(row.annualPriceUsd),
    trialDays: row?.trialDays == null ? "" : String(row.trialDays),
    enabled: row?.enabled ?? true,
    maxActiveProjects: row?.limits?.maxActiveProjects == null ? "" : String(row.limits.maxActiveProjects),
    maxSeats: row?.limits?.maxSeats == null ? "" : String(row.limits.maxSeats),
    maxManagedStorageGb: row?.limits?.maxManagedStorageBytes == null ? "" : String(Number(row.limits.maxManagedStorageBytes) / 1073741824),
    monthlyAiDraftCredits: row?.limits?.monthlyAiDraftCredits == null ? "" : String(row.limits.monthlyAiDraftCredits),
    viewerSeats: row?.limits?.viewerSeats == null ? "" : String(row.limits.viewerSeats),
    aiCreditTopUp: row?.limits?.aiCreditTopUp ?? false,
    byoLlmEnabled: row?.limits?.byoLlmEnabled ?? false,
  });
  const storageBytes = form.maxManagedStorageGb === "" ? null : String(Math.round(Number(form.maxManagedStorageGb) * 1073741824));
  return <Modal title={`Edit ${row?.name ?? row?.planCode} tier`} subtitle="Global feature allocation — applies to every tenant on this tier" onClose={onClose} wide>
    <FormGrid>
      {input("Display name", "name", form, setForm)}
      {input("Monthly price (USD)", "monthlyPriceUsd", form, setForm, { placeholder: "Blank = custom / contract" })}
      {input("Annual price (USD)", "annualPriceUsd", form, setForm, { placeholder: "Blank = custom / contract" })}
      {input("Trial days", "trialDays", form, setForm, { placeholder: "Blank = no trial" })}
      <label className="field"><span>Max active projects</span><input value={form.maxActiveProjects} onChange={e => setForm({ ...form, maxActiveProjects: e.target.value })} placeholder="Blank = unlimited" /></label>
      <label className="field"><span>Max seats</span><input value={form.maxSeats} onChange={e => setForm({ ...form, maxSeats: e.target.value })} placeholder="Blank = unlimited" /></label>
      <label className="field"><span>Read-only viewer seats</span><input value={form.viewerSeats} onChange={e => setForm({ ...form, viewerSeats: e.target.value })} placeholder="Blank = unlimited" /></label>
      <label className="field"><span>Managed storage (GB)</span><input value={form.maxManagedStorageGb} onChange={e => setForm({ ...form, maxManagedStorageGb: e.target.value })} placeholder="Blank = unlimited" /></label>
      <label className="field"><span>AI report drafts / month</span><input value={form.monthlyAiDraftCredits} onChange={e => setForm({ ...form, monthlyAiDraftCredits: e.target.value })} placeholder="Blank = unlimited" /></label>
      <label className="check full"><input type="checkbox" checked={form.enabled} onChange={e => setForm({ ...form, enabled: e.target.checked })} /> Tier enabled (available for new assignments and checkout)</label>
      <label className="check full"><input type="checkbox" checked={form.aiCreditTopUp} onChange={e => setForm({ ...form, aiCreditTopUp: e.target.checked })} /> AI credit top-up packs purchasable</label>
      <label className="check full"><input type="checkbox" checked={form.byoLlmEnabled} onChange={e => setForm({ ...form, byoLlmEnabled: e.target.checked })} /> Tenant's own LLM provider (BYO-LLM) allowed</label>
    </FormGrid>
    <ModalActions busy={busy} onClose={onClose} onSave={() => onSave({
      name: form.name || undefined,
      monthlyPriceUsd: form.monthlyPriceUsd === "" ? null : Number(form.monthlyPriceUsd),
      annualPriceUsd: form.annualPriceUsd === "" ? null : Number(form.annualPriceUsd),
      trialDays: form.trialDays === "" ? null : Number(form.trialDays),
      enabled: form.enabled,
      limits: {
        maxActiveProjects: form.maxActiveProjects === "" ? null : Number(form.maxActiveProjects),
        maxSeats: form.maxSeats === "" ? null : Number(form.maxSeats),
        viewerSeats: form.viewerSeats === "" ? null : Number(form.viewerSeats),
        maxManagedStorageBytes: storageBytes,
        monthlyAiDraftCredits: form.monthlyAiDraftCredits === "" ? null : Number(form.monthlyAiDraftCredits),
        aiCreditTopUp: form.aiCreditTopUp,
        byoLlmEnabled: form.byoLlmEnabled,
      },
    })} label="Save tier" />
  </Modal>;
}

function TenantTierModal({ row, busy, onClose, onSave, onReset }: any) {
  const [planCode, setPlanCode] = useState(row?.planCode || "STARTER");
  const [reason, setReason] = useState("");
  const [customLimits, setCustomLimits] = useState(false);
  const [limits, setLimits] = useState({
    maxActiveProjects: row?.limits?.maxActiveProjects == null ? "" : String(row.limits.maxActiveProjects),
    maxSeats: row?.limits?.maxSeats == null ? "" : String(row.limits.maxSeats),
    maxManagedStorageGb: row?.limits?.maxManagedStorageBytes == null ? "" : String(Number(row.limits.maxManagedStorageBytes) / 1073741824),
    monthlyAiDraftCredits: row?.limits?.monthlyAiDraftCredits == null ? "" : String(row.limits.monthlyAiDraftCredits),
    viewerSeats: row?.limits?.viewerSeats == null ? "" : String(row.limits.viewerSeats),
    aiCreditTopUp: row?.limits?.aiCreditTopUp ?? false,
    byoLlmEnabled: row?.limits?.byoLlmEnabled ?? false,
  });
  const storageBytes = limits.maxManagedStorageGb === "" ? null : String(Math.round(Number(limits.maxManagedStorageGb) * 1073741824));
  return <Modal title={`Manage tier — ${row?.name}`} subtitle={`Currently ${row?.planName ?? row?.planCode} via ${pretty(row?.source)}. Manual changes take effect immediately.`} onClose={onClose} wide>
    <FormGrid>
      {select("Target tier", "planCode", tierPlanCodes, { planCode }, (x: any) => setPlanCode(x.planCode), false, { STARTER: "Starter — free", TEAM: "Team — $129/mo", GROWTH: "Growth — $299/mo", ENTERPRISE: "Enterprise — custom" })}
      {input("Reason (audit trail)", "reason", { reason }, (x: any) => setReason(x.reason))}
      <label className="check full"><input type="checkbox" checked={customLimits} onChange={e => setCustomLimits(e.target.checked)} /> Override feature allocation for this tenant (within the selected tier)</label>
      {customLimits && <>
        <label className="field"><span>Max active projects</span><input value={limits.maxActiveProjects} onChange={e => setLimits({ ...limits, maxActiveProjects: e.target.value })} placeholder="Blank = unlimited" /></label>
        <label className="field"><span>Max seats</span><input value={limits.maxSeats} onChange={e => setLimits({ ...limits, maxSeats: e.target.value })} placeholder="Blank = unlimited" /></label>
        <label className="field"><span>Read-only viewer seats</span><input value={limits.viewerSeats} onChange={e => setLimits({ ...limits, viewerSeats: e.target.value })} placeholder="Blank = unlimited" /></label>
        <label className="field"><span>Managed storage (GB)</span><input value={limits.maxManagedStorageGb} onChange={e => setLimits({ ...limits, maxManagedStorageGb: e.target.value })} placeholder="Blank = unlimited" /></label>
        <label className="field"><span>AI report drafts / month</span><input value={limits.monthlyAiDraftCredits} onChange={e => setLimits({ ...limits, monthlyAiDraftCredits: e.target.value })} placeholder="Blank = unlimited" /></label>
        <label className="check full"><input type="checkbox" checked={limits.aiCreditTopUp} onChange={e => setLimits({ ...limits, aiCreditTopUp: e.target.checked })} /> AI credit top-up packs purchasable</label>
        <label className="check full"><input type="checkbox" checked={limits.byoLlmEnabled} onChange={e => setLimits({ ...limits, byoLlmEnabled: e.target.checked })} /> Tenant's own LLM provider (BYO-LLM) allowed</label>
      </>}
    </FormGrid>
    <footer className="modal-actions">
      <button onClick={onReset} disabled={busy}>Reset overrides</button>
      <button onClick={onClose}>Cancel</button>
      <button className="primary" disabled={busy} onClick={() => onSave({ planCode, reason: reason || undefined, customLimits, limits: { maxActiveProjects: limits.maxActiveProjects === "" ? null : Number(limits.maxActiveProjects), maxSeats: limits.maxSeats === "" ? null : Number(limits.maxSeats), viewerSeats: limits.viewerSeats === "" ? null : Number(limits.viewerSeats), maxManagedStorageBytes: storageBytes, monthlyAiDraftCredits: limits.monthlyAiDraftCredits === "" ? null : Number(limits.monthlyAiDraftCredits), aiCreditTopUp: limits.aiCreditTopUp, byoLlmEnabled: limits.byoLlmEnabled } })}>{busy ? "Saving…" : "Apply tier change"}</button>
    </footer>
  </Modal>;
}

/**
 * Phase 22 WS-K item 2 (write half): comped/goodwill pack grants and manual
 * refund override outside the Creem webhook path. Lists every pack for the
 * tenant (any status) via GET /superadmin/billing/credit-packs/:tenantId.
 */
function CreditPacksModal({ row, busy, onClose, onComp, onRefund }: any) {
  const [packs, setPacks] = useState<AnyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [compCredits, setCompCredits] = useState("50");
  const [compReason, setCompReason] = useState("");
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await api(`billing/credit-packs/${row.tenantId}`);
        if (!cancelled) setPacks(Array.isArray(result?.items) ? result.items : []);
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [row.tenantId]);
  return <Modal title={`Credit packs — ${row.name}`} subtitle="One-off AI-draft credit top-ups. A comped pack has no Creem order behind it; a manual refund stops future draw-down but never claws back credits already consumed." onClose={onClose} wide>
    <FormGrid>
      <label className="field"><span>Comp credits</span><input value={compCredits} onChange={e => setCompCredits(e.target.value)} placeholder="e.g. 50" /></label>
      <label className="field"><span>Reason (audit trail)</span><input value={compReason} onChange={e => setCompReason(e.target.value)} placeholder="Optional" /></label>
    </FormGrid>
    <div style={{ marginBottom: 16 }}>
      <button className="primary" disabled={busy || !Number(compCredits)} onClick={() => onComp(Number(compCredits), compReason)}>{busy ? "Granting…" : "Grant comped pack"}</button>
    </div>
    {loading && <p className="help-note">Loading packs…</p>}
    {!loading && packs.length === 0 && <Empty text="No credit packs for this tenant." />}
    {!loading && packs.length > 0 && <table>
      <thead><tr><th>Status</th><th>Kind</th><th>Credits</th><th>Used</th><th>Remaining</th><th>Source</th><th>Purchased</th><th /></tr></thead>
      <tbody>{packs.map((p: AnyRow) => <tr key={p.id}>
        <td><Badge ok={p.status === "ACTIVE"}>{pretty(p.status)}</Badge></td>
        <td>{p.source === "GROWTH_STANDING_BALANCE" ? "Standing balance" : "Top-up"}</td>
        <td>{p.credits}</td>
        <td>{p.used}</td>
        <td>{p.remaining}</td>
        <td>{p.providerOrderId ? <code>{p.providerOrderId}</code> : "Comped"}</td>
        <td>{date(p.purchasedAt)}</td>
        <td>{p.status !== "REFUNDED" && <button className="danger-link" disabled={busy} onClick={() => onRefund(p.id)}>Refund</button>}</td>
      </tr>)}</tbody>
    </table>}
    <footer className="modal-actions"><button onClick={onClose}>Close</button></footer>
  </Modal>;
}

function Audit({ rows }: { rows: AnyRow[] }) { return <Resource title="Platform audit trail" description="Immutable, hash-chained record of every SuperAdmin mutation."><table><thead><tr><th>Time</th><th>Action</th><th>Entity</th><th>Source</th><th>Integrity</th></tr></thead><tbody>{rows.map(r => <tr key={r.id}><td>{date(r.createdAt)}</td><td><strong>{pretty(r.action)}</strong></td><td>{r.entityType}<small>{r.entityId}</small></td><td>{r.ipAddress || "Internal"}</td><td><Badge ok>Hash chained</Badge></td></tr>)}</tbody></table></Resource>; }
function System({ data }: { data: AnyRow }) { return <div className="health-grid">{Object.entries(data).map(([key, value]) => <article className="health-card" key={key}><span className={value === "UP" ? "pulse" : "pulse down"} /><div><h3>{pretty(key)}</h3><p>Platform service</p></div><Badge ok={value === "UP"}>{String(value)}</Badge></article>)}</div>; }

function Kestra({ data }: { data: AnyRow }) {
  const plugins: AnyRow[] = Array.isArray(data.plugins) ? data.plugins : [];
  const flows: AnyRow[] = Array.isArray(data.flows) ? data.flows : [];
  const runtimes: Array<[string, string]> = [["kestra", data.kestra], ["workers", data.workers]];
  return <div className="kestra-wrap">
    <section className="panel resource">
      <div className="panel-title"><div><h2>Orchestration runtimes</h2><p>Loopback Kestra and worker health</p></div></div>
      <div className="health-grid">{runtimes.map(([key, value]) => <article className="health-card" key={key}><span className={value === "UP" ? "pulse" : "pulse down"} /><div><h3>{pretty(key)}</h3><p>Platform service</p></div><Badge ok={value === "UP"}>{String(value ?? "UNKNOWN")}</Badge></article>)}</div>
    </section>
    <section className="panel resource">
      <div className="panel-title"><div><h2>Free Kestra plugins</h2><p>Provisioned open-source plugins and the flows that use them</p></div></div>
      <div className="table-wrap"><table><thead><tr><th>Plugin</th><th>Category</th><th>Purpose</th><th>Flow</th><th>Gated</th></tr></thead><tbody>{plugins.map((p: AnyRow) => <tr key={p.id}><td><strong>{p.name}</strong><small>{p.id}</small></td><td>{p.category}</td><td>{p.purpose}</td><td><code>{p.flow}</code></td><td><Badge ok={!p.gated}>{p.gated ? "Requires credentials" : "Configured"}</Badge></td></tr>)}</tbody></table></div>
    </section>
    <section className="panel resource">
      <div className="panel-title"><div><h2>Flows</h2><p>Status reflects staging; production execution must still be verified</p></div></div>
      <div className="table-wrap"><table><thead><tr><th>Flow</th><th>Plugin</th><th>Deployment status</th></tr></thead><tbody>{flows.map((f: AnyRow) => <tr key={f.id}><td><code>{f.id}</code></td><td>{pretty(f.plugin)}</td><td><Badge ok={!f.gated}>{f.gated ? "Staged (gated)" : "Deployed by sync-flows.sh"}</Badge></td></tr>)}</tbody></table></div>
    </section>
    <section className="panel resource">
      <div className="panel-title"><div><h2>Google Cloud provisioning</h2><p>Credentials needed for Drive-link storage and Google OCR</p></div></div>
      <div className="table-wrap"><table><thead><tr><th>Credential</th><th>Used for</th><th>Status</th></tr></thead><tbody>
        <tr><td><strong>OAuth client</strong><small>google-drive-oauth</small></td><td>Tenant Drive connect (onboarding), read + share scopes</td><td><Badge ok={data.oauthConfigured}>{data.oauthConfigured ? "Configured" : "Add in Inbound connectors"}</Badge></td></tr>
        <tr><td><strong>Service account</strong><small>google-drive</small></td><td>Kestra Drive folder trigger + read access grant</td><td><Badge ok={data.serviceAccountConfigured}>{data.serviceAccountConfigured ? "Configured" : "Add in Inbound connectors"}</Badge></td></tr>
        <tr><td><strong>Google OCR</strong><small>Document AI / Vision</small></td><td>AI tagging by file ID (no byte copy)</td><td><Badge ok={data.ocrConfigured}>{data.ocrConfigured ? "Configured" : "Requires GCP project"}</Badge></td></tr>
      </tbody></table></div>
    </section>
  </div>;
}

function Resource({ title, description, add, onAdd, children }: any) { return <section className="panel resource"><div className="panel-title"><div><h2>{title}</h2><p>{description}</p></div>{add && <button className="primary" onClick={onAdd}>＋ {add}</button>}</div><div className="table-wrap">{children}</div></section>; }
function Actions({ edit, remove }: { edit: () => void; remove: () => void }) { return <div className="row-actions"><button onClick={edit}>Edit</button><button className="danger-link" onClick={remove}>Delete</button></div>; }
function Badge({ ok, children }: { ok?: boolean; children: React.ReactNode }) { return <span className={`badge ${ok ? "good" : "neutral"}`}>{children}</span>; }
function Empty({ text }: { text: string }) { return <div className="empty"><span>＋</span><h3>{text}</h3><p>Use the button above to create the first configuration.</p></div>; }

function TenantModal({ row, busy, onClose, onSave }: any) {
  const [form, setForm] = useState({ name: row?.name || "", tenantId: row?.tenantId || "", organizationType: row?.organizationType || "NGO", country: row?.country || "", sectors: safeJson(row?.sectors, []).join(", "), contactName: row?.contactName || "", contactEmail: row?.contactEmail || "", website: row?.website || "", defaultLanguage: row?.defaultLanguage || "en", dataResidency: row?.dataResidency || "DEFAULT", aiEnabled: row?.aiEnabled ?? true });
  return <Modal title={row ? "Edit tenant" : "Create tenant"} subtitle="Organization profile and platform policy" onClose={onClose}><FormGrid>{input("Organization name", "name", form, setForm)}{input("Tenant ID", "tenantId", form, setForm, row ? { disabled: true } : { placeholder: "example-foundation" })}{select("Organization type", "organizationType", ["NGO", "INGO", "UN_AGENCY", "GOVERNMENT", "FOUNDATION", "OTHER"], form, setForm)}{input("Country", "country", form, setForm)}{input("Contact name", "contactName", form, setForm)}{input("Contact email", "contactEmail", form, setForm, { type: "email" })}{input("Website", "website", form, setForm, { type: "url" })}{select("Data residency", "dataResidency", ["DEFAULT", "EU", "US", "AFRICA", "ASIA"], form, setForm)}<label className="field full"><span>Sectors <em>comma separated</em></span><input value={form.sectors} onChange={e => setForm({ ...form, sectors: e.target.value })} /></label><label className="check full"><input type="checkbox" checked={form.aiEnabled} onChange={e => setForm({ ...form, aiEnabled: e.target.checked })} /> Enable AI features for this tenant</label></FormGrid><ModalActions busy={busy} onClose={onClose} onSave={() => onSave({ ...form, sectors: form.sectors.split(",").map((x: string) => x.trim()).filter(Boolean) })} label={row ? "Save changes" : "Create tenant"} /></Modal>;
}

function TenantDeleteModal({ row, busy, onClose, onDelete }: any) {
  const [preview, setPreview] = useState<AnyRow | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api(`tenants/${row.id}/deletion-preview`).then((p: AnyRow) => { setPreview(p); setSelected(Object.fromEntries(p.categories.map((c: AnyRow) => [c.key, c.defaultDelete]))); }).catch((e: Error) => setError(e.message));
  }, [row.id]);
  const chosen = Object.keys(selected).filter(k => selected[k]);
  const rows = preview ? preview.categories.filter((c: AnyRow) => c.total > 0 || c.key === "projects") : [];
  return <Modal title={`Force delete — ${row.name}`} subtitle="Tick what to permanently delete; untick anything to keep. This cannot be undone." onClose={onClose} wide>
    {error && <div className="test-result fail">{error}</div>}
    {!preview && !error && <p className="help-note">Scanning tenant data…</p>}
    {preview && <>
      <div className="table-wrap"><table><thead><tr><th style={{ width: 40 }}>Delete</th><th>Data</th><th>Records</th></tr></thead><tbody>{rows.map((c: AnyRow) => <tr key={c.key}>
        <td><input type="checkbox" checked={!!selected[c.key]} onChange={e => setSelected({ ...selected, [c.key]: e.target.checked })} /></td>
        <td><strong>{c.label}</strong><small>{c.description}</small>{c.tables.length > 0 && <small>{c.tables.map((t: AnyRow) => `${t.table} (${t.count})`).join(" · ")}</small>}</td>
        <td>{c.total}</td></tr>)}</tbody></table></div>
      <div className="security-note">{preview.external.join(" ")} The organization record itself is removed only when both “Users” and “Projects & other data” are ticked.</div>
      <FormGrid><label className="field full"><span>Type <strong>{row.name}</strong> to confirm</span><input value={confirmation} onChange={e => setConfirmation(e.target.value)} /></label></FormGrid>
    </>}
    <footer className="modal-actions"><button onClick={onClose}>Cancel</button><button className="primary" style={{ background: "var(--red)" }} disabled={busy || !preview || confirmation !== row.name || chosen.length === 0} onClick={() => onDelete({ confirmation, force: true, categories: chosen })}>{busy ? "Deleting…" : `Delete ${chosen.length} selected`}</button></footer>
  </Modal>;
}

function UserModal({ row, tenants, busy, onClose, onSave }: any) {
  const [form, setForm] = useState({ tenantId: row?.tenantId || tenants[0]?.tenantId || "", name: row?.name || "", email: row?.email || "", role: row?.role || "VIEWER", status: row?.status || "ACTIVE", password: "" });
  return <Modal title={row ? "Edit user" : "Create user"} subtitle="Tenant membership, role and account access" onClose={onClose}><FormGrid>{select("Tenant", "tenantId", tenants.map((x: AnyRow) => x.tenantId), form, setForm, row ? true : false, Object.fromEntries(tenants.map((x: AnyRow) => [x.tenantId, x.name])))}{input("Full name", "name", form, setForm)}{input("Email address", "email", form, setForm, { type: "email", disabled: Boolean(row) })}{select("Role", "role", roles, form, setForm)}{select("Account status", "status", ["ACTIVE", "INVITED", "SUSPENDED", "REMOVED"], form, setForm)}{!row && input("Temporary password", "password", form, setForm, { type: "password", placeholder: "Minimum 12 characters" })}</FormGrid><ModalActions busy={busy} onClose={onClose} onSave={() => onSave(row ? { name: form.name, role: form.role, status: form.status } : form)} label={row ? "Save user" : "Create user"} /></Modal>;
}

const resetReasons = ["User forgot password", "Account locked out", "Security precaution", "Onboarding new user", "Offboarding / handover", "Other (describe)"];

function passwordStrength(value: string): { score: number; label: string } {
  let score = 0;
  if (value.length >= 12) score += 1;
  if (value.length >= 16) score += 1;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score += 1;
  if (/[0-9]/.test(value)) score += 1;
  if (/[^A-Za-z0-9]/.test(value)) score += 1;
  const labels = ["Too short", "Weak", "Fair", "Good", "Strong", "Excellent"];
  return { score, label: labels[Math.min(score, 5)] as string };
}

function UserResetPasswordModal({ row, busy, onClose }: any) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [reasonChoice, setReasonChoice] = useState(resetReasons[0]);
  const [reasonText, setReasonText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const strength = passwordStrength(password);
  const reason = reasonChoice === "Other (describe)" ? reasonText.trim() : reasonChoice;

  async function submit() {
    setError(null);
    if (password.length < 12) { setError("Password must be at least 12 characters."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }
    if (!reason) { setError("A reason is required for the audit trail."); return; }
    setSaving(true);
    try {
      await api(`users/${row.id}`, { method: "PATCH", body: JSON.stringify({ password, reason }) });
      setDone(true);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setSaving(false); }
  }

  async function copy() {
    try { await navigator.clipboard.writeText(password); setCopied(true); window.setTimeout(() => setCopied(false), 2000); } catch { /* clipboard unavailable */ }
  }

  if (done) return <Modal title="Password reset" subtitle={`${row.email} can now sign in with the new password`} onClose={onClose}>
    <div className="security-note">Share this password with the user through a secure channel. It will not be shown again.</div>
    <div className="form-grid"><label className="field full"><span>New password</span>
      <div style={{ display: "flex", gap: 8 }}>
        <input type={revealed ? "text" : "password"} readOnly value={password} onFocus={e => e.currentTarget.select()} style={{ flex: 1 }} />
        <button onClick={() => setRevealed(!revealed)}>{revealed ? "Hide" : "Show"}</button>
        <button className="primary" onClick={copy}>{copied ? "Copied" : "Copy"}</button>
      </div>
    </label></div>
    <ModalActions busy={false} onClose={onClose} onSave={onClose} label="Done" />
  </Modal>;

  return <Modal title="Reset password" subtitle={`Set a new password for ${row.email}`} onClose={onClose}>
    <FormGrid>
      <label className="field"><span>New password</span><input type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Minimum 12 characters" /></label>
      <label className="field"><span>Confirm password</span><input type="password" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Repeat the password" /></label>
      <div className="field full"><span>Strength <strong>{password ? strength.label : ""}</strong></span>
        <div style={{ display: "flex", gap: 4 }}>{[0, 1, 2, 3, 4].map(i => <div key={i} style={{ height: 6, flex: 1, borderRadius: 3, background: password && i < strength.score ? (strength.score <= 2 ? "#dc2626" : strength.score <= 3 ? "#d97706" : "#16a34a") : "rgba(148,163,184,.3)" }} />)}</div>
      </div>
      <label className="field"><span>Reason (audit trail)</span>
        <select value={reasonChoice} onChange={e => setReasonChoice(e.target.value)}>{resetReasons.map(r => <option key={r} value={r}>{r}</option>)}</select>
      </label>
      {reasonChoice === "Other (describe)" && <label className="field"><span>Describe the reason</span><input value={reasonText} onChange={e => setReasonText(e.target.value)} maxLength={200} placeholder="Required" /></label>}
    </FormGrid>
    <div className="security-note">🔒 The password is stored hashed. The reset is recorded in the audit trail with your reason and this action invalidates the user's existing sessions.</div>
    {error && <div className="test-result fail">{error}</div>}
    <ModalActions busy={saving} onClose={onClose} onSave={submit} label="Reset password" />
  </Modal>;
}

function ProviderModal({ group, row, tenants, busy, onClose, onSave }: any) {
  const initialConfig = safeJson(row?.configurationJson, {}), [provider, setProvider] = useState(row?.provider || group.providers[0]);
  const [base, setBase] = useState({ displayName: row?.displayName || "", scopeType: row?.scopeType || "GLOBAL", scopeId: row?.scopeId || "", enabled: row?.enabled ?? true });
  const [configuration, setConfiguration] = useState<Record<string, string>>(initialConfig);
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const spec = fields[provider] || { config: [], secrets: [] };
  return <Modal title={row ? "Edit configuration" : "Add provider"} subtitle="Credentials are encrypted before they are stored" onClose={onClose} wide><FormGrid>{select("Provider", "provider", [...group.providers], { provider }, (x: any) => { setProvider(x.provider); setConfiguration({}); setSecrets({}); }, Boolean(row))}{input("Display name", "displayName", base, setBase, { placeholder: "e.g. Primary production provider" })}{select("Scope", "scopeType", ["GLOBAL", "TENANT"], base, setBase)}{base.scopeType === "TENANT" && select("Tenant", "scopeId", tenants.map((x: AnyRow) => x.tenantId), base, setBase, false, Object.fromEntries(tenants.map((x: AnyRow) => [x.tenantId, x.name])))}<div className="section-label full">Configuration</div>{spec.config.map(name => input(pretty(name), name, configuration, setConfiguration, { placeholder: placeholder(name, provider) }))}<div className="section-label full">Credentials <span>encrypted · never displayed again</span></div>{spec.secrets.map(name => <label className={`field ${name.toLowerCase().includes("json") ? "full" : ""}`} key={name}><span>{pretty(name)} {row?.secretConfigured && <em>leave blank to keep current</em>}</span>{name.toLowerCase().includes("json") ? <textarea rows={5} value={secrets[name] || ""} onChange={e => setSecrets({ ...secrets, [name]: e.target.value })} /> : <input type="password" autoComplete="new-password" value={secrets[name] || ""} onChange={e => setSecrets({ ...secrets, [name]: e.target.value })} placeholder={row?.secretConfigured ? "•••••••• (unchanged)" : "Required"} />}</label>)}<label className="check full"><input type="checkbox" checked={base.enabled} onChange={e => setBase({ ...base, enabled: e.target.checked })} /> Enable this configuration immediately</label></FormGrid><div className="security-note">🔒 Secrets are protected with AES-256-GCM. Saved credentials cannot be viewed or copied back out of DonorDesk.</div><ModalActions busy={busy} onClose={onClose} onSave={() => onSave({ id: row?.id, category: group.category, provider, ...base, scopeId: base.scopeType === "GLOBAL" ? "GLOBAL" : base.scopeId, configuration, secrets: Object.fromEntries(Object.entries(secrets).filter(([, v]) => v)) })} label={row ? "Save and rotate" : "Encrypt and save"} /></Modal>;
}

function Modal({ title, subtitle, onClose, wide, children }: any) { return <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}><section className={`modal ${wide ? "wide" : ""}`}><header><div><h2>{title}</h2><p>{subtitle}</p></div><button className="close" onClick={onClose}>×</button></header>{children}</section></div>; }
function FormGrid({ children }: { children: React.ReactNode }) { return <div className="form-grid">{children}</div>; }
function ModalActions({ busy, onClose, onSave, label }: any) { return <footer className="modal-actions"><button onClick={onClose}>Cancel</button><button className="primary" disabled={busy} onClick={onSave}>{busy ? "Saving…" : label}</button></footer>; }

function input(label: string, name: string, form: AnyRow, setForm: any, props: AnyRow = {}) { return <label className="field" key={name}><span>{label}</span><input value={form[name] ?? ""} onChange={e => setForm({ ...form, [name]: e.target.value })} {...props} /></label>; }
function select(label: string, name: string, options: string[], form: AnyRow, setForm: any, disabled = false, labels: AnyRow = {}) { return <label className="field" key={name}><span>{label}</span><select disabled={disabled} value={form[name] ?? ""} onChange={e => setForm({ ...form, [name]: e.target.value })}>{options.map(x => <option value={x} key={x}>{labels[x] || pretty(x)}</option>)}</select></label>; }
function safeJson(value: any, fallback: any) { try { return typeof value === "string" ? JSON.parse(value) : value || fallback; } catch { return fallback; } }
function configurationPayload(row: AnyRow, patch: AnyRow) { return { id: row.id, scopeType: row.scopeType, scopeId: row.scopeId || "GLOBAL", category: row.category, provider: row.provider, displayName: row.displayName, enabled: row.enabled, configuration: safeJson(row.configurationJson, {}), ...patch }; }
function pretty(value: string) { return String(value || "").replace(/[._-]/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/\b\w/g, x => x.toUpperCase()); }
function date(value: any) { return value ? new Date(value).toLocaleString() : "Never"; }
function bytes(value: any) { if (value == null || value === "" || value === "null") return "Unlimited"; const n = Number(value); if (!Number.isFinite(n) || n <= 0) return "0 B"; const units = ["B", "KB", "MB", "GB", "TB"]; let i = 0; let v = n; while (v >= 1024 && i < units.length - 1) { v /= 1024; i += 1; } return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`; }
function providerIcon(provider: string) { return ({ openai: "◎", anthropic: "C", gemini: "G✦", deepseek: "D", minimax: "M", glm: "Z", brevo: "B", postmark: "P", resend: "R", smtp: "✉", "cloudflare-r2": "☁", "backblaze-b2": "B2", "aws-s3": "S3",   kobotoolbox: "K", "odk-central": "O", "google-drive": "G", "google-drive-oauth": "GO", sharepoint: "S" } as AnyRow)[provider] || "◆"; }
// Model hints for the LLM form. Gemini IDs change often: run "Test connection"
// to list the models the key can use.
const MODEL_HINTS: Record<string, string> = {
  anthropic: "claude-opus-5 (default) · claude-sonnet-5 · claude-haiku-4-5 (cheapest)",
  gemini: "Required — e.g. a current gemini-*-flash model; Test connection lists them",
  deepseek: "Current model ID — Test connection lists them (deepseek-chat alias reportedly retired)",
  minimax: "e.g. MiniMax-M3",
  glm: "glm-4.6 (default) · glm-4.5 · glm-4.5-air (cheaper) · glm-4.5-flash (free tier)",
  openai: "e.g. gpt-4o-mini",
};
function placeholder(name: string, provider?: string) { if (name === "model" && provider && MODEL_HINTS[provider]) return MODEL_HINTS[provider]; if (name === "effort") return "Optional: low · medium · high (Claude only; not Haiku 4.5)"; return ({ model: "Provider model name", baseUrl: "Optional custom API URL", senderEmail: "notifications@example.org", endpoint: "https://...", bucket: "Bucket name", region: "Region", prefix: "donordesk/", port: "587", schedule: "0 */6 * * *", tenantId: "Destination tenant" } as AnyRow)[name] || ""; }

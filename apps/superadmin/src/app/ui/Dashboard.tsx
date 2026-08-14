"use client";

import { useEffect, useMemo, useState } from "react";

type Tab = "overview" | "tenants" | "users" | "ai" | "email" | "storage" | "backups" | "connectors" | "kestra" | "audit" | "system";
type AnyRow = Record<string, any>;

const roles = ["ADMIN", "PROJECT_MANAGER", "ME_OFFICER", "GRANTS_OFFICER", "FIELD_OFFICER", "COMPLIANCE_OFFICER", "VIEWER"];
const providerGroups = {
  ai: { category: "LLM", providers: ["openai", "anthropic", "deepseek", "minimax"] },
  email: { category: "EMAIL", providers: ["brevo", "postmark", "resend", "ses", "smtp"] },
  storage: { category: "OBJECT_STORAGE", providers: ["cloudflare-r2", "backblaze-b2", "aws-s3", "s3-compatible"] },
  backups: { category: "BACKUP", providers: ["cloudflare-r2", "backblaze-b2", "aws-s3", "s3-compatible"] },
  connectors: { category: "CONNECTOR", providers: ["kobotoolbox", "odk-central", "google-drive", "google-drive-oauth", "sharepoint", "s3-drop-folder"] },
} as const;

const fields: Record<string, { config: string[]; secrets: string[] }> = {
  openai: { config: ["model", "baseUrl", "organizationId"], secrets: ["apiKey"] },
  anthropic: { config: ["model", "baseUrl"], secrets: ["apiKey"] },
  deepseek: { config: ["model", "baseUrl"], secrets: ["apiKey"] },
  minimax: { config: ["model", "baseUrl", "groupId"], secrets: ["apiKey"] },
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
  const response = await fetch(`/api/control/${path}`, { ...init, headers: { "content-type": "application/json", ...init?.headers } });
  if (response.status === 401) { location.reload(); throw new Error("Session expired"); }
  const data = response.status === 204 ? null : await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.message || data?.title || "Request failed");
  return data;
}

export function Dashboard() {
  const [tab, setTab] = useState<Tab>("overview");
  const [data, setData] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [modal, setModal] = useState<null | { kind: "tenant" | "user" | "provider"; row?: AnyRow }>(null);
  const [tenants, setTenants] = useState<AnyRow[]>([]);

  const endpoint = tab === "ai" || tab === "email" || tab === "storage" || tab === "backups" || tab === "connectors" ? "configurations" : tab;  async function load() {
    try {
      const result = await api(endpoint);
      setData(result);
      if (tab === "users" || tab === "overview") setTenants(await api("tenants"));
    } catch (error) { flash("error", String(error)); }
  }
  useEffect(() => { void load(); }, [tab]);
  function flash(type: "ok" | "error", text: string) { setNotice({ type, text }); window.setTimeout(() => setNotice(null), 5000); }
  async function action(task: () => Promise<any>, message: string) { setBusy(true); try { await task(); flash("ok", message); setModal(null); await load(); } catch (e) { flash("error", e instanceof Error ? e.message : String(e)); } finally { setBusy(false); } }
  function changeTab(next: Tab) { setData(null); setModal(null); setTab(next); }

  const navigation: Array<[Tab, string, string]> = [
    ["overview", "Overview", "⌂"], ["tenants", "Tenants", "▦"], ["users", "Users", "♙"],
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
      {tab === "tenants" && <Tenants rows={Array.isArray(data) ? data : []} onAdd={() => setModal({ kind: "tenant" })} onEdit={(row: AnyRow) => setModal({ kind: "tenant", row })} onDelete={(row: AnyRow) => action(() => api(`tenants/${row.id}`, { method: "DELETE", body: JSON.stringify({ confirmation: prompt(`Type ${row.name} to permanently delete this empty tenant`) || "" }) }), "Tenant deleted")} />}
      {tab === "users" && <Users rows={Array.isArray(data) ? data : []} tenants={tenants} onAdd={() => setModal({ kind: "user" })} onEdit={(row: AnyRow) => setModal({ kind: "user", row })} onReset={(row: AnyRow) => { const password = prompt(`Enter a new password (minimum 12 characters) for ${row.email}`); if (password) void action(() => api(`users/${row.id}`, { method: "PATCH", body: JSON.stringify({ password }) }), "Password reset successfully"); }} onDelete={(row: AnyRow) => confirm(`Delete ${row.email}? This cannot be undone.`) && void action(() => api(`users/${row.id}`, { method: "DELETE" }), "User deleted")} />}
      {(tab in providerGroups) && <Providers tab={tab as keyof typeof providerGroups} rows={(Array.isArray(data) ? data : []).filter((x: AnyRow) => x.category === providerGroups[tab as keyof typeof providerGroups].category)} onAdd={() => setModal({ kind: "provider" })} onEdit={(row: AnyRow) => setModal({ kind: "provider", row })} onTest={(row: AnyRow) => action(() => api(`configurations/${row.id}/test`, { method: "POST" }), "Connection test completed")} onToggle={(row: AnyRow) => action(() => api("configurations", { method: "PUT", body: JSON.stringify(configurationPayload(row, { enabled: !row.enabled })) }), row.enabled ? "Provider disabled" : "Provider enabled")} onDelete={(row: AnyRow) => confirm(`Delete ${row.displayName}? Encrypted credentials will also be removed.`) && void action(() => api(`configurations/${row.id}`, { method: "DELETE" }), "Configuration deleted")} />}
      {tab === "audit" && <Audit rows={Array.isArray(data) ? data : []} />}
      {tab === "kestra" && <Kestra data={data || {}} />}
      {tab === "system" && <System data={data || {}} />}
    </main>
    {modal?.kind === "tenant" && <TenantModal row={modal.row} busy={busy} onClose={() => setModal(null)} onSave={(value: AnyRow) => action(() => api(modal.row ? `tenants/${modal.row.id}` : "tenants", { method: modal.row ? "PATCH" : "POST", body: JSON.stringify(value) }), modal.row ? "Tenant updated" : "Tenant created")} />}
    {modal?.kind === "user" && <UserModal row={modal.row} tenants={tenants} busy={busy} onClose={() => setModal(null)} onSave={(value: AnyRow) => action(() => api(modal.row ? `users/${modal.row.id}` : "users", { method: modal.row ? "PATCH" : "POST", body: JSON.stringify(value) }), modal.row ? "User updated" : "User created")} />}
    {modal?.kind === "provider" && <ProviderModal group={providerGroups[tab as keyof typeof providerGroups]} row={modal.row} tenants={tenants} busy={busy} onClose={() => setModal(null)} onSave={(value: AnyRow) => action(() => api("configurations", { method: "PUT", body: JSON.stringify(value) }), modal.row ? "Configuration updated and secrets rotated" : "Credentials encrypted and saved")} />}
  </div>;
}

function Overview({ data, onNavigate }: { data: any; onNavigate: (tab: Tab) => void }) {
  const cards: Array<[string, any, Tab, string]> = [["Tenants", data?.tenants ?? "—", "tenants", "Organizations"], ["Users", data?.users ?? "—", "users", "Across all tenants"], ["Integrations", data?.configurations ?? "—", "ai", "Encrypted configurations"], ["Backup runs", data?.backups?.length ?? 0, "backups", "Recent activity"]];
  return <><section className="hero"><div><span className="eyebrow">PLATFORM OPERATIONS</span><h2>Everything that runs DonorDesk,<br />under your control.</h2><p>Manage tenants, identities, AI, communications, storage, backups and data ingestion from one secured console.</p></div><span className="health-orb">✓<small>All systems<br />operational</small></span></section><div className="stat-grid">{cards.map(([label, value, target, sub]) => <button className="stat-card" onClick={() => onNavigate(target)} key={label}><small>{label}</small><strong>{value}</strong><span>{sub} →</span></button>)}</div><section className="panel"><div className="panel-title"><div><h3>Quick actions</h3><p>Common platform administration tasks</p></div></div><div className="quick-grid">{[["Add tenant", "tenants"], ["Create user", "users"], ["Configure an LLM", "ai"], ["Set up backup", "backups"], ["Connect data source", "connectors"]].map(([label, target]) => <button key={label} onClick={() => onNavigate(target as Tab)}>＋ {label}</button>)}</div></section></>;
}

function Tenants({ rows, onAdd, onEdit, onDelete }: any) { return <Resource title="Tenant organizations" description="Create and manage every organization using DonorDesk." add="Add tenant" onAdd={onAdd}><table><thead><tr><th>Organization</th><th>Tenant ID</th><th>Country</th><th>Contact</th><th>Users</th><th>Projects</th><th>AI</th><th /></tr></thead><tbody>{rows.map((r: AnyRow) => <tr key={r.id}><td><strong>{r.name}</strong><small>{r.organizationType}</small></td><td><code>{r.tenantId}</code></td><td>{r.country}</td><td>{r.contactEmail}</td><td>{r._count?.users ?? 0}</td><td>{r._count?.projects ?? 0}</td><td><Badge ok={r.aiEnabled}>{r.aiEnabled ? "Enabled" : "Disabled"}</Badge></td><td><Actions edit={() => onEdit(r)} remove={() => onDelete(r)} /></td></tr>)}</tbody></table></Resource>; }

function Users({ rows, tenants, onAdd, onEdit, onReset, onDelete }: any) { const names = Object.fromEntries(tenants.map((x: AnyRow) => [x.tenantId, x.name])); return <Resource title="Users and access" description="Control identities, tenant membership, roles, status and credentials." add="Create user" onAdd={onAdd}><table><thead><tr><th>User</th><th>Tenant</th><th>Role</th><th>Status</th><th>Last login</th><th /></tr></thead><tbody>{rows.map((r: AnyRow) => <tr key={r.id}><td><strong>{r.name}</strong><small>{r.email}</small></td><td>{names[r.tenantId] || r.tenantId}</td><td>{pretty(r.role)}</td><td><Badge ok={r.status === "ACTIVE"}>{pretty(r.status)}</Badge></td><td>{date(r.lastLoginAt)}</td><td><div className="row-actions"><button onClick={() => onReset(r)}>Reset password</button><Actions edit={() => onEdit(r)} remove={() => onDelete(r)} /></div></td></tr>)}</tbody></table></Resource>; }

function Providers({ tab, rows, onAdd, onEdit, onTest, onToggle, onDelete }: any) { const allMeta: Record<string, string[]> = { ai: ["AI and language models", "Configure models used for drafting, tagging and analysis.", "Add LLM provider"], email: ["Transactional email", "Control outbound invitations, alerts and notifications.", "Add email provider"], storage: ["Object storage", "Manage evidence and export storage destinations.", "Add storage"], backups: ["Encrypted off-host backups", "Configure independent disaster-recovery destinations.", "Add backup target"], connectors: ["Inbound data connectors", "Ingest evidence and field data from external systems.", "Add connector"] }; const meta = allMeta[String(tab)]!; return <Resource title={meta[0]} description={meta[1]} add={meta[2]} onAdd={onAdd}><div className="provider-grid">{rows.length === 0 && <Empty text="No provider configured yet." />}{rows.map((r: AnyRow) => <article className="provider-card" key={r.id}><div className="provider-head"><span className="provider-icon">{providerIcon(r.provider)}</span><div><h3>{r.displayName}</h3><p>{pretty(r.provider)} · {r.scopeType === "TENANT" ? `Tenant ${r.scopeId}` : "All tenants"}</p></div><Badge ok={r.enabled}>{r.enabled ? "Active" : "Disabled"}</Badge></div><div className="provider-meta"><span>Credentials <strong>{r.secretConfigured ? "✓ Encrypted" : "Not set"}</strong></span><span>Last test <strong>{r.lastTestStatus || "Never"}</strong></span><span>Updated <strong>{date(r.updatedAt)}</strong></span></div>{r.lastTestMessage && <p className={`test-result ${r.lastTestStatus === "SUCCESS" ? "pass" : "fail"}`}>{r.lastTestMessage}</p>}<div className="card-actions"><button onClick={() => onTest(r)}>Test connection</button><button onClick={() => onToggle(r)}>{r.enabled ? "Disable" : "Enable"}</button><button onClick={() => onEdit(r)}>Edit / rotate keys</button><button className="danger-link" onClick={() => onDelete(r)}>Delete</button></div></article>)}</div></Resource>; }

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

function UserModal({ row, tenants, busy, onClose, onSave }: any) {
  const [form, setForm] = useState({ tenantId: row?.tenantId || tenants[0]?.tenantId || "", name: row?.name || "", email: row?.email || "", role: row?.role || "VIEWER", status: row?.status || "ACTIVE", password: "" });
  return <Modal title={row ? "Edit user" : "Create user"} subtitle="Tenant membership, role and account access" onClose={onClose}><FormGrid>{select("Tenant", "tenantId", tenants.map((x: AnyRow) => x.tenantId), form, setForm, row ? true : false, Object.fromEntries(tenants.map((x: AnyRow) => [x.tenantId, x.name])))}{input("Full name", "name", form, setForm)}{input("Email address", "email", form, setForm, { type: "email", disabled: Boolean(row) })}{select("Role", "role", roles, form, setForm)}{select("Account status", "status", ["ACTIVE", "INVITED", "SUSPENDED", "REMOVED"], form, setForm)}{!row && input("Temporary password", "password", form, setForm, { type: "password", placeholder: "Minimum 12 characters" })}</FormGrid><ModalActions busy={busy} onClose={onClose} onSave={() => onSave(row ? { name: form.name, role: form.role, status: form.status } : form)} label={row ? "Save user" : "Create user"} /></Modal>;
}

function ProviderModal({ group, row, tenants, busy, onClose, onSave }: any) {
  const initialConfig = safeJson(row?.configurationJson, {}), [provider, setProvider] = useState(row?.provider || group.providers[0]);
  const [base, setBase] = useState({ displayName: row?.displayName || "", scopeType: row?.scopeType || "GLOBAL", scopeId: row?.scopeId || "", enabled: row?.enabled ?? true });
  const [configuration, setConfiguration] = useState<Record<string, string>>(initialConfig);
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const spec = fields[provider] || { config: [], secrets: [] };
  return <Modal title={row ? "Edit configuration" : "Add provider"} subtitle="Credentials are encrypted before they are stored" onClose={onClose} wide><FormGrid>{select("Provider", "provider", [...group.providers], { provider }, (x: any) => { setProvider(x.provider); setConfiguration({}); setSecrets({}); }, Boolean(row))}{input("Display name", "displayName", base, setBase, { placeholder: "e.g. Primary production provider" })}{select("Scope", "scopeType", ["GLOBAL", "TENANT"], base, setBase)}{base.scopeType === "TENANT" && select("Tenant", "scopeId", tenants.map((x: AnyRow) => x.tenantId), base, setBase, false, Object.fromEntries(tenants.map((x: AnyRow) => [x.tenantId, x.name])))}<div className="section-label full">Configuration</div>{spec.config.map(name => input(pretty(name), name, configuration, setConfiguration, { placeholder: placeholder(name) }))}<div className="section-label full">Credentials <span>encrypted · never displayed again</span></div>{spec.secrets.map(name => <label className={`field ${name.toLowerCase().includes("json") ? "full" : ""}`} key={name}><span>{pretty(name)} {row?.secretConfigured && <em>leave blank to keep current</em>}</span>{name.toLowerCase().includes("json") ? <textarea rows={5} value={secrets[name] || ""} onChange={e => setSecrets({ ...secrets, [name]: e.target.value })} /> : <input type="password" autoComplete="new-password" value={secrets[name] || ""} onChange={e => setSecrets({ ...secrets, [name]: e.target.value })} placeholder={row?.secretConfigured ? "•••••••• (unchanged)" : "Required"} />}</label>)}<label className="check full"><input type="checkbox" checked={base.enabled} onChange={e => setBase({ ...base, enabled: e.target.checked })} /> Enable this configuration immediately</label></FormGrid><div className="security-note">🔒 Secrets are protected with AES-256-GCM. Saved credentials cannot be viewed or copied back out of DonorDesk.</div><ModalActions busy={busy} onClose={onClose} onSave={() => onSave({ id: row?.id, category: group.category, provider, ...base, scopeId: base.scopeType === "GLOBAL" ? "GLOBAL" : base.scopeId, configuration, secrets: Object.fromEntries(Object.entries(secrets).filter(([, v]) => v)) })} label={row ? "Save and rotate" : "Encrypt and save"} /></Modal>;
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
function providerIcon(provider: string) { return ({ openai: "◎", anthropic: "A", deepseek: "D", minimax: "M", brevo: "B", postmark: "P", resend: "R", smtp: "✉", "cloudflare-r2": "☁", "backblaze-b2": "B2", "aws-s3": "S3",   kobotoolbox: "K", "odk-central": "O", "google-drive": "G", "google-drive-oauth": "GO", sharepoint: "S" } as AnyRow)[provider] || "◆"; }
function placeholder(name: string) { return ({ model: "Provider model name", baseUrl: "Optional custom API URL", senderEmail: "notifications@example.org", endpoint: "https://...", bucket: "Bucket name", region: "Region", prefix: "donordesk/", port: "587", schedule: "0 */6 * * *", tenantId: "Destination tenant" } as AnyRow)[name] || ""; }

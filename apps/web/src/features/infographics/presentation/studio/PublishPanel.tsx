"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/data/Badge";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { CommentsDisclosure } from "@/features/comments/presentation/CommentsDisclosure";
import { EXPORT_INFO, SCALE_INFO, STATUS_INFO, VARIANT_INFO } from "../../domain/studio-copy";
import { studio, type CheckResult, type ExportRow, type ShareLinkRow } from "../../domain/studio-api";
import { PanelHeading } from "./primitives";

type Status = "DRAFT" | "IN_REVIEW" | "APPROVED";

interface Props {
  designId: string;
  projectId: string;
  status: Status;
  onStatus: (status: Status) => void;
  profile: string | undefined;
  dirty: boolean;
  check: CheckResult | undefined;
  canEdit: boolean;
  canExport: boolean;
  canApprove: boolean;
  /** Saves any unsaved edits first and returns whether it worked. */
  ensureSaved: () => Promise<boolean>;
  /** The map the browser resolved, sent along with an export. */
  mapInputs: () => { mapPoints: unknown[]; mapShapes: unknown[] };
  onSaveAsTemplate: () => void;
  scope?: "PROJECT" | "PORTFOLIO";
}

const when = (iso: string): string => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** Review, publish, share: the steps from a finished design to a file other people can use. */
export function PublishPanel({ designId, projectId, status, onStatus, profile, dirty, check, canEdit, canExport, canApprove, ensureSaved, mapInputs, onSaveAsTemplate, scope = "PROJECT" }: Props) {
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | undefined>();
  const [busy, setBusy] = useState<string | undefined>();
  const [format, setFormat] = useState<(typeof EXPORT_INFO)[number]["format"]>("PNG");
  const [scale, setScale] = useState<1 | 2 | 3>(2);
  const [note, setNote] = useState("");
  const [exportsList, setExports] = useState<ExportRow[] | null>(null);
  const [links, setLinks] = useState<ShareLinkRow[]>([]);
  const [fresh, setFresh] = useState<{ exportId: string; url: string } | undefined>();
  const [days, setDays] = useState(30);

  const load = useCallback(async (): Promise<void> => {
    const [e, l] = await Promise.all([studio<{ items: ExportRow[] }>(`infographics/${designId}/exports`), canExport ? studio<{ items: ShareLinkRow[] }>(`infographics/${designId}/share-links`) : Promise.resolve(undefined)]);
    if (e.ok) setExports(e.data.items);
    if (l && l.ok) setLinks(l.data.items);
  }, [designId, canExport]);

  useEffect(() => {
    void load();
  }, [load]);

  const review = async (action: "request-review" | "approve" | "return"): Promise<void> => {
    setBusy(action);
    setMessage(undefined);
    if (action === "request-review" && dirty && !(await ensureSaved())) {
      setBusy(undefined);
      return;
    }
    const r = await studio<{ status: Status }>(`infographics/${designId}/${action}`, { method: "POST", body: note.trim() ? { note: note.trim() } : {} });
    setBusy(undefined);
    if (r.ok) {
      onStatus(r.data.status);
      setNote("");
      setMessage({ tone: "ok", text: action === "request-review" ? "Sent for review. The approvers have been told." : action === "approve" ? "Approved." : "Sent back to draft." });
    } else setMessage({ tone: "error", text: r.message });
  };

  const publish = async (): Promise<void> => {
    setBusy("publish");
    setMessage(undefined);
    if (dirty && !(await ensureSaved())) {
      setBusy(undefined);
      return;
    }
    const r = await studio<ExportRow>(`infographics/${designId}/exports`, { method: "POST", body: { format, ...(format === "PNG" ? { scale } : {}), ...mapInputs() } });
    setBusy(undefined);
    if (r.ok) {
      setMessage({ tone: "ok", text: "Published. Later changes never alter this file." });
      await load();
    } else setMessage({ tone: "error", text: r.message });
  };

  const share = async (exportId: string): Promise<void> => {
    setBusy(`share-${exportId}`);
    const r = await studio<{ token: string }>(`infographics/${designId}/share-links`, { method: "POST", body: { exportId, days } });
    setBusy(undefined);
    if (r.ok) {
      setFresh({ exportId, url: `${window.location.origin}/shared/infographic/${r.data.token}` });
      await load();
    } else setMessage({ tone: "error", text: r.message });
  };

  const revoke = async (id: string): Promise<void> => {
    const r = await studio(`infographic-share-links/${id}`, { method: "DELETE" });
    if (r.ok) await load();
    else setMessage({ tone: "error", text: r.message });
  };

  const variants = async (by: string): Promise<void> => {
    setBusy(`variants-${by}`);
    setMessage(undefined);
    const r = await studio<{ items: Array<{ id: string; title: string }> }>(`infographics/${designId}/variants`, { method: "POST", body: { by } });
    setBusy(undefined);
    if (r.ok) setMessage({ tone: "ok", text: `${r.data.items.length} new draft${r.data.items.length === 1 ? "" : "s"} made. Find them in the project's list of infographics.` });
    else setMessage({ tone: "error", text: r.message });
  };

  const info = STATUS_INFO[status];
  const needsApproval = profile === "DONOR_REPORT";
  const blocked = check ? !check.canPublish : false;

  return (
    <div className="space-y-4 text-sm">
      <PanelHeading>Review and publish</PanelHeading>
      {message && (
        <p role={message.tone === "error" ? "alert" : "status"} className={`rounded-lg px-3 py-2 ${message.tone === "error" ? "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300" : "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300"}`}>
          {message.text}
        </p>
      )}

      <section aria-label="Review" className="space-y-2">
        <div className="flex items-center gap-2">
          <Badge tone={info.tone}>{info.label}</Badge>
          {needsApproval && <span className="text-xs text-slate-500">A design for a donor needs approval before it is published.</span>}
        </div>
        {(status !== "DRAFT" || canEdit) && (canEdit || canApprove) && (
          <Field label="A note for the reviewer (optional)">
            <Input value={note} maxLength={300} onChange={(event) => setNote(event.target.value)} />
          </Field>
        )}
        <div className="flex flex-wrap gap-2">
          {status === "DRAFT" && canEdit && (
            <Button size="sm" pending={busy === "request-review"} onClick={() => void review("request-review")}>
              Ask for a review
            </Button>
          )}
          {status === "IN_REVIEW" && canApprove && (
            <Button size="sm" pending={busy === "approve"} onClick={() => void review("approve")}>
              Approve
            </Button>
          )}
          {(status === "IN_REVIEW" || status === "APPROVED") && canApprove && (
            <Button size="sm" variant="secondary" pending={busy === "return"} onClick={() => void review("return")}>
              Send back to draft
            </Button>
          )}
        </div>
        {status === "IN_REVIEW" && !canApprove && <p className="text-xs text-slate-500">Waiting for an approver. Editing the design sends it back to draft.</p>}
        <CommentsDisclosure entityType="infographic" entityId={designId} heading="Comments on this design" />
      </section>

      {canExport && (
        <section aria-label="Publish" className="space-y-2 border-t border-slate-200 pt-3 dark:border-white/10">
          <Field label="Publish as">
            <Select value={format} onChange={(event) => setFormat(event.target.value as typeof format)}>
              {EXPORT_INFO.map((o) => (
                <option key={o.format} value={o.format}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
          <p className="text-xs text-slate-500">{EXPORT_INFO.find((o) => o.format === format)?.description}</p>
          {format === "PNG" && (
            <Field label="Sharpness">
              <Select value={String(scale)} onChange={(event) => setScale(Number(event.target.value) as 1 | 2 | 3)}>
                {SCALE_INFO.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Button pending={busy === "publish"} disabled={blocked || (needsApproval && status !== "APPROVED")} onClick={() => void publish()}>
            Publish
          </Button>
          {blocked && <p className="text-xs text-red-700">The design check has something to fix first (see the Check tab).</p>}
          {!blocked && needsApproval && status !== "APPROVED" && <p className="text-xs text-slate-500">Get it approved first.</p>}
        </section>
      )}

      <section aria-label="Published files" className="space-y-2 border-t border-slate-200 pt-3 dark:border-white/10">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Published files</h4>
        {exportsList === null ? (
          <p className="text-slate-500">Loading…</p>
        ) : exportsList.length === 0 ? (
          <p className="text-slate-500">Nothing published yet.</p>
        ) : (
          <ul className="space-y-2">
            {exportsList.map((row) => {
              const label = EXPORT_INFO.find((o) => o.format === row.format)?.label ?? row.format;
              const mine = links.filter((l) => l.exportId === row.id);
              return (
                <li key={row.id} className="rounded-lg border border-slate-200 p-2 dark:border-white/10">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <a className="font-medium text-brand-700 underline dark:text-brand-300" href={`/api/infographics/${designId}/exports/${row.id}/file`}>
                      {label}
                    </a>
                    <span className="text-xs text-slate-500">
                      {when(row.createdAt)}
                      {row.pageCount && row.pageCount > 1 ? ` · ${row.pageCount} pages` : ""}
                    </span>
                  </div>
                  {row.approved && <Badge tone="success">Approved when published</Badge>}
                  {canExport && (row.format === "PNG" || row.format === "PDF" || row.format === "SVG") && (
                    <div className="mt-1.5 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <Select aria-label="How long the link works" className="!min-h-[30px] !w-auto !py-0.5 text-xs" value={String(days)} onChange={(event) => setDays(Number(event.target.value))}>
                          {[7, 30, 90].map((d) => (
                            <option key={d} value={d}>
                              {d} days
                            </option>
                          ))}
                        </Select>
                        <Button size="sm" variant="secondary" pending={busy === `share-${row.id}`} onClick={() => void share(row.id)}>
                          Make a public link
                        </Button>
                      </div>
                      {fresh?.exportId === row.id && (
                        <div className="rounded-md bg-slate-50 p-2 dark:bg-white/5">
                          <p className="text-xs text-slate-500">Copy this link now. It is not shown again.</p>
                          <input readOnly aria-label="Public link" className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-xs dark:bg-slate-900" value={fresh.url} onFocus={(event) => event.target.select()} />
                        </div>
                      )}
                      {mine.map((l) => (
                        <p key={l.id} className="flex items-center justify-between gap-2 text-xs text-slate-500">
                          <span>
                            {l.live ? `Link works until ${new Date(l.expiresAt).toLocaleDateString("en-GB")}` : l.revokedAt ? "Link withdrawn" : "Link expired"} · {l.viewCount} view{l.viewCount === 1 ? "" : "s"}
                          </span>
                          {l.live && (
                            <button type="button" className="underline" onClick={() => void revoke(l.id)}>
                              Withdraw
                            </button>
                          )}
                        </p>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {canEdit && (
        <section aria-label="More" className="space-y-2 border-t border-slate-200 pt-3 dark:border-white/10">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">More from this design</h4>
          {scope === "PROJECT" && (
            <>
              <div className="flex flex-wrap gap-2">
                {VARIANT_INFO.map((v) => (
                  <Button key={v.by} size="sm" variant="secondary" pending={busy === `variants-${v.by}`} onClick={() => void variants(v.by)}>
                    {v.label}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-slate-500">Each one is a new draft in the project's list; this design is not changed.</p>
            </>
          )}
          <Button size="sm" variant="secondary" onClick={onSaveAsTemplate}>
            Save this layout for reuse
          </Button>
          <p className="text-xs text-slate-500">
            <a className="underline" href={scope === "PORTFOLIO" ? "/portfolio/infographics" : `/projects/${projectId}/infographics`}>
              {scope === "PORTFOLIO" ? "All portfolio infographics" : "All infographics in this project"}
            </a>
          </p>
        </section>
      )}
    </div>
  );
}

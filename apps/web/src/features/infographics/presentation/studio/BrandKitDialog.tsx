"use client";

import { useEffect, useState } from "react";
import { readableOn, themeFromBrand } from "@donordesk/domain/contexts/infographics/index.js";
import { Dialog } from "@/components/feedback/Dialog";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { AssetLibrary } from "./AssetLibrary";
import { AssetThumb } from "./primitives";
import { studio, type BrandKit } from "../../domain/studio-api";

const HEX = /^#[0-9a-fA-F]{6}$/;

function ColorField({ label, value, onChange, disabled }: { label: string; value: string; onChange: (value: string) => void; disabled: boolean }) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <input type="color" aria-label={`${label}, pick a colour`} disabled={disabled} value={HEX.test(value) ? value : "#0b66b3"} onChange={(event) => onChange(event.target.value)} className="h-9 w-12 rounded border border-slate-300" />
        <Input value={value} disabled={disabled} maxLength={7} onChange={(event) => onChange(event.target.value)} placeholder="#0b66b3" invalid={value !== "" && !HEX.test(value)} />
      </div>
    </Field>
  );
}

/** The organization's brand kit: the colours, logo and standing lines every infographic can use. Only an organization manager can change it. */
export function BrandKitDialog({ open, onClose, canManage, onSaved }: { open: boolean; onClose: () => void; canManage: boolean; onSaved: (kit: BrandKit) => void }) {
  const [kit, setKit] = useState<BrandKit>({ primaryColor: "#0b66b3" });
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [library, setLibrary] = useState<"LOGO" | "PARTNER" | undefined>();

  useEffect(() => {
    if (!open) return;
    setLoaded(false);
    setSaved(false);
    void studio<{ brand: BrandKit | null }>("infographic-brand").then((r) => {
      if (r.ok && r.data.brand) setKit(r.data.brand);
      if (!r.ok) setError(r.message);
      setLoaded(true);
    });
  }, [open]);

  const valid = HEX.test(kit.primaryColor) && (!kit.secondaryColor || HEX.test(kit.secondaryColor));
  const preview = valid ? themeFromBrand({ ...kit, primaryColor: kit.primaryColor.toLowerCase(), ...(kit.secondaryColor ? { secondaryColor: kit.secondaryColor.toLowerCase() } : {}) }) : undefined;
  const adjusted = valid && preview && preview.accent.toLowerCase() !== kit.primaryColor.toLowerCase() ? readableOn(kit.primaryColor, "#ffffff") : undefined;
  const partners = kit.partnerLogoAssetIds ?? [];

  const save = async (): Promise<void> => {
    setSaving(true);
    setError(undefined);
    const body: BrandKit = { ...kit };
    if (!body.secondaryColor) delete body.secondaryColor;
    const r = await studio<{ brand: BrandKit }>("infographic-brand", { method: "PUT", body });
    setSaving(false);
    if (r.ok) {
      setKit(r.data.brand);
      setSaved(true);
      onSaved(r.data.brand);
    } else setError(r.message);
  };

  return (
    <Dialog open={open} onClose={onClose} title="Brand kit" size="lg">
      {!loaded ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <div className="space-y-4 text-sm">
          {!canManage && <p className="rounded-lg bg-slate-50 px-3 py-2 text-slate-600 dark:bg-white/5">Only an organization manager can change the brand kit. You can see it here.</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            <ColorField label="Main colour" value={kit.primaryColor} disabled={!canManage} onChange={(value) => setKit({ ...kit, primaryColor: value })} />
            <ColorField label="Second colour (optional)" value={kit.secondaryColor ?? ""} disabled={!canManage} onChange={(value) => setKit({ ...kit, secondaryColor: value })} />
          </div>
          {preview && (
            <div className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 dark:border-white/10">
              <div className="flex gap-1" aria-hidden="true">
                {preview.palette.slice(0, 6).map((c) => (
                  <span key={c} className="h-6 w-6 rounded-full border border-black/10" style={{ background: c }} />
                ))}
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                This is how pages will be coloured.{adjusted ? ` Your main colour is a little light for text on white, so headings use a slightly darker shade (${adjusted}).` : " Text in this colour is easy to read on white."}
              </p>
            </div>
          )}
          <div>
            <p className="label">Logo</p>
            <div className="flex items-center gap-3">
              {kit.logoAssetId ? <AssetThumb id={kit.logoAssetId} className="h-12 w-20 rounded border border-slate-200 bg-white object-contain" alt="" /> : <span className="text-xs text-slate-500">No logo yet.</span>}
              {canManage && (
                <Button size="sm" variant="secondary" onClick={() => setLibrary("LOGO")}>
                  {kit.logoAssetId ? "Change" : "Choose a logo"}
                </Button>
              )}
              {canManage && kit.logoAssetId && (
                <Button size="sm" variant="ghost" onClick={() => setKit({ ...kit, logoAssetId: undefined })}>
                  Remove
                </Button>
              )}
            </div>
          </div>
          <div>
            <p className="label">Funder and partner logos (up to six)</p>
            <div className="flex flex-wrap items-center gap-2">
              {partners.map((id) => (
                <span key={id} className="relative">
                  <AssetThumb id={id} className="h-10 w-16 rounded border border-slate-200 bg-white object-contain" alt="" />
                  {canManage && (
                    <button type="button" aria-label="Remove this logo" className="absolute -right-1 -top-1 rounded-full bg-slate-700 px-1 text-[10px] text-white" onClick={() => setKit({ ...kit, partnerLogoAssetIds: partners.filter((x) => x !== id) })}>
                      ✕
                    </button>
                  )}
                </span>
              ))}
              {canManage && partners.length < 6 && (
                <Button size="sm" variant="secondary" onClick={() => setLibrary("PARTNER")}>
                  Add a logo
                </Button>
              )}
            </div>
          </div>
          <Field label="Line under every page" hint="An address, a website or a contact.">
            <Input value={kit.footerLine ?? ""} maxLength={160} disabled={!canManage} onChange={(event) => setKit({ ...kit, footerLine: event.target.value })} />
          </Field>
          <Field label="Standard thank-you to funders">
            <Input value={kit.acknowledgement ?? ""} maxLength={200} disabled={!canManage} onChange={(event) => setKit({ ...kit, acknowledgement: event.target.value })} placeholder="With funding from …" />
          </Field>
          {error && <p role="alert" className="text-red-700">{error}</p>}
          {saved && <p role="status" className="text-green-700">Saved. Designs that use “Organization brand” pick it up on their next preview.</p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
            {canManage && (
              <Button pending={saving} disabled={!valid} onClick={() => void save()}>
                Save brand kit
              </Button>
            )}
          </div>
          <AssetLibrary
            open={library !== undefined}
            onClose={() => setLibrary(undefined)}
            kind="LOGO"
            canEdit={canManage}
            onChoose={(asset) => {
              if (library === "LOGO") setKit({ ...kit, logoAssetId: asset.id });
              else setKit({ ...kit, partnerLogoAssetIds: [...partners, asset.id].slice(0, 6) });
              setLibrary(undefined);
            }}
          />
        </div>
      )}
    </Dialog>
  );
}

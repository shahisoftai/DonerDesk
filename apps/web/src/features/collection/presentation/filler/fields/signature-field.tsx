"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { framed } from "../FieldFrame";
import type { FieldViewProps } from "../field-types";

/**
 * A signature drawn with a finger or a pen. The drawing becomes a small PNG that is uploaded like any other file; the answer is the file's
 * id. The pad works offline when the form's files can be queued, and a stamp can be attached as a photo through the same question.
 */
export function SignatureFieldView(p: FieldViewProps) {
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const [inked, setInked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const { t } = p.ctx;
  const signed = typeof p.value === "string" && p.value !== "";

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.lineWidth = 2.5; ctx.lineCap = "round"; ctx.strokeStyle = "#0b1b3a";
  }, [signed]);

  const at = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = canvas.current!;
    const r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * c.width, y: ((e.clientY - r.top) / r.height) * c.height };
  };
  const down = (e: React.PointerEvent<HTMLCanvasElement>) => { e.currentTarget.setPointerCapture(e.pointerId); drawing.current = true; const g = canvas.current!.getContext("2d")!; const { x, y } = at(e); g.beginPath(); g.moveTo(x, y); };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => { if (!drawing.current) return; const g = canvas.current!.getContext("2d")!; const { x, y } = at(e); g.lineTo(x, y); g.stroke(); setInked(true); };
  const up = () => { drawing.current = false; };
  const clear = () => { const c = canvas.current!; c.getContext("2d")!.clearRect(0, 0, c.width, c.height); setInked(false); };

  async function keep() {
    const c = canvas.current;
    if (!c || !p.ctx.uploadFile) return;
    setBusy(true); setNote("");
    try {
      const blob: Blob | null = await new Promise((resolve) => c.toBlob(resolve, "image/png"));
      if (!blob) { setNote(t("assess.sign.failed")); return; }
      const r = await p.ctx.uploadFile(new File([blob], "signature.png", { type: "image/png" }), p.field.key);
      if (r.ok) { p.ctx.rememberFile(r.id, r.name); p.onChange(r.id); } else setNote(r.message);
    } finally { setBusy(false); }
  }

  return framed(p, signed ? (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">{t("assess.sign.done")}{p.field.signer ? ` — ${p.field.signer}` : ""}</span>
      {!p.ctx.readOnly && <Button type="button" variant="ghost" onClick={() => p.onChange(undefined)}>{t("assess.sign.redo")}</Button>}
    </div>
  ) : (
    <div className="space-y-2">
      <canvas ref={canvas} width={600} height={180} aria-label={t("assess.sign.title")} className="h-[120px] w-full touch-none rounded-md border border-dashed border-slate-400 bg-white" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up} />
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" onClick={clear} disabled={!inked || p.ctx.readOnly}>{t("assess.sign.clear")}</Button>
        <Button type="button" onClick={() => void keep()} disabled={!inked || p.ctx.readOnly || !p.ctx.uploadFile} pending={busy}>{t("assess.sign.save")}</Button>
      </div>
      {note && <p role="status" className="text-xs text-danger-600">{note}</p>}
    </div>
  ));
}

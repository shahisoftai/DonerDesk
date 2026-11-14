import { KITS, kitTemplate } from "@donordesk/domain/contexts/datasets/browser.js";

export const dynamic = "force-dynamic";

/** A kit's template sheet (Phase 54): its headers and an empty row, as CSV. Content only, no records; the same for everyone. */
export async function GET(_req: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const kit = KITS.find((k) => k.key === key);
  if (!kit) return new Response("Not found", { status: 404 });
  const headers = kitTemplate(kit).headers;
  const line = (cells: string[]) => cells.map((c) => `"${c.replace(/"/g, '""')}"`).join(",");
  const csv = `﻿${line(headers)}\r\n${line(headers.map(() => ""))}\r\n`;
  return new Response(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${kit.key.toLowerCase()}-template.csv"` } });
}

import { FORM_KITS, type FormKit } from "@donordesk/domain";

export interface FormKitDto { id: string; name: string; sector: string; description: string; source: string; unreviewed: true; notes: readonly string[]; suggestedIndicators: FormKit["suggestedIndicators"]; fieldCount: number }

/** The ready-made forms, for the picker. Static data; no permission beyond being signed in is needed to read what they are. */
export class ListFormKitsHandler {
  handle(): FormKitDto[] {
    return FORM_KITS.map((k) => ({ id: k.id, name: k.name, sector: k.sector, description: k.description, source: k.source, unreviewed: k.unreviewed, notes: k.notes, suggestedIndicators: k.suggestedIndicators, fieldCount: k.build().fields.length }));
  }
}

"use client";

import { useEffect, useState } from "react";

const TTL_MS = 7 * 24 * 3600 * 1000;
type Saved = { savedAt: number; fields: Record<string, string> };

const fieldsOf = (form: HTMLFormElement) =>
  [...form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("input[id], input[name], textarea[id], textarea[name], select[id], select[name]")]
    .filter((el) => !(el instanceof HTMLInputElement) || !["password", "file", "hidden", "submit", "button"].includes(el.type));
/** A field is remembered by its id (React forms label fields by id), else its name. */
const keyOf = (el: Element & { name?: string }) => el.id || el.name || "";

/** Writes a value the way a person typing would, so controlled React fields see it too (the same trick as dictation). */
function setNative(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) {
  if (el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio")) {
    const want = value === "true" || (el.type === "radio" && el.value === value);
    if (el.checked !== want) el.click();
    return;
  }
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, value);
  el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
}

/**
 * Keeps a long form's typing on this device (Version 4.000, plan F31): every field with an id or name is saved as you type; when the form
 * opens again with a draft, a bar offers to restore or discard it. Passwords and files are never kept. A successful submit
 * (the page navigates away after saving) should call `clearFormDraft(key)`; a draft older than a week is dropped.
 */
export function FormDraftKeeper({ formId, storageKey }: { formId: string; storageKey: string }) {
  const key = `donordesk:form-draft:${storageKey}`;
  const [offer, setOffer] = useState<Saved | null>(null);

  useEffect(() => {
    const form = document.getElementById(formId);
    if (!(form instanceof HTMLFormElement)) return;
    try {
      const raw = localStorage.getItem(key);
      const saved = raw ? (JSON.parse(raw) as Saved) : null;
      if (saved && Date.now() - saved.savedAt < TTL_MS && Object.values(saved.fields).some((v) => v && v !== "false")) setOffer(saved);
      else localStorage.removeItem(key);
    } catch { /* storage blocked: work without drafts */ }
    let timer = 0;
    const save = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const fields: Record<string, string> = {};
        for (const el of fieldsOf(form)) {
          if (el instanceof HTMLInputElement && el.type === "radio") { if (el.checked) fields[el.name || el.id] = el.value; continue; }
          fields[keyOf(el)] = el instanceof HTMLInputElement && el.type === "checkbox" ? String(el.checked) : el.value;
        }
        try { localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), fields } satisfies Saved)); } catch { /* full or blocked */ }
      }, 400);
    };
    const clear = () => { try { localStorage.removeItem(key); } catch { /* blocked */ } };
    form.addEventListener("input", save);
    form.addEventListener("change", save);
    form.addEventListener("submit", clear);
    return () => { window.clearTimeout(timer); form.removeEventListener("input", save); form.removeEventListener("change", save); form.removeEventListener("submit", clear); };
  }, [formId, key]);

  if (!offer) return null;
  const restore = () => {
    const form = document.getElementById(formId);
    if (form instanceof HTMLFormElement) for (const el of fieldsOf(form)) {
      const k = el instanceof HTMLInputElement && el.type === "radio" ? el.name || el.id : keyOf(el);
      if (k in offer.fields) setNative(el, offer.fields[k]!);
    }
    setOffer(null);
  };
  const discard = () => { try { localStorage.removeItem(key); } catch { /* blocked */ } setOffer(null); };
  return (
    <div role="status" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-900 dark:border-brand-300/20 dark:bg-brand-300/10 dark:text-brand-100">
      <span>You have unsaved typing from {new Date(offer.savedAt).toLocaleString()}.</span>
      <span className="flex gap-2">
        <button type="button" className="btn-primary btn-sm" onClick={restore}>Restore it</button>
        <button type="button" className="btn-ghost btn-sm" onClick={discard}>Discard</button>
      </span>
    </div>
  );
}

export function clearFormDraft(storageKey: string): void {
  try { localStorage.removeItem(`donordesk:form-draft:${storageKey}`); } catch { /* blocked */ }
}

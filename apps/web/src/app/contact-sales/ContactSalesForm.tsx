"use client";

import { useState } from "react";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { InlineAlert } from "@/components/feedback/InlineAlert";
import { submitContactSalesAction } from "@/lib/actions/sales";

export function ContactSalesForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [organization, setOrganization] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const result = await submitContactSalesAction({ name, email, organization, message, website });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <InlineAlert
        tone="success"
        title="Thanks — we received your message and will follow up by email shortly."
      />
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field label="Your name" htmlFor="cs-name">
        <Input id="cs-name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
      </Field>
      <Field label="Work email" htmlFor="cs-email">
        <Input id="cs-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </Field>
      <Field label="Organization" htmlFor="cs-org">
        <Input id="cs-org" value={organization} onChange={(e) => setOrganization(e.target.value)} required minLength={2} />
      </Field>
      <Field label="What are you looking for?" htmlFor="cs-message">
        <Textarea id="cs-message" value={message} onChange={(e) => setMessage(e.target.value)} required minLength={10} rows={5} />
      </Field>
      {/* Honeypot: hidden from real users, invisible to screen readers; bots that fill it are silently dropped server-side. */}
      <input
        type="text"
        name="website"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute left-[-9999px] h-0 w-0 opacity-0"
      />
      {error && <InlineAlert tone="danger" title={error} />}
      <Button type="submit" pending={busy}>
        Send message
      </Button>
    </form>
  );
}

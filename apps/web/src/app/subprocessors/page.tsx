import type { Metadata } from "next";
import { LegalLayout } from "@/components/legal/LegalLayout";
import { Section, A, Table } from "@/components/legal/LegalBits";
import { LEGAL } from "@/lib/legal-entity";

export const metadata: Metadata = {
  alternates: { canonical: "/subprocessors" },
  title: "Sub-processors",
  description: "The third parties DonorDesk uses to process customer data, what each does, and when it is used.",
};

const TOC = [
  { id: "core", title: "Always used" },
  { id: "ai", title: "AI providers" },
  { id: "optional", title: "Used only if you enable them" },
  { id: "changes", title: "Changes and objections" },
];

export default function SubprocessorsPage() {
  return (
    <LegalLayout title="Sub-processors" subtitle="Legal" updated={LEGAL.updated} toc={TOC}>
      <p className="mt-8 text-[15px] leading-7 text-slate-300">
        This list names the third parties that may process personal data in a customer workspace on
        DonorDesk&apos;s behalf. It forms part of our <A href="/dpa">Data Processing Addendum</A>.
      </p>
      <Section id="core" title="1. Always used">
        <Table
          head={["Provider", "Purpose", "Data", "Location"]}
          rows={[
            ["Contabo GmbH", "Servers and database hosting for the Service", "All workspace data and backups", LEGAL.hostingLocation],
            ["Creem", "Payment processing and subscriptions (merchant of record)", "Billing contact and payment details (card data is handled by Creem, not stored by us)", "Per Creem's policy"],
            ["Postmark (ActiveCampaign)", "Transactional email: invitations, password resets, notices", "Recipient email, name, message content", "United States"],
            ["Sentry", "Error monitoring (only when enabled)", "Technical error data; no workspace content by design", "Per Sentry's policy"],
          ]}
        />
      </Section>
      <Section id="ai" title="2. AI providers">
        <p>
          AI-assisted drafting sends the text needed for a request (for example report sections,
          source excerpts and prompts) to an AI provider. Personal identifiers can be redacted
          before sending (a built-in privacy filter). We normally use <strong>Z.ai (GLM)</strong> or{" "}
          <strong>Anthropic (Claude)</strong>. Our platform administrators can select other
          providers for a workspace. Only the provider configured for your workspace receives its
          data.
        </p>
        <Table
          head={["Provider", "Models", "Notes"]}
          rows={[
            ["Z.ai (Zhipu AI)", "GLM", "Normal default"],
            ["Anthropic", "Claude", "Normal default"],
            ["OpenAI", "GPT", "Available on request"],
            ["Google", "Gemini", "Available on request"],
            ["DeepSeek", "DeepSeek", "Available on request"],
            ["MiniMax", "MiniMax", "Available on request"],
            ["Self-hosted (Ollama)", "Open models on our own servers", "No third party receives data"],
          ]}
        />
        <p>
          We do not authorise providers to train models on your data and require them to process it
          only to return the result. Ask us before enabling AI if your donor forbids third-party AI
          or requires data to stay in a region; AI can be disabled or switched to self-hosted.
          Contact <A href={`mailto:${LEGAL.privacyEmail}`}>{LEGAL.privacyEmail}</A> for the provider
          configured for your workspace.
        </p>
      </Section>
      <Section id="optional" title="3. Used only if you enable them">
        <Table
          head={["Provider", "Purpose", "Data"]}
          rows={[
            ["Google (Drive, Sheets)", "Link or read evidence files you choose to connect", "Files and metadata you authorise"],
            ["Cloudflare (R2)", "Managed file storage if you choose DonorDesk-managed uploads", "Uploaded evidence files"],
            ["Slack, Microsoft Teams, WhatsApp", "Notifications you configure", "Notification text and recipients"],
          ]}
        />
        <p>These are your choices. Where you connect your own account, your agreement with that provider also applies.</p>
      </Section>
      <Section id="changes" title="4. Changes and objections">
        <p>
          We will update this page before adding or replacing a sub-processor, and notify customers
          with a DPA by email at least 30 days ahead where practicable. You may object on reasonable
          data-protection grounds within that period; if we cannot accommodate the objection, you
          may stop using the affected feature or terminate the affected subscription. Contact{" "}
          <A href={`mailto:${LEGAL.privacyEmail}`}>{LEGAL.privacyEmail}</A>.
        </p>
      </Section>
    </LegalLayout>
  );
}

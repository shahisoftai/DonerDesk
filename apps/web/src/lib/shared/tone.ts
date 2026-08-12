export type Tone = "neutral" | "info" | "success" | "warning" | "danger" | "ai";

export const TONES: readonly Tone[] = ["neutral", "info", "success", "warning", "danger", "ai"];

type ToneClassSet = {
  badge: string;
  solid: string;
  text: string;
};

export const toneClasses: Record<Tone, ToneClassSet> = {
  neutral: {
    badge: "border-slate-400/20 bg-slate-500/10 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300",
    solid: "bg-slate-500 text-white",
    text: "text-slate-600 dark:text-slate-300",
  },
  info: {
    badge: "border-brand-500/20 bg-brand-500/10 text-brand-700 dark:border-brand-400/20 dark:bg-brand-400/10 dark:text-brand-300",
    solid: "bg-brand-600 text-white",
    text: "text-brand-700 dark:text-brand-300",
  },
  success: {
    badge: "border-success-500/20 bg-success-500/10 text-success-700 dark:border-success-500/20 dark:bg-success-500/10 dark:text-success-500",
    solid: "bg-success-600 text-white",
    text: "text-success-700 dark:text-success-500",
  },
  warning: {
    badge: "border-warning-500/20 bg-warning-500/10 text-warning-700 dark:border-warning-500/20 dark:bg-warning-500/10 dark:text-warning-500",
    solid: "bg-warning-600 text-white",
    text: "text-warning-700 dark:text-warning-500",
  },
  danger: {
    badge: "border-danger-500/20 bg-danger-500/10 text-danger-700 dark:border-danger-500/20 dark:bg-danger-500/10 dark:text-danger-500",
    solid: "bg-danger-600 text-white",
    text: "text-danger-700 dark:text-danger-500",
  },
  ai: {
    badge: "border-ai-500/20 bg-ai-500/10 text-ai-700 dark:border-ai-500/20 dark:bg-ai-500/10 dark:text-ai-500",
    solid: "bg-ai-600 text-white",
    text: "text-ai-700 dark:text-ai-500",
  },
};

export function toneFor(unknownTone: string | undefined): Tone {
  if (unknownTone && TONES.includes(unknownTone as Tone)) return unknownTone as Tone;
  return "neutral";
}

// Status → tone mappers. Semantic presentation is decoupled from the transport enum.

export function projectStatusTone(status: string | undefined): Tone {
  switch (status) {
    case "ACTIVE":
      return "success";
    case "PAUSED":
      return "warning";
    case "COMPLETED":
      return "info";
    case "ARCHIVED":
      return "neutral";
    case "DRAFT":
      return "warning";
    default:
      return "neutral";
  }
}

export function reportStatusTone(status: string | undefined): Tone {
  switch (status) {
    case "APPROVED":
    case "SUBMITTED":
    case "CLOSED":
      return "success";
    case "UNDER_REVIEW":
    case "DRAFT_GENERATED":
    case "IN_PROGRESS":
    case "EVIDENCE_COLLECTION":
      return "info";
    case "NOT_STARTED":
      return "neutral";
    default:
      return "neutral";
  }
}

export function severityTone(severity: string | undefined): Tone {
  switch (severity) {
    case "CRITICAL":
      return "danger";
    case "HIGH":
      return "danger";
    case "MEDIUM":
      return "warning";
    case "LOW":
      return "info";
    default:
      return "neutral";
  }
}

export function verificationStatusTone(status: string | undefined): Tone {
  switch (status) {
    case "VERIFIED":
      return "success";
    case "REJECTED":
      return "danger";
    case "NEEDS_CORRECTION":
      return "danger";
    case "PENDING_REVIEW":
      return "warning";
    case "UPLOADED":
      return "info";
    case "AI_TAGGED":
      return "info";
    case "ARCHIVED":
      return "neutral";
    case "PENDING":
    case "UNVERIFIED":
      return "warning";
    default:
      return "neutral";
  }
}

export function confidentialityTone(level: string | undefined): Tone {
  switch (level) {
    case "HIGHLY_SENSITIVE":
    case "SENSITIVE":
      return "danger";
    case "INTERNAL":
      return "warning";
    case "PUBLIC":
      return "success";
    default:
      return "neutral";
  }
}

export function checklistStatusTone(status: string | undefined): Tone {
  switch (status) {
    case "RESOLVED":
    case "ACCEPTED_RISK":
    case "NOT_APPLICABLE":
      return "success";
    case "OPEN":
      return "danger";
    case "IN_PROGRESS":
      return "warning";
    default:
      return "neutral";
  }
}

export function activityStatusTone(status: string | undefined): Tone {
  switch (status) {
    case "ACCEPTED":
      return "success";
    case "REJECTED":
      return "danger";
    case "NEEDS_REVISION":
      return "danger";
    case "DRAFT":
      return "neutral";
    case "SUBMITTED":
      return "info";
    default:
      return "warning";
  }
}

export function sectionStatusTone(status: string | undefined): Tone {
  switch (status) {
    case "APPROVED":
      return "success";
    case "NEEDS_REVIEW":
      return "warning";
    case "NEEDS_EVIDENCE":
      return "warning";
    case "DRAFTED":
      return "info";
    case "NOT_STARTED":
      return "neutral";
    default:
      return "neutral";
  }
}

export function reportDraftStatusTone(status: string | undefined): Tone {
  switch (status) {
    case "APPROVED":
    case "SUBMITTED":
    case "EXPORTED":
      return "success";
    case "UNDER_REVIEW":
      return "warning";
    case "DRAFT":
      return "info";
    default:
      return "neutral";
  }
}

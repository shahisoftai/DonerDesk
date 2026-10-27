/** Everything a person reads on the Integrations screen (Phase 33.7); scanned by the copy lint. */
export const INTEGRATIONS_COPY = {
  title: "Integrations",
  intro: "Let other systems read your results (a key) and be told when something happens (a webhook). Keys can only read; nothing here can change your data.",
  keysTitle: "Keys",
  keysIntro: "A key lets a dashboard, a spreadsheet or another system read the things you choose. It is shown once, when you create it: copy it then.",
  keyName: "What will use it",
  keyNameHint: "For example Power BI or the finance team's sheet.",
  scopes: "It may read",
  projects: "Projects it may see",
  projectsAll: "All projects",
  expires: "Stops working after",
  expiresNever: "Never",
  expiresDays: (n: number) => `${n} days`,
  createKey: "Create key",
  creating: "Creating…",
  copyNow: "Copy this key now. You will not be able to see it again.",
  noKeys: "No keys yet.",
  revoke: "Switch off",
  statusActive: "Working",
  statusRevoked: "Switched off",
  statusExpired: "Expired",
  lastUsed: (when: string) => `Last used ${when}`,
  neverUsed: "Never used",
  howToTitle: "How to use a key",
  howTo: "Send it in the Authorization header as Bearer followed by the key. Addresses: /api/v1/projects, /api/v1/projects/{project}/indicators and /api/v1/projects/{project}/place-results.",
  webhooksTitle: "Webhooks",
  webhooksIntro: "We send a short, signed message to the address you give when one of the things you choose happens. A message carries only references (which report, which project), never text; the receiver then reads details with a key.",
  url: "Address to send to",
  urlHint: "A public web address starting with https://.",
  events: "Tell me when",
  addWebhook: "Add webhook",
  secretNow: "Copy this signing secret now. You will not be able to see it again. Check the signature of each message with it.",
  noWebhooks: "No webhooks yet.",
  on: "Sending",
  off: "Switched off",
  switchOn: "Switch on",
  remove: "Remove",
  deliveries: "Recent messages",
  deliveryNone: "Nothing sent yet.",
  deliveryStatus: { PENDING: "Waiting to be sent", DELIVERED: "Delivered", FAILED: "Gave up" } as Record<string, string>,
  adminOnly: "Only an administrator can manage integrations.",
} as const;

export const SCOPE_LABEL: Readonly<Record<string, string>> = {
  "projects:read": "The list of projects",
  "indicators:read": "Indicator values, by period",
  "places:read": "Results by place",
};

export const WEBHOOK_EVENT_LABEL: Readonly<Record<string, string>> = {
  "report.approved": "A report is approved",
  "report.submitted": "A report is submitted to the donor",
  "period.locked": "A reporting period is locked",
  "indicator.value.verified": "An indicator value is verified",
  "evidence.verified": "A piece of evidence is verified",
  "activity.accepted": "A completed activity is accepted",
};

/** Events that are sent today; the others are listed so the choice is honest about what exists. */
export const WEBHOOK_EVENTS_LIVE: ReadonlySet<string> = new Set(["report.approved"]);

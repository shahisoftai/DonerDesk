import type { Metadata } from "next";
import { supportArticleMetadata } from "@/lib/seo";
import { CategoryArticle } from "@/components/support/CategoryArticle";

const FILE_MAP: Record<string, string> = {
  "log-in": "how-to/how-to-log-in.md",
  "create-an-account": "how-to/how-to-create-an-account.md",
  "change-your-password": "how-to/how-to-change-your-password.md",
  "set-up-new-organisation": "how-to-set-up-new-organisation.md",
  "create-a-project": "how-to/how-to-create-a-project.md",
  "build-logframe": "how-to/how-to-build-logframe.md",
  "upload-donor-template": "how-to/how-to-upload-donor-template.md",
  "update-indicator-values": "how-to/how-to-update-indicator-values.md",
  "log-activities": "how-to/how-to-log-activities.md",
  "dictate-instead-of-typing": "how-to/how-to-dictate-instead-of-typing.md",
  "work-offline-and-take-photos": "how-to/how-to-work-offline-and-take-photos.md",
  "upload-evidence": "how-to/how-to-upload-evidence.md",
  "use-the-dashboard": "how-to/how-to-use-the-dashboard.md",
  "search-projects-and-evidence": "how-to/how-to-search-projects-and-evidence.md",
  "invite-team-members": "how-to/how-to-invite-team-members.md",
  "manage-team-roles-permissions": "how-to/how-to-manage-team-roles-permissions.md",
  "manage-billing-subscription": "how-to/how-to-manage-billing-subscription.md",
  "export-reports": "how-to/how-to-export-reports.md",
  "generate-ai-report-draft": "how-to/how-to-generate-ai-report-draft.md",
  "review-and-approve-reports": "how-to/how-to-review-and-approve-reports.md",
  "use-the-audit-trail": "how-to-use-the-audit-trail.md",
  "use-comments-feedback": "how-to-use-comments-feedback.md",
  "use-the-notification-system": "how-to/how-to-use-the-notification-system.md",
  "use-compliance-checklist": "how-to/how-to-use-compliance-checklist.md",
  "use-bulk-actions": "how-to/how-to-use-bulk-actions.md",
  "connect-google-drive": "how-to/how-to-connect-google-drive.md",
  "import-from-google-sheets": "how-to/how-to-import-from-google-sheets.md",
  "change-organisation-profile": "how-to/how-to-change-organisation-profile.md",
  "archive-a-project": "how-to/how-to-archive-a-project.md",
  "turn-on-two-step-sign-in": "how-to/how-to-turn-on-two-step-sign-in.md",
  "set-a-target-schedule": "how-to/how-to-set-a-target-schedule.md",
  "check-your-portfolio": "how-to/how-to-check-your-portfolio.md",
  "match-donor-indicators": "how-to/how-to-match-donor-indicators.md",
  "review-evidence": "how-to/how-to-review-evidence.md",
  "use-comment-threads": "how-to/how-to-use-comment-threads.md",
  "get-a-management-report": "how-to/how-to-get-a-management-report.md",
  "record-a-change-of-plan": "how-to/how-to-record-a-change-of-plan.md",
  "read-a-scanned-document": "how-to/how-to-read-a-scanned-document.md",
  "create-a-reporting-period": "how-to/how-to-create-a-reporting-period.md",
  "create-the-closing-report": "how-to/how-to-create-the-closing-report.md",
  "run-a-reporting-month": "how-to/how-to-run-a-reporting-month.md",
  "project-walkthrough": "how-to/how-to-project-walkthrough.md",
  "review-and-accept-activities": "how-to/how-to-review-and-accept-activities.md",
  "fix-or-remove-an-indicator": "how-to/how-to-fix-or-remove-an-indicator.md",
  "change-a-reports-template": "how-to/how-to-change-a-reports-template.md",
  "tell-the-story-and-add-inputs": "how-to/how-to-tell-the-story-and-add-inputs.md",
  "use-the-report-editor": "how-to/how-to-use-the-report-editor.md",
  "use-the-data-center": "how-to/how-to-use-the-data-center.md",
  "add-a-chart-to-a-report": "how-to/how-to-add-a-chart-to-a-report.md",
  "reopen-an-approved-report": "how-to/how-to-reopen-an-approved-report.md",
  "use-the-academy-tour": "how-to/how-to-use-the-academy-tour.md",
  "plan-your-activities": "how-to/how-to-plan-your-activities.md",
  "use-the-timeline": "how-to/how-to-use-the-timeline.md",
  "use-my-week": "how-to/how-to-use-my-week.md",
  "import-your-plan": "how-to/how-to-import-your-plan.md",
  "ask-for-work-and-use-my-work": "how-to/how-to-ask-for-work-and-use-my-work.md",
  "record-problems-and-risks": "how-to/how-to-record-problems-and-risks.md",
  "add-comments-and-ask-for-files": "how-to/how-to-add-comments-and-ask-for-files.md",
  "log-progress-and-finish-an-activity": "how-to/how-to-log-progress-and-finish-an-activity.md",
  "track-dependencies-budget-and-people-reached": "how-to/how-to-track-dependencies-budget-and-people-reached.md",
  "add-fields-and-automatic-reminders": "how-to/how-to-add-fields-and-automatic-reminders.md",
  "see-your-work-on-a-map": "how-to/how-to-see-your-work-on-a-map.md",
  "pin-a-place-on-the-map": "how-to/how-to-pin-a-place-on-the-map.md",
  "upload-your-own-map-boundaries": "how-to/how-to-upload-your-own-map-boundaries.md",
  "make-an-infographic": "how-to/how-to-make-an-infographic.md",
  "check-an-infographic": "how-to/how-to-check-an-infographic.md",
  "approve-and-publish-an-infographic": "how-to/how-to-approve-and-publish-an-infographic.md",
  "share-an-infographic": "how-to/how-to-share-an-infographic.md",
  "get-wording-suggestions": "how-to/how-to-get-wording-suggestions.md",
  "collect-answers-with-a-form": "how-to/how-to-collect-answers-with-a-form.md",
  "use-the-field-app-offline": "how-to/how-to-use-the-field-app-offline.md",
  "bring-in-kobotoolbox-or-surveycto-submissions": "how-to/how-to-bring-in-kobotoolbox-or-surveycto-submissions.md",
  "make-a-dashboard": "how-to/how-to-make-a-dashboard.md",
  "ask-a-question-about-a-project": "how-to/how-to-ask-a-question-about-a-project.md",
  "connect-api-keys-webhooks-and-ai-assistants": "how-to/how-to-connect-api-keys-webhooks-and-ai-assistants.md",
  "require-two-step-sign-in": "how-to/how-to-require-two-step-sign-in.md",
  "change-the-interface-language": "how-to/how-to-change-the-interface-language.md",
  "set-up-programmes-and-grants": "how-to/how-to-set-up-programmes-and-grants.md",
  "see-framework-history": "how-to/how-to-see-framework-history.md",
  "invite-an-outside-partner": "how-to/how-to-invite-an-outside-partner.md",
  "take-your-data-with-you": "how-to/how-to-take-your-data-with-you.md",
  "meet-donor-requirements": "how-to/how-to-meet-donor-requirements.md",
  "fix-a-file-that-could-not-be-read": "how-to/how-to-fix-a-file-that-could-not-be-read.md",
  "onboard-team-member": "how-to-onboard-team-member.md",
  "prepare-for-donor-visit": "how-to-prepare-for-donor-visit.md",
};

export async function generateStaticParams() {
  return Object.keys(FILE_MAP).map((slug) => ({ article: slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ article: string }>;
}): Promise<Metadata> {
  const { article } = await params;
  return supportArticleMetadata("how-to", article);
}

export default async function HowToArticlePage({
  params,
}: {
  params: Promise<{ article: string }>;
}) {
  const { article } = await params;
  return (
    <CategoryArticle
      categorySlug="how-to"
      categoryLabel="How-To Guides"
      accent="skyline"
      article={article}
      relPath={FILE_MAP[article]}
    />
  );
}

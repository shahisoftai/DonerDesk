# Support articles for Phase 34 (drafts, unpublished)

DonorDesk Version 3.007. The features are deployed (`releaseId=20261028133938`) but **have not yet been tried by a person in the signed-in production app**, and the public site only says what has been checked (see AGENTS.md, "Public copy stays honest"). These drafts therefore stay here until the checks below are done.

| Draft | Feature doc |
|---|---|
| how-to-build-a-chart-in-the-chart-studio.md | Features/53 |
| how-to-enter-results-in-the-sheet.md | Features/54 |
| how-to-start-a-dashboard-from-a-sector-template.md | Features/55 |
| how-to-edit-a-dashboard-template.md | Features/55 |
| how-to-use-dashboard-tabs-full-screen-and-print.md | Features/55 |
| how-to-see-results-on-a-map.md | Features/56 |
| how-to-see-an-indicator-in-different-ways.md | Features/57 |
| how-to-build-and-save-a-report.md | Features/57 |
| how-to-bookmark-pages.md | Features/58 |

## Publish checklist

1. Walk each article in the signed-in app with a real project; fix any step that does not match the screen.
2. Copy the article to `apps/web/content/support/`, register it in `FILE_MAP` and `wikiCategories.tsx`, and ship with `deploy-fast.sh` (`SCOPE=web`).
3. Revise the published "Make and share a dashboard" article to mention tabs, tables, text blocks, report tables, full screen and print (it describes only the original six chart kinds).
4. Have the French, Spanish and Arabic screen text read by a native speaker before saying the product is available in those languages.

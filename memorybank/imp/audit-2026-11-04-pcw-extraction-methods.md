# Audit: how the AI Project Creation Wizard extracts information

**Date:** 2026-11-04. **Branch:** `0017-maps-v2` at `4c99f80f`. **Follows:** `audit-2026-11-04-project-wizard-cbpf.md`, which tested the wizard end to end. This audit looks at the extraction method behind it.

## 1. Conclusion

The pipeline's overall design matches current practice: parse, route by area, extract with a quote, ground, then have a person review. The biggest mistakes are in five other places:

1. **Grounding proves that a quote exists, not that the value is right.** A wrong value with a real quote passes and is shown to the reviewer as read from the document.
2. **Nothing measures accuracy.** The corpus has one synthetic and one real document, there is no field-level score, and the prompts were tuned on the real one.
3. **Stability depends on the model, and the code sends no setting that could enforce it.** `temperature: 0` never reaches Claude, no output schema is sent, and truncated replies are accepted as complete.
4. **Conflicts the system can detect do not trigger any repair.** A budget that does not add up is reported to the person and never re-read.
5. **Structure is lost before the model reads the text.** Table headers disappear after the first block, PDFs arrive as flat text, and long documents are only 5–12% read per area.

Do not add prompt rules for now. Prompts have been the main lever so far, and each one-document fix risks hurting other donors' formats. Build the measurement first (P0 in section 6).

## 2. Method and limits

- Read the orchestrator, extractors, prompts, grounding, parsers, Claude adapter and eval.
- Ran the built code without a model: grounding probes, block selection on the CBPF and AMAN documents and on a synthetic 260,000-character document, a long-table test and a truncated-reply test. The probe scripts were deleted. No product code changed.
- Researched comparable tools and research. Most sources were vendor documentation or blogs.

**Not done:** no live model run, no production data read, no launch, and no PDF proposal tested. The effect sizes in section 6 are therefore unmeasured. "Likely cause" below means inferred from the code and not proven by experiment.

## 3. Findings

Evidence: **Ran** = reproduced by running the code. **Read** = seen in the code. **Inferred** = reasoned from the code.

### A. Trust and grounding

| # | Sev. | Finding | Evidence | Fix |
|---|---|---|---|---|
| A1 | Critical | A value does not have to be supported by its quote. These all pass: a target of 500,000 quoted from a budget line, a title unrelated to its quote, a one-letter quote ("a"), and EUR on a quote that says USD | Ran; `grounding.ts` `groundProposed` | Per-field rules: text fields must share words with the quote; currency must be in the quote; set a minimum quote length. Add a verifier pass for key fields (C3) |
| A2 | High | The quote is searched in the whole document, not in the cited block. A wrong block number survives, so "Show in the document" can open the wrong passage | Read; `groundProposed`, `proposed-item.ts` `sourceRef` | Check the cited block first. If the quote is elsewhere, correct the reference to that block |
| A3 | High | Displayed confidence is only the model's own rating. The grounding result is discarded, and `lowerConfidence` is defined but never called in the wizard code searched | Read | Compute confidence from signals: grounding strength, source type, agreement between reads, placeholder or repair flags. Treat the model's rating as one input |
| A4 | High | Figure matching misreads common formats: `1.250.000,00` → `1.25, 0`; `1 250 000` → `1, 250, 0`; `$1.2 million` → `1.2`. Correct amounts in European formats can be dropped, and 1.2 million matches 1.2 | Ran; `askFigures` | A setup-specific amount reader handling decimal styles and scale words. Do not change `askFigures` without checking Ask |
| A5 | Medium | Items dropped during parsing are not counted or shown (unknown level, heading-only title), although the "left out" list implies it is complete | Read; `list-area.ts` `stated`, `logframe.ts` `read` | Report these drops in `leftOut` too |

### B. Model calls

| # | Sev. | Finding | Evidence | Fix |
|---|---|---|---|---|
| B1 | High | `stop_reason: max_tokens` is ignored, and `tryParseJson` closes the cut JSON. A truncated answer returned 2 items with `partlyRead: false` | Ran; `factory.ts` adapter, `extractor-shared.ts` | Treat truncation as a failure, as Anthropic's docs advise. Retry with smaller chunks, and mark partly read if it persists |
| B2 | High | `temperature: 0` is sent by `setup-llm.ts`, but the Claude adapter drops it, as current models reject sampling parameters. Likely part of the cause of S1 | Read; `factory.ts` | Stop relying on it. Reuse results per source hash, pinned model and prompt version (C4) |
| B3 | High | No output schema is sent; the JSON shape is only prose in the prompt, and bad output is repaired or dropped afterwards | Read; `factory.ts` comment | Use Claude structured outputs where available, generated from one schema per area; keep today's path for other providers. Anthropic's citations feature cannot be combined with this, but our own `quote` field does not need it |
| B4 | Medium | One failed chunk fails the whole area, discarding sibling chunks already paid for | Read; `runAreaExtraction` | Keep what was read, and mark the area partly read |
| B5 | Medium | Prompts describe the task but contain no worked examples. Few-shot examples are central to LangExtract's approach | Read | Add short examples that do not resemble any one donor. `dropPromptEchoes` already guards against leaks |
| B6 | Low | Costs are invisible (S18), so changes such as multi-reading cannot be judged | Earlier audit | Set `LLM_PRICES_JSON` |

### C. Consistency and repair

| # | Sev. | Finding | Evidence | Fix |
|---|---|---|---|---|
| C1 | High | **The results structure varies (S1).** Votes only cover structure, after a free-form first read has already chosen the items. Vote agreement (`agreed`) is calculated and then thrown away. A prompt also tells the model to build a hierarchy, against the system rule to use only what is stated | Read; `logframe.ts`, `results-chain.ts`, `rules.ts` | Separate **stated** from **inferred** results. For inferred chains, use one fixed shape and label it. Send disagreement to review |
| C2 | High | `checkProposal` only reports problems. A budget that does not add up (S3) never prompts a focused second look | Read; orchestrator | One targeted repair per detected problem, e.g. re-read the budget table when lines do not reach the stated total. Never force a figure to fit |
| C3 | High | No independent check of key fields | Read | Ask a second, narrow question for each high-impact field: "does this passage state this value for this field?" A failure lowers confidence and does not delete the item |
| C4 | Medium | Re-reading an identical file spends money again and can give a different answer | Read; `sourceHash` is stored but no reuse found in the files read | Reuse within the tenant by hash + model + prompt version, with an explicit "read again" |
| C5 | Medium | **Places (S4).** Merging compares lower-cased names, and only within one area run, while the domain already has `normalizeLocationKey`, which treats "Gulu District" as "Gulu". Likely cause | Read; `places.ts` | Merge through `normalizeLocationKey`; keep the most formal spelling |
| C6 | Medium | **Indicator targets (S6).** A figure must be in the indicator's own quote, so a target stated in another section cannot be linked. Design-caused | Read | A separate link step offering "13,500 from section 7" as a marked suggestion with its own quote |
| C7 | Low | The `prefill.ts` comment says "most frequent cadence", but the code takes the first in a fixed list | Read | Fix the code or the comment |

### D. Reading the document

| # | Sev. | Finding | Evidence | Fix |
|---|---|---|---|---|
| D1 | High | Tables lose their header. A 60-row indicator table became 5 blocks, and none of the 4 later blocks carried the header. Columns such as Baseline and Target are unlabelled there | Ran; `toBlocks` | Repeat the header row in every block of a table, as a label that is not quotable, like `§` |
| D2 | High | PDF proposals use `pdf-parse` flat text, though richer readers exist in `parsers/structured/`. No PDF proposal is in the corpus, and PDF is a common format for signed proposals | Read; `document-parser.ts` | Add PDFs to the corpus first, then choose: structured reader, vision model per table page, or a local layout parser (Docling) |
| D3 | High | OCR runs only when a PDF yields **no** text. A digital PDF with a scanned logframe or budget annex loses those pages with no warning | Read; `ocr-fallback-parser.ts` | Per-page text density check; OCR or vision on empty pages; tell the person which pages were affected |
| D4 | High | Long documents: each area reads at most 14–30k characters. On the 260k synthetic document that was 5–12% per area. This is flagged, but the person cannot do much about it. The recall pass uses the same selection approach | Ran | Build a section map first, then let each area read its chosen sections in full; the current 3-chunk ceiling needs raising for these |
| D5 | Medium | Selection also cuts the real AMAN document: Facts, Periods and Places were truncated, with 36–45% of the text selected | Ran | Same as D4. Check whether this loses anything once the corpus exists |
| D6 | Medium | Section routing is weak on form-style documents. On CBPF, Indicators and Places matched no sections, so keywords decided | Ran | Donor-form profiles (D7) and the section map (D4) |
| D7 | Medium | Standard donor forms get no special handling, yet fixed forms are the easiest case. CBPF's numbered fields could be read by rule | Inferred; `fact-pairs.ts` is a start | A small table of form profiles (label → field), tried first with the model as fallback, like `SHEET_READERS` |

### E. Measurement

| # | Sev. | Finding | Evidence | Fix |
|---|---|---|---|---|
| E1 | Critical | Corpus: one synthetic case, plus one real case run only live. Recorded mode only compares item counts, so it cannot detect a wrong value | Read; `setup-corpus/eval.mjs` | Golden set in section 5 |
| E2 | High | Live eval has not produced a valid result (S10), and prompts were tuned on their own test | Earlier audit | Make the key available; keep a held-out set that is never used for tuning |
| E3 | Medium | No measure of reviewer effort, the number that shows whether the wizard saves time | Read | Log accept / edit / reject per field, as counts only |

### Unchanged from the earlier audit

S2 (no clean unattended launch), S5 (launch order and place links), S7, S8 and S9 still stand. They concern launch and input coverage more than the extraction method.

## 4. Comparison with other approaches

| Practice | Who does it | DonorDesk today | Verdict |
|---|---|---|---|
| Source location for each value | Azure Content Understanding (page, coordinates, span), LlamaExtract (`cite_sources`), Reducto (page, box, text, confidence), LangExtract (character span) | Quote + block, page when known | Good base; **behind** on checking the location and on exact spans (A2) |
| Field confidence used to route review | Azure documents per-field thresholds; LlamaExtract warns its scores are uncalibrated | Model self-rating as a small label | **Behind** (A3) |
| Self-reported confidence as a signal | Research is mixed; one 2026 paper finds logprobs, self-rating and self-consistency all separate errors poorly until calibrated | In use, uncalibrated | **Mistake** if thresholds are added without calibrating on our corpus |
| Native schema output | Claude, OpenAI and Gemini APIs | Prose only | **Behind** (B3) |
| Layout-aware parsing before the model | Docling, Azure, Reducto, LlamaParse | Good for DOCX and sheets; flat for PDF | **Ahead** on Gantt/budget sheets; **behind** on PDF (D2, D3) |
| Multiple passes for recall | LangExtract | One recall pass | On par |
| Repeated reads for consistency | Research: a product-attribute study cut errors from 0.5% to 0.2% by majority vote; a 2025 paper finds diminishing returns on frontier models | Structure votes only | Use selectively, on disagreement or failed checks, and not across the board |
| Human review | All of them | Strong: nothing applies without a person | **Ahead** |
| Rejecting invented or template text | LangExtract filters unlocated items and checks example leakage | Grounding, placeholders, echo check | **Ahead** |

**Sector products.** Searches found no evidence that DevResults, Clear Impact, Fluxx, Instrumentl, Grantable, TolaData or ActivityInfo turn an uploaded proposal into a project setup. That is unverified, not a confirmed gap. The closest found were Logframe Lab (keyword scan of a proposal to suggest indicators), Sopact (generates a logframe from a description) and Submittable's "Smart Import" (third-party review only). Check with vendors before making any public claim.

**Recommendation on vendors:** do not send proposals to a new document vendor now. These files hold personal and sensitive programme data. If PDF tests show a need, try a self-hosted parser first.

## 5. The golden set to build first

- **Documents:** 12–15 real documents, with at least 4 held out from all tuning. Cover CBPF, ECHO, EU, USAID, UN agency and a foundation format; DOCX, digital PDF, a PDF with a scanned annex and XLSX packs; at least one French and one 100+ page document; and logframes both filled and blank. Anonymise or get permission, and keep them out of the repository (as with CBPF).
- **Labels:** the correct value per field, written by a person who did not see the model's answer.
- **Scores per area and field:** precision, recall, value exact-match, parent-link accuracy, budget reconciliation, wrong-value rate among items shown, stability over 5 reads, cost and time.
- **Headline measure: wrong values shown as if read from the document.** It matters more than recall, because a person can see a gap but may miss a plausible wrong number.

Targets should be set after the first baseline. Do not assume numbers in advance.

## 6. Plan, in order

| Stage | Work | Findings | Size | Done when |
|---|---|---|---|---|
| P0 Measure | Golden set, field scorer, live eval, cost prices, reviewer-action counts | E1–E3, B6 | Largest; includes labelling time | Baseline published |
| P1 Stop silent wrongness | Truncation as failure, stricter field grounding, block check, amount reader, count all drops, partial chunk results | B1, A1, A2, A4, A5, B4 | Small to medium | Wrong-value rate falls, recall does not |
| P2 Keep the structure | Table headers in blocks, per-page OCR, place merge fix, PDF route chosen by test | D1, D3, C5, D2 | Medium | PDF and table scores improve |
| P3 Stable output | Structured outputs, stated/inferred chain, keep vote agreement, reuse by hash, examples | B3, C1, C4, B5, B2 | Medium | Same structure across 5 reads on inferred cases, or disagreement shown |
| P4 Verify and repair | Targeted repairs, field verifier, computed confidence, target link step | C2, C3, A3, C6 | Medium to large | Budget reconciliation up; confidence calibrated against the corpus |
| P5 Coverage | Section-map reading for long documents, donor-form profiles | D4–D7 | Medium to large | Long-document recall meets target; cost acceptable |

P1 fixes are clear defects and can proceed in parallel with P0, but record a baseline before merging them where possible. Run the 3–4 cheapest first: B1, D1, C5, A2.

## 7. Decisions needed

1. **Blank logframe.** Recommended: propose one fixed Goal → Outcome → Output → Activity shape, clearly labelled "inferred, not in your document". The alternative is to leave it empty, which is more honest but makes the person do more work.
2. **Golden documents.** Which real proposals can be used, and with what permission?
3. **Names redacted before the model (S17).** Keep as is, or replace names with placeholders such as `PERSON_1` and restore them locally, so team and lead can be read? Recommended: keep as is until P4, then decide. This is a privacy decision.
4. **Extra model cost.** Is a higher cost per read acceptable for verification? This can be decided once P0 shows the cost.

## 8. Sources

- Claude: [structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs), [citations](https://platform.claude.com/docs/en/build-with-claude/citations), [stop reasons](https://platform.claude.com/docs/en/build-with-claude/handling-stop-reasons), [Sonnet 5.5 prompting](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-sonnet-5-5)
- Azure: [Content Understanding overview](https://learn.microsoft.com/en-us/azure/ai-services/content-understanding/overview), [confidence, grounding and review](https://devblogs.microsoft.com/foundry/content-understanding-confidence-grounding-hitl/)
- [LlamaExtract extensions](https://developers.llamaindex.ai/llamaparse/extract/guides/extensions/), [LangExtract](https://github.com/google/langextract), [Reducto comparison (vendor)](https://reducto.ai/compare), [Nutrient on LlamaParse alternatives (vendor)](https://www.nutrient.io/blog/llamaparse-alternatives/)
- Research: [Beyond Logprobs](https://arxiv.org/pdf/2606.24420), [Self-Consistency Is Losing Its Edge](https://arxiv.org/pdf/2511.00751), [consistency for attribute extraction](https://www.aimspress.com/article/doi/10.3934/aci.2026010)
- Sector: [Logframe Lab](https://logframelab.tawk.help/article/what-happens-with-my-proposal), [Sopact](https://www.sopact.com/guides/logframe), [YourCause](https://www.yourcause.com/?p=12324), [Submittable overview (third party)](https://zoftwarehub.com/en-ae/products/submittable/overview)

## 9. Implementation status (2026-11-04)

The owner's decisions replaced some recommendations: blank sections stay blank and are highlighted (C1, C6); teams are entered by a person, so names stay redacted (S17); the heading survey replaces donor-form profiles (D7).

| Finding | Status |
|---|---|
| A1–A5, B1, B3–B6, C1–C5, C7, D1–D6, E1, E3 | Built |
| B2 | Temperature is still not sent to Claude; repeat reads are stable through reply memory (in process, 24 h) |
| C6 | Not built, by decision: an empty target stays empty |
| D2 | Built with the existing PDF reader; a PDF with several columns or borderless tables is untested |
| D7 | Replaced by the heading survey |
| E1, E2 | Scorer and instructions built. **The golden documents and a live run remain open: they need real documents and a key** |
| New | `AREAS_OF_SLIDE` held names the API rejects; fixed |

All of it is tested with fakes or recorded replies. Its effect on real accuracy is unmeasured.

## 10. Deployed and live-checked (2026-11-04)

Releases `20261104222528` (all), then API fixes `20261104224942` and `20261104225444`. Commits `89d3987e`, `11c35c43`, `46f45d84`, `9be91364` on `0017-maps-v2`, not pushed. `PLACE_LOOKUP_URL=https://nominatim.openstreetmap.org` is set in `api.env` (dated backup beside it), and OpenStreetMap is listed on `/subprocessors`.

The CBPF proposal was uploaded 5 times through the live wizard with nothing typed, and the results were read on screen:

| Check | Result |
|---|---|
| Name, code, dates, currency, summary | 5/5 |
| Funding 500,000.30 USD | 5/5 |
| Budget adds up (467,290.00 + PSC 32,710.30) | 4/5. Run 4 showed a duplicated line, fixed in `46f45d84`, and run 5 was correct |
| One Baidoa place, inside Bay, inside Somalia | 5/5 (once spelled "Baidoa District") |
| People-reached indicator | 5/5 |
| Template indicator left out | 4/5. Run 2 kept "Outcome Indicator 1.1 (Custom):.", fixed in `11c35c43` |
| Blank logframe left empty | 5/5 |
| Blank work plan section highlighted | 3/3 checked |
| Place recognised on the web | Correct for Baidoa and Bay. Runs 1–3 matched "Somalia" to a theatre, fixed in `11c35c43` |

Still open: the Results step does not show the blank-section notice for this document's empty results table (the survey assigned non-empty sections too); React #310 still appears on some loads (S9); 5 test drafts remain on the test tenant; donor reads as "CBPF", "CBPF - Somalia" or "SHF".

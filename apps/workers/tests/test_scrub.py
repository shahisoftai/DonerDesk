from app.ai_reporter.scrub import scrub_content

Q = ["Which indicators were not measured this month, and why?"]


def test_bookkeeping_sentences_are_removed_but_figures_stay() -> None:
    text = "ANC4+ reached 57 percent. Every finding carries a neutral evaluation, so the report records no performance judgement. Penta3 fell to 70 percent."
    out = scrub_content(text, [])
    assert "neutral" not in out and "judgement" not in out
    assert "57 percent" in out and "70 percent" in out


def test_echoed_donor_question_is_dropped_and_answer_kept() -> None:
    out = scrub_content("**Which indicators were not measured this month, and why?** Two survey indicators are quarterly.", Q)
    assert out == "Two survey indicators are quarterly."
    assert scrub_content("Which indicators were not measured this month, and why?\n\nTwo are quarterly.", Q) == "Two are quarterly."


def test_table_rows_and_normal_prose_are_untouched() -> None:
    text = "| MR-OC1a | Not calculable | — |\n\nThe project trained 40 health workers."
    assert scrub_content(text, Q) == text


def test_trim_drops_figure_free_sentences_from_the_end_only() -> None:
    from app.ai_reporter.scrub import trim_to_word_limit

    text = "The project trained 40 health workers. It was a good month for everyone involved. Priorities for the coming month are continued mentoring and follow-up."
    out = trim_to_word_limit(text, 12)
    assert "40 health workers" in out and "Priorities" not in out
    assert trim_to_word_limit(text, 100) == text
    only_figures = "The project trained 40 health workers in the five districts of the region this month."
    assert trim_to_word_limit(only_figures, 5) == only_figures

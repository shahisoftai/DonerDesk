"""Donor template rendering (docxtpl) — populates a donor's own uploaded DOCX
template with report content, instead of DonorDesk generating a generic
document. Two-phase:

  1. insert-placeholders: runs ONCE, at mapping-approval time. Walks the
     original DOCX in document order and inserts `{{ placeholderKey }}`
     Jinja2 tags at the mapped region locations. Produces the reusable
     "templated" DOCX.
  2. render: runs on EVERY export, against the cached templated DOCX —
     cheap, no re-parsing of the original file.
"""

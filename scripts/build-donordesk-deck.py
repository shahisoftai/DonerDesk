#!/usr/bin/env python3
"""Build the 20-slide DonorDesk overview deck from content mined out of memorybank/.

Usage:
    pip3 install --target /tmp/pptxlib python-pptx
    PYTHONPATH=/tmp/pptxlib python3 scripts/build-donordesk-deck.py \
        --out DonorDesk-Overview-v2.0-Agent-Memory.pptx

Every fact in the deck is taken from memorybank/ (INDEX.md, base/, Features/,
imp/, docs/architecture/decisions, docs/runbooks, docs/security,
SUPERADMIN-PORTAL.md, contabo-ops.md, CONTABO-DEPLOY.md, pending.md)
as of 2026-09-28.
"""

from __future__ import annotations

import argparse

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.util import Emu, Inches, Pt

# --------------------------------------------------------------------------- #
# Theme
# --------------------------------------------------------------------------- #

FONT = "Calibri"
MONO = "Consolas"

INK = "0F172A"        # slate-900 — headings
BODY = "334155"       # slate-700 — body copy
MUTED = "64748B"      # slate-500 — captions / footers
BLUE = "2563EB"       # brand primary
BLUE_DK = "1E3A8A"    # brand deep
CYAN = "06B6D4"       # brand accent
DARK = "0B1220"       # title-slide background
CARD = "F1F5F9"       # card surface
CARD2 = "F8FAFC"      # alt card surface
BORDER = "E2E8F0"     # hairlines
WHITE = "FFFFFF"
GREEN = "059669"
AMBER = "D97706"
RED = "DC2626"
PURPLE = "7C3AED"

SW = 13.333           # slide width (in)
SH = 7.5              # slide height (in)
ML = 0.62             # left margin
MR = 0.62             # right margin
CW = SW - ML - MR     # content width
TOP = 1.42            # content top
BOTTOM = 6.82         # content bottom
CH = BOTTOM - TOP     # content height

FOOTER_LEFT = "DonorDesk — Version 2.0 (Agent Memory)"



# --------------------------------------------------------------------------- #
# Primitives
# --------------------------------------------------------------------------- #

def blank(prs):
    return prs.slides.add_slide(prs.slide_layouts[6])


def rect(slide, x, y, w, h, fill=None, line=None, radius=None, line_w=1.0):
    kind = MSO_SHAPE.ROUNDED_RECTANGLE if radius is not None else MSO_SHAPE.RECTANGLE
    shp = slide.shapes.add_shape(kind, Inches(x), Inches(y), Inches(w), Inches(h))
    if radius is not None:
        shp.adjustments[0] = radius
    if fill:
        shp.fill.solid()
        shp.fill.fore_color.rgb = RGBColor.from_string(fill)
    else:
        shp.fill.background()
    if line:
        shp.line.color.rgb = RGBColor.from_string(line)
        shp.line.width = Pt(line_w)
    else:
        shp.line.fill.background()
    shp.shadow.inherit = False
    return shp


def oval(slide, x, y, w, h, fill=None, alpha=None):
    shp = slide.shapes.add_shape(MSO_SHAPE.OVAL, Inches(x), Inches(y), Inches(w), Inches(h))
    if fill:
        shp.fill.solid()
        shp.fill.fore_color.rgb = RGBColor.from_string(fill)
    else:
        shp.fill.background()
    shp.line.fill.background()
    shp.shadow.inherit = False
    if alpha is not None:
        # python-pptx has no alpha API; inject <a:alpha> into the solidFill.
        from pptx.oxml.ns import qn
        solid = shp.fill._xPr.find(qn("a:solidFill"))
        if solid is not None:
            clr = solid.find(qn("a:srgbClr"))
            if clr is not None:
                clr.append(clr.makeelement(qn("a:alpha"),
                                           {"val": str(int(alpha * 1000))}))
    return shp


def textbox(slide, x, y, w, h, anchor=MSO_ANCHOR.TOP, wrap=True):
    box = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = box.text_frame
    tf.word_wrap = wrap
    tf.vertical_anchor = anchor
    tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    return tf


def para(tf, text, size=12, bold=False, color=BODY, first=False, italic=False,
         space_before=0, space_after=4, indent=0.0, line_spacing=1.0,
         align=PP_ALIGN.LEFT, font=FONT):
    p = tf.paragraphs[0] if first else tf.add_paragraph()
    p.alignment = align
    p.space_before = Pt(space_before)
    p.space_after = Pt(space_after)
    p.line_spacing = line_spacing
    if indent:
        p.left_indent = Inches(indent)
    run = p.add_run()
    run.text = text
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.italic = italic
    run.font.color.rgb = RGBColor.from_string(color)
    run.font.name = font
    return p


def rich_para(tf, chunks, size=12, color=BODY, first=False, space_before=0,
              space_after=4, indent=0.0, line_spacing=1.0, align=PP_ALIGN.LEFT,
              font=FONT):
    """chunks: list of (text, bold, color|None, size|None)."""
    p = tf.paragraphs[0] if first else tf.add_paragraph()
    p.alignment = align
    p.space_before = Pt(space_before)
    p.space_after = Pt(space_after)
    p.line_spacing = line_spacing
    if indent:
        p.left_indent = Inches(indent)
    for text, bold, ch_color, ch_size in chunks:
        run = p.add_run()
        run.text = text
        run.font.size = Pt(ch_size or size)
        run.font.bold = bold
        run.font.color.rgb = RGBColor.from_string(ch_color or color)
        run.font.name = font
    return p


def footer(slide, number, note=None):
    tf = textbox(slide, ML, 6.99, CW * 0.78, 0.28)
    para(tf, note or FOOTER_LEFT, size=9, color=MUTED, first=True, space_after=0)
    tf2 = textbox(slide, SW - MR - 1.3, 6.99, 1.3, 0.28)
    para(tf2, f"{number} / 20", size=9, color=MUTED, first=True, space_after=0,
         align=PP_ALIGN.RIGHT)


def header(slide, number, title, kicker=None, note=None):
    y = 0.30
    if kicker:
        tf = textbox(slide, ML, y, CW, 0.24)
        para(tf, kicker.upper(), size=9.5, bold=True, color=BLUE, first=True,
             space_after=0)
        y += 0.27
    tf = textbox(slide, ML, y + 0.12, CW, 0.5)
    para(tf, title, size=23, bold=True, color=INK, first=True, space_after=0)
    bar_y = y + 0.70
    rect(slide, ML, bar_y, 1.35, 0.055, fill=BLUE)
    rect(slide, ML + 1.35, bar_y, 0.30, 0.055, fill=CYAN)
    footer(slide, number, note)


def shape_text(shape, lines, anchor=MSO_ANCHOR.MIDDLE, align=PP_ALIGN.LEFT,
               margins=(0.14, 0.14, 0.07, 0.07)):
    tf = shape.text_frame
    tf.word_wrap = True
    tf.vertical_anchor = anchor
    tf.margin_left = Inches(margins[0])
    tf.margin_right = Inches(margins[1])
    tf.margin_top = Inches(margins[2])
    tf.margin_bottom = Inches(margins[3])
    for i, spec in enumerate(lines):
        para(tf, spec.get("text", ""), size=spec.get("size", 11),
             bold=spec.get("bold", False), color=spec.get("color", BODY),
             first=(i == 0), space_after=spec.get("space_after", 2),
             space_before=spec.get("space_before", 0),
             align=spec.get("align", align), italic=spec.get("italic", False),
             line_spacing=spec.get("line_spacing", 1.0))
    return tf


# --------------------------------------------------------------------------- #
# Composite layouts
# --------------------------------------------------------------------------- #

def bullet_list(slide, items, x=ML, y=TOP, w=CW, size=12.5, sub_size=11,
                bullet_color=BLUE, line_spacing=1.05, space_after=5):
    """items: (level, text) or (level, text, color); level 0 = bullet, 1 = sub."""
    tf = textbox(slide, x, y, w, CH)
    first = True
    for item in items:
        level, text = item[0], item[1]
        color = item[2] if len(item) > 2 else None
        if level == 0:
            rich_para(tf, [("▪  ", True, bullet_color, size), (text, False, color, size)],
                      first=first, space_after=space_after, line_spacing=line_spacing)
        else:
            rich_para(tf, [("–  ", False, MUTED, sub_size), (text, False, MUTED, sub_size)],
                      first=first, space_after=space_after - 1, indent=0.30,
                      line_spacing=line_spacing)
        first = False
    return tf


def cards(slide, items, x=ML, y=TOP, w=CW, h=CH, cols=3, gap=0.20,
          title_size=12, body_size=10.5, accent=BLUE, rows=None, fill=CARD):
    """items: dict(title=, body=[lines] or str, accent=, badge=, fill=)."""
    n = len(items)
    rows = rows or (n + cols - 1) // cols
    cw = (w - gap * (cols - 1)) / cols
    chh = (h - gap * (rows - 1)) / rows
    for i, item in enumerate(items):
        r, c = divmod(i, cols)
        cx = x + c * (cw + gap)
        cy = y + r * (chh + gap)
        card = rect(slide, cx, cy, cw, chh, fill=item.get("fill", fill),
                    line=BORDER, radius=0.06)
        rect(slide, cx, cy, 0.055, chh, fill=item.get("accent", accent), radius=0.30)
        tf = card.text_frame
        tf.word_wrap = True
        tf.vertical_anchor = MSO_ANCHOR.TOP
        tf.margin_left = Inches(0.18)
        tf.margin_right = Inches(0.14)
        tf.margin_top = Inches(0.12)
        tf.margin_bottom = Inches(0.10)
        title = item["title"]
        if item.get("badge"):
            title = f"{item['badge']}  {title}"
        para(tf, title, size=title_size, bold=True, color=INK, first=True,
             space_after=4, line_spacing=0.95)
        body = item.get("body", [])
        if isinstance(body, str):
            body = [body]
        for line in body:
            text, kind = line if isinstance(line, tuple) else (line, "body")
            if kind == "sub":
                para(tf, text, size=body_size - 0.6, color=MUTED, space_after=2,
                     indent=0.18, line_spacing=1.02)
            elif kind == "mono":
                para(tf, text, size=body_size - 0.6, color=BLUE_DK, space_after=3,
                     font=MONO, line_spacing=1.0)
            elif kind == "head":
                para(tf, text, size=body_size, bold=True, color=INK, space_after=2,
                     space_before=3)
            else:
                para(tf, text, size=body_size,
                     color=item.get("body_color", BODY), space_after=3,
                     line_spacing=1.02)
    return None


def flow(slide, steps, x=ML, y=TOP, w=CW, h=1.5, gap=0.12, number_size=13,
         label_size=10.5, fill=WHITE, accent=BLUE):
    """steps: list of (label, detail). Draws numbered boxes joined by bars."""
    n = len(steps)
    bw = (w - gap * (n - 1)) / n
    for i, (label, detail) in enumerate(steps):
        bx = x + i * (bw + gap)
        box = rect(slide, bx, y, bw, h, fill=fill, line=BORDER, radius=0.08)
        shape_text(box, [
            {"text": label, "size": label_size + 0.5, "bold": True, "color": INK,
             "space_after": 2},
            {"text": detail, "size": label_size - 0.5, "color": MUTED},
        ], anchor=MSO_ANCHOR.TOP)
        num = oval(slide, bx + bw - 0.44, y - 0.17, 0.36, 0.36, fill=accent)
        shape_text(num, [{"text": str(i + 1), "size": number_size, "bold": True,
                          "color": WHITE, "align": PP_ALIGN.CENTER}],
                   anchor=MSO_ANCHOR.MIDDLE, align=PP_ALIGN.CENTER,
                   margins=(0.0, 0.0, 0.0, 0.0))
        if i < n - 1:
            rect(slide, bx + bw, y + h / 2 - 0.015, gap, 0.03, fill=BORDER)



def table(slide, headers, rows, x=ML, y=TOP, w=CW, col_widths=None,
          size=10, head_size=10.5, row_h=0.34, head_h=0.36, head_fill=BLUE_DK,
          zebra=CARD2):
    shape = slide.shapes.add_table(len(rows) + 1, len(headers), Inches(x),
                                   Inches(y), Inches(w), Inches(head_h))
    tbl = shape.table
    tbl.first_row = False
    tbl.horz_banding = False
    if col_widths:
        total = sum(col_widths)
        for i, cwid in enumerate(col_widths):
            tbl.columns[i].width = Emu(int(Inches(w) * (cwid / total)))
    for c, head in enumerate(headers):
        cell = tbl.cell(0, c)
        cell.fill.solid()
        cell.fill.fore_color.rgb = RGBColor.from_string(head_fill)
        cell.margin_left = cell.margin_right = Inches(0.08)
        cell.margin_top = cell.margin_bottom = Inches(0.04)
        cell.vertical_anchor = MSO_ANCHOR.MIDDLE
        tf = cell.text_frame
        tf.word_wrap = True
        para(tf, head, size=head_size, bold=True, color=WHITE, first=True,
             space_after=0)
    for r, row in enumerate(rows, start=1):
        tbl.rows[r].height = Inches(row_h)
        for c, value in enumerate(row):
            cell = tbl.cell(r, c)
            cell.fill.solid()
            cell.fill.fore_color.rgb = RGBColor.from_string(WHITE if r % 2 else zebra)
            cell.margin_left = cell.margin_right = Inches(0.08)
            cell.margin_top = cell.margin_bottom = Inches(0.03)
            cell.vertical_anchor = MSO_ANCHOR.MIDDLE
            tf = cell.text_frame
            tf.word_wrap = True
            para(tf, value, size=size, bold=(c == 0), color=INK if c == 0 else BODY,
                 first=True, space_after=0, line_spacing=0.95)
    tbl.rows[0].height = Inches(head_h)
    return tbl


def kpi_strip(slide, kpis, x=ML, y=TOP, w=CW, h=1.0, gap=0.18):
    """kpis: list of (value, caption, color)."""
    n = len(kpis)
    bw = (w - gap * (n - 1)) / n
    for i, (value, caption, color) in enumerate(kpis):
        bx = x + i * (bw + gap)
        box = rect(slide, bx, y, bw, h, fill=CARD, line=BORDER, radius=0.08)
        shape_text(box, [
            {"text": value, "size": 20, "bold": True, "color": color, "space_after": 1},
            {"text": caption, "size": 9.5, "color": MUTED, "line_spacing": 1.0},
        ], anchor=MSO_ANCHOR.MIDDLE, align=PP_ALIGN.CENTER,
            margins=(0.08, 0.08, 0.04, 0.04))


def panel(slide, x, y, w, h, title, lines, accent=BLUE, fill=CARD,
          title_size=12, body_size=10.5):
    box = rect(slide, x, y, w, h, fill=fill, line=BORDER, radius=0.06)
    rect(slide, x, y, w, 0.05, fill=accent, radius=0.30)
    tf = box.text_frame
    tf.word_wrap = True
    tf.vertical_anchor = MSO_ANCHOR.TOP
    tf.margin_left = Inches(0.18)
    tf.margin_right = Inches(0.16)
    tf.margin_top = Inches(0.16)
    tf.margin_bottom = Inches(0.10)
    para(tf, title, size=title_size, bold=True, color=INK, first=True, space_after=5)
    for line in lines:
        text, kind = line if isinstance(line, tuple) else (line, "body")
        if kind == "sub":
            para(tf, text, size=body_size - 0.5, color=MUTED, space_after=2,
                 indent=0.20, line_spacing=1.02)
        elif kind == "mono":
            para(tf, text, size=body_size - 0.5, color=BLUE_DK, space_after=3,
                 font=MONO, line_spacing=1.0)
        elif kind == "head":
            para(tf, text, size=body_size, bold=True, color=INK, space_after=2,
                 space_before=4)
        else:
            para(tf, text, size=body_size, color=BODY, space_after=3,
                 line_spacing=1.02)
    return box


def quote(slide, text, x=ML, y=TOP, w=CW, h=0.85, fill=INK, accent=CYAN,
          size=13.5):
    box = rect(slide, x, y, w, h, fill=fill, radius=0.06)
    rect(slide, x, y, 0.07, h, fill=accent)
    tf = box.text_frame
    tf.word_wrap = True
    tf.vertical_anchor = MSO_ANCHOR.MIDDLE
    tf.margin_left = Inches(0.24)
    tf.margin_right = Inches(0.2)
    para(tf, text, size=size, bold=True, color=WHITE, first=True, space_after=0,
         line_spacing=1.05)
    return box



# --------------------------------------------------------------------------- #
# Slide 1 — Title
# --------------------------------------------------------------------------- #

def s01_title(prs):
    slide = blank(prs)
    rect(slide, 0, 0, SW, SH, fill=DARK)
    oval(slide, 8.4, -1.9, 7.4, 7.4, fill=BLUE, alpha=18)
    oval(slide, 10.4, 3.6, 5.6, 5.6, fill=CYAN, alpha=12)
    rect(slide, 0, 0, SW, 0.10, fill=BLUE)
    rect(slide, 0, 0.10, 3.2, 0.10, fill=CYAN)

    tf = textbox(slide, ML, 1.55, 9.4, 0.34)
    para(tf, "PRODUCT BRIEF  ·  BUILT FROM memorybank/", size=10.5, bold=True,
         color=CYAN, first=True, space_after=0)

    tf = textbox(slide, ML, 2.05, 10.4, 1.5)
    para(tf, "DonorDesk", size=54, bold=True, color=WHITE, first=True, space_after=4)
    para(tf, "AI-powered donor reporting and evidence compliance platform",
         size=19, color="CBD5E1", space_after=0)

    rect(slide, ML, 3.95, 2.0, 0.055, fill=CYAN)

    tf = textbox(slide, ML, 4.22, 9.6, 1.1)
    para(tf, "From messy field evidence to donor-ready reports and "
             "compliance-ready documentation.", size=15, bold=True, color=WHITE,
         first=True, space_after=6)
    para(tf, "Turning scattered field updates, logframes, indicator data and "
             "donor templates into source-linked reports and audit-ready "
             "evidence packs — with humans holding the approve button.",
         size=11.5, color="94A3B8", space_after=0, line_spacing=1.15)

    pills = [("Version 2.0", CYAN), ("Agent Memory", BLUE),
             ("21 features", PURPLE), ("Multi-tenant SaaS", GREEN)]
    px = ML
    for text, color in pills:
        w = 0.34 + 0.115 * len(text)
        pill = rect(slide, px, 5.66, w, 0.36, fill="16213A", line=color, radius=0.45)
        shape_text(pill, [{"text": text, "size": 10.5, "bold": True, "color": color,
                           "align": PP_ALIGN.CENTER}], align=PP_ALIGN.CENTER,
                   margins=(0.06, 0.06, 0.0, 0.0))
        px += w + 0.16

    tf = textbox(slide, ML, 6.55, 11.0, 0.5)
    para(tf, "Sources: memorybank/INDEX.md · base/ · Features/ · imp/ · "
             "docs/architecture/decisions (ADR 0001–0009) · docs/runbooks · "
             "SUPERADMIN-PORTAL.md · contabo-ops.md · CONTABO-DEPLOY.md · "
             "pending.md  (state as of 2026-09-28)", size=9, color=MUTED,
         first=True, space_after=0, line_spacing=1.1)


# --------------------------------------------------------------------------- #
# Slide 2 — Agenda
# --------------------------------------------------------------------------- #

def s02_agenda(prs):
    slide = blank(prs)
    header(slide, 2, "What this deck covers",
           kicker="Agenda", note="20 slides · problem → product → platform → Version 2.0 → operations")
    cards(slide, [
        {"badge": "01", "title": "The opportunity", "accent": BLUE,
         "body": ["Slide 3  The reporting problem",
                  "Slide 4  The DonorDesk solution",
                  "Slide 5  Who it is for",
                  "Slide 6  Core concepts and vocabulary"]},
        {"badge": "02", "title": "Product surface", "accent": CYAN,
         "body": ["Slide 7  End-to-end workflow",
                  "Slide 8  Foundation features (01–05, 18)",
                  "Slide 9  Delivery features (06–17)",
                  "Slide 10  Report sections as a fixed markdown subset"]},
        {"badge": "03", "title": "Architecture", "accent": PURPLE,
         "body": ["Slide 11  Hexagonal monorepo and bounded contexts",
                  "Slide 12  Tech stack and platform choices",
                  "Slide 13  Multi-tenancy, security, threat model",
                  "Slide 14  Deployment topology on Contabo"]},
        {"badge": "04", "title": "The AI layer", "accent": GREEN,
         "body": ["Slide 15  AI Reporter: deterministic core, LLM prose",
                  "Slide 16  Assurance: revisions, verifier, snapshots",
                  "Slide 17  Compliance, readiness score, review",
                  "Slide 18  Exports and donor-native rendering"]},
        {"badge": "05", "title": "Version 2.0", "accent": AMBER,
         "body": ["Slide 19  Agent Memory — learning reviewer style",
                  "Slide 20  Guardrails, business model, control plane, roadmap"]},
        {"badge": "—", "title": "How to read this deck", "accent": MUTED,
         "body": ["Every claim is traceable to a memorybank document.",
                  "ADRs 0001–0009 record the load-bearing decisions.",
                  "Feature numbers match memorybank/Features/.",
                  "Where something is partial or gated, the slide says so."]},
    ], cols=3, rows=2, title_size=13, body_size=10.5)


# --------------------------------------------------------------------------- #
# Slide 3 — The problem
# --------------------------------------------------------------------------- #

def s03_problem(prs):
    slide = blank(prs)
    header(slide, 3, "NGO reporting is still manual, scattered and reactive",
           kicker="The problem",
           note="base/DonorDesk — One-Page Concept Note for Approval.md · docs/support/basic-information/what-is-donordesk.md")
    bullet_list(slide, [
        (0, "Reports take too long to prepare — a mix of Excel, Word, WhatsApp, "
            "email, Google Drive, Kobo/ODK exports and paper records."),
        (0, "Evidence is scattered across folders and devices, so it is hard to "
            "find and harder to verify."),
        (0, "Indicator achievements are not linked to proof — the claimed number "
            "and the attendance sheet live in different worlds."),
        (0, "Donor templates are reformatted by hand every reporting cycle."),
        (0, "Missing annexes and required documents are discovered too late — "
            "often the week of the deadline."),
        (0, "Audit preparation becomes stressful and reactive rather than "
            "continuous."),
        (0, "Institutional knowledge is lost when staff change; the next grants "
            "officer starts from zero."),
    ], w=7.35, size=12.5, space_after=9)

    panel(slide, 8.25, TOP, CW - 7.63, CH, "Where that lands", [
        ("Delayed submissions", "head"),
        ("Reports slip past the donor deadline and start the next cycle in "
         "deficit.", "body"),
        ("Weak evidence trails", "head"),
        ("Claims in the narrative cannot be traced back to the exact file that "
         "proves them.", "body"),
        ("Donor dissatisfaction and compliance risk", "head"),
        ("Missing annexes, unverified indicators and unsupported claims surface "
         "as findings or audit observations.", "body"),
        ("Reporting stress", "head"),
        ("The team rewrites instead of reviewing; quality depends on who is on "
         "leave.", "body"),
    ], accent=RED, fill="FEF2F2", title_size=13, body_size=10)

    quote(slide, "Generic AI tools can write text — but they cannot prove "
                 "whether a donor report is supported by the right evidence.",
          y=5.62, h=0.95, fill=INK, accent=CYAN, size=13.5)


# --------------------------------------------------------------------------- #
# Slide 4 — The solution
# --------------------------------------------------------------------------- #

def s04_solution(prs):
    slide = blank(prs)
    header(slide, 4, "One workspace for reporting, evidence and compliance",
           kicker="The solution",
           note="base/DonorDesk — One-Page Concept Note for Approval.md §4/§6 · base/MVP-features.md §2–3")
    quote(slide, "From messy field evidence to donor-ready reports and "
                 "compliance-ready documentation.", y=TOP - 0.02, h=0.72,
          fill=INK, accent=CYAN, size=15)

    bullet_list(slide, [
        (0, "Create a donor-funded project workspace and connect the donor reporting template."),
        (0, "Upload or enter the logframe and indicators; track achievements per reporting period."),
        (0, "Upload field evidence — photos, attendance sheets, training records, procurement files."),
        (0, "Submit activity updates as the work happens, from the field."),
        (0, "Map evidence to activities, outputs, indicators and donor requirements."),
        (0, "Generate an AI-assisted donor report draft, section by section, with source references."),
        (0, "See exactly what is missing: evidence gaps, unverified indicators, unsupported claims, missing annexes."),
        (0, "Export the final report and the evidence checklist / evidence pack for submission."),
    ], w=7.35, y=TOP + 0.86, size=12, space_after=7)

    panel(slide, 8.25, TOP + 0.86, CW - 7.63, CH - 0.86, "How DonorDesk stays honest", [
        ("The AI writes, the system proves", "head"),
        ("Numbers, tables, charts and deltas are computed deterministically "
         "from verified findings; the LLM only writes prose.", "body"),
        ("Nothing ships unapproved", "head"),
        ("Every AI output is an editable draft. Human approval gates every "
         "donor-facing export.", "body"),
        ("Traceability by default", "head"),
        ("Statements carry sources (activity, evidence, indicator); the audit "
         "log records every mutation.", "body"),
    ], accent=GREEN, fill="ECFDF5", title_size=13, body_size=10)




# --------------------------------------------------------------------------- #
# Slide 5 — Who it is for
# --------------------------------------------------------------------------- #

def s05_users(prs):
    slide = blank(prs)
    header(slide, 5, "Built for the people who actually file donor reports",
           kicker="Target users",
           note="base/DonorDesk — One-Page Concept Note for Approval.md §5 · base/MVP-features.md §4–5 · docs/support/basic-information/key-concepts.md")
    cards(slide, [
        {"badge": "Organisations", "title": "Who buys it", "accent": BLUE,
         "body": ["Local and national NGOs",
                  "Small and mid-sized INGOs",
                  "UN implementing partners",
                  "Government grant-funded programmes",
                  "Research institutions",
                  "Humanitarian consultants and donor-funded programme units"]},
        {"badge": "Roles", "title": "Who uses it daily", "accent": CYAN,
         "body": ["Owner / Admin — organisation profile, team, billing, projects",
                  "Project Manager — setup, oversight, final approval",
                  "M&E Officer — logframe, indicators, data verification",
                  "Grants / Reporting Officer — drafts, edits, exports",
                  "Field Officer — activity updates and evidence uploads",
                  "Compliance / Finance Officer — procurement and audit documents"]},
        {"badge": "Sectors", "title": "Where it lands first", "accent": GREEN,
         "body": ["Nutrition · Food security",
                  "Health · WASH",
                  "Education · Protection",
                  "Livelihoods",
                  "Emergency response",
                  "Works today against real templates: ECHO, EERP/BE NOFO, "
                  "Global Health Fund style monthly and quarterly formats"]},
    ], y=TOP, h=3.05, title_size=13, body_size=10.5)

    panel(slide, ML, TOP + 3.25, CW, 1.6, "What each role is allowed to do is a capability, not a job title", [
        "Seven tenant roles map onto explicit capabilities (create projects, "
        "upload templates, resolve claims, manage agent memory, approve final "
        "reports, export for submission, manage billing).",
        "Invitations, role assignment, and per-project membership are managed in "
        "Team; SuperAdmin is deliberately NOT a tenant role, so a tenant "
        "administrator can never escalate into the platform control plane.",
    ], accent=PURPLE, fill=CARD, title_size=12.5, body_size=10.5)


# --------------------------------------------------------------------------- #
# Slide 6 — Core concepts
# --------------------------------------------------------------------------- #

def s06_concepts(prs):
    slide = blank(prs)
    header(slide, 6, "The vocabulary a donor-reporting workspace needs",
           kicker="Core concepts",
           note="docs/support/basic-information/key-concepts.md · base/MVP-features.md §33 · Features/06, 07, 10, 12")
    table(slide, ["Concept", "What it means in DonorDesk"], [
        ["Workspace", "Your organisation's isolated space — all projects, people, templates and reports. No tenant can see another tenant's data."],
        ["Project", "A single donor-funded initiative (e.g. \"Maternal Health — District X\") with its own logframe, evidence, activities, periods and team."],
        ["Logframe", "The hierarchical plan: Goal → Outcome → Output → Activity, each level backed by indicators."],
        ["Indicator", "Target, baseline, current value and unit — tracked per reporting period, verified per row, with full update history."],
        ["Evidence", "Any document, photo or file that proves the work happened: attendance sheets, training records, field reports, procurement files."],
        ["Reporting period", "The time window being reported (monthly, quarterly, semi-annual, annual) with a donor deadline and a status."],
        ["Compliance checklist", "Automatically detected gaps — missing evidence, unverified indicators, unsupported claims, missing annexes — each with severity."],
        ["Report draft", "The narrative report, built section by section; each section can be written manually or AI-drafted, then edited and approved."],
        ["Readiness score", "A weighted completeness figure for the period, shown before submission."],
    ], y=TOP, col_widths=[1.55, 5.85], size=9.2, row_h=0.36, head_h=0.32, w=7.85)

    panel(slide, ML + 8.05, TOP, CW - 8.05, CH, "Readiness score", [
        ("Section completion", "head"), ("25%", "sub"),
        ("Indicator updates", "head"), ("20%", "sub"),
        ("Evidence completeness", "head"), ("25%", "sub"),
        ("Compliance checklist", "head"), ("20%", "sub"),
        ("Approval status", "head"), ("10%", "sub"),
        ("Worked example", "head"),
        ("80·0.25 + 70·0.20 + 60·0.25 + 50·0.20 + 0·0.10 = 59%", "mono"),
    ], accent=BLUE, fill=CARD, title_size=12.5, body_size=10)




# --------------------------------------------------------------------------- #
# Slide 7 — End-to-end workflow
# --------------------------------------------------------------------------- #

def s07_workflow(prs):
    slide = blank(prs)
    header(slide, 7, "The workflow, end to end — and what runs behind it",
           kicker="How it works",
           note="docs/support/basic-information/what-is-donordesk.md · base/MVP-features.md §32 · imp/DonorDesk — Phased Implementation Plan.md §5.7")
    flow(slide, [
        ("Set up", "Create project, donor template, logframe and team"),
        ("Track", "Upload evidence, log activities, update indicators"),
        ("Assess", "Checklist gaps, verification, readiness score"),
        ("Generate", "AI-drafted sections from verified findings"),
        ("Review", "Edit, resolve claims, approve sections"),
        ("Submit", "Seal snapshot, export DOCX/PDF + evidence pack"),
    ], y=TOP + 0.12, h=1.3, label_size=10.5)

    cards(slide, [
        {"title": "The happy path is four actions", "accent": BLUE,
         "body": ["Select period → Generate → Review → Submit.",
                  "No compulsory planner, semantics, mapping or claim-management "
                  "screens; one consolidated exception surface at submission.",
                  "Backend sophistication must never become frontend paperwork."]},
        {"title": "Background work (silent)", "accent": CYAN,
         "body": ["Evidence parsing (Tika → extracted text), chunking and "
                  "embedding for retrieval.",
                  "Readiness recompute, checklist generation, deadline "
                  "reminders, export on close.",
                  "Dispatched through one BackgroundRunner and an IJobQueue port."]},
        {"title": "Queue is a deployment detail", "accent": PURPLE,
         "body": ["JOB_QUEUE = memory (default, in-process) | redis (BullMQ) | "
                  "kestra (flow trigger).",
                  "Domain events → jobs via the OutboxEventBus; writes are "
                  "idempotency-keyed so retries never double-apply.",
                  "Handlers are registered per job class in JOB_NAMES."]},
    ], y=TOP + 1.68, h=3.15, cols=3, title_size=12, body_size=10)

    quote(slide, "Zero compulsory screens, one exception surface, and a human "
                 "decision only where judgment is actually required.",
          y=6.28, h=0.5, fill=DARK, accent=CYAN, size=12)


# --------------------------------------------------------------------------- #
# Slide 8 — Foundation features
# --------------------------------------------------------------------------- #

def s08_foundation(prs):
    slide = blank(prs)
    header(slide, 8, "Foundation: identity, workspace, projects, donor templates",
           kicker="Feature map 1 of 2 · Features 01–05, 18",
           note="memorybank/Features/01–05, 18 · Features/INDEX.md · imp/Phase20_setup_logframe.md")
    cards(slide, [
        {"badge": "F01", "title": "Authentication & onboarding", "accent": BLUE,
         "body": ["Email/password signup and login; Google Sign-In on the login "
                  "page (env-gated, existing accounts only).",
                  "JWT (HS256) with issuer/audience claims; secrets in env.",
                  "Every new workspace starts on the free STARTER tier — no "
                  "trials are granted (removed 2026-08-18)."]},
        {"badge": "F02", "title": "Organization workspace", "accent": BLUE,
         "body": ["Organisation profile: name, type, country, sectors, contacts "
                  "— printed onto reports.",
                  "Per-tenant settings: reporting defaults, storage provider "
                  "(Google Drive link-first / R2 / local), AI enablement.",
                  "Hard tenant isolation at every layer (slide 13)."]},
        {"badge": "F03", "title": "Users & role management", "accent": BLUE,
         "body": ["Invitations, role assignment, project membership.",
                  "Capabilities cover project creation, template upload, claim "
                  "resolution, agent-memory management, final approval, "
                  "submission export and billing.",
                  "SUPER_ADMIN deliberately never appears in tenant role lists."]},
        {"badge": "F04 + F18", "title": "Project setup & creation wizard",
         "accent": CYAN,
         "body": ["Project metadata, donor(s), sectors, geography, duration and "
                  "reporting cadence.",
                  "Guided wizard for first-run setup; multi-donor and "
                  "project-template support.",
                  "Period dates and donor deadlines are derived from report type "
                  "+ project bounds."]},
        {"badge": "F05", "title": "Donor Template Manager v2", "accent": GREEN,
         "body": ["Upload DOCX/PDF/XLSX/CSV; structure-preserving parse; "
                  "TOC-first extraction (v2) returns the whole outline, with "
                  "heading levels read from DOCX formatting or PDF font size.",
                  "Lifecycle EXTRACTING → NEEDS_REVIEW → REVIEWED; every edit is "
                  "a new version snapshot; report rules live in requirements JSON.",
                  "Donor instructions, mandatory questions, evidence needed, "
                  "required tables, page limits and author guidance all reach "
                  "the writers."]},
        {"badge": "Gate", "title": "A full draft needs a REVIEWED template",
         "accent": AMBER,
         "body": ["Generation pins the reviewed template into the reporting "
                  "period snapshot; section regenerate uses the same pin.",
                  "Guidance-only sections (\"include in report\" off) are "
                  "excluded from the report but still inform the writer.",
                  "Extraction never falls back silently: ungrounded items are "
                  "dropped and the heuristic outline is always flagged."]},
    ], y=TOP, h=CH, cols=3, rows=2, title_size=12, body_size=9.8)



# --------------------------------------------------------------------------- #
# Slide 9 — Delivery features
# --------------------------------------------------------------------------- #

def s09_delivery(prs):
    slide = blank(prs)
    header(slide, 9, "Delivery: data in, drafts out, gaps surfaced",
           kicker="Feature map 2 of 2 · Features 06–17",
           note="memorybank/Features/06–17 · Features/INDEX.md · memorybank/features.md (frontend phases 0–7)")
    cards(slide, [
        {"badge": "F06", "title": "Logframe & indicator manager",
         "accent": BLUE,
         "body": ["Goal → Outcome → Output → Activity hierarchy with "
                  "Goals/Outcomes/Outputs/Activities templates for import.",
                  "Per-period spreadsheet grid at "
                  "/projects/[id]/reports/[periodId]/indicators: bulk upsert, "
                  "unique (indicator, period), per-row submit/verify.",
                  "Google Sheets import via "
                  "POST /v1/indicator-updates/parse-sheet; indicator history via "
                  "GET /v1/indicators/:id/updates."]},
        {"badge": "F07 + F08", "title": "Evidence library & AI tagging",
         "accent": CYAN,
         "body": ["Upload photos, attendance sheets, training records, field "
                  "visit reports, procurement and monitoring documents.",
                  "Document text is persisted as EvidenceFile.extractedText "
                  "(Tika flow) and chunked into retrievable evidence packages.",
                  "Tagging, verification and linking to activities/indicators; "
                  "storage is Google Drive link-first by default, R2 or local "
                  "per tenant."]},
        {"badge": "F09 + F10", "title": "Activity updates & periods",
         "accent": PURPLE,
         "body": ["Structured \"tell the story\" field reporting instead of free "
                  "WhatsApp text; flexible Excel/CSV and field-report inputs.",
                  "Reporting period manager: cadence, dates, donor deadline, "
                  "status; reminder jobs and notifications.",
                  "Period-linked evidence union drives the evidence readiness "
                  "figure."]},
        {"badge": "F12", "title": "Missing evidence & compliance checklist",
         "accent": AMBER,
         "body": ["Compares donor requirements, logframe means of verification, "
                  "activities and evidence; generates actionable items.",
                  "Item types: missing evidence, incomplete metadata, unverified "
                  "indicator, unsupported claim, missing annex/procurement/"
                  "approval/disaggregation, late update, sensitive-data warning, "
                  "unreviewed AI output.",
                  "Severity Low → Critical; owner, due date, resolution notes."]},
        {"badge": "F13 + F15", "title": "Review, approval & dashboard",
         "accent": GREEN,
         "body": ["Comments on sections, evidence, indicators, checklist items "
                  "and activity updates; M&E, compliance and PM approval steps.",
                  "Approval requires: sections complete, critical items resolved "
                  "or accepted, indicator updates verified, evidence attached, "
                  "sensitive files reviewed.",
                  "Dashboard shows readiness snapshot, deadline overview, urgent "
                  "flags and workspace health."]},
        {"badge": "F16 + F17", "title": "Audit log & settings",
         "accent": MUTED,
         "body": ["Every mutation writes an audit event; hash-chained WORM "
                  "notarisation is the Phase 2/3 target; PII redaction in logs.",
                  "Settings: organisation profile, reporting defaults, storage, "
                  "notifications, team, billing, AI settings and (v2.0) the "
                  "\"AI Writing Style\" tab.",
                  "Audit streams are partitioned per tenant for export and "
                  "GDPR right-to-erasure."]},
    ], y=TOP, h=CH, cols=3, rows=2, title_size=12, body_size=9.6)




# --------------------------------------------------------------------------- #
# Slide 10 — Section markdown contract and Report Editor v2
# --------------------------------------------------------------------------- #

def s10_editor(prs):
    slide = blank(prs)
    header(slide, 10, "Section content is a contract, not free-form HTML",
           kicker="Report editor & content invariant",
           note="AGENTS.md §\"Report section content = a fixed markdown subset\" · memorybank/pending.md (Report Editor v2 P7)")
    panel(slide, ML, TOP, 5.93, 3.4, "One markdown subset — three renderers", [
        ("Allowed constructs", "head"),
        ("Paragraphs · ###/#### headings · - and 1. lists · > quotes · GFM "
         "tables · **bold** · *italic* · `code` · [label](url).", "body"),
        ("Enforced on every save", "head"),
        ("normalizeSectionMarkdown runs inside UpdateReportSectionHandler for "
         "manual saves; the rich-text editor enables only these constructs and "
         "converts its output with toStorageMarkdown.", "body"),
        ("Adding a construct is a three-renderer change", "head"),
        ("Teach the exporters first, then extend the parity and round-trip "
         "tests — otherwise the editor can produce text the donor DOCX cannot "
         "render.", "body"),
    ], accent=BLUE, fill=CARD, title_size=12.5, body_size=10)

    panel(slide, ML + 6.16, TOP, CW - 6.16, 3.4, "Report Editor v2 invariants", [
        ("Version = stored ReportSection.updatedAt", "head"),
        ("Handlers return the version read back after assurance; clients send it "
         "as expectedVersion — so stale saves are rejected, not silently merged.",
         "body"),
        ("Claims are re-created by every assurance pass", "head"),
        ("Never hold a claim id across a save/resolve/re-check — use the id "
         "returned by resolve; decisions follow the fingerprint.", "body"),
        ("EXCLUDED means left out", "head"),
        ("Exports strip excluded statements via omitExcludedStatements.", "body"),
        ("Background work goes through BackgroundRunner", "head"),
        ("The api awaits container.settleBackgroundWork() before disconnecting "
         "the request's Prisma client.", "body"),
    ], accent=PURPLE, fill=CARD, title_size=12.5, body_size=10)

    table(slide, ["Renderer", "Surface it must render", "Paired test"], [
        ["markdown-renderer.ts", "DOCX and PDF exports from infrastructure",
         "test/export-markdown-renderer.test.mjs"],
        ["markdown_docx.py (workers)", "Donor templates rendered with docxtpl",
         "tests/test_donor_template.py"],
        ["StaticSectionView (web)", "Read-only section rendering in the portal",
         "web/tests/unit/rich-text-roundtrip.test.mts"],
    ], y=TOP + 3.58, col_widths=[2.2, 4.2, 3.6], size=9.8, row_h=0.32, head_h=0.32)


# --------------------------------------------------------------------------- #
# Slide 11 — Architecture
# --------------------------------------------------------------------------- #

def s11_architecture(prs):
    slide = blank(prs)
    header(slide, 11, "Hexagonal monorepo: one deployable port, many bounded contexts",
           kicker="Architecture",
           note="imp/DonorDesk — Phased Implementation Plan.md §1/§3/§4 · AGENTS.md architecture rules · ADR-0003")
    layers = [
        ("apps/web", "Next.js App Router — RSC for reads, server actions for writes", BLUE),
        ("apps/api", "Fastify — thin, Zod-validated routes wired to handlers", BLUE),
        ("apps/workers", "FastAPI — AI Reporter, parsers, donor-template rendering", PURPLE),
    ]
    y = TOP + 0.05
    for name, desc, color in layers:
        box = rect(slide, ML, y, 5.9, 0.62, fill=WHITE, line=BORDER, radius=0.10)
        rect(slide, ML, y, 0.055, 0.62, fill=color)
        shape_text(box, [
            {"text": name, "size": 11.5, "bold": True, "color": INK, "space_after": 1},
            {"text": desc, "size": 9.5, "color": MUTED},
        ], anchor=MSO_ANCHOR.MIDDLE)
        y += 0.7
    pkgs = [
        ("packages/application", "use-case handlers + ports (no concrete adapters)"),
        ("packages/domain", "pure TypeScript — entities, VOs, events, policies"),
        ("packages/infrastructure", "Prisma, storage, LLM, parsers, exports, audit"),
        ("packages/contracts", "Zod schemas + OpenAPI shared by api, web, workers"),
    ]
    y += 0.05
    for name, desc in pkgs:
        box = rect(slide, ML, y, 5.9, 0.44, fill=CARD, line=BORDER, radius=0.12)
        shape_text(box, [
            {"text": name, "size": 10.5, "bold": True, "color": BLUE_DK,
             "space_after": 0},
            {"text": desc, "size": 9, "color": MUTED, "space_after": 0},
        ], anchor=MSO_ANCHOR.MIDDLE)
        y += 0.5
    tf = textbox(slide, ML, y + 0.02, 5.9, 0.3)
    para(tf, "api → application → domain ← infrastructure", size=10.5, bold=True,
         color=BLUE, first=True, space_after=0, font=MONO)

    panel(slide, ML + 6.16, TOP, CW - 6.16, 2.72, "Rules that hold the shape", [
        "Domain depends on nothing but TypeScript; application defines ports and "
        "never imports an adapter. One repository per aggregate.",
        "Expected failures use Result<T, DomainError> — no exceptions; domain "
        "events are pulled with pullEvents() and the outbox maps them to jobs.",
        "Every aggregate root carries tenantId (or tenantIdValue when persisted) "
        "as its first field.",
        "Swapping a technology is an env-var or one container line: LLM provider, "
        "job queue, storage provider, billing provider, auth.",
    ], accent=GREEN, fill="ECFDF5", title_size=12, body_size=9.8)

    panel(slide, ML + 6.16, TOP + 2.9, CW - 6.16, 2.5,
          "Twelve bounded contexts", [
        "Identity & Access · Projects (kernel) · Templates · Logframe · Evidence "
        "· Activities · Reporting · Compliance · Exports · Notifications · "
        "Audit (append-only) · Billing.",
        "Evidence, Logframe, Templates, Activities, Compliance and Reporting are "
        "supporting contexts; Billing and Notifications are generic. ACLs keep "
        "Reporting and Evidence apart, and Compliance and Reporting apart.",
    ], accent=BLUE, fill=CARD, title_size=12, body_size=9.8)




# --------------------------------------------------------------------------- #
# Slide 12 — Tech stack
# --------------------------------------------------------------------------- #

def s12_stack(prs):
    slide = blank(prs)
    header(slide, 12, "The stack, and why each piece is that piece",
           kicker="Technology",
           note="imp/DonorDesk — Phased Implementation Plan.md §7 · ADR 0001–0004 · AGENTS.md build/test commands")
    table(slide, ["Concern", "Choice", "Why"], [
        ["Monorepo", "pnpm workspaces + Turborepo", "Fast, deterministic, cached; one typecheck/build across 9 packages"],
        ["Frontend", "Next.js App Router (RSC + server actions)", "SSR marketing, RSC dashboards, fewer round-trips for writes"],
        ["UI", "Tailwind + shadcn/ui + Radix", "Accessible and headless; light/dark tokens with no flash of wrong theme"],
        ["API", "Fastify with a hand-wired container", "NestJS-equivalent guards and validation, ~50% less boilerplate (ADR-0003)"],
        ["Domain & application", "Pure TypeScript, strict mode", "Testable without infrastructure; no SDK ever leaks inward"],
        ["Workers", "Python FastAPI (uvicorn)", "Best AI/document ecosystem; out-of-process so AI never blocks the API"],
        ["Database", "PostgreSQL 16 + RLS + pgvector", "ACID, JSONB for template requirements, vectors without a second store"],
        ["ORM & migrations", "Prisma + separate SQL for RLS policies", "Typed client; policies are not representable in the Prisma schema"],
        ["Async work", "IJobQueue: memory | BullMQ/Redis | Kestra", "One port, three backends; the queue is a deployment detail (ADR-0004)"],
        ["Storage", "Google Drive link-first | Cloudflare R2 | local", "NGOs keep files in their own Drive; managed storage is metered"],
        ["LLM providers", "MiniMax · DeepSeek · Claude (SDK) · Gemini · stub", "One active provider per scope, resolved per generation (ADR-0002)"],
        ["Auth", "JWT HS256 + Google Sign-In (env-gated)", "Issuer/audience claims; the tenant claim drives TenantContext"],
        ["Exports", "Deterministic DOCX/PDF + docxtpl donor templates", "ECharts SSR→PNG charts render identically in DOCX and PDF (ADR-0009)"],
        ["Testing", "Vitest / node:test · Playwright · pytest · golden corpus", "Unit tests at every layer plus a reporting golden-corpus eval"],
        ["Deployment", "systemd on Contabo + versioned releases", "Release-and-symlink deploy, DB-first migrations, rollback script"],
    ], y=TOP, col_widths=[1.7, 4.0, 6.0], size=9.2, row_h=0.305, head_h=0.32)


# --------------------------------------------------------------------------- #
# Slide 13 — Multi-tenancy and security
# --------------------------------------------------------------------------- #

def s13_security(prs):
    slide = blank(prs)
    header(slide, 13, "Tenant isolation enforced in the database, not only in code",
           kicker="Multi-tenancy & security",
           note="ADR-0001 · docs/security/threat-model.md · AGENTS.md (Prisma/ready gate) · contabo-ops.md")
    cards(slide, [
        {"title": "Tenant isolation", "accent": BLUE,
         "body": ["Shared schema with Postgres Row-Level Security: "
                  "SET LOCAL app.current_tenant = $tenantId inside a "
                  "TenantScopedConnection.",
                  "Every repository takes TenantContext by constructor injection; "
                  "every aggregate root carries tenantId as its first field.",
                  "rls.sql is re-applied after each migration — verified by a "
                  "cross-tenant query returning zero rows.",
                  "Workers read the tenant from a signed X-Tenant-Id + HMAC "
                  "header, never from a URL."]},
        {"title": "Identity & authorization", "accent": CYAN,
         "body": ["JWT (HS256) with issuer/audience claims; TenantContext is set "
                  "from the org claim by auth middleware (AsyncLocalStorage).",
                  "Tenant roles map to explicit capabilities: resolve-claim, "
                  "template upload, manage agent memory, approve, export, bill.",
                  "The SuperAdmin portal uses a separate PlatformAdmin identity "
                  "store — tenant credentials never work there."]},
        {"title": "Threat model", "accent": AMBER,
         "body": ["External attacker → Zod validation at every route boundary, "
                  "RLS, parameterised Prisma access, short-lived presigned file "
                  "URLs.",
                  "Compromised NGO user → tenant filtering in the database and in "
                  "every repository method, not just the UI.",
                  "Rogue AI → outputs are reviewable drafts only; grounding "
                  "rejects ungrounded numbers; nothing exports without human "
                  "approval."]},
        {"title": "Internal surface", "accent": PURPLE,
         "body": ["/internal/* routes require an internal token plus HMAC; every "
                  "DonorDesk service binds 127.0.0.1 only.",
                  "Orchestrator-triggered writes are idempotency-keyed, so retries "
                  "and duplicate deliveries never double-apply.",
                  "Audit events are append-only and partitioned per tenant; "
                  "hash-chained notarisation is the Phase 2/3 target.",
                  "Structured logs redact PII (pino redact paths)."]},
    ], y=TOP, h=CH - 0.78, cols=2, rows=2, title_size=12, body_size=9.5)

    panel(slide, ML, TOP + CH - 0.78, CW, 0.78,
          "Deploy guard — /ready blocks a stale Prisma client", [
        "The endpoint introspects prisma._runtimeDataModel against an allowlist "
        "of Model.field pairs the application code relies on. A 503 with "
        "missingPrismaFields means the generated client is stale; any new column "
        "the app selects must be added to REQUIRED_PRISMA_FIELDS in the same PR.",
    ], accent=RED, fill="FEF2F2", title_size=11, body_size=9.2)




# --------------------------------------------------------------------------- #
# Slide 14 — Deployment topology
# --------------------------------------------------------------------------- #

def s14_deploy(prs):
    slide = blank(prs)
    header(slide, 14, "One host, five services, versioned releases that roll back",
           kicker="Deployment & operations",
           note="contabo-ops.md §9/§10 · CONTABO-DEPLOY.md · SUPERADMIN-PORTAL.md §2 · docs/runbooks/")
    panel(slide, ML, TOP, 6.35, 3.5, "Production topology (Contabo)", [
        ("Internet", "head"),
        ("│  HTTPS :443 — Hestia nginx + Let's Encrypt certificates", "mono"),
        ("├─ donordesk.online     → 127.0.0.1:3002  donordesk-web (Next.js)", "mono"),
        ("├─ sa.donordesk.online  → 127.0.0.1:3012  donordesk-superadmin", "mono"),
        ("│      └─ /api/control/* proxied server-side → :4001", "mono"),
        ("└─ 127.0.0.1:4001  donordesk-api (Fastify)", "mono"),
        ("        ├─ PostgreSQL 16 with Row-Level Security", "mono"),
        ("        ├─ 127.0.0.1:8092  donordesk-workers (FastAPI)", "mono"),
        ("        ├─ 127.0.0.1:8093/8094  donordesk-kestra", "mono"),
        ("        └─ /opt/donordesk/shared/*.env  (mode 0600)", "mono"),
        ("Every service binds loopback only; the browser never sees an internal "
         "address.", "body"),
    ], accent=BLUE, fill=CARD, title_size=12, body_size=9)

    table(slide, ["systemd service", "Bind", "Command"], [
        ["donordesk-web", "127.0.0.1:3002", "node .next/standalone/apps/web/server.js"],
        ["donordesk-api", "127.0.0.1:4001", "node dist/server.js (Fastify)"],
        ["donordesk-superadmin", "127.0.0.1:3012", "node server.js (Requires=donordesk-api)"],
        ["donordesk-workers", "127.0.0.1:8092", ".venv/bin/uvicorn app.main:app"],
        ["donordesk-kestra", "127.0.0.1:8093/8094", "Java Kestra 1.3.30"],
    ], x=ML + 6.62, y=TOP, w=CW - 6.62, col_widths=[2.4, 1.6, 3.0], size=8.8,
        row_h=0.42, head_h=0.32)

    panel(slide, ML + 6.62, TOP + 2.62, CW - 6.62, 0.88, "Release hygiene", [
        "releaseId = timestamp; /opt/donordesk/releases/<id> + current symlink; "
        "deploy-fast.sh re-runs prisma generate before restarting the api.",
    ], accent=GREEN, fill="ECFDF5", title_size=11, body_size=9)

    panel(slide, ML, TOP + 3.72, CW, 1.28, "Deploy, migrate, verify, roll back", [
        "Additive migrations are applied first as donordesk_migrator (with a DB "
        "dump taken beforehand), and infra/postgres/rls.sql is shipped and "
        "re-applied with them — a new tenant-scoped table without its RLS entry "
        "is a silent no-op.",
        "Post-deploy verification: api/web/worker active, /health and /ready "
        "return 200 (Prisma client fresh, no missingPrismaFields), public "
        "donordesk.online and sa.donordesk.online return 200. Rollback: "
        "RELEASE_ID=<id> scripts/rollback.sh. Runbooks cover alerts, disaster "
        "recovery, key rotation and BYOC deployment.",
    ], accent=AMBER, fill=CARD, title_size=11.5, body_size=9.2)


# --------------------------------------------------------------------------- #
# Slide 15 — AI Reporter
# --------------------------------------------------------------------------- #

def s15_ai_reporter(prs):
    slide = blank(prs)
    header(slide, 15, "The AI writes prose. The system owns numbers, sources and gates.",
           kicker="AI Reporter · Features 11 & 20 · AI Reporter 2",
           note="Features/11-AI-Report-Draft-Generator.md · Features/20-report-gen.md · imp/AI-REPORTER-2-*.md · AGENTS.md")
    cards(slide, [
        {"title": "Governing principle", "accent": BLUE,
         "body": ["The LLM is a controlled planner, narrator and reviewer — never "
                  "the authority over calculations, provenance, lifecycle, "
                  "authorization or approval.",
                  "The deterministic data analyst is the sole source of indicator "
                  "mathematics.",
                  "No failed verification is ever silently converted into "
                  "\"verified\"; no evaluative statement is produced from "
                  "unresolved indicator semantics."]},
        {"title": "What each section is written from", "accent": CYAN,
         "body": ["Donor template plus its extracted requirements, report-wide "
                  "rules and per-section guidance (input type, mandatory "
                  "questions, evidence needed, page limits, author instructions).",
                  "Project and reporting-period context; logframe indicators with "
                  "name, type, baseline, target, previous-period comparison value "
                  "and a deterministic performance evaluation.",
                  "Verified evidence chunks (8 × 800 chars) and activity "
                  "narratives — every paragraph carries its sources."]},
        {"title": "AI Reporter 2 — typed artifacts", "accent": PURPLE,
         "body": ["Sections may carry artifacts: TABLE · CHART · LIST · KEY_VALUE "
                  "· QA · DELTA, plus optional chart specs and prior-period deltas.",
                  "Numbers, tables, charts and deltas are built deterministically "
                  "from verified findings; the writer only writes the prose.",
                  "Deterministic validators run twice — in the Python worker "
                  "before responding and again in the TypeScript api on the "
                  "response.",
                  "Synthesis sections (executive summary, conclusion) are drafted "
                  "last, from the already-drafted sections."]},
        {"title": "Grounding, timeouts, fallback", "accent": AMBER,
         "body": ["The grounding layer rejects any number that was not in the "
                  "inputs; percent-of-target is the only derived figure allowed.",
                  "An ungrounded number that survives the retry yields "
                  "VALIDATOR_FAILED, and the API substitutes the deterministic "
                  "section.",
                  "Budgets: 90 s per LLM call and 200 s per section (draft plus "
                  "one feedback retry). On timeout the section falls back to "
                  "deterministic output and the rest of the draft continues.",
                  "The HTTP client timeout must exceed the worker's section "
                  "budget, so a slow provider degrades one section, not the run."]},
    ], y=TOP, h=3.95, cols=2, rows=2, title_size=12, body_size=9.2)

    panel(slide, ML, TOP + 4.12, CW, 1.28,
          "One editorial guidance channel — and one active provider per scope", [
        "buildSectionSpecificGuidance is the single source of truth for editorial "
        "guidance and feeds both the legacy narrator and the AI Reporter brief "
        "(sectionGuidance). Writer contract v4 is mirrored in Python and "
        "TypeScript and pinned by a string-identical test, so the two writers can "
        "never drift.",
        "Provider selection is per scope and resolved per generation: MiniMax, "
        "DeepSeek, Claude (SDK), Gemini, or the free stub that is never billed. "
        "Feature-flagged by AI_REPORTER_ENABLED (default off) against the worker "
        "at 127.0.0.1:8092 — with the flag off, the legacy generator serves every "
        "tenant.",
    ], accent=GREEN, fill="ECFDF5", title_size=11.5, body_size=9.2)


# --------------------------------------------------------------------------- #
# Slide 16 — Assurance layer
# --------------------------------------------------------------------------- #

def s16_assurance(prs):
    slide = blank(prs)
    header(slide, 16, "Trust is architectural: revisions, verification and sealed snapshots",
           kicker="Assurance layer · ADR 0005–0008",
           note="memorybank/docs/architecture/decisions/0005–0008 · imp/PROFESSIONAL-REPORTING-IMPLEMENTATION-PLAN.md · imp/RECOVERY-PLAN-IMPLEMENTATION.md")
    panel(slide, ML, TOP, 5.93, 2.85, "Revision-bound assurance (ADR-0005)", [
        "Every content mutation — generation, manual edit, rewrite, shorten, "
        "auto-fix, merge — creates an immutable ReportRevision and repoints the "
        "section at it. Each revision stores a SHA-256 content hash.",
        "Assurance states are enforced by the domain: UNASSESSED → ASSESSING → "
        "CURRENT | FAILED, and CURRENT → STALE. Approval requires the current "
        "revision to be CURRENT.",
        "Claims are revision-bound: they record revisionId, revisionHash, "
        "character span, numeric atoms and a structured reason code — so stale "
        "verification cannot survive an edit.",
    ], accent=BLUE, fill=CARD, title_size=12, body_size=9.4)

    panel(slide, ML + 6.16, TOP, CW - 6.16, 2.85,
          "Verification composition (ADR-0007)", [
        "Evidence integrity — every cited source must still match the snapshotted "
        "bytes: chunk exists, source text matches, hash matches, evidence "
        "verified, confidentiality authorized.",
        "Numeric assertion — every numeric atom is bound to indicator, unit, "
        "period and semantic role; matching one number never validates a "
        "sentence; decimal math only.",
        "Deterministic entailment — cited chunks must actually support the "
        "assertion (SUPPORTED | CONTRADICTED | INSUFFICIENT | UNCERTAIN).",
        "Causal review policy — causality is never auto-approved; an assertion "
        "extractor reads the final content so an empty writer claims array can "
        "never bypass verification.",
    ], accent=PURPLE, fill=CARD, title_size=12, body_size=9.2)

    panel(slide, ML, TOP + 3.0, 5.93, 2.3,
          "Requirement precedence (ADR-0006)", [
        "There is no universal donor standard, so requirements are modelled per "
        "award, not per donor label.",
        ("signed award/amendment → award schedule/template → mechanism rules → "
         "donor report-type pack → organisation profile → conservative baseline",
         "mono"),
        "For each semantic key the highest-precedence layer wins and lower layers "
        "only fill gaps; every resolved requirement records the source reference "
        "that supplied it, and a version change forces human review plus a new "
        "snapshot.",
    ], accent=GREEN, fill="ECFDF5", title_size=12, body_size=9.2)

    panel(slide, ML + 6.16, TOP + 3.0, CW - 6.16, 2.3,
          "Sealed submission snapshots (ADR-0008)", [
        "A SubmissionSnapshot freezes approved revision ids and hashes, the "
        "resolved requirement snapshot and coverage, the assertion-verification "
        "manifest, evidence/annex manifests with confidentiality decisions, "
        "approval records, renderer version and final artifact hashes.",
        "Donor-facing exports must reference a sealed snapshot; internal previews "
        "are allowed without one but are visibly watermarked. One shared gate "
        "policy drives approval, readiness, preflight and submission — so a "
        "direct API call cannot bypass what the UI showed.",
    ], accent=AMBER, fill=CARD, title_size=12, body_size=9.2)


# --------------------------------------------------------------------------- #
# Slide 17 — Compliance, readiness and review
# --------------------------------------------------------------------------- #

def s17_compliance(prs):
    slide = blank(prs)
    header(slide, 17, "Gaps are found before the donor finds them",
           kicker="Compliance, readiness & review · Features 12, 13, 15",
           note="Features/12-Missing-Evidence-And-Compliance-Checklist.md · Features/13-Review-And-Approval-Workflow.md · base/MVP-features.md §33–34 · Fixes.md (2026-08-31)")
    cards(slide, [
        {"title": "What the checklist detects", "accent": AMBER,
         "body": ["Missing evidence · incomplete evidence metadata · unverified "
                  "indicator · unsupported report claim · missing annex · missing "
                  "procurement document · missing approval · missing "
                  "disaggregation · late activity update · sensitive-data warning "
                  "· unreviewed AI output.",
                  "Each item carries project, period, related requirement, "
                  "activity and indicator, severity (Low → Critical), owner, due "
                  "date, status (Open / In progress / Resolved / Accepted risk / "
                  "N/A) and resolution notes.",
                  "Example: \"Indicator NUT-03 was updated but has no supporting "
                  "evidence attached.\""]},
        {"title": "Readiness before submission", "accent": BLUE,
         "body": ["Sections 25% · indicator updates verified 20% · required "
                  "evidence attached 25% · checklist resolved 20% · approval "
                  "completed 10%.",
                  ("80·0.25 + 70·0.20 + 60·0.25 + 50·0.20 + 0·0.10 = 59%", "mono"),
                  "The dashboard adds a readiness snapshot, deadline overview with "
                  "urgent flags, and a derived workspace-health score.",
                  "Evidence readiness counts the period-linked evidence union; "
                  "percentage indicators warn when they cannot be verified."]},
        {"title": "Review and approval flow", "accent": GREEN,
         "body": ["Draft created → internal review requested → reviewer comments → "
                  "revisions → M&E verification → compliance verification → "
                  "project manager approval → export → submitted → closed.",
                  "Comments attach to sections, evidence files, indicator updates, "
                  "checklist items and activity updates; open/resolved plus "
                  "mentions.",
                  "Approval requires: required sections complete, critical items "
                  "resolved or accepted, indicator updates verified, evidence "
                  "attached, sensitive files reviewed, approver selected.",
                  "Claim resolution now happens inside the report workspace "
                  "(Review view); blockers are written in human language."]},
    ], y=TOP, h=3.62, cols=3, rows=1, title_size=12, body_size=9.2)

    panel(slide, ML, TOP + 3.78, CW, 1.62,
          "Hard-won product lessons already paid for in production", [
        "Eligibility and role fixes dropped \"Smart Review\" noise from 109 items "
        "to 43 on a real report — many checklist items are the system asking the "
        "wrong person, not a real gap.",
        "Drafts are superseded rather than overwritten: one current draft plus a "
        "Versions archive, generation shows an ETA and can be cancelled, and "
        "regenerating with no AI provider always keeps the existing text instead "
        "of blanking it.",
        "The unsupported-claim projector is idempotent against already-resolved "
        "items, so resolving a claim no longer re-creates it on the next pass.",
    ], accent=PURPLE, fill=CARD, title_size=11.5, body_size=9.2)




# --------------------------------------------------------------------------- #
# Slide 18 — Exports
# --------------------------------------------------------------------------- #

def s18_exports(prs):
    slide = blank(prs)
    header(slide, 18, "Deliverables a donor will actually accept",
           kicker="Exports · Feature 14 · ADR-0009",
           note="Features/14-Export-Module.md · ADR-0009 · base/MVP-features.md §35 · AGENTS.md (export markdown invariant)")
    panel(slide, ML, TOP, 6.2, 3.35, "Export types and package contents", [
        "Word report · PDF report · Excel indicator table · evidence checklist · "
        "evidence pack ZIP.",
        "A full package contains the final donor report, indicator table, "
        "evidence checklist, annex list, selected evidence files, compliance "
        "summary and report metadata.",
        "Every export is recorded: type, who exported it, when, project, "
        "reporting period, report version and the files included.",
        "Before export the user sees warnings — unresolved critical checklist "
        "items, unsupported claims, unverified indicators, sensitive evidence, "
        "missing annexes — and can only proceed with the right permission.",
    ], accent=BLUE, fill=CARD, title_size=12, body_size=9.6)

    panel(slide, ML + 6.42, TOP, CW - 6.42, 3.35,
          "Evidence pack folder structure", [
        ("Project Name/", "mono"),
        ("\u00a0\u00a0Reporting Period/", "mono"),
        ("\u00a0\u00a0\u00a0\u00a001_Final_Report/", "mono"),
        ("\u00a0\u00a0\u00a0\u00a002_Indicator_Table/", "mono"),
        ("\u00a0\u00a0\u00a0\u00a003_Evidence_Checklist/", "mono"),
        ("\u00a0\u00a0\u00a0\u00a004_Attendance_Sheets/", "mono"),
        ("\u00a0\u00a0\u00a0\u00a005_Photos/", "mono"),
        ("\u00a0\u00a0\u00a0\u00a0...", "mono"),
        "A predictable tree means the file a donor auditor asks for is where "
        "they expect it to be.",
    ], accent=CYAN, fill=CARD, title_size=12, body_size=9.6)

    panel(slide, ML, TOP + 3.5, CW, 1.9,
          "Donor-native rendering behind one export builder (ADR-0009)", [
        "CreateExportHandler takes an explicit exportIntent and an optional "
        "submissionSnapshotId. DONOR_SUBMISSION requires a sealed snapshot and is "
        "never watermarked; internal previews must be watermarked. The builder "
        "validates those invariants itself, so no path can produce an unapproved "
        "donor artifact.",
        "DONOR_TEMPLATE rendering is worker-backed (docxtpl in the Python "
        "workers) using an approved, versioned template mapping; the TypeScript "
        "builder emits a placeholder-aware DOCX so the pipeline and preflight keep "
        "working. The snapshot records renderer, template and mapping versions "
        "plus artifact hashes, so a final artifact reproduces exactly.",
        "Charts are user-selectable per section (BAR, LINE, PIE, AREA, RADAR, "
        "GAUGE) and render identically in DOCX and PDF via ECharts SSR → PNG.",
    ], accent=GREEN, fill="ECFDF5", title_size=11.5, body_size=9.4)


# --------------------------------------------------------------------------- #
# Slide 19 — Agent Memory (Version 2.0)
# --------------------------------------------------------------------------- #

def s19_agent_memory(prs):
    slide = blank(prs)
    header(slide, 19, "Version 2.0 — Agent Memory: learns style, never numbers",
           kicker="DonorDesk Version 2.0 · Feature 21 · headline release",
           note="Features/21-Agent-Memory.md · imp/Phase21-agent-memory.md · CONTABO-DEPLOY.md (release 20260928094857)")
    flow(slide, [
        ("Opt in", "Tenant enables \"AI Writing Style\" in Settings"),
        ("Reviewer edits", "A report manager corrects an AI-drafted section"),
        ("Diff is read", "MANUAL_EDIT revision vs its parent revision"),
        ("Numeric hunks dropped", "Numbers, dates, currencies, %, indicator codes"),
        ("PROPOSED", "Statement proposed; occurrence count bumped if it recurs"),
        ("ACTIVE", "Approved → injected into sectionGuidance for that context"),
    ], y=TOP + 0.05, h=1.32, label_size=9.8)

    panel(slide, ML, TOP + 1.5, 5.93, 2.05, "Objective and user story", [
        "Today every section is drafted from scratch, guided only by the donor "
        "template's own instructions and fixed editorial rules — the tool cannot "
        "remember that a tenant or donor prefers a different tone, terminology or "
        "structure, so the same correction is made every period.",
        ("\"Notice the pattern, ask me once whether to apply it going forward, and "
         "then stop making that mistake in future drafts for that donor.\"", "sub"),
        "Agent Memory closes that gap for style and structure only; facts and "
        "figures stay with the deterministic verified-findings pipeline.",
    ], accent=AMBER, fill="FFFBEB", title_size=12, body_size=9.4)

    panel(slide, ML + 6.16, TOP + 1.5, CW - 6.16, 2.05, "Domain model", [
        "Scope: ORGANIZATION · DONOR · TEMPLATE · SECTION_TYPE.  Category: TONE · "
        "STRUCTURE · TERMINOLOGY · FORMATTING · LENGTH.",
        "Status: PROPOSED · ACTIVE · REJECTED · SUPERSEDED · DEACTIVATED. "
        "STATEMENT is capped and cannot contain a numeric atom.",
        "Confidence (LOW/MEDIUM/HIGH) is derived from occurrenceCount — never from "
        "an LLM's self-reported confidence. Provenance (source revision, parent "
        "revision, section, occurrence count, last observed) is append-only, so "
        "the history itself is the evidence.",
        "ACTIVE is reachable only through a transition that carries approvedById — "
        "no constructor can create an already-active memory.",
    ], accent=PURPLE, fill=CARD, title_size=12, body_size=9.2)

    panel(slide, ML, TOP + 3.68, 5.93, 1.9,
          "Where it plugs in — no new prompt channel", [
        "The only integration point is sectionGuidance, the existing single source "
        "of truth already consumed by both the AI Reporter worker and the legacy "
        "generator.",
        "Extraction runs after the assurance pass has already re-verified the "
        "edited revision — a second, independent safety net on top of the hunk "
        "filter — and is dispatched through the existing BackgroundRunner.",
        "The generation-time lookup is synchronous and read-only: no LLM call and "
        "no new dependency on the hot path.",
    ], accent=CYAN, fill=CARD, title_size=11.5, body_size=9.2)

    panel(slide, ML + 6.16, TOP + 3.68, CW - 6.16, 1.9, "What shipped", [
        "New AgentMemory table and Organization.agentMemoryEnabled tenant toggle; "
        "new capability report.manage-agent-memory; new \"AI Writing Style\" "
        "Settings tab (hidden unless the platform flag and the capability are both "
        "present).",
        "Migration 20260928150000_agent_memory applied manually with a DB dump "
        "taken first; rls.sql re-applied so AgentMemory is tenant-isolated — a "
        "cross-tenant read returns zero rows.",
        "Deployed dark on 2026-09-28, then the platform flag was turned on the "
        "same day: tenants stay byte-identical to pre-2.0 behaviour until a report "
        "manager opts in.",
    ], accent=GREEN, fill="ECFDF5", title_size=11.5, body_size=9.2)




# --------------------------------------------------------------------------- #
# Slide 20 — Guardrails, commercials, delivery status, what's next
# --------------------------------------------------------------------------- #

def s20_close(prs):
    slide = blank(prs)
    header(slide, 20, "Guardrails, business model, and what comes next",
           kicker="Version 2.0 wrap-up",
           note="imp/Phase21-agent-memory.md §7/§8/§13 · Features/19-Tiers-And-Payments.md · SUPERADMIN-PORTAL.md · pending.md")
    cards(slide, [
        {"title": "Three guard layers — none optional", "accent": AMBER,
         "body": ["1 · Extraction-time hunk filter: any diff hunk containing a "
                  "numeric token, currency symbol, percentage, ISO date or "
                  "indicator code is dropped before it reaches any extractor, "
                  "deterministic or LLM-assisted.",
                  "2 · Entity invariant: a statement matching the same "
                  "numeric-atom pattern cannot be constructed at all, so a "
                  "misbehaving extractor cannot persist a figure as \"style\".",
                  "3 · Human approval gate: nothing reaches ACTIVE — and therefore "
                  "sectionGuidance — without an explicit approval by a holder of "
                  "reporting.manage-agent-memory, revocable at any time.",
                  "The test matrix exercises each layer independently: disabling "
                  "one must still be caught by the next."]},
        {"title": "Non-goals — what it deliberately never learns", "accent": PURPLE,
         "body": ["No memory of facts, figures, targets, dates or donor "
                  "commitments. No conversational memory. No cross-tenant "
                  "learning or shared pattern library. No automatic, unapproved "
                  "behaviour change.",
                  "No general-purpose memory framework as a runtime dependency: "
                  "Mem0, Letta, Cognee and Graphiti were researched and rejected; "
                  "LangMem's extraction shape and DSPy's optimisation role are "
                  "reused as techniques, not libraries.",
                  "Two flags with an AND relationship — AGENT_MEMORY_ENABLED "
                  "(platform) × Organization.agentMemoryEnabled (tenant, "
                  "self-service). Off on either side means byte-identical output, "
                  "and disabling needs no migration.",
                  "DSPy-style writer-contract optimisation is a separate, "
                  "offline-only follow-up that never touches Agent Memory rows."]},
        {"title": "Commercial model, control plane and next steps", "accent": GREEN,
         "body": ["Tiers: Starter free (1 project · 1 user · 1 GB · 5 AI drafts/"
                  "month), Team $59 (5 · 5 · 25 GB · 100), Growth $149 (20 · 15 · "
                  "100 GB · 500), Enterprise custom; annual billing gives two "
                  "months free.",
                  "AI-credit quotas are enforced per tier; the stub fallback is "
                  "free and never billed; a tenant's own LLM provider consumes no "
                  "DonorDesk credits. Billing runs through Creem as merchant of "
                  "record with HMAC-verified webhooks and reconciliation handlers "
                  "behind /internal/billing/*.",
                  "SuperAdmin control plane at sa.donordesk.online: a separate "
                  "PlatformAdmin identity store, provider catalogue, tier and "
                  "credit management, and its own hash-chained audit stream.",
                  "Next: merge branch 0009-agent-memory to master; Agent Memory "
                  "Phase 4 (cross-tenant DB tests, live before/after "
                  "golden-corpus run); confirm the deadline_reminders Kestra flow "
                  "is genuinely scheduled; enable Postmark for real email; retire "
                  "the classic editor components after one release; add axe-core "
                  "and report-editor e2e specs."]},
    ], y=TOP, h=4.35, cols=3, rows=1, title_size=12, body_size=8.6)

    bar = rect(slide, ML, TOP + 4.52, CW, 0.82, fill=DARK, radius=0.10)
    rect(slide, ML, TOP + 4.52, 0.08, 0.82, fill=CYAN)
    shape_text(bar, [
        {"text": "From messy field evidence to donor-ready reports — with a "
                 "human on the approve button, and every number traceable.",
         "size": 13, "bold": True, "color": WHITE, "space_after": 2},
        {"text": "DonorDesk Version 2.0 · Agent Memory  |  Questions?  Deeper "
                 "detail lives in memorybank/ (INDEX.md is the map).",
         "size": 9.5, "color": "94A3B8", "space_after": 0},
    ], anchor=MSO_ANCHOR.MIDDLE)


# --------------------------------------------------------------------------- #
# Main
# --------------------------------------------------------------------------- #

SLIDES = [s01_title, s02_agenda, s03_problem, s04_solution, s05_users,
          s06_concepts, s07_workflow, s08_foundation, s09_delivery, s10_editor,
          s11_architecture, s12_stack, s13_security, s14_deploy,
          s15_ai_reporter, s16_assurance, s17_compliance, s18_exports,
          s19_agent_memory, s20_close]


def main():
    parser = argparse.ArgumentParser(description="Build the DonorDesk overview deck.")
    parser.add_argument("--out",
                        default="DonorDesk-Overview-v2.0-Agent-Memory.pptx",
                        help="output .pptx path")
    args = parser.parse_args()

    prs = Presentation()
    prs.slide_width = Inches(SW)
    prs.slide_height = Inches(SH)
    for builder in SLIDES:
        builder(prs)
    prs.save(args.out)
    print(f"wrote {args.out} ({len(SLIDES)} slides)")


if __name__ == "__main__":
    main()

"""
make_report_docx.py
===================
Converts docs/PROJECT_REPORT.md into a printable Word document
(docs/PROJECT_REPORT.docx) with headings, tables, code blocks and images.

The Markdown file is the single source of truth; this script only formats it.

Run:
    python docs/tools/make_report_docx.py
Requires: python-docx   (pip install python-docx)
"""

import re
from pathlib import Path

from docx import Document
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor

DOCS = Path(__file__).resolve().parent.parent
SOURCE = DOCS / "PROJECT_REPORT.md"
TARGET = DOCS / "PROJECT_REPORT.docx"

CODE_FONT = "Consolas"


# ----------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------
def shade(cell, colour: str):
    element = OxmlElement("w:shd")
    element.set(qn("w:val"), "clear")
    element.set(qn("w:fill"), colour)
    cell._tc.get_or_add_tcPr().append(element)


def add_inline(paragraph, text: str):
    """Write text with **bold**, *italic* and `code` runs."""
    pattern = re.compile(r"(\*\*.+?\*\*|`.+?`|\*[^*]+?\*|\[[^\]]+\]\([^)]+\))")
    for piece in pattern.split(text):
        if not piece:
            continue
        if piece.startswith("**") and piece.endswith("**"):
            run = paragraph.add_run(piece[2:-2])
            run.bold = True
        elif piece.startswith("`") and piece.endswith("`"):
            run = paragraph.add_run(piece[1:-1])
            run.font.name = CODE_FONT
            run.font.size = Pt(9.5)
            run.font.color.rgb = RGBColor(0xA3, 0x1D, 0x1D)
        elif piece.startswith("[") and "](" in piece:
            label = piece[1:piece.index("]")]
            run = paragraph.add_run(label)
            run.font.color.rgb = RGBColor(0x0B, 0x4F, 0x9E)
            run.underline = True
        elif piece.startswith("*") and piece.endswith("*") and len(piece) > 2:
            run = paragraph.add_run(piece[1:-1])
            run.italic = True
        else:
            paragraph.add_run(piece)


def setup_styles(document):
    normal = document.styles["Normal"]
    normal.font.name = "Calibri"
    normal.font.size = Pt(11)
    normal.paragraph_format.space_after = Pt(6)
    normal.paragraph_format.line_spacing = 1.15

    for name, size, colour in (("Heading 1", 18, (0x10, 0x23, 0x3A)),
                               ("Heading 2", 14, (0x12, 0x3A, 0x63)),
                               ("Heading 3", 12, (0x12, 0x3A, 0x63))):
        style = document.styles[name]
        style.font.name = "Calibri"
        style.font.size = Pt(size)
        style.font.color.rgb = RGBColor(colour[0], colour[1], colour[2])
        style.font.bold = True


def add_code_block(document, lines):
    paragraph = document.add_paragraph()
    paragraph.paragraph_format.left_indent = Inches(0.15)
    paragraph.paragraph_format.space_before = Pt(4)
    paragraph.paragraph_format.space_after = Pt(8)
    run = paragraph.add_run("\n".join(lines))
    run.font.name = CODE_FONT
    run.font.size = Pt(8.5)
    # light grey background
    pPr = paragraph._p.get_or_add_pPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:fill"), "F3F5F7")
    pPr.append(shd)


def add_table(document, rows):
    header, body = rows[0], rows[1:]
    table = document.add_table(rows=1, cols=len(header))
    table.style = "Table Grid"
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    for index, text in enumerate(header):
        cell = table.rows[0].cells[index]
        cell.text = ""
        paragraph = cell.paragraphs[0]
        run = paragraph.add_run(text.replace("**", ""))
        run.bold = True
        run.font.size = Pt(9.5)
        shade(cell, "DCE6F1")
    for row in body:
        cells = table.add_row().cells
        for index, text in enumerate(row[:len(header)]):
            cells[index].text = ""
            paragraph = cells[index].paragraphs[0]
            add_inline(paragraph, text)
            for run in paragraph.runs:
                run.font.size = Pt(9.5)
    document.add_paragraph()


def add_image(document, path: Path, width_inches=6.3):
    if not path.is_file():
        document.add_paragraph(f"[missing image: {path.name}]")
        return
    document.add_picture(str(path), width=Inches(width_inches))
    document.paragraphs[-1].alignment = WD_ALIGN_PARAGRAPH.CENTER


# ----------------------------------------------------------------------
# Markdown parser (only the subset used in PROJECT_REPORT.md)
# ----------------------------------------------------------------------
def convert():
    lines = SOURCE.read_text(encoding="utf-8").splitlines()
    document = Document()
    setup_styles(document)

    index = 0
    pending_table = []

    def flush_table():
        nonlocal pending_table
        if pending_table:
            add_table(document, pending_table)
            pending_table = []

    while index < len(lines):
        line = lines[index]

        # ---- fenced code block ----
        if line.strip().startswith("```"):
            flush_table()
            index += 1
            block = []
            while index < len(lines) and not lines[index].strip().startswith("```"):
                block.append(lines[index])
                index += 1
            add_code_block(document, block)
            index += 1
            continue

        # ---- table ----
        if line.strip().startswith("|"):
            cells = [c.strip() for c in line.strip().strip("|").split("|")]
            if all(set(c) <= set("-: ") and c for c in cells):
                index += 1                     # separator row, skip
                continue
            pending_table.append(cells)
            index += 1
            continue
        flush_table()

        stripped = line.strip()

        # ---- blank / rule ----
        if not stripped or set(stripped) == {"-"} and len(stripped) > 2:
            index += 1
            continue

        # ---- image ----
        image = re.match(r"!\[[^\]]*\]\(([^)]+)\)", stripped)
        if image:
            add_image(document, DOCS / image.group(1))
            index += 1
            continue

        # ---- headings ----
        heading = re.match(r"^(#{1,4})\s+(.*)$", stripped)
        if heading:
            level = len(heading.group(1))
            text = heading.group(2)
            if level == 1:
                paragraph = document.add_paragraph()
                paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
                run = paragraph.add_run(text)
                run.bold = True
                run.font.size = Pt(24)
                run.font.color.rgb = RGBColor(0x10, 0x23, 0x3A)
            else:
                document.add_heading(text, level=min(level - 1, 3))
            index += 1
            continue

        # ---- bullet list ----
        bullet = re.match(r"^[*+-]\s+(.*)$", stripped)
        if bullet:
            paragraph = document.add_paragraph(style="List Bullet")
            add_inline(paragraph, bullet.group(1))
            index += 1
            continue

        # ---- numbered list ----
        numbered = re.match(r"^(\d+)\.\s+(.*)$", stripped)
        if numbered:
            # The number is written as text so that every list restarts at 1.
            paragraph = document.add_paragraph()
            paragraph.paragraph_format.left_indent = Inches(0.45)
            paragraph.paragraph_format.first_line_indent = Inches(-0.25)
            paragraph.paragraph_format.space_after = Pt(3)
            paragraph.add_run(f"{numbered.group(1)}.  ")
            add_inline(paragraph, numbered.group(2))
            index += 1
            continue

        # ---- caption (italic line right after an image) ----
        if stripped.startswith("*Figure") or stripped.startswith("*Table"):
            paragraph = document.add_paragraph()
            paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
            run = paragraph.add_run(stripped.strip("*"))
            run.italic = True
            run.font.size = Pt(9.5)
            run.font.color.rgb = RGBColor(0x44, 0x55, 0x66)
            index += 1
            continue

        # ---- normal paragraph ----
        paragraph = document.add_paragraph()
        paragraph.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
        add_inline(paragraph, stripped)
        index += 1

    flush_table()
    document.save(TARGET)
    print(f"written: {TARGET}")


if __name__ == "__main__":
    convert()

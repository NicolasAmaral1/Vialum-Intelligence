#!/usr/bin/env python3
"""
Gera PDF do laudo de viabilidade com identidade visual Genesis.
Cores: #9FEC14 (verde lima) + #070707 (fundo escuro)
Fonte: Sora
Logo: logo-genesis.png
"""

import re
from pathlib import Path
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm, cm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, Image, HRFlowable
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY, TA_RIGHT

# Paths
BASE = Path("/Users/nicolasamaral/vialum-intelligence/laudos/Reinaldo Neto/RUN BABY RUN")
ASSETS = Path("/Users/nicolasamaral/vialum-intelligence/genesis/squads/laudo-viabilidade/resources/assets")
LOGO = ASSETS / "imagens-fixas" / "logo-genesis.png"
FONT_REG = ASSETS / "fonts" / "Sora-Regular.ttf"
FONT_BOLD = ASSETS / "fonts" / "Sora-Bold.ttf"
MD_FILE = BASE / "RUN BABY RUN - LAUDO DE VIABILIDADE.md"
OUTPUT = BASE / "output" / "RUN BABY RUN - LAUDO DE VIABILIDADE.pdf"

# Genesis colors
GREEN = colors.HexColor("#9FEC14")
DARK = colors.HexColor("#070707")
DARK_BG = colors.HexColor("#0f0f0f")
LIGHT_GREEN = colors.HexColor("#E8FBCC")
VERY_LIGHT_GREEN = colors.HexColor("#F5FDE7")
GRAY = colors.HexColor("#666666")
LIGHT_GRAY = colors.HexColor("#F0F0F0")
WHITE = colors.white
TABLE_HEADER_BG = colors.HexColor("#1a1a2e")
TABLE_ROW_ALT = colors.HexColor("#F8F9FA")
BORDER_COLOR = colors.HexColor("#E0E0E0")

# Register fonts
pdfmetrics.registerFont(TTFont("Sora", str(FONT_REG)))
pdfmetrics.registerFont(TTFont("Sora-Bold", str(FONT_BOLD)))

# Styles
styles = getSampleStyleSheet()

style_title = ParagraphStyle(
    "GenTitle", parent=styles["Title"],
    fontName="Sora-Bold", fontSize=22, textColor=DARK,
    spaceAfter=6*mm, alignment=TA_LEFT,
)

style_h1 = ParagraphStyle(
    "GenH1", parent=styles["Heading1"],
    fontName="Sora-Bold", fontSize=16, textColor=DARK,
    spaceBefore=10*mm, spaceAfter=4*mm,
    borderWidth=0, borderPadding=0,
)

style_h2 = ParagraphStyle(
    "GenH2", parent=styles["Heading2"],
    fontName="Sora-Bold", fontSize=13, textColor=colors.HexColor("#333333"),
    spaceBefore=6*mm, spaceAfter=3*mm,
)

style_h3 = ParagraphStyle(
    "GenH3", parent=styles["Heading3"],
    fontName="Sora-Bold", fontSize=11, textColor=colors.HexColor("#444444"),
    spaceBefore=4*mm, spaceAfter=2*mm,
)

style_body = ParagraphStyle(
    "GenBody", parent=styles["Normal"],
    fontName="Sora", fontSize=9, textColor=colors.HexColor("#333333"),
    leading=14, spaceAfter=3*mm, alignment=TA_JUSTIFY,
)

style_meta = ParagraphStyle(
    "GenMeta", parent=styles["Normal"],
    fontName="Sora", fontSize=9, textColor=GRAY,
    spaceAfter=1*mm,
)

style_table_header = ParagraphStyle(
    "GenTableHeader", fontName="Sora-Bold", fontSize=8,
    textColor=WHITE, alignment=TA_LEFT, leading=11,
)

style_table_cell = ParagraphStyle(
    "GenTableCell", fontName="Sora", fontSize=7.5,
    textColor=colors.HexColor("#333333"), alignment=TA_LEFT, leading=10,
)

style_footer = ParagraphStyle(
    "GenFooter", fontName="Sora", fontSize=7,
    textColor=GRAY, alignment=TA_CENTER,
)

style_quote = ParagraphStyle(
    "GenQuote", parent=style_body,
    fontName="Sora", fontSize=9, textColor=colors.HexColor("#555555"),
    leftIndent=10*mm, borderColor=GREEN, borderWidth=2,
    borderPadding=(4, 8, 4, 8),
)


def header_footer(canvas, doc):
    """Draw header and footer on each page."""
    canvas.saveState()

    # Header line
    canvas.setStrokeColor(GREEN)
    canvas.setLineWidth(2)
    canvas.line(20*mm, A4[1] - 15*mm, A4[0] - 20*mm, A4[1] - 15*mm)

    # Header logo (small)
    try:
        canvas.drawImage(str(LOGO), 20*mm, A4[1] - 14*mm, width=8*mm, height=8*mm,
                        preserveAspectRatio=True, mask='auto')
    except:
        pass

    # Header text
    canvas.setFont("Sora", 7)
    canvas.setFillColor(GRAY)
    canvas.drawString(30*mm, A4[1] - 12.5*mm, "GENESIS MARCAS E PATENTES")
    canvas.drawRightString(A4[0] - 20*mm, A4[1] - 12.5*mm, "LAUDO DE VIABILIDADE MARCÁRIA")

    # Footer
    canvas.setStrokeColor(BORDER_COLOR)
    canvas.setLineWidth(0.5)
    canvas.line(20*mm, 15*mm, A4[0] - 20*mm, 15*mm)

    canvas.setFont("Sora", 7)
    canvas.setFillColor(GRAY)
    canvas.drawString(20*mm, 10*mm, "Genesis Marcas e Patentes — CNPJ 51.829.412/0001-70")
    canvas.drawRightString(A4[0] - 20*mm, 10*mm, f"Página {doc.page}")

    canvas.restoreState()


def cover_page(canvas, doc):
    """Draw cover page — white background, clean design."""
    canvas.saveState()

    # White background (default)

    # Top green accent bar
    canvas.setFillColor(GREEN)
    canvas.rect(0, A4[1] - 8*mm, A4[0], 8*mm, fill=1, stroke=0)

    # Logo
    try:
        canvas.drawImage(str(LOGO), A4[0]/2 - 15*mm, A4[1] - 50*mm,
                        width=30*mm, height=30*mm,
                        preserveAspectRatio=True, mask='auto')
    except:
        pass

    # Company name
    canvas.setFont("Sora-Bold", 13)
    canvas.setFillColor(DARK)
    canvas.drawCentredString(A4[0]/2, A4[1] - 60*mm, "GENESIS MARCAS E PATENTES")

    # Thin green line
    canvas.setStrokeColor(GREEN)
    canvas.setLineWidth(1.5)
    canvas.line(60*mm, A4[1] - 67*mm, A4[0] - 60*mm, A4[1] - 67*mm)

    # Document type
    canvas.setFont("Sora", 10)
    canvas.setFillColor(GRAY)
    canvas.drawCentredString(A4[0]/2, A4[1] - 90*mm, "LAUDO DE VIABILIDADE MARCÁRIA")

    # Mark name — large, dark
    canvas.setFont("Sora-Bold", 38)
    canvas.setFillColor(DARK)
    canvas.drawCentredString(A4[0]/2, A4[1] - 120*mm, "RUN BABY RUN")

    # Green underline for mark name
    canvas.setStrokeColor(GREEN)
    canvas.setLineWidth(3)
    canvas.line(50*mm, A4[1] - 127*mm, A4[0] - 50*mm, A4[1] - 127*mm)

    # Client info box
    box_y = A4[1] - 175*mm
    canvas.setStrokeColor(BORDER_COLOR)
    canvas.setLineWidth(0.5)
    canvas.setFillColor(colors.HexColor("#FAFAFA"))
    canvas.roundRect(35*mm, box_y, A4[0] - 70*mm, 40*mm, 3*mm, fill=1, stroke=1)

    canvas.setFont("Sora", 10)
    canvas.setFillColor(colors.HexColor("#444444"))
    info_y = box_y + 32*mm
    for label, value in [
        ("Cliente", "Reinaldo Neto"),
        ("Atividade", "Eventos wellness, vestuário esportivo, assessoria, suplementação"),
        ("Classes", "41, 25, 5, 35, 28"),
        ("Data", "10 de abril de 2026"),
    ]:
        canvas.setFont("Sora-Bold", 9)
        canvas.setFillColor(GRAY)
        canvas.drawString(40*mm, info_y, label + ":")
        canvas.setFont("Sora", 9)
        canvas.setFillColor(colors.HexColor("#333333"))
        canvas.drawString(72*mm, info_y, value)
        info_y -= 8*mm

    # Bottom
    canvas.setFont("Sora", 8)
    canvas.setFillColor(GRAY)
    canvas.drawCentredString(A4[0]/2, 30*mm, "Documento confidencial — Uso exclusivo do cliente")

    canvas.setFont("Sora", 7)
    canvas.setFillColor(colors.HexColor("#AAAAAA"))
    canvas.drawCentredString(A4[0]/2, 22*mm, "Genesis Marcas e Patentes — CNPJ 51.829.412/0001-70")

    # Bottom green bar
    canvas.setFillColor(GREEN)
    canvas.rect(0, 0, A4[0], 4*mm, fill=1, stroke=0)

    canvas.restoreState()


def parse_md(md_text):
    """Parse markdown into reportlab flowables."""
    elements = []
    lines = md_text.split("\n")
    i = 0
    in_table = False
    table_rows = []

    while i < len(lines):
        line = lines[i].rstrip()

        # Skip empty lines
        if not line.strip():
            if in_table and table_rows:
                elements.append(build_table(table_rows))
                table_rows = []
                in_table = False
            i += 1
            continue

        # Horizontal rule
        if line.strip() == "---":
            if in_table and table_rows:
                elements.append(build_table(table_rows))
                table_rows = []
                in_table = False
            elements.append(Spacer(1, 3*mm))
            elements.append(HRFlowable(width="100%", thickness=0.5, color=BORDER_COLOR))
            elements.append(Spacer(1, 3*mm))
            i += 1
            continue

        # Headers
        if line.startswith("# ") and not line.startswith("## "):
            if in_table and table_rows:
                elements.append(build_table(table_rows))
                table_rows = []
                in_table = False
            text = clean_md(line[2:])
            elements.append(Paragraph(text, style_h1))
            # Green line under H1
            elements.append(HRFlowable(width="40%", thickness=2, color=GREEN, hAlign="LEFT"))
            elements.append(Spacer(1, 2*mm))
            i += 1
            continue

        if line.startswith("## "):
            if in_table and table_rows:
                elements.append(build_table(table_rows))
                table_rows = []
                in_table = False
            text = clean_md(line[3:])
            elements.append(Paragraph(text, style_h2))
            i += 1
            continue

        if line.startswith("### "):
            if in_table and table_rows:
                elements.append(build_table(table_rows))
                table_rows = []
                in_table = False
            text = clean_md(line[4:])
            elements.append(Paragraph(text, style_h3))
            i += 1
            continue

        # Table
        if "|" in line and line.strip().startswith("|"):
            stripped = line.strip()
            # Skip separator rows
            if re.match(r"^\|[\s\-:|]+\|$", stripped):
                i += 1
                continue

            cells = [c.strip() for c in stripped.split("|")[1:-1]]
            if not in_table:
                in_table = True
            table_rows.append(cells)
            i += 1
            continue

        # If we were in a table and hit non-table line
        if in_table and table_rows:
            elements.append(build_table(table_rows))
            table_rows = []
            in_table = False

        # Blockquote
        if line.startswith("> "):
            text = clean_md(line[2:])
            elements.append(Paragraph(text, style_quote))
            i += 1
            continue

        # List items
        if re.match(r"^[\-\*] ", line.strip()):
            text = clean_md(line.strip()[2:])
            elements.append(Paragraph(f"• {text}", style_body))
            i += 1
            continue

        if re.match(r"^[a-z]\) ", line.strip()):
            text = clean_md(line.strip())
            elements.append(Paragraph(text, style_body))
            i += 1
            continue

        # Regular paragraph
        text = clean_md(line)
        if text.startswith("**") and text.endswith("**"):
            # Bold line
            text = text[2:-2]
            elements.append(Paragraph(f"<b>{text}</b>", style_body))
        else:
            elements.append(Paragraph(text, style_body))

        i += 1

    # Flush remaining table
    if in_table and table_rows:
        elements.append(build_table(table_rows))

    return elements


def clean_md(text):
    """Clean markdown formatting for reportlab."""
    # First escape XML special chars
    text = text.replace("&", "&amp;")
    text = text.replace("<", "&lt;")
    text = text.replace(">", "&gt;")
    # Then apply markdown formatting
    # Bold
    text = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", text)
    # Italic (single *)
    text = re.sub(r"(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)", r"<i>\1</i>", text)
    # Code — just bold it
    text = re.sub(r"`(.+?)`", r"<b>\1</b>", text)
    # Strikethrough
    text = re.sub(r"~~(.+?)~~", r"[\1]", text)
    return text


def build_table(rows):
    """Build a styled table from parsed rows."""
    if not rows:
        return Spacer(1, 1*mm)

    # First row is header
    max_cols = max(len(r) for r in rows)

    # Normalize rows
    for r in rows:
        while len(r) < max_cols:
            r.append("")

    # Build data with Paragraphs
    data = []
    for ri, row in enumerate(rows):
        if ri == 0:
            data.append([Paragraph(clean_md(c), style_table_header) for c in row])
        else:
            data.append([Paragraph(clean_md(c), style_table_cell) for c in row])

    # Calculate col widths
    avail_width = A4[0] - 40*mm
    col_width = avail_width / max_cols
    col_widths = [col_width] * max_cols

    # If 2 columns, make second wider
    if max_cols == 2:
        col_widths = [avail_width * 0.3, avail_width * 0.7]
    elif max_cols == 3:
        col_widths = [avail_width * 0.25, avail_width * 0.45, avail_width * 0.3]

    table = Table(data, colWidths=col_widths, repeatRows=1)

    style_cmds = [
        # Header
        ("BACKGROUND", (0, 0), (-1, 0), TABLE_HEADER_BG),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("FONTNAME", (0, 0), (-1, 0), "Sora-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 8),

        # Body
        ("FONTNAME", (0, 1), (-1, -1), "Sora"),
        ("FONTSIZE", (0, 1), (-1, -1), 7.5),

        # Grid
        ("GRID", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ]

    # Alternating row colors
    for ri in range(1, len(data)):
        if ri % 2 == 0:
            style_cmds.append(("BACKGROUND", (0, ri), (-1, ri), TABLE_ROW_ALT))

    table.setStyle(TableStyle(style_cmds))
    return table


def main():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)

    # Read markdown
    md_text = MD_FILE.read_text(encoding="utf-8")

    # Remove the first title (we use cover page instead)
    md_text = re.sub(r"^# .+\n", "", md_text, count=1)

    # Remove metadata lines at top (Cliente:, Marca:, etc) — cover page has them
    lines = md_text.split("\n")
    start = 0
    for i, line in enumerate(lines):
        if line.startswith("# ") or (line.startswith("---") and i > 3):
            start = i
            break
    md_text = "\n".join(lines[start:])

    # Parse
    elements = parse_md(md_text)

    # Build PDF
    doc = SimpleDocTemplate(
        str(OUTPUT),
        pagesize=A4,
        topMargin=22*mm,
        bottomMargin=22*mm,
        leftMargin=20*mm,
        rightMargin=20*mm,
    )

    # Cover page + content
    def first_page(canvas, doc):
        cover_page(canvas, doc)

    def later_pages(canvas, doc):
        header_footer(canvas, doc)

    # Add page break after cover
    all_elements = [PageBreak()] + elements

    doc.build(all_elements, onFirstPage=first_page, onLaterPages=later_pages)
    print(f"PDF gerado: {OUTPUT}")
    print(f"Páginas: ~{len(elements) // 30}")


if __name__ == "__main__":
    main()

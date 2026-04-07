#!/usr/bin/env python3
"""
Gerador de PDF: Panorama de Candidatos com Análise de Densidade.

Gera um PDF visual com:
1. Análise de densidade de termos (quantas marcas usam cada radical)
2. Tabela de candidatos com especificações na íntegra e veredito de risco
3. Cards visuais por candidato com confronto de specs

Uso:
    python gerar_panorama_pdf.py "cases/Cliente/Marca/" --marca "Will's Burger"
"""

import sys
import json
import re
import os
from pathlib import Path
from datetime import datetime
from collections import Counter

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT, TA_JUSTIFY
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Flowable, Table, TableStyle,
    PageBreak, KeepTogether
)
from reportlab.lib.styles import ParagraphStyle

# --- CORES ---
C_PRIMARY = HexColor('#9FEC14')
C_TEXT = HexColor('#595959')
C_GRAY = HexColor('#656565')
C_WHITE = HexColor('#FFFFFF')
C_RED = HexColor('#E53935')
C_RED_LIGHT = HexColor('#FFEBEE')
C_ORANGE = HexColor('#FB8C00')
C_ORANGE_LIGHT = HexColor('#FFF3E0')
C_GREEN = HexColor('#43A047')
C_GREEN_LIGHT = HexColor('#E8F5E9')
C_BLUE = HexColor('#1E88E5')
C_BLUE_LIGHT = HexColor('#E3F2FD')
C_DARK = HexColor('#263238')
C_HEADER_BG = HexColor('#37474F')

MARGIN = 2.2 * cm
PAGE_W, PAGE_H = A4
CONTENT_W = PAGE_W - 2 * MARGIN


def register_fonts():
    base_dir = Path(__file__).parent.parent.absolute()
    font_dir = base_dir / "assets/fonts"
    sora_reg = font_dir / "Sora-Regular.ttf"
    sora_bold = font_dir / "Sora-Bold.ttf"
    if sora_reg.exists():
        pdfmetrics.registerFont(TTFont('Sora', str(sora_reg)))
        if sora_bold.exists():
            pdfmetrics.registerFont(TTFont('Sora-Bold', str(sora_bold)))
            from reportlab.pdfbase.pdfmetrics import registerFontFamily
            registerFontFamily('Sora', normal='Sora', bold='Sora-Bold',
                               italic='Sora', boldItalic='Sora-Bold')
        return 'Sora', 'Sora-Bold'
    return 'Helvetica', 'Helvetica-Bold'


FONT, FONT_B = register_fonts()


class GreenLine(Flowable):
    def __init__(self):
        Flowable.__init__(self)

    def wrap(self, aw, ah):
        self.width = aw
        return aw, 4

    def draw(self):
        self.canv.setStrokeColor(C_PRIMARY)
        self.canv.setLineWidth(3)
        self.canv.line(0, 0, self.width, 0)


class DensityBar(Flowable):
    """Barra horizontal mostrando densidade de um termo."""

    def __init__(self, label, count, max_count, color=C_BLUE, width=None):
        Flowable.__init__(self)
        self.label = label
        self.count = count
        self.max_count = max_count
        self.color = color
        self.bar_width = width or 10 * cm
        self.bar_height = 0.6 * cm

    def wrap(self, aw, ah):
        return aw, self.bar_height + 0.3 * cm

    def draw(self):
        c = self.canv
        y = 0.15 * cm

        # Label
        c.setFont(FONT, 8)
        c.setFillColor(C_TEXT)
        c.drawString(0, y + 0.1 * cm, self.label)

        # Bar background
        bar_x = 3.5 * cm
        bar_w = self.bar_width - bar_x
        c.setFillColor(HexColor('#EEEEEE'))
        c.roundRect(bar_x, y, bar_w, self.bar_height, 3, fill=1, stroke=0)

        # Bar fill
        ratio = self.count / self.max_count if self.max_count > 0 else 0
        fill_w = bar_w * ratio
        if fill_w > 0:
            c.setFillColor(self.color)
            c.roundRect(bar_x, y, fill_w, self.bar_height, 3, fill=1, stroke=0)

        # Count text
        c.setFont(FONT_B, 9)
        c.setFillColor(C_WHITE if ratio > 0.3 else C_TEXT)
        text_x = bar_x + max(fill_w / 2, 0.8 * cm)
        c.drawCentredString(text_x, y + 0.15 * cm, str(self.count))


def header_footer(canvas, doc):
    canvas.saveState()
    base_dir = Path(__file__).parent.parent.absolute()
    logo = base_dir / "assets/imagens-fixas/logo-genesis.png"
    if logo.exists():
        canvas.drawImage(str(logo), (PAGE_W - 5 * cm) / 2, PAGE_H - MARGIN - 0.5 * cm,
                         width=5 * cm, height=1.8 * cm, mask='auto', preserveAspectRatio=True)
    canvas.setFont(FONT, 8)
    canvas.setFillColor(C_GRAY)
    canvas.drawCentredString(PAGE_W / 2, 1.2 * cm,
                             "Genesis - Marcas e Patentes | Documento interno de análise")
    canvas.drawRightString(PAGE_W - MARGIN, 1.2 * cm, f"Pág. {doc.page}")
    canvas.restoreState()


def risk_color(veredito_or_score):
    """Returns (bg_color, text_color, label) based on risk."""
    if isinstance(veredito_or_score, str):
        v = veredito_or_score.upper()
        if 'ALTO' in v or 'CANDIDATA' in v:
            return C_RED_LIGHT, C_RED, 'ALTO'
        elif 'MÉDIO' in v or 'LIMÍTROFE' in v or 'MEDIO' in v:
            return C_ORANGE_LIGHT, C_ORANGE, 'MÉDIO'
        else:
            return C_GREEN_LIGHT, C_GREEN, 'BAIXO'
    else:
        s = int(veredito_or_score)
        if s >= 60:
            return C_RED_LIGHT, C_RED, 'ALTO'
        elif s >= 35:
            return C_ORANGE_LIGHT, C_ORANGE, 'MÉDIO'
        else:
            return C_GREEN_LIGHT, C_GREEN, 'BAIXO'


def generate_panorama(case_dir, marca_cliente):
    case_dir = Path(case_dir)

    # Load data
    radar_path = case_dir / f"{marca_cliente} - RADAR.json"
    confronto_path = case_dir / f"{marca_cliente} - CONFRONTO.json"
    inpi_path = case_dir / "inpi-raw-processed.json"

    with open(radar_path, encoding='utf-8') as f:
        radar = json.load(f)
    with open(inpi_path, encoding='utf-8') as f:
        inpi_data = json.load(f)

    confronto = None
    if confronto_path.exists():
        with open(confronto_path, encoding='utf-8') as f:
            confronto = json.load(f)

    # Build lookup
    inpi_lookup = {}
    for m in inpi_data:
        proc = m.get('numero_processo', '')
        if proc:
            inpi_lookup[proc] = m

    # Get candidates + borderline
    candidatas = [m for m in radar['marcas'] if m['veredito'] == 'CANDIDATA']
    limitrofes = [m for m in radar['marcas'] if m['veredito'] == 'LIMÍTROFE']
    all_relevant = candidatas + limitrofes

    # --- Density analysis ---
    all_names = [m.get('nome_marca', '') or m.get('nome', '') for m in inpi_data]
    all_names_lower = [n.lower() for n in all_names]

    # Count radicals
    radical_counts = Counter()
    for name in all_names_lower:
        words = re.findall(r'[a-záàâãéèêíïóôõöúüç]+', name)
        for w in set(words):  # unique per name
            if len(w) >= 3:
                radical_counts[w] += 1

    # Key terms
    key_terms = {
        'burger': 0, 'burguer': 0, 'will': 0, 'wills': 0, 'bill': 0,
        'billy': 0, 'villa': 0, 'villas': 0, 'hill': 0, 'hills': 0,
        'grill': 0, 'smash': 0, 'well': 0,
    }
    for term in key_terms:
        key_terms[term] = sum(1 for n in all_names_lower if term in n)

    # --- Build PDF ---
    output_path = case_dir / f"{marca_cliente} - PANORAMA CANDIDATOS.pdf"

    doc = SimpleDocTemplate(
        str(output_path), pagesize=A4,
        rightMargin=MARGIN, leftMargin=MARGIN,
        topMargin=3.5 * cm, bottomMargin=2 * cm
    )

    # Styles
    s_title = ParagraphStyle('T', fontName=FONT_B, fontSize=20, textColor=C_PRIMARY,
                             alignment=TA_CENTER, spaceAfter=6)
    s_sub = ParagraphStyle('Sub', fontName=FONT, fontSize=11, textColor=C_GRAY,
                           alignment=TA_CENTER, spaceAfter=16)
    s_h1 = ParagraphStyle('H1', fontName=FONT_B, fontSize=14, textColor=C_PRIMARY,
                          spaceBefore=18, spaceAfter=6)
    s_h2 = ParagraphStyle('H2', fontName=FONT_B, fontSize=11, textColor=C_DARK,
                          spaceBefore=12, spaceAfter=4)
    s_body = ParagraphStyle('B', fontName=FONT, fontSize=9, textColor=C_TEXT,
                            leading=13, spaceAfter=6)
    s_body_small = ParagraphStyle('BS', fontName=FONT, fontSize=7.5, textColor=C_GRAY,
                                  leading=10, spaceAfter=3)
    s_cell = ParagraphStyle('C', fontName=FONT, fontSize=7.5, textColor=C_TEXT, leading=10)
    s_cell_b = ParagraphStyle('CB', fontName=FONT_B, fontSize=7.5, textColor=C_TEXT, leading=10)
    s_cell_h = ParagraphStyle('CH', fontName=FONT_B, fontSize=7.5, textColor=C_WHITE, leading=10)
    s_stat_num = ParagraphStyle('SN', fontName=FONT_B, fontSize=24, textColor=C_PRIMARY,
                                alignment=TA_CENTER)
    s_stat_lbl = ParagraphStyle('SL', fontName=FONT, fontSize=8, textColor=C_GRAY,
                                alignment=TA_CENTER)

    story = []

    # === CAPA ===
    story.append(Paragraph("PANORAMA DE CANDIDATOS", s_title))
    story.append(Paragraph(
        f"Marca: <b>{marca_cliente}</b> | {datetime.now().strftime('%d/%m/%Y')}", s_sub))
    story.append(GreenLine())
    story.append(Spacer(1, 0.6 * cm))

    # Stats
    n_total = radar.get('total_marcas', 0)
    n_cand = len(candidatas)
    n_lim = len(limitrofes)
    n_com_spec = sum(1 for m in all_relevant
                     if inpi_lookup.get(m.get('processo', ''), {}).get('especificacao'))

    stats = Table([
        [Paragraph(str(n_total), s_stat_num),
         Paragraph(str(n_cand), s_stat_num),
         Paragraph(str(n_lim), s_stat_num),
         Paragraph(str(n_com_spec), s_stat_num)],
        [Paragraph("ANALISADAS", s_stat_lbl),
         Paragraph("CANDIDATAS", s_stat_lbl),
         Paragraph("LIMÍTROFES", s_stat_lbl),
         Paragraph("COM SPECS", s_stat_lbl)],
    ], colWidths=[CONTENT_W / 4] * 4)
    stats.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BACKGROUND', (1, 0), (1, 1), C_RED_LIGHT),
        ('BACKGROUND', (2, 0), (2, 1), C_ORANGE_LIGHT),
        ('BACKGROUND', (3, 0), (3, 1), C_BLUE_LIGHT),
        ('TOPPADDING', (0, 0), (-1, 0), 10),
        ('BOTTOMPADDING', (0, 1), (-1, 1), 10),
    ]))
    story.append(stats)
    story.append(Spacer(1, 0.8 * cm))

    # === DENSIDADE DE TERMOS ===
    story.append(Paragraph("ANÁLISE DE DENSIDADE", s_h1))
    story.append(GreenLine())
    story.append(Spacer(1, 0.3 * cm))
    story.append(Paragraph(
        "Quantas marcas na base do INPI utilizam cada termo. "
        "Quanto maior a densidade, mais diluído o termo — mais fraco como marca exclusiva.",
        s_body))

    # Sort by count, show top terms
    sorted_terms = sorted(key_terms.items(), key=lambda x: x[1], reverse=True)
    max_count = max(key_terms.values()) if key_terms else 1

    for term, count in sorted_terms:
        if count == 0:
            continue
        color = C_RED if term in ('will', 'wills', 'well') else C_BLUE
        story.append(DensityBar(term.upper(), count, max_count, color=color, width=CONTENT_W))

    story.append(Spacer(1, 0.3 * cm))

    burger_count = key_terms.get('burger', 0) + key_terms.get('burguer', 0)
    will_count = key_terms.get('will', 0) + key_terms.get('wills', 0)
    story.append(Paragraph(
        f"<b>Conclusão:</b> O termo 'BURGER' aparece em <b>{burger_count}</b> marcas — "
        f"altamente diluído, sem força exclusiva. O radical 'WILL/WILLS' aparece em "
        f"<b>{will_count}</b> marcas — densidade moderada, coexistência viável com diferenciação.",
        s_body))

    # === TABELA DE CANDIDATOS ===
    story.append(PageBreak())
    story.append(Paragraph("CANDIDATOS — ESPECIFICAÇÕES E RISCO", s_h1))
    story.append(GreenLine())
    story.append(Spacer(1, 0.3 * cm))

    # Header
    header = [
        Paragraph("Marca", s_cell_h),
        Paragraph("Processo", s_cell_h),
        Paragraph("Status", s_cell_h),
        Paragraph("Score", s_cell_h),
        Paragraph("Especificação Completa", s_cell_h),
        Paragraph("Risco", s_cell_h),
    ]
    rows = [header]
    row_colors = []

    for m in candidatas:
        proc = m.get('processo', '')
        info = inpi_lookup.get(proc, {})
        spec = info.get('especificacao', '') or 'Sem especificação'
        score = m.get('score_final', 0)
        situacao = info.get('situacao', '') or m.get('status', '')

        # Determine risk
        bg, tc, label = risk_color(score)
        s_risk = ParagraphStyle('R', fontName=FONT_B, fontSize=8, textColor=tc, leading=10)

        # Shorten situacao
        sit_short = situacao[:35] + '...' if len(situacao) > 35 else situacao

        row = [
            Paragraph(f"<b>{m.get('nome', '?')[:30]}</b>", s_cell_b),
            Paragraph(str(proc), s_cell),
            Paragraph(sit_short, s_cell),
            Paragraph(str(score), s_cell_b),
            Paragraph(spec[:200] + ('...' if len(spec) > 200 else ''), s_cell),
            Paragraph(label, s_risk),
        ]
        rows.append(row)
        row_colors.append(bg)

    col_w = [3.2 * cm, 1.8 * cm, 2.5 * cm, 1 * cm, 6.5 * cm, 1.3 * cm]
    t = Table(rows, colWidths=col_w, repeatRows=1)

    style_cmds = [
        ('BACKGROUND', (0, 0), (-1, 0), C_HEADER_BG),
        ('TEXTCOLOR', (0, 0), (-1, 0), C_WHITE),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('ALIGN', (3, 0), (3, -1), 'CENTER'),
        ('ALIGN', (5, 0), (5, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('GRID', (0, 0), (-1, -1), 0.4, HexColor('#E0E0E0')),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 3),
        ('RIGHTPADDING', (0, 0), (-1, -1), 3),
    ]
    for i, bg in enumerate(row_colors):
        style_cmds.append(('BACKGROUND', (5, i + 1), (5, i + 1), bg))

    t.setStyle(TableStyle(style_cmds))
    story.append(t)

    # === LIMÍTROFES TABLE (compact) ===
    if limitrofes:
        story.append(PageBreak())
        story.append(Paragraph("LIMÍTROFES — ESPECIFICAÇÕES E RISCO", s_h1))
        story.append(GreenLine())
        story.append(Spacer(1, 0.3 * cm))

        header2 = [
            Paragraph("Marca", s_cell_h),
            Paragraph("Proc.", s_cell_h),
            Paragraph("Score", s_cell_h),
            Paragraph("Especificação", s_cell_h),
            Paragraph("Risco", s_cell_h),
        ]
        rows2 = [header2]
        row_colors2 = []

        # Only show top 50 limítrofes by score
        for m in limitrofes[:50]:
            proc = m.get('processo', '')
            info = inpi_lookup.get(proc, {})
            spec = info.get('especificacao', '') or 'Sem especificação'
            score = m.get('score_final', 0)

            bg, tc, label = risk_color(score)
            s_risk = ParagraphStyle('R2', fontName=FONT_B, fontSize=7, textColor=tc, leading=9)

            row = [
                Paragraph(m.get('nome', '?')[:25], s_cell),
                Paragraph(str(proc), s_cell),
                Paragraph(str(score), s_cell_b),
                Paragraph(spec[:150] + ('...' if len(spec) > 150 else ''), s_cell),
                Paragraph(label, s_risk),
            ]
            rows2.append(row)
            row_colors2.append(bg)

        col_w2 = [3 * cm, 1.8 * cm, 1 * cm, 8.5 * cm, 1.3 * cm]
        t2 = Table(rows2, colWidths=col_w2, repeatRows=1)

        style_cmds2 = [
            ('BACKGROUND', (0, 0), (-1, 0), C_HEADER_BG),
            ('TEXTCOLOR', (0, 0), (-1, 0), C_WHITE),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('ALIGN', (2, 0), (2, -1), 'CENTER'),
            ('ALIGN', (4, 0), (4, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('GRID', (0, 0), (-1, -1), 0.4, HexColor('#E0E0E0')),
            ('TOPPADDING', (0, 0), (-1, -1), 3),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
            ('LEFTPADDING', (0, 0), (-1, -1), 3),
        ]
        for i, bg in enumerate(row_colors2):
            style_cmds2.append(('BACKGROUND', (4, i + 1), (4, i + 1), bg))
            if i % 2 == 0:
                style_cmds2.append(('BACKGROUND', (0, i + 1), (3, i + 1), HexColor('#FAFAFA')))

        t2.setStyle(TableStyle(style_cmds2))
        story.append(t2)

        if len(limitrofes) > 50:
            story.append(Paragraph(
                f"Mostrando 50 de {len(limitrofes)} limítrofes.", s_body_small))

    # === CONFRONTO VISUAL (territory map) ===
    if confronto:
        story.append(PageBreak())
        story.append(Paragraph("MAPA DE TERRITÓRIO — CONFRONTO DE ESPECIFICAÇÕES", s_h1))
        story.append(GreenLine())
        story.append(Spacer(1, 0.3 * cm))

        pres = confronto.get('territorio_preservado_pct', 0)
        n_col = confronto.get('colidencias_reais', 0)
        n_neut = confronto.get('candidatas_neutralizadas', 0)

        # Summary bar
        summary = Table([
            [Paragraph(f"{pres}%", s_stat_num),
             Paragraph(str(n_col), s_stat_num),
             Paragraph(str(n_neut), s_stat_num)],
            [Paragraph("PRESERVADO", s_stat_lbl),
             Paragraph("COM CONFLITO", s_stat_lbl),
             Paragraph("NEUTRALIZADAS", s_stat_lbl)],
        ], colWidths=[CONTENT_W / 3] * 3)
        summary.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('BACKGROUND', (0, 0), (0, 1), C_GREEN_LIGHT),
            ('BACKGROUND', (1, 0), (1, 1), C_RED_LIGHT),
            ('BACKGROUND', (2, 0), (2, 1), C_BLUE_LIGHT),
            ('TOPPADDING', (0, 0), (-1, 0), 8),
            ('BOTTOMPADDING', (0, 1), (-1, 1), 8),
        ]))
        story.append(summary)
        story.append(Spacer(1, 0.5 * cm))

        for cl_data in confronto.get('territorio', []):
            classe = cl_data.get('classe', '?')
            story.append(Paragraph(f"Classe {classe}", s_h2))

            spec_header = [
                Paragraph("Código", s_cell_h),
                Paragraph("Especificação", s_cell_h),
                Paragraph("Status", s_cell_h),
                Paragraph("Conflitos", s_cell_h),
            ]
            spec_rows = [spec_header]
            spec_colors = []

            for spec in cl_data.get('especificacoes', []):
                status = spec.get('status', 'SEGURO')
                conflitos = spec.get('conflitos', [])

                if status == 'SEGURO':
                    bg, tc = C_GREEN_LIGHT, C_GREEN
                    icon = '✅'
                elif status == 'BLOQUEADO':
                    bg, tc = C_RED_LIGHT, C_RED
                    icon = '❌'
                else:
                    bg, tc = C_ORANGE_LIGHT, C_ORANGE
                    icon = '⚠️'

                s_st = ParagraphStyle('ST', fontName=FONT_B, fontSize=7.5, textColor=tc, leading=10)
                n_conf = len(conflitos)

                spec_rows.append([
                    Paragraph(str(spec.get('codigo', '')), s_cell),
                    Paragraph(spec.get('descricao', ''), s_cell),
                    Paragraph(f"{icon} {status}", s_st),
                    Paragraph(str(n_conf) if n_conf > 0 else '—', s_cell),
                ])
                spec_colors.append(bg)

            spec_t = Table(spec_rows, colWidths=[1.5 * cm, 7.5 * cm, 2.5 * cm, 2 * cm],
                           repeatRows=1)
            spec_style = [
                ('BACKGROUND', (0, 0), (-1, 0), C_HEADER_BG),
                ('TEXTCOLOR', (0, 0), (-1, 0), C_WHITE),
                ('GRID', (0, 0), (-1, -1), 0.4, HexColor('#E0E0E0')),
                ('ALIGN', (2, 0), (3, -1), 'CENTER'),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('TOPPADDING', (0, 0), (-1, -1), 3),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
                ('LEFTPADDING', (0, 0), (-1, -1), 3),
            ]
            for i, bg in enumerate(spec_colors):
                spec_style.append(('BACKGROUND', (2, i + 1), (2, i + 1), bg))

            spec_t.setStyle(TableStyle(spec_style))
            story.append(spec_t)
            story.append(Spacer(1, 0.3 * cm))

    # Build
    doc.build(story, onFirstPage=header_footer, onLaterPages=header_footer)
    print(f"✅ Panorama PDF gerado: {output_path}")
    return output_path


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Gera PDF Panorama de Candidatos")
    parser.add_argument('case_dir', help='Diretório do caso')
    parser.add_argument('--marca', required=True, help='Nome da marca do cliente')
    parser.add_argument('-o', '--output', help='Caminho de saída (opcional)')
    args = parser.parse_args()

    generate_panorama(args.case_dir, args.marca)


if __name__ == "__main__":
    main()

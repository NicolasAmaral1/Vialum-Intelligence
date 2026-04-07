#!/usr/bin/env python3
"""
Gerador de PDF Visual do Radar de Similaridade.

Gera um PDF com:
1. Funil visual: todas as marcas → candidatas → colidências
2. Tabela com scores por eixo (fonético, gráfico, ideológico)
3. Barras visuais de score para cada marca
4. Resumo executivo com estatísticas

Uso:
    python gerar_radar_pdf.py "cases/Cliente/Marca/Marca - RADAR.json"
    python gerar_radar_pdf.py "cases/Cliente/Marca/Marca - RADAR.json" --confronto "Marca - CONFRONTO.json"
"""

import sys
import json
import os
from pathlib import Path
from datetime import datetime

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_JUSTIFY, TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Flowable, Table, TableStyle, PageBreak
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

# --- CORES ---
COLOR_PRIMARY = HexColor('#9FEC14')   # Verde Genesis
COLOR_BG_DARK = HexColor('#1A1A2E')   # Fundo escuro
COLOR_TEXT = HexColor('#595959')
COLOR_GRAY = HexColor('#656565')
COLOR_WHITE = HexColor('#FFFFFF')
COLOR_RED = HexColor('#FF4444')
COLOR_ORANGE = HexColor('#FF8C00')
COLOR_YELLOW = HexColor('#FFD700')
COLOR_GREEN_SAFE = HexColor('#4CAF50')
COLOR_LIGHT_BG = HexColor('#F5F5F5')

MARGIN = 2.5 * cm

# --- FONTES ---
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
            registerFontFamily('Sora', normal='Sora', bold='Sora-Bold', italic='Sora', boldItalic='Sora-Bold')
        return 'Sora', 'Sora-Bold'
    return 'Helvetica', 'Helvetica-Bold'

FONT_REG, FONT_BOLD = register_fonts()


# --- FLOWABLES CUSTOMIZADOS ---

class ScoreBar(Flowable):
    """Barra visual de score (0-100) com cor gradiente."""

    def __init__(self, score, width=4*cm, height=0.4*cm):
        Flowable.__init__(self)
        self.score = score
        self.bar_width = width
        self.bar_height = height

    def wrap(self, availWidth, availHeight):
        return self.bar_width, self.bar_height

    def draw(self):
        # Fundo cinza claro
        self.canv.setFillColor(HexColor('#E0E0E0'))
        self.canv.roundRect(0, 0, self.bar_width, self.bar_height, 2, fill=1, stroke=0)

        # Barra de progresso com cor baseada no score
        if self.score >= 60:
            color = COLOR_RED
        elif self.score >= 35:
            color = COLOR_ORANGE
        else:
            color = COLOR_GREEN_SAFE

        fill_width = (self.score / 100.0) * self.bar_width
        if fill_width > 0:
            self.canv.setFillColor(color)
            self.canv.roundRect(0, 0, fill_width, self.bar_height, 2, fill=1, stroke=0)

        # Texto do score
        self.canv.setFillColor(COLOR_WHITE if self.score > 30 else COLOR_TEXT)
        self.canv.setFont(FONT_BOLD, 8)
        text_x = fill_width / 2 if fill_width > 1*cm else fill_width + 0.3*cm
        self.canv.drawCentredString(max(text_x, 0.5*cm), 0.1*cm, str(self.score))


class FunnelDiagram(Flowable):
    """Diagrama de funil visual mostrando a filtragem."""

    def __init__(self, total, candidatas, limitrofes, descartadas, colidencias=None):
        Flowable.__init__(self)
        self.total = total
        self.candidatas = candidatas
        self.limitrofes = limitrofes
        self.descartadas = descartadas
        self.colidencias = colidencias
        self.diagram_width = 14 * cm
        self.diagram_height = 8 * cm if colidencias is not None else 6 * cm

    def wrap(self, availWidth, availHeight):
        return self.diagram_width, self.diagram_height

    def draw(self):
        c = self.canv
        w = self.diagram_width

        levels = [
            (self.total, "BUSCA INPI", f"{self.total} marcas encontradas", HexColor('#3B3B5C')),
            (self.candidatas + self.limitrofes, "RADAR (Fase 1)", f"{self.candidatas} candidatas + {self.limitrofes} limítrofes", COLOR_ORANGE),
        ]

        if self.colidencias is not None:
            levels.append(
                (self.colidencias, "CONFRONTO (Fase 2)", f"{self.colidencias} colidências reais", COLOR_RED)
            )

        y = self.diagram_height
        max_w = w * 0.95

        for i, (count, label, desc, color) in enumerate(levels):
            # Proporção relativa ao total
            if self.total > 0:
                ratio = max(count / self.total, 0.15)  # mínimo 15% pra não ficar invisível
            else:
                ratio = 1.0

            bar_w = max_w * ratio
            bar_h = 1.5 * cm
            x = (w - bar_w) / 2
            y -= bar_h + 0.3 * cm

            # Retângulo
            c.setFillColor(color)
            c.roundRect(x, y, bar_w, bar_h, 4, fill=1, stroke=0)

            # Texto dentro
            c.setFillColor(COLOR_WHITE)
            c.setFont(FONT_BOLD, 11)
            c.drawCentredString(w / 2, y + bar_h / 2 + 0.1 * cm, label)
            c.setFont(FONT_REG, 9)
            c.drawCentredString(w / 2, y + bar_h / 2 - 0.4 * cm, desc)

            # Seta entre níveis
            if i < len(levels) - 1:
                c.setStrokeColor(COLOR_GRAY)
                c.setLineWidth(1.5)
                arrow_y = y - 0.15 * cm
                c.line(w / 2, arrow_y, w / 2, arrow_y - 0.15 * cm)

        # Descartadas (ao lado)
        c.setFont(FONT_REG, 9)
        c.setFillColor(COLOR_GREEN_SAFE)
        desc_text = f"{self.descartadas} descartadas"
        top_y = self.diagram_height - 1.5 * cm - 0.3 * cm
        c.drawString(w * 0.82, top_y + 0.3 * cm, desc_text)
        c.setFillColor(COLOR_GREEN_SAFE)
        c.drawString(w * 0.82, top_y + 0.05 * cm, "(sem similaridade)")


class GreenLine(Flowable):
    def __init__(self):
        Flowable.__init__(self)
    def wrap(self, availWidth, availHeight):
        self.width = availWidth
        return availWidth, 4
    def draw(self):
        self.canv.setStrokeColor(COLOR_PRIMARY)
        self.canv.setLineWidth(3.0)
        self.canv.line(0, 0, self.width, 0)


# --- HEADER/FOOTER ---
_meta = {}

def header_page(canvas, doc):
    canvas.saveState()
    page_width, page_height = A4
    base_dir = Path(__file__).parent.parent.absolute()
    logo_path = base_dir / "assets/imagens-fixas/logo-genesis.png"
    if logo_path.exists():
        img_w = 5 * cm
        img_h = 1.8 * cm
        x = (page_width - img_w) / 2
        y = page_height - MARGIN - 0.5 * cm
        canvas.drawImage(str(logo_path), x, y, width=img_w, height=img_h, mask='auto', preserveAspectRatio=True)

    canvas.setFont(FONT_REG, 8)
    canvas.setFillColor(COLOR_GRAY)
    canvas.drawCentredString(page_width / 2, 1.2 * cm, "Genesis - Marcas e Patentes | Documento interno de análise")
    canvas.drawRightString(page_width - MARGIN, 1.2 * cm, f"Pág. {doc.page}")
    canvas.restoreState()


# --- GERAÇÃO DO PDF ---

def color_for_score(score):
    if score >= 60:
        return COLOR_RED
    elif score >= 35:
        return COLOR_ORANGE
    return COLOR_GREEN_SAFE


def veredito_label(veredito):
    mapping = {
        'CANDIDATA': ('CANDIDATA', COLOR_RED),
        'LIMÍTROFE': ('LIMÍTROFE', COLOR_ORANGE),
        'DESCARTADA': ('DESCARTADA', COLOR_GREEN_SAFE),
    }
    return mapping.get(veredito, (veredito, COLOR_GRAY))


def gerar_pdf(radar_data, output_path, confronto_data=None):
    global _meta
    _meta = radar_data

    doc = SimpleDocTemplate(
        str(output_path),
        pagesize=A4,
        rightMargin=MARGIN,
        leftMargin=MARGIN,
        topMargin=3.5 * cm,
        bottomMargin=2 * cm
    )

    styles = getSampleStyleSheet()

    s_title = ParagraphStyle('RadarTitle', fontName=FONT_BOLD, fontSize=22, textColor=COLOR_PRIMARY, alignment=TA_CENTER, spaceAfter=6)
    s_subtitle = ParagraphStyle('RadarSub', fontName=FONT_REG, fontSize=12, textColor=COLOR_GRAY, alignment=TA_CENTER, spaceAfter=20)
    s_h1 = ParagraphStyle('RadarH1', fontName=FONT_BOLD, fontSize=15, textColor=COLOR_PRIMARY, spaceBefore=20, spaceAfter=6)
    s_h2 = ParagraphStyle('RadarH2', fontName=FONT_BOLD, fontSize=12, textColor=COLOR_TEXT, spaceBefore=14, spaceAfter=4)
    s_body = ParagraphStyle('RadarBody', fontName=FONT_REG, fontSize=10, textColor=COLOR_TEXT, leading=14, spaceAfter=8)
    s_body_small = ParagraphStyle('RadarSmall', fontName=FONT_REG, fontSize=8, textColor=COLOR_GRAY, leading=11, spaceAfter=4)
    s_stat_number = ParagraphStyle('StatNum', fontName=FONT_BOLD, fontSize=28, textColor=COLOR_PRIMARY, alignment=TA_CENTER)
    s_stat_label = ParagraphStyle('StatLabel', fontName=FONT_REG, fontSize=9, textColor=COLOR_GRAY, alignment=TA_CENTER)

    story = []

    marca = radar_data.get('marca_cliente', 'MARCA')
    data = radar_data.get('data_analise', datetime.now().strftime('%d/%m/%Y'))
    resumo = radar_data.get('resumo', {})
    total = radar_data.get('total_marcas', 0)
    n_cand = resumo.get('candidatas', 0)
    n_lim = resumo.get('limitrofes', 0)
    n_desc = resumo.get('descartadas', 0)

    # === CAPA ===
    story.append(Paragraph("RADAR DE SIMILARIDADE", s_title))
    story.append(Paragraph(f"Marca: <b>{marca}</b> | Data: {data}", s_subtitle))
    story.append(GreenLine())
    story.append(Spacer(1, 0.8 * cm))

    # === ESTATÍSTICAS ===
    stats_data = [
        [
            Paragraph(str(total), s_stat_number),
            Paragraph(str(n_cand), s_stat_number),
            Paragraph(str(n_lim), s_stat_number),
            Paragraph(str(n_desc), s_stat_number),
        ],
        [
            Paragraph("ANALISADAS", s_stat_label),
            Paragraph("CANDIDATAS", s_stat_label),
            Paragraph("LIMÍTROFES", s_stat_label),
            Paragraph("DESCARTADAS", s_stat_label),
        ]
    ]

    available_w = A4[0] - 2 * MARGIN
    col_w = available_w / 4
    stats_table = Table(stats_data, colWidths=[col_w]*4)
    stats_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, 0), 12),
        ('BOTTOMPADDING', (0, 1), (-1, 1), 12),
        # Cor de fundo para candidatas (vermelho suave)
        ('BACKGROUND', (1, 0), (1, 1), HexColor('#FFF0F0')),
        # Cor de fundo para limítrofes (laranja suave)
        ('BACKGROUND', (2, 0), (2, 1), HexColor('#FFF8F0')),
        # Cor de fundo para descartadas (verde suave)
        ('BACKGROUND', (3, 0), (3, 1), HexColor('#F0FFF0')),
        ('ROUNDEDCORNERS', [4, 4, 4, 4]),
    ]))
    story.append(stats_table)
    story.append(Spacer(1, 0.8 * cm))

    # === FUNIL ===
    n_colid = None
    if confronto_data:
        n_colid = confronto_data.get('colidencias_reais', None)

    story.append(Paragraph("FUNIL DE ANÁLISE", s_h1))
    story.append(GreenLine())
    story.append(Spacer(1, 0.3 * cm))
    story.append(FunnelDiagram(total, n_cand, n_lim, n_desc, n_colid))
    story.append(Spacer(1, 0.5 * cm))

    # === PANORAMA COMPLETO ===
    story.append(PageBreak())
    story.append(Paragraph("PANORAMA COMPLETO", s_h1))
    story.append(GreenLine())
    story.append(Spacer(1, 0.3 * cm))
    # Filter: only show candidates + borderline + top 10 discarded in the table
    all_marcas = sorted(radar_data.get('marcas', []), key=lambda m: m.get('score_final', 0), reverse=True)
    marcas_relevantes = [m for m in all_marcas if m.get('veredito') in ('CANDIDATA', 'LIMÍTROFE')]
    top_descartadas = [m for m in all_marcas if m.get('veredito') == 'DESCARTADA'][:10]
    marcas = marcas_relevantes + top_descartadas

    story.append(Paragraph(
        f"Candidatas e limítrofes ({len(marcas_relevantes)}) + top 10 descartadas. "
        f"Total analisado: {len(all_marcas)} marcas.",
        s_body
    ))

    # Tabela panorâmica
    s_cell = ParagraphStyle('Cell', fontName=FONT_REG, fontSize=8, textColor=COLOR_TEXT, leading=10)
    s_cell_bold = ParagraphStyle('CellBold', fontName=FONT_BOLD, fontSize=8, textColor=COLOR_TEXT, leading=10)
    s_cell_header = ParagraphStyle('CellH', fontName=FONT_BOLD, fontSize=8, textColor=COLOR_WHITE, leading=10)

    header_row = [
        Paragraph("#", s_cell_header),
        Paragraph("Marca", s_cell_header),
        Paragraph("Processo", s_cell_header),
        Paragraph("Fon.", s_cell_header),
        Paragraph("Grá.", s_cell_header),
        Paragraph("Ide.", s_cell_header),
        Paragraph("Score", s_cell_header),
        Paragraph("Veredito", s_cell_header),
    ]

    table_data = [header_row]

    for i, m in enumerate(marcas, 1):
        scores = m.get('scores', {})
        sf = scores.get('fonetico', 0)
        sg = scores.get('grafico', 0)
        si = scores.get('ideologico', 0)
        score_final = m.get('score_final', 0)
        veredito = m.get('veredito', 'DESCARTADA')

        label_text, label_color = veredito_label(veredito)

        s_veredito = ParagraphStyle('Veredito', fontName=FONT_BOLD, fontSize=7, textColor=label_color, leading=10)

        nome = m.get('nome', '?')
        if veredito == 'CANDIDATA':
            nome_p = Paragraph(f"<b>{nome}</b>", s_cell_bold)
        else:
            nome_p = Paragraph(nome, s_cell)

        row = [
            Paragraph(str(i), s_cell),
            nome_p,
            Paragraph(str(m.get('processo', '')), s_cell),
            Paragraph(str(sf), s_cell),
            Paragraph(str(sg), s_cell),
            Paragraph(str(si), s_cell),
            Paragraph(f"<b>{score_final}</b>", s_cell_bold),
            Paragraph(label_text, s_veredito),
        ]
        table_data.append(row)

    col_widths = [0.6*cm, 4.5*cm, 2.2*cm, 1.0*cm, 1.0*cm, 1.0*cm, 1.2*cm, 2.2*cm]

    t = Table(table_data, colWidths=col_widths, repeatRows=1)

    table_style_cmds = [
        # Header
        ('BACKGROUND', (0, 0), (-1, 0), HexColor('#3B3B5C')),
        ('TEXTCOLOR', (0, 0), (-1, 0), COLOR_WHITE),
        ('FONTNAME', (0, 0), (-1, 0), FONT_BOLD),
        ('FONTSIZE', (0, 0), (-1, 0), 8),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('GRID', (0, 0), (-1, -1), 0.5, HexColor('#E0E0E0')),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 3),
        ('RIGHTPADDING', (0, 0), (-1, -1), 3),
        # Align marca name left
        ('ALIGN', (1, 1), (1, -1), 'LEFT'),
    ]

    # Colorir linhas alternadas + highlight por veredito
    for i, m in enumerate(marcas, 1):
        veredito = m.get('veredito', 'DESCARTADA')
        if veredito == 'CANDIDATA':
            table_style_cmds.append(('BACKGROUND', (0, i), (-1, i), HexColor('#FFF0F0')))
        elif veredito == 'LIMÍTROFE':
            table_style_cmds.append(('BACKGROUND', (0, i), (-1, i), HexColor('#FFF8F0')))
        elif i % 2 == 0:
            table_style_cmds.append(('BACKGROUND', (0, i), (-1, i), HexColor('#FAFAFA')))

    t.setStyle(TableStyle(table_style_cmds))
    story.append(t)

    # === DETALHAMENTO DAS CANDIDATAS ===
    candidatas = [m for m in marcas if m.get('veredito') in ('CANDIDATA', 'LIMÍTROFE')]

    if candidatas:
        story.append(PageBreak())
        story.append(Paragraph("DETALHAMENTO — CANDIDATAS E LIMÍTROFES", s_h1))
        story.append(GreenLine())
        story.append(Spacer(1, 0.3 * cm))

        for m in candidatas:
            scores = m.get('scores', {})
            score_final = m.get('score_final', 0)
            veredito = m.get('veredito', '')
            label_text, label_color = veredito_label(veredito)

            s_marca_title = ParagraphStyle('MarcaT', fontName=FONT_BOLD, fontSize=11, textColor=label_color, spaceBefore=14, spaceAfter=2)

            story.append(Paragraph(
                f"{m.get('nome', '?')} — Score: {score_final} ({label_text})",
                s_marca_title
            ))

            story.append(Paragraph(
                f"<b>Processo:</b> {m.get('processo', 'N/A')} | <b>Titular:</b> {m.get('titular', 'N/A')} | <b>Status:</b> {m.get('status', 'N/A')}",
                s_body_small
            ))

            # Score bars
            just = m.get('justificativa', {})
            score_items = [
                ('Fonético', scores.get('fonetico', 0), just.get('fonetico', '')),
                ('Gráfico', scores.get('grafico', 0), just.get('grafico', '')),
                ('Ideológico', scores.get('ideologico', 0), just.get('ideologico', '')),
            ]

            for label, score, justif in score_items:
                score_row_data = [[
                    Paragraph(f"<b>{label} ({score})</b>", s_body_small),
                    ScoreBar(score, width=3.5*cm),
                    Paragraph(justif, s_body_small),
                ]]
                score_table = Table(score_row_data, colWidths=[2.8*cm, 3.8*cm, available_w - 6.6*cm])
                score_table.setStyle(TableStyle([
                    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                    ('LEFTPADDING', (0, 0), (-1, -1), 0),
                    ('RIGHTPADDING', (0, 0), (-1, -1), 4),
                    ('TOPPADDING', (0, 0), (-1, -1), 2),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
                ]))
                story.append(score_table)

            # Especificações se disponível
            specs = m.get('especificacoes', '')
            if specs:
                story.append(Paragraph(f"<b>Especificações:</b> {specs}", s_body_small))

            story.append(Spacer(1, 0.2 * cm))

    # === CONFRONTO (se disponível) ===
    if confronto_data and confronto_data.get('territorio'):
        story.append(PageBreak())
        story.append(Paragraph("MAPA DE TERRITÓRIO", s_h1))
        story.append(GreenLine())
        story.append(Spacer(1, 0.3 * cm))

        territorio = confronto_data['territorio']

        for classe_info in territorio:
            classe_num = classe_info.get('classe', '?')
            story.append(Paragraph(f"Classe {classe_num}", s_h2))

            specs = classe_info.get('especificacoes', [])
            if not specs:
                continue

            s_spec_h = ParagraphStyle('SpecH', fontName=FONT_BOLD, fontSize=8, textColor=COLOR_WHITE, leading=10)
            s_spec = ParagraphStyle('Spec', fontName=FONT_REG, fontSize=8, textColor=COLOR_TEXT, leading=10)

            spec_header = [
                Paragraph("Código", s_spec_h),
                Paragraph("Especificação", s_spec_h),
                Paragraph("Status", s_spec_h),
            ]
            spec_data = [spec_header]

            status_colors = {
                'SEGURO': COLOR_GREEN_SAFE,
                'RISCO': COLOR_ORANGE,
                'BLOQUEADO': COLOR_RED,
            }

            for spec in specs:
                status = spec.get('status', 'SEGURO')
                s_color = status_colors.get(status, COLOR_GRAY)
                s_status = ParagraphStyle('Status', fontName=FONT_BOLD, fontSize=8, textColor=s_color, leading=10)

                icon = {'SEGURO': '✅', 'RISCO': '⚠️', 'BLOQUEADO': '❌'}.get(status, '—')

                spec_data.append([
                    Paragraph(str(spec.get('codigo', '')), s_spec),
                    Paragraph(spec.get('descricao', ''), s_spec),
                    Paragraph(f"{icon} {status}", s_status),
                ])

            spec_table = Table(spec_data, colWidths=[1.8*cm, available_w - 4.5*cm, 2.7*cm], repeatRows=1)
            spec_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), HexColor('#3B3B5C')),
                ('TEXTCOLOR', (0, 0), (-1, 0), COLOR_WHITE),
                ('GRID', (0, 0), (-1, -1), 0.5, HexColor('#E0E0E0')),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('TOPPADDING', (0, 0), (-1, -1), 4),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
                ('LEFTPADDING', (0, 0), (-1, -1), 4),
            ]))
            story.append(spec_table)
            story.append(Spacer(1, 0.3 * cm))

    # Build
    doc.build(story, onFirstPage=header_page, onLaterPages=header_page)
    print(f"✅ Radar PDF gerado: {output_path}")


def main():
    import argparse

    parser = argparse.ArgumentParser(description="Gera PDF visual do Radar de Similaridade")
    parser.add_argument('radar_json', help='Caminho do RADAR.json')
    parser.add_argument('--confronto', help='Caminho do CONFRONTO.json (opcional)', default=None)
    parser.add_argument('-o', '--output', help='Caminho de saída do PDF', default=None)

    args = parser.parse_args()

    radar_path = Path(args.radar_json).absolute()
    if not radar_path.exists():
        print(f"❌ Arquivo não encontrado: {radar_path}")
        sys.exit(1)

    with open(radar_path, 'r', encoding='utf-8') as f:
        radar_data = json.load(f)

    confronto_data = None
    if args.confronto:
        confronto_path = Path(args.confronto).absolute()
        if confronto_path.exists():
            with open(confronto_path, 'r', encoding='utf-8') as f:
                confronto_data = json.load(f)

    if args.output:
        output = Path(args.output).absolute()
    else:
        marca = radar_data.get('marca_cliente', 'MARCA')
        output = radar_path.parent / f"{marca} - RADAR VISUAL.pdf"

    gerar_pdf(radar_data, output, confronto_data)


if __name__ == "__main__":
    main()

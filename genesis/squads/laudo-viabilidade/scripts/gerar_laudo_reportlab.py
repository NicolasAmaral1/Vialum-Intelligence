import re
import os
import sys
import shutil
from pathlib import Path
from datetime import datetime
import time

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_JUSTIFY, TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Flowable, Image, PageBreak
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
import google_drive_service

# --- CONFIGURAÇÕES ---
COLOR_PRIMARY = HexColor('#9FEC14')
COLOR_TEXT = HexColor('#595959')
COLOR_GRAY = HexColor('#656565')
MARGIN = 3.0 * cm
LEADING = 18

# --- FONTES ---
def register_fonts():
    # Caminhos absolutos
    base_dir = Path(__file__).parent.parent.absolute()
    font_dir = base_dir / "resources/assets/fonts"
    sora_reg = font_dir / "Sora-Regular.ttf"
    sora_bold = font_dir / "Sora-Bold.ttf"
    
    if sora_reg.exists():
        from reportlab.pdfbase import pdfmetrics
        from reportlab.pdfbase.ttfonts import TTFont
        
        pdfmetrics.registerFont(TTFont('Sora', str(sora_reg)))
        if sora_bold.exists():
            pdfmetrics.registerFont(TTFont('Sora-Bold', str(sora_bold)))
            
            # CRITICAL FIX: Register Family properly
            from reportlab.pdfbase.pdfmetrics import registerFontFamily
            registerFontFamily('Sora', normal='Sora', bold='Sora-Bold', italic='Sora', boldItalic='Sora-Bold')
            
        print(f"✅ Fonte Sora carregada e Família registrada: {sora_reg}")
        return 'Sora', 'Sora-Bold'
    
    print("⚠️ Fonte Sora não encontrada. Usando Helvetica.")
    return 'Helvetica', 'Helvetica-Bold'

FONT_REG, FONT_BOLD = register_fonts()

class GreenLine(Flowable):
    def __init__(self, width_percent=100, color=COLOR_PRIMARY):
        Flowable.__init__(self)
        self.width_percent = width_percent
        self.color = color
    def wrap(self, availWidth, availHeight):
        self.width = availWidth
        return availWidth, 4 
    def draw(self):
        self.canv.setStrokeColor(self.color)
        self.canv.setLineWidth(3.0)
        self.canv.line(0, 0, self.width, 0)

# --- HEADER/FOOTER ---
dados_globais = {}
def header_first_page(canvas, doc):
    canvas.saveState()
    page_width, page_height = A4
    base_dir = Path(__file__).parent.parent.absolute()
    logo_path = base_dir / "resources/assets/imagens-fixas/logo-genesis.png"
    # 1. Logo à ESQUERDA (Restaurada)
    if logo_path.exists():
        img_w = 7 * cm 
        img_h = 2.4 * cm 
        x_pos = MARGIN
        y_pos = page_height - MARGIN - 15
        canvas.drawImage(str(logo_path), x_pos, y_pos, width=img_w, height=img_h, mask='auto', preserveAspectRatio=True)

    cliente = dados_globais.get('cliente', '')
    if cliente:
        # y_pos já foi definido acima no if ou precisamos calcular?
        # Se logo não existe, precisamos de y_pos. Se existe, usa o mesmo base.
        # Vamos garantir y_pos seguro.
        y_pos_text = page_height - MARGIN - 15
        canvas.setFont(FONT_REG, 11)
        canvas.setFillColor(COLOR_GRAY)
        canvas.drawRightString(page_width - MARGIN, y_pos_text + 20, "Para")
        canvas.setFont(FONT_BOLD, 16)
        canvas.setFillColor(COLOR_TEXT)
        canvas.drawRightString(page_width - MARGIN, y_pos_text + 6, cliente)
    
    footer_standard(canvas)
    canvas.restoreState()

def header_later_pages(canvas, doc):
    canvas.saveState()
    page_width, page_height = A4
    base_dir = Path(__file__).parent.parent.absolute()
    logo_path = base_dir / "resources/assets/imagens-fixas/logo-genesis.png"
    if logo_path.exists():
        img_w = 6 * cm
        img_h = 2 * cm 
        x_pos = (page_width - img_w) / 2
        y_pos = page_height - MARGIN - 10
        canvas.drawImage(str(logo_path), x_pos, y_pos, width=img_w, height=img_h, mask='auto', preserveAspectRatio=True)
    footer_standard(canvas)
    canvas.restoreState()

def footer_standard(canvas):
    canvas.setFont(FONT_REG, 9)
    canvas.setFillColor(COLOR_GRAY)
    footer_text = "Genesis - Marcas e Patentes | Rua Pará, 945, Londrina, Paraná, CEP 86010-450 | @genesisregistro"
    canvas.drawCentredString(A4[0]/2, 1.5*cm, footer_text)

# --- UTILS & PARSING ---
def data_por_extenso(data_str):
    try:
        dia, mes, ano = data_str.split('/')
        meses = {'01':'janeiro','02':'fevereiro','03':'março','04':'abril','05':'maio','06':'junho',
                 '07':'julho','08':'agosto','09':'setembro','10':'outubro','11':'novembro','12':'dezembro'}
        return f"{dia} de {meses.get(mes, mes)} de {ano}"
    except: return data_str

def extrair_campo(texto, padrao, default=''):
    match = re.search(padrao, texto)
    return match.group(1).strip() if match else default

def extrair_secao(texto, padrao, flags=0):
    match = re.search(padrao, texto, flags=flags)
    return match.group(1).strip() if match else ''

def parsear_plano(caminho_md):
    with open(caminho_md, 'r', encoding='utf-8') as f:
        c = f.read()
        
    dados = {}
    dados['cliente'] = extrair_campo(c, r'\*\*Cliente:\*\*\s*(.+)')
    dados['marca_principal'] = extrair_campo(c, r'\*\*Marca Principal:\*\*\s*(.+)')
    dados['data_analise'] = extrair_campo(c, r'\*\*Data:\*\*\s*(.+)', default=datetime.now().strftime('%d/%m/%Y'))
    
    dados['secoes'] = {}
    
    # 1. Classes: Extrai entre o título e a próxima seção (## PARTE 2 ou ## ANÁLISE DOS REQUISITOS)
    classes = extrair_secao(c, r'## LAUDO DESCRITIVO POR CLASSE\n*(.*?)\n*(?=##|$)', flags=re.DOTALL)
    dados['secoes']['Classes Recomendadas'] = classes
    
    # 2. Requisitos (Narrativa V6): Extrai entre o título e a próxima seção (## LAUDO DESCRITIVO POR CLASSE)
    req = extrair_secao(c, r'## ANÁLISE DOS REQUISITOS \(VERACIDADE, LICEIDADE E DISTINTIVIDADE\)\n*(.*?)\n*(?=## LAUDO DESCRITIVO POR CLASSE|$)', flags=re.DOTALL)
    dados['secoes']['Requisitos'] = req
    
    # 3. Colidências e Estratégia (Tudo da Parte 2 — aceita variações do título)
    colid = extrair_secao(c, r'## PARTE 2: ANÁLISE DE COLIDÊNCIAS[^\n]*\n*(.*)', flags=re.DOTALL)
    dados['secoes']['Colidências'] = colid
    
    return dados

def create_report(dados, output_path):
    global dados_globais
    dados_globais = dados
    doc = SimpleDocTemplate(str(output_path), pagesize=A4, rightMargin=MARGIN, leftMargin=MARGIN, topMargin=4*cm, bottomMargin=MARGIN)
    styles = getSampleStyleSheet()
    
    style_Title = ParagraphStyle('Title', parent=styles['Heading1'], fontName=FONT_BOLD, fontSize=26, textColor=COLOR_PRIMARY, alignment=TA_CENTER, spaceAfter=24)
    style_Meta = ParagraphStyle('Meta', parent=styles['Normal'], fontName=FONT_REG, fontSize=12, textColor=COLOR_GRAY, alignment=TA_CENTER, leading=16)
    style_H1 = ParagraphStyle('H1', parent=styles['Heading1'], fontName=FONT_BOLD, fontSize=16, textColor=COLOR_PRIMARY, alignment=TA_LEFT, spaceBefore=24, spaceAfter=4, keepWithNext=True)
    style_H2_Flow = ParagraphStyle('H2_Flow', parent=styles['Heading2'], fontName=FONT_BOLD, fontSize=14, textColor=COLOR_PRIMARY, alignment=TA_LEFT, spaceBefore=12, spaceAfter=6, keepWithNext=True)
    style_Body = ParagraphStyle('Body', parent=styles['Normal'], fontName=FONT_REG, fontSize=12, textColor=COLOR_TEXT, alignment=TA_JUSTIFY, firstLineIndent=3*cm, spaceAfter=12, leading=LEADING)
    style_Sign = ParagraphStyle('Sign', parent=styles['Normal'], fontName=FONT_REG, fontSize=12, textColor=COLOR_TEXT, alignment=TA_RIGHT, firstLineIndent=0, spaceBefore=36)
    
    story = []
    
    # Capa
    story.append(Paragraph("LAUDO DE VIABILIDADE", style_Title))
    # META REMOVIDO "Tirar foto"
    # meta = f"<b>MARCA:</b> {dados['marca_principal']}<br/><b>CLIENTE:</b> {dados['cliente']}"
    # story.append(Paragraph(meta, style_Meta))
    story.append(Spacer(1, 1*cm))
    
    from reportlab.platypus import CondPageBreak
    def add_h1(text, page_break=False): # Default changed to False
        # Ensure at least 5cm of space for Header + Content
        story.append(CondPageBreak(5*cm))
        story.append(Paragraph(text, style_H1))
        story.append(GreenLine()) 
        story.append(Spacer(1, 0.5*cm))

    def add_req_inline(title, text):
        # Paragraph with inline formatting using HTML tags allowed in ReportLab
        # <u><b>TITLE</b></u> - Text
        xml = f"<u><b>{title}</b></u> - {text}"
        story.append(Paragraph(xml, style_Body))

    def add_para(text):
        story.append(Paragraph(text, style_Body))

    def add_blocks(raw_text):
        if not raw_text: return
        for p in raw_text.split('\n'):
            p = p.strip()
            if not p: continue
            
            # FILTRO 1: Remover separadores Markdown (---)
            if re.match(r'^-{3,}$', p): continue
            
            # FILTRO 2: Detectar títulos ## e converter para H2
            if p.startswith('## '):
                title_text = p[3:].strip()
                # Remove ** se houver
                title_text = re.sub(r'\*\*(.*?)\*\*', r'\1', title_text)
                story.append(Spacer(1, 0.3*cm))
                story.append(Paragraph(title_text, style_H2_Flow))
                story.append(GreenLine())
                story.append(Spacer(1, 0.3*cm))
                continue
            
            # FILTRO 3: Detectar ### e converter para subtítulo (sem numeração visual)
            if p.startswith('### '):
                subtitle_text = p[4:].strip()
                # Remove ** e números do início
                subtitle_text = re.sub(r'^\d+\.\s*', '', subtitle_text)
                subtitle_text = re.sub(r'\*\*(.*?)\*\*', r'\1', subtitle_text)
                style_Sub = ParagraphStyle('Subtitle', parent=style_Body, fontName=FONT_BOLD, fontSize=13, textColor=COLOR_PRIMARY, firstLineIndent=0, spaceBefore=16, spaceAfter=8)
                story.append(Paragraph(subtitle_text, style_Sub))
                continue
            
            # Detecção de Classes V7.1: **Classe XX (nível)**
            if p.startswith('**Classe'):
                # Transforma markdown em XML: **Texto** -> <b>Texto</b>
                p_styled = re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', p)
                style_Class = ParagraphStyle('ClassHeader', parent=style_Body, firstLineIndent=0, spaceBefore=12, spaceAfter=6)
                story.append(Paragraph(p_styled, style_Class))
                continue

            # Converter negrito Markdown para XML
            p = re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', p)
            story.append(Paragraph(p, style_Body))

    # --- INTRODUÇÃO ---
    add_h1("1. INTRODUÇÃO", page_break=False) 

    marca = dados['marca_principal']
    add_para(f"Este documento tem como objetivo avaliar a viabilidade de registrar a marca denominada “{marca}”, considerando o risco de rejeição. Nossa conclusão é uma avaliação baseada em opinião e não garante que o Instituto Nacional da Propriedade Intelectual (INPI) irá deferir ou negar o pedido. No entanto, garantimos que realizamos todos os esforços necessários na pesquisa de similaridade de marca.")
    add_para("Independentemente do resultado, a decisão de registrar a marca cabe ao cliente. Estaremos focados em apresentar o laudo da melhor forma possível.")
    add_para("Considerando o exposto, é possível efetuar o registro de marcas em diferentes formas, tais como nominativa (baseada no nome), mista (combinando um logo e o nome), figurativa (centrada apenas no logo) e até mesmo tridimensional (representando a configuração física de um produto específico).")
    add_para("Nesta circunstância, após a submissão do requerimento de registro de marca ao INPI, será divulgado na RPI – Revista da Propriedade Industrial, dando início ao prazo legal de 60 (sessenta) dias para que terceiros possam opor-se, sendo concedido ao titular o mesmo período para apresentar sua defesa.")
    add_para("Após esse procedimento, o INPI analisará as oposições apresentadas e realizará a avaliação substancial do pedido de registro da marca, assegurando-se de que esta atenda aos quatro requisitos estabelecidos. Estes requisitos são:")

    add_req_inline("VERACIDADE", "A marca não pode ter caráter enganoso que induza o público a erro quanto à origem, procedência, natureza, qualidade ou utilidade do produto ou serviço a que se destina. – Previsto no inciso X do art. 124 da LPI.")
    add_req_inline("LICEIDADE", "Esse requisito dispõe que a marca não pode conter elementos característicos presentes em símbolos oficiais, e também não pode conter elementos que contrariam à moral e aos bons costumes. – Previsto nos incisos I, III, XI e XIV do art. 124 da LPI.")
    add_req_inline("DISTINTIVIDADE", "Esse requisitos dispõe que é condição fundamental e função da marca enquanto signo diferenciador de produtos e serviços. – Previsto nos incisos incisos II, VI, VII, VIII, XVIII e XXI do art. 124 da LPI.")
    add_req_inline("NOVIDADE / DISPONIBILIDADE", "Os aspectos gráfico, fonético e ideológico da marca precisam ser exibido de uma forma diferente dos demais já existentes em determinado ramo ou classe. – Previsto nos arts. 124, incisos IV, V, IX, XII, XIII, XV, XVI, XVII, XIX, XX, XXII e XXIII, 125 e 126 da LPI.")

    add_para("Entre os requisitos mencionados, a partir da análise de vários pedidos que foram indeferidos, nota-se que o critério da novidade é frequentemente o principal motivo de indeferimento, devido à sua natureza abrangente e complexa.")
    add_para("Após avaliar o pedido à luz dos quatro requisitos estipulados, o INPI emitirá uma decisão, que poderá ser de indeferimento, concedendo à parte um prazo de 60 dias para apresentar recurso, ou de deferimento, ocasião em que será emitida a certidão de concessão da marca dentro do mesmo prazo após a decisão.")
    add_para("Com a concessão da marca, o INPI procederá com uma nova publicação na RPI – Revista da Propriedade Industrial, marcando o início do prazo de 180 dias (cento e oitenta) dias para que terceiros possam apresentar Processo Administrativo de Nulidade, buscando anular a marca. No caso de tal pedido de nulidade, o titular da marca terá o prazo de 60 dias para contestá-lo, sendo a decisão final sobre o assunto de competência do Presidente do INPI.")
    add_para("Para facilitar melhor a compreensão do processo de registro de marca, anexa-se o fluxograma abaixo demonstrando expressamento o processo adotado pelo INPI até concessão do registro da marca:")

    # FLUXOGRAMA
    base_dir = Path(__file__).parent.parent.absolute()
    fluxo = base_dir / "assets/imagens-fixas/fluxograma-inpi.png"
    if fluxo.exists():
        from reportlab.lib.utils import ImageReader
        try:
            iw, ih = ImageReader(str(fluxo)).getSize()
            aspect = ih / float(iw)
            im = Image(str(fluxo), width=15*cm, height=(15*cm * aspect))
            story.append(im)
        except Exception as e:
            print(f"Erro imagem: {e}")
    
    add_para("Diante do exposto introdutório sobre o procedimento adotado pelo INPI para registro de marca, prosseguimos agora com uma análise voltada ao segmento de mercado do cliente. Nessa análise, buscamos identificar as classes mais adequadas para registro, visando ampliar a proteção da marca em todo o seu ramo.")

    # --- SEÇÕES ---
    add_h1("2. CLASSES RECOMENDADAS")
    add_blocks(dados['secoes']['Classes Recomendadas'])
    
    add_h1("3. ANÁLISE DE REQUISITOS (ESPECÍFICA)")
    add_blocks(dados['secoes']['Requisitos'])
    
    add_h1("4. ANÁLISE DE COLIDÊNCIAS E VIABILIDADE")
    add_blocks(dados['secoes']['Colidências'])

    # Sign — colada ao conteúdo (sem spacer grande que empurra pra página isolada)
    story.append(Spacer(1, 0.5*cm))
    data_ext = data_por_extenso(dados['data_analise'])
    sign_text = f"É o parecer.<br/>{data_ext}.<br/>Equipe Genesis"
    story.append(Paragraph(sign_text, style_Sign))

    doc.build(story, onFirstPage=header_first_page, onLaterPages=header_later_pages)
    print(f"✅ PDF ReportLab Final V4 Salvo: {output_path}")

    # --- UPLOAD GOOGLE DRIVE ---
    try:
        google_drive_service.upload_file(str(output_path), marca, dados.get('cliente'))
    except Exception as e:
        print(f"⚠️ Erro ao tentar upload para o Google Drive: {e}")

def main():
    start_time = time.time()
    if len(sys.argv) < 2:
        print("Uso: python gerar_laudo_reportlab.py <caminho_plano_md> [caminho_saida_pdf]")
        return
        
    plano_path = Path(sys.argv[1]).absolute()
    if not plano_path.exists():
        print(f"❌ Erro: Arquivo não encontrado: {plano_path}")
        return

    dados = parsear_plano(plano_path)
    marca = dados.get('marca_principal', 'Empresa')

    if len(sys.argv) >= 3:
        out = Path(sys.argv[2]).absolute()
    else:
        out = plano_path.parent / f"{marca} - LAUDO DE VIABILIDADE.pdf"
        
    # --- ARQUIVAMENTO LOCAL ---
    # Move todos os arquivos anteriores que comecem com o prefixo da marca e terminem com extensões de saída
    arquivados_dir = plano_path.parent / "arquivados"
    prefixo_busca = f"{marca} -"
    extensoes_alvo = ['.pdf']  # Só arquiva PDF antigo — não toca no DOCX

    # Busca arquivos que correspondam ao padrão, mas exclui o próprio plano de análise fonte
    try:
        if not arquivados_dir.exists():
            arquivados_dir.mkdir(parents=True)

        for file_path in plano_path.parent.iterdir():
            if file_path.is_file() and file_path.name.startswith(prefixo_busca):
                # Não arquivar o próprio plano de análise fonte que estamos lendo agora
                if file_path.name == plano_path.name:
                    continue
                # Arquivar apenas PDF antigos deste script
                if any(file_path.name.endswith(ext) for ext in extensoes_alvo):
                    dest_path = arquivados_dir / file_path.name
                    print(f"📦 Arquivando versão local antiga: {file_path.name}")
                    shutil.move(str(file_path), str(dest_path))
    except Exception as e:
        print(f"⚠️ Erro ao arquivar arquivos locais: {e}")

    create_report(dados, out)

    # --- GERAR METADADOS "SOBRE O LAUDO" (Idempotente) ---
    meta_file_path = plano_path.parent / f"{marca} - Sobre o laudo.md"
    if not meta_file_path.exists():
        duration = time.time() - start_time
        duration_str = f"{duration:.2f} segundos"
        
        colid_text = dados['secoes'].get('Colidências', '')
        conclusao = "Não extraída."
        if colid_text:
            lines = colid_text.split('\n')
            for line in reversed(lines):
                if line.strip() and len(line.strip()) > 50:
                    conclusao = line.strip()
                    break

        meta_content = f"""# {marca} - Sobre o laudo

**Data do Laudo:** {dados['data_analise']}
**Tempo de Geração:** {duration_str}
**Dono do Laudo (Cliente):** {dados['cliente']}
**Marca Principal:** {marca}

## Conclusão Final
{conclusao}

## Log de Alterações
- [x] Renomeação de PDF e DOCX para padrão "[Marca] - LAUDO DE VIABILIDADE".
- [x] Criação de arquivo de metadados automático.
- [x] Rastreamento de performance de geração.
- [x] Sincronização automática com Google Drive.
"""
        with open(meta_file_path, 'w', encoding='utf-8') as f:
            f.write(meta_content)
        print(f"📝 Arquivo de metadados gerado: {meta_file_path}")

        # Upload do arquivo de metadados para o Drive
        try:
            google_drive_service.upload_file(str(meta_file_path), marca, dados.get('cliente'))
        except Exception as e:
            print(f"⚠️ Erro ao tentar upload do metadata: {e}")

if __name__ == "__main__":
    main()

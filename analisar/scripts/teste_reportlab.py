from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT

# Caminho ajustdo para o ambiente atual
pdf_path = "cases/Nicolas Amaral/RED GROW/teste_procuracao_reportlab.pdf"

# Criar documento
doc = SimpleDocTemplate(
    pdf_path,
    pagesize=A4,
    rightMargin=2.5*cm,
    leftMargin=2.5*cm,
    topMargin=2.5*cm,
    bottomMargin=2.5*cm
)

# Estilos
styles = getSampleStyleSheet()

# Estilo para título
title_style = ParagraphStyle(
    'CustomTitle',
    parent=styles['Heading1'],
    fontSize=16,
    textColor='black',
    spaceAfter=30,
    alignment=TA_CENTER,
    fontName='Helvetica-Bold'
)

# Estilo para subtítulos
subtitle_style = ParagraphStyle(
    'CustomSubtitle',
    parent=styles['Heading2'],
    fontSize=12,
    textColor='black',
    spaceAfter=12,
    spaceBefore=12,
    fontName='Helvetica-Bold'
)

# Estilo para texto normal
normal_style = ParagraphStyle(
    'CustomNormal',
    parent=styles['Normal'],
    fontSize=11,
    textColor='black',
    alignment=TA_JUSTIFY,
    spaceAfter=10,
    fontName='Helvetica'
)

# Estilo para texto em negrito
bold_style = ParagraphStyle(
    'CustomBold',
    parent=styles['Normal'],
    fontSize=11,
    textColor='black',
    alignment=TA_JUSTIFY,
    spaceAfter=6,
    fontName='Helvetica-Bold'
)

# Construir conteúdo
story = []

# Título
story.append(Paragraph("PROCURAÇÃO", title_style))
story.append(Spacer(1, 0.5*cm))

# Outorgante
story.append(Paragraph("<b>OUTORGANTE:</b> ROBERTO PEDREIRA DE FREITAS CERIBELLI, brasileiro, solteiro, do comércio, residente no Condomínio Aracari, Londrina/PR, portador do CPF nº 015.742.699-84 e RG nº 5.398.816-97 SSP/SP.", normal_style))
story.append(Spacer(1, 0.3*cm))

# Outorgado
story.append(Paragraph("<b>OUTORGADO:</b> JESUS ROBERTO CERIBELLI, brasileiro, médico, casado, residente à Rua Cambará, nº 484, Londrina/PR, portador do RG nº 2.043.320-5 SSP/PR e CPF nº 297.744.388-68.", normal_style))
story.append(Spacer(1, 0.5*cm))

# Linha divisória
story.append(Paragraph("_" * 100, normal_style))
story.append(Spacer(1, 0.5*cm))

# Poderes conferidos
story.append(Paragraph("PODERES CONFERIDOS", subtitle_style))
story.append(Spacer(1, 0.3*cm))

story.append(Paragraph("Pela presente, o OUTORGANTE confere ao OUTORGADO amplos e gerais poderes para gerir e administrar o imóvel descrito no item 1 abaixo, bem como negócios e interesses do OUTORGANTE, podendo, para tanto, representá-lo:", normal_style))
story.append(Spacer(1, 0.4*cm))

# 1. DO IMÓVEL
story.append(Paragraph("<b>1. DO IMÓVEL</b>", bold_style))
story.append(Paragraph("Imóvel consistente no <b>lote 23, quadra 22, com área de 266,81m² (Paysage Terra-Nova)</b>, situado no Condomínio Aracari, Londrina/PR, conforme <b>matrícula nº 41.926</b> do Cartório do 3º Ofício de Registro de Imóveis de Londrina.", normal_style))
story.append(Spacer(1, 0.3*cm))

# 2. PERANTE CARTÓRIOS
story.append(Paragraph("<b>2. PERANTE CARTÓRIOS E SERVENTIAS</b>", bold_style))
story.append(Paragraph("• Representar o OUTORGANTE perante todos os Cartórios de Notas, Registros de Imóveis e demais Ofícios e Serventias de Justiça;", normal_style))
story.append(Paragraph("• Assinar escrituras, inclusive de re-ratificação;", normal_style))
story.append(Paragraph("• Requerer, solicitar e assinar documentos necessários.", normal_style))
story.append(Spacer(1, 0.3*cm))

# 3. PERANTE REPARTIÇÕES
story.append(Paragraph("<b>3. PERANTE REPARTIÇÕES PÚBLICAS</b>", bold_style))
story.append(Paragraph("• Representar o OUTORGANTE perante Repartições Públicas Federais, Estaduais e Municipais, e Autarquias, notadamente Prefeitura Municipal de Londrina, Receita Federal e Receita Estadual;", normal_style))
story.append(Paragraph("• Requerer, alegar, transacionar dívidas, firmar confissões de dívida;", normal_style))
story.append(Paragraph("• Pagar emolumentos, impostos, taxas e outras despesas.", normal_style))
story.append(Spacer(1, 0.3*cm))

# 4. REGULARIZAÇÃO
story.append(Paragraph("<b>4. REGULARIZAÇÃO DO IMÓVEL</b>", bold_style))
story.append(Paragraph("• Requerer e obter Habite-se e certidões necessárias;", normal_style))
story.append(Paragraph("• Promover a averbação da construção edificada sobre o imóvel junto ao Cartório de Registro de Imóveis.", normal_style))
story.append(Spacer(1, 0.3*cm))

# 5. LOCAÇÃO
story.append(Paragraph("<b>5. LOCAÇÃO</b>", bold_style))
story.append(Paragraph("• Celebrar contrato de locação do imóvel, com todas as cláusulas e condições que convencionar;", normal_style))
story.append(Paragraph("• Receber valores e passar recibos referentes à locação;", normal_style))
story.append(Paragraph("• Representar o OUTORGANTE perante imobiliárias e/ou administradoras de bens.", normal_style))
story.append(Spacer(1, 0.3*cm))

# 6. CONCESSIONÁRIAS
story.append(Paragraph("<b>6. CONCESSIONÁRIAS DE SERVIÇOS PÚBLICOS</b>", bold_style))
story.append(Paragraph("• Representar o OUTORGANTE perante companhias telefônicas, COPEL e SANEPAR;", normal_style))
story.append(Paragraph("• Resolver qualquer assunto de interesse e conveniência do OUTORGANTE;", normal_style))
story.append(Paragraph("• Requerer cancelamento, suspensão de serviços e transferência de contas.", normal_style))
story.append(Spacer(1, 0.3*cm))

# 7. PODERES JUDICIAIS
story.append(Paragraph("<b>7. PODERES JUDICIAIS</b>", bold_style))
story.append(Paragraph("• Representar o OUTORGANTE no Foro em Geral, perante quaisquer Instâncias, Juízos ou Tribunais;", normal_style))
story.append(Paragraph("• Utilizar-se dos poderes da cláusula <b>\"ad judicia et extra\"</b>;", normal_style))
story.append(Paragraph("• Defender direitos e interesses do OUTORGANTE, como se presente fosse.", normal_style))
story.append(Spacer(1, 0.3*cm))

# 8. CONDOMÍNIO
story.append(Paragraph("<b>8. CONDOMÍNIO</b>", bold_style))
story.append(Paragraph("• Participar ativamente em quaisquer reuniões e assembleias do Condomínio Aracari;", normal_style))
story.append(Paragraph("• Votar e deliberar sobre assuntos relativos aos interesses do lote 23 da quadra 22 (Paysage Terra-Nova).", normal_style))
story.append(Spacer(1, 0.3*cm))

# 9. DISPOSIÇÕES GERAIS
story.append(Paragraph("<b>9. DISPOSIÇÕES GERAIS</b>", bold_style))
story.append(Paragraph("• Praticar todos os demais atos úteis e indispensáveis ao cumprimento do presente mandato;", normal_style))
story.append(Paragraph("• Substabelecer os poderes aqui conferidos, no todo ou em parte, com ou sem reserva de poderes.", normal_style))
story.append(Spacer(1, 0.8*cm))

# Linha divisória
story.append(Paragraph("_" * 100, normal_style))
story.append(Spacer(1, 0.5*cm))

# Data e assinatura
story.append(Paragraph("Londrina, 31 de janeiro de 2026.", normal_style))
story.append(Spacer(1, 1.5*cm))

# Linha de assinatura
story.append(Paragraph("_" * 50, normal_style))
story.append(Paragraph("<b>ROBERTO PEDREIRA DE FREITAS CERIBELLI</b>", ParagraphStyle(
    'Signature',
    parent=normal_style,
    alignment=TA_CENTER,
    fontName='Helvetica-Bold'
)))
story.append(Paragraph("<i>Outorgante</i>", ParagraphStyle(
    'SignatureTitle',
    parent=normal_style,
    alignment=TA_CENTER,
    fontName='Helvetica-Oblique',
    fontSize=10
)))

# Gerar PDF
doc.build(story)

print(f"PDF criado com sucesso: {pdf_path}")

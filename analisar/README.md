# Vialum-AAAS (Antigravity As A Service)

Sistema de orquestração agêntica para serviços jurídicos, focado em laudos de marcas e automação de fluxos de decisão.

## 📋 Visão Geral

Este sistema permite gerar laudos técnico-jurídicos completos de análise de viabilidade de registro marcário, incluindo:

- ✅ **Análise preliminar** (distintividade, veracidade, licitude)
- ✅ **Sugestão de classes NCL** com especificações detalhadas
- ✅ **Análise de colidências** com marcas anteriores do INPI
- ✅ **Vereditos de risco** individuais por marca
- ✅ **Estratégias de mitigação** para cada conflito
- ✅ **Geração de PDF e Word profissional** com motor de renderização premium (ReportLab/Builder)

---

## 🏗️ Arquitetura

```
Vialum-AAAS/
├── .agent/
│   ├── skills/
│   │   ├── analise-preliminar/     # SKILL 1: Classes + Distintividade
│   │   ├── analise-inpi/           # SKILL 2: Análise de colidências
│   │   └── gerar-pdf-laudo/        # SKILL 3: Geração de PDF/DOCX
│   └── workflows/
│       └── nova-analise.md         # Workflow completo
│
├── scripts/
│   ├── processar_inpi.py           # Parser de dados INPI
│   ├── gerar_laudo_reportlab.py    # Gerador PDF Premium
│   ├── gerar_docx_builder.py       # Gerador Word Premium
│   └── ...
│
├── templates/
│   └── laudo-template.docx         # Template base
│
├── assets/
│   ├── logo-vialum.png
│   └── fonts/                      # Fontes Sora
│
└── requirements.txt                # Dependências Python
```

---

## 🚀 Início Rápido

### 1. Instalar Dependências

```bash
pip install -r requirements.txt
```

### 2. Preparar Templates

1. Coloque o template `.docx` em `templates/laudo-template.docx`
2. Garanta que as fontes Sora estão em `assets/fonts/`

### 3. Iniciar Nova Análise

Forneça os dados ao Antigravity e peça para iniciar o workflow `nova-analise`.

---

## 🔧 Uso dos Scripts

### Processar Dados do INPI

```bash
python3 scripts/processar_inpi.py cases/Cliente/Marca/inpi-raw.txt
```

### Gerar Laudos Premium

```bash
# Gerar PDF Premium (ReportLab V4)
python3 scripts/gerar_laudo_reportlab.py "cases/Cliente/Marca/Marca - PLANO DE ANÁLISE.md"

# Gerar Word Premium (Builder V4)
python3 scripts/gerar_docx_builder.py "cases/Cliente/Marca/Marca - PLANO DE ANÁLISE.md"
```

---

## 📚 SKILLs Disponíveis

### SKILL 1: Análise Preliminar
Analisa a marca quanto a distintividade, veracidade e licitude (LICEIDADE) e sugere classes NCL.

### SKILL 2: Análise de Colidências INPI
Analisa marcas anterioridades do INPI e gera vereditos narrativos com análise de coexistência.

### SKILL 3: Geração de Documentos Premium
Converte o PLANO DE ANÁLISE aprovado em documentos profissionais (PDF e DOCX) usando os geradores premium.

---

## 📖 Estrutura do PLANO DE ANÁLISE

O arquivo `.md` gerado contém:

**PARTE 1 - ANÁLISE PRELIMINAR**
- Metadados (cliente, marca, atividade, data)
- Classes sugeridas com níveis de recomendação
- Análise de veracidade, liceidade e distintividade termo a termo

**PARTE 2 - ANÁLISE DE COLIDÊNCIAS**
- Análise narrativa e contextual (V6)
- Identificação de players e níveis de coexistência
- Conclusão final e estratégia geral de depósito

---

## 📝 Licença

Uso interno - Vialum

---

## 🆘 Suporte

**Sistema desenvolvido com Antigravity AI**

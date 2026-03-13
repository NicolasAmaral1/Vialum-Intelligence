---
description: Iniciar nova análise de viabilidade de marca
---

# Workflow: Nova Análise de Viabilidade de Marca

Este workflow orquestra as 3 SKILLs para gerar um laudo completo de viabilidade de registro marcário.

## Pré-requisitos

- [ ] Dependências instaladas: `pip install -r requirements.txt`
- [ ] Template DOCX em `templates/laudo-template.docx`
- [ ] Assets em `assets/` (logo, rodapé, imagens)

---

## Etapa 1: Coleta de Informações

**Ação:** Solicitar ao usuário os dados iniciais

**Input necessário:**
- Nome da marca principal
- Marcas alternativas (opcional)
- Descrição detalhada da atividade/produtos/serviços
- Nome do cliente

**Formato esperado:**
```
Marca: NOME DA MARCA
Alternativos: VARIAÇÃO 1, VARIAÇÃO 2
Atividade: Descrição detalhada dos produtos e serviços oferecidos
Cliente: Nome do Cliente (Se não informado, usar 'Equipe [Marca]')
```

---

## Etapa 2: Criar Estrutura de Pastas

**Ação:** Criar diretórios para o caso

```bash
# Se Cliente não informado: Cliente = "Equipe [Marca]"
mkdir -p "cases/[Nome-Cliente]/[Marca]"
```

**Resultado:** Pasta pronta para receber arquivos do caso

---

## Etapa 3: Executar SKILL 1 - Análise Preliminar

**Ação:** Ler `.agent/skills/analise-preliminar/SKILL.md` e executar

**O que a SKILL faz:**
1. Analisa a marca quanto a distintividade, veracidade e licitude
2. Sugere classes NCL pertinentes
3. Gera especificações detalhadas para cada classe
4. Cria primeira parte do `[Marca] - PLANO DE ANÁLISE.md`

**Output:** 
- Arquivo `cases/[Cliente]/[Marca]/[Marca] - PLANO DE ANÁLISE.md` com Parte 1 completa

---

## Etapa 4: CHECKPOINT 1 - Revisão de Classes

**Ação:** Solicitar revisão do usuário

**Mensagem ao usuário:**
```markdown
✅ Análise preliminar concluída!

Revise o arquivo:
[Link para PLANO DE ANÁLISE.md]

Especialmente:
- Classes sugeridas estão adequadas?
- Especificações capturam corretamente a atividade?
- Concordância com análise de distintividade?

Após revisar, informe quais classes você deseja buscar no INPI.
```

**Aguardar:** Aprovação do usuário

---

## Etapa 5: Busca Manual no INPI

**Ação:** Instruir usuário a realizar buscas

**Instruções:**
1. Acesse: https://busca.inpi.gov.br/pePI/servlet/MarcasServlet
2. Para cada classe aprovada:
   - Busque pela marca principal
   - Busque por variações/similares se necessário
3. Copie TODOS os resultados (CTRL+A, CTRL+C)
4. Cole em `cases/[Cliente]/[Marca]/inpi-raw.txt`

**Aguardar:** Usuário confirmar que colou os dados

---

## Etapa 6: Processar Dados do INPI

**Ação:** Executar script de processamento

// turbo
```bash
python scripts/processar_inpi.py "cases/[Cliente]/[Marca]/inpi-raw.txt"
```

**Resultado:** 
- Arquivo `cases/[Cliente]/[Marca]/inpi-raw-processed.json` criado
- JSON estruturado com todas as marcas encontradas

**Verificação:**
```bash
cat "cases/[Cliente]/[Marca]/inpi-raw-processed.json" | head -n 20
```

---

## Etapa 7: Executar SKILL 2 - Análise de Colidências (Narrativa Jurídica)

**Ação:** Ler `.agent/skills/analise-inpi/SKILL.md` e executar

**O que a SKILL faz:**
1. Realiza **Análise de Coexistência**: Avalia a densidade de marcas similares para medir a exclusividade do termo.
2. Analisa os "Players": Estuda cada titular e anterioridade relevante sob ótica fonética, gráfica e ideológica.
3. **Narrativa Jurídica**: Escreve parágrafos fluídos (sem tópicos) para cada colidência, integrando marca, titular, status e especificações na íntegra.
4. **Estratégia Mestra**: Consolida uma conclusão de viabilidade (Muito Provável, Provável, etc.) com base na soma de todas as defesas individuais.

**Output:** 
- Arquivo `PLANO DE ANÁLISE.md` completo com a PARTE 2 em formato de parecer jurídico.

---

## Etapa 8: CHECKPOINT 2 - Revisão da Análise Completa

**Ação:** Solicitar revisão final do usuário

**Mensagem ao usuário:**
```markdown
✅ Análise de colidências concluída!

Revise o PLANO DE ANÁLISE completo:
[Link para PLANO DE ANÁLISE.md]

Verifique:
- Vereditos estão adequados?
- Estratégias propostas fazem sentido?
- Conclusão final está alinhada com expectativas?

Se aprovado, podemos gerar o PDF final.
Caso contrário, especifique ajustes necessários.
```

**Aguardar:** Aprovação do usuário

---

## Etapa 9: Gerar Laudos Finais (DOCX e PDF)

**Ação:** Executar os scripts de geração premium

**Comandos:**
// turbo
```bash
# Gerar Word (Builder V4)
python scripts/gerar_docx_builder.py

# Gerar PDF (ReportLab V4)
python scripts/gerar_laudo_reportlab.py
```

**Resultado:** 
- Word em `cases/[Cliente]/[Marca]/[Marca] - LAUDO FINAL BUILDER.docx`
- PDF em `cases/[Cliente]/[Marca]/[Marca] - LAUDO FINAL REPORTLAB.pdf`

---

## Etapa 10: Entrega

**Ação:** Notificar usuário sobre conclusão

**Mensagem ao usuário:**
```markdown
🎉 Laudo de viabilidade gerado com sucesso!

📄 **Arquivo final:**
[Link para LAUDO DE VIABILIDADE.pdf]

📁 **Todos os arquivos do caso:**
- `[Marca] - PLANO DE ANÁLISE.md` - Versão editável
- `[Marca] - LAUDO DE VIABILIDADE.pdf` - Versão final para cliente
- `inpi-raw.txt` - Dados brutos do INPI
- `inpi-raw-processed.json` - Dados estruturados

O laudo está pronto para apresentação ao cliente!
```

---

## Atalhos para Casos Comuns

### Reprocessar dados do INPI (se adicionar mais resultados)

```bash
python scripts/processar_inpi.py "cases/[Cliente]/[Marca]/inpi-raw.txt"
# Depois execute novamente a SKILL 2
```

### Regerar PDF (após edições manuais no PLANO)

```bash
python scripts/gerar_pdf.py "cases/[Cliente]/[Marca]/[Marca] - PLANO DE ANÁLISE.md"
```

### Analisar múltiplas marcas do mesmo cliente

Crie pastas separadas:
```bash
mkdir -p "cases/[Cliente]/Marca1"
mkdir -p "cases/[Cliente]/Marca2"
```

Execute o workflow para cada marca independentemente.

---

## Troubleshooting

### Erro: Template não encontrado

```bash
# Verificar se template existe
ls -la templates/laudo-template.docx
```

Solução: Coloque o arquivo `.docx` na pasta `templates/`

### Erro: Dependências faltando

```bash
pip install -r requirements.txt
```

### Erro: JSON vazio ou incompleto

- Verifique se o arquivo `inpi-raw.txt` contém dados válidos
- Consulte warnings do script `scripts/processar_inpi.py`
- Pode ser necessário ajustar padrões de regex no `analisador_inpi.py`

### PDF não abre / está corrompido

- No macOS: Instale `docx2pdf` (`pip install docx2pdf`)
- No Linux: Instale LibreOffice (`sudo apt-get install libreoffice`)

---

## Estimativa de Tempo

- **Etapas 1-3** (Análise Preliminar): ~5 minutos
- **Etapa 4** (Revisão usuário): ~10 minutos
- **Etapa 5** (Busca INPI): ~15-30 minutos (depende de quantas classes)
- **Etapas 6-7** (Processamento + Análise): ~10 minutos
- **Etapa 8** (Revisão usuário): ~15 minutos
- **Etapas 9-10** (PDF + Entrega): ~5 minutos

**Total:** ~1h a 1h30min por marca

---

## description: Workflow para criação de Contratos e Procurações

# Workflow: Contrato e Procuração

Este workflow guia o processo de criação de documentos de procuração e contrato de registro de marca.

## Etapa 1: Coleta de Dados do Cliente

Primeiro, vamos coletar os dados do cliente. Você pode fornecer os dados em um dos seguintes formatos:

**Opção A (Pessoa Jurídica):**

* CNPJ
* Nome empresarial (razão social)
* Endereço da sede
* Nome do representante legal
* CPF representante legal
* Nacionalidade
* Estado civil
* Profissão
* RG
* Endereço de domicílio
* Email

**Opção B (Pessoa Física):**

* Nome
* CPF
* Nacionalidade
* Estado civil
* Profissão
* RG
* Órgão emissor
* Endereço
* Email

**Além disso, forneça:**

* Nome do cliente

> **Nota:** O sistema detectará automaticamente se é Pessoa Física ou Jurídica com base nos dados fornecidos (CPF vs CNPJ).

## Etapa 2: Definição do Escopo

O que você deseja gerar?


1. **Apenas PROCURAÇÃO**
2. **CONTRATO e PROCURAÇÃO**

## Etapa 3: Ramificação e Geração

### Caminho A: Apenas Procuração

1.  O sistema utilizará os dados coletados na Etapa 1.
2.  **Geração do Documento:**
    *   O sistema executará o script `.agent/scripts/assemble_contract.py` com os seus dados.
    *   Arquivos gerados: `Draft_Procuracao_[Nome].md`.
3.  Visualize o arquivo gerado para verificar se está correto.

### Caminho B: Contrato e Procuração

caso tenha escolhido esta opção, por favor forneça adicionalmente:

* Nome da marca a ser registrada:
* Termos a serem incluídos (descreva ou selecione da biblioteca):

**Sobre as Classes:**
* Você já sabe quais classes registrar? (Sim/Não)
  * Se **Sim**: Liste os números das classes.
  * Se **Não**: Apenas informe a quantidade de classes desejada.

**Sobre o Pagamento:**
* Forma de Pagamento:
  1.  **Cartão de Crédito (Link)**
  2.  **PIX (Manual)**
  3.  **PIX (Automático)**
  4.  **Boleto Bancário (Manual)**
  5.  **Boleto Bancário (Automático)**
* Condição de Pagamento:
  1.  **À Vista**
  2.  **Parcelado** (Informe em quantas vezes)

1. O sistema utilizará os dados coletados na Etapa 1 e os dados adicionais acima.
2. **Geração dos Documentos:**
   * O sistema executará o script `.agent/scripts/assemble_contract.py` com os dados coletados (incluindo forma de pagamento e classes).
   * O script selecionará automaticamente as cláusulas corretas da biblioteca.
   * Arquivos gerados: `Draft_Contrato_[Nome].md` e `Draft_Procuracao_[Nome].md`.
3. Visualize os arquivos gerados para verificação.

## Etapa 4: Finalização, Exportação e Upload

*   Após confirmar que o Markdown (.md) está correto:
    1.  O sistema gerará automaticamente as versões em PDF.
    2.  **Upload para o Google Drive:** O sistema realizará o upload automático dos arquivos PDF para a pasta do cliente no Google Drive (ativado por padrão no script).
    3.  Você pode abrir os arquivos localmente ou acessá-los diretamente no Drive.




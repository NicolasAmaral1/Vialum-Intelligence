import sys
import os

md_path = "cases/Equipe Vocco/Vocco/Vocco - PLANO DE ANÁLISE.md"

analise = r"""## PARTE 2: ANÁLISE DE COLIDÊNCIAS E ANTERIORIDADES

Realizada a busca na base de dados do INPI, foram identificados processos que merecem atenção estratégica, embora nenhum impedimento absoluto tenha sido localizado para as Classes 41 e 42. O foco da análise de risco recai sobre a Classe 35.

A seguir, a análise detalhada das anterioridades relevantes:

**1. VOCO (Processo 914807455) – Classe 35**
   *   **Titular:** SIX CONTINENTS LIMITED
   *   **Situação:** Registro em vigor.
   *   **Especificação:** Serviços de gestão de hotéis para terceiros; serviços de franquia de hotéis; consultoria em gestão hoteleira.
   *   **Análise de Risco:** Risco Moderado.
   *   **Parecer:** A marca "VOCO" possui identidade fonética quase absoluta com "VOCCO" (a duplicidade do 'C' não altera a pronúncia). Contudo, a convivência é plenamente possível com base no **Princípio da Especialidade**. A marca anterior é restrita e específica para o segmento hoteleiro (gestão de hotéis). A VOCCO atua como agência de marketing e publicidade. Embora ambas estejam na Classe 35, os públicos-alvo e os canais de distribuição são distintos. A estratégia aqui é evitar termos genéricos como "gestão de negócios" na especificação, focando em "agência de publicidade", "consultoria em marketing" e "criação de identidade visual".

**2. VOXO (Processo 940446308) – Classe 35**
   *   **Titular:** V COMPANY NEGÓCIOS DIGITAIS LTDA
   *   **Situação:** Aguardando exame de mérito.
   *   **Especificação:** Agenciamento de mercadoria; Comércio de relógios; Demonstração de produtos.
   *   **Análise de Risco:** Risco Baixo.
   *   **Parecer:** A proximidade fonética existe, mas é atenuada pela grafia (X vs CC). Além disso, a anterioridade foca em "intermediação comercial" e "comércio de relógios", atividades de varejo que não se confundem com a prestação de serviços intelectuais de uma agência de marketing. A diluição do radical "VO-" no mercado facilita a defesa da coexistência.

**3. VONO (Processo 924286733) – Classe 35**
   *   **Titular:** VONO TELECOM LTDA
   *   **Situação:** Registro em vigor.
   *   **Especificação:** Administração de empresa; Administração de holding.
   *   **Análise de Risco:** Baixo/Irrelevante.
   *   **Parecer:** A diferença fonética entre o fonema /N/ e /K/ é suficiente para afastar confusão direta. Ademais, o titular atua no segmento de Telecom (Vono Telecom), o que reforça a distinção mercadológica. Não representa óbice ao registro.

**4. VOCCO (Processo 827299230) – Classe 35**
   *   **Titular:** MODAS VOCCO LTDA EPP
   *   **Situação:** Arquivado (Extinto).
   *   **Parecer:** O registro anterior homônimo está extinto desde 2008. Juridicamente, não gera impedimento ("dead mark"), estando o termo disponível para nova apropriação.

**Outras Anterioridades (VICO, KOCO):** Foram analisadas e descartadas por ausência de colidência fonética ou ideológica relevante.

---

## ESTRATÉGIA DE REGISTRO E CONCLUSÃO

Diante do exposto, a viabilidade de registro da marca **VOCCO** apresenta-se **POSITIVA**, com probabilidade de êxito estimada em **Alta** para as Classes 41 e 42, e **Média-Alta** para a Classe 35, desde que observada a estratégia de especificação restritiva.

### Plano de Ação Recomendado:

1.  **Depósito Misto:** Recomenda-se o depósito da marca na forma **Mista** (Nome + Logotipo) para adicionar distintividade visual.
2.  **Especificação Blindada (Classe 35):** Selecionar itens específicos de agência:
    *   *Agência de publicidade;*
    *   *Marketing;*
    *   *Consultoria em comunicação;*
    *   *Marketing digital;*
    *   *Criação de textos publicitários;*
    *   *Gestão de redes sociais.*
    *   **EVITAR:** "Gestão de negócios" (genérico) ou qualquer termo ligado a hotelaria.
3.  **Classes 41 e 42:** Seguem livres. O registro nestas classes é fundamental para criar um "cerco" de proteção em torno da marca (Educação e Design).

**Conclusão Final:** O nome é forte. Os riscos na Classe 35 são contornáveis pela especialidade de mercado (Marketing vs Hotelaria). Recomendamos o registro imediato.
"""

with open(md_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Truncate at line 46 (just before PART 2, based on grep check earlier)
# Line 47 was "## PARTE 2: ..."
lines = lines[:46] 
content = "".join(lines) + "\n" + analise

with open(md_path, 'w', encoding='utf-8') as f:
    f.write(content)

print(f"✅ MD cleaned and updated: {md_path}")

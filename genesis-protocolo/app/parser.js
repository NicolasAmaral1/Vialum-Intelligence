/**
 * parser.js — extrai dados PF/PJ da descrição do card ClickUp
 * Formato esperado: bloco "DADOS DO CLIENTE" com linhas "Campo: valor"
 */

function extractField(text, ...patterns) {
  for (const pattern of patterns) {
    const re = new RegExp(pattern + '\\s*:\\s*(.+)', 'i');
    const match = text.match(re);
    if (match) return match[1].trim();
  }
  return '';
}

function detectTipoPessoa(description) {
  // Se tem "CNPJ:" como label explícita → PJ
  if (/CNPJ\s*:/i.test(description)) return 'PJ';
  // Se tem CPF → PF
  if (/CPF\s*:/i.test(description)) return 'PF';
  // Fallback por regex de padrão numérico
  const hasCNPJ = /\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/.test(description);
  return hasCNPJ ? 'PJ' : 'PF';
}

function parsePF(description) {
  return {
    tipo_pessoa:    'PF',
    nome:           extractField(description, 'Nome'),
    cpf:            extractField(description, 'CPF'),
    nacionalidade:  extractField(description, 'Nacionalidade'),
    estado_civil:   extractField(description, 'Estado civil', 'Estado Civil'),
    profissao:      extractField(description, 'Profiss[ãa]o', 'Profissao', 'Profiss.o'),
    rg:             extractField(description, 'RG'),
    orgao_emissor:  extractField(description, '[ÓO]rg[ãa]o emissor', 'Orgao emissor', 'Org.o emissor', 'Emissor'),
    endereco:       extractField(description, 'Endere[çc]o', 'Endere.o'),
    cep:            extractField(description, 'CEP'),
    email:          extractField(description, 'E-?mail'),
  };
}

function parsePJ(description) {
  return {
    tipo_pessoa:       'PJ',
    razao_social:      extractField(description, 'Raz[ãa]o Social', 'Razao Social', 'Raz.o Social'),
    cnpj:              extractField(description, 'CNPJ'),
    endereco_sede:     extractField(description, 'Endere[çc]o sede', 'Endere.o sede', 'Endere[çc]o'),
    cep_sede:          extractField(description, 'CEP sede', 'CEP'),
    email:             extractField(description, 'E-?mail'),
    // Representante legal
    nome_rep:          extractField(description, 'Representante', 'Nome do representante', 'Nome Rep'),
    cpf_rep:           extractField(description, 'CPF do representante', 'CPF Rep'),
    rg_rep:            extractField(description, 'RG do representante', 'RG Rep'),
    orgao_emissor_rep: extractField(description, '[ÓO]rg[ãa]o emissor', 'Org.o emissor'),
    cargo_rep:         extractField(description, 'Cargo'),
    nacionalidade_rep: extractField(description, 'Nacionalidade'),
    estado_civil_rep:  extractField(description, 'Estado civil', 'Estado Civil'),
    profissao_rep:     extractField(description, 'Profiss[ãa]o', 'Profissao'),
  };
}

function parseDescription(description) {
  if (!description) return { tipo_pessoa: 'PF' };
  const tipo = detectTipoPessoa(description);
  return tipo === 'PJ' ? parsePJ(description) : parsePF(description);
}

module.exports = { parseDescription };

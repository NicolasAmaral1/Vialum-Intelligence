// Custom field IDs da list Protocolo
const FIELDS = {
  CLASSES:         '28f75c34-1027-436b-a242-730a32e1ec75',
  PARCELAS_TEXT:   '7a1ddda9-6896-4d02-ae3c-15968fc6a774',
  DOCS_INSERIDOS:  '842296be-b349-4cd3-85bc-1dda579d06d3',
  FORMA_PAGAMENTO: 'c833a0a0-95f7-4625-800c-128a5675a8ab',
  VALOR:           'd660b997-4bd3-4393-878b-265676c08c8b',
  PARCELAS_NUMBER: 'fcb54c60-6453-4bf7-838b-f6d7462f087b',
};

const CPF_RE  = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/;
const CNPJ_RE = /\b\d{2}\.?\d{3}\.?\d{3}\/?[0-9]{4}-?[0-9]{2}\b/;

function getField(task, fieldId) {
  const field = task.custom_fields?.find(f => f.id === fieldId);
  return field?.value ?? null;
}

function validateCard(task) {
  const missing = [];

  // Nome da marca (task name)
  if (!task.name?.trim()) {
    missing.push('Nome da marca (título do card vazio)');
  }

  // Descrição com CPF ou CNPJ
  const desc = task.description || '';
  if (!CPF_RE.test(desc) && !CNPJ_RE.test(desc)) {
    missing.push('CPF ou CNPJ na descrição do card');
  }

  // Nome/Razão Social na descrição
  if (!/\b(Nome|Raz[ãa]o Social|Razao Social)\s*:/i.test(desc)) {
    missing.push('Nome ou Razão Social na descrição');
  }

  // Custom fields obrigatórios
  const classes = getField(task, FIELDS.CLASSES);
  if (!classes?.toString().trim()) {
    missing.push('Campo "Classes" não preenchido');
  }

  const valor = getField(task, FIELDS.VALOR);
  if (valor === null || valor === undefined || Number(valor) <= 0) {
    missing.push('Campo "Valor" não preenchido ou zerado');
  }

  const formaPag = getField(task, FIELDS.FORMA_PAGAMENTO);
  if (!formaPag?.toString().trim()) {
    missing.push('Campo "Forma de pagamento" não preenchido');
  }

  const parcelasText = getField(task, FIELDS.PARCELAS_TEXT);
  if (!parcelasText?.toString().trim()) {
    missing.push('Campo "Parcelas" não preenchido (ex: "10x" ou "1x")');
  }

  return { valid: missing.length === 0, missing };
}

module.exports = { validateCard, getField, FIELDS };

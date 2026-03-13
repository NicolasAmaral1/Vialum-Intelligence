const { execFile } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const { getField, FIELDS } = require('./validator');

const execFileAsync = promisify(execFile);

const SCRIPTS_DIR = '/app/scripts';
const OUTPUTS_DIR = '/outputs';

// Mapeamento forma de pagamento → chave interna
const PAYMENT_MAP = {
  'cartão':          'cartao',
  'cartao':          'cartao',
  'pix manual':      'pix_manual',
  'pix':             'pix_manual',
  'pix automático':  'pix_auto',
  'pix automatico':  'pix_auto',
  'pix auto':        'pix_auto',
  'boleto':          'boleto_manual',
  'boleto manual':   'boleto_manual',
};

function normalizePayment(raw) {
  if (!raw) return 'cartao';
  return PAYMENT_MAP[raw.toLowerCase().trim()] || 'cartao';
}

// Formata número como moeda BRL sem depender de locale do sistema
function formatCurrency(value) {
  const num = Math.round(Number(value) * 100) / 100;
  const [intPart, decPart] = num.toFixed(2).split('.');
  const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `R$ ${formatted},${decPart}`;
}

// Normaliza quantidade de classes: "2 Classes" → "2 (duas)"
const NUM_EXT = {
  '1': 'uma', '2': 'duas', '3': 'três', '4': 'quatro', '5': 'cinco',
  '6': 'seis', '7': 'sete', '8': 'oito', '9': 'nove', '10': 'dez',
};

function formatClasses(raw) {
  const match = (raw || '').match(/(\d+)/);
  if (!match) return raw || '1';
  const n = match[1];
  return NUM_EXT[n] ? `${n} (${NUM_EXT[n]})` : n;
}

function buildContratoJSON(task, qualificacao) {
  const taskName = task.name?.trim() || '';

  // Custom fields
  const classesRaw      = getField(task, FIELDS.CLASSES)?.toString() || '';
  const parcelasText    = (getField(task, FIELDS.PARCELAS_TEXT)?.toString() || '1x').trim();
  const formaPagRaw     = getField(task, FIELDS.FORMA_PAGAMENTO)?.toString() || '';
  const valorRaw        = getField(task, FIELDS.VALOR) || 0;

  // Parseia parcelas: "10x" → 10
  const numParcelasMatch = parcelasText.match(/(\d+)/);
  const numParcelas      = numParcelasMatch ? parseInt(numParcelasMatch[1]) : 1;
  const condicao         = numParcelas > 1 ? 'parcelado' : 'vista';

  // Sufixo do arquivo
  const clienteNome = qualificacao.nome || qualificacao.razao_social || 'cliente';
  const nomeSuffix  = `${taskName}_${clienteNome}`
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // remove acentos
    .replace(/[^a-zA-Z0-9_ -]/g, '')
    .replace(/\s+/g, '_');

  return {
    ...qualificacao,
    nome_marca:          taskName,
    qtd_classes:         formatClasses(classesRaw),
    valor_total:         formatCurrency(valorRaw),
    forma_pagamento:     normalizePayment(formaPagRaw),
    condicao_pagamento:  condicao,
    num_parcelas:        numParcelas.toString(),
    nome_arquivo_suffix: nomeSuffix,
    gerar_contrato:      true,
    gerar_procuracao:    true,
    upload_drive:        false,
  };
}

async function generateDocs(task_id, contratoJSON) {
  const outDir     = path.join(OUTPUTS_DIR, task_id);
  const scriptPath = path.join(SCRIPTS_DIR, 'assemble_contract.py');
  const jsonStr    = JSON.stringify(contratoJSON);

  console.log(`🐍 Chamando assemble_contract.py para task ${task_id}...`);

  const { stdout, stderr } = await execFileAsync(
    'python3',
    [scriptPath, jsonStr],
    { cwd: outDir, timeout: 60000 }
  );

  if (stdout) console.log('📄 Script stdout:', stdout.trim());
  if (stderr) console.warn('⚠️  Script stderr:', stderr.trim());

  console.log(`✅ Documentos gerados em ${outDir}`);
}

module.exports = { generateDocs, buildContratoJSON };

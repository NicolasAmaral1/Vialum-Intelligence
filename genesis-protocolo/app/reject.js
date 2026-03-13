#!/usr/bin/env node
/**
 * reject.js — CLI para rejeição HITL de documentos gerados
 * Uso: node reject.js <task_id> "motivo da rejeição"
 *
 * O que faz:
 *   1. Verifica status.json → deve ser "pending_approval"
 *   2. Posta comentário com o motivo no card
 *   3. Atualiza status.json → "rejected"
 *
 * O card PERMANECE em "contrato + proc" para que o usuário corrija
 * e mova manualmente novamente, disparando novo ciclo.
 */

const fs      = require('fs').promises;
const path    = require('path');
const clickup = require('./clickup');

const OUTPUTS_DIR = '/outputs';

async function reject(task_id, motivo) {
  if (!task_id) {
    console.error('❌ Uso: node reject.js <task_id> "motivo"');
    process.exit(1);
  }

  const outDir     = path.join(OUTPUTS_DIR, task_id);
  const statusFile = path.join(outDir, 'status.json');

  // Lê status atual
  let statusData;
  try {
    statusData = JSON.parse(await fs.readFile(statusFile, 'utf8'));
  } catch {
    console.error(`❌ Status file não encontrado para task ${task_id}`);
    process.exit(1);
  }

  if (statusData.status !== 'pending_approval') {
    console.error(`❌ Task ${task_id} não está em pending_approval`);
    console.error(`   Status atual: ${statusData.status}`);
    process.exit(1);
  }

  const motivoText = motivo || 'Sem motivo especificado';

  // Posta comentário de rejeição
  await clickup.postComment(
    task_id,
    `❌ Documentos rejeitados.\n\n*Motivo:* ${motivoText}\n\nCorrija os dados e mova o card para _contrato + proc_ novamente para gerar novos documentos.`
  );

  // Atualiza status local
  await fs.writeFile(statusFile, JSON.stringify({
    ...statusData,
    status:      'rejected',
    rejected_at: new Date().toISOString(),
    motivo:      motivoText,
  }, null, 2));

  console.log(`❌ Task ${task_id} rejeitada.`);
  console.log(`   Motivo: ${motivoText}`);
}

reject(process.argv[2], process.argv[3]).catch(err => {
  console.error('❌ Erro durante rejeição:', err.message);
  process.exit(1);
});

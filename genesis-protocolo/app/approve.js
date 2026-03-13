#!/usr/bin/env node
/**
 * approve.js — CLI para aprovação HITL de documentos gerados
 * Uso: node approve.js <task_id>
 *
 * O que faz:
 *   1. Verifica status.json → deve ser "pending_approval"
 *   2. Faz upload dos PDFs para o Google Drive
 *   3. Move o card no ClickUp para "pagamento & assinatura"
 *   4. Posta comentário de confirmação
 *   5. Atualiza status.json → "approved"
 */

const fs      = require('fs').promises;
const path    = require('path');
const clickup = require('./clickup');
const { uploadToDrive } = require('./drive');

const OUTPUTS_DIR   = '/outputs';
const STATUS_NEXT   = 'pagamento & assinatura';

async function approve(task_id) {
  if (!task_id) {
    console.error('❌ Uso: node approve.js <task_id>');
    process.exit(1);
  }

  const outDir     = path.join(OUTPUTS_DIR, task_id);
  const statusFile = path.join(outDir, 'status.json');
  const dadosFile  = path.join(outDir, 'dados.json');

  // Lê status atual
  let statusData;
  try {
    statusData = JSON.parse(await fs.readFile(statusFile, 'utf8'));
  } catch {
    console.error(`❌ Status file não encontrado para task ${task_id}`);
    console.error(`   Esperado em: ${statusFile}`);
    process.exit(1);
  }

  if (statusData.status !== 'pending_approval') {
    console.error(`❌ Task ${task_id} não está em pending_approval`);
    console.error(`   Status atual: ${statusData.status}`);
    process.exit(1);
  }

  // Lê dados do contrato
  let contratoJSON;
  try {
    contratoJSON = JSON.parse(await fs.readFile(dadosFile, 'utf8'));
  } catch {
    console.error(`❌ dados.json não encontrado para task ${task_id}`);
    process.exit(1);
  }

  console.log(`\n✅ Aprovando task ${task_id}...`);
  console.log(`   Cliente: ${contratoJSON.nome || contratoJSON.razao_social}`);
  console.log(`   Marca:   ${contratoJSON.nome_marca}\n`);

  // 1. Upload Drive
  console.log('📤 Fazendo upload para o Google Drive...');
  await uploadToDrive(task_id, contratoJSON);

  // 2. Move card no ClickUp
  console.log(`🔄 Movendo card para "${STATUS_NEXT}"...`);
  await clickup.updateStatus(task_id, STATUS_NEXT);

  // 3. Posta comentário
  await clickup.postComment(
    task_id,
    `✅ Documentos aprovados e enviados para o Google Drive.\n\nCard movido para *${STATUS_NEXT}*. ✨`
  );

  // 4. Atualiza status local
  await fs.writeFile(statusFile, JSON.stringify({
    ...statusData,
    status:      'approved',
    approved_at: new Date().toISOString(),
  }, null, 2));

  console.log(`\n✅ Task ${task_id} aprovada com sucesso!`);
  console.log(`   Card movido para: ${STATUS_NEXT}`);
}

approve(process.argv[2]).catch(err => {
  console.error('❌ Erro durante aprovação:', err.message);
  process.exit(1);
});

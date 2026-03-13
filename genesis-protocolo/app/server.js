/**
 * server.js — genesis-protocolo
 * Webhook handler para automação de contratos Genesis via ClickUp.
 *
 * Fluxo:
 *   ClickUp taskStatusUpdated (list=Protocolo, status="contrato + proc")
 *   → valida campos do card
 *   → gera Contrato + Procuração PDF via Python
 *   → posta comentário aguardando aprovação HITL
 *
 * Aprovação: docker exec genesis-protocolo node approve.js <task_id>
 * Rejeição:  docker exec genesis-protocolo node reject.js <task_id> "motivo"
 */

const http   = require('http');
const crypto = require('crypto');
const fs     = require('fs').promises;
const path   = require('path');

const clickup              = require('./clickup');
const { validateCard }     = require('./validator');
const { parseDescription } = require('./parser');
const { generateDocs, buildContratoJSON } = require('./generator');

const PORT             = process.env.PORT || 3000;
const WEBHOOK_SECRET   = process.env.CLICKUP_WEBHOOK_SECRET;
const TARGET_LIST_ID   = process.env.CLICKUP_LIST_ID || '901322069698';
const TARGET_STATUS    = 'contrato + proc';
const OUTPUTS_DIR      = '/outputs';

// Evita reprocessamento de tasks em andamento
const processing = new Set();

// ─────────────────────────────────────────────
// Lógica de negócio
// ─────────────────────────────────────────────

function getNewStatus(payload) {
  // ClickUp envia o novo status em diferentes formatos dependendo da versão
  if (payload.status?.status)                          return payload.status.status;
  if (payload.history_items?.[0]?.after?.status)       return payload.history_items[0].after.status;
  return null;
}

async function handleWebhook(payload) {
  const { event, task_id } = payload;

  if (event !== 'taskStatusUpdated') return;

  const newStatus = getNewStatus(payload);
  const listId    = payload.list_id;

  console.log(`📩 Evento recebido: task=${task_id} list=${listId} status="${newStatus}"`);

  if (listId !== TARGET_LIST_ID) return;
  if (newStatus !== TARGET_STATUS) return;

  if (processing.has(task_id)) {
    console.log(`⏭️  Task ${task_id} já em processamento — ignorando duplicata`);
    return;
  }

  processing.add(task_id);
  try {
    await processTask(task_id);
  } catch (err) {
    console.error(`❌ Erro ao processar task ${task_id}:`, err.message);
    // Tenta notificar o card sobre o erro interno
    try {
      await clickup.postComment(task_id,
        `⚠️ Erro interno ao processar o card.\n\nDetalhes: ${err.message}\n\nVerifique os logs do servidor.`
      );
    } catch { /* se o comentário falhar, apenas loga */ }
  } finally {
    processing.delete(task_id);
  }
}

async function processTask(task_id) {
  console.log(`\n🧠 Processando task: ${task_id}`);

  // 1. Busca dados completos do card
  const task = await clickup.getTask(task_id);
  console.log(`   Marca: ${task.name}`);

  // 2. Valida campos obrigatórios
  const { valid, missing } = validateCard(task);

  if (!valid) {
    const comentario = [
      '⚠️ Não foi possível gerar os documentos. Campos faltando:\n',
      ...missing.map(m => `• ${m}`),
      '\nComplete os campos e mova o card para _contrato + proc_ novamente.',
    ].join('\n');
    await clickup.postComment(task_id, comentario);
    console.log(`❌ Task ${task_id} inválida. Faltando: ${missing.join(', ')}`);
    return;
  }

  // 3. Parseia descrição
  const qualificacao = parseDescription(task.description || '');
  console.log(`   Tipo: ${qualificacao.tipo_pessoa} | Cliente: ${qualificacao.nome || qualificacao.razao_social}`);

  // 4. Monta JSON completo do contrato
  const contratoJSON = buildContratoJSON(task, qualificacao);

  // 5. Cria diretório de saída
  const outDir = path.join(OUTPUTS_DIR, task_id);
  await fs.mkdir(outDir, { recursive: true });

  // 6. Salva dados.json para referência / regeneração
  await fs.writeFile(
    path.join(outDir, 'dados.json'),
    JSON.stringify(contratoJSON, null, 2)
  );

  // 7. Status: gerando
  await fs.writeFile(
    path.join(outDir, 'status.json'),
    JSON.stringify({ status: 'generating', task_id, created_at: new Date().toISOString() }, null, 2)
  );

  // 8. Gera documentos via Python
  await generateDocs(task_id, contratoJSON);

  // 9. Atualiza status → pending_approval
  await fs.writeFile(
    path.join(outDir, 'status.json'),
    JSON.stringify({ status: 'pending_approval', task_id, created_at: new Date().toISOString() }, null, 2)
  );

  // 10. Posta comentário de aprovação
  const comentario = [
    '📄 Documentos gerados e aguardando aprovação HITL.\n',
    'Revise via SSH:',
    '```',
    `ssh vps-nova 'ls /root/genesis-protocolo/outputs/${task_id}/'`,
    '```',
    '\nPara aprovar:',
    '```',
    `ssh vps-nova 'docker exec genesis-protocolo node approve.js ${task_id}'`,
    '```',
    '\nPara rejeitar:',
    '```',
    `ssh vps-nova 'docker exec genesis-protocolo node reject.js ${task_id} "motivo"'`,
    '```',
  ].join('\n');

  await clickup.postComment(task_id, comentario);
  console.log(`✅ Task ${task_id} processada. Aguardando aprovação HITL.\n`);
}

// ─────────────────────────────────────────────
// HTTP Server
// ─────────────────────────────────────────────

const server = http.createServer((req, res) => {
  // Health check
  if (req.method === 'GET' && req.url === '/protocolo/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'genesis-protocolo' }));
    return;
  }

  // Webhook endpoint
  if (req.method === 'POST' && req.url === '/protocolo/webhook') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        // Verifica assinatura (opcional — apenas se CLICKUP_WEBHOOK_SECRET estiver definido)
        if (WEBHOOK_SECRET) {
          const sig      = req.headers['x-signature'];
          const expected = crypto.createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex');
          if (sig !== expected) {
            console.log('🚫 Assinatura do webhook inválida');
            res.writeHead(401);
            res.end();
            return;
          }
        }

        const payload = JSON.parse(body);

        // Responde imediatamente (ClickUp tem timeout curto)
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));

        // Processa de forma assíncrona
        handleWebhook(payload).catch(err => {
          console.error('❌ Erro não tratado no webhook handler:', err.message);
        });

      } catch (err) {
        console.error('❌ Erro ao parsear payload:', err.message);
        if (!res.headersSent) {
          res.writeHead(200); // Sempre 200 para o ClickUp não fazer retry
          res.end();
        }
      }
    });
    return;
  }

  res.writeHead(404);
  res.end();
});

server.listen(PORT, () => {
  console.log(`\n✅ genesis-protocolo iniciado na porta ${PORT}`);
  console.log(`📋 Monitorando lista ClickUp: ${TARGET_LIST_ID}`);
  console.log(`🎯 Trigger: status = "${TARGET_STATUS}"`);
  console.log(`🌐 Webhook: POST /protocolo/webhook`);
  console.log(`❤️  Health:  GET  /protocolo/health\n`);
});

process.on('SIGTERM', () => {
  console.log('🛑 Encerrando servidor...');
  server.close(() => process.exit(0));
});

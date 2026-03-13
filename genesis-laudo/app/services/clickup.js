/**
 * services/clickup.js
 * ClickUp REST API v2 — encapsula todas as chamadas ao ClickUp.
 *
 * AC Story 1.3:
 *   getQueue()      → cards com status "para fazer" na lista do laudo
 *   getByTaskId()   → dados de um card específico
 *   postComment()   → posta comentário no card
 *   updateStatus()  → muda o status do card
 *
 * Auth: Authorization header sem prefixo "Bearer" (padrão ClickUp v2).
 */

const LIST_ID = process.env.CLICKUP_LIST_ID || '901324787605';
const BASE    = 'https://api.clickup.com/api/v2';

function headers() {
  const token = process.env.CLICKUP_API_TOKEN;
  if (!token) throw new Error('CLICKUP_API_TOKEN não definido.');
  return {
    'Authorization': token,
    'Content-Type':  'application/json',
  };
}

/**
 * Busca cards da lista com o status especificado.
 * Retorna array de objetos { task_id, nome_marca, cliente, atividade }.
 */
async function getQueue(status = 'para fazer') {
  const url = `${BASE}/list/${LIST_ID}/task?statuses[]=${encodeURIComponent(status)}&include_closed=false`;
  const res  = await fetch(url, { headers: headers() });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`ClickUp API ${res.status}: ${body}`);
  }

  const { tasks } = await res.json();
  return (tasks || []).map(parseTask);
}

/**
 * Busca um card específico pelo task_id.
 */
async function getByTaskId(task_id) {
  const url = `${BASE}/task/${task_id}`;
  const res  = await fetch(url, { headers: headers() });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`ClickUp API ${res.status}: ${body}`);
  }

  const task = await res.json();
  return parseTask(task);
}

/**
 * Posta um comentário no card.
 */
async function postComment(task_id, text) {
  const url = `${BASE}/task/${task_id}/comment`;
  const res  = await fetch(url, {
    method:  'POST',
    headers: headers(),
    body:    JSON.stringify({ comment_text: text }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`ClickUp comment ${res.status}: ${body}`);
  }

  return res.json();
}

/**
 * Atualiza o status de um card.
 */
async function updateStatus(task_id, status) {
  const url = `${BASE}/task/${task_id}`;
  const res  = await fetch(url, {
    method:  'PUT',
    headers: headers(),
    body:    JSON.stringify({ status }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`ClickUp status update ${res.status}: ${body}`);
  }

  return res.json();
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Transforma um task object da API ClickUp no formato interno.
 * Extrai cliente e atividade da descrição (mesmo padrão do squad laudo-coletar).
 */
function parseTask(task) {
  const desc = task.description || '';

  const cliente  = extractField(desc, ['Cliente:', 'Empresa:', 'Solicitante:'])
                || `Equipe ${task.name}`;
  const atividade = extractField(desc, ['Atividade:', 'Negócio:', 'Serviços:', 'Produtos:'])
                 || 'Não informada';

  return {
    task_id:    task.id,
    nome_marca: task.name,
    cliente,
    atividade,
    status:     task.status?.status || null,
    url:        task.url || null,
  };
}

/**
 * Extrai o valor de um campo a partir de marcadores na descrição.
 * Ex: "Cliente: Acme Corp\nAtividade: Software" → extractField(desc, ['Cliente:']) → 'Acme Corp'
 */
function extractField(text, markers) {
  for (const marker of markers) {
    const idx = text.indexOf(marker);
    if (idx === -1) continue;
    const after = text.slice(idx + marker.length).trimStart();
    const end   = after.search(/\n|$/);
    const value = after.slice(0, end === -1 ? undefined : end).trim();
    if (value) return value;
  }
  return null;
}

module.exports = { getQueue, getByTaskId, postComment, updateStatus };

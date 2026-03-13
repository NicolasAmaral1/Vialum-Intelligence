/**
 * services/db.js — Pool de conexão PostgreSQL
 *
 * Exporta:
 *   pool          → pg.Pool (para queries diretas)
 *   query(sql, p) → atalho pool.query
 *   waitForDb()   → aguarda o Postgres ficar pronto (útil no startup)
 *
 * Helpers de negócio:
 *   analyses.*        → CRUD de análises
 *   events.insert()   → append-only de eventos
 *   cli.insert()      → registra execução CLI
 *   cli.finish()      → atualiza execução CLI concluída
 */

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Limites conservadores para MVP
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on('error', (err) => {
  console.error('❌ [db] Erro inesperado no pool:', err.message);
});

// ── Atalho simples ──────────────────────────────────────────────────────────
const query = (sql, params) => pool.query(sql, params);

// ── Aguarda o Postgres ficar pronto ────────────────────────────────────────
async function waitForDb(retries = 10, delayMs = 2000) {
  for (let i = 1; i <= retries; i++) {
    try {
      await pool.query('SELECT 1');
      console.log('✅ [db] Conexão com PostgreSQL estabelecida.');
      return;
    } catch (err) {
      console.log(`⏳ [db] Aguardando PostgreSQL... (tentativa ${i}/${retries})`);
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  throw new Error('[db] Não foi possível conectar ao PostgreSQL após várias tentativas.');
}

// ── analyses ────────────────────────────────────────────────────────────────
const analyses = {
  /**
   * Cria uma análise. Idempotente: se task_id já existe, retorna o existente.
   */
  async upsert({ task_id, nome_marca, cliente, atividade }) {
    const { rows } = await pool.query(
      `INSERT INTO analyses (task_id, nome_marca, cliente, atividade)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (task_id) DO UPDATE
         SET updated_at = NOW()
       RETURNING *`,
      [task_id, nome_marca, cliente || `Equipe ${nome_marca}`, atividade || null]
    );
    return rows[0];
  },

  async findByTaskId(task_id) {
    const { rows } = await pool.query(
      'SELECT * FROM analyses WHERE task_id = $1 LIMIT 1',
      [task_id]
    );
    return rows[0] || null;
  },

  async findById(id) {
    const { rows } = await pool.query(
      'SELECT * FROM analyses WHERE id = $1 LIMIT 1',
      [id]
    );
    return rows[0] || null;
  },

  /** Retorna análises agrupadas por fase para o dashboard. */
  async listByFase() {
    const { rows } = await pool.query(
      `SELECT * FROM analyses ORDER BY updated_at DESC`
    );
    return {
      fila:       rows.filter(r => r.fase === 0),
      ativas:     rows.filter(r => r.fase > 0 && r.fase < 4),
      concluidas: rows.filter(r => r.fase === 4),
    };
  },

  async updateFase(task_id, fase) {
    const { rows } = await pool.query(
      `UPDATE analyses SET fase = $2 WHERE task_id = $1 RETURNING *`,
      [task_id, fase]
    );
    return rows[0];
  },

  async updateCheckpoint(task_id, checkpoint, valor = 'aprovado') {
    const col = checkpoint === 1 ? 'checkpoint_1' : 'checkpoint_2';
    const { rows } = await pool.query(
      `UPDATE analyses SET ${col} = $2 WHERE task_id = $1 RETURNING *`,
      [task_id, valor]
    );
    return rows[0];
  },

  async updateOutputs(task_id, { pasta, output_pdf, output_docx, drive_url }) {
    const { rows } = await pool.query(
      `UPDATE analyses
       SET pasta = COALESCE($2, pasta),
           output_pdf  = COALESCE($3, output_pdf),
           output_docx = COALESCE($4, output_docx),
           drive_url   = COALESCE($5, drive_url)
       WHERE task_id = $1
       RETURNING *`,
      [task_id, pasta, output_pdf, output_docx, drive_url]
    );
    return rows[0];
  },
};

// ── events ──────────────────────────────────────────────────────────────────
const events = {
  /**
   * Append-only — nunca atualiza, só insere.
   */
  async insert(analysis_id, { fase, event_type, payload = {} }) {
    const { rows } = await pool.query(
      `INSERT INTO analysis_events (analysis_id, fase, event_type, payload)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [analysis_id, fase ?? null, event_type, JSON.stringify(payload)]
    );
    return rows[0];
  },

  async listByAnalysis(analysis_id) {
    const { rows } = await pool.query(
      `SELECT * FROM analysis_events
       WHERE analysis_id = $1
       ORDER BY created_at ASC`,
      [analysis_id]
    );
    return rows;
  },
};

// ── cli_executions ──────────────────────────────────────────────────────────
const cli = {
  async insert(analysis_id, { command, args = [] }) {
    const { rows } = await pool.query(
      `INSERT INTO cli_executions (analysis_id, command, args, status)
       VALUES ($1, $2, $3, 'running') RETURNING *`,
      [analysis_id, command, JSON.stringify(args)]
    );
    return rows[0];
  },

  async finish(id, { status, output, stderr, exit_code }) {
    const { rows } = await pool.query(
      `UPDATE cli_executions
       SET status = $2, output = $3, stderr = $4, exit_code = $5, finished_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id, status, output || null, stderr || null, exit_code ?? null]
    );
    return rows[0];
  },

  async listByAnalysis(analysis_id) {
    const { rows } = await pool.query(
      `SELECT * FROM cli_executions
       WHERE analysis_id = $1
       ORDER BY started_at ASC`,
      [analysis_id]
    );
    return rows;
  },
};

module.exports = { pool, query, waitForDb, analyses, events, cli };

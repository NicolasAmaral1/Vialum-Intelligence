/**
 * routes/dashboard.js — Story 1.3
 * GET /laudo/ → Dashboard principal (fila ClickUp + análises ativas + concluídas)
 *
 * Fontes de dados:
 *   fila      → ClickUp API (status "para fazer")
 *   ativas    → PostgreSQL (fase 1-3)
 *   concluidas → PostgreSQL (fase 4)
 *
 * Tolerante a falhas: erro no ClickUp ou DB → mostra seção vazia com aviso.
 */

const express  = require('express');
const router   = express.Router();
const clickup  = require('../services/clickup');
const db       = require('../services/db');

// GET /laudo/
router.get('/', async (req, res) => {
  let fila       = [];
  let ativas     = [];
  let concluidas = [];
  const avisos   = [];

  // 1. Fila ClickUp ("para fazer")
  if (process.env.CLICKUP_API_TOKEN) {
    try {
      fila = await clickup.getQueue('para fazer');
    } catch (err) {
      console.error('⚠️ [dashboard] ClickUp:', err.message);
      avisos.push('Não foi possível carregar a fila do ClickUp.');
    }
  } else {
    avisos.push('CLICKUP_API_TOKEN não definido — fila indisponível (modo dev).');
  }

  // 2. Análises do PostgreSQL
  if (process.env.DATABASE_URL) {
    try {
      const grupos = await db.analyses.listByFase();
      ativas     = grupos.ativas;
      concluidas = grupos.concluidas;
    } catch (err) {
      console.error('⚠️ [dashboard] DB:', err.message);
      avisos.push('Não foi possível carregar análises do banco de dados.');
    }
  }

  // 3. Filtrar da fila cards que já têm análise ativa no DB
  //    (para não mostrar o botão "Iniciar" duas vezes)
  const task_ids_ativos = new Set([...ativas, ...concluidas].map(a => a.task_id));
  const filaFiltrada = fila.filter(c => !task_ids_ativos.has(c.task_id));

  res.render('dashboard', {
    fila:      filaFiltrada,
    ativas,
    concluidas,
    avisos,
  });
});

module.exports = router;

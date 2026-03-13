/**
 * server.js — genesis-laudo
 * Dashboard HITL para o squad laudo-viabilidade.
 *
 * Arquitetura:
 *   Browser → Express → services/{clickup, claude, db} → PostgreSQL / claude CLI
 *
 * Rotas:
 *   GET  /laudo/             → Dashboard (fila + análises ativas)
 *   GET  /laudo/analise/:id  → Detalhe de análise (stepper de fases)
 *   POST /laudo/analise/nova → Inicia nova análise
 *   POST /laudo/checkpoint/1 → Aprova CHECKPOINT 1
 *   POST /laudo/inpi         → Recebe paste INPI
 *   POST /laudo/checkpoint/2 → Aprova CHECKPOINT 2
 *   POST /laudo/gerar        → Gera PDF + DOCX + Drive + ClickUp
 *   GET  /laudo/health       → Health check
 */

const express       = require('express');
const path          = require('path');

const { waitForDb } = require('./services/db');
const dashboardRouter = require('./routes/dashboard');
const analiseRouter   = require('./routes/analise');

const PORT = process.env.PORT || 3001;

const app = express();

// ─── View engine ────────────────────────────────────────────────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ─── Middleware ──────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/laudo/public', express.static(path.join(__dirname, 'public')));

// ─── Rotas ───────────────────────────────────────────────────────────────────
app.use('/laudo', dashboardRouter);
app.use('/laudo/analise', analiseRouter);

// Health check
app.get('/laudo/health', (req, res) => {
  res.json({ status: 'ok', service: 'genesis-laudo', version: '1.0.0' });
});

// ─── 404 ─────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ─── Error handler ────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('❌ Erro:', err.message);
  res.status(500).json({ error: 'Erro interno', detail: err.message });
});

// ─── Start ────────────────────────────────────────────────────────────────────
async function start() {
  // Se DATABASE_URL definida, aguarda Postgres antes de ouvir
  if (process.env.DATABASE_URL) {
    await waitForDb();
  } else {
    console.log('⚠️  DATABASE_URL não definida — rodando sem banco (modo dev).');
  }

  app.listen(PORT, () => {
    console.log(`\n✅ genesis-laudo iniciado na porta ${PORT}`);
    console.log(`🌐 Dashboard: http://localhost:${PORT}/laudo/`);
    console.log(`❤️  Health:   http://localhost:${PORT}/laudo/health\n`);
  });
}

start().catch(err => {
  console.error('❌ Falha no startup:', err.message);
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('🛑 Encerrando servidor...');
  process.exit(0);
});

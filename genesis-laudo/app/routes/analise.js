/**
 * routes/analise.js — Story 1.4 + 1.5 + 1.6
 * Controle de análises individuais.
 *
 * GET  /laudo/analise/:task_id        → Página de detalhe (stepper + conteúdo de fase)
 * GET  /laudo/analise/:task_id/stream → SSE de progresso da geração de documentos
 * POST /laudo/analise/nova            → Inicia nova análise (cria DB + dispara CLI)
 * POST /laudo/analise/checkpoint/1    → Aprova PARTE 1 → fase 3
 * POST /laudo/analise/checkpoint/2    → Aprova PARTE 2 → fase 4
 * POST /laudo/analise/inpi            → Recebe paste INPI → processar_inpi.py → @laudo *inpi
 * POST /laudo/analise/gerar           → Gera PDF + DOCX + Drive + ClickUp "feito"
 */

const express        = require('express');
const fs             = require('fs').promises;
const path           = require('path');
const { execFile }   = require('child_process');
const EventEmitter   = require('events');
const router         = express.Router();

// EventEmitter para SSE de progresso da geração (in-memory, keyed por task_id)
const gerarEmitter = new EventEmitter();
gerarEmitter.setMaxListeners(50);

const db      = require('../services/db');
const claude  = require('../services/claude');
const clickup = require('../services/clickup');

// Placeholder que o @laudo *inpi substitui quando gerar PARTE 2
const PLACEHOLDER_INPI = 'AGUARDANDO PROCESSAMENTO DOS DADOS DO INPI';

// ── GET /laudo/analise/:task_id ──────────────────────────────────────────────
router.get('/:task_id', async (req, res) => {
  const { task_id } = req.params;

  let analise    = null;
  let cliExecs   = [];
  let conteudoMd = null;

  if (process.env.DATABASE_URL) {
    try {
      analise  = await db.analyses.findByTaskId(task_id);
      if (analise) {
        cliExecs = await db.cli.listByAnalysis(analise.id);

        // Lê o PLANO DE ANÁLISE.md se a pasta já foi criada
        if (analise.pasta) {
          const mdPath = path.join(
            analise.pasta,
            `${analise.nome_marca} - PLANO DE ANÁLISE.md`
          );
          try {
            conteudoMd = await fs.readFile(mdPath, 'utf8');
          } catch {
            // Arquivo ainda não existe — CLI ainda rodando
          }
        }
      }
    } catch (err) {
      console.error('⚠️ [analise] DB:', err.message);
    }
  }

  // Fallback dev sem DB
  if (!analise) {
    analise = {
      task_id,
      nome_marca:   task_id,
      cliente:      '—',
      atividade:    '—',
      fase:          0,
      checkpoint_1: 'pendente',
      checkpoint_2: 'pendente',
    };
  }

  const cliRodando  = cliExecs.some(e => e.status === 'running');
  // PARTE 2 está pronta quando o placeholder foi substituído pelo @laudo *inpi
  const parte2Pronta = !!conteudoMd && !conteudoMd.includes(PLACEHOLDER_INPI);

  res.render('analise', { analise, cliExecs, conteudoMd, cliRodando, parte2Pronta });
});

// ── POST /laudo/analise/nova ─────────────────────────────────────────────────
router.post('/nova', async (req, res) => {
  const { task_id, nome_marca, cliente, atividade } = req.body;

  if (!task_id || !nome_marca) {
    return res.status(400).json({ error: 'task_id e nome_marca são obrigatórios.' });
  }

  let analise = { task_id, nome_marca, cliente, atividade, id: null };

  // 1. Upsert idempotente no DB
  if (process.env.DATABASE_URL) {
    try {
      analise = await db.analyses.upsert({ task_id, nome_marca, cliente, atividade });

      await db.events.insert(analise.id, {
        fase:       0,
        event_type: 'started',
        payload:    { task_id, nome_marca, source: 'dashboard' },
      });
    } catch (err) {
      console.error('❌ [nova] DB:', err.message);
      return res.status(500).json({ error: 'Erro ao criar análise no banco.' });
    }
  }

  // 2. Redireciona imediatamente — CLI roda em background
  res.redirect(`/laudo/analise/${task_id}`);

  // 3. Fire-and-forget: @laudo *nova-analise roda Fases 1+2, escreve PLANO, para no CP1
  setImmediate(async () => {
    try {
      console.log(`\n🚀 [nova] Iniciando @laudo *nova-analise para task ${task_id}`);

      if (process.env.CLICKUP_API_TOKEN) {
        try {
          await clickup.updateStatus(task_id, 'em processo');
        } catch (err) {
          console.warn('⚠️ [nova] updateStatus:', err.message);
        }
      }

      const result = await claude.runFase(
        task_id,
        analise.id,
        '*nova-analise',
        2  // após concluir Fases 1+2, fase = 2 (aguardando CHECKPOINT 1)
      );

      // Persiste caminho da pasta após execução
      if (process.env.DATABASE_URL && result.status === 'completed') {
        const clienteNorm = (analise.cliente || `Equipe ${analise.nome_marca}`)
          .replace(/[/\\:*?"<>|]/g, '-').trim();
        const marcaNorm = analise.nome_marca
          .replace(/[/\\:*?"<>|]/g, '-').trim();
        const pasta = path.join(claude.WORKSPACE_PATH, 'laudos', clienteNorm, marcaNorm);

        await db.analyses.updateOutputs(task_id, { pasta });
      }

    } catch (err) {
      console.error(`❌ [nova] Erro CLI para ${task_id}:`, err.message);
    }
  });
});

// ── POST /laudo/analise/checkpoint/1 ─────────────────────────────────────────
// Aprova PARTE 1 → checkpoint_1='aprovado' → fase 3
router.post('/checkpoint/1', async (req, res) => {
  const { task_id } = req.body;
  if (!task_id) return res.status(400).send('task_id obrigatório');

  if (process.env.DATABASE_URL) {
    try {
      const analise = await db.analyses.findByTaskId(task_id);
      if (!analise) return res.redirect('/laudo/');

      // Veto: só permite na fase 2
      if (analise.fase !== 2) {
        console.warn(`⚠️ [cp1] Veto — fase atual: ${analise.fase}, esperada: 2`);
        return res.redirect(`/laudo/analise/${task_id}`);
      }

      await db.analyses.updateCheckpoint(task_id, 1, 'aprovado');
      await db.analyses.updateFase(task_id, 3);
      await db.events.insert(analise.id, {
        fase:       3,
        event_type: 'checkpoint_approved',
        payload:    { checkpoint: 1 },
      });

      console.log(`✅ [cp1] Checkpoint 1 aprovado — task ${task_id}`);
    } catch (err) {
      console.error('❌ [cp1] DB:', err.message);
    }
  }

  res.redirect(`/laudo/analise/${task_id}`);
});

// ── POST /laudo/analise/inpi ─────────────────────────────────────────────────
// Recebe paste de dados INPI → salva inpi-raw.txt → processar_inpi.py → @laudo *inpi
router.post('/inpi', async (req, res) => {
  const { task_id, inpi_texto } = req.body;
  if (!task_id) return res.status(400).send('task_id obrigatório');

  let analise = null;

  if (process.env.DATABASE_URL) {
    try {
      analise = await db.analyses.findByTaskId(task_id);
      if (!analise) return res.redirect('/laudo/');

      // Veto: só permite na fase 3
      if (analise.fase !== 3) {
        console.warn(`⚠️ [inpi] Veto — fase atual: ${analise.fase}, esperada: 3`);
        return res.redirect(`/laudo/analise/${task_id}`);
      }
    } catch (err) {
      console.error('❌ [inpi] DB:', err.message);
      return res.redirect(`/laudo/analise/${task_id}`);
    }
  }

  if (!analise?.pasta) {
    console.error('❌ [inpi] pasta não definida na análise');
    return res.redirect(`/laudo/analise/${task_id}`);
  }

  // Salva inpi-raw.txt
  const inpiPath = path.join(analise.pasta, 'inpi-raw.txt');
  try {
    await fs.writeFile(inpiPath, inpi_texto || '', 'utf8');
    console.log(`📝 [inpi] inpi-raw.txt salvo em ${inpiPath}`);
  } catch (err) {
    console.error('❌ [inpi] Erro ao salvar inpi-raw.txt:', err.message);
    return res.redirect(`/laudo/analise/${task_id}`);
  }

  // Redireciona imediatamente
  res.redirect(`/laudo/analise/${task_id}`);

  // Fire-and-forget: processar_inpi.py + @laudo *inpi
  setImmediate(async () => {
    // 1. Rodar processar_inpi.py (Python) — gera inpi-raw-processed.json
    const scriptsDir = path.join(
      claude.WORKSPACE_PATH,
      'genesis', 'squads', 'laudo-viabilidade', 'scripts'
    );

    await new Promise((resolve) => {
      execFile('python3', ['processar_inpi.py', inpiPath], { cwd: scriptsDir }, (err, stdout, stderr) => {
        if (err) {
          console.error('❌ [inpi] processar_inpi.py falhou:', err.message);
        } else {
          console.log('✅ [inpi] processar_inpi.py concluído');
          if (stdout) console.log('   stdout:', stdout.slice(0, 200));
        }
        resolve();
      });
    });

    // 2. Registrar evento
    if (analise.id && process.env.DATABASE_URL) {
      try {
        await db.events.insert(analise.id, {
          fase:       3,
          event_type: 'inpi_submitted',
          payload:    { inpi_path: inpiPath },
        });
      } catch (err) {
        console.error('⚠️ [inpi] Erro ao registrar evento:', err.message);
      }
    }

    // 3. @laudo *inpi — lê inpi-raw-processed.json e gera PARTE 2 no PLANO.md
    //    fasePosExec=3: fase permanece 3 (aguarda CP2), runFase só faz updateFase se exitCode=0
    if (analise.id) {
      try {
        await claude.runFase(task_id, analise.id, '*inpi', 3);
      } catch (err) {
        console.error('❌ [inpi] Erro no @laudo *inpi:', err.message);
      }
    }
  });
});

// ── POST /laudo/analise/checkpoint/2 ─────────────────────────────────────────
// Aprova PARTE 2 → checkpoint_2='aprovado' → fase 4
router.post('/checkpoint/2', async (req, res) => {
  const { task_id } = req.body;
  if (!task_id) return res.status(400).send('task_id obrigatório');

  if (process.env.DATABASE_URL) {
    try {
      const analise = await db.analyses.findByTaskId(task_id);
      if (!analise) return res.redirect('/laudo/');

      // Veto: só permite na fase 3
      if (analise.fase !== 3) {
        console.warn(`⚠️ [cp2] Veto — fase atual: ${analise.fase}, esperada: 3`);
        return res.redirect(`/laudo/analise/${task_id}`);
      }

      await db.analyses.updateCheckpoint(task_id, 2, 'aprovado');
      await db.analyses.updateFase(task_id, 4);
      await db.events.insert(analise.id, {
        fase:       4,
        event_type: 'checkpoint_approved',
        payload:    { checkpoint: 2 },
      });

      console.log(`✅ [cp2] Checkpoint 2 aprovado — task ${task_id}`);
    } catch (err) {
      console.error('❌ [cp2] DB:', err.message);
    }
  }

  res.redirect(`/laudo/analise/${task_id}`);
});

// ── GET /laudo/analise/:task_id/stream ───────────────────────────────────────
// SSE: emite eventos de progresso da geração de documentos
router.get('/:task_id/stream', (req, res) => {
  const { task_id } = req.params;

  res.writeHead(200, {
    'Content-Type':  'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection':    'keep-alive',
    'X-Accel-Buffering': 'no', // Nginx: desabilita buffering para SSE
  });
  res.write(': stream conectado\n\n');

  const handler = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  gerarEmitter.on(task_id, handler);

  // Keep-alive a cada 20s
  const keepAlive = setInterval(() => res.write(': ping\n\n'), 20_000);

  req.on('close', () => {
    gerarEmitter.off(task_id, handler);
    clearInterval(keepAlive);
  });
});

// ── POST /laudo/analise/gerar ─────────────────────────────────────────────────
// Fase 4: gera PDF + DOCX, faz upload para Drive, move ClickUp para "feito"
router.post('/gerar', async (req, res) => {
  const { task_id } = req.body;
  if (!task_id) return res.status(400).send('task_id obrigatório');

  let analise = null;

  if (process.env.DATABASE_URL) {
    try {
      analise = await db.analyses.findByTaskId(task_id);
      if (!analise) return res.redirect('/laudo/');

      // Veto: só permite se fase 4 e ambos checkpoints aprovados
      if (
        analise.fase !== 4 ||
        analise.checkpoint_1 !== 'aprovado' ||
        analise.checkpoint_2 !== 'aprovado'
      ) {
        console.warn(`⚠️ [gerar] Veto — fase: ${analise.fase}, cp1: ${analise.checkpoint_1}, cp2: ${analise.checkpoint_2}`);
        return res.redirect(`/laudo/analise/${task_id}`);
      }

      // Idempotente: se PDF já existe, redireciona sem re-executar
      if (analise.output_pdf) {
        return res.redirect(`/laudo/analise/${task_id}`);
      }
    } catch (err) {
      console.error('❌ [gerar] DB:', err.message);
      return res.redirect(`/laudo/analise/${task_id}`);
    }
  }

  // Redireciona imediatamente — geração roda em background
  res.redirect(`/laudo/analise/${task_id}`);

  setImmediate(async () => {
    console.log(`\n🚀 [gerar] Iniciando geração de documentos para task ${task_id}`);

    // Emite evento inicial
    gerarEmitter.emit(task_id, { step: 'start', status: 'running' });

    // Resolve pasta (usa analise.pasta ou reconstrói o path)
    const clienteNorm = (analise?.cliente || `Equipe ${analise?.nome_marca}`)
      .replace(/[/\\:*?"<>|]/g, '-').trim();
    const marcaNorm = (analise?.nome_marca || task_id)
      .replace(/[/\\:*?"<>|]/g, '-').trim();
    const pasta = analise?.pasta || path.join(claude.WORKSPACE_PATH, 'laudos', clienteNorm, marcaNorm);

    // Executa @laudo *gerar via Claude CLI com callback de stdout para SSE
    let cliOutput = '';
    const result = await claude.run(analise?.id, `@laudo *gerar ${task_id}`, {
      onStdout: (chunk) => {
        cliOutput += chunk;

        if (chunk.includes('LAUDO DE VIABILIDADE.pdf') || chunk.includes('PDF ReportLab')) {
          gerarEmitter.emit(task_id, { step: 'pdf', status: 'running' });
        }
        if (chunk.includes('LAUDO DE VIABILIDADE.docx') || chunk.includes('DOCX')) {
          gerarEmitter.emit(task_id, { step: 'docx', status: 'running' });
        }
        if (chunk.includes('Upload') || chunk.includes('Drive')) {
          gerarEmitter.emit(task_id, { step: 'drive', status: 'running' });
        }
        if (chunk.includes('feito') || chunk.includes('ClickUp')) {
          gerarEmitter.emit(task_id, { step: 'clickup', status: 'running' });
        }
      },
    });

    // Detecta arquivos gerados e Drive URL no output do CLI
    let pdfPath   = null;
    let docxPath  = null;
    let driveUrl  = null;

    if (result.status === 'completed') {
      const pdfFile  = path.join(pasta, `${marcaNorm} - LAUDO DE VIABILIDADE.pdf`);
      const docxFile = path.join(pasta, `${marcaNorm} - LAUDO DE VIABILIDADE.docx`);

      try { await fs.access(pdfFile);  pdfPath  = pdfFile;  } catch { /* não gerado */ }
      try { await fs.access(docxFile); docxPath = docxFile; } catch { /* não gerado */ }

      // Extrai Drive file ID do stdout: "Upload concluído! ID do arquivo: {id}"
      const idMatches = [...result.output.matchAll(/Upload conclu[íi]do!? ID do arquivo: ([a-zA-Z0-9_-]+)/g)];
      if (idMatches.length > 0) {
        // Usa o último ID (normalmente do DOCX, que é enviado por último)
        const lastId = idMatches[idMatches.length - 1][1];
        driveUrl = `https://drive.google.com/file/d/${lastId}/view`;
      } else {
        // Tenta extrair URL direta
        const urlMatch = result.output.match(/https:\/\/drive\.google\.com\/[^\s\n"']+/);
        if (urlMatch) driveUrl = urlMatch[0];
      }

      // Atualiza DB com paths e Drive URL
      if (process.env.DATABASE_URL) {
        try {
          await db.analyses.updateOutputs(task_id, {
            pasta:      pasta,
            output_pdf:  pdfPath,
            output_docx: docxPath,
            drive_url:   driveUrl,
          });
        } catch (err) {
          console.error('⚠️ [gerar] updateOutputs:', err.message);
        }
      }

      // Move card ClickUp para "feito"
      if (process.env.CLICKUP_API_TOKEN) {
        try {
          await clickup.postComment(task_id,
            `✅ Laudo de viabilidade concluído!\n\nMarca: ${analise?.nome_marca}\nCliente: ${analise?.cliente}\n\n— Mira ⚖️`
          );
          await clickup.updateStatus(task_id, 'feito');
          gerarEmitter.emit(task_id, { step: 'clickup', status: 'completed' });
          console.log(`✅ [gerar] ClickUp movido para "feito" — task ${task_id}`);
        } catch (err) {
          console.warn('⚠️ [gerar] ClickUp:', err.message);
        }
      }
    }

    // Registra evento final no DB
    if (process.env.DATABASE_URL && analise?.id) {
      try {
        await db.events.insert(analise.id, {
          fase:       4,
          event_type: result.status === 'completed' ? 'completed' : 'error',
          payload:    { pdf: pdfPath, docx: docxPath, drive_url: driveUrl, status: result.status },
        });
      } catch (err) {
        console.error('⚠️ [gerar] evento DB:', err.message);
      }
    }

    // Emite evento final para SSE — dispara reload no cliente
    gerarEmitter.emit(task_id, {
      step:      'done',
      status:    result.status,
      pdf:       pdfPath,
      docx:      docxPath,
      drive_url: driveUrl,
    });

    console.log(`✅ [gerar] Concluído — status: ${result.status} | PDF: ${pdfPath || 'não gerado'}`);
  });
});

module.exports = router;

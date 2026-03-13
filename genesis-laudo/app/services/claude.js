/**
 * services/claude.js — Story 1.4
 * Executa o Claude Code CLI como subprocess e registra cada chamada no PostgreSQL.
 *
 * Contrato:
 *   run(analysisId, prompt, options?) → Promise<{ status, output, exitCode }>
 *
 * Cada chamada:
 *   1. Insere registro em cli_executions (status=running)
 *   2. Spawna: claude -p "{prompt}" --dangerously-skip-permissions
 *      CWD = WORKSPACE_PATH (raiz do aiOS na VPS)
 *   3. Acumula stdout + stderr
 *   4. Ao encerrar: atualiza cli_executions (status, output, exit_code, finished_at)
 *   5. Resolve com { status, output, exitCode }
 *
 * Timeout padrão: 5 minutos (300 000 ms)
 */

const { spawn }   = require('child_process');
const path        = require('path');
const db          = require('./db');

// Diretório onde o claude CLI deve rodar.
// Deve conter AGENTS.md e ter acesso ao squad laudo-viabilidade.
// Fallback local: raiz do workspace (um nível acima do genesis-laudo/)
const WORKSPACE_PATH = process.env.WORKSPACE_PATH
  || path.resolve(__dirname, '..', '..', '..'); // genesis-laudo/app/services → ../../.. = workspace root

const TIMEOUT_MS = 5 * 60 * 1000; // 5 minutos

/**
 * Executa o CLI do Claude Code com um prompt e registra no DB.
 *
 * @param {string} analysisId  - UUID do registro em `analyses`
 * @param {string} prompt      - Prompt completo (ex: "@laudo *nova-analise 86af3jfbm")
 * @param {object} [opts]
 * @param {string} [opts.cwd]  - Override do diretório de trabalho
 * @returns {Promise<{status: string, output: string, exitCode: number|null}>}
 */
async function run(analysisId, prompt, opts = {}) {
  const cwd   = opts.cwd || WORKSPACE_PATH;
  const args  = ['-p', prompt, '--dangerously-skip-permissions'];

  // 1. Registra a execução no DB antes de iniciar
  let execRecord = null;
  if (process.env.DATABASE_URL) {
    try {
      execRecord = await db.cli.insert(analysisId, {
        command: 'claude',
        args,
      });
    } catch (err) {
      console.error('⚠️ [claude] Erro ao registrar cli_execution:', err.message);
    }
  }

  console.log(`🤖 [claude] Iniciando: claude -p "${prompt.slice(0, 80)}..."`);
  console.log(`   CWD: ${cwd}`);

  return new Promise((resolve) => {
    let output = '';
    let stderr = '';
    let timedOut = false;

    const proc = spawn('claude', args, {
      cwd,
      env: { ...process.env },  // repassa variáveis de ambiente (ANTHROPIC_API_KEY, etc.)
    });

    // Timeout
    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill('SIGTERM');
      console.warn(`⏱️ [claude] Timeout após ${TIMEOUT_MS / 1000}s — processo encerrado.`);
    }, TIMEOUT_MS);

    proc.stdout.on('data', (chunk) => {
      const str = chunk.toString();
      output += str;
      if (opts.onStdout) opts.onStdout(str);
    });
    proc.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

    proc.on('close', async (exitCode) => {
      clearTimeout(timer);

      const status = timedOut
        ? 'timeout'
        : exitCode === 0 ? 'completed' : 'failed';

      console.log(`✅ [claude] Encerrado: status=${status} exitCode=${exitCode}`);
      if (stderr) console.error(`   stderr: ${stderr.slice(0, 200)}`);

      // 2. Atualiza registro no DB
      if (execRecord && process.env.DATABASE_URL) {
        try {
          await db.cli.finish(execRecord.id, { status, output, stderr, exit_code: exitCode });
        } catch (err) {
          console.error('⚠️ [claude] Erro ao finalizar cli_execution:', err.message);
        }
      }

      resolve({ status, output, exitCode });
    });

    proc.on('error', async (err) => {
      clearTimeout(timer);
      console.error(`❌ [claude] Erro ao iniciar processo: ${err.message}`);

      if (execRecord && process.env.DATABASE_URL) {
        try {
          await db.cli.finish(execRecord.id, {
            status:    'failed',
            output:    output,
            stderr:    err.message,
            exit_code: null,
          });
        } catch (dbErr) {
          console.error('⚠️ [claude] Erro ao registrar falha no DB:', dbErr.message);
        }
      }

      resolve({ status: 'failed', output, exitCode: null });
    });
  });
}

/**
 * Executa uma fase do squad @laudo e atualiza o estado da análise no DB.
 *
 * @param {string} taskId      - task_id ClickUp (ex: "86af3jfbm")
 * @param {string} analysisId  - UUID em `analyses`
 * @param {string} command     - Comando do agente (ex: "*nova-analise", "*gerar")
 * @param {number} fasePosExec - Fase que deve ser registrada após execução bem-sucedida
 */
async function runFase(taskId, analysisId, command, fasePosExec) {
  const prompt = `@laudo ${command} ${taskId}`;

  // Log: iniciando fase
  if (process.env.DATABASE_URL) {
    await db.events.insert(analysisId, {
      fase:       fasePosExec - 1,
      event_type: 'cli_called',
      payload:    { command, taskId },
    });
  }

  const result = await run(analysisId, prompt);

  // Atualiza fase e registra evento
  if (process.env.DATABASE_URL && result.status === 'completed') {
    await db.analyses.updateFase(taskId, fasePosExec);
    await db.events.insert(analysisId, {
      fase:       fasePosExec,
      event_type: 'completed',
      payload:    { command, exitCode: result.exitCode },
    });
  } else if (process.env.DATABASE_URL && result.status !== 'completed') {
    await db.events.insert(analysisId, {
      fase:       fasePosExec - 1,
      event_type: 'error',
      payload:    { command, status: result.status, exitCode: result.exitCode },
    });
  }

  return result;
}

module.exports = { run, runFase, WORKSPACE_PATH };

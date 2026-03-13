const { execFile } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs').promises;

const execFileAsync = promisify(execFile);

const SCRIPTS_DIR = '/app/scripts';
const OUTPUTS_DIR = '/outputs';

async function uploadToDrive(task_id, contratoJSON) {
  const outDir     = path.join(OUTPUTS_DIR, task_id);
  const script     = path.join(SCRIPTS_DIR, 'google_drive_service.py');
  const nomeMarca  = contratoJSON.nome_marca || '';
  const nomeCliente = contratoJSON.nome || contratoJSON.razao_social || '';

  // Localiza PDFs gerados
  const files    = await fs.readdir(outDir);
  const pdfFiles = files.filter(f => f.endsWith('.pdf'));

  if (pdfFiles.length === 0) {
    throw new Error(`Nenhum PDF encontrado em ${outDir}`);
  }

  for (const pdfFile of pdfFiles) {
    const pdfPath = path.join(outDir, pdfFile);
    console.log(`📤 Enviando ${pdfFile} para o Drive...`);

    const { stdout, stderr } = await execFileAsync(
      'python3',
      [script, pdfPath, nomeMarca, nomeCliente],
      { timeout: 120000 }
    );

    if (stdout) console.log('Drive stdout:', stdout.trim());
    if (stderr) console.warn('Drive stderr:', stderr.trim());
  }

  console.log(`✅ Upload concluído para task ${task_id} (${pdfFiles.length} arquivo(s))`);
}

module.exports = { uploadToDrive };

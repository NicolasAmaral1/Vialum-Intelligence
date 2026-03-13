// genesis-laudo — app.js

// Timestamp do último refresh
(function () {
  const el = document.getElementById('last-refresh');
  if (el) {
    const now = new Date().toLocaleTimeString('pt-BR');
    el.textContent = `Atualizado às ${now}`;
  }
})();

// Auto-refresh a cada 30s no dashboard (só ativa fora da página de análise)
(function () {
  if (document.querySelector('.gerar-progress')) return; // SSE cuida do reload
  if (!document.querySelector('.section')) return;
  setTimeout(() => location.reload(), 30_000);
})();

// ── SSE: progresso de geração de documentos ───────────────────────────────────
(function () {
  const progressEl = document.querySelector('.gerar-progress');
  if (!progressEl) return;

  const taskId = progressEl.dataset.taskId;
  if (!taskId) return;

  const stepOrder = ['pdf', 'docx', 'drive', 'clickup'];

  function setStepDone(step) {
    const el = document.getElementById(`gerar-step-${step}`);
    if (!el) return;
    el.classList.remove('gerar-step-active', 'gerar-step-pending');
    el.classList.add('gerar-step-done');
    el.querySelector('.gerar-step-dot').textContent = '✓';
  }

  function setStepActive(step) {
    const el = document.getElementById(`gerar-step-${step}`);
    if (!el) return;
    el.classList.remove('gerar-step-pending');
    el.classList.add('gerar-step-active');
    el.querySelector('.gerar-step-dot').textContent = '⏳';
  }

  const source = new EventSource(`/laudo/analise/${taskId}/stream`);

  source.onmessage = function (e) {
    try {
      const data = JSON.parse(e.data);

      if (data.step === 'pdf')     { setStepDone('pdf');     setStepActive('docx'); }
      if (data.step === 'docx')    { setStepDone('docx');    setStepActive('drive'); }
      if (data.step === 'drive')   { setStepDone('drive');   setStepActive('clickup'); }
      if (data.step === 'clickup') { setStepDone('clickup'); }

      if (data.step === 'done') {
        source.close();
        // Pequeno delay para o usuário ver a animação completar
        setTimeout(() => location.reload(), 1500);
      }
    } catch (err) {
      // Ignora eventos malformados (keep-alive comments)
    }
  };

  source.onerror = function () {
    source.close();
    // Fallback: recarrega após 5s se SSE falhar
    setTimeout(() => location.reload(), 5000);
  };
})();

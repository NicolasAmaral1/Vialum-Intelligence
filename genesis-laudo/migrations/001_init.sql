-- ============================================================
-- genesis-laudo — 001_init.sql
-- Schema inicial idempotente (IF NOT EXISTS em todas as DDLs)
-- Montado em /docker-entrypoint-initdb.d — roda uma vez na
-- primeira inicialização do Postgres.
-- ============================================================

-- Extensão UUID
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ────────────────────────────────────────────────────────────
-- TABELA: analyses
-- Uma linha por análise (1:1 com task_id ClickUp).
-- Idempotência garantida pelo UNIQUE em task_id.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS analyses (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id         VARCHAR(50)   UNIQUE NOT NULL,      -- ClickUp task ID
  nome_marca      VARCHAR(255)  NOT NULL,
  cliente         VARCHAR(255),
  atividade       TEXT,
  fase            SMALLINT      NOT NULL DEFAULT 0,   -- 0=monitorar .. 4=gerar
  checkpoint_1    VARCHAR(20)   NOT NULL DEFAULT 'pendente',  -- pendente | aprovado
  checkpoint_2    VARCHAR(20)   NOT NULL DEFAULT 'pendente',
  pasta           TEXT,          -- caminho local: laudos/{cliente}/{marca}/
  output_pdf      TEXT,          -- caminho do PDF gerado
  output_docx     TEXT,          -- caminho do DOCX gerado
  drive_url       TEXT,          -- URL da pasta no Google Drive
  idempotency_key VARCHAR(255)  UNIQUE,               -- reservado para webhooks futuros
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Index para buscas por fase (dashboard)
CREATE INDEX IF NOT EXISTS idx_analyses_fase     ON analyses (fase);
CREATE INDEX IF NOT EXISTS idx_analyses_task_id  ON analyses (task_id);

-- ────────────────────────────────────────────────────────────
-- TABELA: analysis_events
-- Log imutável de eventos — base para auditoria e replay.
-- Nunca se atualiza, só se insere (append-only).
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS analysis_events (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id  UUID         NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  fase         SMALLINT,
  event_type   VARCHAR(50)  NOT NULL,
  -- event_type: started | completed | checkpoint_approved | error | cli_called | cli_done
  payload      JSONB        NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_analysis_id  ON analysis_events (analysis_id);
CREATE INDEX IF NOT EXISTS idx_events_event_type   ON analysis_events (event_type);

-- ────────────────────────────────────────────────────────────
-- TABELA: cli_executions
-- Rastreia cada chamada ao claude CLI — status, output, duração.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cli_executions (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id  UUID         NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  command      TEXT         NOT NULL,               -- comando completo executado
  args         JSONB        NOT NULL DEFAULT '[]',  -- args como array JSON
  status       VARCHAR(20)  NOT NULL DEFAULT 'running',
  -- status: running | completed | failed | timeout
  output       TEXT,        -- stdout do processo
  stderr       TEXT,        -- stderr do processo
  exit_code    INTEGER,
  started_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  finished_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_cli_analysis_id ON cli_executions (analysis_id);
CREATE INDEX IF NOT EXISTS idx_cli_status      ON cli_executions (status);

-- ────────────────────────────────────────────────────────────
-- FUNÇÃO: updated_at automático
-- Trigger que mantém updated_at atualizado em analyses.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_analyses_updated_at ON analyses;
CREATE TRIGGER trg_analyses_updated_at
  BEFORE UPDATE ON analyses
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- Jobs table
CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type TEXT NOT NULL CHECK (source_type IN ('pdf', 'url')),
  source_name TEXT,
  source_url TEXT,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'extracting', 'chunking', 'translating', 'postprocessing', 'exporting', 'completed', 'failed')),
  stage TEXT,
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  language_pair TEXT NOT NULL DEFAULT 'en->ko' CHECK (language_pair IN ('en->ko', 'ko->en')),
  translation_style TEXT NOT NULL DEFAULT 'natural' CHECK (translation_style IN ('literal', 'natural', 'academic', 'formal')),
  glossary JSONB DEFAULT '{}',
  total_chunks INTEGER DEFAULT 0,
  completed_chunks INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Chunks table
CREATE TABLE IF NOT EXISTS chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  section_title TEXT,
  original_text TEXT NOT NULL,
  translated_text_draft TEXT,
  translated_text_final TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'translating', 'translated', 'postprocessing', 'completed', 'failed')),
  retry_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Exports table
CREATE TABLE IF NOT EXISTS exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  export_type TEXT NOT NULL CHECK (export_type IN ('draft', 'final')),
  file_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_chunks_job_id ON chunks(job_id);
CREATE INDEX IF NOT EXISTS idx_chunks_job_id_status ON chunks(job_id, status);
CREATE INDEX IF NOT EXISTS idx_chunks_job_id_index ON chunks(job_id, chunk_index);
CREATE INDEX IF NOT EXISTS idx_exports_job_id ON exports(job_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at DESC);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers
CREATE TRIGGER update_jobs_updated_at
  BEFORE UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chunks_updated_at
  BEFORE UPDATE ON chunks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

export type JobStatus =
  | 'queued'
  | 'extracting'
  | 'chunking'
  | 'translating'
  | 'postprocessing'
  | 'exporting'
  | 'completed'
  | 'failed';

export type SourceType = 'pdf' | 'url';
export type LanguagePair = 'en->ko' | 'ko->en';
export type TranslationStyle = 'literal' | 'natural' | 'academic' | 'formal';

export type ChunkStatus =
  | 'pending'
  | 'translating'
  | 'translated'
  | 'postprocessing'
  | 'completed'
  | 'failed';

export type ExportType = 'draft' | 'final';

export interface Job {
  id: string;
  source_type: SourceType;
  source_name: string | null;
  source_url: string | null;
  status: JobStatus;
  stage: string | null;
  progress: number;
  language_pair: LanguagePair;
  translation_style: TranslationStyle;
  glossary: Record<string, string>;
  total_chunks: number;
  completed_chunks: number;
  created_at: string;
  updated_at: string;
}

export interface Chunk {
  id: string;
  job_id: string;
  chunk_index: number;
  section_title: string | null;
  original_text: string;
  translated_text_draft: string | null;
  translated_text_final: string | null;
  status: ChunkStatus;
  retry_count: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface Export {
  id: string;
  job_id: string;
  export_type: ExportType;
  file_path: string | null;
  created_at: string;
}

export interface TranslationSettings {
  language_pair: LanguagePair;
  translation_style: TranslationStyle;
  glossary: Record<string, string>;
}

export interface SSEEvent {
  type: 'progress' | 'complete' | 'error' | 'status';
  progress?: number;
  completed?: number;
  total?: number;
  status?: string;
  message?: string;
}

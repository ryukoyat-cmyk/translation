import { createClient } from '@supabase/supabase-js';
import type { Job, Chunk } from '@/types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Browser client (uses anon key)
export const supabaseBrowser = createClient(supabaseUrl, supabaseAnonKey);

// Server client (uses service role key to bypass RLS)
export const supabaseServer = createClient(supabaseUrl, supabaseServiceRoleKey || supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Job operations
export async function createJob(data: Partial<Job>): Promise<Job> {
  const { data: job, error } = await supabaseServer
    .from('jobs')
    .insert(data)
    .select()
    .single();

  if (error) throw new Error(`Failed to create job: ${error.message}`);
  return job as Job;
}

export async function getJob(id: string): Promise<Job | null> {
  const { data, error } = await supabaseServer
    .from('jobs')
    .select('*')
    .eq('id', id)
    .single();

  if (error) return null;
  return data as Job;
}

export async function updateJob(id: string, updates: Partial<Job>): Promise<void> {
  const { error } = await supabaseServer
    .from('jobs')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw new Error(`Failed to update job: ${error.message}`);
}

// Chunk operations
export async function createChunks(chunks: Partial<Chunk>[]): Promise<Chunk[]> {
  const { data, error } = await supabaseServer
    .from('chunks')
    .insert(chunks)
    .select();

  if (error) throw new Error(`Failed to create chunks: ${error.message}`);
  return data as Chunk[];
}

export async function getChunks(jobId: string): Promise<Chunk[]> {
  const { data, error } = await supabaseServer
    .from('chunks')
    .select('*')
    .eq('job_id', jobId)
    .order('chunk_index', { ascending: true });

  if (error) throw new Error(`Failed to get chunks: ${error.message}`);
  return data as Chunk[];
}

export async function updateChunk(id: string, updates: Partial<Chunk>): Promise<void> {
  const { error } = await supabaseServer
    .from('chunks')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw new Error(`Failed to update chunk: ${error.message}`);
}

export async function getFailedChunks(jobId: string): Promise<Chunk[]> {
  const { data, error } = await supabaseServer
    .from('chunks')
    .select('*')
    .eq('job_id', jobId)
    .eq('status', 'failed')
    .order('chunk_index', { ascending: true });

  if (error) throw new Error(`Failed to get failed chunks: ${error.message}`);
  return data as Chunk[];
}

export async function countCompletedChunks(jobId: string): Promise<number> {
  const { count, error } = await supabaseServer
    .from('chunks')
    .select('*', { count: 'exact', head: true })
    .eq('job_id', jobId)
    .in('status', ['translated', 'completed']);

  if (error) return 0;
  return count || 0;
}

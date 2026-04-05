import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Job, Chunk } from '@/types';

// Lazy initialization — avoids "supabaseUrl is required" at build time
let _server: SupabaseClient | null = null;

function getServer(): SupabaseClient {
  if (_server) return _server;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase env vars missing');
  _server = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  return _server;
}

export async function createJob(data: Partial<Job>): Promise<Job> {
  const { data: job, error } = await getServer().from('jobs').insert(data).select().single();
  if (error) throw new Error(`Failed to create job: ${error.message}`);
  return job as Job;
}

export async function getJob(id: string): Promise<Job | null> {
  const { data, error } = await getServer().from('jobs').select('*').eq('id', id).single();
  if (error) return null;
  return data as Job;
}

export async function updateJob(id: string, updates: Partial<Job>): Promise<void> {
  const { error } = await getServer()
    .from('jobs')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(`Failed to update job: ${error.message}`);
}

export async function createChunks(chunks: Partial<Chunk>[]): Promise<Chunk[]> {
  const { data, error } = await getServer().from('chunks').insert(chunks).select();
  if (error) throw new Error(`Failed to create chunks: ${error.message}`);
  return data as Chunk[];
}

export async function getChunks(jobId: string): Promise<Chunk[]> {
  const { data, error } = await getServer()
    .from('chunks')
    .select('*')
    .eq('job_id', jobId)
    .order('chunk_index', { ascending: true });
  if (error) throw new Error(`Failed to get chunks: ${error.message}`);
  return data as Chunk[];
}

export async function updateChunk(id: string, updates: Partial<Chunk>): Promise<void> {
  const { error } = await getServer()
    .from('chunks')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(`Failed to update chunk: ${error.message}`);
}

export async function getFailedChunks(jobId: string): Promise<Chunk[]> {
  const { data, error } = await getServer()
    .from('chunks')
    .select('*')
    .eq('job_id', jobId)
    .eq('status', 'failed')
    .order('chunk_index', { ascending: true });
  if (error) throw new Error(`Failed to get failed chunks: ${error.message}`);
  return data as Chunk[];
}

export async function countCompletedChunks(jobId: string): Promise<number> {
  const { count, error } = await getServer()
    .from('chunks')
    .select('*', { count: 'exact', head: true })
    .eq('job_id', jobId)
    .in('status', ['translated', 'completed']);
  if (error) return 0;
  return count || 0;
}

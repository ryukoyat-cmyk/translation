import { NextRequest, NextResponse } from 'next/server';
import { getJob, countCompletedChunks } from '@/lib/supabase';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const job = await getJob(params.id);
    if (!job) {
      return NextResponse.json({ error: '작업을 찾을 수 없습니다.' }, { status: 404 });
    }

    const completed = await countCompletedChunks(params.id);
    return NextResponse.json({ job: { ...job, completed_chunks: completed } });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getJob, getChunks } from '@/lib/supabase';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const [job, chunks] = await Promise.all([
      getJob(params.id),
      getChunks(params.id),
    ]);

    if (!job) {
      return NextResponse.json({ error: '작업을 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json({ job, chunks });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

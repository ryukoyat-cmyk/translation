import { NextRequest, NextResponse } from 'next/server';
import { getJob, getChunks } from '@/lib/supabase';
import { generateDocx } from '@/lib/docx-generator';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const version = (searchParams.get('version') as 'draft' | 'final') || 'draft';

    const [job, chunks] = await Promise.all([
      getJob(params.id),
      getChunks(params.id),
    ]);

    if (!job) {
      return NextResponse.json({ error: '작업을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (chunks.length === 0) {
      return NextResponse.json({ error: '번역 결과가 없습니다.' }, { status: 400 });
    }

    const buffer = await generateDocx(job, chunks, version);
    const uint8Array = new Uint8Array(buffer);

    const safeName = (job.source_name || 'translation')
      .replace(/[^a-zA-Z0-9가-힣_.-]/g, '_')
      .slice(0, 50);
    const filename = `${safeName}_${version}.docx`;

    return new NextResponse(uint8Array, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
        'Content-Length': buffer.length.toString(),
      },
    });
  } catch (err) {
    console.error('Export error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

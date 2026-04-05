import { NextRequest, NextResponse } from 'next/server';
import { getJob, getFailedChunks, getChunks, updateJob, updateChunk } from '@/lib/supabase';
import { translateChunk } from '@/lib/translator';

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const job = await getJob(params.id);
    if (!job) {
      return NextResponse.json({ error: '작업을 찾을 수 없습니다.' }, { status: 404 });
    }

    const failedChunks = await getFailedChunks(params.id);
    if (failedChunks.length === 0) {
      return NextResponse.json({ message: '재시도할 실패 청크가 없습니다.' });
    }

    const allChunks = await getChunks(params.id);
    const sortedFailed = [...failedChunks].sort((a, b) => a.chunk_index - b.chunk_index);

    let retried = 0;
    let failed = 0;

    for (const chunk of sortedFailed) {
      // Get context from previous chunk
      const prevChunk = allChunks.find((c) => c.chunk_index === chunk.chunk_index - 1);
      const prevContext = prevChunk?.translated_text_draft?.slice(-300) || '';

      try {
        await updateChunk(chunk.id, { status: 'translating' });

        const translated = await translateChunk({
          text: chunk.original_text,
          context: prevContext,
          languagePair: job.language_pair,
          style: job.translation_style,
          glossary: job.glossary || {},
        });

        await updateChunk(chunk.id, {
          translated_text_draft: translated,
          status: 'translated',
          error_message: null,
          retry_count: (chunk.retry_count || 0) + 1,
        });
        retried++;
      } catch (err) {
        await updateChunk(chunk.id, {
          status: 'failed',
          error_message: String(err),
          retry_count: (chunk.retry_count || 0) + 1,
        });
        failed++;
      }
    }

    // Update job progress
    const updatedChunks = await getChunks(params.id);
    const completedCount = updatedChunks.filter(
      (c) => c.status === 'translated' || c.status === 'completed'
    ).length;
    const remainingFailed = updatedChunks.filter((c) => c.status === 'failed').length;
    const progress = Math.round((completedCount / updatedChunks.length) * 100);

    await updateJob(params.id, {
      completed_chunks: completedCount,
      progress,
      status: remainingFailed === 0 ? 'completed' : 'completed',
    });

    return NextResponse.json({ retried, failed });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

import { NextRequest } from 'next/server';
import { readFile } from 'fs/promises';
import { getJob, updateJob, createChunks, updateChunk, getChunks } from '@/lib/supabase';
import { extractFromPdf, extractFromUrl } from '@/lib/extractor';
import { chunkText } from '@/lib/chunker';
import { translateChunk } from '@/lib/translator';

export const maxDuration = 300;

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch { /* stream may be closed */ }
      };

      try {
        const job = await getJob(params.id);
        if (!job) {
          send({ type: 'error', message: '작업을 찾을 수 없습니다.' });
          controller.close();
          return;
        }

        // If already completed or translating, skip
        if (job.status === 'completed') {
          send({ type: 'complete' });
          controller.close();
          return;
        }

        // Resume from existing chunks if any
        const existingChunks = await getChunks(params.id);
        const hasPendingChunks = existingChunks.some(
          (c) => c.status === 'pending' || c.status === 'failed'
        );
        const allDone = existingChunks.length > 0 && existingChunks.every(
          (c) => c.status === 'translated' || c.status === 'completed'
        );

        let chunks = existingChunks;

        if (existingChunks.length === 0) {
          // === STEP 1: Extract text ===
          send({ type: 'status', status: 'extracting' });
          await updateJob(params.id, { status: 'extracting' });

          let rawText = '';
          if (job.source_type === 'pdf') {
            const filePath = job.source_url;
            if (!filePath) throw new Error('PDF 파일 경로가 없습니다.');
            const buffer = await readFile(filePath);
            rawText = await extractFromPdf(buffer);
          } else if (job.source_type === 'url') {
            if (!job.source_url) throw new Error('URL이 없습니다.');
            rawText = await extractFromUrl(job.source_url);
          }

          if (!rawText.trim()) throw new Error('텍스트 추출 결과가 비어있습니다.');

          // === STEP 2: Chunking ===
          send({ type: 'status', status: 'chunking' });
          await updateJob(params.id, { status: 'chunking' });

          const textChunks = chunkText(rawText);
          if (textChunks.length === 0) throw new Error('청크 분할 결과가 비어있습니다.');

          const chunkRecords = textChunks.map((tc, i) => ({
            job_id: params.id,
            chunk_index: i,
            section_title: tc.title || null,
            original_text: tc.text,
            status: 'pending' as const,
            retry_count: 0,
          }));

          chunks = await createChunks(chunkRecords);
          await updateJob(params.id, {
            status: 'translating',
            total_chunks: chunks.length,
            completed_chunks: 0,
          });
        } else if (allDone) {
          send({ type: 'complete' });
          controller.close();
          return;
        } else {
          await updateJob(params.id, { status: 'translating' });
        }

        send({ type: 'status', status: 'translating' });

        // === STEP 3: Translate ===
        const totalChunks = chunks.length;
        let completedCount = chunks.filter(
          (c) => c.status === 'translated' || c.status === 'completed'
        ).length;

        // Sort by index
        const sortedChunks = [...chunks].sort((a, b) => a.chunk_index - b.chunk_index);

        let prevContext = '';

        for (const chunk of sortedChunks) {
          // Skip already translated
          if (chunk.status === 'translated' || chunk.status === 'completed') {
            prevContext = chunk.translated_text_draft
              ? chunk.translated_text_draft.slice(-300)
              : chunk.original_text.slice(-300);
            continue;
          }

          // Skip non-pending (unless failed for retry)
          if (chunk.status !== 'pending' && chunk.status !== 'failed') {
            continue;
          }

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
            });

            prevContext = translated.slice(-300);
            completedCount++;

            const progress = Math.round((completedCount / totalChunks) * 100);
            await updateJob(params.id, {
              completed_chunks: completedCount,
              progress,
            });

            send({
              type: 'progress',
              progress,
              completed: completedCount,
              total: totalChunks,
              status: 'translating',
            });
          } catch (err) {
            const errMsg = String(err);
            await updateChunk(chunk.id, {
              status: 'failed',
              error_message: errMsg,
              retry_count: (chunk.retry_count || 0) + 1,
            });
            send({
              type: 'progress',
              progress: Math.round((completedCount / totalChunks) * 100),
              completed: completedCount,
              total: totalChunks,
              status: 'translating',
              message: `청크 ${chunk.chunk_index + 1} 실패: ${errMsg}`,
            });
          }
        }

        await updateJob(params.id, { status: 'completed', progress: 100 });
        send({ type: 'complete' });
      } catch (err) {
        const errMsg = String(err);
        try {
          await updateJob(params.id, { status: 'failed' });
        } catch { /* ignore */ }
        send({ type: 'error', message: errMsg });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

import { NextRequest } from 'next/server';
import { getJob, getChunks, updateJob, updateChunk } from '@/lib/supabase';
import { postprocessChunks } from '@/lib/postprocessor';

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
        } catch { /* ignore */ }
      };

      try {
        const job = await getJob(params.id);
        if (!job) {
          send({ type: 'error', message: '작업을 찾을 수 없습니다.' });
          controller.close();
          return;
        }

        const chunks = await getChunks(params.id);
        const translatedChunks = chunks.filter(
          (c) => c.translated_text_draft && c.status !== 'failed'
        );

        if (translatedChunks.length === 0) {
          send({ type: 'error', message: '후처리할 번역 청크가 없습니다.' });
          controller.close();
          return;
        }

        await updateJob(params.id, { status: 'postprocessing' });
        send({ type: 'status', status: 'postprocessing' });

        const settings = {
          language_pair: job.language_pair,
          translation_style: job.translation_style,
          glossary: job.glossary || {},
        };

        // Process chunk by chunk for progress updates
        const total = translatedChunks.length;
        for (let i = 0; i < total; i++) {
          const chunk = translatedChunks[i];
          await updateChunk(chunk.id, { status: 'postprocessing' });

          try {
            const results = await postprocessChunks([chunk], settings);
            const finalText = results[0] || chunk.translated_text_draft || '';

            await updateChunk(chunk.id, {
              translated_text_final: finalText,
              status: 'completed',
            });
          } catch {
            // Keep draft as final on error
            await updateChunk(chunk.id, {
              translated_text_final: chunk.translated_text_draft,
              status: 'completed',
            });
          }

          const progress = Math.round(((i + 1) / total) * 100);
          send({ type: 'progress', progress, completed: i + 1, total });
        }

        await updateJob(params.id, { status: 'completed' });
        send({ type: 'complete' });
      } catch (err) {
        send({ type: 'error', message: String(err) });
        try { await updateJob(params.id, { status: 'failed' }); } catch { /* ignore */ }
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

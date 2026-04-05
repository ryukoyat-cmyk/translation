import { NextRequest, NextResponse } from 'next/server';
import { createJob } from '@/lib/supabase';
import type { LanguagePair, TranslationStyle } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const sourceType = formData.get('source_type') as string;
    const languagePair = (formData.get('language_pair') as LanguagePair) || 'en->ko';
    const translationStyle = (formData.get('translation_style') as TranslationStyle) || 'natural';
    const glossaryRaw = formData.get('glossary') as string || '{}';
    let glossary: Record<string, string> = {};
    try { glossary = JSON.parse(glossaryRaw); } catch { /* ignore */ }

    if (sourceType === 'pdf') {
      const file = formData.get('file') as File | null;
      if (!file) {
        return NextResponse.json({ error: 'PDF 파일이 없습니다.' }, { status: 400 });
      }

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      // Store PDF as base64 data URL in source_url (works across serverless invocations)
      const base64 = buffer.toString('base64');
      const dataUrl = `data:application/pdf;base64,${base64}`;

      const job = await createJob({
        source_type: 'pdf',
        source_name: file.name,
        source_url: dataUrl,
        status: 'queued',
        language_pair: languagePair,
        translation_style: translationStyle,
        glossary,
        progress: 0,
        total_chunks: 0,
        completed_chunks: 0,
      });

      return NextResponse.json({ jobId: job.id });
    } else if (sourceType === 'url') {
      const url = formData.get('url') as string;
      if (!url) {
        return NextResponse.json({ error: 'URL이 없습니다.' }, { status: 400 });
      }

      let hostname = '';
      try { hostname = new URL(url).hostname; } catch { /* ignore */ }

      const job = await createJob({
        source_type: 'url',
        source_name: hostname || url.slice(0, 60),
        source_url: url,
        status: 'queued',
        language_pair: languagePair,
        translation_style: translationStyle,
        glossary,
        progress: 0,
        total_chunks: 0,
        completed_chunks: 0,
      });

      return NextResponse.json({ jobId: job.id });
    } else {
      return NextResponse.json({ error: '유효하지 않은 source_type' }, { status: 400 });
    }
  } catch (err) {
    console.error('POST /api/jobs error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

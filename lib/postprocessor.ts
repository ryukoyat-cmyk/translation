import { GoogleGenerativeAI } from '@google/generative-ai';
import type { Chunk, TranslationSettings } from '@/types';

function getGenAI() { return new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!); }

function getStyleInstruction(style: string, languagePair: string): string {
  const isToKorean = languagePair === 'en->ko';

  switch (style) {
    case 'literal':
      return '직역체로 번역하되, 원문의 단어 선택과 문장 구조를 최대한 유지하세요.';
    case 'natural':
      return isToKorean
        ? '자연스러운 한국어로 번역하세요. 읽기 쉽고 자연스러운 표현을 사용하세요.'
        : '자연스러운 영어로 번역하세요. 읽기 쉽고 자연스러운 표현을 사용하세요.';
    case 'academic':
      return '학술 논문 문체로 번역하세요. 전문 용어를 정확히 사용하고 격식체를 유지하세요.';
    case 'formal':
      return '공식 문서/공문 문체로 번역하세요. 격식체와 정중한 표현을 사용하세요.';
    default:
      return '자연스럽게 번역하세요.';
  }
}

export async function postprocessChunks(
  chunks: Chunk[],
  settings: TranslationSettings
): Promise<string[]> {
  const { language_pair, translation_style, glossary } = settings;
  const isToKorean = language_pair === 'en->ko';
  const targetLang = isToKorean ? '한국어' : '영어';

  const glossaryEntries = Object.entries(glossary);
  const glossarySection =
    glossaryEntries.length > 0
      ? `\n용어집 (반드시 아래 용어 번역을 우선 적용하세요):\n${glossaryEntries.map(([k, v]) => `- ${k} → ${v}`).join('\n')}`
      : '';

  const styleInstruction = getStyleInstruction(translation_style, language_pair);

  const systemInstruction = `You are a professional post-editor and translator. Your task is to refine and improve a translated text chunk while maintaining consistency with the full document.

번역 방향: ${language_pair}
번역 스타일: ${styleInstruction}${glossarySection}

Post-editing guidelines:
1. 용어 통일: 동일한 원문 용어는 전체 문서에서 일관되게 번역하세요.
2. 스타일 일관성: 전체 문서의 문체와 격식 수준을 통일하세요.
3. 누락/중복 제거: 누락된 내용은 복원하고, 중복된 표현은 제거하세요.
4. 자연스러운 ${targetLang} 표현으로 다듬으세요.
5. 원문의 의미를 변경하지 마세요.
6. 수정한 번역문만 반환하세요 (설명이나 주석 없이).`;

  const model = getGenAI().getGenerativeModel({
    model: 'gemini-2.0-flash',
    systemInstruction,
    generationConfig: { temperature: 0.2 },
  });

  const results: string[] = [];

  // Build full context of all drafts for reference
  const fullDraftContext = chunks
    .map((c, i) => `[청크 ${i + 1}${c.section_title ? ` - ${c.section_title}` : ''}]:\n${c.translated_text_draft || ''}`)
    .join('\n\n---\n\n');

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const draftText = chunk.translated_text_draft || '';

    if (!draftText.trim()) {
      results.push('');
      continue;
    }

    const userMessage = `[전체 문서 번역 초안 (참고용)]:\n${fullDraftContext}\n\n---\n\n[현재 후검수할 청크 ${i + 1}${chunk.section_title ? ` - ${chunk.section_title}` : ''}]:\n원문: ${chunk.original_text}\n\n번역 초안: ${draftText}\n\n위 번역 초안을 후검수하여 개선된 번역문만 반환하세요.`;

    try {
      const result = await model.generateContent(userMessage);
      results.push(result.response.text().trim() || draftText);
    } catch (error) {
      // If postprocessing fails for a chunk, keep the draft
      console.error(`Failed to postprocess chunk ${i}:`, error);
      results.push(draftText);
    }
  }

  return results;
}

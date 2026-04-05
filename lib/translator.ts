import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

interface TranslateChunkParams {
  text: string;
  context: string;
  languagePair: string;
  style: string;
  glossary: Record<string, string>;
}

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

function getLanguageNames(languagePair: string): { source: string; target: string } {
  if (languagePair === 'en->ko') {
    return { source: '영어', target: '한국어' };
  } else {
    return { source: '한국어', target: '영어' };
  }
}

export async function translateChunk(params: TranslateChunkParams): Promise<string> {
  const { text, context, languagePair, style, glossary } = params;
  const { source, target } = getLanguageNames(languagePair);
  const styleInstruction = getStyleInstruction(style, languagePair);

  const glossaryEntries = Object.entries(glossary);
  const glossarySection =
    glossaryEntries.length > 0
      ? `\n\n용어집 (반드시 아래 용어 번역을 우선 적용하세요):\n${glossaryEntries.map(([k, v]) => `- ${k} → ${v}`).join('\n')}`
      : '';

  const systemInstruction = `You are a professional translator. Translate faithfully without omissions, summaries, or meaning changes. Apply glossary terms first.

번역 방향: ${source} → ${target}
번역 스타일: ${styleInstruction}${glossarySection}

Rules:
1. Translate ONLY the provided text segment. Do not add explanations or commentary.
2. Do not omit any content from the original.
3. Do not summarize or paraphrase unless the style requires it.
4. Apply glossary terms consistently throughout.
5. Return ONLY the translated text, nothing else.`;

  const userMessage = context
    ? `[이전 문단 맥락 (참고용, 번역하지 마세요)]:\n${context}\n\n[번역할 텍스트]:\n${text}`
    : text;

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    systemInstruction,
    generationConfig: { temperature: 0.3 },
  });

  const result = await model.generateContent(userMessage);
  return result.response.text().trim();
}

'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

type InputMode = 'pdf' | 'url';
type LanguagePair = 'en->ko' | 'ko->en';
type TranslationStyle = 'literal' | 'natural' | 'academic' | 'formal';

export default function HomePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [inputMode, setInputMode] = useState<InputMode>('pdf');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [url, setUrl] = useState('');
  const [languagePair, setLanguagePair] = useState<LanguagePair>('en->ko');
  const [translationStyle, setTranslationStyle] = useState<TranslationStyle>('natural');
  const [glossaryText, setGlossaryText] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  function parseGlossary(text: string): Record<string, string> {
    const glossary: Record<string, string> = {};
    for (const line of text.trim().split('\n')) {
      const sep = line.includes('=') ? '=' : line.includes(':') ? ':' : null;
      if (!sep) continue;
      const idx = line.indexOf(sep);
      const key = line.slice(0, idx).trim();
      const val = line.slice(idx + 1).trim();
      if (key && val) glossary[key] = val;
    }
    return glossary;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (inputMode === 'pdf' && !pdfFile) { setError('PDF 파일을 선택해 주세요.'); return; }
    if (inputMode === 'url' && !url.trim()) { setError('URL을 입력해 주세요.'); return; }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('language_pair', languagePair);
      formData.append('translation_style', translationStyle);
      formData.append('glossary', JSON.stringify(parseGlossary(glossaryText)));

      if (inputMode === 'pdf' && pdfFile) {
        formData.append('source_type', 'pdf');
        formData.append('file', pdfFile);
      } else {
        formData.append('source_type', 'url');
        formData.append('url', url.trim());
      }

      const res = await fetch('/api/jobs', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '작업 생성 실패');
      router.push(`/jobs/${data.jobId}`);
    } catch (err) {
      setError(String(err));
      setIsSubmitting(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file?.type === 'application/pdf') setPdfFile(file);
    else setError('PDF 파일만 업로드할 수 있습니다.');
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="mb-6 text-center">
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 mb-1">문서 통번역</h2>
        <p className="text-sm text-slate-500">PDF 또는 URL로 대용량 문서를 자동 번역합니다</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-6 space-y-5">

        {/* Input mode toggle */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">입력 방식</label>
          <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
            {(['pdf', 'url'] as InputMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setInputMode(mode)}
                className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                  inputMode === mode ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600'
                }`}
              >
                {mode === 'pdf' ? 'PDF 업로드' : 'URL 입력'}
              </button>
            ))}
          </div>
        </div>

        {/* PDF upload */}
        {inputMode === 'pdf' && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">PDF 파일</label>
            <div
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                isDragging ? 'border-blue-400 bg-blue-50'
                : pdfFile ? 'border-green-400 bg-green-50'
                : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'
              }`}
            >
              {pdfFile ? (
                <div>
                  <div className="text-green-600 font-medium text-sm break-all">{pdfFile.name}</div>
                  <div className="text-xs text-slate-500 mt-1">{(pdfFile.size / 1024 / 1024).toFixed(2)} MB</div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setPdfFile(null); }}
                    className="mt-2 text-xs text-red-500 hover:text-red-700"
                  >파일 제거</button>
                </div>
              ) : (
                <div>
                  <div className="text-slate-400 text-3xl mb-2">📄</div>
                  <div className="text-slate-600 font-medium text-sm">클릭하여 PDF 선택</div>
                  <div className="text-xs text-slate-400 mt-1">또는 파일을 여기에 드래그</div>
                </div>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept=".pdf" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) setPdfFile(f); }} />
          </div>
        )}

        {/* URL input */}
        {inputMode === 'url' && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">웹 페이지 URL</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/article"
              className="w-full border border-slate-300 rounded-lg px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        {/* Language pair */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">번역 방향</label>
          <div className="grid grid-cols-2 gap-2">
            {(['en->ko', 'ko->en'] as LanguagePair[]).map((pair) => (
              <label key={pair} className={`flex items-center justify-center p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                languagePair === pair ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600'
              }`}>
                <input type="radio" name="languagePair" value={pair} checked={languagePair === pair}
                  onChange={() => setLanguagePair(pair)} className="sr-only" />
                <span className="font-medium text-sm">{pair === 'en->ko' ? '영어 → 한국어' : '한국어 → 영어'}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Translation style */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">번역 스타일</label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { value: 'literal', label: '직역', desc: '원문 구조 유지' },
              { value: 'natural', label: '자연스러운', desc: '읽기 쉬운 표현' },
              { value: 'academic', label: '학술 문체', desc: '전문 용어·격식체' },
              { value: 'formal', label: '실무/공문', desc: '공식 문서 문체' },
            ].map((s) => (
              <label key={s.value} className={`flex flex-col p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                translationStyle === s.value ? 'border-blue-500 bg-blue-50' : 'border-slate-200'
              }`}>
                <input type="radio" name="style" value={s.value} checked={translationStyle === s.value}
                  onChange={() => setTranslationStyle(s.value as TranslationStyle)} className="sr-only" />
                <span className={`font-medium text-sm ${translationStyle === s.value ? 'text-blue-700' : 'text-slate-700'}`}>{s.label}</span>
                <span className="text-xs text-slate-400 mt-0.5">{s.desc}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Glossary */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            용어집 <span className="text-slate-400 font-normal text-xs">(선택사항)</span>
          </label>
          <p className="text-xs text-slate-400 mb-2">한 줄에 하나: <code className="bg-slate-100 px-1 rounded">원어=번역어</code></p>
          <textarea
            value={glossaryText}
            onChange={(e) => setGlossaryText(e.target.value)}
            placeholder={"machine learning=머신러닝\ndeep learning=딥러닝"}
            rows={3}
            className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-3.5 px-6 rounded-xl transition-colors text-base"
        >
          {isSubmitting ? '작업 생성 중...' : '번역 시작'}
        </button>
      </form>
    </div>
  );
}

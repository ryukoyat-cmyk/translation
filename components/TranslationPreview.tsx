'use client';

import { useState } from 'react';
import type { Chunk } from '@/types';

type TabType = 'original' | 'draft' | 'final';

interface TranslationPreviewProps {
  chunks: Chunk[];
  hasFinal: boolean;
}

const chunkStatusColors: Record<string, string> = {
  pending: 'bg-slate-100 text-slate-500',
  translating: 'bg-yellow-100 text-yellow-700',
  translated: 'bg-blue-100 text-blue-700',
  postprocessing: 'bg-purple-100 text-purple-700',
  completed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
};

const chunkStatusLabels: Record<string, string> = {
  pending: '대기',
  translating: '번역 중',
  translated: '번역 완료',
  postprocessing: '후검수 중',
  completed: '완료',
  failed: '실패',
};

export default function TranslationPreview({ chunks, hasFinal }: TranslationPreviewProps) {
  const [activeTab, setActiveTab] = useState<TabType>('draft');
  const [parallel, setParallel] = useState(false);

  const tabs: { id: TabType; label: string; disabled?: boolean }[] = [
    { id: 'original', label: '원문' },
    { id: 'draft', label: '번역 초안' },
    { id: 'final', label: '후처리본', disabled: !hasFinal },
  ];

  function getChunkText(chunk: Chunk, tab: TabType): string {
    if (tab === 'original') return chunk.original_text;
    if (tab === 'draft') return chunk.translated_text_draft || '';
    return chunk.translated_text_final || chunk.translated_text_draft || '';
  }

  if (chunks.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400">
        번역 결과가 아직 없습니다.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => !tab.disabled && setActiveTab(tab.id)}
              disabled={tab.disabled}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                tab.disabled
                  ? 'text-slate-300 cursor-not-allowed'
                  : activeTab === tab.id
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
          <input
            type="checkbox"
            checked={parallel}
            onChange={(e) => setParallel(e.target.checked)}
            className="rounded"
          />
          원문/번역 병렬 보기
        </label>
      </div>

      {/* Content */}
      <div className="space-y-4">
        {chunks.map((chunk) => (
          <div key={chunk.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            {/* Chunk header */}
            <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">#{chunk.chunk_index + 1}</span>
                {chunk.section_title && (
                  <span className="text-sm font-medium text-slate-700">{chunk.section_title}</span>
                )}
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${chunkStatusColors[chunk.status] || 'bg-slate-100 text-slate-500'}`}>
                {chunkStatusLabels[chunk.status] || chunk.status}
              </span>
            </div>

            {/* Chunk body */}
            {parallel && activeTab !== 'original' ? (
              <div className="grid grid-cols-2 divide-x divide-slate-100">
                <div className="p-4">
                  <div className="text-xs font-semibold text-blue-600 mb-2">원문</div>
                  <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                    {chunk.original_text}
                  </p>
                </div>
                <div className="p-4">
                  <div className="text-xs font-semibold text-green-600 mb-2">
                    {activeTab === 'final' ? '후처리본' : '번역 초안'}
                  </div>
                  {chunk.status === 'failed' ? (
                    <div className="text-sm text-red-500 italic">
                      번역 실패: {chunk.error_message || '알 수 없는 오류'}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                      {getChunkText(chunk, activeTab) || (
                        <span className="text-slate-300 italic">번역 대기 중...</span>
                      )}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-4">
                {activeTab !== 'original' && chunk.status === 'failed' ? (
                  <div className="text-sm text-red-500 italic">
                    번역 실패: {chunk.error_message || '알 수 없는 오류'}
                  </div>
                ) : (
                  <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                    {getChunkText(chunk, activeTab) || (
                      <span className="text-slate-300 italic">
                        {activeTab === 'original' ? '' : '번역 대기 중...'}
                      </span>
                    )}
                  </p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

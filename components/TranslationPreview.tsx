'use client';

import { useState } from 'react';
import type { Chunk } from '@/types';

type TabType = 'original' | 'draft' | 'final';

interface TranslationPreviewProps {
  chunks: Chunk[];
  hasFinal: boolean;
}

const statusColors: Record<string, string> = {
  pending: 'bg-slate-100 text-slate-500',
  translating: 'bg-yellow-100 text-yellow-700',
  translated: 'bg-blue-100 text-blue-700',
  postprocessing: 'bg-purple-100 text-purple-700',
  completed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
};

const statusLabels: Record<string, string> = {
  pending: '대기', translating: '번역 중', translated: '완료',
  postprocessing: '후검수 중', completed: '완료', failed: '실패',
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
    return <div className="text-center py-8 text-slate-400 text-sm">번역 결과가 아직 없습니다.</div>;
  }

  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="space-y-2">
        {/* Tabs */}
        <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => !tab.disabled && setActiveTab(tab.id)}
              disabled={tab.disabled}
              className={`flex-1 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors ${
                tab.disabled ? 'text-slate-300 cursor-not-allowed'
                : activeTab === tab.id ? 'bg-white text-blue-600 shadow-sm'
                : 'text-slate-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Parallel toggle — only when not on original tab */}
        {activeTab !== 'original' && (
          <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
            <input type="checkbox" checked={parallel} onChange={(e) => setParallel(e.target.checked)} className="rounded" />
            원문/번역 병렬 보기
          </label>
        )}
      </div>

      {/* Chunks */}
      <div className="space-y-3">
        {chunks.map((chunk) => (
          <div key={chunk.id} className="border border-slate-200 rounded-xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-100">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-xs text-slate-400 shrink-0">#{chunk.chunk_index + 1}</span>
                {chunk.section_title && (
                  <span className="text-xs font-medium text-slate-700 truncate">{chunk.section_title}</span>
                )}
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ml-2 ${statusColors[chunk.status] || 'bg-slate-100 text-slate-500'}`}>
                {statusLabels[chunk.status] || chunk.status}
              </span>
            </div>

            {/* Body */}
            {parallel && activeTab !== 'original' ? (
              <div className="flex flex-col sm:grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
                <div className="p-3">
                  <div className="text-xs font-semibold text-blue-600 mb-1.5">원문</div>
                  <p className="text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{chunk.original_text}</p>
                </div>
                <div className="p-3">
                  <div className="text-xs font-semibold text-green-600 mb-1.5">
                    {activeTab === 'final' ? '후처리본' : '번역 초안'}
                  </div>
                  {chunk.status === 'failed' ? (
                    <div className="text-xs text-red-500 italic">실패: {chunk.error_message || '알 수 없는 오류'}</div>
                  ) : (
                    <p className="text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                      {getChunkText(chunk, activeTab) || <span className="text-slate-300 italic">번역 대기 중...</span>}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-3">
                {activeTab !== 'original' && chunk.status === 'failed' ? (
                  <div className="text-xs text-red-500 italic">실패: {chunk.error_message || '알 수 없는 오류'}</div>
                ) : (
                  <p className="text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                    {getChunkText(chunk, activeTab) || (
                      activeTab !== 'original' && <span className="text-slate-300 italic">번역 대기 중...</span>
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

'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import ProgressBar from '@/components/ProgressBar';
import TranslationPreview from '@/components/TranslationPreview';
import type { Job, Chunk } from '@/types';

type PageStatus = 'loading' | 'processing' | 'done' | 'error';

export default function JobPage() {
  const params = useParams();
  const jobId = params.id as string;

  const [job, setJob] = useState<Job | null>(null);
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [pageStatus, setPageStatus] = useState<PageStatus>('loading');
  const [processStarted, setProcessStarted] = useState(false);
  const [postprocessing, setPostprocessing] = useState(false);
  const [postprocessProgress, setPostprocessProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const sseRef = useRef<{ cancel: () => void } | null>(null);

  const fetchJobData = useCallback(async () => {
    try {
      const [jobRes, resultRes] = await Promise.all([
        fetch(`/api/jobs/${jobId}`),
        fetch(`/api/jobs/${jobId}/result`),
      ]);
      const jobData = await jobRes.json();
      const resultData = await resultRes.json();
      if (jobData.job) setJob(jobData.job);
      if (resultData.chunks) setChunks(resultData.chunks);
      return jobData.job as Job | null;
    } catch {
      return null;
    }
  }, [jobId]);

  // Start processing via SSE
  const startProcessing = useCallback(async () => {
    if (processStarted) return;
    setProcessStarted(true);
    setPageStatus('processing');

    let cancelled = false;
    sseRef.current = { cancel: () => { cancelled = true; } };

    try {
      const res = await fetch(`/api/jobs/${jobId}/process`, { method: 'POST' });
      if (!res.body) throw new Error('No stream body');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done || cancelled) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const text = line.replace(/^data: /, '').trim();
          if (!text) continue;
          try {
            const event = JSON.parse(text);
            if (event.type === 'progress') {
              setJob((prev) => prev ? {
                ...prev,
                progress: event.progress ?? prev.progress,
                completed_chunks: event.completed ?? prev.completed_chunks,
                total_chunks: event.total ?? prev.total_chunks,
                status: event.status ?? prev.status,
              } : prev);
              // Refresh chunks periodically
              if ((event.completed ?? 0) % 3 === 0) {
                fetchJobData();
              }
            } else if (event.type === 'status') {
              setJob((prev) => prev ? { ...prev, status: event.status } : prev);
            } else if (event.type === 'complete') {
              await fetchJobData();
              setPageStatus('done');
            } else if (event.type === 'error') {
              setErrorMsg(event.message || '처리 중 오류가 발생했습니다.');
              await fetchJobData();
              setPageStatus('done');
            }
          } catch {
            // ignore parse errors
          }
        }
      }
    } catch (err) {
      setErrorMsg(String(err));
      setPageStatus('done');
    }

    // Final refresh
    await fetchJobData();
    setPageStatus('done');
  }, [jobId, processStarted, fetchJobData]);

  // Initial load
  useEffect(() => {
    fetchJobData().then((loadedJob) => {
      if (!loadedJob) {
        setPageStatus('error');
        return;
      }

      const isActive = ['queued', 'extracting', 'chunking', 'translating'].includes(loadedJob.status);
      const isDone = ['completed', 'failed'].includes(loadedJob.status);

      if (isDone) {
        setPageStatus('done');
      } else if (isActive && !processStarted) {
        startProcessing();
      } else {
        setPageStatus('processing');
      }
    });
  }, [fetchJobData, processStarted, startProcessing]);

  // Poll for updates when processing
  useEffect(() => {
    if (pageStatus === 'processing') {
      pollingRef.current = setInterval(fetchJobData, 3000);
    } else {
      if (pollingRef.current) clearInterval(pollingRef.current);
    }
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [pageStatus, fetchJobData]);

  async function handleRetry() {
    setErrorMsg('');
    try {
      const res = await fetch(`/api/jobs/${jobId}/retry`, { method: 'POST' });
      if (!res.ok) throw new Error('재시도 요청 실패');
      await fetchJobData();
    } catch (err) {
      setErrorMsg(String(err));
    }
  }

  async function handlePostprocess() {
    setPostprocessing(true);
    setPostprocessProgress(0);
    setErrorMsg('');

    try {
      const res = await fetch(`/api/jobs/${jobId}/postprocess`, { method: 'POST' });
      if (!res.body) throw new Error('No stream body');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const text = line.replace(/^data: /, '').trim();
          if (!text) continue;
          try {
            const event = JSON.parse(text);
            if (event.type === 'progress') {
              setPostprocessProgress(event.progress ?? 0);
            } else if (event.type === 'complete' || event.type === 'error') {
              await fetchJobData();
            }
          } catch { /* ignore */ }
        }
      }
    } catch (err) {
      setErrorMsg(String(err));
    }

    await fetchJobData();
    setPostprocessing(false);
  }

  function handleDownload(version: 'draft' | 'final') {
    window.open(`/api/jobs/${jobId}/export?version=${version}`, '_blank');
  }

  const failedChunks = chunks.filter((c) => c.status === 'failed');
  const hasFinal = chunks.some((c) => c.translated_text_final);
  const isTranslating = job && ['queued', 'extracting', 'chunking', 'translating'].includes(job.status);
  const isPostprocessing = job?.status === 'postprocessing';
  const isDone = job && ['completed', 'failed'].includes(job.status);

  if (pageStatus === 'loading') {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-slate-500">작업 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (pageStatus === 'error' || !job) {
    return (
      <div className="text-center py-24">
        <p className="text-red-500 font-medium">작업을 찾을 수 없습니다.</p>
        <a href="/" className="mt-4 inline-block text-blue-600 hover:underline">홈으로 돌아가기</a>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Job info */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800">
              {job.source_name || job.source_url || '번역 작업'}
            </h2>
            <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
              <span>{job.language_pair === 'en->ko' ? '영어 → 한국어' : '한국어 → 영어'}</span>
              <span>·</span>
              <span>{{ literal: '직역', natural: '자연스러운 번역', academic: '학술 문체', formal: '실무/공문' }[job.translation_style] || job.translation_style}</span>
              <span>·</span>
              <span>{new Date(job.created_at).toLocaleString('ko-KR')}</span>
            </div>
          </div>
          <a href="/" className="text-sm text-blue-600 hover:underline">새 번역</a>
        </div>

        <ProgressBar
          progress={job.progress}
          completed={job.completed_chunks}
          total={job.total_chunks}
          status={job.status}
        />

        {/* Postprocess progress */}
        {postprocessing && (
          <div className="mt-4">
            <ProgressBar
              progress={postprocessProgress}
              completed={0}
              total={0}
              status="postprocessing"
            />
          </div>
        )}

        {/* Errors */}
        {errorMsg && (
          <div className="mt-4 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
            {errorMsg}
          </div>
        )}

        {/* Failed chunks retry */}
        {failedChunks.length > 0 && (
          <div className="mt-4 flex items-center gap-3">
            <span className="text-sm text-red-600">{failedChunks.length}개 청크 실패</span>
            <button
              onClick={handleRetry}
              className="text-sm bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1.5 rounded-lg transition-colors"
            >
              실패 청크 재시도
            </button>
          </div>
        )}
      </div>

      {/* Actions */}
      {isDone && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <h3 className="font-semibold text-slate-800 mb-4">작업 실행</h3>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handlePostprocess}
              disabled={postprocessing || isPostprocessing}
              className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white font-medium px-5 py-2.5 rounded-lg text-sm transition-colors"
            >
              {postprocessing ? '후검수 진행 중...' : '후검수·용어통일 실행'}
            </button>
            <button
              onClick={() => handleDownload('draft')}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2.5 rounded-lg text-sm transition-colors"
            >
              초안 DOCX 다운로드
            </button>
            <button
              onClick={() => handleDownload('final')}
              disabled={!hasFinal}
              className="bg-green-600 hover:bg-green-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-medium px-5 py-2.5 rounded-lg text-sm transition-colors"
            >
              후처리본 DOCX 다운로드
            </button>
          </div>
          {!hasFinal && (
            <p className="text-xs text-slate-400 mt-2">후처리본은 후검수 실행 후 다운로드 가능합니다.</p>
          )}
        </div>
      )}

      {/* Preview */}
      {chunks.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <h3 className="font-semibold text-slate-800 mb-4">번역 미리보기</h3>
          <TranslationPreview chunks={chunks} hasFinal={hasFinal} />
        </div>
      )}

      {/* Empty state while processing */}
      {chunks.length === 0 && (isTranslating || pageStatus === 'processing') && (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 shadow-sm text-center">
          <div className="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-slate-500">번역을 진행하고 있습니다...</p>
        </div>
      )}
    </div>
  );
}

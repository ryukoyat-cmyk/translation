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
    } catch { return null; }
  }, [jobId]);

  const startProcessing = useCallback(async () => {
    if (processStarted) return;
    setProcessStarted(true);
    setPageStatus('processing');

    let cancelled = false;

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
              if ((event.completed ?? 0) % 3 === 0) fetchJobData();
            } else if (event.type === 'status') {
              setJob((prev) => prev ? { ...prev, status: event.status } : prev);
            } else if (event.type === 'complete' || event.type === 'error') {
              if (event.type === 'error') setErrorMsg(event.message || '처리 중 오류');
              await fetchJobData();
              setPageStatus('done');
            }
          } catch { /* ignore */ }
        }
      }
    } catch (err) {
      setErrorMsg(String(err));
    }

    await fetchJobData();
    setPageStatus('done');
  }, [jobId, processStarted, fetchJobData]);

  useEffect(() => {
    fetchJobData().then((loadedJob) => {
      if (!loadedJob) { setPageStatus('error'); return; }
      const isDone = ['completed', 'failed'].includes(loadedJob.status);
      const isActive = ['queued', 'extracting', 'chunking', 'translating'].includes(loadedJob.status);
      if (isDone) setPageStatus('done');
      else if (isActive && !processStarted) startProcessing();
      else setPageStatus('processing');
    });
  }, [fetchJobData, processStarted, startProcessing]);

  useEffect(() => {
    if (pageStatus === 'processing') {
      pollingRef.current = setInterval(fetchJobData, 3000);
    } else {
      if (pollingRef.current) clearInterval(pollingRef.current);
    }
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [pageStatus, fetchJobData]);

  async function handleRetry() {
    setErrorMsg('');
    try {
      const res = await fetch(`/api/jobs/${jobId}/retry`, { method: 'POST' });
      if (!res.ok) throw new Error('재시도 실패');
      setProcessStarted(false);
      await fetchJobData();
    } catch (err) { setErrorMsg(String(err)); }
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
            if (event.type === 'progress') setPostprocessProgress(event.progress ?? 0);
            else if (event.type === 'complete' || event.type === 'error') await fetchJobData();
          } catch { /* ignore */ }
        }
      }
    } catch (err) { setErrorMsg(String(err)); }
    await fetchJobData();
    setPostprocessing(false);
  }

  const failedChunks = chunks.filter((c) => c.status === 'failed');
  const hasFinal = chunks.some((c) => c.translated_text_final);
  const isDone = job && ['completed', 'failed'].includes(job.status);

  const styleLabel: Record<string, string> = {
    literal: '직역', natural: '자연스러운', academic: '학술 문체', formal: '실무/공문'
  };

  if (pageStatus === 'loading') {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-slate-500 text-sm">불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (pageStatus === 'error' || !job) {
    return (
      <div className="text-center py-24">
        <p className="text-red-500 font-medium">작업을 찾을 수 없습니다.</p>
        <a href="/" className="mt-4 inline-block text-blue-600 hover:underline text-sm">홈으로 돌아가기</a>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">

      {/* Job info card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-bold text-slate-800 truncate">
              {job.source_name || '번역 작업'}
            </h2>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-xs text-slate-500">
              <span>{job.language_pair === 'en->ko' ? '영어→한국어' : '한국어→영어'}</span>
              <span>·</span>
              <span>{styleLabel[job.translation_style] || job.translation_style}</span>
              <span>·</span>
              <span>{new Date(job.created_at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </div>
          <a href="/" className="text-xs text-blue-600 hover:underline shrink-0 mt-1">새 번역</a>
        </div>

        <ProgressBar progress={job.progress} completed={job.completed_chunks} total={job.total_chunks} status={job.status} />

        {postprocessing && (
          <div className="mt-3">
            <ProgressBar progress={postprocessProgress} completed={0} total={0} status="postprocessing" />
          </div>
        )}

        {errorMsg && (
          <div className="mt-3 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2.5 text-xs">
            {errorMsg}
          </div>
        )}

        {failedChunks.length > 0 && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs text-red-600">{failedChunks.length}개 청크 실패</span>
            <button onClick={handleRetry}
              className="text-xs bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1.5 rounded-lg transition-colors">
              재시도
            </button>
          </div>
        )}
      </div>

      {/* Actions */}
      {isDone && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm">
          <h3 className="font-semibold text-slate-800 mb-3 text-sm">작업 실행</h3>
          <div className="flex flex-col gap-2">
            <button onClick={handlePostprocess} disabled={postprocessing}
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white font-medium px-4 py-3 rounded-xl text-sm transition-colors">
              {postprocessing ? '후검수 진행 중...' : '후검수·용어통일 실행'}
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => window.open(`/api/jobs/${jobId}/export?version=draft`, '_blank')}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-3 py-3 rounded-xl text-xs sm:text-sm transition-colors">
                초안 DOCX
              </button>
              <button onClick={() => window.open(`/api/jobs/${jobId}/export?version=final`, '_blank')}
                disabled={!hasFinal}
                className="bg-green-600 hover:bg-green-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-medium px-3 py-3 rounded-xl text-xs sm:text-sm transition-colors">
                후처리본 DOCX
              </button>
            </div>
          </div>
          {!hasFinal && (
            <p className="text-xs text-slate-400 mt-2">후처리본은 후검수 실행 후 다운로드 가능합니다.</p>
          )}
        </div>
      )}

      {/* Preview */}
      {chunks.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm">
          <h3 className="font-semibold text-slate-800 mb-3 text-sm">번역 미리보기</h3>
          <TranslationPreview chunks={chunks} hasFinal={hasFinal} />
        </div>
      )}

      {chunks.length === 0 && pageStatus === 'processing' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 shadow-sm text-center">
          <div className="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-slate-500 text-sm">번역을 진행하고 있습니다...</p>
        </div>
      )}
    </div>
  );
}

interface ProgressBarProps {
  progress: number;
  completed: number;
  total: number;
  status: string;
}

const statusLabels: Record<string, string> = {
  queued: '대기 중',
  extracting: '텍스트 추출 중',
  chunking: '청크 분할 중',
  translating: '번역 중',
  postprocessing: '후검수 중',
  exporting: '파일 생성 중',
  completed: '완료',
  failed: '실패',
};

const statusColors: Record<string, string> = {
  queued: 'bg-slate-400',
  extracting: 'bg-yellow-500',
  chunking: 'bg-yellow-500',
  translating: 'bg-blue-500',
  postprocessing: 'bg-purple-500',
  exporting: 'bg-indigo-500',
  completed: 'bg-green-500',
  failed: 'bg-red-500',
};

export default function ProgressBar({ progress, completed, total, status }: ProgressBarProps) {
  const label = statusLabels[status] || status;
  const color = statusColors[status] || 'bg-blue-500';

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white ${color}`}>
            {label}
          </span>
          {total > 0 && (
            <span className="text-sm text-slate-500">
              {completed} / {total} 청크
            </span>
          )}
        </div>
        <span className="text-sm font-semibold text-slate-700">{progress}%</span>
      </div>
      <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
        <div
          className={`h-full rounded-full progress-bar-fill ${color}`}
          style={{ width: `${Math.min(100, progress)}%` }}
        />
      </div>
    </div>
  );
}

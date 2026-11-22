import React from 'react';
import { MatchReportUI } from './TacticalReport';

interface PostMatchRecapToastProps {
  isOpen: boolean;
  gameType: 'VALORANT' | 'PUBG';
  mapName: string;
  matchResult: string;
  scoreSummary?: string | null;
  report: MatchReportUI | null;
  onClose: () => void;
}

export const PostMatchRecapToast: React.FC<PostMatchRecapToastProps> = ({
  isOpen,
  gameType,
  mapName,
  matchResult,
  scoreSummary,
  report,
  onClose,
}) => {
  if (!isOpen || !mapName) return null;

  const isValo = gameType === 'VALORANT';
  const topWeaknesses = report?.weaknessesSummary?.slice(0, 3) || [];

  return (
    <div className="fixed bottom-5 left-5 z-40 w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900/95 p-4 shadow-2xl backdrop-blur-xs space-y-3">
      <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-2.5">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`rounded px-2 py-0.5 text-[10px] font-extrabold ${
                isValo
                  ? 'bg-[#ff4655]/20 text-[#ff4655]'
                  : 'bg-amber-500/20 text-amber-300'
              }`}
            >
              POST-MATCH RECAP • {gameType}
            </span>
            {report && (
              <span className="text-xs font-extrabold text-emerald-400">
                Điểm AI: {report.overallScore}/100
              </span>
            )}
          </div>
          <h3 className="mt-1 text-sm font-extrabold text-white">
            {mapName} • {matchResult}{' '}
            {scoreSummary ? <span className="text-slate-400 font-normal">({scoreSummary})</span> : ''}
          </h3>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="rounded-lg bg-slate-800 hover:bg-slate-700 px-2.5 py-1 text-xs text-slate-300"
        >
          Đóng
        </button>
      </div>

      {report?.coachCommentary && (
        <p className="text-xs text-slate-300 leading-relaxed">{report.coachCommentary}</p>
      )}

      {topWeaknesses.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
            3 lưu ý nhanh trước trận tiếp theo:
          </p>
          <ul className="space-y-1 text-xs text-slate-300">
            {topWeaknesses.map((w, idx) => (
              <li
                key={idx}
                className="rounded-lg bg-slate-950/90 border border-slate-800 px-2.5 py-1.5"
              >
                • {w}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-xs text-slate-400">
          Trận đấu giữ nhịp độ ổn định. Hãy kiểm tra thêm từng mốc giao tranh ở cột bên phải.
        </p>
      )}
    </div>
  );
};
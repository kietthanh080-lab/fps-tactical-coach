import React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { WarningCircle, X } from '@phosphor-icons/react';
import { useI18n } from '../i18n';
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
  const { tr, ts } = useI18n();
  const reduceMotion = useReducedMotion();
  const isValo = gameType === 'VALORANT';
  const topWeaknesses = report?.weaknessesSummary?.slice(0, 3) || [];

  return (
    <AnimatePresence>
      {isOpen && mapName && (
        <motion.aside
          aria-label={tr('Post-match quick recap', 'Tóm tắt nhanh sau trận đấu')}
          initial={reduceMotion ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
          transition={{ type: 'spring', stiffness: 280, damping: 24 }}
          className="fixed bottom-10 left-5 z-40 w-[calc(100vw-2.5rem)] max-w-md rounded-[4px] border border-[#334155] bg-[#10141C] p-4 shadow-2xl space-y-3"
        >
          <div className="flex items-start justify-between gap-3 border-b border-[#232B3B] pb-2.5">
            <div>
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-[2px] px-2 py-0.5 font-mono text-[10px] font-bold border ${
                    isValo
                      ? 'bg-[#FF4655]/15 border-[#FF4655]/40 text-[#FF4655]'
                      : 'bg-[#E59A23]/15 border-[#E59A23]/40 text-[#E59A23]'
                  }`}
                >
                  {tr('POST-MATCH RECAP', 'TÓM TẮT TRẬN')} - {gameType}
                </span>
                {report && (
                  <span className="font-mono text-xs font-bold text-[#10B981] tabular-nums">
                    AI: {report.overallScore}/10
                  </span>
                )}
              </div>
              <h3 className="font-display mt-1.5 text-sm font-bold text-[#EEF2F6]">
                {mapName} - {matchResult}{' '}
                {scoreSummary ? (
                  <span className="font-mono text-xs text-[#94A3B8] font-normal">
                    ({scoreSummary})
                  </span>
                ) : null}
              </h3>
            </div>

            <button
              type="button"
              aria-label={tr('Close post-match recap', 'Đóng tóm tắt trận đấu')}
              onClick={onClose}
              className="rounded-[2px] bg-[#171D28] hover:bg-[#232B3B] border border-[#232B3B] p-1.5 text-[#94A3B8] hover:text-[#EEF2F6] transition duration-150"
            >
              <X size={14} weight="bold" aria-hidden="true" />
            </button>
          </div>

          {report?.coachCommentary && (
            <p className="text-xs text-[#94A3B8] leading-relaxed max-w-[65ch]">
              {ts(report.coachCommentary)}
            </p>
          )}

          {topWeaknesses.length > 0 ? (
            <div className="space-y-1.5">
              <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#E59A23] flex items-center gap-1.5">
                <WarningCircle size={12} weight="bold" aria-hidden="true" />
                <span>
                  {tr('Top 3 Takeaways Before Next Queue', '3 lưu ý nhanh trước trận tiếp theo')}
                </span>
              </p>
              <ul className="space-y-1 text-xs text-[#EEF2F6]">
                {topWeaknesses.map((w, idx) => (
                  <li
                    key={idx}
                    className="rounded-[2px] bg-[#0A0D12] border border-[#232B3B] px-2.5 py-1.5 leading-snug"
                  >
                    {ts(w)}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-xs text-[#94A3B8]">
              {tr(
                'Steady match pacing. Inspect individual rounds/phases in the right panel.',
                'Trận đấu giữ nhịp độ ổn định. Kiểm tra thêm từng mốc giao tranh ở cột bên phải.'
              )}
            </p>
          )}
        </motion.aside>
      )}
    </AnimatePresence>
  );
};

import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Trophy, X } from '@phosphor-icons/react';
import { fetchLeaderboard } from '../services/localDb';

export interface LeaderboardEntry {
  userId: number;
  displayName: string;
  avatarUrl: string | null;
  totalMatches: number;
  winsOrTop1: number;
  top10Count: number;
  avgKills: number;
  avgDamage: number;
  highlightCount: number;
}

interface FriendsLeaderboardProps {
  isOpen: boolean;
  initialGame: 'VALORANT' | 'PUBG';
  currentUserId?: number;
  onClose: () => void;
}

export const FriendsLeaderboard: React.FC<FriendsLeaderboardProps> = ({
  isOpen,
  initialGame,
  currentUserId,
  onClose,
}) => {
  const reduceMotion = useReducedMotion();
  const [gameTab, setGameTab] = useState<'VALORANT' | 'PUBG'>(initialGame);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setGameTab(initialGame);
  }, [initialGame]);

  useEffect(() => {
    if (!isOpen) return;

    const loadLeaderboard = async () => {
      setLoading(true);
      setErrorMsg(null);
      try {
        const data = await fetchLeaderboard(gameTab);
        setEntries(data.leaderboard || []);
      } catch (err: any) {
        setErrorMsg(err.message || 'Lỗi kết nối bảng xếp hạng.');
      } finally {
        setLoading(false);
      }
    };

    void loadLeaderboard();
  }, [isOpen, gameTab]);

  const isValo = gameTab === 'VALORANT';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="leaderboard-modal-title"
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0A0D12]/85 p-4 backdrop-blur-sm"
        >
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, scale: 0.98, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98, y: 8 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            className="w-full max-w-4xl rounded-[4px] border border-[#334155] bg-[#10141C] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#232B3B] px-6 py-4 bg-[#0A0D12]">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-[2px] bg-[#E59A23]/15 border border-[#E59A23]/40 text-[#E59A23] flex items-center justify-center">
                  <Trophy size={16} weight="bold" aria-hidden="true" />
                </div>
                <div>
                  <h2
                    id="leaderboard-modal-title"
                    className="font-display text-base font-bold text-[#EEF2F6]"
                  >
                    Bảng xếp hạng &amp; So sánh thành tích nhóm
                  </h2>
                  <p className="text-xs text-[#94A3B8]">
                    Tổng hợp phong độ từ 20 trận gần nhất của các thành viên trong hệ thống
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex p-1 rounded-[2px] bg-[#10141C] border border-[#232B3B]">
                  <button
                    type="button"
                    onClick={() => setGameTab('VALORANT')}
                    className={`px-3.5 py-1.5 rounded-[2px] font-mono text-xs font-bold transition duration-150 ${
                      isValo ? 'bg-[#FF4655] text-[#EEF2F6]' : 'text-[#94A3B8] hover:text-[#EEF2F6]'
                    }`}
                  >
                    VALORANT
                  </button>
                  <button
                    type="button"
                    onClick={() => setGameTab('PUBG')}
                    className={`px-3.5 py-1.5 rounded-[2px] font-mono text-xs font-bold transition duration-150 ${
                      !isValo ? 'bg-[#E59A23] text-[#0A0D12]' : 'text-[#94A3B8] hover:text-[#EEF2F6]'
                    }`}
                  >
                    PUBG
                  </button>
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Đóng bảng xếp hạng"
                  className="inline-flex items-center gap-1 rounded-[2px] bg-[#171D28] hover:bg-[#232B3B] border border-[#232B3B] px-3 py-1.5 text-xs font-semibold text-[#94A3B8] hover:text-[#EEF2F6]"
                >
                  <X size={14} weight="bold" aria-hidden="true" />
                  <span>Đóng</span>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto tactical-scrollbar p-6">
              {loading ? (
                <div className="space-y-2.5 py-4">
                  {[1, 2, 3, 4].map((row) => (
                    <div
                      key={row}
                      className="h-11 w-full rounded-[2px] bg-[#171D28] animate-pulse border border-[#232B3B]"
                    />
                  ))}
                </div>
              ) : errorMsg ? (
                <div className="rounded-[2px] border border-[#F43F5E]/40 bg-[#F43F5E]/10 p-4 text-center text-xs text-[#F43F5E]">
                  {errorMsg}
                </div>
              ) : entries.length === 0 ? (
                <p className="py-10 text-center text-xs text-[#64748B]">
                  Chưa có dữ liệu trận đấu {gameTab} nào để xếp hạng.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#232B3B] font-mono text-[11px] font-bold uppercase tracking-wider text-[#94A3B8]">
                        <th className="py-3 px-3">Hạng</th>
                        <th className="py-3 px-3">Người chơi</th>
                        <th className="py-3 px-3 text-center">Số trận</th>
                        <th className="py-3 px-3 text-center">
                          {isValo ? 'Trận thắng' : 'Top #1'}
                        </th>
                        {!isValo && <th className="py-3 px-3 text-center">Top 10</th>}
                        <th className="py-3 px-3 text-center">Kills TB</th>
                        <th className="py-3 px-3 text-center">Sát thương TB</th>
                        <th className="py-3 px-3 text-center">Highlight</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#232B3B]/70 text-xs">
                      {entries.map((item, idx) => {
                        const isMe = currentUserId === item.userId;
                        const rankBadge =
                          idx === 0
                            ? 'bg-[#E59A23]/20 text-[#E59A23] border-[#E59A23]/50'
                            : idx === 1
                            ? 'bg-slate-300/15 text-slate-200 border-slate-400/40'
                            : idx === 2
                            ? 'bg-orange-500/15 text-orange-300 border-orange-500/40'
                            : 'bg-[#0A0D12] text-[#94A3B8] border-[#232B3B]';

                        return (
                          <tr
                            key={item.userId}
                            className={`transition duration-150 ${
                              isMe ? 'bg-[#38BDF8]/10' : 'hover:bg-[#171D28]'
                            }`}
                          >
                            <td className="py-3 px-3">
                              <span
                                className={`inline-flex h-6 w-7 items-center justify-center rounded-[2px] border font-mono font-bold text-[11px] tabular-nums ${rankBadge}`}
                              >
                                #{idx + 1}
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-2.5">
                                {item.avatarUrl ? (
                                  <img
                                    src={item.avatarUrl}
                                    alt={`Ảnh đại diện của ${item.displayName}`}
                                    className="h-7 w-7 rounded-[2px] border border-[#334155]"
                                  />
                                ) : (
                                  <div className="flex h-7 w-7 items-center justify-center rounded-[2px] bg-[#171D28] border border-[#232B3B] font-mono text-[11px] font-bold text-[#94A3B8]">
                                    {item.displayName.slice(0, 2).toUpperCase()}
                                  </div>
                                )}
                                <span className="font-bold text-[#EEF2F6]">
                                  {item.displayName}{' '}
                                  {isMe && (
                                    <span className="ml-1 rounded-[2px] bg-[#38BDF8]/15 border border-[#38BDF8]/40 px-1.5 py-0.5 font-mono text-[10px] text-[#38BDF8]">
                                      BẠN
                                    </span>
                                  )}
                                </span>
                              </div>
                            </td>
                            <td className="py-3 px-3 text-center font-mono text-[#94A3B8] tabular-nums">
                              {item.totalMatches}
                            </td>
                            <td className="py-3 px-3 text-center font-mono font-bold text-[#10B981] tabular-nums">
                              {item.winsOrTop1}
                            </td>
                            {!isValo && (
                              <td className="py-3 px-3 text-center font-mono font-bold text-[#E59A23] tabular-nums">
                                {item.top10Count}
                              </td>
                            )}
                            <td className="py-3 px-3 text-center font-mono font-bold text-[#EEF2F6] tabular-nums">
                              {item.avgKills.toFixed(1)}
                            </td>
                            <td className="py-3 px-3 text-center font-mono text-[#E59A23] tabular-nums">
                              {Math.round(item.avgDamage)}
                            </td>
                            <td className="py-3 px-3 text-center">
                              <span className="rounded-[2px] bg-[#10B981]/10 border border-[#10B981]/30 px-2 py-0.5 font-mono text-[11px] font-semibold text-[#10B981] tabular-nums">
                                {item.highlightCount} clip
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

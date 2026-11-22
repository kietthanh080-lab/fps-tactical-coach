import React, { useEffect, useState } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

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
        const storedToken =
          localStorage.getItem('tactical_replay_token') || localStorage.getItem('token') || '';

        const res = await fetch(`${API_BASE_URL}/analyze/leaderboard?gameType=${gameTab}`, {
          headers: storedToken ? { Authorization: `Bearer ${storedToken}` } : undefined,
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Không thể tải bảng xếp hạng.');
        setEntries(data.leaderboard || []);
      } catch (err: any) {
        setErrorMsg(err.message || 'Lỗi kết nối bảng xếp hạng.');
      } finally {
        setLoading(false);
      }
    };

    void loadLeaderboard();
  }, [isOpen, gameTab]);

  if (!isOpen) return null;

  const isValo = gameTab === 'VALORANT';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs">
      <div className="w-full max-w-4xl rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-6 py-4 bg-slate-950/70">
          <div>
            <h2 className="text-base font-extrabold text-white">
              Bảng xếp hạng &amp; So sánh thành tích nhóm
            </h2>
            <p className="text-xs text-slate-400">
              Tổng hợp phong độ từ 20 trận gần nhất của các thành viên trong hệ thống
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex p-1 rounded-xl bg-slate-950 border border-slate-800">
              <button
                type="button"
                onClick={() => setGameTab('VALORANT')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition ${
                  isValo ? 'bg-[#ff4655] text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                VALORANT
              </button>
              <button
                type="button"
                onClick={() => setGameTab('PUBG')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition ${
                  !isValo ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                PUBG
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300"
            >
              Đóng
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <p className="py-10 text-center text-xs text-slate-400">
              Đang tổng hợp chỉ số của các thành viên...
            </p>
          ) : errorMsg ? (
            <div className="rounded-xl border border-rose-800/60 bg-rose-950/40 p-4 text-center text-xs text-rose-300">
              {errorMsg}
            </div>
          ) : entries.length === 0 ? (
            <p className="py-10 text-center text-xs text-slate-500">
              Chưa có dữ liệu trận đấu {gameTab} nào để xếp hạng.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400">
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
                <tbody className="divide-y divide-slate-800/70 text-xs">
                  {entries.map((item, idx) => {
                    const isMe = currentUserId === item.userId;
                    const rankBadge =
                      idx === 0
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : idx === 1
                        ? 'bg-slate-300/20 text-slate-200 border-slate-400/40'
                        : idx === 2
                        ? 'bg-orange-500/20 text-orange-300 border-orange-500/40'
                        : 'bg-slate-800 text-slate-400 border-slate-700';

                    return (
                      <tr
                        key={item.userId}
                        className={`transition ${
                          isMe ? 'bg-sky-500/10' : 'hover:bg-slate-800/40'
                        }`}
                      >
                        <td className="py-3 px-3">
                          <span
                            className={`inline-flex h-6 w-6 items-center justify-center rounded-md border font-extrabold text-[11px] ${rankBadge}`}
                          >
                            #{idx + 1}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2.5">
                            {item.avatarUrl ? (
                              <img
                                src={item.avatarUrl}
                                alt={item.displayName}
                                className="h-7 w-7 rounded-full border border-slate-700"
                              />
                            ) : (
                              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 text-[11px] font-bold text-slate-300">
                                {item.displayName.slice(0, 2).toUpperCase()}
                              </div>
                            )}
                            <span className="font-bold text-white">
                              {item.displayName}{' '}
                              {isMe && (
                                <span className="ml-1 rounded bg-sky-500/20 px-1.5 py-0.5 text-[10px] text-sky-300">
                                  Bạn
                                </span>
                              )}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-center font-mono text-slate-300">
                          {item.totalMatches}
                        </td>
                        <td className="py-3 px-3 text-center font-bold text-emerald-400">
                          {item.winsOrTop1}
                        </td>
                        {!isValo && (
                          <td className="py-3 px-3 text-center font-semibold text-amber-300">
                            {item.top10Count}
                          </td>
                        )}
                        <td className="py-3 px-3 text-center font-mono font-bold text-white">
                          {item.avgKills.toFixed(1)}
                        </td>
                        <td className="py-3 px-3 text-center font-mono text-amber-400">
                          {Math.round(item.avgDamage)}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-400">
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
      </div>
    </div>
  );
};
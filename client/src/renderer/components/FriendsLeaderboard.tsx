import React, { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Check, Copy, Plus, SignOut, Trophy, UsersThree, X } from '@phosphor-icons/react';
import { useI18n } from '../i18n';
import {
  createSquad,
  fetchLeaderboard,
  fetchSquads,
  joinSquad,
  leaveSquad,
  SquadInfo,
} from '../services/localDb';

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
  const { tr, ts } = useI18n();
  const reduceMotion = useReducedMotion();
  const [gameTab, setGameTab] = useState<'VALORANT' | 'PUBG'>(initialGame);
  const [squads, setSquads] = useState<SquadInfo[]>([]);
  const [selectedSquadId, setSelectedSquadId] = useState<number | null>(null);

  const [newSquadName, setNewSquadName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [squadActionBusy, setSquadActionBusy] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setGameTab(initialGame);
  }, [initialGame]);

  const refreshSquads = useCallback(async () => {
    try {
      const data = await fetchSquads();
      const list = data.squads || [];
      setSquads(list);
      setSelectedSquadId((prev) => {
        if (prev && list.some((s) => s.id === prev)) return prev;
        return list.length > 0 ? list[0].id : null;
      });
    } catch {
      // Keep current list on temporary failure
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    void refreshSquads();
  }, [isOpen, refreshSquads]);

  useEffect(() => {
    if (!isOpen) return;

    const loadLeaderboard = async () => {
      setLoading(true);
      setErrorMsg(null);
      try {
        const data = await fetchLeaderboard(gameTab, selectedSquadId);
        setEntries(data.leaderboard || []);
      } catch (err: any) {
        setErrorMsg(
          ts(err.message, 'Failed to load leaderboard.', 'Lỗi kết nối bảng xếp hạng.')
        );
      } finally {
        setLoading(false);
      }
    };

    void loadLeaderboard();
  }, [isOpen, gameTab, selectedSquadId, ts]);

  const handleCreateSquad = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSquadName.trim() || squadActionBusy) return;
    setSquadActionBusy(true);
    setErrorMsg(null);
    try {
      const res = await createSquad(newSquadName.trim());
      setNewSquadName('');
      await refreshSquads();
      if (res.squad?.id) setSelectedSquadId(res.squad.id);
    } catch (err: any) {
      setErrorMsg(ts(err.message, 'Could not create Squad.', 'Không thể tạo Squad.'));
    } finally {
      setSquadActionBusy(false);
    }
  };

  const handleJoinSquad = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim() || squadActionBusy) return;
    setSquadActionBusy(true);
    setErrorMsg(null);
    try {
      const res = await joinSquad(joinCode.trim());
      setJoinCode('');
      await refreshSquads();
      if (res.squad?.id) setSelectedSquadId(res.squad.id);
    } catch (err: any) {
      setErrorMsg(ts(err.message, 'Could not join Squad.', 'Không thể tham gia Squad.'));
    } finally {
      setSquadActionBusy(false);
    }
  };

  const handleLeaveSelectedSquad = async () => {
    if (!selectedSquadId || squadActionBusy) return;
    setSquadActionBusy(true);
    setErrorMsg(null);
    try {
      await leaveSquad(selectedSquadId);
      setSelectedSquadId(null);
      await refreshSquads();
    } catch (err: any) {
      setErrorMsg(ts(err.message, 'Could not leave Squad.', 'Không thể rời Squad.'));
    } finally {
      setSquadActionBusy(false);
    }
  };

  const activeSquad = squads.find((s) => s.id === selectedSquadId) || null;
  const isValo = gameTab === 'VALORANT';

  const handleCopySquadCode = async () => {
    if (!activeSquad?.code) return;
    await navigator.clipboard.writeText(activeSquad.code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

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
            className="w-full max-w-4xl rounded-[4px] border border-[#334155] bg-[#10141C] shadow-2xl overflow-hidden flex flex-col max-h-[88vh]"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#232B3B] px-6 py-4 bg-[#0A0D12]">
              <div className="flex items-center gap-3">
                <div
                  className={`h-8 w-8 rounded-[2px] flex items-center justify-center border ${
                    isValo
                      ? 'bg-[#FF4655]/15 border-[#FF4655]/40 text-[#FF4655] theme-cut-valo'
                      : 'bg-[#E59A23]/15 border-[#E59A23]/40 text-[#E59A23]'
                  }`}
                >
                  <Trophy size={16} weight="bold" aria-hidden="true" />
                </div>
                <div>
                  <h2
                    id="leaderboard-modal-title"
                    className="font-display text-base font-bold text-[#EEF2F6]"
                  >
                    {tr('Private Squad Leaderboard', 'Bảng xếp hạng Squad riêng tư')}
                  </h2>
                  <p className="text-xs text-[#94A3B8]">
                    {tr(
                      'Compare last 20-match performance across members in your private Squad',
                      'Chỉ so sánh thành tích 20 trận gần nhất giữa các thành viên trong Squad của bạn'
                    )}
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
                  aria-label={tr('Close leaderboard modal', 'Đóng bảng xếp hạng')}
                  className="inline-flex items-center gap-1 rounded-[2px] bg-[#171D28] hover:bg-[#232B3B] border border-[#232B3B] px-3 py-1.5 text-xs font-semibold text-[#94A3B8] hover:text-[#EEF2F6]"
                >
                  <X size={14} weight="bold" aria-hidden="true" />
                  <span>{tr('Close', 'Đóng')}</span>
                </button>
              </div>
            </div>

            <div className="border-b border-[#232B3B] bg-[#0A0D12]/60 px-6 py-3.5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSelectedSquadId(null)}
                    className={`px-3 py-1.5 rounded-[2px] font-mono text-xs font-bold border transition duration-150 ${
                      selectedSquadId === null
                        ? 'bg-[#38BDF8]/15 border-[#38BDF8] text-[#38BDF8]'
                        : 'bg-[#10141C] border-[#232B3B] text-[#94A3B8] hover:text-[#EEF2F6]'
                    }`}
                  >
                    {tr('Only Me', 'Chỉ mình tôi')}
                  </button>

                  {squads.map((sq) => (
                    <button
                      key={sq.id}
                      type="button"
                      onClick={() => setSelectedSquadId(sq.id)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[2px] font-mono text-xs font-bold border transition duration-150 ${
                        selectedSquadId === sq.id
                          ? 'bg-[#10B981]/15 border-[#10B981] text-[#10B981]'
                          : 'bg-[#10141C] border-[#232B3B] text-[#94A3B8] hover:text-[#EEF2F6]'
                      }`}
                    >
                      <UsersThree size={13} weight="bold" aria-hidden="true" />
                      <span>{sq.name}</span>
                      <span className="text-[10px] opacity-75">({sq.memberCount})</span>
                    </button>
                  ))}
                </div>

                {activeSquad && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void handleCopySquadCode()}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[2px] bg-[#171D28] hover:bg-[#232B3B] border border-[#232B3B] font-mono text-xs text-[#38BDF8]"
                    >
                      {copiedCode ? (
                        <Check size={13} weight="bold" aria-hidden="true" />
                      ) : (
                        <Copy size={13} weight="bold" aria-hidden="true" />
                      )}
                      <span>
                        {copiedCode
                          ? tr('Copied!', 'Đã chép mã!')
                          : `${tr('Invite', 'Mã mời')}: ${activeSquad.code}`}
                      </span>
                    </button>

                    <button
                      type="button"
                      disabled={squadActionBusy}
                      onClick={() => void handleLeaveSelectedSquad()}
                      title={tr('Leave this Squad', 'Rời Squad này')}
                      aria-label={
                        tr(`Leave Squad ${activeSquad.name}`, `Rời Squad ${activeSquad.name}`)
                      }
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[2px] bg-[#171D28] hover:bg-[#F43F5E]/15 border border-[#232B3B] hover:border-[#F43F5E]/40 text-xs text-[#F43F5E]"
                    >
                      <SignOut size={13} weight="bold" aria-hidden="true" />
                      <span>{tr('Leave', 'Rời')}</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                <form onSubmit={(e) => void handleCreateSquad(e)} className="flex gap-1.5">
                  <label htmlFor="new-squad-name" className="sr-only">
                    {tr('New Squad Name', 'Tên Squad mới')}
                  </label>
                  <input
                    id="new-squad-name"
                    type="text"
                    value={newSquadName}
                    onChange={(e) => setNewSquadName(e.target.value)}
                    placeholder={tr(
                      'New Squad name (e.g. Radiant Five)...',
                      'Tên Squad mới (VD: Team Ha Noi)...'
                    )}
                    className="flex-1 min-w-0 px-3 py-1.5 rounded-[2px] bg-[#10141C] border border-[#232B3B] text-xs text-[#EEF2F6] placeholder:text-[#64748B] focus:outline-none focus:border-[#10B981]"
                  />
                  <button
                    type="submit"
                    disabled={squadActionBusy || !newSquadName.trim()}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-[2px] bg-[#10B981] hover:bg-emerald-400 text-[#0A0D12] font-bold text-xs disabled:opacity-40 shrink-0"
                  >
                    <Plus size={13} weight="bold" aria-hidden="true" />
                    <span>{tr('Create Squad', 'Tạo Squad')}</span>
                  </button>
                </form>

                <form onSubmit={(e) => void handleJoinSquad(e)} className="flex gap-1.5">
                  <label htmlFor="join-squad-code" className="sr-only">
                    {tr('Squad Invite Code', 'Mã mời tham gia Squad')}
                  </label>
                  <input
                    id="join-squad-code"
                    type="text"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value)}
                    placeholder={tr(
                      'Enter invite code (e.g. TR-A1B2C3)...',
                      'Nhập mã mời (VD: TR-A1B2C3)...'
                    )}
                    className="flex-1 min-w-0 px-3 py-1.5 rounded-[2px] bg-[#10141C] border border-[#232B3B] text-xs font-mono uppercase text-[#EEF2F6] placeholder:text-[#64748B] focus:outline-none focus:border-[#38BDF8]"
                  />
                  <button
                    type="submit"
                    disabled={squadActionBusy || !joinCode.trim()}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-[2px] bg-[#38BDF8] hover:bg-sky-300 text-[#0A0D12] font-bold text-xs disabled:opacity-40 shrink-0"
                  >
                    <span>{tr('Join', 'Tham gia')}</span>
                  </button>
                </form>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto tactical-scrollbar p-6">
              {loading ? (
                <div className="space-y-2.5">
                  {[1, 2, 3].map((n) => (
                    <div
                      key={n}
                      className="h-12 rounded-[2px] bg-[#0A0D12] border border-[#232B3B] animate-pulse"
                    />
                  ))}
                </div>
              ) : errorMsg ? (
                <div className="rounded-[2px] border border-[#F43F5E]/40 bg-[#F43F5E]/10 p-4 text-xs text-[#F43F5E]">
                  {errorMsg}
                </div>
              ) : entries.length === 0 ? (
                <p className="py-10 text-center text-xs text-[#64748B]">
                  {tr(
                    `No ${gameTab} matches recorded for the selected scope yet.`,
                    `Chưa có dữ liệu trận đấu ${gameTab} nào trong phạm vi đang chọn.`
                  )}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#232B3B] font-mono text-[11px] font-bold uppercase tracking-wider text-[#94A3B8]">
                        <th className="py-3 px-3">{tr('Rank', 'Hạng')}</th>
                        <th className="py-3 px-3">{tr('Player', 'Người chơi')}</th>
                        <th className="py-3 px-3 text-center">{tr('Matches', 'Số trận')}</th>
                        <th className="py-3 px-3 text-center">
                          {isValo ? tr('Wins', 'Trận thắng') : 'Top #1'}
                        </th>
                        {!isValo && <th className="py-3 px-3 text-center">Top 10</th>}
                        <th className="py-3 px-3 text-center">{tr('Avg Kills', 'Kills TB')}</th>
                        <th className="py-3 px-3 text-center">{tr('Avg DMG', 'Sát thương TB')}</th>
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
                            className={
                              isMe ? 'bg-[#38BDF8]/8 font-semibold' : 'hover:bg-[#171D28]/60'
                            }
                          >
                            <td className="py-3 px-3 font-mono">
                              <span
                                className={`inline-flex h-6 w-6 items-center justify-center rounded-[2px] border text-[11px] font-bold ${rankBadge}`}
                              >
                                {idx + 1}
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-2.5">
                                {item.avatarUrl ? (
                                  <img
                                    src={item.avatarUrl}
                                    alt={`${item.displayName} avatar`}
                                    className="h-6 w-6 rounded-[2px]"
                                  />
                                ) : (
                                  <div className="h-6 w-6 rounded-[2px] bg-[#171D28] border border-[#232B3B] flex items-center justify-center font-mono text-[10px] text-[#94A3B8]">
                                    {item.displayName.slice(0, 2).toUpperCase()}
                                  </div>
                                )}
                                <span className="font-display font-bold text-[#EEF2F6]">
                                  {item.displayName}
                                </span>
                                {isMe && (
                                  <span className="px-1.5 py-0.5 rounded-[2px] bg-[#38BDF8]/15 border border-[#38BDF8]/40 font-mono text-[9px] font-bold text-[#38BDF8]">
                                    {tr('YOU', 'BẠN')}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-3 text-center font-mono tabular-nums text-[#94A3B8]">
                              {item.totalMatches}
                            </td>
                            <td className="py-3 px-3 text-center font-mono tabular-nums font-bold text-[#10B981]">
                              {item.winsOrTop1}
                            </td>
                            {!isValo && (
                              <td className="py-3 px-3 text-center font-mono tabular-nums text-[#EEF2F6]">
                                {item.top10Count}
                              </td>
                            )}
                            <td className="py-3 px-3 text-center font-mono tabular-nums font-bold text-[#E59A23]">
                              {Number(item.avgKills || 0).toFixed(1)}
                            </td>
                            <td className="py-3 px-3 text-center font-mono tabular-nums text-[#EEF2F6]">
                              {Math.round(Number(item.avgDamage || 0))}
                            </td>
                            <td className="py-3 px-3 text-center font-mono tabular-nums text-[#38BDF8]">
                              {item.highlightCount}
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

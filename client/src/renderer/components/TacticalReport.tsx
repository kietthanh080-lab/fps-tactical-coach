import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle,
  Crosshair,
  ListChecks,
  PaperPlaneRight,
  Robot,
  ShieldWarning,
  Target,
} from '@phosphor-icons/react';
import { AnalyzedRoundUI, WeaponUsageStatUI } from './RoundTimeline';
import { askAiCoach } from '../services/localDb';

export interface MatchReportUI {
  overallScore: number;
  strengthsSummary: string[];
  weaknessesSummary: string[];
  recommendedDrills: string[];
  coachCommentary: string;
}

interface TacticalReportProps {
  gameType: 'VALORANT' | 'PUBG';
  matchId?: string | null;
  mapName?: string;
  activeRound: AnalyzedRoundUI | undefined;
  rounds?: AnalyzedRoundUI[];
  report: MatchReportUI | null;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const CATEGORY_BADGE_STYLES: Record<WeaponUsageStatUI['category'], string> = {
  AR: 'bg-[#E59A23]/15 text-[#E59A23] border-[#E59A23]/40',
  DMR: 'bg-[#38BDF8]/15 text-[#38BDF8] border-[#38BDF8]/40',
  SR: 'bg-[#FF4655]/15 text-[#FF4655] border-[#FF4655]/40',
  SMG: 'bg-[#10B981]/15 text-[#10B981] border-[#10B981]/40',
  LMG: 'bg-teal-500/15 text-teal-300 border-teal-500/40',
  SG: 'bg-orange-500/15 text-orange-300 border-orange-500/40',
  Pistol: 'bg-slate-700/40 text-slate-300 border-slate-600/50',
  Throwable: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40',
  Other: 'bg-[#171D28] text-[#94A3B8] border-[#334155]',
};

const QUICK_PROMPTS: Record<'VALORANT' | 'PUBG', string[]> = {
  VALORANT: [
    'Tại sao mình hay thua các round Force Buy?',
    'Phân tích lỗi vị trí ở Round đang chọn',
    'Đánh giá hiệu quả chọn súng & headshot trận này',
  ],
  PUBG: [
    'Cách di chuyển vào bo cuối an toàn hơn?',
    'Phân tích giai đoạn vòng bo mình bị hạ gục',
    'Đánh giá bộ vũ khí & sát thương trận này',
  ],
};

export const TacticalReport: React.FC<TacticalReportProps> = ({
  gameType,
  matchId = null,
  mapName = '',
  activeRound,
  rounds = [],
  report,
}) => {
  const [activeTab, setActiveTab] = useState<'ROUND' | 'MATCH' | 'CHAT'>('ROUND');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [questionInput, setQuestionInput] = useState('');
  const [sendingChat, setSendingChat] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const isValo = gameType === 'VALORANT';

  const activeTabStyle = isValo
    ? 'bg-[#FF4655] text-[#EEF2F6]'
    : 'bg-[#E59A23] text-[#0A0D12]';

  useEffect(() => {
    setMessages([]);
    setQuestionInput('');
  }, [matchId]);

  useEffect(() => {
    if (activeTab === 'CHAT') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeTab]);

  const matchWeaponSummary = useMemo(() => {
    const aggMap = new Map<string, WeaponUsageStatUI>();
    for (const r of rounds) {
      for (const w of r.weaponStats || []) {
        const prev = aggMap.get(w.weaponName);
        if (!prev) {
          aggMap.set(w.weaponName, { ...w });
        } else {
          prev.kills += w.kills;
          prev.headshots += w.headshots;
          prev.damageDealt += w.damageDealt;
          prev.hits += w.hits;
          prev.throwablesUsed = (prev.throwablesUsed || 0) + (w.throwablesUsed || 0);
          prev.maxKillDistanceMeters = Math.max(
            prev.maxKillDistanceMeters || 0,
            w.maxKillDistanceMeters || 0
          );
        }
      }
    }
    return Array.from(aggMap.values()).sort(
      (a, b) => b.damageDealt - a.damageDealt || b.kills - a.kills
    );
  }, [rounds]);

  const handleAskCoach = async (rawQuestion: string) => {
    const trimmed = rawQuestion.trim();
    if (!trimmed || sendingChat) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: trimmed,
    };

    setMessages((prev) => [...prev, userMsg]);
    setQuestionInput('');
    setSendingChat(true);

    try {
      const data = await askAiCoach({
        matchId,
        gameType,
        mapName,
        question: trimmed,
        activeRound,
        rounds,
        report,
        history: messages.slice(-6).map((m) => ({
          role: m.role,
          content: m.content,
        })),
      });

      const replyText = data.reply || 'Không thể kết nối tới AI Coach lúc này.';

      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: replyText,
        },
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: 'assistant',
          content:
            err?.message || 'Lỗi kết nối mạng tới máy chủ AI Coach. Vui lòng thử lại.',
        },
      ]);
    } finally {
      setSendingChat(false);
    }
  };

  const roundWeapons = activeRound?.weaponStats || [];
  const maxRoundWeaponDmg = Math.max(1, ...roundWeapons.map((w) => w.damageDealt));

  return (
    <section
      aria-label="Bao cao chien thuat va AI Coach"
      className="bg-[#10141C] border border-[#232B3B] rounded-[4px] p-4 flex flex-col gap-4 h-full"
    >
      {/* Tab Switcher */}
      <div
        role="tablist"
        aria-label="Che do phan tich"
        className="grid grid-cols-3 gap-1 p-1 rounded-[2px] bg-[#0A0D12] border border-[#232B3B]"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'ROUND'}
          onClick={() => setActiveTab('ROUND')}
          className={`py-2 px-2 rounded-[2px] font-mono text-[11px] font-bold transition duration-150 truncate active:translate-y-[1px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38BDF8] ${
            activeTab === 'ROUND'
              ? activeTabStyle
              : 'text-[#94A3B8] hover:text-[#EEF2F6] hover:bg-[#171D28]'
          }`}
        >
          {isValo
            ? `Round ${activeRound ? `#${activeRound.roundNumber}` : ''}`
            : `Bo ${activeRound ? `P${activeRound.roundNumber}` : ''}`}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'MATCH'}
          onClick={() => setActiveTab('MATCH')}
          className={`py-2 px-2 rounded-[2px] font-mono text-[11px] font-bold transition duration-150 truncate active:translate-y-[1px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38BDF8] ${
            activeTab === 'MATCH'
              ? activeTabStyle
              : 'text-[#94A3B8] hover:text-[#EEF2F6] hover:bg-[#171D28]'
          }`}
        >
          Tổng kết
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'CHAT'}
          onClick={() => setActiveTab('CHAT')}
          className={`inline-flex items-center justify-center gap-1 py-2 px-2 rounded-[2px] font-mono text-[11px] font-bold transition duration-150 truncate active:translate-y-[1px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38BDF8] ${
            activeTab === 'CHAT'
              ? activeTabStyle
              : 'text-[#94A3B8] hover:text-[#EEF2F6] hover:bg-[#171D28]'
          }`}
        >
          <Robot size={13} weight="bold" aria-hidden="true" />
          <span>AI Coach</span>
        </button>
      </div>

      {/* TAB 1: CHI TIET ROUND / PHASE */}
      {activeTab === 'ROUND' && (
        <div className="space-y-4 text-sm overflow-y-auto max-h-[76vh] tactical-scrollbar pr-1">
          {!activeRound ? (
            <div className="border border-dashed border-[#232B3B] bg-[#0A0D12]/60 rounded-[2px] p-5 text-center space-y-2">
              <Target size={24} className="mx-auto text-[#64748B]" aria-hidden="true" />
              <p className="text-[#94A3B8] text-xs leading-relaxed">
                {isValo
                  ? 'Chọn một trận đấu và round tương ứng để xem phân tích vũ khí, kinh tế và lỗi vị trí.'
                  : 'Chọn một trận đấu và giai đoạn vòng bo để xem chi tiết vũ khí sử dụng và diễn biến giao tranh.'}
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-2 border-b border-[#232B3B] pb-3">
                <div>
                  <h2 className="font-display font-bold text-lg text-[#EEF2F6] leading-tight">
                    {isValo
                      ? `Round ${String(activeRound.roundNumber).padStart(2, '0')}`
                      : `Vòng bo Phase ${activeRound.roundNumber}`}
                  </h2>
                  <p className="font-mono text-xs text-[#94A3B8] mt-1 tabular-nums">
                    K/D/A: <span className="text-[#EEF2F6] font-bold">{activeRound.kills}/{activeRound.deaths}/{activeRound.assists}</span> - DMG:{' '}
                    <span className="text-[#E59A23] font-bold">{activeRound.damageDealt}</span>
                  </p>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-[2px] border font-mono text-[11px] font-bold ${
                    activeRound.result === 'WIN' || activeRound.result === 'SURVIVED'
                      ? 'bg-[#10B981]/15 border-[#10B981]/40 text-[#10B981]'
                      : 'bg-[#F43F5E]/15 border-[#F43F5E]/40 text-[#F43F5E]'
                  }`}
                >
                  {activeRound.result}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
                <div className="p-2 rounded-[2px] bg-[#0A0D12] border border-[#232B3B]">
                  <span className="block text-[10px] text-[#64748B]">
                    {isValo ? 'KINH TẾ' : 'GIAI ĐOẠN'}
                  </span>
                  <span className="text-[#38BDF8] font-bold truncate block mt-0.5">
                    {activeRound.economyType}
                  </span>
                </div>
                <div className="p-2 rounded-[2px] bg-[#0A0D12] border border-[#232B3B]">
                  <span className="block text-[10px] text-[#64748B]">LỐI ĐÁNH</span>
                  <span className="text-[#EEF2F6] font-bold truncate block mt-0.5">
                    {activeRound.tacticalStyle}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="font-mono font-bold text-[#94A3B8] text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                  <Crosshair size={13} weight="bold" aria-hidden="true" />
                  <span>
                    {isValo
                      ? 'Vũ khí trang bị trong Round'
                      : `Vũ khí sử dụng ở Phase ${activeRound.roundNumber}`}
                  </span>
                </h3>

                {roundWeapons.length === 0 ? (
                  <p className="text-xs text-[#64748B] italic py-2">
                    Không ghi nhận giao tranh hoặc đổi vũ khí trong giai đoạn này.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {roundWeapons.map((w) => {
                      const hsRate =
                        w.hits > 0 ? Math.round((w.headshots / w.hits) * 100) : 0;
                      const dmgBarPercent =
                        w.damageDealt > 0
                          ? Math.max(8, Math.round((w.damageDealt / maxRoundWeaponDmg) * 100))
                          : 0;

                      return (
                        <div
                          key={w.weaponName}
                          className="p-2.5 rounded-[2px] bg-[#0A0D12] border border-[#232B3B] space-y-1.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className={`px-1.5 py-0.5 rounded-[2px] font-mono text-[10px] font-bold border ${
                                  CATEGORY_BADGE_STYLES[w.category] || CATEGORY_BADGE_STYLES.Other
                                }`}
                              >
                                {w.category === 'Throwable' ? 'NÉM' : w.category}
                              </span>
                              <span className="text-xs font-bold text-[#EEF2F6] truncate">
                                {w.weaponName}
                              </span>
                            </div>

                            {w.category === 'Throwable' ? (
                              <span className="font-mono text-[11px] font-bold text-[#38BDF8] tabular-nums">
                                {w.throwablesUsed || 1} quả
                              </span>
                            ) : (
                              <span className="font-mono text-[11px] font-bold text-[#E59A23] tabular-nums">
                                {w.damageDealt} DMG
                              </span>
                            )}
                          </div>

                          {w.category !== 'Throwable' && (
                            <>
                              <div className="h-1 w-full bg-[#171D28] overflow-hidden">
                                <div
                                  className={`h-full ${
                                    isValo ? 'bg-[#FF4655]' : 'bg-[#E59A23]'
                                  }`}
                                  style={{ width: `${dmgBarPercent}%` }}
                                />
                              </div>

                              <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[11px] text-[#94A3B8] tabular-nums">
                                <span>
                                  {w.damageDealt > 0
                                    ? `${w.hits} hit - HS ${hsRate}%`
                                    : 'Trang bị (chưa khai hỏa)'}
                                </span>

                                <div className="flex items-center gap-2">
                                  {w.kills > 0 && (
                                    <span className="text-[#10B981] font-bold">
                                      {w.kills}K
                                    </span>
                                  )}
                                  {(w.maxKillDistanceMeters || 0) > 0 && (
                                    <span className="text-[#38BDF8]">
                                      {w.maxKillDistanceMeters}m
                                    </span>
                                  )}
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <h3 className="font-mono font-bold text-[#10B981] text-[11px] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <CheckCircle size={13} weight="bold" aria-hidden="true" />
                  <span>Điểm làm tốt</span>
                </h3>
                <ul className="space-y-1.5 text-[#EEF2F6] text-xs">
                  {activeRound.strengths.length > 0 ? (
                    activeRound.strengths.map((s, idx) => (
                      <li
                        key={idx}
                        className="p-2.5 rounded-[2px] bg-[#10B981]/10 border border-[#10B981]/30 leading-relaxed"
                      >
                        {s}
                      </li>
                    ))
                  ) : (
                    <li className="text-[#64748B] italic text-xs">
                      Không có đột biến nổi bật ở giai đoạn này.
                    </li>
                  )}
                </ul>
              </div>

              <div>
                <h3 className="font-mono font-bold text-[#E59A23] text-[11px] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <ShieldWarning size={13} weight="bold" aria-hidden="true" />
                  <span>Lỗi chiến thuật cần khắc phục</span>
                </h3>
                <ul className="space-y-1.5 text-[#EEF2F6] text-xs">
                  {activeRound.mistakes.length > 0 ? (
                    activeRound.mistakes.map((m, idx) => (
                      <li
                        key={idx}
                        className="p-2.5 rounded-[2px] bg-[#E59A23]/10 border border-[#E59A23]/30 leading-relaxed"
                      >
                        {m}
                      </li>
                    ))
                  ) : (
                    <li className="text-[#64748B] italic text-xs">
                      Xử lý ổn định, không mắc lỗi vị trí.
                    </li>
                  )}
                </ul>
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB 2: TONG KET AI COACH */}
      {activeTab === 'MATCH' && (
        <div className="space-y-4 text-sm overflow-y-auto max-h-[76vh] tactical-scrollbar pr-1">
          {!report ? (
            <p className="text-[#64748B] text-xs leading-relaxed">
              Chọn một trận đấu đã phân tích để xem đánh giá tổng quát từ AI Coach.
            </p>
          ) : (
            <>
              <div className="p-3.5 rounded-[2px] bg-[#0A0D12] border border-[#232B3B] flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <h2 className="font-display text-sm font-bold text-[#EEF2F6]">
                    Đánh giá tổng quan
                  </h2>
                  <p className="text-xs text-[#94A3B8] leading-relaxed max-w-[65ch]">
                    {report.coachCommentary}
                  </p>
                </div>
                <div
                  className={`shrink-0 px-3 py-2 rounded-[2px] border text-center font-mono ${
                    isValo
                      ? 'bg-[#FF4655]/15 border-[#FF4655]/50 text-[#FF4655]'
                      : 'bg-[#E59A23]/15 border-[#E59A23]/50 text-[#E59A23]'
                  }`}
                >
                  <span className="block text-[9px] text-[#94A3B8]">SCORE</span>
                  <span className="text-lg font-bold tabular-nums">{report.overallScore}</span>
                </div>
              </div>

              {matchWeaponSummary.length > 0 && (
                <div>
                  <h3 className="font-mono font-bold text-[#E59A23] text-[11px] uppercase tracking-wider mb-2">
                    Thống kê vũ khí cả trận
                  </h3>
                  <div className="space-y-1.5">
                    {matchWeaponSummary.slice(0, 5).map((w) => (
                      <div
                        key={w.weaponName}
                        className="px-3 py-2 rounded-[2px] bg-[#0A0D12] border border-[#232B3B] flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-bold text-[#EEF2F6] truncate">{w.weaponName}</span>
                          <span className="font-mono text-[10px] text-[#64748B]">{w.category}</span>
                        </div>
                        <div className="font-mono text-[11px] text-[#94A3B8] tabular-nums shrink-0">
                          {w.category === 'Throwable' ? (
                            <span>{w.throwablesUsed || 0} lần dùng</span>
                          ) : (
                            <span>
                              <strong className="text-[#E59A23]">{w.damageDealt}</strong> DMG -{' '}
                              <strong className="text-[#10B981]">{w.kills}</strong>K
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h3 className="font-mono font-bold text-[#10B981] text-[11px] uppercase tracking-wider mb-1.5">
                  Điểm mạnh nổi bật
                </h3>
                <ul className="space-y-1.5 text-xs text-[#EEF2F6]">
                  {report.strengthsSummary.map((item, idx) => (
                    <li
                      key={idx}
                      className="p-2 rounded-[2px] bg-[#0A0D12] border-l-2 border-[#10B981] leading-relaxed"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="font-mono font-bold text-[#F43F5E] text-[11px] uppercase tracking-wider mb-1.5">
                  Điểm yếu cần cải thiện
                </h3>
                <ul className="space-y-1.5 text-xs text-[#EEF2F6]">
                  {report.weaknessesSummary.map((item, idx) => (
                    <li
                      key={idx}
                      className="p-2 rounded-[2px] bg-[#0A0D12] border-l-2 border-[#F43F5E] leading-relaxed"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {report.recommendedDrills.length > 0 && (
                <div>
                  <h3 className="font-mono font-bold text-[#38BDF8] text-[11px] uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <ListChecks size={13} weight="bold" aria-hidden="true" />
                    <span>Bài tập đề xuất</span>
                  </h3>
                  <ul className="space-y-1.5 text-xs text-[#94A3B8]">
                    {report.recommendedDrills.map((drill, idx) => (
                      <li
                        key={idx}
                        className="p-2 rounded-[2px] bg-[#0A0D12] border border-[#232B3B] leading-relaxed"
                      >
                        {drill}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* TAB 3: HOI DAP CHIEN THUAT VOI AI COACH */}
      {activeTab === 'CHAT' && (
        <div className="flex flex-col flex-1 min-h-[62vh] max-h-[76vh] justify-between gap-3">
          {!matchId ? (
            <p className="text-xs text-[#64748B]">
              Chọn một trận đấu ở danh sách bên trái để bắt đầu hỏi đáp chiến thuật với AI Coach.
            </p>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto tactical-scrollbar space-y-2.5 pr-1">
                {messages.length === 0 ? (
                  <div className="space-y-3">
                    <div className="p-3 rounded-[2px] bg-[#0A0D12] border border-[#232B3B] text-xs text-[#94A3B8] leading-relaxed">
                      AI Coach đã đọc dữ liệu <strong className="text-[#EEF2F6] font-mono">{rounds.length}</strong>{' '}
                      {isValo ? 'round' : 'giai đoạn vòng bo'} của trận{' '}
                      <strong className="text-[#EEF2F6]">{mapName || gameType}</strong>. Bạn muốn phân tích tình huống nào?
                    </div>

                    <div className="space-y-1.5">
                      <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
                        Gợi ý câu hỏi nhanh
                      </p>
                      {QUICK_PROMPTS[gameType].map((prompt) => (
                        <button
                          key={prompt}
                          type="button"
                          onClick={() => void handleAskCoach(prompt)}
                          className="w-full text-left p-2.5 rounded-[2px] bg-[#0A0D12] hover:bg-[#171D28] border border-[#232B3B] hover:border-[#334155] text-xs text-[#EEF2F6] transition duration-150 active:translate-y-[1px]"
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  messages.map((m) => (
                    <div
                      key={m.id}
                      className={`p-3 rounded-[2px] text-xs leading-relaxed whitespace-pre-line ${
                        m.role === 'user'
                          ? isValo
                            ? 'bg-[#FF4655]/15 border border-[#FF4655]/40 text-[#EEF2F6] ml-4'
                            : 'bg-[#E59A23]/15 border border-[#E59A23]/40 text-[#EEF2F6] ml-4'
                          : 'bg-[#0A0D12] border border-[#232B3B] text-[#EEF2F6] mr-2'
                      }`}
                    >
                      {m.content.split(/(\*\*.*?\*\*)/g).map((part, i) =>
                        part.startsWith('**') && part.endsWith('**') ? (
                          <strong key={i} className="font-bold text-white">
                            {part.slice(2, -2)}
                          </strong>
                        ) : (
                          <span key={i}>{part}</span>
                        )
                      )}
                    </div>
                  ))
                )}

                {sendingChat && (
                  <div className="p-3 rounded-[2px] bg-[#0A0D12] border border-[#232B3B] space-y-2">
                    <div className="h-2.5 w-3/4 bg-[#171D28] animate-pulse rounded-[2px]" />
                    <div className="h-2.5 w-1/2 bg-[#171D28] animate-pulse rounded-[2px]" />
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleAskCoach(questionInput);
                }}
                className="flex gap-2 pt-2.5 border-t border-[#232B3B]"
              >
                <label htmlFor="ai-coach-question" className="sr-only">
                  Câu hỏi chiến thuật gửi AI Coach
                </label>
                <input
                  id="ai-coach-question"
                  type="text"
                  value={questionInput}
                  onChange={(e) => setQuestionInput(e.target.value)}
                  placeholder="Hỏi về cách bắn, chọn súng, di chuyển..."
                  disabled={sendingChat}
                  className="flex-1 min-w-0 px-3 py-2 rounded-[2px] bg-[#0A0D12] border border-[#232B3B] text-xs text-[#EEF2F6] placeholder:text-[#64748B] focus:outline-none focus:border-[#38BDF8]"
                />
                <button
                  type="submit"
                  aria-label="Gửi câu hỏi cho AI Coach"
                  disabled={sendingChat || !questionInput.trim()}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[2px] text-xs font-bold transition duration-150 shrink-0 disabled:opacity-40 active:translate-y-[1px] ${
                    isValo
                      ? 'bg-[#FF4655] hover:bg-rose-500 text-[#EEF2F6]'
                      : 'bg-[#E59A23] hover:bg-amber-400 text-[#0A0D12]'
                  }`}
                >
                  <PaperPlaneRight size={14} weight="bold" aria-hidden="true" />
                  <span>Gửi</span>
                </button>
              </form>
            </>
          )}
        </div>
      )}
    </section>
  );
};

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle,
  Crosshair,
  DownloadSimple,
  FileCsv,
  FloppyDisk,
  ListChecks,
  NotePencil,
  PaperPlaneRight,
  Robot,
  ShieldWarning,
  Tag,
  Target,
} from '@phosphor-icons/react';
import { useI18n } from '../i18n';
import {
  getMatchAnnotation,
  PRESET_MATCH_TAGS,
  saveMatchAnnotation,
} from '../services/appSettings';
import type { PubgMapTelemetrySummary } from '../services/localDb';
import { askAiCoach } from '../services/localDb';
import { PubgMinimapPanel } from './PubgMinimapPanel';
import { AnalyzedRoundUI, WeaponUsageStatUI } from './RoundTimeline';

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
  mapTelemetry?: PubgMapTelemetrySummary | null;
  dataRevision?: number;
  onAnnotationChange?: () => void;
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

const QUICK_PROMPTS_EN: Record<'VALORANT' | 'PUBG', string[]> = {
  VALORANT: [
    'Why did we lose our Force Buy rounds?',
    'Analyze positioning mistakes in the selected round',
    'Evaluate weapon choice and headshot efficiency this match',
  ],
  PUBG: [
    'How could I rotate into the late zone more safely?',
    'Break down the phase where I got eliminated',
    'Evaluate my weapon loadout and damage output this match',
  ],
};

const QUICK_PROMPTS_VI: Record<'VALORANT' | 'PUBG', string[]> = {
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

function polarPoint(cx: number, cy: number, radius: number, index: number, total = 5) {
  const angle = -Math.PI / 2 + (index * 2 * Math.PI) / total;
  return {
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle),
  };
}

export const TacticalReport: React.FC<TacticalReportProps> = ({
  gameType,
  matchId = null,
  mapName = '',
  activeRound,
  rounds = [],
  report,
  mapTelemetry = null,
  dataRevision = 0,
  onAnnotationChange,
}) => {
  const { isEn, tr, ts } = useI18n();
  const [activeTab, setActiveTab] = useState<'ROUND' | 'MATCH' | 'CHAT'>('ROUND');
  const [showRoundMinimap, setShowRoundMinimap] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [questionInput, setQuestionInput] = useState('');
  const [sendingChat, setSendingChat] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const [matchTags, setMatchTags] = useState<string[]>([]);
  const [matchNote, setMatchNote] = useState('');
  const [noteSavedFlash, setNoteSavedFlash] = useState(false);

  const isValo = gameType === 'VALORANT';

  const activeTabStyle = isValo
    ? 'bg-[#FF4655] text-[#EEF2F6]'
    : 'bg-[#E59A23] text-[#0A0D12]';

  useEffect(() => {
    setMessages([]);
    setQuestionInput('');
  }, [matchId]);

  useEffect(() => {
    const ann = getMatchAnnotation(matchId);
    setMatchTags(ann.tags);
    setMatchNote(ann.note);
    setNoteSavedFlash(false);
  }, [matchId, dataRevision]);

  useEffect(() => {
    if (activeTab === 'CHAT') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeTab]);

  const handleToggleTag = (tag: string) => {
    if (!matchId) return;
    const exists = matchTags.includes(tag);
    const nextTags = exists ? matchTags.filter((t) => t !== tag) : [...matchTags, tag];
    setMatchTags(nextTags);
    saveMatchAnnotation(matchId, { tags: nextTags, note: matchNote });
    onAnnotationChange?.();
  };

  const handleSaveNote = () => {
    if (!matchId) return;
    saveMatchAnnotation(matchId, { tags: matchTags, note: matchNote });
    onAnnotationChange?.();
    setNoteSavedFlash(true);
    window.setTimeout(() => setNoteSavedFlash(false), 1800);
  };

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

  // Inspired by akiver/cs-demo-manager: Pro FPS Metrics (KAST %, ADR, HS %, Impact) + 5-Axis Combat Radar
  const proTelemetryMetrics = useMemo(() => {
    const totalRounds = Math.max(1, rounds.length);
    let totalKills = 0;
    let totalDeaths = 0;
    let totalAssists = 0;
    let totalDamage = 0;
    let kastRounds = 0;
    let multiKillRounds = 0;
    let cleanRounds = 0;
    let totalHits = 0;
    let totalHeadshots = 0;
    let totalThrowables = 0;

    for (const r of rounds) {
      totalKills += r.kills;
      totalDeaths += r.deaths;
      totalAssists += r.assists;
      totalDamage += r.damageDealt;
      if (r.kills >= 2) multiKillRounds += 1;
      if (r.mistakes.length === 0) cleanRounds += 1;

      const isKast =
        r.kills > 0 ||
        r.assists > 0 ||
        r.deaths === 0 ||
        r.result === 'WIN' ||
        r.result === 'SURVIVED';
      if (isKast) kastRounds += 1;

      for (const w of r.weaponStats || []) {
        totalHits += w.hits || 0;
        totalHeadshots += w.headshots || 0;
        totalThrowables += w.throwablesUsed || 0;
      }
    }

    const kastPct = Math.round((kastRounds / totalRounds) * 100);
    const adr = Math.round(totalDamage / totalRounds);
    const hsPct = totalHits > 0 ? Math.round((totalHeadshots / totalHits) * 100) : isValo ? 22 : 18;
    const kpr = totalKills / totalRounds;
    const targetAdr = isValo ? 155 : 190;

    const rawImpact =
      0.42 +
      kpr * 0.62 +
      (adr / targetAdr) * 0.42 +
      (kastPct / 100) * 0.32 +
      (multiKillRounds / totalRounds) * 0.45;
    const impactRating = Math.min(2.4, Math.max(0.35, Number(rawImpact.toFixed(2))));

    const clampAxis = (val: number) => Math.min(99, Math.max(22, Math.round(val)));

    const axes = [
      {
        key: 'FIRE',
        label: tr('FIRE', 'HỎA LỰC'),
        value: clampAxis((adr / targetAdr) * 78 + multiKillRounds * 8),
      },
      {
        key: 'AIM',
        label: tr('AIM', 'CHUẨN XÁC'),
        value: clampAxis(hsPct * (isValo ? 2.4 : 2.6) + (totalKills > 0 ? 18 : 8)),
      },
      {
        key: 'KAST',
        label: 'KAST',
        value: clampAxis(kastPct),
      },
      {
        key: 'TEMPO',
        label: tr('TEMPO', 'NHỊP ĐỘ'),
        value: clampAxis(kpr * 58 + (totalAssists / totalRounds) * 35 + 24),
      },
      {
        key: 'DISCIPLINE',
        label: tr('UTIL', 'KỶ LUẬT'),
        value: clampAxis((cleanRounds / totalRounds) * 76 + Math.min(22, totalThrowables * 6)),
      },
    ];

    return {
      kastPct,
      adr,
      hsPct,
      impactRating,
      totalKills,
      totalDeaths,
      totalAssists,
      totalDamage,
      axes,
    };
  }, [isValo, rounds, tr]);

  const handleExportMatchCsv = () => {
    if (rounds.length === 0) return;
    const header = [
      isValo ? 'Round' : 'Phase',
      'Result',
      'Economy_Stage',
      'Playstyle',
      'Kills',
      'Deaths',
      'Assists',
      'Damage',
      'Top_Weapon',
      'Strengths',
      'Mistakes',
    ];

    const escapeCsv = (val: string | number) => {
      const str = String(val ?? '').replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = rounds.map((r) => {
      const topWeapon = r.weaponStats?.[0]?.weaponName || '';
      return [
        r.roundNumber,
        r.result,
        r.economyType,
        r.tacticalStyle,
        r.kills,
        r.deaths,
        r.assists,
        r.damageDealt,
        topWeapon,
        r.strengths.map((s) => ts(s)).join(' | '),
        r.mistakes.map((m) => ts(m)).join(' | '),
      ]
        .map(escapeCsv)
        .join(',');
    });

    const csvContent = `\uFEFF${header.join(',')}\n${rows.join('\n')}`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `telemetry-${gameType.toLowerCase()}-${(mapName || 'match').toLowerCase()}-${(matchId || 'export').slice(0, 8)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const handleExportMatchJson = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      matchId,
      gameType,
      mapName,
      metrics: proTelemetryMetrics,
      personalAnnotation: { tags: matchTags, note: matchNote },
      report,
      weaponSummary: matchWeaponSummary,
      rounds,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `telemetry-${gameType.toLowerCase()}-${(matchId || 'export').slice(0, 8)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

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
      const apiQuestion = isEn
        ? `${trimmed} (Please respond concisely in English based on the match telemetry.)`
        : trimmed;

      const data = await askAiCoach({
        matchId,
        gameType,
        mapName,
        question: apiQuestion,
        activeRound,
        rounds,
        report,
        history: messages.slice(-6).map((m) => ({
          role: m.role,
          content: m.content,
        })),
      });

      const rawReply =
        data.reply ||
        tr('Unable to reach AI Coach right now.', 'Không thể kết nối tới AI Coach lúc này.');
      const replyText = isEn ? ts(rawReply) : rawReply;

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
            err?.message ||
            tr(
              'Network error connecting to AI Coach server. Please try again.',
              'Lỗi kết nối mạng tới máy chủ AI Coach. Vui lòng thử lại.'
            ),
        },
      ]);
    } finally {
      setSendingChat(false);
    }
  };

  const roundWeapons = activeRound?.weaponStats || [];
  const maxRoundWeaponDmg = Math.max(1, ...roundWeapons.map((w) => w.damageDealt));
  const quickPrompts = isEn ? QUICK_PROMPTS_EN[gameType] : QUICK_PROMPTS_VI[gameType];

  const radarCx = 120;
  const radarCy = 104;
  const radarMaxR = 64;
  const radarPolygonPoints = proTelemetryMetrics.axes
    .map((ax, i) => {
      const pt = polarPoint(radarCx, radarCy, (ax.value / 100) * radarMaxR, i, 5);
      return `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <section
      aria-label={tr('Tactical Report and AI Coach', 'Báo cáo chiến thuật và AI Coach')}
      className="theme-surface-card bg-[#10141C] border border-[#232B3B] rounded-[4px] p-4 flex flex-col gap-4 h-full"
    >
      {/* Tab Switcher */}
      <div
        role="tablist"
        aria-label={tr('Analysis view mode', 'Chế độ phân tích')}
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
            : tr(
                `Phase ${activeRound ? `#${activeRound.roundNumber}` : ''}`,
                `Bo ${activeRound ? `P${activeRound.roundNumber}` : ''}`
              )}
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
          {tr('Overview', 'Tổng kết')}
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

      {/* TAB 1: ROUND / PHASE TELEMETRY */}
      {activeTab === 'ROUND' && (
        <div className="space-y-4 text-sm overflow-y-auto max-h-[76vh] tactical-scrollbar pr-1">
          {!activeRound ? (
            <div className="border border-dashed border-[#232B3B] bg-[#0A0D12]/60 rounded-[2px] p-5 text-center space-y-2">
              <Target size={24} className="mx-auto text-[#64748B]" aria-hidden="true" />
              <p className="text-[#94A3B8] text-xs leading-relaxed">
                {isValo
                  ? tr(
                      'Select a match and round to view weapon accuracy, economy, and positioning review.',
                      'Chọn một trận đấu và round tương ứng để xem phân tích vũ khí, kinh tế và lỗi vị trí.'
                    )
                  : tr(
                      'Select a match and safe-zone phase to inspect weapon damage and combat breakdown.',
                      'Chọn một trận đấu và giai đoạn vòng bo để xem chi tiết vũ khí sử dụng và diễn biến giao tranh.'
                    )}
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-2 border-b border-[#232B3B] pb-3">
                <div>
                  <h2 className="font-display font-bold text-lg text-[#EEF2F6] leading-tight">
                    {isValo
                      ? `Round ${String(activeRound.roundNumber).padStart(2, '0')}`
                      : tr(
                          `Zone Phase ${activeRound.roundNumber}`,
                          `Vòng bo Phase ${activeRound.roundNumber}`
                        )}
                  </h2>
                  <p className="font-mono text-xs text-[#94A3B8] mt-1 tabular-nums">
                    K/D/A:{' '}
                    <span className="text-[#EEF2F6] font-bold">
                      {activeRound.kills}/{activeRound.deaths}/{activeRound.assists}
                    </span>{' '}
                    - DMG:{' '}
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

              {matchId && (
                <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-[2px] bg-[#0A0D12] border border-[#232B3B]">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-[#94A3B8] truncate">
                    <Tag
                      size={12}
                      weight="bold"
                      className="text-[#38BDF8] shrink-0"
                      aria-hidden="true"
                    />
                    <span className="truncate">
                      {matchTags.length > 0
                        ? matchTags.join(', ')
                        : matchNote.trim()
                          ? tr('Personal note attached', 'Đã có ghi chú cá nhân')
                          : tr('No personal tags yet', 'Chưa gắn nhãn cá nhân')}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveTab('MATCH')}
                    className="font-mono text-[10px] font-bold text-[#38BDF8] hover:underline shrink-0"
                  >
                    {tr('Notes & Radar', 'Ghi chú & Radar')}
                  </button>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
                <div className="p-2 rounded-[2px] bg-[#0A0D12] border border-[#232B3B]">
                  <span className="block text-[10px] text-[#64748B]">
                    {isValo ? tr('ECONOMY', 'KINH TẾ') : tr('STAGE', 'GIAI ĐOẠN')}
                  </span>
                  <span className="text-[#38BDF8] font-bold truncate block mt-0.5">
                    {activeRound.economyType}
                  </span>
                </div>
                <div className="p-2 rounded-[2px] bg-[#0A0D12] border border-[#232B3B]">
                  <span className="block text-[10px] text-[#64748B]">
                    {tr('PLAYSTYLE', 'LỐI ĐÁNH')}
                  </span>
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
                      ? tr('Round Weapon Telemetry', 'Vũ khí trang bị trong Round')
                      : tr(
                          `Weapons Used in Phase ${activeRound.roundNumber}`,
                          `Vũ khí sử dụng ở Phase ${activeRound.roundNumber}`
                        )}
                  </span>
                </h3>

                {roundWeapons.length === 0 ? (
                  <p className="text-xs text-[#64748B] italic py-2">
                    {tr(
                      'No combat fire or weapon swaps recorded in this phase.',
                      'Không ghi nhận giao tranh hoặc đổi vũ khí trong giai đoạn này.'
                    )}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {roundWeapons.map((w) => {
                      const hsRate = w.hits > 0 ? Math.round((w.headshots / w.hits) * 100) : 0;
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
                                {w.category === 'Throwable' ? tr('UTIL', 'NÉM') : w.category}
                              </span>
                              <span className="text-xs font-bold text-[#EEF2F6] truncate">
                                {w.weaponName}
                              </span>
                            </div>

                            {w.category === 'Throwable' ? (
                              <span className="font-mono text-[11px] font-bold text-[#38BDF8] tabular-nums">
                                {w.throwablesUsed || 1} {tr('used', 'quả')}
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
                                    : tr('Equipped (no shots)', 'Trang bị (chưa khai hỏa)')}
                                </span>

                                <div className="flex items-center gap-2">
                                  {w.kills > 0 && (
                                    <span className="text-[#10B981] font-bold">{w.kills}K</span>
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

              {!isValo && (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setShowRoundMinimap((prev) => !prev)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-[2px] bg-[#0A0D12] hover:bg-[#171D28] border border-[#232B3B] text-xs font-mono font-bold text-[#E59A23] transition duration-150"
                  >
                    <span>
                      {tr(
                        `2D ZONE & HEATMAP (${mapName || 'PUBG'})`,
                        `SƠ ĐỒ 2D BO & NHIỆT ĐỘ (${mapName || 'PUBG'})`
                      )}
                    </span>
                    <span className="text-[11px] text-[#94A3B8]">
                      {showRoundMinimap ? tr('Collapse', 'Thu gọn') : tr('Open Map', 'Mở bản đồ')}
                    </span>
                  </button>
                  {showRoundMinimap && (
                    <PubgMinimapPanel
                      mapName={mapName || 'PUBG'}
                      telemetry={mapTelemetry}
                      selectedPhase={activeRound?.roundNumber}
                    />
                  )}
                </div>
              )}

              <div>
                <h3 className="font-mono font-bold text-[#10B981] text-[11px] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <CheckCircle size={13} weight="bold" aria-hidden="true" />
                  <span>{tr('What Went Well', 'Điểm làm tốt')}</span>
                </h3>
                <ul className="space-y-1.5 text-[#EEF2F6] text-xs">
                  {activeRound.strengths.length > 0 ? (
                    activeRound.strengths.map((s, idx) => (
                      <li
                        key={idx}
                        className="p-2.5 rounded-[2px] bg-[#10B981]/10 border border-[#10B981]/30 leading-relaxed"
                      >
                        {ts(s)}
                      </li>
                    ))
                  ) : (
                    <li className="text-[#64748B] italic text-xs">
                      {tr(
                        'Standard execution with no major spikes in this phase.',
                        'Không có đột biến nổi bật ở giai đoạn này.'
                      )}
                    </li>
                  )}
                </ul>
              </div>

              <div>
                <h3 className="font-mono font-bold text-[#E59A23] text-[11px] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <ShieldWarning size={13} weight="bold" aria-hidden="true" />
                  <span>{tr('Tactical Mistakes to Fix', 'Lỗi chiến thuật cần khắc phục')}</span>
                </h3>
                <ul className="space-y-1.5 text-[#EEF2F6] text-xs">
                  {activeRound.mistakes.length > 0 ? (
                    activeRound.mistakes.map((m, idx) => (
                      <li
                        key={idx}
                        className="p-2.5 rounded-[2px] bg-[#E59A23]/10 border border-[#E59A23]/30 leading-relaxed"
                      >
                        {ts(m)}
                      </li>
                    ))
                  ) : (
                    <li className="text-[#64748B] italic text-xs">
                      {tr(
                        'Clean positioning; no critical errors detected.',
                        'Xử lý ổn định, không mắc lỗi vị trí.'
                      )}
                    </li>
                  )}
                </ul>
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB 2: MATCH OVERVIEW + PRO TELEMETRY RADAR + CSV/JSON EXPORT + NOTES */}
      {activeTab === 'MATCH' && (
        <div className="space-y-4 text-sm overflow-y-auto max-h-[76vh] tactical-scrollbar pr-1">
          {rounds.length > 0 && (
            <div className="p-3 rounded-[2px] bg-[#0A0D12] border border-[#232B3B] space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#EEF2F6]">
                  {tr('5-Axis Combat Radar & Pro Metrics', 'Biểu đồ Radar 5 Trục & Chỉ số Chuyên sâu')}
                </h2>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleExportMatchCsv}
                    title={tr('Export round-by-round telemetry to CSV', 'Xuất dữ liệu từng round ra CSV')}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[2px] bg-[#171D28] hover:bg-[#232B3B] border border-[#232B3B] font-mono text-[10px] font-bold text-[#10B981] transition"
                  >
                    <FileCsv size={12} weight="bold" aria-hidden="true" />
                    <span>CSV</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleExportMatchJson}
                    title={tr('Export full match telemetry JSON', 'Xuất toàn bộ dữ liệu trận ra JSON')}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[2px] bg-[#171D28] hover:bg-[#232B3B] border border-[#232B3B] font-mono text-[10px] font-bold text-[#38BDF8] transition"
                  >
                    <DownloadSimple size={12} weight="bold" aria-hidden="true" />
                    <span>JSON</span>
                  </button>
                </div>
              </div>

              {/* KAST / ADR / HS% / IMPACT Strip */}
              <div className="grid grid-cols-4 gap-1.5 font-mono text-center tabular-nums">
                <div className="p-1.5 rounded-[2px] bg-[#10141C] border border-[#232B3B]">
                  <span className="block text-[9px] text-[#64748B]">KAST</span>
                  <span className="text-xs font-bold text-[#10B981]">
                    {proTelemetryMetrics.kastPct}%
                  </span>
                </div>
                <div className="p-1.5 rounded-[2px] bg-[#10141C] border border-[#232B3B]">
                  <span className="block text-[9px] text-[#64748B]">ADR</span>
                  <span className="text-xs font-bold text-[#E59A23]">
                    {proTelemetryMetrics.adr}
                  </span>
                </div>
                <div className="p-1.5 rounded-[2px] bg-[#10141C] border border-[#232B3B]">
                  <span className="block text-[9px] text-[#64748B]">HS%</span>
                  <span className="text-xs font-bold text-[#38BDF8]">
                    {proTelemetryMetrics.hsPct}%
                  </span>
                </div>
                <div className="p-1.5 rounded-[2px] bg-[#10141C] border border-[#232B3B]">
                  <span className="block text-[9px] text-[#64748B]">IMPACT</span>
                  <span
                    className={`text-xs font-bold ${
                      isValo ? 'text-[#FF4655]' : 'text-[#EEF2F6]'
                    }`}
                  >
                    {proTelemetryMetrics.impactRating}
                  </span>
                </div>
              </div>

              {/* 5-Axis Pentagon SVG Radar */}
              <div className="rounded-[2px] bg-[#0B1017] border border-[#232B3B] p-1">
                <svg
                  viewBox="0 0 240 198"
                  className="w-full h-auto max-h-44 mx-auto block select-none"
                  role="img"
                  aria-label={tr(
                    '5-axis tactical performance radar chart',
                    'Biểu đồ radar 5 trục hiệu suất chiến thuật'
                  )}
                >
                  {[0.35, 0.68, 1].map((ring) => {
                    const ringPts = [0, 1, 2, 3, 4]
                      .map((idx) => {
                        const p = polarPoint(radarCx, radarCy, radarMaxR * ring, idx, 5);
                        return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
                      })
                      .join(' ');
                    return (
                      <polygon
                        key={ring}
                        points={ringPts}
                        fill="none"
                        stroke="#1E293B"
                        strokeWidth={1}
                      />
                    );
                  })}

                  {[0, 1, 2, 3, 4].map((idx) => {
                    const outer = polarPoint(radarCx, radarCy, radarMaxR, idx, 5);
                    return (
                      <line
                        key={idx}
                        x1={radarCx}
                        y1={radarCy}
                        x2={outer.x}
                        y2={outer.y}
                        stroke="#1E293B"
                        strokeWidth={1}
                      />
                    );
                  })}

                  <polygon
                    points={radarPolygonPoints}
                    fill={isValo ? 'rgba(255, 70, 85, 0.22)' : 'rgba(229, 154, 35, 0.22)'}
                    stroke={isValo ? '#FF4655' : '#E59A23'}
                    strokeWidth={2}
                  />

                  {proTelemetryMetrics.axes.map((ax, idx) => {
                    const dot = polarPoint(radarCx, radarCy, (ax.value / 100) * radarMaxR, idx, 5);
                    const lbl = polarPoint(radarCx, radarCy, radarMaxR + 22, idx, 5);
                    return (
                      <React.Fragment key={ax.key}>
                        <circle
                          cx={dot.x}
                          cy={dot.y}
                          r={3.2}
                          fill={isValo ? '#FF4655' : '#E59A23'}
                          stroke="#EEF2F6"
                          strokeWidth={1}
                        />
                        <text
                          x={lbl.x}
                          y={lbl.y - 3}
                          textAnchor="middle"
                          fill="#94A3B8"
                          fontSize="8.5"
                          fontFamily="JetBrains Mono, monospace"
                          fontWeight="bold"
                        >
                          {ax.label}
                        </text>
                        <text
                          x={lbl.x}
                          y={lbl.y + 8}
                          textAnchor="middle"
                          fill="#EEF2F6"
                          fontSize="9.5"
                          fontFamily="JetBrains Mono, monospace"
                          fontWeight="bold"
                        >
                          {ax.value}
                        </text>
                      </React.Fragment>
                    );
                  })}
                </svg>
              </div>
            </div>
          )}

          {matchId && (
            <div className="p-3 rounded-[2px] bg-[#0A0D12] border border-[#232B3B] space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#38BDF8] flex items-center gap-1.5">
                  <NotePencil size={13} weight="bold" aria-hidden="true" />
                  <span>{tr('Personal Match Tags & Notes', 'Nhãn & Ghi chú cá nhân')}</span>
                </h2>
                {noteSavedFlash && (
                  <span className="font-mono text-[10px] font-bold text-[#10B981]">
                    {tr('Saved', 'Đã lưu')}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {PRESET_MATCH_TAGS.map((tag) => {
                  const active = matchTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      aria-pressed={active}
                      onClick={() => handleToggleTag(tag)}
                      className={`px-2 py-0.5 rounded-[2px] font-mono text-[10px] font-bold border transition duration-150 ${
                        active
                          ? isValo
                            ? 'bg-[#FF4655]/20 border-[#FF4655] text-[#FF4655]'
                            : 'bg-[#E59A23]/20 border-[#E59A23] text-[#E59A23]'
                          : 'bg-[#10141C] border-[#232B3B] text-[#94A3B8] hover:text-[#EEF2F6]'
                      }`}
                    >
                      #{tag}
                    </button>
                  );
                })}
              </div>

              <div className="space-y-1.5">
                <label htmlFor="match-personal-note" className="sr-only">
                  {tr('Personal tactical notes for this match', 'Ghi chú rút kinh nghiệm cho trận này')}
                </label>
                <textarea
                  id="match-personal-note"
                  rows={2}
                  value={matchNote}
                  onChange={(e) => setMatchNote(e.target.value)}
                  onBlur={handleSaveNote}
                  placeholder={tr(
                    'Write your own VOD review notes, callout reminders, or scrim takeaways...',
                    'Ghi chú lại bài học rút ra, callout team hoặc điểm cần sửa ở trận này...'
                  )}
                  className="w-full px-2.5 py-1.5 rounded-[2px] bg-[#10141C] border border-[#232B3B] focus:border-[#38BDF8] text-xs text-[#EEF2F6] placeholder-[#64748B] focus:outline-none resize-none"
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleSaveNote}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[2px] bg-[#171D28] hover:bg-[#232B3B] border border-[#232B3B] font-mono text-[10px] font-bold text-[#EEF2F6] transition duration-150"
                  >
                    <FloppyDisk size={12} weight="bold" aria-hidden="true" />
                    <span>{tr('Save Note', 'Lưu ghi chú')}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {!isValo && (
            <PubgMinimapPanel
              mapName={mapName || 'PUBG'}
              telemetry={mapTelemetry || null}
              selectedPhase={activeRound?.roundNumber}
            />
          )}

          {!report ? (
            <p className="text-[#64748B] text-xs leading-relaxed">
              {tr(
                'Select an analyzed match to inspect overall AI Coach scoring and drills.',
                'Chọn một trận đấu đã phân tích để xem đánh giá tổng quát từ AI Coach.'
              )}
            </p>
          ) : (
            <>
              <div className="p-3.5 rounded-[2px] bg-[#0A0D12] border border-[#232B3B] flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <h2 className="font-display text-sm font-bold text-[#EEF2F6]">
                    {tr('Match Summary', 'Đánh giá tổng quan')}
                  </h2>
                  <p className="text-xs text-[#94A3B8] leading-relaxed max-w-[65ch]">
                    {ts(report.coachCommentary)}
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
                    {tr('Full-Match Weapon Breakdown', 'Thống kê vũ khí cả trận')}
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
                            <span>
                              {w.throwablesUsed || 0} {tr('used', 'lần dùng')}
                            </span>
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
                  {tr('Key Strengths', 'Điểm mạnh nổi bật')}
                </h3>
                <ul className="space-y-1.5 text-xs text-[#EEF2F6]">
                  {report.strengthsSummary.map((item, idx) => (
                    <li
                      key={idx}
                      className="p-2 rounded-[2px] bg-[#0A0D12] border-l-2 border-[#10B981] leading-relaxed"
                    >
                      {ts(item)}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="font-mono font-bold text-[#F43F5E] text-[11px] uppercase tracking-wider mb-1.5">
                  {tr('Areas for Improvement', 'Điểm yếu cần cải thiện')}
                </h3>
                <ul className="space-y-1.5 text-xs text-[#EEF2F6]">
                  {report.weaknessesSummary.map((item, idx) => (
                    <li
                      key={idx}
                      className="p-2 rounded-[2px] bg-[#0A0D12] border-l-2 border-[#F43F5E] leading-relaxed"
                    >
                      {ts(item)}
                    </li>
                  ))}
                </ul>
              </div>

              {report.recommendedDrills.length > 0 && (
                <div>
                  <h3 className="font-mono font-bold text-[#38BDF8] text-[11px] uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <ListChecks size={13} weight="bold" aria-hidden="true" />
                    <span>{tr('Recommended Drills', 'Bài tập đề xuất')}</span>
                  </h3>
                  <ul className="space-y-1.5 text-xs text-[#94A3B8]">
                    {report.recommendedDrills.map((drill, idx) => (
                      <li
                        key={idx}
                        className="p-2 rounded-[2px] bg-[#0A0D12] border border-[#232B3B] leading-relaxed"
                      >
                        {ts(drill)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* TAB 3: INTERACTIVE AI COACH Q&A */}
      {activeTab === 'CHAT' && (
        <div className="flex flex-col flex-1 min-h-[62vh] max-h-[76vh] justify-between gap-3">
          {!matchId ? (
            <p className="text-xs text-[#64748B]">
              {tr(
                'Select a match from the left sidebar to ask tactical questions with AI Coach.',
                'Chọn một trận đấu ở danh sách bên trái để bắt đầu hỏi đáp chiến thuật với AI Coach.'
              )}
            </p>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto tactical-scrollbar space-y-2.5 pr-1">
                {messages.length === 0 ? (
                  <div className="space-y-3">
                    <div className="p-3 rounded-[2px] bg-[#0A0D12] border border-[#232B3B] text-xs text-[#94A3B8] leading-relaxed">
                      {isEn ? (
                        <>
                          AI Coach indexed{' '}
                          <strong className="text-[#EEF2F6] font-mono">{rounds.length}</strong>{' '}
                          {isValo ? 'rounds' : 'zone phases'} on{' '}
                          <strong className="text-[#EEF2F6]">{mapName || gameType}</strong>. Ask
                          about any fight, rotation, or loadout decision.
                        </>
                      ) : (
                        <>
                          AI Coach đã đọc dữ liệu{' '}
                          <strong className="text-[#EEF2F6] font-mono">{rounds.length}</strong>{' '}
                          {isValo ? 'round' : 'giai đoạn vòng bo'} của trận{' '}
                          <strong className="text-[#EEF2F6]">{mapName || gameType}</strong>. Bạn
                          muốn phân tích tình huống nào?
                        </>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
                        {tr('Quick Tactical Prompts', 'Gợi ý câu hỏi nhanh')}
                      </p>
                      {quickPrompts.map((prompt) => (
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
                  {tr('Tactical question for AI Coach', 'Câu hỏi chiến thuật gửi AI Coach')}
                </label>
                <input
                  id="ai-coach-question"
                  type="text"
                  value={questionInput}
                  onChange={(e) => setQuestionInput(e.target.value)}
                  placeholder={tr(
                    'Ask about positioning, economy, rotations...',
                    'Hỏi về cách bắn, chọn súng, di chuyển...'
                  )}
                  disabled={sendingChat}
                  className="flex-1 min-w-0 px-3 py-2 rounded-[2px] bg-[#0A0D12] border border-[#232B3B] text-xs text-[#EEF2F6] placeholder:text-[#64748B] focus:outline-none focus:border-[#38BDF8]"
                />
                <button
                  type="submit"
                  aria-label={tr('Send question to AI Coach', 'Gửi câu hỏi cho AI Coach')}
                  disabled={sendingChat || !questionInput.trim()}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[2px] text-xs font-bold transition duration-150 shrink-0 disabled:opacity-40 active:translate-y-[1px] ${
                    isValo
                      ? 'bg-[#FF4655] hover:bg-rose-500 text-[#EEF2F6]'
                      : 'bg-[#E59A23] hover:bg-amber-400 text-[#0A0D12]'
                  }`}
                >
                  <PaperPlaneRight size={14} weight="bold" aria-hidden="true" />
                  <span>{tr('Send', 'Gửi')}</span>
                </button>
              </form>
            </>
          )}
        </div>
      )}
    </section>
  );
};

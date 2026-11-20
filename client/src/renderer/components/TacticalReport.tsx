import React, { useMemo, useState } from 'react';
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
  activeRound: AnalyzedRoundUI | undefined;
  rounds?: AnalyzedRoundUI[];
  report: MatchReportUI | null;
}

const CATEGORY_BADGE_STYLES: Record<WeaponUsageStatUI['category'], string> = {
  AR: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  DMR: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  SR: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  SMG: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  LMG: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
  SG: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
  Pistol: 'bg-slate-700/40 text-slate-300 border-slate-600/40',
  Throwable: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
  Other: 'bg-slate-800 text-slate-300 border-slate-700',
};

export const TacticalReport: React.FC<TacticalReportProps> = ({
  gameType,
  activeRound,
  rounds = [],
  report,
}) => {
  const [activeTab, setActiveTab] = useState<'ROUND' | 'MATCH'>('ROUND');
  const isValo = gameType === 'VALORANT';

  const activeTabStyle = isValo
    ? 'bg-[#ff4655] text-white'
    : 'bg-amber-500 text-slate-950';

  // Tổng hợp vũ khí sử dụng xuyên suốt toàn bộ trận đấu cho tab AI Coach
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

  const roundWeapons = activeRound?.weaponStats || [];
  const maxRoundWeaponDmg = Math.max(1, ...roundWeapons.map((w) => w.damageDealt));

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 flex flex-col gap-4 h-full">
      <div className="grid grid-cols-2 gap-2 p-1 rounded-lg bg-slate-950 border border-slate-800">
        <button
          onClick={() => setActiveTab('ROUND')}
          className={`py-1.5 rounded-md text-xs font-bold transition ${
            activeTab === 'ROUND'
              ? activeTabStyle
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {isValo
            ? `Chi tiết Round ${activeRound ? `#${activeRound.roundNumber}` : ''}`
            : `Vòng bo ${activeRound ? `Phase ${activeRound.roundNumber}` : ''}`}
        </button>
        <button
          onClick={() => setActiveTab('MATCH')}
          className={`py-1.5 rounded-md text-xs font-bold transition ${
            activeTab === 'MATCH'
              ? activeTabStyle
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Tổng kết AI Coach
        </button>
      </div>

      {activeTab === 'ROUND' && (
        <div className="space-y-4 text-sm overflow-y-auto max-h-[78vh] pr-1">
          {!activeRound ? (
            <p className="text-slate-500 text-xs leading-relaxed">
              {isValo
                ? 'Chọn một trận đấu và round tương ứng để xem phân tích vũ khí, kinh tế và lỗi vị trí.'
                : 'Chọn một trận đấu và giai đoạn vòng bo để xem chi tiết vũ khí sử dụng và diễn biến giao tranh.'}
            </p>
          ) : (
            <>
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h3 className="font-bold text-base text-white">
                    {isValo ? `Round ${activeRound.roundNumber}` : `Vòng bo Phase ${activeRound.roundNumber}`}
                  </h3>
                  <p className="text-xs text-slate-400">
                    K/D/A: {activeRound.kills}/{activeRound.deaths}/{activeRound.assists} • Sát thương:{' '}
                    {activeRound.damageDealt}
                  </p>
                </div>
                <span
                  className={`px-2.5 py-1 rounded text-xs font-bold ${
                    activeRound.result === 'WIN' || activeRound.result === 'SURVIVED'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-rose-500/20 text-rose-400'
                  }`}
                >
                  {activeRound.result}
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                <span className="px-2.5 py-1 rounded bg-indigo-500/20 text-indigo-300 text-xs font-medium">
                  {isValo ? 'Kinh tế' : 'Giai đoạn'}: {activeRound.economyType}
                </span>
                <span className="px-2.5 py-1 rounded bg-sky-500/20 text-sky-300 text-xs font-medium">
                  Lối đánh: {activeRound.tacticalStyle}
                </span>
              </div>

              {/* Khối Vũ khí & Trang bị sử dụng trong giai đoạn / round */}
              <div className="space-y-2">
                <h4 className="font-semibold text-slate-300 text-xs uppercase tracking-wider">
                  {isValo ? 'Vũ khí trang bị trong Round' : `Vũ khí sử dụng ở Phase ${activeRound.roundNumber}`}
                </h4>

                {roundWeapons.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">
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
                          className="p-2.5 rounded-xl bg-slate-950/90 border border-slate-800/90 space-y-1.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold border ${
                                  CATEGORY_BADGE_STYLES[w.category] || CATEGORY_BADGE_STYLES.Other
                                }`}
                              >
                                {w.category === 'Throwable' ? 'NÉM' : w.category}
                              </span>
                              <span className="text-xs font-bold text-slate-100">
                                {w.weaponName}
                              </span>
                            </div>

                            {w.category === 'Throwable' ? (
                              <span className="text-[11px] font-semibold text-indigo-300">
                                Đã ném: {w.throwablesUsed || 1} quả
                              </span>
                            ) : (
                              <span className="text-[11px] font-bold text-amber-400">
                                {w.damageDealt} DMG
                              </span>
                            )}
                          </div>

                          {w.category !== 'Throwable' && (
                            <>
                              <div className="h-1.5 w-full rounded-full bg-slate-900 overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    isValo ? 'bg-[#ff4655]' : 'bg-amber-500'
                                  }`}
                                  style={{ width: `${dmgBarPercent}%` }}
                                />
                              </div>

                              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
                                <span>
                                  {w.damageDealt > 0
                                    ? `${w.hits} trúng đích • HS ${hsRate}%`
                                    : 'Mang trang bị (chưa khai hỏa)'}
                                </span>

                                <div className="flex items-center gap-2">
                                  {w.kills > 0 && (
                                    <span className="text-emerald-400 font-bold">
                                      {w.kills} Kill
                                    </span>
                                  )}
                                  {(w.maxKillDistanceMeters || 0) > 0 && (
                                    <span className="text-sky-400 font-mono">
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
                <h4 className="font-semibold text-emerald-400 text-xs uppercase tracking-wider mb-2">
                  Điểm làm tốt
                </h4>
                <ul className="space-y-1.5 text-slate-300 text-xs">
                  {activeRound.strengths.length > 0 ? (
                    activeRound.strengths.map((s, idx) => (
                      <li
                        key={idx}
                        className="p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-900/50"
                      >
                        {s}
                      </li>
                    ))
                  ) : (
                    <li className="text-slate-500 italic">Không có đột biến nổi bật ở giai đoạn này.</li>
                  )}
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-amber-400 text-xs uppercase tracking-wider mb-2">
                  Lỗi chiến thuật cần khắc phục
                </h4>
                <ul className="space-y-1.5 text-slate-300 text-xs">
                  {activeRound.mistakes.length > 0 ? (
                    activeRound.mistakes.map((m, idx) => (
                      <li
                        key={idx}
                        className="p-2.5 rounded-lg bg-amber-950/30 border border-amber-900/50"
                      >
                        {m}
                      </li>
                    ))
                  ) : (
                    <li className="text-slate-500 italic">Xử lý ổn định, không mắc lỗi vị trí.</li>
                  )}
                </ul>
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'MATCH' && (
        <div className="space-y-4 text-sm overflow-y-auto max-h-[78vh] pr-1">
          {!report ? (
            <p className="text-slate-500 text-xs">
              Chọn một trận đấu đã phân tích để xem đánh giá tổng quát từ AI Coach.
            </p>
          ) : (
            <>
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-300">Đánh giá tổng quan</p>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">{report.coachCommentary}</p>
                </div>
                <div
                  className={`ml-3 shrink-0 h-12 w-12 rounded-xl border flex items-center justify-center text-lg font-extrabold ${
                    isValo
                      ? 'bg-[#ff4655]/20 border-[#ff4655]/40 text-[#ff4655]'
                      : 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                  }`}
                >
                  {report.overallScore}
                </div>
              </div>

              {matchWeaponSummary.length > 0 && (
                <div>
                  <h4 className="font-semibold text-amber-400 text-xs uppercase tracking-wider mb-2">
                    Thống kê vũ khí cả trận
                  </h4>
                  <div className="space-y-1.5">
                    {matchWeaponSummary.slice(0, 5).map((w) => (
                      <div
                        key={w.weaponName}
                        className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-200">{w.weaponName}</span>
                          <span className="text-[10px] text-slate-500">{w.category}</span>
                        </div>
                        <div className="text-right text-[11px] text-slate-300">
                          {w.category === 'Throwable' ? (
                            <span>{w.throwablesUsed || 0} lần dùng</span>
                          ) : (
                            <span>
                              <strong className="text-amber-400">{w.damageDealt}</strong> DMG •{' '}
                              <strong className="text-emerald-400">{w.kills}</strong>K
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h4 className="font-semibold text-emerald-400 text-xs uppercase tracking-wider mb-1.5">
                  Điểm mạnh nổi bật
                </h4>
                <ul className="list-disc pl-4 space-y-1 text-xs text-slate-300">
                  {report.strengthsSummary.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-rose-400 text-xs uppercase tracking-wider mb-1.5">
                  Điểm yếu cần cải thiện
                </h4>
                <ul className="list-disc pl-4 space-y-1 text-xs text-slate-300">
                  {report.weaknessesSummary.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>

              {report.recommendedDrills.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sky-400 text-xs uppercase tracking-wider mb-1.5">
                    Bài tập đề xuất
                  </h4>
                  <ul className="list-disc pl-4 space-y-1 text-xs text-slate-300">
                    {report.recommendedDrills.map((drill, idx) => (
                      <li key={idx}>{drill}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};
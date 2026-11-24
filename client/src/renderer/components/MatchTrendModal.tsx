import React, { useMemo } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ChartBar, Crosshair, MapPin, TrendUp, X } from '@phosphor-icons/react';
import { useI18n } from '../i18n';

export interface TrendMatchInput {
  match_id: string;
  game_type: 'VALORANT' | 'PUBG';
  map_name: string;
  match_result: string;
  score_summary: string | null;
  played_at: string;
}

interface MatchTrendModalProps {
  isOpen: boolean;
  gameType: 'VALORANT' | 'PUBG';
  matches: TrendMatchInput[];
  onClose: () => void;
}

interface ParsedMatchPoint {
  matchId: string;
  mapName: string;
  result: string;
  isPositive: boolean;
  kills: number;
  damage: number;
  playedAt: string;
}

export const MatchTrendModal: React.FC<MatchTrendModalProps> = ({
  isOpen,
  gameType,
  matches,
  onClose,
}) => {
  const { tr } = useI18n();
  const reduceMotion = useReducedMotion();
  const isValo = gameType === 'VALORANT';

  const stats = useMemo(() => {
    const recent = matches.slice(0, 20);
    const parsed: ParsedMatchPoint[] = recent.map((m) => {
      const summary = String(m.score_summary || '');
      const resUpper = String(m.match_result || '').toUpperCase();
      const rankMatch = resUpper.match(/TOP\s*#?(\d+)/i);
      const isPositive = isValo
        ? resUpper === 'WIN' || resUpper.includes('VICTORY')
        : resUpper.includes('TOP #1') || (rankMatch ? Number(rankMatch[1]) <= 10 : false);

      let kills = 0;
      const pubgKills = summary.match(/(\d+)\s*Kills?/i);
      const valoKda = summary.match(/(\d+)\/(\d+)\/(\d+)\s*KDA/i);
      if (pubgKills) kills = Number(pubgKills[1]);
      else if (valoKda) kills = Number(valoKda[1]);

      const dmgMatch = summary.match(/(\d+)\s*DMG/i);
      const damage = dmgMatch ? Number(dmgMatch[1]) : 0;

      return {
        matchId: m.match_id,
        mapName: m.map_name || 'Unknown',
        result: m.match_result,
        isPositive,
        kills,
        damage,
        playedAt: m.played_at,
      };
    });

    const total = parsed.length;
    const positiveCount = parsed.filter((p) => p.isPositive).length;
    const winRatePct = total > 0 ? Math.round((positiveCount / total) * 100) : 0;
    const avgKills =
      total > 0 ? (parsed.reduce((sum, p) => sum + p.kills, 0) / total).toFixed(1) : '0.0';
    const maxKills = Math.max(1, ...parsed.map((p) => p.kills));

    const mapMap = new Map<string, { total: number; positive: number; kills: number }>();
    for (const p of parsed) {
      const prev = mapMap.get(p.mapName) || { total: 0, positive: 0, kills: 0 };
      prev.total += 1;
      if (p.isPositive) prev.positive += 1;
      prev.kills += p.kills;
      mapMap.set(p.mapName, prev);
    }

    const mapBreakdown = Array.from(mapMap.entries())
      .map(([mapName, v]) => ({
        mapName,
        total: v.total,
        winRate: Math.round((v.positive / v.total) * 100),
        avgKills: (v.kills / v.total).toFixed(1),
      }))
      .sort((a, b) => b.total - a.total);

    return {
      chronological: [...parsed].reverse(),
      total,
      positiveCount,
      winRatePct,
      avgKills,
      maxKills,
      mapBreakdown,
    };
  }, [matches, isValo]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="trend-modal-title"
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
            className="w-full max-w-4xl rounded-[4px] border border-[#334155] bg-[#10141C] shadow-2xl overflow-hidden flex flex-col max-h-[86vh]"
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
                  <TrendUp size={16} weight="bold" aria-hidden="true" />
                </div>
                <div>
                  <h2
                    id="trend-modal-title"
                    className="font-display text-base font-bold text-[#EEF2F6]"
                  >
                    {tr(
                      `Last 20 ${gameType} Matches Performance`,
                      `Biểu đồ phong độ 20 trận ${gameType} gần nhất`
                    )}
                  </h2>
                  <p className="text-xs text-[#94A3B8]">
                    {tr(
                      'Win/Top-10 rate, average eliminations, and map-by-map breakdown',
                      'Tổng hợp tỷ lệ thắng, số mạng hạ gục và hiệu suất theo bản đồ'
                    )}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label={tr('Close performance trend modal', 'Đóng biểu đồ phong độ')}
                className="inline-flex items-center gap-1 rounded-[2px] bg-[#171D28] hover:bg-[#232B3B] border border-[#232B3B] px-3 py-1.5 text-xs font-semibold text-[#94A3B8] hover:text-[#EEF2F6]"
              >
                <X size={14} weight="bold" aria-hidden="true" />
                <span>{tr('Close', 'Đóng')}</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto tactical-scrollbar p-6 space-y-5">
              {stats.total === 0 ? (
                <div className="rounded-[2px] border border-dashed border-[#232B3B] p-8 text-center text-xs text-[#64748B]">
                  {tr(
                    `No ${gameType} matches synced yet for trend analysis.`,
                    `Chưa có trận ${gameType} nào để thống kê phong độ.`
                  )}
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3.5 rounded-[2px] bg-[#0A0D12] border border-[#232B3B]">
                      <span className="font-mono text-[10px] text-[#64748B] block">
                        {tr('MATCHES', 'SỐ TRẬN')}
                      </span>
                      <span className="font-mono text-xl font-bold text-[#EEF2F6] tabular-nums">
                        {stats.total}/20
                      </span>
                    </div>
                    <div className="p-3.5 rounded-[2px] bg-[#0A0D12] border border-[#232B3B]">
                      <span className="font-mono text-[10px] text-[#64748B] block">
                        {isValo
                          ? tr('WIN RATE', 'TỶ LỆ THẮNG')
                          : tr('TOP 10 RATE', 'TỶ LỆ TOP 10')}
                      </span>
                      <span className="font-mono text-xl font-bold text-[#10B981] tabular-nums">
                        {stats.winRatePct}%
                      </span>
                    </div>
                    <div className="p-3.5 rounded-[2px] bg-[#0A0D12] border border-[#232B3B]">
                      <span className="font-mono text-[10px] text-[#64748B] block">
                        {tr('AVG KILLS', 'KILLS TRUNG BÌNH')}
                      </span>
                      <span className="font-mono text-xl font-bold text-[#E59A23] tabular-nums">
                        {stats.avgKills}
                      </span>
                    </div>
                    <div className="p-3.5 rounded-[2px] bg-[#0A0D12] border border-[#232B3B]">
                      <span className="font-mono text-[10px] text-[#64748B] block">
                        {isValo ? tr('VICTORIES', 'TRẬN THẮNG') : tr('TOP 10 FINISHES', 'ĐẠT TOP 10')}
                      </span>
                      <span className="font-mono text-xl font-bold text-[#38BDF8] tabular-nums">
                        {stats.positiveCount}
                      </span>
                    </div>
                  </div>

                  <div className="p-4 rounded-[4px] bg-[#0A0D12] border border-[#232B3B] space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-[#94A3B8] flex items-center gap-1.5">
                        <ChartBar size={14} weight="bold" aria-hidden="true" />
                        <span>
                          {tr(
                            'Kills per Match (Oldest to Latest)',
                            'Biểu đồ số Kill từng trận (cũ nhất đến mới nhất)'
                          )}
                        </span>
                      </h3>
                      <span className="font-mono text-[11px] text-[#64748B]">
                        {isValo
                          ? tr('Green: Win / Red: Loss', 'Xanh: Thắng / Đỏ: Thua')
                          : tr('Green: Top 10 / Red: Outside Top 10', 'Xanh: Top 10 / Đỏ: Ngoài Top 10')}
                      </span>
                    </div>

                    <div className="h-44 flex items-end gap-1.5 pt-4 border-b border-[#232B3B] pb-2">
                      {stats.chronological.map((pt, idx) => {
                        const pct = Math.max(12, Math.round((pt.kills / stats.maxKills) * 100));
                        return (
                          <div
                            key={pt.matchId + idx}
                            title={`${pt.mapName} - ${pt.result} (${pt.kills} Kills)`}
                            className="flex-1 h-full flex flex-col justify-end items-center gap-1 min-w-[14px]"
                          >
                            <span className="font-mono text-[10px] text-[#94A3B8] tabular-nums">
                              {pt.kills}
                            </span>
                            <div
                              style={{ height: `${pct}%` }}
                              className={`w-full rounded-t-[2px] transition-all ${
                                pt.isPositive ? 'bg-[#10B981]' : 'bg-[#F43F5E]/80'
                              }`}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-[#94A3B8] flex items-center gap-1.5">
                      <MapPin size={14} weight="bold" aria-hidden="true" />
                      <span>{tr('Performance by Map', 'Hiệu suất theo bản đồ')}</span>
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {stats.mapBreakdown.map((m) => (
                        <div
                          key={m.mapName}
                          className="p-3 rounded-[2px] bg-[#0A0D12] border border-[#232B3B] flex items-center justify-between gap-3"
                        >
                          <div>
                            <p className="font-display text-sm font-bold text-[#EEF2F6]">
                              {m.mapName}
                            </p>
                            <p className="font-mono text-[11px] text-[#64748B] tabular-nums">
                              {m.total} {tr('match(es)', 'trận')}
                            </p>
                          </div>
                          <div className="text-right font-mono text-xs tabular-nums">
                            <p className="font-bold text-[#10B981]">{m.winRate}% Win</p>
                            <p className="text-[#E59A23] inline-flex items-center gap-1 justify-end">
                              <Crosshair size={11} weight="bold" aria-hidden="true" />
                              <span>
                                {m.avgKills} {tr('K/match', 'K/trận')}
                              </span>
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

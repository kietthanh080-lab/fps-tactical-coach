import React, { useState } from 'react';
import { Crosshair, Funnel, WarningCircle } from '@phosphor-icons/react';

export interface WeaponUsageStatUI {
  weaponName: string;
  category: 'AR' | 'DMR' | 'SR' | 'SMG' | 'LMG' | 'SG' | 'Pistol' | 'Throwable' | 'Other';
  kills: number;
  headshots: number;
  damageDealt: number;
  hits: number;
  throwablesUsed?: number;
  maxKillDistanceMeters?: number;
}

export interface AnalyzedRoundUI {
  roundNumber: number;
  kills: number;
  deaths: number;
  assists: number;
  damageDealt: number;
  result: string;
  economyType: string;
  tacticalStyle: string;
  weaponStats?: WeaponUsageStatUI[];
  strengths: string[];
  mistakes: string[];
  timestampSec?: number;
  startTimeSec?: number;
}

interface RoundTimelineProps {
  gameType: 'VALORANT' | 'PUBG';
  rounds: AnalyzedRoundUI[];
  selectedRound: number;
  onSelectRound: (roundNumber: number) => void;
}

type RoundFilter = 'ALL' | 'KILLS' | 'MISTAKES';

export const RoundTimeline: React.FC<RoundTimelineProps> = ({
  gameType,
  rounds,
  selectedRound,
  onSelectRound,
}) => {
  const [filter, setFilter] = useState<RoundFilter>('ALL');
  const isValo = gameType === 'VALORANT';

  const filteredRounds = rounds.filter((r) => {
    if (filter === 'KILLS') return r.kills > 0;
    if (filter === 'MISTAKES') return r.mistakes.length > 0 || r.deaths > 0;
    return true;
  });

  const killRoundsCount = rounds.filter((r) => r.kills > 0).length;
  const mistakeRoundsCount = rounds.filter((r) => r.mistakes.length > 0 || r.deaths > 0).length;

  return (
    <section
      aria-label={isValo ? 'Ma tran dien bien Round' : 'Ma tran dien bien Phase'}
      className="border border-[#232B3B] bg-[#10141C] rounded-[4px] p-4 space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#232B3B] pb-3">
        <div className="flex items-center gap-2.5">
          <div
            className={`h-7 w-7 rounded-[2px] flex items-center justify-center border ${
              isValo
                ? 'bg-[#FF4655]/10 border-[#FF4655]/40 text-[#FF4655]'
                : 'bg-[#E59A23]/10 border-[#E59A23]/40 text-[#E59A23]'
            }`}
          >
            <Funnel size={15} weight="bold" aria-hidden="true" />
          </div>
          <div>
            <h3 className="font-display text-sm font-bold tracking-tight text-[#EEF2F6]">
              {isValo ? 'Diễn biến từng Round' : 'Diễn biến từng Giai đoạn Vòng Bo (Phase)'}
            </h3>
            <p className="text-[11px] text-[#94A3B8] leading-snug">
              Chọn mốc để tua video và xem phân tích vũ khí, lỗi vị trí bên phải
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1 bg-[#0A0D12] border border-[#232B3B] p-1 rounded-[2px] text-[11px] font-mono">
          <button
            type="button"
            onClick={() => setFilter('ALL')}
            className={`px-2.5 py-1.5 rounded-[2px] font-bold transition duration-150 active:translate-y-[1px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38BDF8] ${
              filter === 'ALL'
                ? isValo
                  ? 'bg-[#FF4655] text-[#EEF2F6]'
                  : 'bg-[#E59A23] text-[#0A0D12]'
                : 'text-[#94A3B8] hover:text-[#EEF2F6] hover:bg-[#171D28]'
            }`}
          >
            Tất cả ({rounds.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('KILLS')}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[2px] font-bold transition duration-150 active:translate-y-[1px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#10B981] ${
              filter === 'KILLS'
                ? 'bg-[#10B981] text-[#0A0D12]'
                : 'text-[#94A3B8] hover:text-[#EEF2F6] hover:bg-[#171D28]'
            }`}
          >
            <Crosshair size={12} weight="bold" aria-hidden="true" />
            <span>Có Kill ({killRoundsCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setFilter('MISTAKES')}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[2px] font-bold transition duration-150 active:translate-y-[1px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F43F5E] ${
              filter === 'MISTAKES'
                ? 'bg-[#F43F5E] text-[#EEF2F6]'
                : 'text-[#94A3B8] hover:text-[#EEF2F6] hover:bg-[#171D28]'
            }`}
          >
            <WarningCircle size={12} weight="bold" aria-hidden="true" />
            <span>Rút kinh nghiệm ({mistakeRoundsCount})</span>
          </button>
        </div>
      </div>

      {filteredRounds.length === 0 ? (
        <div className="border border-dashed border-[#232B3B] bg-[#0A0D12]/60 rounded-[2px] py-6 text-center text-xs text-[#64748B]">
          {rounds.length === 0
            ? 'Trận đấu này chưa có dữ liệu chi tiết từng giai đoạn.'
            : 'Không có giai đoạn nào khớp bộ lọc đang chọn.'}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-60 overflow-y-auto tactical-scrollbar pr-1">
          {filteredRounds.map((r) => {
            const isSelected = r.roundNumber === selectedRound;
            const isPositive = r.result === 'WIN' || r.result === 'SURVIVED';
            const hasKills = r.kills > 0;
            const hasMistakes = r.mistakes.length > 0;

            return (
              <button
                key={r.roundNumber}
                type="button"
                onClick={() => onSelectRound(r.roundNumber)}
                className={`relative p-2.5 rounded-[2px] border text-left transition duration-150 active:translate-y-[1px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38BDF8] space-y-1.5 ${
                  isSelected
                    ? isValo
                      ? 'bg-[#FF4655]/12 border-[#FF4655]'
                      : 'bg-[#E59A23]/12 border-[#E59A23]'
                    : 'bg-[#0A0D12] border-[#232B3B] hover:border-[#334155] hover:bg-[#171D28]'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="font-display text-xs font-bold text-[#EEF2F6]">
                    {isValo ? `R${String(r.roundNumber).padStart(2, '0')}` : `Phase ${r.roundNumber}`}
                  </span>
                  <span
                    className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded-[2px] border ${
                      isPositive
                        ? 'bg-[#10B981]/10 border-[#10B981]/30 text-[#10B981]'
                        : 'bg-[#F43F5E]/10 border-[#F43F5E]/30 text-[#F43F5E]'
                    }`}
                  >
                    {r.result}
                  </span>
                </div>

                <div className="flex items-center justify-between font-mono text-[11px] tabular-nums">
                  <span className={hasKills ? 'font-bold text-[#10B981]' : 'text-[#94A3B8]'}>
                    {r.kills}/{r.deaths}/{r.assists}
                  </span>
                  <span className="text-[#94A3B8]">{r.damageDealt} DMG</span>
                </div>

                <div className="flex items-center justify-between text-[10px] text-[#64748B] pt-1 border-t border-[#232B3B]/70">
                  <span className="truncate font-mono">{r.economyType}</span>
                  {hasMistakes && (
                    <span className="text-[#E59A23] font-semibold shrink-0">
                      {r.mistakes.length} lưu ý
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
};

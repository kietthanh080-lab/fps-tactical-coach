import React, { useState } from 'react';

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

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            {isValo ? 'Diễn biến từng Round' : 'Diễn biến từng Giai đoạn Vòng Bo (Phase)'}
          </h3>
          <p className="text-[11px] text-slate-500">
            Chọn mốc để tua video và xem phân tích vũ khí, lỗi vị trí bên phải
          </p>
        </div>

        <div className="flex items-center gap-1 rounded-lg bg-slate-950 border border-slate-800 p-1 text-[11px]">
          <button
            type="button"
            onClick={() => setFilter('ALL')}
            className={`px-2.5 py-1 rounded-md font-bold transition ${
              filter === 'ALL'
                ? isValo
                  ? 'bg-[#ff4655] text-white'
                  : 'bg-amber-500 text-slate-950'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Tất cả ({rounds.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('KILLS')}
            className={`px-2.5 py-1 rounded-md font-bold transition ${
              filter === 'KILLS'
                ? 'bg-emerald-500 text-slate-950'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Có Kill ({rounds.filter((r) => r.kills > 0).length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('MISTAKES')}
            className={`px-2.5 py-1 rounded-md font-bold transition ${
              filter === 'MISTAKES'
                ? 'bg-rose-500 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Cần rút kinh nghiệm ({rounds.filter((r) => r.mistakes.length > 0 || r.deaths > 0).length})
          </button>
        </div>
      </div>

      {filteredRounds.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-800 py-5 text-center text-xs text-slate-500">
          {rounds.length === 0
            ? 'Trận đấu này chưa có dữ liệu chi tiết từng giai đoạn.'
            : 'Không có giai đoạn nào khớp bộ lọc đang chọn.'}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-56 overflow-y-auto pr-1">
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
                className={`p-2.5 rounded-xl border text-left transition space-y-1 ${
                  isSelected
                    ? isValo
                      ? 'bg-[#ff4655]/15 border-[#ff4655] shadow-sm'
                      : 'bg-amber-500/15 border-amber-500 shadow-sm'
                    : 'bg-slate-950/80 border-slate-800/90 hover:border-slate-700 hover:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-extrabold text-white">
                    {isValo ? `R${r.roundNumber}` : `Phase ${r.roundNumber}`}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      isPositive
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : 'bg-rose-500/15 text-rose-400'
                    }`}
                  >
                    {r.result}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px]">
                  <span className={hasKills ? 'font-bold text-emerald-400' : 'text-slate-400'}>
                    {r.kills}/{r.deaths}/{r.assists} KDA
                  </span>
                  <span className="text-slate-400 font-mono">{r.damageDealt} DMG</span>
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
                  <span className="truncate">{r.economyType}</span>
                  {hasMistakes && (
                    <span className="text-amber-400 font-semibold shrink-0">
                      {r.mistakes.length} lưu ý
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
import React from 'react';
import { TimelineEvent } from '../services/localDb';

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
  startTimestampMs: number;
  endTimestampMs: number;
  result: 'WIN' | 'LOSS' | 'SURVIVED' | 'ELIMINATED';
  economyType: string;
  tacticalStyle: string;
  kills: number;
  deaths: number;
  assists: number;
  damageDealt: number;
  strengths: string[];
  mistakes: string[];
  weaponStats?: WeaponUsageStatUI[];
  events: TimelineEvent[];
}

interface RoundTimelineProps {
  gameType: 'VALORANT' | 'PUBG';
  rounds: AnalyzedRoundUI[];
  selectedRound: number;
  onSeekToMs: (timestampMs: number, roundNumber: number) => void;
}

function formatTimeMs(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export const RoundTimeline: React.FC<RoundTimelineProps> = ({
  gameType,
  rounds,
  selectedRound,
  onSeekToMs,
}) => {
  const isValo = gameType === 'VALORANT';
  const activeRound = rounds.find((r) => r.roundNumber === selectedRound);

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
          {isValo ? 'Danh sách Round (Click để tua video)' : 'Các giai đoạn Vòng bo (Click để tua video)'}
        </span>
        {activeRound && (
          <span className="text-xs text-slate-400 font-mono">
            {formatTimeMs(activeRound.startTimestampMs)} — {formatTimeMs(activeRound.endTimestampMs)}
          </span>
        )}
      </div>

      {rounds.length === 0 ? (
        <p className="text-xs text-slate-500 py-1">
          {isValo
            ? 'Chưa có dữ liệu round cho trận VALORANT này.'
            : 'Chưa có dữ liệu giai đoạn vòng bo cho trận PUBG này.'}
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {rounds.map((r) => {
            const isSelected = r.roundNumber === selectedRound;
            const isPositive = r.result === 'WIN' || r.result === 'SURVIVED';
            const selectedStyle = isValo
              ? 'bg-[#ff4655] border-rose-400 text-white shadow-lg shadow-rose-600/20'
              : 'bg-amber-500 border-amber-300 text-slate-950 shadow-lg shadow-amber-500/20';

            return (
              <button
                key={r.roundNumber}
                onClick={() => onSeekToMs(r.startTimestampMs, r.roundNumber)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition flex items-center gap-1.5 ${
                  isSelected
                    ? selectedStyle
                    : isPositive
                    ? 'bg-slate-950 border-emerald-800/70 text-emerald-400 hover:bg-slate-800'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800'
                }`}
              >
                <span>{isValo ? `R${r.roundNumber}` : `Bo ${r.roundNumber}`}</span>
                {r.kills > 0 && (
                  <span
                    className={`px-1.5 py-0.2 rounded text-[10px] ${
                      isSelected && !isValo
                        ? 'bg-slate-950/20 text-slate-950'
                        : 'bg-emerald-500/20 text-emerald-300'
                    }`}
                  >
                    {r.kills}K
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {activeRound && activeRound.events.length > 0 && (
        <div className="pt-2.5 border-t border-slate-800/80 flex items-center gap-2 flex-wrap">
          <span className="text-xs text-slate-500">
            Mốc sự kiện ({isValo ? `Round ${activeRound.roundNumber}` : `Phase ${activeRound.roundNumber}`}):
          </span>
          {activeRound.events.map((ev, index) => {
            let badgeStyle = 'bg-slate-800 text-slate-300 border-slate-700';
            let label: string = ev.type;
            const weapon = ev.payload?.weapon ? String(ev.payload.weapon) : '';
            const dist =
              typeof ev.payload?.distanceMeters === 'number' && ev.payload.distanceMeters > 0
                ? `${ev.payload.distanceMeters}m`
                : '';

            if (ev.type === 'KILL') {
              badgeStyle = 'bg-emerald-500/15 text-emerald-300 border-emerald-700/50';
              const detailParts = [weapon, dist].filter(Boolean).join(' • ');
              label = detailParts ? `Hạ gục (${detailParts})` : 'Hạ gục';
            } else if (ev.type === 'DEATH') {
              badgeStyle = 'bg-rose-500/15 text-rose-300 border-rose-700/50';
              const detailParts = [weapon, dist].filter(Boolean).join(' • ');
              label = detailParts ? `Bị hạ bởi ${detailParts}` : 'Bị hạ gục';
            } else if (ev.type === 'SPIKE_PLANTED') {
              badgeStyle = 'bg-amber-500/15 text-amber-300 border-amber-700/50';
              label = 'Đặt Spike';
            } else if (ev.type === 'ROUND_START') {
              label = isValo ? 'Bắt đầu Round' : 'Thu bo';
            }

            return (
              <button
                key={`${ev.type}-${ev.timestampMs}-${index}`}
                onClick={() => onSeekToMs(Math.max(0, ev.timestampMs - 3000), activeRound.roundNumber)}
                className={`px-2.5 py-1 rounded-md text-xs border transition hover:brightness-125 ${badgeStyle}`}
                title="Tua tới 3 giây trước khi sự kiện diễn ra"
              >
                {label} • {formatTimeMs(ev.timestampMs)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
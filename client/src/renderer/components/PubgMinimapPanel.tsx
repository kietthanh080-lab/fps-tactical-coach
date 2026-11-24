import React, { useMemo, useState } from 'react';
import { Crosshair, MapTrifold, Skull, Target } from '@phosphor-icons/react';
import { useI18n } from '../i18n';
import { PubgMapTelemetrySummary } from '../services/localDb';

interface PubgMinimapPanelProps {
  mapName: string;
  telemetry: PubgMapTelemetrySummary | null;
  selectedPhase?: number;
}

export const PubgMinimapPanel: React.FC<PubgMinimapPanelProps> = ({
  mapName,
  telemetry,
  selectedPhase,
}) => {
  const { tr, ts } = useI18n();
  const [hoveredInfo, setHoveredInfo] = useState<string | null>(null);
  const [showAllZones, setShowAllZones] = useState(true);

  const scale = useMemo(() => {
    const size = Math.max(100000, telemetry?.mapSizeCm || 816000);
    return 400 / size;
  }, [telemetry?.mapSizeCm]);

  if (
    !telemetry ||
    (telemetry.path.length === 0 && telemetry.kills.length === 0 && telemetry.deaths.length === 0)
  ) {
    return (
      <div className="rounded-[4px] border border-[#232B3B] bg-[#0A0D12] p-3 text-xs text-[#64748B] space-y-1.5">
        <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold text-[#94A3B8]">
          <MapTrifold size={14} weight="bold" aria-hidden="true" />
          <span>
            {tr(
              `2D MOVEMENT & SAFE ZONE MAP (${mapName})`,
              `BẢN ĐỒ DI CHUYỂN & VÒNG BO 2D (${mapName})`
            )}
          </span>
        </div>
        <p className="leading-relaxed">
          {tr(
            'No coordinate telemetry saved for this match yet. Newly synced PUBG matches automatically capture movement paths, safe zones, and eliminations.',
            'Chưa có dữ liệu tọa độ cho trận này. Các trận PUBG đồng bộ mới sẽ tự động lưu tuyến đường di chuyển, vòng bo và điểm hạ gục.'
          )}
        </p>
      </div>
    );
  }

  const pathPoints = telemetry.path
    .map((p) => `${(p.x * scale).toFixed(1)},${(p.y * scale).toFixed(1)}`)
    .join(' ');

  const visibleZones = showAllZones
    ? telemetry.safeZones
    : telemetry.safeZones.filter((z) => z.phase === selectedPhase);

  return (
    <div className="rounded-[4px] border border-[#232B3B] bg-[#0A0D12] p-3 space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold text-[#E59A23]">
          <MapTrifold size={14} weight="bold" aria-hidden="true" />
          <span>
            {tr('2D MINIMAP', 'SƠ ĐỒ 2D')} - {mapName.toUpperCase()}
          </span>
        </span>
        <button
          type="button"
          onClick={() => setShowAllZones((prev) => !prev)}
          className="px-2 py-0.5 rounded-[2px] bg-[#171D28] hover:bg-[#232B3B] border border-[#232B3B] font-mono text-[10px] text-[#94A3B8]"
        >
          {showAllZones
            ? tr('All Safe Zones', 'Tất cả vòng bo')
            : tr(`Phase ${selectedPhase || 1} Only`, `Chỉ Bo ${selectedPhase || 1}`)}
        </button>
      </div>

      <div className="relative rounded-[2px] border border-[#232B3B] bg-[#0B1017] overflow-hidden">
        <svg
          viewBox="0 0 400 400"
          className="w-full h-auto block select-none"
          role="img"
          aria-label={tr(
            `2D movement path and safe zone map for ${mapName}`,
            `Bản đồ 2D đường di chuyển và vòng bo trận ${mapName}`
          )}
        >
          {[50, 100, 150, 200, 250, 300, 350].map((pos) => (
            <React.Fragment key={pos}>
              <line x1={pos} y1={0} x2={pos} y2={400} stroke="#1B2332" strokeWidth={0.8} />
              <line x1={0} y1={pos} x2={400} y2={pos} stroke="#1B2332" strokeWidth={0.8} />
            </React.Fragment>
          ))}

          {visibleZones.map((z) => (
            <circle
              key={z.phase}
              cx={z.x * scale}
              cy={z.y * scale}
              r={Math.max(4, z.radius * scale)}
              fill="none"
              stroke={z.phase === selectedPhase ? '#38BDF8' : 'rgba(148, 163, 184, 0.35)'}
              strokeWidth={z.phase === selectedPhase ? 1.8 : 1}
              strokeDasharray={z.phase === selectedPhase ? undefined : '4 3'}
            />
          ))}

          {pathPoints && (
            <polyline
              points={pathPoints}
              fill="none"
              stroke="#E59A23"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.88}
            />
          )}

          {telemetry.path[0] && (
            <circle
              cx={telemetry.path[0].x * scale}
              cy={telemetry.path[0].y * scale}
              r={4}
              fill="#38BDF8"
              stroke="#0A0D12"
              strokeWidth={1}
            />
          )}

          {telemetry.kills.map((k, idx) => (
            <g
              key={`k-${idx}`}
              onMouseEnter={() =>
                setHoveredInfo(
                  tr(
                    `Kill (Phase ${k.phase || '?'}): ${k.label || 'Eliminated enemy'}`,
                    `Kill Bo ${k.phase || '?'}: ${k.label || 'Hạ gục đối thủ'}`
                  )
                )
              }
              onMouseLeave={() => setHoveredInfo(null)}
              className="cursor-pointer"
            >
              <circle
                cx={k.x * scale}
                cy={k.y * scale}
                r={5.5}
                fill="#10B981"
                stroke="#0A0D12"
                strokeWidth={1.5}
              />
            </g>
          ))}

          {telemetry.deaths.map((d, idx) => (
            <g
              key={`d-${idx}`}
              onMouseEnter={() =>
                setHoveredInfo(
                  tr(
                    `Eliminated (Phase ${d.phase || '?'}): ${ts(d.label, 'Eliminated')}`,
                    `Bị hạ ở Bo ${d.phase || '?'}: ${d.label || 'Bị hạ gục'}`
                  )
                )
              }
              onMouseLeave={() => setHoveredInfo(null)}
              className="cursor-pointer"
            >
              <circle
                cx={d.x * scale}
                cy={d.y * scale}
                r={6}
                fill="#FF4655"
                stroke="#0A0D12"
                strokeWidth={1.5}
              />
            </g>
          ))}
        </svg>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono text-[#94A3B8]">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#38BDF8]" aria-hidden="true" />
            <span>{tr('Drop / Start', 'Hạ cánh')}</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <Target size={11} weight="bold" className="text-[#10B981]" aria-hidden="true" />
            <span>Kill ({telemetry.kills.length})</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <Skull size={11} weight="bold" className="text-[#FF4655]" aria-hidden="true" />
            <span>
              {tr('Deaths', 'Bị hạ')} ({telemetry.deaths.length})
            </span>
          </span>
        </div>
        <span className="inline-flex items-center gap-1 text-[#E59A23]">
          <Crosshair size={11} weight="bold" aria-hidden="true" />
          <span>
            {telemetry.safeZones.length} {tr('zones', 'vòng bo')}
          </span>
        </span>
      </div>

      {hoveredInfo && (
        <p className="font-mono text-[11px] text-[#38BDF8] bg-[#10141C] border border-[#232B3B] px-2 py-1 rounded-[2px]">
          {hoveredInfo}
        </p>
      )}
    </div>
  );
};

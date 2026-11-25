import React, { useEffect, useId, useMemo, useState } from 'react';
import {
  Crosshair,
  Fire,
  MapTrifold,
  Pause,
  Play,
  Skull,
  Target,
} from '@phosphor-icons/react';
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
  const uid = useId().replace(/:/g, '');
  const [hoveredInfo, setHoveredInfo] = useState<string | null>(null);
  const [showAllZones, setShowAllZones] = useState(true);
  // Inspired by ZeroDaylight0/PUBG-tracker & YORZ/PUBG-heatmap-frontend:
  // Animated 2D route scrubber + Combat Heatmap overlay
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [scrubPct, setScrubPct] = useState<number>(100);
  const [isPlayingRoute, setIsPlayingRoute] = useState(false);

  useEffect(() => {
    setIsPlayingRoute(false);
    setScrubPct(100);
  }, [telemetry, mapName]);

  useEffect(() => {
    if (!isPlayingRoute) return;
    const timer = window.setInterval(() => {
      setScrubPct((prev) => {
        if (prev >= 100) {
          setIsPlayingRoute(false);
          return 100;
        }
        return Math.min(100, prev + 4);
      });
    }, 120);
    return () => window.clearInterval(timer);
  }, [isPlayingRoute]);

  const scale = useMemo(() => {
    const size = Math.max(100000, telemetry?.mapSizeCm || 816000);
    return 400 / size;
  }, [telemetry?.mapSizeCm]);

  const totalDistanceKm = useMemo(() => {
    if (!telemetry || telemetry.path.length < 2) return '0.0';
    let distCm = 0;
    for (let i = 1; i < telemetry.path.length; i += 1) {
      const dx = telemetry.path[i].x - telemetry.path[i - 1].x;
      const dy = telemetry.path[i].y - telemetry.path[i - 1].y;
      distCm += Math.hypot(dx, dy);
    }
    return (distCm / 100000).toFixed(2);
  }, [telemetry]);

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

  const totalPts = telemetry.path.length;
  const visiblePtCount =
    totalPts > 0 ? Math.max(1, Math.round((scrubPct / 100) * totalPts)) : 0;
  const slicedPath = telemetry.path.slice(0, visiblePtCount);
  const currentHead = slicedPath[slicedPath.length - 1] || telemetry.path[0] || null;

  const fullPathPoints = telemetry.path
    .map((p) => `${(p.x * scale).toFixed(1)},${(p.y * scale).toFixed(1)}`)
    .join(' ');
  const activePathPoints = slicedPath
    .map((p) => `${(p.x * scale).toFixed(1)},${(p.y * scale).toFixed(1)}`)
    .join(' ');

  const visibleZones = showAllZones
    ? telemetry.safeZones
    : telemetry.safeZones.filter((z) => z.phase === selectedPhase);

  const maxVisiblePhase =
    scrubPct >= 99
      ? 99
      : Math.max(1, Math.ceil((scrubPct / 100) * Math.max(7, telemetry.safeZones.length || 7)));

  const togglePlayRoute = () => {
    if (isPlayingRoute) {
      setIsPlayingRoute(false);
      return;
    }
    if (scrubPct >= 100) {
      setScrubPct(4);
    }
    setIsPlayingRoute(true);
  };

  return (
    <div className="rounded-[4px] border border-[#232B3B] bg-[#0A0D12] p-3 space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold text-[#E59A23]">
          <MapTrifold size={14} weight="bold" aria-hidden="true" />
          <span>
            {tr('2D TELEMETRY', 'SƠ ĐỒ 2D')} - {mapName.toUpperCase()}
          </span>
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-pressed={showHeatmap}
            onClick={() => setShowHeatmap((prev) => !prev)}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-[2px] border font-mono text-[10px] font-bold transition ${
              showHeatmap
                ? 'bg-[#FF4655]/20 border-[#FF4655]/50 text-[#FF4655]'
                : 'bg-[#171D28] hover:bg-[#232B3B] border-[#232B3B] text-[#94A3B8]'
            }`}
          >
            <Fire size={11} weight="fill" aria-hidden="true" />
            <span>{tr('Heatmap', 'Bản đồ nhiệt')}</span>
          </button>
          <button
            type="button"
            onClick={() => setShowAllZones((prev) => !prev)}
            className="px-2 py-0.5 rounded-[2px] bg-[#171D28] hover:bg-[#232B3B] border border-[#232B3B] font-mono text-[10px] text-[#94A3B8]"
          >
            {showAllZones
              ? tr('All Zones', 'Tất cả bo')
              : tr(`Phase ${selectedPhase || 1}`, `Chỉ Bo ${selectedPhase || 1}`)}
          </button>
        </div>
      </div>

      <div className="relative rounded-[2px] border border-[#232B3B] bg-[#0B1017] overflow-hidden">
        <svg
          viewBox="0 0 400 400"
          className="w-full h-auto block select-none"
          role="img"
          aria-label={tr(
            `2D movement path, heatmap, and safe zone map for ${mapName}`,
            `Bản đồ 2D đường di chuyển, nhiệt độ giao tranh và vòng bo trận ${mapName}`
          )}
        >
          <defs>
            <radialGradient id={`heat-kill-${uid}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#10B981" stopOpacity="0.55" />
              <stop offset="50%" stopColor="#E59A23" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#E59A23" stopOpacity="0" />
            </radialGradient>
            <radialGradient id={`heat-death-${uid}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#FF4655" stopOpacity="0.65" />
              <stop offset="55%" stopColor="#F43F5E" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#FF4655" stopOpacity="0" />
            </radialGradient>
            <radialGradient id={`heat-dwell-${uid}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#38BDF8" stopOpacity="0" />
            </radialGradient>
          </defs>

          {[50, 100, 150, 200, 250, 300, 350].map((pos) => (
            <React.Fragment key={pos}>
              <line x1={pos} y1={0} x2={pos} y2={400} stroke="#1B2332" strokeWidth={0.8} />
              <line x1={0} y1={pos} x2={400} y2={pos} stroke="#1B2332" strokeWidth={0.8} />
            </React.Fragment>
          ))}

          {/* Combat & Dwell Heatmap Layer */}
          {showHeatmap && (
            <g pointerEvents="none">
              {slicedPath
                .filter((_, idx) => idx % 3 === 0)
                .map((pt, idx) => (
                  <circle
                    key={`dw-${idx}`}
                    cx={pt.x * scale}
                    cy={pt.y * scale}
                    r={22}
                    fill={`url(#heat-dwell-${uid})`}
                  />
                ))}
              {telemetry.kills.map((k, idx) => (
                <circle
                  key={`hk-${idx}`}
                  cx={k.x * scale}
                  cy={k.y * scale}
                  r={34}
                  fill={`url(#heat-kill-${uid})`}
                />
              ))}
              {telemetry.deaths.map((d, idx) => (
                <circle
                  key={`hd-${idx}`}
                  cx={d.x * scale}
                  cy={d.y * scale}
                  r={38}
                  fill={`url(#heat-death-${uid})`}
                />
              ))}
            </g>
          )}

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

          {fullPathPoints && scrubPct < 100 && (
            <polyline
              points={fullPathPoints}
              fill="none"
              stroke="#334155"
              strokeWidth={1.5}
              strokeDasharray="3 3"
              opacity={0.6}
            />
          )}

          {activePathPoints && (
            <polyline
              points={activePathPoints}
              fill="none"
              stroke="#E59A23"
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.92}
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

          {/* Live Scrubbing Player Beacon */}
          {currentHead && scrubPct < 100 && (
            <g pointerEvents="none">
              <circle
                cx={currentHead.x * scale}
                cy={currentHead.y * scale}
                r={8}
                fill="rgba(229, 154, 35, 0.25)"
              />
              <circle
                cx={currentHead.x * scale}
                cy={currentHead.y * scale}
                r={3.8}
                fill="#EEF2F6"
                stroke="#E59A23"
                strokeWidth={1.6}
              />
            </g>
          )}

          {telemetry.kills
            .filter((k) => (k.phase || 1) <= maxVisiblePhase)
            .map((k, idx) => (
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

          {telemetry.deaths
            .filter((d) => (d.phase || 1) <= maxVisiblePhase)
            .map((d, idx) => (
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

      {/* 2D Route Replay Scrubber */}
      {telemetry.path.length > 1 && (
        <div className="flex items-center gap-2 rounded-[2px] bg-[#10141C] border border-[#232B3B] px-2 py-1.5">
          <button
            type="button"
            onClick={togglePlayRoute}
            aria-label={
              isPlayingRoute
                ? tr('Pause 2D route replay', 'Tạm dừng phát lộ trình 2D')
                : tr('Play 2D route replay', 'Phát lại lộ trình di chuyển 2D')
            }
            className="p-1 rounded-[2px] bg-[#171D28] hover:bg-[#232B3B] border border-[#232B3B] text-[#E59A23]"
          >
            {isPlayingRoute ? (
              <Pause size={11} weight="bold" aria-hidden="true" />
            ) : (
              <Play size={11} weight="bold" aria-hidden="true" />
            )}
          </button>
          <label htmlFor={`minimap-scrub-${uid}`} className="sr-only">
            {tr('Scrub 2D movement progress', 'Tua tiến độ di chuyển trên bản đồ 2D')}
          </label>
          <input
            id={`minimap-scrub-${uid}`}
            type="range"
            min={5}
            max={100}
            value={scrubPct}
            onChange={(e) => {
              setIsPlayingRoute(false);
              setScrubPct(Number(e.target.value));
            }}
            className="flex-1 accent-[#E59A23] h-1.5 cursor-pointer"
          />
          <span className="font-mono text-[10px] text-[#94A3B8] tabular-nums w-9 text-right">
            {scrubPct}%
          </span>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono text-[#94A3B8]">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#38BDF8]" aria-hidden="true" />
            <span>{tr('Drop', 'Nhảy dù')}</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <Target size={11} weight="bold" className="text-[#10B981]" aria-hidden="true" />
            <span>Kill ({telemetry.kills.length})</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <Skull size={11} weight="bold" className="text-[#FF4655]" aria-hidden="true" />
            <span>
              {tr('Death', 'Bị hạ')} ({telemetry.deaths.length})
            </span>
          </span>
        </div>
        <span className="inline-flex items-center gap-1 text-[#E59A23] tabular-nums">
          <Crosshair size={11} weight="bold" aria-hidden="true" />
          <span>
            {totalDistanceKm} km | {telemetry.safeZones.length} {tr('zones', 'bo')}
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

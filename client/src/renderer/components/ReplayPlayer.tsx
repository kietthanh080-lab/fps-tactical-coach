import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowCounterClockwise,
  ArrowUpRight,
  Circle,
  FastForward,
  Pause,
  PencilSimple,
  Play,
  Rewind,
  Trash,
  UploadSimple,
  VideoCamera,
} from '@phosphor-icons/react';
import { AnalyzedRoundUI, RoundTimeline } from './RoundTimeline';
import { uploadMatchHighlight } from '../services/localDb';

interface ReplayPlayerProps {
  gameType: 'VALORANT' | 'PUBG';
  matchId: string | null;
  hasSelectedMatch: boolean;
  videoSrc: string | null;
  matchTitle: string;
  rounds: AnalyzedRoundUI[];
  selectedRound: number;
  onSelectRound: (roundNumber: number) => void;
  onHighlightSaved?: (cloudUrl: string) => void;
}

type DrawTool = 'arrow' | 'circle' | 'pen';

interface NormalizedPoint {
  x: number;
  y: number;
}

interface DrawShape {
  tool: DrawTool;
  color: string;
  points: NormalizedPoint[];
}

interface TimelineMarker {
  roundNumber: number;
  timestampSec: number;
  type: 'kill' | 'death' | 'objective';
  label: string;
}

const TACTICAL_COLORS = [
  { name: 'Đỏ (Vị trí địch / Cảnh báo)', value: '#EF4444' },
  { name: 'Xanh lá (Hướng đẩy / Entry)', value: '#10B981' },
  { name: 'Vàng (Smoke / Flash / Bo)', value: '#E59A23' },
  { name: 'Xanh dương (Góc kê tâm)', value: '#38BDF8' },
];

const formatTime = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

export const ReplayPlayer: React.FC<ReplayPlayerProps> = ({
  gameType,
  matchId,
  hasSelectedMatch,
  videoSrc,
  matchTitle,
  rounds,
  selectedRound,
  onSelectRound,
  onHighlightSaved,
}) => {
  const isValo = gameType === 'VALORANT';

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [localPreviewSrc, setLocalPreviewSrc] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [hoveredMarker, setHoveredMarker] = useState<TimelineMarker | null>(null);

  const [drawMode, setDrawMode] = useState(false);
  const [activeTool, setActiveTool] = useState<DrawTool>('arrow');
  const [activeColor, setActiveColor] = useState<string>('#EF4444');
  const [shapes, setShapes] = useState<DrawShape[]>([]);
  const [currentShape, setCurrentShape] = useState<DrawShape | null>(null);

  const shapesRef = useRef<DrawShape[]>([]);
  const currentShapeRef = useRef<DrawShape | null>(null);
  const isDrawingRef = useRef(false);

  shapesRef.current = shapes;
  currentShapeRef.current = currentShape;

  const activeVideoUrl = localPreviewSrc || videoSrc;

  useEffect(() => {
    return () => {
      if (localPreviewSrc && localPreviewSrc.startsWith('blob:')) {
        URL.revokeObjectURL(localPreviewSrc);
      }
    };
  }, [localPreviewSrc]);

  useEffect(() => {
    setLocalPreviewSrc(null);
    setUploadError(null);
    setShapes([]);
    setCurrentShape(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  }, [matchId]);

  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const allShapes = currentShapeRef.current
      ? [...shapesRef.current, currentShapeRef.current]
      : shapesRef.current;

    allShapes.forEach((shape) => {
      if (shape.points.length === 0) return;
      ctx.strokeStyle = shape.color;
      ctx.fillStyle = shape.color;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (shape.tool === 'pen') {
        ctx.beginPath();
        shape.points.forEach((pt, idx) => {
          const px = pt.x * w;
          const py = pt.y * h;
          if (idx === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.stroke();
      } else if (shape.tool === 'arrow' && shape.points.length >= 2) {
        const start = shape.points[0];
        const end = shape.points[shape.points.length - 1];
        const x1 = start.x * w;
        const y1 = start.y * h;
        const x2 = end.x * w;
        const y2 = end.y * h;

        const headLength = 15;
        const angle = Math.atan2(y2 - y1, x2 - x1);

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(x2, y2);
        ctx.lineTo(
          x2 - headLength * Math.cos(angle - Math.PI / 6),
          y2 - headLength * Math.sin(angle - Math.PI / 6)
        );
        ctx.lineTo(
          x2 - headLength * Math.cos(angle + Math.PI / 6),
          y2 - headLength * Math.sin(angle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fill();
      } else if (shape.tool === 'circle' && shape.points.length >= 2) {
        const start = shape.points[0];
        const end = shape.points[shape.points.length - 1];
        const x1 = start.x * w;
        const y1 = start.y * h;
        const x2 = end.x * w;
        const y2 = end.y * h;

        const cx = (x1 + x2) / 2;
        const cy = (y1 + y2) / 2;
        const rx = Math.abs(x2 - x1) / 2;
        const ry = Math.abs(y2 - y1) / 2;

        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    });
  }, []);

  useEffect(() => {
    redrawCanvas();
  }, [shapes, currentShape, redrawCanvas]);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const observer = new ResizeObserver(() => {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      redrawCanvas();
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [redrawCanvas, activeVideoUrl]);

  const seekTo = useCallback((targetSec: number) => {
    const video = videoRef.current;
    if (!video) return;
    const maxDur = Number.isFinite(video.duration) ? video.duration : 0;
    const clamped = Math.max(0, maxDur > 0 ? Math.min(maxDur, targetSec) : targetSec);
    video.currentTime = clamped;
    setCurrentTime(clamped);
  }, []);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.code === 'Space' && activeVideoUrl) {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'ArrowLeft' && activeVideoUrl) {
        e.preventDefault();
        seekTo((videoRef.current?.currentTime || 0) - 5);
      } else if (e.code === 'ArrowRight' && activeVideoUrl) {
        e.preventDefault();
        seekTo((videoRef.current?.currentTime || 0) + 5);
      } else if (e.key.toLowerCase() === 'd' && activeVideoUrl) {
        setDrawMode((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeVideoUrl, togglePlay, seekTo]);

  const timelineMarkers = useMemo<TimelineMarker[]>(() => {
    if (duration <= 0 || rounds.length === 0) return [];

    return rounds.map((r, index) => {
      const explicitSec = r.timestampSec ?? r.startTimeSec;
      const estimatedSec =
        typeof explicitSec === 'number' && explicitSec >= 0
          ? Math.min(duration, explicitSec)
          : ((index + 0.5) / rounds.length) * duration;

      const type: TimelineMarker['type'] =
        r.kills > 0 ? 'kill' : r.deaths > 0 ? 'death' : 'objective';

      const prefix = isValo ? `Round ${r.roundNumber}` : `Phase ${r.roundNumber}`;
      const label =
        r.kills > 0
          ? `${prefix}: ${r.kills} Kill (${r.damageDealt} DMG)`
          : r.deaths > 0
          ? `${prefix}: Bị hạ gục (${r.result})`
          : `${prefix}: ${r.result} - ${r.economyType}`;

      return {
        roundNumber: r.roundNumber,
        timestampSec: estimatedSec,
        type,
        label,
      };
    });
  }, [rounds, duration, isValo]);

  const handleSelectRoundAndSeek = (roundNumber: number) => {
    onSelectRound(roundNumber);
    const marker = timelineMarkers.find((m) => m.roundNumber === roundNumber);
    if (marker && videoRef.current) {
      seekTo(Math.max(0, marker.timestampSec - 2));
    }
  };

  const cyclePlaybackRate = () => {
    const speeds = [0.5, 1, 1.5, 2];
    const next = speeds[(speeds.indexOf(playbackRate) + 1) % speeds.length];
    setPlaybackRate(next);
    if (videoRef.current) {
      videoRef.current.playbackRate = next;
    }
  };

  const getNormalizedCoords = (e: React.MouseEvent<HTMLCanvasElement>): NormalizedPoint => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    };
  };

  const handlePointerDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawMode) return;
    if (videoRef.current && !videoRef.current.paused) {
      videoRef.current.pause();
      setIsPlaying(false);
    }
    isDrawingRef.current = true;
    const pt = getNormalizedCoords(e);
    setCurrentShape({
      tool: activeTool,
      color: activeColor,
      points: [pt],
    });
  };

  const handlePointerMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawMode || !isDrawingRef.current || !currentShape) return;
    const pt = getNormalizedCoords(e);
    if (currentShape.tool === 'pen') {
      setCurrentShape({
        ...currentShape,
        points: [...currentShape.points, pt],
      });
    } else {
      setCurrentShape({
        ...currentShape,
        points: [currentShape.points[0], pt],
      });
    }
  };

  const handlePointerUp = () => {
    if (!isDrawingRef.current || !currentShape) return;
    isDrawingRef.current = false;
    setShapes((prev) => [...prev, currentShape]);
    setCurrentShape(null);
  };

  const handleUploadHighlightFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !matchId) return;

    const objectUrl = URL.createObjectURL(file);
    setLocalPreviewSrc(objectUrl);
    setUploading(true);
    setUploadError(null);

    try {
      const data = await uploadMatchHighlight(matchId, file, file.name);
      if (data.cloudVideoUrl) {
        onHighlightSaved?.(data.cloudVideoUrl);
      }
    } catch (err: any) {
      setUploadError(
        err?.message
          ? `Chỉ đang xem tạm cục bộ (chưa lưu lên server: ${err.message})`
          : 'Chỉ đang xem tạm cục bộ, không thể tải video lên máy chủ.'
      );
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const getDotClass = (type: TimelineMarker['type']) => {
    if (type === 'kill') return 'bg-[#10B981] ring-[#10B981]/35';
    if (type === 'death') return 'bg-[#F43F5E] ring-[#F43F5E]/35';
    return 'bg-[#E59A23] ring-[#E59A23]/35';
  };

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="space-y-4">
      <div className="rounded-[4px] border border-[#232B3B] bg-[#10141C] p-4 space-y-3">
        {/* Thanh tieu de va Telestrator */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#232B3B] pb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className={`h-2.5 w-2.5 shrink-0 rounded-[1px] ${
                isValo ? 'bg-[#FF4655]' : 'bg-[#E59A23]'
              }`}
            />
            <h2 className="font-display text-base font-bold text-[#EEF2F6] truncate">
              {matchTitle || 'Trình phát Replay & Phân tích Chiến thuật'}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {hasSelectedMatch && (
              <>
                <label htmlFor="highlight-file-upload" className="sr-only">
                  Chọn video highlight
                </label>
                <input
                  id="highlight-file-upload"
                  ref={fileInputRef}
                  type="file"
                  accept="video/*"
                  onChange={(e) => void handleUploadHighlightFile(e)}
                  className="hidden"
                />
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-[2px] bg-[#171D28] hover:bg-[#232B3B] border border-[#232B3B] px-3 py-1.5 text-xs font-semibold text-[#EEF2F6] transition duration-150 disabled:opacity-50 active:translate-y-[1px]"
                >
                  <UploadSimple size={14} weight="bold" aria-hidden="true" />
                  <span>
                    {uploading
                      ? 'Đang tải lên...'
                      : activeVideoUrl
                      ? 'Đổi video Highlight'
                      : 'Gắn video Highlight'}
                  </span>
                </button>
              </>
            )}

            {activeVideoUrl && (
              <button
                type="button"
                onClick={() => setDrawMode((prev) => !prev)}
                title="Phím tắt: D"
                className={`inline-flex items-center gap-1.5 rounded-[2px] border px-3 py-1.5 text-xs font-bold transition duration-150 active:translate-y-[1px] ${
                  drawMode
                    ? isValo
                      ? 'bg-[#FF4655] border-[#FF4655] text-[#EEF2F6]'
                      : 'bg-[#E59A23] border-[#E59A23] text-[#0A0D12]'
                    : 'bg-[#171D28] border-[#232B3B] text-[#94A3B8] hover:text-[#EEF2F6] hover:bg-[#232B3B]'
                }`}
              >
                <PencilSimple size={14} weight="bold" aria-hidden="true" />
                <span>{drawMode ? 'Đang bật Bút Vẽ (D)' : 'Vẽ chiến thuật (D)'}</span>
              </button>
            )}
          </div>
        </div>

        {uploadError && (
          <div className="rounded-[2px] border border-[#E59A23]/40 bg-[#E59A23]/10 px-3 py-2 text-xs text-[#E59A23]">
            {uploadError}
          </div>
        )}

        {/* Thanh cong cu Telestrator */}
        {activeVideoUrl && drawMode && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-[2px] bg-[#0A0D12] border border-[#232B3B] px-3 py-2">
            <div className="flex items-center gap-1.5">
              {(
                [
                  { id: 'arrow', label: 'Mũi tên', icon: ArrowUpRight },
                  { id: 'circle', label: 'Khoanh vùng', icon: Circle },
                  { id: 'pen', label: 'Bút tự do', icon: PencilSimple },
                ] as const
              ).map((item) => {
                const IconComp = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveTool(item.id)}
                    className={`inline-flex items-center gap-1 rounded-[2px] px-2.5 py-1 text-xs font-medium transition duration-150 ${
                      activeTool === item.id
                        ? 'bg-[#232B3B] text-[#EEF2F6]'
                        : 'text-[#94A3B8] hover:text-[#EEF2F6]'
                    }`}
                  >
                    <IconComp size={13} weight="bold" aria-hidden="true" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 px-2">
                {TACTICAL_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    aria-label={c.name}
                    title={c.name}
                    onClick={() => setActiveColor(c.value)}
                    style={{ backgroundColor: c.value }}
                    className={`h-4 w-4 rounded-[2px] transition ${
                      activeColor === c.value ? 'scale-110 ring-2 ring-[#EEF2F6]' : 'opacity-70'
                    }`}
                  />
                ))}
              </div>

              <button
                type="button"
                onClick={() => setShapes((prev) => prev.slice(0, -1))}
                disabled={shapes.length === 0}
                className="inline-flex items-center gap-1 rounded-[2px] bg-[#171D28] border border-[#232B3B] px-2.5 py-1 text-xs text-[#94A3B8] hover:text-[#EEF2F6] disabled:opacity-40"
              >
                <ArrowCounterClockwise size={12} weight="bold" aria-hidden="true" />
                <span>Hoàn tác</span>
              </button>
              <button
                type="button"
                onClick={() => setShapes([])}
                disabled={shapes.length === 0}
                className="inline-flex items-center gap-1 rounded-[2px] bg-[#171D28] border border-[#232B3B] px-2.5 py-1 text-xs text-[#F43F5E] hover:bg-[#232B3B] disabled:opacity-40"
              >
                <Trash size={12} weight="bold" aria-hidden="true" />
                <span>Xóa nét</span>
              </button>
            </div>
          </div>
        )}

        {/* Khung hien thi Video + Telestrator */}
        {!hasSelectedMatch ? (
          <div className="aspect-video w-full rounded-[2px] border border-dashed border-[#232B3B] bg-[#0A0D12] flex flex-col items-center justify-center gap-2 p-6 text-center">
            <VideoCamera size={28} className="text-[#64748B]" aria-hidden="true" />
            <p className="text-xs text-[#94A3B8] max-w-[45ch]">
              Chọn một trận đấu ở danh sách bên trái để xem video replay và phân tích chiến thuật.
            </p>
          </div>
        ) : !activeVideoUrl ? (
          <div className="aspect-video w-full rounded-[2px] border border-dashed border-[#232B3B] bg-[#0A0D12] flex flex-col items-center justify-center gap-3 p-6 text-center">
            <VideoCamera size={28} className="text-[#64748B]" aria-hidden="true" />
            <p className="text-xs text-[#94A3B8] max-w-[55ch] leading-relaxed">
              Trận đấu này chưa có video highlight tự động từ Overwolf. Chọn sẵn file video trận đấu từ máy tính để sử dụng thanh mốc giao tranh và bút vẽ chiến thuật.
            </p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-[2px] text-xs font-bold transition duration-150 active:translate-y-[1px] ${
                isValo
                  ? 'bg-[#FF4655] hover:bg-rose-500 text-[#EEF2F6]'
                  : 'bg-[#E59A23] hover:bg-amber-400 text-[#0A0D12]'
              }`}
            >
              <UploadSimple size={14} weight="bold" aria-hidden="true" />
              <span>Chọn file video Highlight (.mp4)</span>
            </button>
          </div>
        ) : (
          <>
            <div
              ref={containerRef}
              className="relative aspect-video w-full overflow-hidden rounded-[2px] border border-[#232B3B] bg-[#0A0D12]"
            >
              <video
                ref={videoRef}
                src={activeVideoUrl}
                className="h-full w-full object-contain"
                onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
                onEnded={() => setIsPlaying(false)}
              />

              {!drawMode && (
                <button
                  type="button"
                  aria-label={isPlaying ? 'Tạm dừng video replay' : 'Phát video replay'}
                  onClick={togglePlay}
                  className="absolute inset-0 h-full w-full cursor-pointer bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#38BDF8]"
                />
              )}

              <canvas
                ref={canvasRef}
                onMouseDown={handlePointerDown}
                onMouseMove={handlePointerMove}
                onMouseUp={handlePointerUp}
                onMouseLeave={handlePointerUp}
                className={`absolute inset-0 h-full w-full ${
                  drawMode ? 'cursor-crosshair pointer-events-auto' : 'pointer-events-none'
                }`}
              />

              {/* HUD Corner Reticle Marks */}
              <span className="pointer-events-none absolute top-2 left-2 h-2.5 w-2.5 border-t border-l border-[#94A3B8]/40" />
              <span className="pointer-events-none absolute top-2 right-2 h-2.5 w-2.5 border-t border-r border-[#94A3B8]/40" />
              <span className="pointer-events-none absolute bottom-2 left-2 h-2.5 w-2.5 border-b border-l border-[#94A3B8]/40" />
              <span className="pointer-events-none absolute bottom-2 right-2 h-2.5 w-2.5 border-b border-r border-[#94A3B8]/40" />
            </div>

            {/* Thanh tua Timeline kem cac moc su kien */}
            <div className="pt-1 space-y-2.5">
              <div className="relative flex h-6 items-center">
                {hoveredMarker && (
                  <div
                    style={{
                      left: `${
                        duration > 0
                          ? Math.min(90, Math.max(10, (hoveredMarker.timestampSec / duration) * 100))
                          : 0
                      }%`,
                    }}
                    className="pointer-events-none absolute -top-9 z-20 -translate-x-1/2 whitespace-nowrap rounded-[2px] border border-[#334155] bg-[#0A0D12] px-2.5 py-1 text-xs text-[#EEF2F6] shadow-lg"
                  >
                    <span className="font-mono text-[#E59A23] tabular-nums">
                      {formatTime(hoveredMarker.timestampSec)}
                    </span>{' '}
                    - {hoveredMarker.label}
                  </div>
                )}

                <div className="relative h-2 w-full rounded-[1px] bg-[#171D28] border border-[#232B3B]">
                  <button
                    type="button"
                    aria-label="Tua thời gian phát video"
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const ratio = (e.clientX - rect.left) / rect.width;
                      seekTo(ratio * duration);
                    }}
                    className="absolute inset-0 h-full w-full cursor-pointer bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38BDF8]"
                  />

                  <div
                    style={{ width: `${progressPct}%` }}
                    className={`pointer-events-none h-full transition-all duration-75 ${
                      isValo ? 'bg-[#FF4655]' : 'bg-[#E59A23]'
                    }`}
                  />

                  {duration > 0 &&
                    timelineMarkers.map((mk) => {
                      const leftPct = Math.min(
                        100,
                        Math.max(0, (mk.timestampSec / duration) * 100)
                      );
                      return (
                        <button
                          key={mk.roundNumber}
                          type="button"
                          aria-label={mk.label}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectRoundAndSeek(mk.roundNumber);
                          }}
                          onMouseEnter={() => setHoveredMarker(mk)}
                          onMouseLeave={() => setHoveredMarker(null)}
                          style={{ left: `${leftPct}%` }}
                          className={`absolute top-1/2 z-10 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-4 transition-transform hover:scale-125 ${getDotClass(
                            mk.type
                          )}`}
                        />
                      );
                    })}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#94A3B8]">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={togglePlay}
                    className="inline-flex items-center gap-1.5 rounded-[2px] bg-[#171D28] hover:bg-[#232B3B] border border-[#232B3B] px-3 py-1.5 font-semibold text-[#EEF2F6] transition duration-150 active:translate-y-[1px]"
                  >
                    {isPlaying ? (
                      <Pause size={13} weight="bold" aria-hidden="true" />
                    ) : (
                      <Play size={13} weight="bold" aria-hidden="true" />
                    )}
                    <span>{isPlaying ? 'Tạm dừng' : 'Phát'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => seekTo(currentTime - 5)}
                    className="inline-flex items-center gap-1 rounded-[2px] bg-[#171D28] hover:bg-[#232B3B] border border-[#232B3B] px-2.5 py-1.5 font-mono hover:text-[#EEF2F6]"
                  >
                    <Rewind size={12} weight="bold" aria-hidden="true" />
                    <span>5s</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => seekTo(currentTime + 5)}
                    className="inline-flex items-center gap-1 rounded-[2px] bg-[#171D28] hover:bg-[#232B3B] border border-[#232B3B] px-2.5 py-1.5 font-mono hover:text-[#EEF2F6]"
                  >
                    <span>5s</span>
                    <FastForward size={12} weight="bold" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={cyclePlaybackRate}
                    className="rounded-[2px] bg-[#171D28] hover:bg-[#232B3B] border border-[#232B3B] px-2.5 py-1.5 font-mono text-[#EEF2F6] tabular-nums"
                  >
                    {playbackRate}x
                  </button>
                  <span className="ml-2 font-mono text-[#94A3B8] tabular-nums">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>
                </div>

                <div className="flex items-center gap-3 font-mono text-[11px] text-[#94A3B8]">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-[#10B981]" /> Có Kill
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-[#F43F5E]" /> Bị hạ gục
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-[#E59A23]" /> Thắng / Vòng bo
                  </span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {hasSelectedMatch && (
        <RoundTimeline
          gameType={gameType}
          rounds={rounds}
          selectedRound={selectedRound}
          onSelectRound={handleSelectRoundAndSeek}
        />
      )}
    </div>
  );
};

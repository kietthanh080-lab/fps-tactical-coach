import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowCounterClockwise,
  ArrowUpRight,
  BookmarkSimple,
  Camera,
  Circle,
  FastForward,
  FilmStrip,
  FolderOpen,
  Pause,
  PencilSimple,
  Play,
  Rewind,
  Trash,
  UploadSimple,
  VideoCamera,
  X,
} from '@phosphor-icons/react';
import { useI18n } from '../i18n';
import {
  getMatchBookmarks,
  ReplayBookmark,
  saveMatchBookmarks,
} from '../services/appSettings';
import { uploadMatchHighlight } from '../services/localDb';
import { AnalyzedRoundUI, RoundTimeline } from './RoundTimeline';

export interface ReplayClipItem {
  id?: string;
  filePath: string;
  fileName: string;
  fileSizeMb?: number;
  durationSec?: number;
  source?: 'KILL' | 'F9';
  recordedAt?: string;
  createdAt?: string;
}

interface ReplayPlayerProps {
  gameType: 'VALORANT' | 'PUBG';
  matchId: string | null;
  hasSelectedMatch: boolean;
  videoSrc: string | null;
  clips?: ReplayClipItem[];
  matchTitle: string;
  rounds: AnalyzedRoundUI[];
  selectedRound: number;
  onSelectRound: (roundNumber: number) => void;
  onHighlightSaved?: (cloudUrl: string) => void;
  onOpenHighlightsFolder?: () => void;
  dataRevision?: number;
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
  id: string;
  roundNumber: number;
  timestampSec: number;
  type: 'kill' | 'death' | 'objective' | 'bookmark';
  label: string;
  isExact: boolean;
}

const formatTime = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

function getTelestratorStorageKey(matchId: string): string {
  return `tactical_replay_telestrator_${matchId}`;
}

export const ReplayPlayer: React.FC<ReplayPlayerProps> = ({
  gameType,
  matchId,
  hasSelectedMatch,
  videoSrc,
  clips,
  matchTitle,
  rounds,
  selectedRound,
  onSelectRound,
  onHighlightSaved,
  onOpenHighlightsFolder,
  dataRevision = 0,
}) => {
  const { tr } = useI18n();
  const isValo = gameType === 'VALORANT';

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [localPreviewSrc, setLocalPreviewSrc] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedClipIdx, setSelectedClipIdx] = useState<number>(0);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'downloaded' | 'error'>('idle');

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [hoveredMarker, setHoveredMarker] = useState<TimelineMarker | null>(null);

  const [bookmarks, setBookmarks] = useState<ReplayBookmark[]>([]);
  const [bookmarkLabelInput, setBookmarkLabelInput] = useState('');

  const [drawMode, setDrawMode] = useState(false);
  const [activeTool, setActiveTool] = useState<DrawTool>('arrow');
  const [activeColor, setActiveColor] = useState<string>('#EF4444');
  const [shapesByRound, setShapesByRound] = useState<Record<number, DrawShape[]>>({});
  const [currentShape, setCurrentShape] = useState<DrawShape | null>(null);

  const tacticalColors = useMemo(
    () => [
      {
        name: tr('Red (Enemy / Threat)', 'Đỏ (Vị trí địch / Cảnh báo)'),
        value: '#EF4444',
      },
      {
        name: tr('Green (Entry / Push Path)', 'Xanh lá (Hướng đẩy / Entry)'),
        value: '#10B981',
      },
      {
        name: tr('Amber (Utility / Safe Zone)', 'Vàng (Smoke / Flash / Bo)'),
        value: '#E59A23',
      },
      {
        name: tr('Cyan (Crosshair Hold / Info)', 'Xanh dương (Góc kê tâm)'),
        value: '#38BDF8',
      },
    ],
    [tr]
  );

  const shapes = shapesByRound[selectedRound] || [];
  const shapesRef = useRef<DrawShape[]>([]);
  const currentShapeRef = useRef<DrawShape | null>(null);
  const isDrawingRef = useRef(false);

  shapesRef.current = shapes;
  currentShapeRef.current = currentShape;

  const clipList = clips || [];
  const safeClipIdx = selectedClipIdx < clipList.length ? selectedClipIdx : 0;
  const activeClip = clipList[safeClipIdx] || null;
  const clipVideoUrl = activeClip?.filePath
    ? activeClip.filePath.startsWith('file://')
      ? activeClip.filePath
      : `file:///${activeClip.filePath.replace(/\\/g, '/')}`
    : null;
  const activeVideoUrl =
    localPreviewSrc || (clipList.length > 1 ? clipVideoUrl : null) || videoSrc || clipVideoUrl;

  const handleSelectClip = (idx: number) => {
    setSelectedClipIdx(idx);
    setLocalPreviewSrc(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  };

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
    setSelectedClipIdx(0);
    setCopyStatus('idle');
    setCurrentShape(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setBookmarkLabelInput('');

    if (!matchId) {
      setShapesByRound({});
      setBookmarks([]);
      return;
    }

    setBookmarks(getMatchBookmarks(matchId));

    try {
      const saved = localStorage.getItem(getTelestratorStorageKey(matchId));
      setShapesByRound(saved ? (JSON.parse(saved) as Record<number, DrawShape[]>) : {});
    } catch {
      setShapesByRound({});
    }
  }, [matchId, dataRevision]);

  useEffect(() => {
    if (!matchId) return;
    try {
      const hasAnyShape = Object.values(shapesByRound).some((arr) => arr.length > 0);
      if (hasAnyShape) {
        localStorage.setItem(getTelestratorStorageKey(matchId), JSON.stringify(shapesByRound));
      } else {
        localStorage.removeItem(getTelestratorStorageKey(matchId));
      }
    } catch {
      // Ignore storage quota errors
    }
  }, [matchId, shapesByRound]);

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
  }, [shapes, selectedRound, currentShape, redrawCanvas]);

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

  const handleCopyScreenshot = useCallback(async () => {
    const container = containerRef.current;
    const drawCanvas = canvasRef.current;
    const videoEl = videoRef.current;

    const exportWidth =
      videoEl && videoEl.videoWidth > 0
        ? videoEl.videoWidth
        : drawCanvas?.width || container?.clientWidth || 1280;
    const exportHeight =
      videoEl && videoEl.videoHeight > 0
        ? videoEl.videoHeight
        : drawCanvas?.height || container?.clientHeight || 720;

    const outCanvas = document.createElement('canvas');
    outCanvas.width = exportWidth;
    outCanvas.height = exportHeight;
    const outCtx = outCanvas.getContext('2d');
    if (!outCtx) return;

    outCtx.fillStyle = '#0A0D12';
    outCtx.fillRect(0, 0, exportWidth, exportHeight);

    if (videoEl && videoEl.readyState >= 2) {
      try {
        outCtx.drawImage(videoEl, 0, 0, exportWidth, exportHeight);
      } catch {
        // Ignore cross-origin draw failures cleanly
      }
    }

    if (drawCanvas && drawCanvas.width > 0 && drawCanvas.height > 0) {
      outCtx.drawImage(drawCanvas, 0, 0, exportWidth, exportHeight);
    }

    outCtx.fillStyle = 'rgba(10, 13, 18, 0.78)';
    outCtx.fillRect(12, exportHeight - 36, 320, 24);
    outCtx.fillStyle = '#EEF2F6';
    outCtx.font = 'bold 12px sans-serif';
    outCtx.fillText(
      `TacticalReplayAI | ${matchTitle || gameType} | ${isValo ? `R${selectedRound}` : `P${selectedRound}`}`.slice(0, 48),
      20,
      exportHeight - 20
    );

    const exportBlob = (canvasToSave: HTMLCanvasElement): Promise<Blob | null> =>
      new Promise((resolve) => {
        try {
          canvasToSave.toBlob((blob) => resolve(blob), 'image/png');
        } catch {
          resolve(null);
        }
      });

    let pngBlob = await exportBlob(outCanvas);
    if (!pngBlob) {
      const fallbackCanvas = document.createElement('canvas');
      fallbackCanvas.width = exportWidth;
      fallbackCanvas.height = exportHeight;
      const fbCtx = fallbackCanvas.getContext('2d');
      if (fbCtx) {
        fbCtx.fillStyle = '#111620';
        fbCtx.fillRect(0, 0, exportWidth, exportHeight);
        if (drawCanvas && drawCanvas.width > 0 && drawCanvas.height > 0) {
          fbCtx.drawImage(drawCanvas, 0, 0, exportWidth, exportHeight);
        }
        fbCtx.fillStyle = '#94A3B8';
        fbCtx.font = '13px sans-serif';
        fbCtx.fillText(
          tr(
            'Telestrator Overlay (Remote video restricts direct frame capture)',
            'So do Telestrator (Video cloud khong cho phep chup frame truc tiep)'
          ),
          20,
          32
        );
        pngBlob = await exportBlob(fallbackCanvas);
      }
    }

    if (!pngBlob) {
      setCopyStatus('error');
      setTimeout(() => setCopyStatus('idle'), 2500);
      return;
    }

    try {
      if (navigator.clipboard && typeof ClipboardItem !== 'undefined') {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })]);
        setCopyStatus('copied');
        setTimeout(() => setCopyStatus('idle'), 2500);
        return;
      }
    } catch {
      // Fallback to downloading PNG when clipboard write is restricted
    }

    const blobUrl = URL.createObjectURL(pngBlob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = `tactical-${matchId || 'clip'}-r${selectedRound}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
    setCopyStatus('downloaded');
    setTimeout(() => setCopyStatus('idle'), 2500);
  }, [gameType, isValo, matchId, matchTitle, selectedRound, tr]);

  const seekTo = useCallback((targetSec: number) => {
    const video = videoRef.current;
    if (!video) return;
    const maxDur = Number.isFinite(video.duration) ? video.duration : 0;
    const clamped = Math.max(0, maxDur > 0 ? Math.min(maxDur, targetSec) : targetSec);
    video.currentTime = clamped;
    setCurrentTime(clamped);
  }, []);

  const stepFrame = useCallback(
    (deltaSec: number) => {
      const video = videoRef.current;
      if (!video) return;
      if (!video.paused) {
        video.pause();
        setIsPlaying(false);
      }
      seekTo(video.currentTime + deltaSec);
    },
    [seekTo]
  );

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

  const handleAddBookmark = useCallback(() => {
    if (!matchId || !activeVideoUrl) return;
    const rawTime = videoRef.current?.currentTime ?? currentTime;
    const roundedSec = Math.max(0, Math.round(rawTime * 10) / 10);
    const customLabel = bookmarkLabelInput.trim();
    const defaultPrefix = isValo ? `R${selectedRound}` : `P${selectedRound}`;
    const label = customLabel || `${defaultPrefix} #${bookmarks.length + 1}`;

    const next = saveMatchBookmarks(matchId, [
      ...bookmarks,
      {
        id: `bm-${Date.now()}`,
        timeSec: roundedSec,
        label,
      },
    ]);
    setBookmarks(next);
    setBookmarkLabelInput('');
  }, [activeVideoUrl, bookmarkLabelInput, bookmarks, currentTime, isValo, matchId, selectedRound]);

  const handleRemoveBookmark = useCallback(
    (id: string) => {
      if (!matchId) return;
      const next = saveMatchBookmarks(
        matchId,
        bookmarks.filter((b) => b.id !== id)
      );
      setBookmarks(next);
    },
    [bookmarks, matchId]
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (!activeVideoUrl) return;

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        seekTo((videoRef.current?.currentTime || 0) - 5);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        seekTo((videoRef.current?.currentTime || 0) + 5);
      } else if (e.key === ',') {
        e.preventDefault();
        stepFrame(-0.1);
      } else if (e.key === '.') {
        e.preventDefault();
        stepFrame(0.1);
      } else if (e.key.toLowerCase() === 'd') {
        setDrawMode((prev) => !prev);
      } else if (e.key.toLowerCase() === 'b' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        handleAddBookmark();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeVideoUrl, handleAddBookmark, seekTo, stepFrame, togglePlay]);

  const timelineMarkers = useMemo<TimelineMarker[]>(() => {
    if (duration <= 0) return [];

    const markers: TimelineMarker[] = [];

    if (rounds.length > 0) {
      const hasRealRoundStart = rounds.some(
        (r, idx) =>
          (typeof r.startTimestampMs === 'number' && r.startTimestampMs > 0 && idx > 0) ||
          typeof r.timestampSec === 'number' ||
          typeof r.startTimeSec === 'number'
      );

      rounds.forEach((r, index) => {
        const prefix = isValo ? `Round ${r.roundNumber}` : `Phase ${r.roundNumber}`;

        const actionEvents = (r.events || []).filter(
          (ev) =>
            (ev.type === 'KILL' || ev.type === 'DEATH' || ev.type === 'SPIKE_PLANTED') &&
            typeof ev.timestampMs === 'number' &&
            ev.timestampMs >= 0 &&
            ev.timestampMs / 1000 <= duration + 2
        );

        if (actionEvents.length > 0) {
          actionEvents.forEach((ev, evIdx) => {
            const evSec = Math.min(duration, Math.max(0, ev.timestampMs / 1000));
            const type: TimelineMarker['type'] =
              ev.type === 'KILL' ? 'kill' : ev.type === 'DEATH' ? 'death' : 'objective';

            const weapon = ev.payload?.weapon ? ` (${String(ev.payload.weapon)})` : '';
            const dist = ev.payload?.distanceMeters
              ? ` ${String(ev.payload.distanceMeters)}m`
              : '';
            const label =
              ev.type === 'KILL'
                ? `${prefix}: ${tr('Kill', 'Hạ gục')}${weapon}${dist}`
                : ev.type === 'DEATH'
                  ? `${prefix}: ${tr('Eliminated', 'Bị hạ gục')}${weapon}`
                  : `${prefix}: ${tr('Spike Planted', 'Đặt Spike')}`;

            markers.push({
              id: `r${r.roundNumber}-ev${evIdx}`,
              roundNumber: r.roundNumber,
              timestampSec: evSec,
              type,
              label,
              isExact: true,
            });
          });
          return;
        }

        const explicitSec =
          r.timestampSec ??
          r.startTimeSec ??
          (typeof r.startTimestampMs === 'number' && hasRealRoundStart
            ? r.startTimestampMs / 1000
            : undefined);

        const isExact =
          typeof explicitSec === 'number' && explicitSec >= 0 && explicitSec <= duration + 5;
        const resolvedSec = isExact
          ? Math.min(duration, Math.max(0, explicitSec))
          : ((index + 0.5) / rounds.length) * duration;

        const type: TimelineMarker['type'] =
          r.kills > 0 ? 'kill' : r.deaths > 0 ? 'death' : 'objective';

        const label =
          r.kills > 0
            ? `${prefix}: ${r.kills} Kill (${r.damageDealt} DMG)`
            : r.deaths > 0
              ? `${prefix}: ${tr('Eliminated', 'Bị hạ gục')} (${r.result})`
              : `${prefix}: ${r.result} - ${r.economyType}`;

        markers.push({
          id: `r${r.roundNumber}`,
          roundNumber: r.roundNumber,
          timestampSec: resolvedSec,
          type,
          label,
          isExact,
        });
      });
    }

    bookmarks.forEach((bm) => {
      if (bm.timeSec <= duration + 1) {
        markers.push({
          id: bm.id,
          roundNumber: selectedRound,
          timestampSec: Math.min(duration, Math.max(0, bm.timeSec)),
          type: 'bookmark',
          label: `${tr('Bookmark', 'Dấu trang')}: ${bm.label}`,
          isExact: true,
        });
      }
    });

    return markers;
  }, [bookmarks, duration, isValo, rounds, selectedRound, tr]);

  const handleSelectRoundAndSeek = (
    roundNumber: number,
    explicitSec?: number,
    exactBookmark = false
  ) => {
    onSelectRound(roundNumber);
    if (!videoRef.current) return;
    if (typeof explicitSec === 'number') {
      seekTo(Math.max(0, exactBookmark ? explicitSec : explicitSec - 2));
      return;
    }
    const marker = timelineMarkers.find(
      (m) => m.roundNumber === roundNumber && m.type !== 'bookmark'
    );
    if (marker) {
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
    setShapesByRound((prev) => ({
      ...prev,
      [selectedRound]: [...(prev[selectedRound] || []), currentShape],
    }));
    setCurrentShape(null);
  };

  const handleUndoShape = () => {
    setShapesByRound((prev) => {
      const currentList = prev[selectedRound] || [];
      if (currentList.length === 0) return prev;
      return {
        ...prev,
        [selectedRound]: currentList.slice(0, -1),
      };
    });
  };

  const handleClearRoundShapes = () => {
    setShapesByRound((prev) => {
      const next = { ...prev };
      delete next[selectedRound];
      return next;
    });
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
          ? tr(
              `Playing local preview only (cloud upload skipped: ${err.message})`,
              `Chỉ đang xem tạm cục bộ (chưa lưu lên server: ${err.message})`
            )
          : tr(
              'Playing local preview only; unable to upload video to server.',
              'Chỉ đang xem tạm cục bộ, không thể tải video lên máy chủ.'
            )
      );
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const getDotClass = (type: TimelineMarker['type']) => {
    if (type === 'kill') return 'bg-[#10B981] ring-[#10B981]/35';
    if (type === 'death') return 'bg-[#F43F5E] ring-[#F43F5E]/35';
    if (type === 'bookmark') return 'bg-[#38BDF8] ring-[#38BDF8]/40';
    return 'bg-[#E59A23] ring-[#E59A23]/35';
  };

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="space-y-4">
      <div className="theme-surface-card rounded-[4px] border border-[#232B3B] bg-[#10141C] p-4 space-y-3">
        {/* Header & Telestrator Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#232B3B] pb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className={`h-2.5 w-2.5 shrink-0 rounded-[1px] ${
                isValo ? 'bg-[#FF4655]' : 'bg-[#E59A23]'
              }`}
            />
            <h2 className="font-display text-base font-bold text-[#EEF2F6] truncate">
              {matchTitle || tr('Tactical Replay Theater', 'Trình phát Replay & Phân tích Chiến thuật')}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {hasSelectedMatch && (
              <>
                <label htmlFor="highlight-file-upload" className="sr-only">
                  {tr('Select highlight video file', 'Chọn video highlight')}
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
                      ? tr('Uploading...', 'Đang tải lên...')
                      : activeVideoUrl
                        ? tr('Change Highlight', 'Đổi video Highlight')
                        : tr('Attach Highlight', 'Gắn video Highlight')}
                  </span>
                </button>
              </>
            )}

            {onOpenHighlightsFolder && (
              <button
                type="button"
                onClick={onOpenHighlightsFolder}
                title={tr('Open local highlight clips folder', 'Mở thư mục lưu clip highlight trên máy')}
                className="inline-flex items-center gap-1.5 rounded-[2px] border border-[#232B3B] bg-[#171D28] px-2.5 py-1.5 text-xs font-medium text-[#94A3B8] hover:text-[#EEF2F6] hover:bg-[#232B3B] transition duration-150"
              >
                <FolderOpen size={14} weight="bold" aria-hidden="true" />
                <span>{tr('Open Folder', 'Mở thư mục')}</span>
              </button>
            )}

            {activeVideoUrl && (
              <button
                type="button"
                onClick={() => {
                  void handleCopyScreenshot();
                }}
                title={tr(
                  'Copy current video frame + Telestrator drawings to clipboard',
                  'Chụp frame video kèm nét vẽ Telestrator vào clipboard để dán Discord'
                )}
                className={`inline-flex items-center gap-1.5 rounded-[2px] border px-2.5 py-1.5 text-xs font-medium transition duration-150 ${
                  copyStatus === 'copied' || copyStatus === 'downloaded'
                    ? 'bg-[#10B981]/15 border-[#10B981] text-[#10B981]'
                    : copyStatus === 'error'
                      ? 'bg-[#F43F5E]/15 border-[#F43F5E] text-[#F43F5E]'
                      : 'bg-[#171D28] border-[#232B3B] text-[#94A3B8] hover:text-[#EEF2F6] hover:bg-[#232B3B]'
                }`}
              >
                <Camera size={14} weight="bold" aria-hidden="true" />
                <span>
                  {copyStatus === 'copied'
                    ? tr('Frame Copied', 'Đã copy ảnh')
                    : copyStatus === 'downloaded'
                      ? tr('PNG Saved', 'Đã tải PNG')
                      : copyStatus === 'error'
                        ? tr('Capture Failed', 'Lỗi chụp ảnh')
                        : tr('Copy Frame', 'Copy ảnh')}
                </span>
              </button>
            )}

            {activeVideoUrl && (
              <button
                type="button"
                onClick={() => setDrawMode((prev) => !prev)}
                title={tr('Shortcut: D', 'Phím tắt: D')}
                className={`inline-flex items-center gap-1.5 rounded-[2px] border px-3 py-1.5 text-xs font-bold transition duration-150 active:translate-y-[1px] ${
                  drawMode
                    ? isValo
                      ? 'bg-[#FF4655] border-[#FF4655] text-[#EEF2F6]'
                      : 'bg-[#E59A23] border-[#E59A23] text-[#0A0D12]'
                    : 'bg-[#171D28] border-[#232B3B] text-[#94A3B8] hover:text-[#EEF2F6] hover:bg-[#232B3B]'
                }`}
              >
                <PencilSimple size={14} weight="bold" aria-hidden="true" />
                <span>
                  {drawMode
                    ? tr(
                        `Drawing ${isValo ? `R${selectedRound}` : `P${selectedRound}`} (D)`,
                        `Đang vẽ ${isValo ? `R${selectedRound}` : `P${selectedRound}`} (D)`
                      )
                    : tr('Telestrator (D)', 'Vẽ chiến thuật (D)')}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Multi-Clip Gallery */}
        {clipList.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-[2px] bg-[#0A0D12] border border-[#232B3B] px-3 py-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mr-1">
                <FilmStrip size={14} weight="bold" aria-hidden="true" />
                <span>
                  {tr(`${clipList.length} Clips in Match:`, `${clipList.length} Clip trong trận:`)}
                </span>
              </span>
              {clipList.map((clip, idx) => {
                const isSelected = safeClipIdx === idx && !localPreviewSrc;
                return (
                  <button
                    key={clip.id || `${clip.fileName}-${idx}`}
                    type="button"
                    onClick={() => handleSelectClip(idx)}
                    className={`inline-flex items-center gap-1.5 rounded-[2px] border px-2.5 py-1 text-[11px] font-bold transition duration-150 ${
                      isSelected
                        ? isValo
                          ? 'bg-[#FF4655] border-[#FF4655] text-[#EEF2F6]'
                          : 'bg-[#E59A23] border-[#E59A23] text-[#0A0D12]'
                        : 'bg-[#171D28] border-[#232B3B] text-[#94A3B8] hover:text-[#EEF2F6] hover:bg-[#232B3B]'
                    }`}
                  >
                    <span>
                      {clip.source === 'KILL' ? 'Kill' : tr('Hotkey', 'Phím tắt')} #{idx + 1}
                    </span>
                    {typeof clip.durationSec === 'number' && clip.durationSec > 0 && (
                      <span className="font-mono opacity-80">{clip.durationSec}s</span>
                    )}
                    {typeof clip.fileSizeMb === 'number' && clip.fileSizeMb > 0 && (
                      <span className="font-mono opacity-70">{clip.fileSizeMb.toFixed(1)}MB</span>
                    )}
                  </button>
                );
              })}
            </div>
            {activeClip && (
              <span
                className="text-[11px] font-mono text-[#64748B] truncate max-w-[220px]"
                title={activeClip.fileName}
              >
                {activeClip.fileName}
              </span>
            )}
          </div>
        )}

        {uploadError && (
          <div className="rounded-[2px] border border-[#E59A23]/40 bg-[#E59A23]/10 px-3 py-2 text-xs text-[#E59A23]">
            {uploadError}
          </div>
        )}

        {/* Telestrator Drawing Toolbar */}
        {activeVideoUrl && drawMode && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-[2px] bg-[#0A0D12] border border-[#232B3B] px-3 py-2">
            <div className="flex items-center gap-1.5">
              {(
                [
                  { id: 'arrow', label: tr('Arrow', 'Mũi tên'), icon: ArrowUpRight },
                  { id: 'circle', label: tr('Zone', 'Khoanh vùng'), icon: Circle },
                  { id: 'pen', label: tr('Freehand', 'Bút tự do'), icon: PencilSimple },
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
                {tacticalColors.map((c) => (
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
                onClick={handleUndoShape}
                disabled={shapes.length === 0}
                className="inline-flex items-center gap-1 rounded-[2px] bg-[#171D28] border border-[#232B3B] px-2.5 py-1 text-xs text-[#94A3B8] hover:text-[#EEF2F6] disabled:opacity-40"
              >
                <ArrowCounterClockwise size={12} weight="bold" aria-hidden="true" />
                <span>{tr('Undo', 'Hoàn tác')}</span>
              </button>
              <button
                type="button"
                onClick={handleClearRoundShapes}
                disabled={shapes.length === 0}
                className="inline-flex items-center gap-1 rounded-[2px] bg-[#171D28] border border-[#232B3B] px-2.5 py-1 text-xs text-[#F43F5E] hover:bg-[#232B3B] disabled:opacity-40"
              >
                <Trash size={12} weight="bold" aria-hidden="true" />
                <span>{tr('Clear', 'Xóa nét')}</span>
              </button>
            </div>
          </div>
        )}

        {/* Video Viewport + Canvas */}
        {!hasSelectedMatch ? (
          <div className="aspect-video w-full rounded-[2px] border border-dashed border-[#232B3B] bg-[#0A0D12] flex flex-col items-center justify-center gap-2 p-6 text-center">
            <VideoCamera size={28} className="text-[#64748B]" aria-hidden="true" />
            <p className="text-xs text-[#94A3B8] max-w-[45ch]">
              {tr(
                'Select a match from the left sidebar to inspect replay video and tactical telemetry.',
                'Chọn một trận đấu ở danh sách bên trái để xem video replay và phân tích chiến thuật.'
              )}
            </p>
          </div>
        ) : !activeVideoUrl ? (
          <div className="aspect-video w-full rounded-[2px] border border-dashed border-[#232B3B] bg-[#0A0D12] flex flex-col items-center justify-center gap-3 p-6 text-center">
            <VideoCamera size={28} className="text-[#64748B]" aria-hidden="true" />
            <p className="text-xs text-[#94A3B8] max-w-[55ch] leading-relaxed">
              {tr(
                'No automatic highlight clip is attached to this match yet. Select a local video file (.mp4 / .webm) to unlock timeline combat markers, custom bookmarks, and Telestrator drawing.',
                'Trận đấu này chưa có video highlight tự động. Chọn sẵn file video trận đấu từ máy tính để sử dụng thanh mốc giao tranh, dấu trang và bút vẽ chiến thuật.'
              )}
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
              <span>{tr('Choose Highlight Video (.mp4)', 'Chọn file video Highlight (.mp4)')}</span>
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
                  aria-label={
                    isPlaying
                      ? tr('Pause replay video', 'Tạm dừng video replay')
                      : tr('Play replay video', 'Phát video replay')
                  }
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

              <span className="pointer-events-none absolute top-2 left-2 h-2.5 w-2.5 border-t border-l border-[#94A3B8]/40" />
              <span className="pointer-events-none absolute top-2 right-2 h-2.5 w-2.5 border-t border-r border-[#94A3B8]/40" />
              <span className="pointer-events-none absolute bottom-2 left-2 h-2.5 w-2.5 border-b border-l border-[#94A3B8]/40" />
              <span className="pointer-events-none absolute bottom-2 right-2 h-2.5 w-2.5 border-b border-r border-[#94A3B8]/40" />
            </div>

            {/* Scrubber Timeline + Markers */}
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
                    aria-label={tr('Seek replay timeline', 'Tua thời gian phát video')}
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
                          key={mk.id}
                          type="button"
                          aria-label={mk.label}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectRoundAndSeek(
                              mk.roundNumber,
                              mk.timestampSec,
                              mk.type === 'bookmark'
                            );
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

              {/* Playback & Frame-Step Controls */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#94A3B8]">
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={togglePlay}
                    title={tr('Shortcut: Space', 'Phím tắt: Space')}
                    className="inline-flex items-center gap-1.5 rounded-[2px] bg-[#171D28] hover:bg-[#232B3B] border border-[#232B3B] px-3 py-1.5 font-semibold text-[#EEF2F6] transition duration-150 active:translate-y-[1px]"
                  >
                    {isPlaying ? (
                      <Pause size={13} weight="bold" aria-hidden="true" />
                    ) : (
                      <Play size={13} weight="bold" aria-hidden="true" />
                    )}
                    <span>{isPlaying ? tr('Pause', 'Tạm dừng') : tr('Play', 'Phát')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => seekTo(currentTime - 5)}
                    title={tr('Back 5s (Left Arrow)', 'Lùi 5 giây (Mũi tên trái)')}
                    className="inline-flex items-center gap-1 rounded-[2px] bg-[#171D28] hover:bg-[#232B3B] border border-[#232B3B] px-2 py-1.5 font-mono hover:text-[#EEF2F6]"
                  >
                    <Rewind size={12} weight="bold" aria-hidden="true" />
                    <span>5s</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => stepFrame(-0.1)}
                    title={tr('Previous frame -0.1s (,)', 'Lùi từng khung hình -0.1s (phím ,)')}
                    className="rounded-[2px] bg-[#171D28] hover:bg-[#232B3B] border border-[#232B3B] px-2 py-1.5 font-mono text-[11px] hover:text-[#EEF2F6]"
                  >
                    -0.1s
                  </button>

                  <button
                    type="button"
                    onClick={() => stepFrame(0.1)}
                    title={tr('Next frame +0.1s (.)', 'Tiến từng khung hình +0.1s (phím .)')}
                    className="rounded-[2px] bg-[#171D28] hover:bg-[#232B3B] border border-[#232B3B] px-2 py-1.5 font-mono text-[11px] hover:text-[#EEF2F6]"
                  >
                    +0.1s
                  </button>

                  <button
                    type="button"
                    onClick={() => seekTo(currentTime + 5)}
                    title={tr('Forward 5s (Right Arrow)', 'Tiến 5 giây (Mũi tên phải)')}
                    className="inline-flex items-center gap-1 rounded-[2px] bg-[#171D28] hover:bg-[#232B3B] border border-[#232B3B] px-2 py-1.5 font-mono hover:text-[#EEF2F6]"
                  >
                    <span>5s</span>
                    <FastForward size={12} weight="bold" aria-hidden="true" />
                  </button>

                  <button
                    type="button"
                    onClick={cyclePlaybackRate}
                    title={tr('Cycle playback speed', 'Đổi tốc độ phát')}
                    className="rounded-[2px] bg-[#171D28] hover:bg-[#232B3B] border border-[#232B3B] px-2.5 py-1.5 font-mono text-[#EEF2F6] tabular-nums"
                  >
                    {playbackRate}x
                  </button>

                  <span className="ml-1 font-mono text-[#94A3B8] tabular-nums">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3 font-mono text-[11px] text-[#94A3B8]">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-[#10B981]" /> {tr('Kill', 'Có Kill')}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-[#F43F5E]" />{' '}
                    {tr('Death', 'Bị hạ gục')}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-[#E59A23]" />{' '}
                    {tr('Round / Zone', 'Thắng / Bo')}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-[#38BDF8]" />{' '}
                    {tr('Bookmark', 'Dấu trang')}
                  </span>
                </div>
              </div>

              {/* Custom Timestamp Bookmarks Bar */}
              {matchId && (
                <div className="rounded-[2px] bg-[#0A0D12] border border-[#232B3B] p-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                    <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold uppercase tracking-wider text-[#38BDF8] mr-1">
                      <BookmarkSimple size={13} weight="bold" aria-hidden="true" />
                      <span>{tr('Bookmarks:', 'Dấu trang:')}</span>
                    </span>

                    {bookmarks.length === 0 ? (
                      <span className="text-[11px] text-[#64748B]">
                        {tr(
                          'Press B or click + Mark to save key replay moments.',
                          'Bấm phím B hoặc nút + Lưu mốc để đánh dấu pha quan trọng.'
                        )}
                      </span>
                    ) : (
                      bookmarks.map((bm) => (
                        <span
                          key={bm.id}
                          className="inline-flex items-center rounded-[2px] bg-[#171D28] border border-[#38BDF8]/35 text-[11px] font-mono text-[#EEF2F6]"
                        >
                          <button
                            type="button"
                            onClick={() => seekTo(bm.timeSec)}
                            className="px-2 py-0.5 hover:text-[#38BDF8] transition duration-150 tabular-nums"
                          >
                            <strong className="text-[#38BDF8]">{formatTime(bm.timeSec)}</strong>{' '}
                            {bm.label}
                          </button>
                          <button
                            type="button"
                            aria-label={tr(
                              `Remove bookmark ${bm.label}`,
                              `Xóa dấu trang ${bm.label}`
                            )}
                            onClick={() => handleRemoveBookmark(bm.id)}
                            className="px-1.5 py-0.5 border-l border-[#232B3B] text-[#64748B] hover:text-[#F43F5E] transition duration-150"
                          >
                            <X size={11} weight="bold" aria-hidden="true" />
                          </button>
                        </span>
                      ))
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <label htmlFor="replay-bookmark-label" className="sr-only">
                      {tr('Bookmark label', 'Tên dấu trang thời gian')}
                    </label>
                    <input
                      id="replay-bookmark-label"
                      type="text"
                      value={bookmarkLabelInput}
                      onChange={(e) => setBookmarkLabelInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddBookmark();
                        }
                      }}
                      placeholder={tr('Note (optional)...', 'Ghi chú mốc...')}
                      className="w-32 sm:w-40 px-2 py-1 rounded-[2px] bg-[#10141C] border border-[#232B3B] focus:border-[#38BDF8] text-[11px] font-mono text-[#EEF2F6] placeholder-[#64748B] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleAddBookmark}
                      title={tr('Shortcut: B', 'Phím tắt: B')}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[2px] bg-[#38BDF8]/15 hover:bg-[#38BDF8]/25 border border-[#38BDF8]/45 font-mono text-[11px] font-bold text-[#38BDF8] transition duration-150"
                    >
                      <BookmarkSimple size={12} weight="bold" aria-hidden="true" />
                      <span>{tr('+ Mark (B)', '+ Lưu mốc (B)')}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {hasSelectedMatch && (
        <RoundTimeline
          gameType={gameType}
          rounds={rounds}
          selectedRound={selectedRound}
          onSelectRound={(roundNum) => handleSelectRoundAndSeek(roundNum)}
        />
      )}
    </div>
  );
};

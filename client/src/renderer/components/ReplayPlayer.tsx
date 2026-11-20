import React, { useEffect, useRef, useState } from 'react';
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const [manualVideoUrl, setManualVideoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const isValo = gameType === 'VALORANT';

  useEffect(() => {
    setManualVideoUrl(null);
  }, [matchId, matchTitle]);

  const activeVideoSrc = manualVideoUrl || videoSrc;

  const handleSeekToMs = (timestampMs: number, roundNumber: number) => {
    onSelectRound(roundNumber);
    if (videoRef.current) {
      videoRef.current.currentTime = timestampMs / 1000;
      void videoRef.current.play().catch(() => {});
    }
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current || rounds.length === 0) return;
    const currentMs = videoRef.current.currentTime * 1000;
    const matched = rounds.find(
      (r) => currentMs >= r.startTimestampMs && currentMs <= r.endTimestampMs
    );
    if (matched && matched.roundNumber !== selectedRound) {
      onSelectRound(matched.roundNumber);
    }
  };

  const handleManualFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const objectUrl = URL.createObjectURL(file);
    setManualVideoUrl(objectUrl);

    if (matchId) {
      setUploading(true);
      try {
        const res = await uploadMatchHighlight(matchId, file, file.name);
        if (onHighlightSaved) {
          onHighlightSaved(res.cloudVideoUrl);
        }
      } catch (err) {
        console.error('Lỗi tải highlight lên hệ thống:', err);
      } finally {
        setUploading(false);
      }
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="relative aspect-video w-full rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
        {activeVideoSrc ? (
          <>
            <video
              ref={videoRef}
              src={activeVideoSrc}
              controls
              onTimeUpdate={handleTimeUpdate}
              className="w-full h-full object-contain bg-black"
            />
            {uploading && (
              <div className="absolute top-3 right-3 px-3 py-1 rounded-full bg-slate-900/90 border border-emerald-500/40 text-xs text-emerald-300">
                Đang lưu highlight lên hệ thống...
              </div>
            )}
          </>
        ) : !hasSelectedMatch ? (
          <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center gap-3 bg-gradient-to-b from-slate-900/60 to-slate-950">
            <span
              className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border ${
                isValo
                  ? 'bg-[#ff4655]/10 text-[#ff4655] border-[#ff4655]/30'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
              }`}
            >
              {isValo ? 'VALORANT Post-Match Replay' : 'PUBG Telemetry & Replay'}
            </span>
            <h3 className="text-base font-bold text-slate-200">
              {isValo
                ? 'Sẵn sàng ghi hình và phân tích 20 trận VALORANT gần nhất'
                : 'Sẵn sàng ghi hình và phân tích 20 trận PUBG gần nhất'}
            </h3>
            <p className="text-xs text-slate-500 max-w-md leading-relaxed">
              Hệ thống tự động cập nhật trận đấu mới nhất, thay thế các trận cũ quá mốc 20 và lưu trữ video highlight trực tiếp trên máy chủ.
            </p>
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center gap-3 bg-slate-900/70">
            <p className="text-sm font-semibold text-slate-200">
              Trận <span className={isValo ? 'text-[#ff4655]' : 'text-amber-400'}>{matchTitle}</span> chưa có video highlight trên hệ thống
            </p>
            <p className="text-xs text-slate-400 max-w-md">
              Video sẽ tự động lưu khi chơi qua Overwolf, hoặc bạn có thể tải file video highlight (.mp4) từ máy lên hệ thống ngay tại đây.
            </p>
            <label className="mt-1 cursor-pointer px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition">
              Tải Highlight (.mp4) lên hệ thống
              <input
                type="file"
                accept="video/mp4,video/webm"
                onChange={(e) => void handleManualFileSelect(e)}
                className="hidden"
              />
            </label>
          </div>
        )}
      </div>

      <RoundTimeline
        gameType={gameType}
        rounds={rounds}
        selectedRound={selectedRound}
        onSeekToMs={handleSeekToMs}
      />
    </div>
  );
};
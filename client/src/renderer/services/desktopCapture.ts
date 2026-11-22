import {
  fetchMatchDetail,
  getLocalVideoByMatchId,
  saveLocalVideoRecord,
  uploadMatchHighlight,
} from './localDb';

export interface DesktopCaptureStatus {
  activeGame: 'VALORANT' | 'PUBG' | null;
  overwolfInstalled: boolean;
  overwolfInstallPath: string | null;
  overwolfRunning: boolean;
  desktopCaptureEnabled: boolean;
  hotkeyRegistered: boolean;
  hotkey: string;
  shouldRecord: boolean;
}

export interface PromotedHighlightClip {
  filePath: string;
  fileName: string;
  durationSec: number;
  recordedAt: string;
}

const SEGMENT_DURATION_MS = 25000;

function pickSupportedMimeType(): string {
  const candidates = [
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp8',
    'video/webm',
  ];
  for (const mime of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(mime)) {
      return mime;
    }
  }
  return '';
}

class DesktopRingRecorder {
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private rotateTimer: number | null = null;
  private chunks: BlobPart[] = [];
  private segmentStartMs = 0;
  private currentGame: 'VALORANT' | 'PUBG' = 'PUBG';
  private active = false;
  private flushMode: 'temp' | 'f9' | 'discard' = 'temp';
  private onF9SavedCb: ((clip: PromotedHighlightClip) => void) | null = null;

  public setOnF9Saved(cb: ((clip: PromotedHighlightClip) => void) | null): void {
    this.onF9SavedCb = cb;
  }

  public isActive(): boolean {
    return this.active;
  }

  public async ensureState(status: DesktopCaptureStatus): Promise<void> {
    if (status.shouldRecord && status.activeGame) {
      if (!this.active || this.currentGame !== status.activeGame) {
        await this.start(status.activeGame);
      }
      return;
    }

    if (this.active) {
      await this.stop();
    }
  }

  private async acquireScreenStream(): Promise<MediaStream | null> {
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI?.getScreenSourceId) return null;
    const source = await electronAPI.getScreenSourceId();
    if (!source?.id) return null;

    const videoConstraint = {
      mandatory: {
        chromeMediaSource: 'desktop',
        chromeMediaSourceId: source.id,
        maxWidth: 1280,
        maxHeight: 720,
        maxFrameRate: 30,
      },
    } as any;

    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: source.id,
          },
        } as any,
        video: videoConstraint,
      });
    } catch {
      // Dự phòng nếu driver âm thanh desktop không cho loopback capture
      return await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: videoConstraint,
      });
    }
  }

  public async start(gameType: 'VALORANT' | 'PUBG'): Promise<void> {
    await this.stop();
    const stream = await this.acquireScreenStream().catch(() => null);
    if (!stream) return;

    this.stream = stream;
    this.currentGame = gameType;
    this.active = true;
    this.startNewSegment();
  }

  private startNewSegment(): void {
    if (!this.active || !this.stream) return;

    const mimeType = pickSupportedMimeType();
    const options: MediaRecorderOptions = { videoBitsPerSecond: 3_000_000 };
    if (mimeType) options.mimeType = mimeType;

    let rec: MediaRecorder;
    try {
      rec = new MediaRecorder(this.stream, options);
    } catch {
      rec = new MediaRecorder(this.stream);
    }

    this.recorder = rec;
    this.chunks = [];
    this.segmentStartMs = Date.now();
    this.flushMode = 'temp';

    rec.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) {
        this.chunks.push(ev.data);
      }
    };

    rec.onstop = () => {
      const mode = this.flushMode;
      const startMs = this.segmentStartMs;
      const endMs = Date.now();
      const gameType = this.currentGame;
      const blob = new Blob(this.chunks, { type: mimeType || 'video/webm' });
      this.chunks = [];

      if (this.active && mode !== 'discard') {
        this.startNewSegment();
      }

      if (mode === 'discard' || blob.size === 0) return;
      void this.persistBlob(blob, mode, gameType, startMs, endMs);
    };

    rec.start();
    if (this.rotateTimer !== null) window.clearTimeout(this.rotateTimer);
    this.rotateTimer = window.setTimeout(() => {
      if (this.recorder && this.recorder.state === 'recording') {
        this.flushMode = 'temp';
        this.recorder.stop();
      }
    }, SEGMENT_DURATION_MS);
  }

  private async persistBlob(
    blob: Blob,
    mode: 'temp' | 'f9',
    gameType: 'VALORANT' | 'PUBG',
    startMs: number,
    endMs: number
  ): Promise<void> {
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI) return;

    const ab = await blob.arrayBuffer();
    const bytes = new Uint8Array(ab);

    if (mode === 'f9') {
      const res = await electronAPI.promoteF9Highlight({
        gameType,
        startMs,
        endMs,
        bytes,
      });
      if (res?.saved && this.onF9SavedCb) {
        this.onF9SavedCb({
          filePath: res.filePath,
          fileName: res.fileName,
          durationSec: res.durationSec,
          recordedAt: res.recordedAt,
        });
      }
      return;
    }

    await electronAPI.saveTempSegment({
      gameType,
      startMs,
      endMs,
      bytes,
    });
  }

  public async triggerF9Highlight(fallbackGame: 'VALORANT' | 'PUBG'): Promise<void> {
    if (this.active && this.recorder && this.recorder.state === 'recording') {
      if (this.rotateTimer !== null) {
        window.clearTimeout(this.rotateTimer);
        this.rotateTimer = null;
      }
      this.flushMode = 'f9';
      this.recorder.stop();
      return;
    }

    // Nếu không đang quay (hoặc người dùng nhấn F9 ngay khi vừa thoát trận), vẫn kiểm tra promote đoạn gần nhất
    const electronAPI = (window as any).electronAPI;
    if (electronAPI?.promoteF9Highlight) {
      const res = await electronAPI.promoteF9Highlight({
        gameType: this.currentGame || fallbackGame,
        startMs: Date.now(),
        endMs: Date.now(),
      });
      if (res?.saved && this.onF9SavedCb) {
        this.onF9SavedCb({
          filePath: res.filePath,
          fileName: res.fileName,
          durationSec: res.durationSec,
          recordedAt: res.recordedAt,
        });
      }
    }
  }

  public async stop(): Promise<void> {
    if (this.rotateTimer !== null) {
      window.clearTimeout(this.rotateTimer);
      this.rotateTimer = null;
    }
    this.active = false;

    if (this.recorder && this.recorder.state === 'recording') {
      this.flushMode = 'temp';
      try {
        this.recorder.stop();
      } catch {
        // Bỏ qua lỗi dừng recorder
      }
    }
    this.recorder = null;

    if (this.stream) {
      for (const track of this.stream.getTracks()) {
        track.stop();
      }
      this.stream = null;
    }
  }
}

export const desktopRingRecorder = new DesktopRingRecorder();

export async function matchDesktopHighlightsForMatches(
  matches: Array<{
    match_id: string;
    game_type: 'VALORANT' | 'PUBG';
    played_at: string;
    duration_sec: number;
    cloud_video_url?: string | null;
  }>
): Promise<string[]> {
  const electronAPI = (window as any).electronAPI;
  if (!electronAPI?.matchKillSegments || matches.length === 0) return [];

  const attachedMatchIds: string[] = [];
  const recentWindowMs = Date.now() - 4 * 60 * 60 * 1000;

  for (const m of matches.slice(0, 5)) {
    const matchStartMs = new Date(m.played_at).getTime();
    if (!Number.isFinite(matchStartMs) || matchStartMs < recentWindowMs) continue;
    if (getLocalVideoByMatchId(m.match_id) || m.cloud_video_url) continue;

    try {
      const detail = await fetchMatchDetail(m.match_id);
      const rounds = Array.isArray(detail?.rounds) ? detail.rounds : [];
      const killEpochsMs: number[] = [];

      for (const rd of rounds) {
        const events = Array.isArray(rd.events) ? rd.events : [];
        for (const ev of events) {
          if (ev.type === 'KILL' && typeof ev.timestampMs === 'number') {
            killEpochsMs.push(matchStartMs + ev.timestampMs);
          }
        }
      }

      const matchEndMs = matchStartMs + Math.max(60, Number(m.duration_sec || 1800)) * 1000;
      const res = await electronAPI.matchKillSegments({
        matchId: m.match_id,
        gameType: m.game_type,
        matchStartMs,
        matchEndMs,
        killEpochsMs,
      });

      const clips: PromotedHighlightClip[] = Array.isArray(res?.clips) ? res.clips : [];
      if (clips.length === 0) continue;

      const primary = clips[clips.length - 1];
      saveLocalVideoRecord({
        matchId: m.match_id,
        gameType: m.game_type,
        filePath: primary.filePath,
        fileName: primary.fileName,
        durationSec: primary.durationSec,
        recordedAt: primary.recordedAt,
      });
      attachedMatchIds.push(m.match_id);

      // Thử đồng bộ lên server/cloud nếu có file URL hợp lệ
      try {
        const fileRes = await fetch(`file:///${primary.filePath.replace(/\\/g, '/')}`);
        const blob = await fileRes.blob();
        if (blob.size > 0 && blob.size <= 4 * 1024 * 1024) {
          await uploadMatchHighlight(m.match_id, blob, primary.fileName);
        }
      } catch {
        // Giữ clip phát local ổn định ngay cả khi quá 4MB mà chưa cấu hình S3/R2
      }
    } catch {
      // Bỏ qua lỗi từng trận đơn lẻ
    }
  }

  return attachedMatchIds;
}

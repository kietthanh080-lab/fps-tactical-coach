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
  captureCompatMode?: 'wgc' | 'dxgi';
  captureQuality?: '720p30' | '1080p60';
  preferredScreenId?: string | null;
  hotkeyRegistered: boolean;
  hotkey: string;
  shouldRecord: boolean;
}

export interface ScreenSourceItem {
  id: string;
  name: string;
  displayId: string;
  isPrimary: boolean;
}

export interface PromotedHighlightClip {
  filePath: string;
  fileName: string;
  durationSec: number;
  recordedAt: string;
}

const SEGMENT_DURATION_MS = 25000;

async function sampleStreamFrame(
  stream: MediaStream
): Promise<{ width: number; height: number; isBlack: boolean }> {
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.srcObject = stream;
  try {
    await video.play();
    await new Promise((r) => window.setTimeout(r, 450));
    const vw = video.videoWidth || 1280;
    const vh = video.videoHeight || 720;
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 18;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { width: vw, height: vh, isBlack: false };
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let maxLuma = 0;
    for (let i = 0; i < data.length; i += 4) {
      const luma = data[i] + data[i + 1] + data[i + 2];
      if (luma > maxLuma) maxLuma = luma;
    }
    return { width: vw, height: vh, isBlack: maxLuma <= 9 };
  } catch {
    return { width: 0, height: 0, isBlack: false };
  } finally {
    video.pause();
    video.srcObject = null;
  }
}

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
  private blackCheckTimer: number | null = null;
  private chunks: BlobPart[] = [];
  private segmentStartMs = 0;
  private currentGame: 'VALORANT' | 'PUBG' = 'PUBG';
  private currentQuality: '720p30' | '1080p60' = '720p30';
  private currentScreenId: string | null = null;
  private active = false;
  private flushMode: 'temp' | 'f9' | 'discard' = 'temp';
  private onF9SavedCb: ((clip: PromotedHighlightClip) => void) | null = null;
  private onBlackScreenCb: (() => void) | null = null;

  public setOnF9Saved(cb: ((clip: PromotedHighlightClip) => void) | null): void {
    this.onF9SavedCb = cb;
  }

  public setOnBlackScreen(cb: (() => void) | null): void {
    this.onBlackScreenCb = cb;
  }

  public isActive(): boolean {
    return this.active;
  }

  public async ensureState(status: DesktopCaptureStatus): Promise<void> {
    const nextQuality = status.captureQuality === '1080p60' ? '1080p60' : '720p30';
    const nextScreenId = status.preferredScreenId || null;

    if (status.shouldRecord && status.activeGame) {
      const configChanged =
        this.currentGame !== status.activeGame ||
        this.currentQuality !== nextQuality ||
        this.currentScreenId !== nextScreenId;

      if (!this.active || configChanged) {
        this.currentQuality = nextQuality;
        this.currentScreenId = nextScreenId;
        await this.start(status.activeGame);
      }
      return;
    }

    this.currentQuality = nextQuality;
    this.currentScreenId = nextScreenId;
    if (this.active) {
      await this.stop();
    }
  }

  private async acquireScreenStream(quality: '720p30' | '1080p60'): Promise<MediaStream | null> {
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI?.getScreenSourceId) return null;
    const source = await electronAPI.getScreenSourceId();
    if (!source?.id) return null;

    const is1080 = quality === '1080p60';
    const videoConstraint = {
      mandatory: {
        chromeMediaSource: 'desktop',
        chromeMediaSourceId: source.id,
        maxWidth: is1080 ? 1920 : 1280,
        maxHeight: is1080 ? 1080 : 720,
        maxFrameRate: is1080 ? 60 : 30,
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

  public async testCaptureHealth(): Promise<{
    ok: boolean;
    isBlack: boolean;
    width: number;
    height: number;
  }> {
    if (this.stream) {
      const res = await sampleStreamFrame(this.stream);
      return { ok: !res.isBlack && res.width > 0, ...res };
    }
    const testStream = await this.acquireScreenStream(this.currentQuality).catch(() => null);
    if (!testStream) {
      return { ok: false, isBlack: false, width: 0, height: 0 };
    }
    try {
      const res = await sampleStreamFrame(testStream);
      return { ok: !res.isBlack && res.width > 0, ...res };
    } finally {
      for (const track of testStream.getTracks()) track.stop();
    }
  }

  public async start(gameType: 'VALORANT' | 'PUBG'): Promise<void> {
    await this.stop();
    const stream = await this.acquireScreenStream(this.currentQuality).catch(() => null);
    if (!stream) return;

    this.stream = stream;
    this.currentGame = gameType;
    this.active = true;
    this.startNewSegment();

    if (this.blackCheckTimer !== null) window.clearTimeout(this.blackCheckTimer);
    this.blackCheckTimer = window.setTimeout(() => {
      if (!this.active || !this.stream) return;
      void sampleStreamFrame(this.stream).then((res) => {
        if (this.active && res.isBlack && this.onBlackScreenCb) {
          this.onBlackScreenCb();
        }
      });
    }, 3500);
  }

  private startNewSegment(): void {
    if (!this.active || !this.stream) return;

    const mimeType = pickSupportedMimeType();
    const bps = this.currentQuality === '1080p60' ? 5_500_000 : 2_500_000;
    const options: MediaRecorderOptions = { videoBitsPerSecond: bps };
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
    if (this.blackCheckTimer !== null) {
      window.clearTimeout(this.blackCheckTimer);
      this.blackCheckTimer = null;
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

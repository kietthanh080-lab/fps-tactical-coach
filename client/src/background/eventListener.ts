import { videoRecorder } from './videoRecorder';
import {
  getAuthToken,
  saveLocalVideoRecord,
  submitMatchForAnalysis,
  TimelineEvent,
  uploadMatchHighlight,
} from '../renderer/services/localDb';

const VALORANT_GAME_ID = 21640;
const PUBG_GAME_ID = 10906;

const VALORANT_FEATURES = ['match_info', 'kill', 'death', 'round_info', 'me'];
const PUBG_FEATURES = ['match_info', 'kill', 'death', 'phase', 'me'];

class GameEventListener {
  private activeGameType: 'VALORANT' | 'PUBG' | null = null;
  private matchStartTime = 0;
  private currentRound = 1;
  private currentMap = 'Unknown Map';
  private currentMode = 'Competitive';
  private currentMatchId = '';
  private timelineEvents: TimelineEvent[] = [];

  public init(): void {
    if (typeof overwolf === 'undefined' || !overwolf.games) {
      console.log('[EventListener] Chạy ngoài môi trường Overwolf.');
      return;
    }

    // Kiểm tra game đang mở sẵn khi app khởi động
    overwolf.games.getRunningGameInfo((gameInfo) => {
      if (gameInfo && gameInfo.isRunning) {
        this.onGameLaunched(gameInfo.classId);
      }
    });

    // Lắng nghe khi người chơi mở hoặc thoát game
    overwolf.games.onGameInfoUpdated.addListener((res) => {
      if (res.runningChanged && res.gameInfo) {
        if (res.gameInfo.isRunning) {
          this.onGameLaunched(res.gameInfo.classId);
        } else {
          this.onGameClosed();
        }
      }
    });

    // Lắng nghe các sự kiện theo thời gian thực trong trận
    overwolf.games.events.onNewEvents.addListener((data) => {
      for (const ev of data.events) {
        this.handleNewEvent(ev.name, ev.data);
      }
    });

    // Lắng nghe cập nhật thông tin bản đồ, chế độ chơi, match_id
    overwolf.games.events.onInfoUpdates2.addListener((info) => {
      this.handleInfoUpdate(info.info as Record<string, any>);
    });
  }

  private onGameLaunched(classId: number): void {
    if (classId === VALORANT_GAME_ID) {
      this.activeGameType = 'VALORANT';
      this.registerFeatures(VALORANT_FEATURES);
    } else if (classId === PUBG_GAME_ID) {
      this.activeGameType = 'PUBG';
      this.registerFeatures(PUBG_FEATURES);
    }
  }

  private onGameClosed(): void {
    if (videoRecorder.getRecordingState()) {
      void this.finalizeMatch('ABORTED');
    }
    this.activeGameType = null;
  }

  private registerFeatures(features: string[], retries = 5): void {
    overwolf.games.events.setRequiredFeatures(features, (res) => {
      if (!res.success && retries > 0) {
        setTimeout(() => this.registerFeatures(features, retries - 1), 3000);
      } else {
        console.log(`[EventListener] Đã kết nối GEP (${this.activeGameType}):`, res.success);
      }
    });
  }

  private handleInfoUpdate(info: Record<string, any>): void {
    const matchInfo = info?.match_info;
    if (!matchInfo) return;

    if (matchInfo.map) this.currentMap = String(matchInfo.map);
    if (matchInfo.game_mode || matchInfo.mode) {
      this.currentMode = String(matchInfo.game_mode || matchInfo.mode);
    }
    if (matchInfo.match_id) {
      this.currentMatchId = String(matchInfo.match_id);
    }
  }

  private handleNewEvent(name: string, rawData: any): void {
    let parsedData: Record<string, unknown> = {};
    if (typeof rawData === 'string') {
      try {
        parsedData = JSON.parse(rawData);
      } catch {
        parsedData = { raw: rawData };
      }
    } else if (rawData && typeof rawData === 'object') {
      parsedData = rawData;
    }

    const relativeMs = Math.max(0, Date.now() - this.matchStartTime);

    switch (name) {
      case 'match_start':
        void this.beginMatch();
        break;

      case 'round_start':
      case 'phase_change':
        this.currentRound += 1;
        this.timelineEvents.push({
          timestampMs: relativeMs,
          round: this.currentRound,
          type: 'ROUND_START',
          payload: parsedData,
        });
        break;

      case 'kill':
        this.timelineEvents.push({
          timestampMs: relativeMs,
          round: this.currentRound,
          type: 'KILL',
          payload: parsedData,
        });
        break;

      case 'death':
        this.timelineEvents.push({
          timestampMs: relativeMs,
          round: this.currentRound,
          type: 'DEATH',
          payload: parsedData,
        });
        break;

      case 'spike_planted':
        this.timelineEvents.push({
          timestampMs: relativeMs,
          round: this.currentRound,
          type: 'SPIKE_PLANTED',
          payload: parsedData,
        });
        break;

      case 'round_end':
        this.timelineEvents.push({
          timestampMs: relativeMs,
          round: this.currentRound,
          type: 'ROUND_END',
          payload: parsedData,
        });
        break;

      case 'match_end':
        void this.finalizeMatch('COMPLETED');
        break;
    }
  }

  private async beginMatch(): Promise<void> {
    this.matchStartTime = Date.now();
    this.currentRound = 1;
    this.timelineEvents = [
      { timestampMs: 0, round: 1, type: 'ROUND_START' },
    ];
    if (!this.currentMatchId) {
      this.currentMatchId = `${this.activeGameType || 'FPS'}_${Date.now()}`;
    }
    await videoRecorder.startRecording();
  }

  private async finalizeMatch(matchResult: string): Promise<void> {
    if (!this.activeGameType) return;

    const gameType = this.activeGameType;
    const matchId = this.currentMatchId || `${gameType}_${Date.now()}`;
    const recording = await videoRecorder.stopRecording();

    if (recording.success && recording.filePath) {
      saveLocalVideoRecord({
        matchId,
        gameType,
        filePath: recording.filePath,
        fileName: recording.fileName,
        durationSec: recording.durationSec,
        recordedAt: new Date().toISOString(),
      });
    }

if (getAuthToken()) {
      try {
        await submitMatchForAnalysis({
          matchId,
          gameType,
          mapName: this.currentMap,
          gameMode: this.currentMode,
          matchResult,
          scoreSummary: '',
          localVideoFilename: recording.fileName || null,
          durationSec: recording.durationSec,
          localEvents: this.timelineEvents,
        });

        // Tự động lưu video highlight lên hệ thống máy chủ
        const sourceUrl =
          recording.videoUrl ||
          (recording.filePath ? `file:///${recording.filePath.replace(/\\/g, '/')}` : '');
        if (sourceUrl) {
          const videoRes = await fetch(sourceUrl);
          const videoBlob = await videoRes.blob();
          await uploadMatchHighlight(
            matchId,
            videoBlob,
            recording.fileName || `${matchId}.mp4`
          );
        }
      } catch (err) {
        console.error('[EventListener] Lỗi lưu phân tích/highlight sau trận:', err);
      }
    }

    // Reset ID trận cho ván tiếp theo
    this.currentMatchId = '';

    // Mở cửa sổ Desktop App để người dùng xem lại video & phân tích ngay sau trận
    if (typeof overwolf !== 'undefined' && overwolf.windows) {
      overwolf.windows.obtainDeclaredWindow('desktop', (win) => {
        if (win.success && win.window) {
          overwolf.windows.restore(win.window.id);
        }
      });
    }
  }
}

const listener = new GameEventListener();
listener.init();
import { removeOldestLocalVideos } from '../renderer/services/localDb';

export interface RecordingResult {
  success: boolean;
  filePath: string;
  videoUrl: string;
  fileName: string;
  durationSec: number;
}

class VideoRecorderService {
  private isRecording = false;
  private startTimeMs = 0;
  private activeStreamId: number | null = null;

  public getRecordingState(): boolean {
    return this.isRecording;
  }

  public startRecording(): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.isRecording) {
        resolve(true);
        return;
      }

      if (typeof overwolf === 'undefined' || !overwolf.streaming) {
        console.warn('[VideoRecorder] Đang chạy ngoài Overwolf, bật chế độ giả lập.');
        this.isRecording = true;
        this.startTimeMs = Date.now();
        resolve(true);
        return;
      }

        const streamSettings = {
        provider: 2, // 2 = StreamingProvider.VideoRecorder
        settings: {
          video: {
            fps: 60,
            width: 1920,
            height: 1080,
            max_kbps: 8000,
            buffer_length: 0,
            frame_interval: 1,
            override_overwolf_setting: true,
          },
          audio: {
            mic: { volume: 80, enabled: true },
            game: { volume: 100, enabled: true },
          },
            },
        } as unknown as overwolf.streaming.StreamSettings;

      overwolf.streaming.start(streamSettings, (result) => {
        if (result.success) {
          this.isRecording = true;
          this.startTimeMs = Date.now();
          this.activeStreamId = result.stream_id ?? null;
          console.log('[VideoRecorder] Bắt đầu quay trận đấu, stream_id:', this.activeStreamId);
          resolve(true);
        } else {
          console.error('[VideoRecorder] Không thể bắt đầu quay:', result.error);
          resolve(false);
        }
      });
    });
  }

  public stopRecording(): Promise<RecordingResult> {
    return new Promise((resolve) => {
      const durationSec = Math.max(1, Math.round((Date.now() - this.startTimeMs) / 1000));

      if (!this.isRecording) {
        resolve({ success: false, filePath: '', videoUrl: '', fileName: '', durationSec: 0 });
        return;
      }

      if (typeof overwolf === 'undefined' || !overwolf.streaming || this.activeStreamId === null) {
        this.isRecording = false;
        resolve({
          success: true,
          filePath: '',
          videoUrl: '',
          fileName: `mock_replay_${Date.now()}.mp4`,
          durationSec,
        });
        return;
      }

      overwolf.streaming.stop(this.activeStreamId, (result) => {
        this.isRecording = false;
        this.activeStreamId = null;

        const filePath =
          'file_path' in result && typeof result.file_path === 'string' ? result.file_path : '';
        const videoUrl =
          'url' in result && typeof result.url === 'string' ? result.url : '';

        if (result.success && (filePath || videoUrl)) {
          const normalizedPath = (filePath || videoUrl).replace(/\\/g, '/');
          const fileName = normalizedPath.split('/').pop() || `replay_${Date.now()}.mp4`;

          this.cleanupStorage(20);

          resolve({
            success: true,
            filePath,
            videoUrl,
            fileName,
            durationSec,
          });
        } else {
          console.error('[VideoRecorder] Lỗi khi dừng quay:', result.error);
          resolve({ success: false, filePath: '', videoUrl: '', fileName: '', durationSec });
        }
      });
    });
  }

  private cleanupStorage(maxKeepCount: number): void {
    const removedRecords = removeOldestLocalVideos(maxKeepCount);
    if (typeof overwolf === 'undefined' || !overwolf.media?.videos?.deleteVideo) return;

    for (const rec of removedRecords) {
      const target = rec.videoUrl || rec.filePath;
      if (target) {
        overwolf.media.videos.deleteVideo(target, (res) => {
          console.log('[VideoRecorder] Đã dọn file video cũ:', rec.fileName, res.success);
        });
      }
    }
  }
}

export const videoRecorder = new VideoRecorderService();
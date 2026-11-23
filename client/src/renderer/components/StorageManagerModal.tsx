import React, { useCallback, useEffect, useState } from 'react';
import {
  CloudCheck,
  FolderOpen,
  HardDrive,
  Keyboard,
  Microphone,
  SpeakerHigh,
  Trash,
  X,
} from '@phosphor-icons/react';
import { DesktopCaptureStatus, StorageStats } from '../services/desktopCapture';
import { fetchStorageStatus } from '../services/localDb';

interface StorageManagerModalProps {
  isOpen: boolean;
  isElectronRuntime: boolean;
  captureStatus: DesktopCaptureStatus | null;
  pinnedMatchIds: string[];
  onUpdateOptions: (opts: {
    hotkey?: string;
    micEnabled?: boolean;
    beepEnabled?: boolean;
    maxStorageGb?: number;
  }) => Promise<void>;
  onClose: () => void;
}

const formatMb = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
  return `${mb.toFixed(1)} MB`;
};

export const StorageManagerModal: React.FC<StorageManagerModalProps> = ({
  isOpen,
  isElectronRuntime,
  captureStatus,
  pinnedMatchIds,
  onUpdateOptions,
  onClose,
}) => {
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [cloudStatus, setCloudStatus] = useState<{
    s3Configured: boolean;
    mode: string;
    maxDirectUploadMb: number;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  const loadStats = useCallback(async () => {
    const electronAPI = (window as any).electronAPI;
    if (electronAPI?.getStorageStats) {
      const s = await electronAPI.getStorageStats().catch(() => null);
      if (s) setStats(s);
    }
    const cloud = await fetchStorageStatus().catch(() => null);
    if (cloud) setCloudStatus(cloud);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    void loadStats();
  }, [isOpen, loadStats]);

  if (!isOpen) return null;

  const handleOpenFolder = async () => {
    const electronAPI = (window as any).electronAPI;
    if (electronAPI?.openHighlightsFolder) {
      await electronAPI.openHighlightsFolder();
    }
  };

  const handleDeleteClip = async (filePath: string) => {
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI?.deleteLocalClip) return;
    setBusy(true);
    try {
      const res = await electronAPI.deleteLocalClip(filePath);
      if (res?.stats) setStats(res.stats);
    } finally {
      setBusy(false);
    }
  };

  const handleCleanupUnpinned = async (clearUnpinned: boolean) => {
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI?.cleanupStorage) return;
    setBusy(true);
    try {
      const res = await electronAPI.cleanupStorage({
        pinnedMatchIds,
        clearUnpinned,
      });
      if (res?.stats) setStats(res.stats);
    } finally {
      setBusy(false);
    }
  };

  const hotkeys = captureStatus?.allowedHotkeys || [
    'F6',
    'F7',
    'F8',
    'F9',
    'F10',
    'F11',
    'Alt+H',
    'Alt+Z',
    'Ctrl+Shift+H',
  ];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="storage-modal-title"
    >
      <div className="bg-[#10141C] border border-[#232B3B] rounded-[4px] w-full max-w-2xl max-h-[88vh] flex flex-col overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#232B3B]">
          <div className="flex items-center gap-2">
            <HardDrive size={18} weight="bold" className="text-[#38BDF8]" aria-hidden="true" />
            <h2 id="storage-modal-title" className="font-display text-base font-bold text-[#EEF2F6]">
              Quản lý Quay Clip, Phím tắt &amp; Cloud R2
            </h2>
          </div>
          <button
            type="button"
            aria-label="Đóng cửa sổ quản lý lưu trữ"
            onClick={onClose}
            className="text-[#94A3B8] hover:text-[#EEF2F6] p-1"
          >
            <X size={16} weight="bold" aria-hidden="true" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4 tactical-scrollbar">
          {/* 1. Trang thai Cloud R2 & Overwolf */}
          <div className="rounded-[2px] border border-[#232B3B] bg-[#0A0D12] p-3.5 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 font-mono text-xs font-bold text-[#EEF2F6]">
                <CloudCheck size={15} weight="bold" className="text-[#10B981]" aria-hidden="true" />
                <span>Lưu trữ &amp; Chia sẻ Cloud (Cloudflare R2 / S3)</span>
              </span>
              <span
                className={`px-2 py-0.5 rounded-[2px] font-mono text-[10px] font-bold border ${
                  cloudStatus?.s3Configured
                    ? 'bg-[#10B981]/15 border-[#10B981]/40 text-[#10B981]'
                    : 'bg-[#E59A23]/15 border-[#E59A23]/40 text-[#E59A23]'
                }`}
              >
                {cloudStatus?.s3Configured ? 'ĐÃ BẬT R2/S3 (KHÔNG GIỚI HẠN)' : 'MẶC ĐỊNH (< 4.5MB)'}
              </span>
            </div>
            <p className="text-xs text-[#94A3B8] leading-relaxed">
              {cloudStatus?.s3Configured
                ? 'Máy chủ đã bật Presigned Upload R2/S3. Mọi clip quay được sẽ tự đẩy lên cloud để bạn bè xem qua link chia sẻ.'
                : 'Hiện server chưa gắn 6 biến S3_* của Cloudflare R2 (gói miễn phí 10GB), nên chỉ nhận upload trực tiếp dưới 4.5MB; clip nặng hơn vẫn lưu và phát ngay trên máy của bạn.'}
            </p>
          </div>

          {/* 2. Tuy chinh phim tat, am bao, micro & gioi han o cung (Electron) */}
          {isElectronRuntime && (
            <div className="rounded-[2px] border border-[#232B3B] bg-[#0A0D12] p-3.5 space-y-3">
              <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-[#94A3B8]">
                Cài đặt ghi hình Desktop (.exe)
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label
                    htmlFor="hotkey-select"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#EEF2F6]"
                  >
                    <Keyboard size={14} weight="bold" className="text-[#E59A23]" aria-hidden="true" />
                    <span>Phím cắt Highlight nhanh</span>
                  </label>
                  <select
                    id="hotkey-select"
                    value={captureStatus?.hotkey || 'F9'}
                    onChange={(e) => void onUpdateOptions({ hotkey: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-[2px] bg-[#10141C] border border-[#232B3B] text-xs font-mono text-[#EEF2F6]"
                  >
                    {hotkeys.map((hk) => (
                      <option key={hk} value={hk}>
                        {hk}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="max-storage-select"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#EEF2F6]"
                  >
                    <HardDrive size={14} weight="bold" className="text-[#38BDF8]" aria-hidden="true" />
                    <span>Giới hạn lưu clip trên máy</span>
                  </label>
                  <select
                    id="max-storage-select"
                    value={captureStatus?.maxStorageGb || 5}
                    onChange={(e) => void onUpdateOptions({ maxStorageGb: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 rounded-[2px] bg-[#10141C] border border-[#232B3B] text-xs font-mono text-[#EEF2F6]"
                  >
                    <option value={2}>2 GB</option>
                    <option value={5}>5 GB (Khuyên dùng)</option>
                    <option value={10}>10 GB</option>
                    <option value={20}>20 GB</option>
                    <option value={50}>50 GB</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  aria-pressed={captureStatus?.beepEnabled !== false}
                  onClick={() =>
                    void onUpdateOptions({ beepEnabled: !(captureStatus?.beepEnabled !== false) })
                  }
                  className={`flex items-center justify-between px-3 py-2 rounded-[2px] border text-xs transition ${
                    captureStatus?.beepEnabled !== false
                      ? 'bg-[#10B981]/12 border-[#10B981]/40 text-[#10B981]'
                      : 'bg-[#10141C] border-[#232B3B] text-[#94A3B8]'
                  }`}
                >
                  <span className="inline-flex items-center gap-1.5 font-semibold">
                    <SpeakerHigh size={14} weight="bold" aria-hidden="true" />
                    <span>Âm báo khi bấm {captureStatus?.hotkey || 'F9'}</span>
                  </span>
                  <span className="font-mono font-bold text-[10px]">
                    {captureStatus?.beepEnabled !== false ? 'BẬT' : 'TẮT'}
                  </span>
                </button>

                <button
                  type="button"
                  aria-pressed={Boolean(captureStatus?.micEnabled)}
                  onClick={() =>
                    void onUpdateOptions({ micEnabled: !captureStatus?.micEnabled })
                  }
                  className={`flex items-center justify-between px-3 py-2 rounded-[2px] border text-xs transition ${
                    captureStatus?.micEnabled
                      ? 'bg-[#38BDF8]/12 border-[#38BDF8]/40 text-[#38BDF8]'
                      : 'bg-[#10141C] border-[#232B3B] text-[#94A3B8]'
                  }`}
                >
                  <span className="inline-flex items-center gap-1.5 font-semibold">
                    <Microphone size={14} weight="bold" aria-hidden="true" />
                    <span>Thu tiếng Micro cùng game</span>
                  </span>
                  <span className="font-mono font-bold text-[10px]">
                    {captureStatus?.micEnabled ? 'BẬT' : 'TẮT'}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* 3. Quan ly tep clip cuc bo */}
          {isElectronRuntime && (
            <div className="rounded-[2px] border border-[#232B3B] bg-[#0A0D12] p-3.5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-[#EEF2F6]">
                    Clip đang lưu trên máy ({stats?.fileCount || 0} tệp - {formatMb(stats?.totalBytes || 0)})
                  </h3>
                  {stats?.folderPath && (
                    <p className="font-mono text-[10px] text-[#64748B] truncate max-w-md">
                      {stats.folderPath}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => void handleOpenFolder()}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[2px] bg-[#171D28] hover:bg-[#232B3B] border border-[#38BDF8]/40 text-[11px] font-semibold text-[#38BDF8]"
                  >
                    <FolderOpen size={13} weight="bold" aria-hidden="true" />
                    <span>Mở thư mục</span>
                  </button>
                  <button
                    type="button"
                    disabled={busy || !stats?.files?.length}
                    onClick={() => void handleCleanupUnpinned(true)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[2px] bg-[#171D28] hover:bg-[#F43F5E]/15 border border-[#F43F5E]/40 text-[11px] font-semibold text-[#F43F5E] disabled:opacity-50"
                  >
                    <Trash size={13} weight="bold" aria-hidden="true" />
                    <span>Dọn clip chưa ghim</span>
                  </button>
                </div>
              </div>

              {!stats || stats.files.length === 0 ? (
                <p className="text-xs text-[#64748B] py-2">
                  Chưa có clip Highlight nào trong thư mục lưu trữ cục bộ.
                </p>
              ) : (
                <div className="space-y-1.5 max-h-52 overflow-y-auto tactical-scrollbar pr-1">
                  {stats.files.map((f) => {
                    const isPinnedFile = Boolean(
                      f.attachedMatchId && pinnedMatchIds.includes(f.attachedMatchId)
                    );
                    return (
                      <div
                        key={f.filePath}
                        className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-[2px] bg-[#10141C] border border-[#232B3B]"
                      >
                        <div className="min-w-0">
                          <p className="font-mono text-[11px] text-[#EEF2F6] truncate">
                            {f.name}{' '}
                            {isPinnedFile && (
                              <span className="text-[10px] text-[#E59A23] font-bold">
                                (ĐÃ GHIM)
                              </span>
                            )}
                          </p>
                          <p className="font-mono text-[10px] text-[#64748B]">
                            {formatMb(f.sizeBytes)} -{' '}
                            {new Date(f.modifiedAt).toLocaleString('vi-VN')}
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={busy}
                          aria-label={`Xóa tệp ${f.name}`}
                          onClick={() => void handleDeleteClip(f.filePath)}
                          className="px-2 py-1 rounded-[2px] bg-[#171D28] hover:bg-[#F43F5E]/15 border border-[#232B3B] hover:border-[#F43F5E]/40 text-[10px] font-mono text-[#F43F5E] shrink-0"
                        >
                          Xóa
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

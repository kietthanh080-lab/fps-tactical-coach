import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowsClockwise,
  CloudCheck,
  DownloadSimple,
  FolderOpen,
  GearSix,
  Globe,
  HardDrive,
  Keyboard,
  LinkBreak,
  LinkSimple,
  Microphone,
  Monitor,
  Palette,
  SlidersHorizontal,
  SpeakerHigh,
  Swap,
  Trash,
  UploadSimple,
  UserCircleGear,
  VideoCamera,
  X,
} from '@phosphor-icons/react';
import { useI18n } from '../i18n';
import {
  AppUserSettings,
  AutoRefreshIntervalSec,
  exportFullLocalBackup,
  importFullLocalBackup,
  playPreviewChime,
} from '../services/appSettings';
import {
  DesktopCaptureStatus,
  ScreenSourceItem,
  StorageStats,
} from '../services/desktopCapture';
import { CaptureMode, fetchStorageStatus } from '../services/localDb';
import { SettingsVaultPanel } from './SettingsVaultModal';

export type SettingsTabId = 'GENERAL' | 'CAPTURE' | 'STORAGE' | 'SENS' | 'ACCOUNTS';

interface UserAccountSummary {
  riot_game_name: string | null;
  riot_tag_line: string | null;
  has_riot_linked?: boolean;
  steam_id: string | null;
  steam_persona_name: string | null;
  pubg_account_id: string | null;
  pubg_player_name: string | null;
}

interface UnifiedSettingsModalProps {
  isOpen: boolean;
  initialTab?: SettingsTabId;
  activeGameTab: 'VALORANT' | 'PUBG';
  appVersion: string;
  appSettings: AppUserSettings;
  onUpdateAppSettings: (patch: Partial<AppUserSettings>) => void;
  onSwitchGameThemePreview: (game: 'VALORANT' | 'PUBG') => void;
  // Capture & Desktop
  isElectronRuntime: boolean;
  isOverwolfRuntime: boolean;
  captureMode: CaptureMode;
  onToggleCaptureMode: (mode: CaptureMode) => void;
  autoStartEnabled: boolean;
  onToggleAutoStart: () => Promise<void>;
  captureStatus: DesktopCaptureStatus | null;
  screenSources: ScreenSourceItem[];
  onToggleDesktopCapture: () => Promise<void>;
  onUpdateCaptureOptions: (opts: {
    captureCompatMode?: 'wgc' | 'dxgi';
    captureQuality?: '720p30' | '1080p60';
    preferredScreenId?: string | null;
    hotkey?: string;
    micEnabled?: boolean;
    beepEnabled?: boolean;
    maxStorageGb?: number;
  }) => Promise<void>;
  testingCapture: boolean;
  onTestCaptureFrame: () => Promise<void>;
  checkingOverwolf: boolean;
  onCheckOverwolf: () => Promise<void>;
  onOpenOverwolfDownload: () => void;
  pinnedMatchIds: string[];
  // Accounts
  profile: UserAccountSummary | null;
  pubgIgnInput: string;
  onChangePubgIgnInput: (val: string) => void;
  savingPubgIgn: boolean;
  onSavePubgIgn: (e: React.FormEvent) => Promise<void>;
  onLinkSteam: () => Promise<void>;
  onLinkRiot: () => Promise<void>;
  onSwitchRiotAccount: () => void;
  unlinkingRiot: boolean;
  onUnlinkRiot: () => Promise<void>;
  onBackupRestored: (restored: AppUserSettings) => void;
  onClose: () => void;
}

const formatBytes = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
  return `${mb.toFixed(1)} MB`;
};

export const UnifiedSettingsModal: React.FC<UnifiedSettingsModalProps> = ({
  isOpen,
  initialTab = 'GENERAL',
  activeGameTab,
  appVersion,
  appSettings,
  onUpdateAppSettings,
  onSwitchGameThemePreview,
  isElectronRuntime,
  isOverwolfRuntime,
  captureMode,
  onToggleCaptureMode,
  autoStartEnabled,
  onToggleAutoStart,
  captureStatus,
  screenSources,
  onToggleDesktopCapture,
  onUpdateCaptureOptions,
  testingCapture,
  onTestCaptureFrame,
  checkingOverwolf,
  onCheckOverwolf,
  onOpenOverwolfDownload,
  pinnedMatchIds,
  profile,
  pubgIgnInput,
  onChangePubgIgnInput,
  savingPubgIgn,
  onSavePubgIgn,
  onLinkSteam,
  onLinkRiot,
  onSwitchRiotAccount,
  unlinkingRiot,
  onUnlinkRiot,
  onBackupRestored,
  onClose,
}) => {
  const { tr } = useI18n();
  const [activeTab, setActiveTab] = useState<SettingsTabId>(initialTab);
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [cloudStatus, setCloudStatus] = useState<{
    s3Configured: boolean;
    mode: string;
    maxDirectUploadMb: number;
  } | null>(null);
  const [busyStorage, setBusyStorage] = useState(false);
  const [updateCheckMsg, setUpdateCheckMsg] = useState<string | null>(null);
  const [backupMsg, setBackupMsg] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const isValo = activeGameTab === 'VALORANT';

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setBackupMsg(null);
      setUpdateCheckMsg(null);
    }
  }, [isOpen, initialTab]);

  const loadStorageData = useCallback(async () => {
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
    void loadStorageData();
  }, [isOpen, loadStorageData]);

  if (!isOpen) return null;

  const hotkeys = captureStatus?.allowedHotkeys || [
    'F6',
    'F7',
    'F8',
    'F9',
    'F10',
    'F11',
    'Alt+H',
    'Alt+Z',
    'Alt+X',
    'Ctrl+Shift+H',
  ];

  const maxCapBytes = (captureStatus?.maxStorageGb || stats?.maxStorageGb || 5) * 1024 * 1024 * 1024;
  const usedRatioPct = stats
    ? Math.min(100, Math.round((stats.totalBytes / Math.max(1, maxCapBytes)) * 100))
    : 0;

  const handleOpenFolder = async () => {
    const electronAPI = (window as any).electronAPI;
    if (electronAPI?.openHighlightsFolder) {
      await electronAPI.openHighlightsFolder();
    }
  };

  const handleDeleteClip = async (filePath: string) => {
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI?.deleteLocalClip) return;
    setBusyStorage(true);
    try {
      const res = await electronAPI.deleteLocalClip(filePath);
      if (res?.stats) setStats(res.stats);
    } finally {
      setBusyStorage(false);
    }
  };

  const handleCleanupUnpinned = async () => {
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI?.cleanupStorage) return;
    setBusyStorage(true);
    try {
      const res = await electronAPI.cleanupStorage({
        pinnedMatchIds,
        clearUnpinned: true,
      });
      if (res?.stats) setStats(res.stats);
    } finally {
      setBusyStorage(false);
    }
  };

  const handleCheckAppUpdate = async () => {
    const updater = (window as any).electronUpdater;
    if (!updater?.checkForUpdates) {
      setUpdateCheckMsg(
        tr('Auto-update is available in the Desktop .exe build.', 'Tự cập nhật chỉ có trên bản .exe.')
      );
      return;
    }
    setUpdateCheckMsg(tr('Checking GitHub Releases...', 'Đang kiểm tra bản cập nhật...'));
    try {
      const res = await updater.checkForUpdates();
      if (res && res.packaged === false) {
        setUpdateCheckMsg(tr('Running unpackaged dev build.', 'Đang chạy bản Dev cục bộ.'));
      } else {
        setUpdateCheckMsg(
          tr(
            'Update check completed. Any new release will appear at the bottom-right.',
            'Đã kiểm tra xong. Nếu có bản mới sẽ hiện thông báo ở góc dưới phải.'
          )
        );
      }
    } catch {
      setUpdateCheckMsg(tr('Unable to check updates right now.', 'Không thể kiểm tra lúc này.'));
    }
  };

  const handleExportBackupFile = () => {
    const json = exportFullLocalBackup();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tactical-replay-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    setBackupMsg(
      tr(
        'Exported full backup JSON (Settings, Sens Vault, Match Notes & Telestrator).',
        'Đã xuất tệp sao lưu JSON (gồm Cài đặt, Kho Sens, Ghi chú trận & nét vẽ Telestrator).'
      )
    );
  };

  const handleImportBackupFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const rawText = await file.text();
      const restored = importFullLocalBackup(rawText);
      onBackupRestored(restored);
      setBackupMsg(
        tr(
          'Backup restored successfully! All settings, presets, notes, and bookmarks are updated.',
          'Khôi phục bản sao lưu thành công! Đã nạp lại cài đặt, Sens, ghi chú và bookmark.'
        )
      );
    } catch {
      setBackupMsg(
        tr(
          'Invalid backup file. Please select a valid TacticalReplayAI .json backup.',
          'Tệp sao lưu không hợp lệ. Vui lòng chọn đúng tệp .json xuất từ ứng dụng.'
        )
      );
    } finally {
      e.target.value = '';
    }
  };

  const tabs: Array<{ id: SettingsTabId; label: string; icon: React.ElementType }> = [
    { id: 'GENERAL', label: tr('General & Theme', 'Chung & Giao diện'), icon: Palette },
    { id: 'CAPTURE', label: tr('Capture & Hotkeys', 'Ghi hình & Phím tắt'), icon: VideoCamera },
    { id: 'STORAGE', label: tr('Storage & Cloud', 'Lưu trữ & Cloud'), icon: HardDrive },
    { id: 'SENS', label: tr('Sens & Crosshair', 'Sens & Tâm ngắm'), icon: SlidersHorizontal },
    { id: 'ACCOUNTS', label: tr('Accounts & Backup', 'Tài khoản & Sao lưu'), icon: UserCircleGear },
  ];

  return (
    <div
      className="fixed inset-0 z-50 bg-[#0A0D12]/85 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="unified-settings-title"
    >
      <div className="bg-[#10141C] border border-[#334155] rounded-[4px] w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-[#232B3B] bg-[#0A0D12]">
          <div className="flex items-center gap-3">
            <div
              className={`h-8 w-8 rounded-[2px] flex items-center justify-center border ${
                isValo
                  ? 'bg-[#FF4655]/15 border-[#FF4655]/40 text-[#FF4655] theme-cut-valo'
                  : 'bg-[#E59A23]/15 border-[#E59A23]/40 text-[#E59A23]'
              }`}
            >
              <GearSix size={17} weight="bold" aria-hidden="true" />
            </div>
            <div>
              <h2
                id="unified-settings-title"
                className="font-display text-base font-bold text-[#EEF2F6]"
              >
                {tr('Control Center & Preferences', 'Trung tâm Cài đặt & Tùy biến')}
              </h2>
              <p className="text-xs text-[#94A3B8]">
                {tr(
                  'Configure language, game theme, capture hotkeys, storage limits, sensitivity vault & backups',
                  'Tùy chỉnh ngôn ngữ, chủ đề game, phím tắt quay, dung lượng clip, kho Sens & sao lưu'
                )}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={tr('Close settings center', 'Đóng trung tâm cài đặt')}
            className="inline-flex items-center gap-1 rounded-[2px] bg-[#171D28] hover:bg-[#232B3B] border border-[#232B3B] px-3 py-1.5 text-xs font-semibold text-[#94A3B8] hover:text-[#EEF2F6]"
          >
            <X size={14} weight="bold" aria-hidden="true" />
            <span>{tr('Close', 'Đóng')}</span>
          </button>
        </div>

        {/* Navigation Tabs */}
        <div
          role="tablist"
          aria-label={tr('Settings sections', 'Các mục cài đặt')}
          className="flex flex-wrap items-center gap-1.5 px-6 py-2.5 border-b border-[#232B3B] bg-[#0A0D12]/60"
        >
          {tabs.map((t) => {
            const Icon = t.icon;
            const selected = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setActiveTab(t.id)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[2px] font-mono text-xs font-bold border transition duration-150 ${
                  selected
                    ? isValo
                      ? 'bg-[#FF4655] border-[#FF4655] text-[#EEF2F6]'
                      : 'bg-[#E59A23] border-[#E59A23] text-[#0A0D12]'
                    : 'bg-[#10141C] border-[#232B3B] text-[#94A3B8] hover:text-[#EEF2F6] hover:bg-[#171D28]'
                }`}
              >
                <Icon size={14} weight="bold" aria-hidden="true" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto tactical-scrollbar p-6 space-y-5">
          {/* TAB 1: GENERAL & THEME */}
          {activeTab === 'GENERAL' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Language & Startup */}
              <div className="rounded-[4px] border border-[#232B3B] bg-[#0A0D12] p-4 space-y-4">
                <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-[#EEF2F6] flex items-center gap-1.5">
                  <Globe size={14} weight="bold" className="text-[#38BDF8]" aria-hidden="true" />
                  <span>{tr('Language & Sync Cadence', 'Ngôn ngữ & Tần suất đồng bộ')}</span>
                </h3>

                <div className="space-y-1.5">
                  <label
                    htmlFor="settings-lang-select"
                    className="block text-xs font-semibold text-[#EEF2F6]"
                  >
                    {tr('Display Language (Default: English)', 'Ngôn ngữ hiển thị (Mặc định: Tiếng Anh)')}
                  </label>
                  <select
                    id="settings-lang-select"
                    value={appSettings.language}
                    onChange={(e) =>
                      onUpdateAppSettings({ language: e.target.value === 'vi' ? 'vi' : 'en' })
                    }
                    className="w-full px-3 py-2 rounded-[2px] bg-[#10141C] border border-[#232B3B] text-xs font-mono text-[#EEF2F6]"
                  >
                    <option value="en">English (Default)</option>
                    <option value="vi">Tiếng Việt</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="settings-default-game"
                    className="block text-xs font-semibold text-[#EEF2F6]"
                  >
                    {tr('Default Workspace on Launch', 'Không gian game mặc định khi mở app')}
                  </label>
                  <select
                    id="settings-default-game"
                    value={appSettings.defaultGame}
                    onChange={(e) =>
                      onUpdateAppSettings({
                        defaultGame: e.target.value as AppUserSettings['defaultGame'],
                      })
                    }
                    className="w-full px-3 py-2 rounded-[2px] bg-[#10141C] border border-[#232B3B] text-xs font-mono text-[#EEF2F6]"
                  >
                    <option value="AUTO">
                      {tr('Auto-detect from linked account', 'Tự nhận diện theo tài khoản liên kết')}
                    </option>
                    <option value="PUBG">PUBG: BATTLEGROUNDS</option>
                    <option value="VALORANT">VALORANT</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="settings-refresh-interval"
                    className="block text-xs font-semibold text-[#EEF2F6]"
                  >
                    {tr('Auto-Refresh Match History', 'Chu kỳ tự động làm mới lịch sử trận')}
                  </label>
                  <select
                    id="settings-refresh-interval"
                    value={appSettings.autoRefreshSec}
                    onChange={(e) =>
                      onUpdateAppSettings({
                        autoRefreshSec: Number(e.target.value) as AutoRefreshIntervalSec,
                      })
                    }
                    className="w-full px-3 py-2 rounded-[2px] bg-[#10141C] border border-[#232B3B] text-xs font-mono text-[#EEF2F6]"
                  >
                    <option value={30}>{tr('Every 30 seconds', 'Mỗi 30 giây')}</option>
                    <option value={60}>{tr('Every 1 minute (Recommended)', 'Mỗi 1 phút (Khuyên dùng)')}</option>
                    <option value={120}>{tr('Every 2 minutes', 'Mỗi 2 phút')}</option>
                    <option value={300}>{tr('Every 5 minutes', 'Mỗi 5 phút')}</option>
                    <option value={0}>{tr('Manual only (Off)', 'Tắt tự động (Chỉ làm mới tay)')}</option>
                  </select>
                </div>

                <button
                  type="button"
                  aria-pressed={appSettings.autoPostMatchRecap}
                  onClick={() =>
                    onUpdateAppSettings({ autoPostMatchRecap: !appSettings.autoPostMatchRecap })
                  }
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-[2px] border text-xs transition ${
                    appSettings.autoPostMatchRecap
                      ? 'bg-[#10B981]/12 border-[#10B981]/40 text-[#10B981]'
                      : 'bg-[#10141C] border-[#232B3B] text-[#94A3B8]'
                  }`}
                >
                  <span className="font-semibold">
                    {tr('Auto-show Post-Match Recap Toast', 'Tự bật bảng Tóm tắt khi có trận mới')}
                  </span>
                  <span className="font-mono font-bold text-[10px]">
                    {appSettings.autoPostMatchRecap ? tr('ON', 'BẬT') : tr('OFF', 'TẮT')}
                  </span>
                </button>
              </div>

              {/* Game Theme & App System */}
              <div className="rounded-[4px] border border-[#232B3B] bg-[#0A0D12] p-4 space-y-4">
                <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-[#EEF2F6] flex items-center gap-1.5">
                  <Palette size={14} weight="bold" className="text-[#E59A23]" aria-hidden="true" />
                  <span>{tr('Dynamic Game Theme & System', 'Chủ đề Game động & Hệ thống')}</span>
                </h3>

                <div className="space-y-2">
                  <p className="text-xs text-[#94A3B8] leading-relaxed">
                    {tr(
                      'Switching games automatically adapts the HUD palette, tactical grid, and accent geometry:',
                      'Khi chuyển tab game, toàn bộ màu nhấn, lưới tọa độ và góc cắt HUD sẽ tự động đổi theo chủ đề:'
                    )}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => onSwitchGameThemePreview('VALORANT')}
                      className={`p-3 rounded-[2px] border text-left space-y-1 transition ${
                        isValo
                          ? 'bg-[#FF4655]/15 border-[#FF4655] text-[#EEF2F6]'
                          : 'bg-[#10141C] border-[#232B3B] text-[#94A3B8] hover:text-[#EEF2F6]'
                      }`}
                    >
                      <span className="inline-block px-1.5 py-0.5 rounded-[2px] bg-[#FF4655] text-[#EEF2F6] font-mono text-[10px] font-bold">
                        VALORANT
                      </span>
                      <p className="font-display text-xs font-bold">Protocol Red &amp; Cyan</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => onSwitchGameThemePreview('PUBG')}
                      className={`p-3 rounded-[2px] border text-left space-y-1 transition ${
                        !isValo
                          ? 'bg-[#E59A23]/15 border-[#E59A23] text-[#EEF2F6]'
                          : 'bg-[#10141C] border-[#232B3B] text-[#94A3B8] hover:text-[#EEF2F6]'
                      }`}
                    >
                      <span className="inline-block px-1.5 py-0.5 rounded-[2px] bg-[#E59A23] text-[#0A0D12] font-mono text-[10px] font-bold">
                        PUBG
                      </span>
                      <p className="font-display text-xs font-bold">Battlegrounds Amber</p>
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  aria-pressed={appSettings.themeEffects}
                  onClick={() => onUpdateAppSettings({ themeEffects: !appSettings.themeEffects })}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-[2px] border text-xs transition ${
                    appSettings.themeEffects
                      ? 'bg-[#38BDF8]/12 border-[#38BDF8]/40 text-[#38BDF8]'
                      : 'bg-[#10141C] border-[#232B3B] text-[#94A3B8]'
                  }`}
                >
                  <span className="font-semibold">
                    {tr('Ambient Tactical Grid & Glow Backdrop', 'Hiệu ứng lưới chiến thuật & ánh sáng nền')}
                  </span>
                  <span className="font-mono font-bold text-[10px]">
                    {appSettings.themeEffects ? tr('ON', 'BẬT') : tr('OFF', 'TẮT')}
                  </span>
                </button>

                {isElectronRuntime && (
                  <button
                    type="button"
                    aria-pressed={autoStartEnabled}
                    onClick={() => void onToggleAutoStart()}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-[2px] border text-xs transition ${
                      autoStartEnabled
                        ? 'bg-[#10B981]/12 border-[#10B981]/40 text-[#10B981]'
                        : 'bg-[#10141C] border-[#232B3B] text-[#94A3B8]'
                    }`}
                  >
                    <span className="font-semibold">
                      {tr('Start Minimized in System Tray with Windows', 'Khởi động ngầm ở khay hệ thống cùng Windows')}
                    </span>
                    <span className="font-mono font-bold text-[10px]">
                      {autoStartEnabled ? tr('ON', 'BẬT') : tr('OFF', 'TẮT')}
                    </span>
                  </button>
                )}

                <div className="pt-2 border-t border-[#232B3B] flex flex-wrap items-center justify-between gap-2">
                  <div className="font-mono text-xs text-[#94A3B8]">
                    {tr('Current Version:', 'Phiên bản hiện tại:')}{' '}
                    <strong className="text-[#EEF2F6]">v{appVersion}</strong>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleCheckAppUpdate()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[2px] bg-[#171D28] hover:bg-[#232B3B] border border-[#232B3B] font-mono text-xs text-[#38BDF8]"
                  >
                    <ArrowsClockwise size={13} weight="bold" aria-hidden="true" />
                    <span>{tr('Check for Updates', 'Kiểm tra cập nhật')}</span>
                  </button>
                </div>
                {updateCheckMsg && (
                  <p className="font-mono text-[11px] text-[#38BDF8]">{updateCheckMsg}</p>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: CAPTURE & HOTKEYS */}
          {activeTab === 'CAPTURE' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-[4px] border border-[#232B3B] bg-[#0A0D12] p-4 space-y-3.5">
                  <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-[#EEF2F6] flex items-center gap-1.5">
                    <VideoCamera size={14} weight="bold" className="text-[#10B981]" aria-hidden="true" />
                    <span>{tr('Recording Engine & Quality', 'Bộ quay Highlight & Chất lượng')}</span>
                  </h3>

                  <div className="space-y-1.5">
                    <span className="block text-xs font-semibold text-[#EEF2F6]">
                      {tr('Overwolf / Capture Mode', 'Chế độ ghi hình')}
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => onToggleCaptureMode('HIGHLIGHT_CLIPS')}
                        className={`py-2 px-3 rounded-[2px] font-mono text-xs font-bold border transition ${
                          captureMode === 'HIGHLIGHT_CLIPS'
                            ? 'bg-[#10B981]/15 border-[#10B981] text-[#10B981]'
                            : 'bg-[#10141C] border-[#232B3B] text-[#94A3B8]'
                        }`}
                      >
                        {tr('Highlight (~23s/Kill)', 'Highlight (~23s/Kill)')}
                      </button>
                      <button
                        type="button"
                        onClick={() => onToggleCaptureMode('FULL_MATCH')}
                        className={`py-2 px-3 rounded-[2px] font-mono text-xs font-bold border transition ${
                          captureMode === 'FULL_MATCH'
                            ? 'bg-[#38BDF8]/15 border-[#38BDF8] text-[#38BDF8]'
                            : 'bg-[#10141C] border-[#232B3B] text-[#94A3B8]'
                        }`}
                      >
                        {tr('Full Match Replay', 'Quay cả trận')}
                      </button>
                    </div>
                  </div>

                  {isElectronRuntime && !isOverwolfRuntime && (
                    <>
                      <button
                        type="button"
                        aria-pressed={captureStatus?.desktopCaptureEnabled ?? true}
                        onClick={() => void onToggleDesktopCapture()}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-[2px] border text-xs transition ${
                          captureStatus?.desktopCaptureEnabled ?? true
                            ? 'bg-[#10B981]/12 border-[#10B981]/40 text-[#10B981]'
                            : 'bg-[#10141C] border-[#232B3B] text-[#94A3B8]'
                        }`}
                      >
                        <span className="font-semibold">
                          {tr('Standalone Desktop Ring Capture (.exe)', 'Tự động quay ngầm trên bản .exe')}
                        </span>
                        <span className="font-mono font-bold text-[10px]">
                          {captureStatus?.desktopCaptureEnabled ?? true
                            ? tr('ENABLED', 'ĐANG BẬT')
                            : tr('PAUSED', 'TẠM TẮT')}
                        </span>
                      </button>

                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="space-y-1">
                          <label
                            htmlFor="settings-quality-select"
                            className="block text-xs font-semibold text-[#EEF2F6]"
                          >
                            {tr('Video Quality', 'Chất lượng quay')}
                          </label>
                          <select
                            id="settings-quality-select"
                            value={captureStatus?.captureQuality || '720p30'}
                            onChange={(e) =>
                              void onUpdateCaptureOptions({
                                captureQuality:
                                  e.target.value === '1080p60' ? '1080p60' : '720p30',
                              })
                            }
                            className="w-full px-2.5 py-1.5 rounded-[2px] bg-[#10141C] border border-[#232B3B] text-xs font-mono text-[#EEF2F6]"
                          >
                            <option value="720p30">720p 30fps ({tr('Max FPS', 'Nhẹ máy')})</option>
                            <option value="1080p60">1080p 60fps (Sharp)</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label
                            htmlFor="settings-compat-select"
                            className="block text-xs font-semibold text-[#EEF2F6]"
                          >
                            {tr('Fullscreen Mode', 'Chống đen Fullscreen')}
                          </label>
                          <select
                            id="settings-compat-select"
                            value={captureStatus?.captureCompatMode || 'wgc'}
                            onChange={(e) =>
                              void onUpdateCaptureOptions({
                                captureCompatMode: e.target.value === 'dxgi' ? 'dxgi' : 'wgc',
                              })
                            }
                            className="w-full px-2.5 py-1.5 rounded-[2px] bg-[#10141C] border border-[#232B3B] text-xs font-mono text-[#EEF2F6]"
                          >
                            <option value="wgc">{tr('Standard (Win 10/11)', 'Mặc định (Chuẩn)')}</option>
                            <option value="dxgi">{tr('Anti-Black Fullscreen', 'Tương thích Fullscreen')}</option>
                          </select>
                        </div>
                      </div>

                      {screenSources.length > 0 && (
                        <div className="space-y-1">
                          <label
                            htmlFor="settings-monitor-select"
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#EEF2F6]"
                          >
                            <Monitor size={13} weight="bold" aria-hidden="true" />
                            <span>{tr('Target Monitor', 'Màn hình quay')}</span>
                          </label>
                          <select
                            id="settings-monitor-select"
                            value={captureStatus?.preferredScreenId || ''}
                            onChange={(e) =>
                              void onUpdateCaptureOptions({
                                preferredScreenId: e.target.value || null,
                              })
                            }
                            className="w-full px-2.5 py-1.5 rounded-[2px] bg-[#10141C] border border-[#232B3B] text-xs font-mono text-[#EEF2F6]"
                          >
                            <option value="">{tr('Primary Display (Auto)', 'Màn hình chính (Tự động)')}</option>
                            {screenSources.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name} {s.isPrimary ? '(Primary)' : ''}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#232B3B]">
                        <button
                          type="button"
                          disabled={testingCapture}
                          onClick={() => void onTestCaptureFrame()}
                          className="px-3 py-1.5 rounded-[2px] bg-[#171D28] hover:bg-[#232B3B] border border-[#38BDF8]/40 font-mono text-xs font-bold text-[#38BDF8] disabled:opacity-50"
                        >
                          {testingCapture
                            ? tr('Testing frame...', 'Đang kiểm tra...')
                            : tr('Test Capture Frame', 'Kiểm tra khung hình quay')}
                        </button>

                        <div className="flex items-center gap-2 text-xs font-mono">
                          <span className="text-[#94A3B8]">
                            Overwolf:{' '}
                            <strong
                              className={
                                captureStatus?.overwolfInstalled
                                  ? 'text-[#10B981]'
                                  : 'text-[#E59A23]'
                              }
                            >
                              {captureStatus?.overwolfInstalled
                                ? tr('Installed', 'Đã cài')
                                : tr('Not Installed', 'Chưa cài')}
                            </strong>
                          </span>
                          {!captureStatus?.overwolfInstalled && (
                            <button
                              type="button"
                              onClick={onOpenOverwolfDownload}
                              className="px-2 py-1 rounded-[2px] bg-[#171D28] border border-[#232B3B] text-[#EEF2F6]"
                            >
                              {tr('Get Overwolf', 'Tải Overwolf')}
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={checkingOverwolf}
                            onClick={() => void onCheckOverwolf()}
                            className="px-2 py-1 rounded-[2px] bg-[#171D28] border border-[#232B3B] text-[#94A3B8]"
                          >
                            {tr('Recheck', 'Kiểm tra')}
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Hotkeys & Audio */}
                <div className="rounded-[4px] border border-[#232B3B] bg-[#0A0D12] p-4 space-y-3.5">
                  <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-[#EEF2F6] flex items-center gap-1.5">
                    <Keyboard size={14} weight="bold" className="text-[#E59A23]" aria-hidden="true" />
                    <span>{tr('Hotkeys & Audio Feedback', 'Phím tắt & Âm thanh')}</span>
                  </h3>

                  {isElectronRuntime ? (
                    <>
                      <div className="space-y-1">
                        <label
                          htmlFor="settings-hotkey-select"
                          className="block text-xs font-semibold text-[#EEF2F6]"
                        >
                          {tr(
                            'In-Game Manual Highlight Hotkey (Saves last ~25s)',
                            'Phím tắt cắt nhanh Highlight trong game (Lưu ~25s vừa qua)'
                          )}
                        </label>
                        <select
                          id="settings-hotkey-select"
                          value={captureStatus?.hotkey || 'F9'}
                          onChange={(e) => void onUpdateCaptureOptions({ hotkey: e.target.value })}
                          className="w-full px-3 py-2 rounded-[2px] bg-[#10141C] border border-[#232B3B] text-xs font-mono font-bold text-[#E59A23]"
                        >
                          {hotkeys.map((hk) => (
                            <option key={hk} value={hk}>
                              {hk}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          aria-pressed={captureStatus?.beepEnabled !== false}
                          onClick={() =>
                            void onUpdateCaptureOptions({
                              beepEnabled: !(captureStatus?.beepEnabled !== false),
                            })
                          }
                          className={`flex-1 flex items-center justify-between px-3 py-2 rounded-[2px] border text-xs transition ${
                            captureStatus?.beepEnabled !== false
                              ? 'bg-[#10B981]/12 border-[#10B981]/40 text-[#10B981]'
                              : 'bg-[#10141C] border-[#232B3B] text-[#94A3B8]'
                          }`}
                        >
                          <span className="inline-flex items-center gap-1.5 font-semibold">
                            <SpeakerHigh size={14} weight="bold" aria-hidden="true" />
                            <span>{tr('Audio Chime on Clip', 'Tiếng Beep khi cắt clip')}</span>
                          </span>
                          <span className="font-mono font-bold text-[10px]">
                            {captureStatus?.beepEnabled !== false
                              ? tr('ON', 'BẬT')
                              : tr('OFF', 'TẮT')}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={playPreviewChime}
                          className="px-3 py-2 rounded-[2px] bg-[#171D28] hover:bg-[#232B3B] border border-[#232B3B] font-mono text-xs text-[#EEF2F6] shrink-0"
                        >
                          {tr('Test Beep', 'Nghe thử')}
                        </button>
                      </div>

                      <button
                        type="button"
                        aria-pressed={Boolean(captureStatus?.micEnabled)}
                        onClick={() =>
                          void onUpdateCaptureOptions({ micEnabled: !captureStatus?.micEnabled })
                        }
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-[2px] border text-xs transition ${
                          captureStatus?.micEnabled
                            ? 'bg-[#38BDF8]/12 border-[#38BDF8]/40 text-[#38BDF8]'
                            : 'bg-[#10141C] border-[#232B3B] text-[#94A3B8]'
                        }`}
                      >
                        <span className="inline-flex items-center gap-1.5 font-semibold">
                          <Microphone size={14} weight="bold" aria-hidden="true" />
                          <span>
                            {tr('Record Microphone Voice Comms', 'Thu tiếng Micro cùng âm thanh game')}
                          </span>
                        </span>
                        <span className="font-mono font-bold text-[10px]">
                          {captureStatus?.micEnabled ? tr('ON', 'BẬT') : tr('OFF', 'TẮT')}
                        </span>
                      </button>
                    </>
                  ) : (
                    <p className="text-xs text-[#94A3B8]">
                      {tr(
                        'Global capture hotkeys and microphone mixing are active when running the Desktop .exe app.',
                        'Phím tắt toàn cục trong game và trộn Micro hoạt động trên bản cài đặt Desktop (.exe).'
                      )}
                    </p>
                  )}

                  {/* Built-in Replay Player Shortcuts Cheat Sheet */}
                  <div className="pt-2 border-t border-[#232B3B] space-y-2">
                    <p className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#94A3B8]">
                      {tr('Replay Player Shortcuts', 'Phím tắt trong trình phát Replay')}
                    </p>
                    <div className="grid grid-cols-2 gap-1.5 font-mono text-[11px]">
                      <div className="flex justify-between px-2.5 py-1 rounded-[2px] bg-[#10141C] border border-[#232B3B]">
                        <span className="text-[#94A3B8]">{tr('Play / Pause', 'Phát / Dừng')}</span>
                        <kbd className="text-[#EEF2F6] font-bold">Space</kbd>
                      </div>
                      <div className="flex justify-between px-2.5 py-1 rounded-[2px] bg-[#10141C] border border-[#232B3B]">
                        <span className="text-[#94A3B8]">{tr('Telestrator Draw', 'Bật vẽ chiến thuật')}</span>
                        <kbd className="text-[#EEF2F6] font-bold">D</kbd>
                      </div>
                      <div className="flex justify-between px-2.5 py-1 rounded-[2px] bg-[#10141C] border border-[#232B3B]">
                        <span className="text-[#94A3B8]">{tr('Add Bookmark', 'Đánh dấu mốc')}</span>
                        <kbd className="text-[#EEF2F6] font-bold">B</kbd>
                      </div>
                      <div className="flex justify-between px-2.5 py-1 rounded-[2px] bg-[#10141C] border border-[#232B3B]">
                        <span className="text-[#94A3B8]">{tr('Frame Step -/+0.1s', 'Nhích khung hình')}</span>
                        <kbd className="text-[#EEF2F6] font-bold">, / .</kbd>
                      </div>
                      <div className="flex justify-between px-2.5 py-1 rounded-[2px] bg-[#10141C] border border-[#232B3B]">
                        <span className="text-[#94A3B8]">{tr('A-B Loop Set / Toggle', 'Lặp đoạn giao tranh')}</span>
                        <kbd className="text-[#EEF2F6] font-bold">[ / ] / L</kbd>
                      </div>
                      <div className="flex justify-between px-2.5 py-1 rounded-[2px] bg-[#10141C] border border-[#232B3B]">
                        <span className="text-[#94A3B8]">{tr('Crosshair Zoom', 'Phóng đại tâm ngắm')}</span>
                        <kbd className="text-[#EEF2F6] font-bold">Z</kbd>
                      </div>
                      <div className="flex justify-between px-2.5 py-1 rounded-[2px] bg-[#10141C] border border-[#232B3B]">
                        <span className="text-[#94A3B8]">{tr('Prev / Next Event', 'Nhảy mốc trước / sau')}</span>
                        <kbd className="text-[#EEF2F6] font-bold">P / N</kbd>
                      </div>
                      <div className="flex justify-between px-2.5 py-1 rounded-[2px] bg-[#10141C] border border-[#232B3B]">
                        <span className="text-[#94A3B8]">{tr('2D Strategy Board', 'Mở Sa bàn 2D')}</span>
                        <kbd className="text-[#EEF2F6] font-bold">Ctrl+B</kbd>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: STORAGE & CLOUD */}
          {activeTab === 'STORAGE' && (
            <div className="space-y-4">
              <div className="rounded-[4px] border border-[#232B3B] bg-[#0A0D12] p-4 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 font-mono text-xs font-bold text-[#EEF2F6]">
                    <CloudCheck size={15} weight="bold" className="text-[#10B981]" aria-hidden="true" />
                    <span>
                      {tr(
                        'Cloud Highlight Storage (Cloudflare R2 / S3)',
                        'Lưu trữ & Chia sẻ Cloud (Cloudflare R2 / S3)'
                      )}
                    </span>
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-[2px] font-mono text-[10px] font-bold border ${
                      cloudStatus?.s3Configured
                        ? 'bg-[#10B981]/15 border-[#10B981]/40 text-[#10B981]'
                        : 'bg-[#E59A23]/15 border-[#E59A23]/40 text-[#E59A23]'
                    }`}
                  >
                    {cloudStatus?.s3Configured
                      ? tr('R2/S3 UNLIMITED ENABLED', 'ĐÃ BẬT R2/S3 (KHÔNG GIỚI HẠN)')
                      : tr('DIRECT UPLOAD (< 4.5MB)', 'MẶC ĐỊNH (< 4.5MB)')}
                  </span>
                </div>
                <p className="text-xs text-[#94A3B8] leading-relaxed">
                  {cloudStatus?.s3Configured
                    ? tr(
                        'Presigned Cloudflare R2/S3 upload is active. Recorded highlight clips upload directly for instant friend sharing.',
                        'Máy chủ đã bật Presigned Upload R2/S3. Mọi clip quay được sẽ đẩy lên cloud để chia sẻ qua link.'
                      )
                    : tr(
                        'Server currently uses direct upload (< 4.5MB limit on free serverless tier). Larger clips remain safely stored and playable on your PC.',
                        'Server đang ở chế độ upload trực tiếp (< 4.5MB). Các clip dung lượng lớn hơn vẫn được lưu an toàn và xem mượt ngay trên máy.'
                      )}
                </p>
              </div>

              {isElectronRuntime ? (
                <div className="rounded-[4px] border border-[#232B3B] bg-[#0A0D12] p-4 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-1">
                      <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-[#EEF2F6]">
                        {tr('Local Highlights Disk Quota', 'Dung lượng kho Clip trên ổ cứng')} (
                        {stats?.fileCount || 0} {tr('files', 'tệp')} -{' '}
                        {formatBytes(stats?.totalBytes || 0)} /{' '}
                        {captureStatus?.maxStorageGb || stats?.maxStorageGb || 5} GB)
                      </h3>
                      {stats?.folderPath && (
                        <p className="font-mono text-[10px] text-[#64748B] truncate max-w-xl">
                          {stats.folderPath}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <label htmlFor="quota-cap-select" className="sr-only">
                        {tr('Storage limit', 'Giới hạn lưu trữ')}
                      </label>
                      <select
                        id="quota-cap-select"
                        value={captureStatus?.maxStorageGb || 5}
                        onChange={(e) =>
                          void onUpdateCaptureOptions({ maxStorageGb: Number(e.target.value) })
                        }
                        className="px-2.5 py-1.5 rounded-[2px] bg-[#10141C] border border-[#232B3B] text-xs font-mono text-[#EEF2F6]"
                      >
                        <option value={2}>Max 2 GB</option>
                        <option value={5}>Max 5 GB</option>
                        <option value={10}>Max 10 GB</option>
                        <option value={20}>Max 20 GB</option>
                        <option value={50}>Max 50 GB</option>
                      </select>

                      <button
                        type="button"
                        onClick={() => void handleOpenFolder()}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[2px] bg-[#171D28] hover:bg-[#232B3B] border border-[#38BDF8]/40 text-xs font-semibold text-[#38BDF8]"
                      >
                        <FolderOpen size={13} weight="bold" aria-hidden="true" />
                        <span>{tr('Open Folder', 'Mở thư mục')}</span>
                      </button>

                      <button
                        type="button"
                        disabled={busyStorage || !stats?.files?.length}
                        onClick={() => void handleCleanupUnpinned()}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[2px] bg-[#171D28] hover:bg-[#F43F5E]/15 border border-[#F43F5E]/40 text-xs font-semibold text-[#F43F5E] disabled:opacity-40"
                      >
                        <Trash size={13} weight="bold" aria-hidden="true" />
                        <span>{tr('Clean Unpinned', 'Dọn clip chưa ghim')}</span>
                      </button>
                    </div>
                  </div>

                  {/* Storage Meter */}
                  <div className="space-y-1">
                    <div className="h-2 w-full rounded-[2px] bg-[#171D28] overflow-hidden">
                      <div
                        style={{ width: `${usedRatioPct}%` }}
                        className={`h-full transition-all ${
                          usedRatioPct >= 85
                            ? 'bg-[#F43F5E]'
                            : usedRatioPct >= 60
                              ? 'bg-[#E59A23]'
                              : 'bg-[#10B981]'
                        }`}
                      />
                    </div>
                    <p className="font-mono text-[10px] text-[#64748B]">
                      {usedRatioPct}%{' '}
                      {tr(
                        'used (Pinned matches are always protected from auto-cleanup)',
                        'đã dùng (Các trận ĐÃ GHIM luôn được bảo vệ không tự xóa)'
                      )}
                    </p>
                  </div>

                  {!stats || stats.files.length === 0 ? (
                    <p className="text-xs text-[#64748B] py-3">
                      {tr(
                        'No local highlight clips recorded yet.',
                        'Chưa có tệp clip Highlight nào trong thư mục lưu trữ.'
                      )}
                    </p>
                  ) : (
                    <div className="space-y-1.5 max-h-56 overflow-y-auto tactical-scrollbar pr-1">
                      {stats.files.map((f) => {
                        const isPinned = Boolean(
                          f.attachedMatchId && pinnedMatchIds.includes(f.attachedMatchId)
                        );
                        return (
                          <div
                            key={f.filePath}
                            className="flex items-center justify-between gap-2 px-3 py-2 rounded-[2px] bg-[#10141C] border border-[#232B3B]"
                          >
                            <div className="min-w-0">
                              <p className="font-mono text-xs text-[#EEF2F6] truncate">
                                {f.name}{' '}
                                {isPinned && (
                                  <span className="text-[10px] text-[#E59A23] font-bold">
                                    ({tr('PINNED', 'ĐÃ GHIM')})
                                  </span>
                                )}
                              </p>
                              <p className="font-mono text-[10px] text-[#64748B]">
                                {formatBytes(f.sizeBytes)} -{' '}
                                {new Date(f.modifiedAt).toLocaleString()}
                              </p>
                            </div>
                            <button
                              type="button"
                              disabled={busyStorage}
                              aria-label={tr(`Delete clip ${f.name}`, `Xóa tệp ${f.name}`)}
                              onClick={() => void handleDeleteClip(f.filePath)}
                              className="px-2.5 py-1 rounded-[2px] bg-[#171D28] hover:bg-[#F43F5E]/15 border border-[#232B3B] text-[10px] font-mono text-[#F43F5E] shrink-0"
                            >
                              {tr('Delete', 'Xóa')}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-[#94A3B8]">
                  {tr(
                    'Local folder quota management is active in the Windows Desktop (.exe) app.',
                    'Quản lý thư mục clip ổ cứng hoạt động khi dùng bản cài đặt Windows (.exe).'
                  )}
                </p>
              )}
            </div>
          )}

          {/* TAB 4: SENSITIVITY & CROSSHAIR VAULT */}
          {activeTab === 'SENS' && (
            <SettingsVaultPanel initialGame={activeGameTab} active={isOpen} />
          )}

          {/* TAB 5: ACCOUNTS & BACKUP */}
          {activeTab === 'ACCOUNTS' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-[4px] border border-[#232B3B] bg-[#0A0D12] p-4 space-y-4">
                <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-[#EEF2F6] flex items-center gap-1.5">
                  <UserCircleGear size={15} weight="bold" className="text-[#10B981]" aria-hidden="true" />
                  <span>{tr('Linked Game Accounts', 'Tài khoản Game liên kết')}</span>
                </h3>

                {/* Steam & PUBG */}
                <div className="p-3 rounded-[2px] bg-[#10141C] border border-[#232B3B] space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-[#E59A23]">
                      STEAM &amp; PUBG
                    </span>
                    <span className="font-mono text-[10px] text-[#10B981]">
                      {profile?.steam_id
                        ? `${tr('Connected:', 'Đã nối:')} ${profile.steam_persona_name || 'Steam'}`
                        : tr('Not linked', 'Chưa liên kết')}
                    </span>
                  </div>

                  {!profile?.steam_id && (
                    <button
                      type="button"
                      onClick={() => void onLinkSteam()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[2px] bg-[#1B2838] hover:bg-[#24364B] border border-[#38BDF8]/40 text-xs font-bold text-[#EEF2F6]"
                    >
                      <LinkSimple size={13} weight="bold" aria-hidden="true" />
                      <span>{tr('Link Steam Account', 'Liên kết tài khoản Steam')}</span>
                    </button>
                  )}

                  <form onSubmit={(e) => void onSavePubgIgn(e)} className="space-y-1.5">
                    <label
                      htmlFor="settings-pubg-ign"
                      className="block font-mono text-[11px] text-[#94A3B8]"
                    >
                      {tr('Exact PUBG In-Game Name (Case-sensitive)', 'Tên nhân vật PUBG chính xác (Phân biệt hoa/thường)')}
                    </label>
                    <div className="flex gap-1.5">
                      <input
                        id="settings-pubg-ign"
                        type="text"
                        value={pubgIgnInput}
                        onChange={(e) => onChangePubgIgnInput(e.target.value)}
                        placeholder={profile?.steam_persona_name || 'PUBG IGN...'}
                        className="flex-1 min-w-0 px-2.5 py-1.5 rounded-[2px] bg-[#0A0D12] border border-[#232B3B] text-xs font-mono text-[#EEF2F6]"
                      />
                      <button
                        type="submit"
                        disabled={savingPubgIgn}
                        className="px-3 py-1.5 rounded-[2px] bg-[#E59A23] hover:bg-amber-400 text-[#0A0D12] font-bold text-xs disabled:opacity-50"
                      >
                        {savingPubgIgn ? '...' : tr('Verify IGN', 'Lưu IGN')}
                      </button>
                    </div>
                  </form>
                </div>

                {/* Riot RSO */}
                <div className="p-3 rounded-[2px] bg-[#10141C] border border-[#232B3B] space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-[#FF4655]">
                      VALORANT (RIOT RSO)
                    </span>
                    <span className="font-mono text-[10px] text-[#94A3B8]">
                      {profile?.riot_game_name
                        ? `${profile.riot_game_name}#${profile.riot_tag_line}`
                        : tr('Not linked', 'Chưa liên kết')}
                    </span>
                  </div>

                  {!profile?.has_riot_linked ? (
                    <button
                      type="button"
                      onClick={() => void onLinkRiot()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[2px] bg-[#FF4655] hover:bg-rose-500 text-xs font-bold text-[#EEF2F6]"
                    >
                      <LinkSimple size={13} weight="bold" aria-hidden="true" />
                      <span>{tr('Link Riot Sign On (RSO)', 'Liên kết Riot Sign On (RSO)')}</span>
                    </button>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={onSwitchRiotAccount}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[2px] bg-[#171D28] hover:bg-[#232B3B] border border-[#232B3B] text-xs text-[#EEF2F6]"
                      >
                        <Swap size={13} weight="bold" aria-hidden="true" />
                        <span>{tr('Switch Riot ID', 'Đổi nick Riot')}</span>
                      </button>
                      {profile?.steam_id && (
                        <button
                          type="button"
                          disabled={unlinkingRiot}
                          onClick={() => void onUnlinkRiot()}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[2px] bg-[#171D28] hover:bg-[#F43F5E]/15 border border-[#232B3B] text-xs text-[#F43F5E]"
                        >
                          <LinkBreak size={13} weight="bold" aria-hidden="true" />
                          <span>{tr('Unlink Riot', 'Hủy liên kết')}</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Local Backup & Restore */}
              <div className="rounded-[4px] border border-[#232B3B] bg-[#0A0D12] p-4 space-y-4">
                <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-[#EEF2F6] flex items-center gap-1.5">
                  <DownloadSimple size={15} weight="bold" className="text-[#38BDF8]" aria-hidden="true" />
                  <span>{tr('Backup & Restore Tactical Data', 'Sao lưu & Khôi phục dữ liệu')}</span>
                </h3>

                <p className="text-xs text-[#94A3B8] leading-relaxed">
                  {tr(
                    'Export all app preferences, Sensitivity Vault profiles, personal match notes/tags, replay bookmarks, and Telestrator drawings to a portable .json file.',
                    'Xuất toàn bộ tùy chọn ứng dụng, cấu hình Sens/Crosshair, ghi chú & nhãn từng trận, mốc Bookmark video và hình vẽ chiến thuật ra tệp .json để lưu trữ hoặc chuyển sang máy mới.'
                  )}
                </p>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={handleExportBackupFile}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[2px] bg-[#38BDF8] hover:bg-sky-300 text-[#0A0D12] font-bold text-xs transition"
                  >
                    <DownloadSimple size={14} weight="bold" aria-hidden="true" />
                    <span>{tr('Export Backup (.json)', 'Xuất bản sao lưu (.json)')}</span>
                  </button>

                  <label htmlFor="import-backup-json" className="sr-only">
                    {tr('Import backup JSON file', 'Chọn tệp sao lưu JSON')}
                  </label>
                  <input
                    id="import-backup-json"
                    ref={importInputRef}
                    type="file"
                    accept="application/json,.json"
                    onChange={(e) => void handleImportBackupFile(e)}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => importInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[2px] bg-[#171D28] hover:bg-[#232B3B] border border-[#232B3B] text-[#EEF2F6] font-semibold text-xs transition"
                  >
                    <UploadSimple size={14} weight="bold" aria-hidden="true" />
                    <span>{tr('Import Backup (.json)', 'Khôi phục từ tệp (.json)')}</span>
                  </button>
                </div>

                {backupMsg && (
                  <div className="p-3 rounded-[2px] bg-[#10141C] border border-[#38BDF8]/40 text-xs text-[#38BDF8]">
                    {backupMsg}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

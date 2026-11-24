import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Check, CloudCheck, Copy, Plus, SlidersHorizontal, Trash, X } from '@phosphor-icons/react';
import { useI18n } from '../i18n';
import {
  deleteCloudPreset,
  fetchCloudPresets,
  getAuthToken,
  saveCloudPreset,
} from '../services/localDb';

export interface GameConfigPreset {
  id: string;
  gameType: 'VALORANT' | 'PUBG';
  profileName: string;
  dpi: number;
  sensitivity: number;
  adsOrScopedSens: string;
  crosshairCode: string;
  audioSetup: string;
  notes: string;
  updatedAt: string;
}

interface SettingsVaultModalProps {
  isOpen: boolean;
  initialGame: 'VALORANT' | 'PUBG';
  onClose: () => void;
}

const STORAGE_KEY = 'tactical_replay_settings_vault_v1';

const DEFAULT_PRESETS: GameConfigPreset[] = [
  {
    id: 'preset-valo-default',
    gameType: 'VALORANT',
    profileName: 'Main Rifle / Entry Setup',
    dpi: 800,
    sensitivity: 0.32,
    adsOrScopedSens: 'ADS 1.0 - Scoped 1.0',
    crosshairCode: '0;P;c;5;h;0;f;0;0l;4;0o;2;0a;1;0f;0;1b;0',
    audioSetup: 'HRTF On - Footstep clarity EQ',
    notes: 'Small cyan crosshair for crisp head-level pre-aim.',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'preset-pubg-default',
    gameType: 'PUBG',
    profileName: 'Competitive AR / DMR',
    dpi: 800,
    sensitivity: 32,
    adsOrScopedSens: 'General 32 - RedDot 30 - 4x 28 - 6x 26',
    crosshairCode: 'Green RedDot Reticle - High Contrast',
    audioSetup: 'Footstep EQ - Lobby music muted',
    notes: 'Consistent Beryl / AUG spray control at 30-70m.',
    updatedAt: new Date().toISOString(),
  },
];

export const SettingsVaultPanel: React.FC<{
  initialGame: 'VALORANT' | 'PUBG';
  active?: boolean;
}> = ({ initialGame, active = true }) => {
  const { tr } = useI18n();
  const [gameTab, setGameTab] = useState<'VALORANT' | 'PUBG'>(initialGame);
  const [presets, setPresets] = useState<GameConfigPreset[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // Fallback to defaults
    }
    return DEFAULT_PRESETS;
  });

  const [cloudSynced, setCloudSynced] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const [profileName, setProfileName] = useState('');
  const [dpi, setDpi] = useState('800');
  const [sensitivity, setSensitivity] = useState('0.35');
  const [adsOrScopedSens, setAdsOrScopedSens] = useState('');
  const [crosshairCode, setCrosshairCode] = useState('');
  const [audioSetup, setAudioSetup] = useState('');
  const [notes, setNotes] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    setGameTab(initialGame);
  }, [initialGame]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  }, [presets]);

  useEffect(() => {
    if (!active || !getAuthToken()) return;

    const loadCloudPresets = async () => {
      setSyncing(true);
      try {
        const res = await fetchCloudPresets();
        const remoteList: GameConfigPreset[] = Array.isArray(res?.presets) ? res.presets : [];
        if (remoteList.length > 0) {
          setPresets((prev) => {
            const byId = new Map<string, GameConfigPreset>();
            remoteList.forEach((p) => byId.set(p.id, p));
            prev.forEach((p) => {
              if (
                !byId.has(p.id) &&
                !p.id.startsWith('preset-valo-') &&
                !p.id.startsWith('preset-pubg-')
              ) {
                byId.set(p.id, p);
              }
            });
            return Array.from(byId.values()).sort(
              (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
            );
          });
        }
        setCloudSynced(true);
      } catch {
        setCloudSynced(false);
      } finally {
        setSyncing(false);
      }
    };

    void loadCloudPresets();
  }, [active]);

  const isValo = gameTab === 'VALORANT';
  const filteredPresets = presets.filter((p) => p.gameType === gameTab);

  const handleAddPreset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileName.trim()) return;

    const newItem: GameConfigPreset = {
      id: `preset-${Date.now()}`,
      gameType: gameTab,
      profileName: profileName.trim(),
      dpi: Math.max(100, Number(dpi) || 800),
      sensitivity: Math.max(0.01, Number(sensitivity) || 1),
      adsOrScopedSens: adsOrScopedSens.trim() || tr('Default', 'Mặc định'),
      crosshairCode: crosshairCode.trim(),
      audioSetup: audioSetup.trim(),
      notes: notes.trim(),
      updatedAt: new Date().toISOString(),
    };

    setPresets((prev) => [newItem, ...prev]);
    setProfileName('');
    setAdsOrScopedSens('');
    setCrosshairCode('');
    setAudioSetup('');
    setNotes('');

    if (getAuthToken()) {
      try {
        await saveCloudPreset(newItem);
        setCloudSynced(true);
      } catch {
        setCloudSynced(false);
      }
    }
  };

  const handleDeletePreset = async (presetId: string) => {
    setPresets((prev) => prev.filter((p) => p.id !== presetId));
    if (getAuthToken()) {
      try {
        await deleteCloudPreset(presetId);
      } catch {
        // Ignore cloud delete error
      }
    }
  };

  const handleCopyText = async (id: string, text: string) => {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExportJson = async () => {
    await navigator.clipboard.writeText(JSON.stringify(presets, null, 2));
    setCopiedId('EXPORT_ALL');
    setTimeout(() => setCopiedId(null), 2500);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#232B3B]">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-[2px] font-mono text-[10px] font-bold border ${
              cloudSynced
                ? 'bg-[#10B981]/10 border-[#10B981]/40 text-[#10B981]'
                : 'bg-[#171D28] border-[#232B3B] text-[#94A3B8]'
            }`}
          >
            <CloudCheck size={11} weight="bold" aria-hidden="true" />
            <span>
              {syncing
                ? tr('SYNCING', 'ĐANG ĐỒNG BỘ')
                : cloudSynced
                  ? 'CLOUD SYNCED'
                  : 'LOCAL CACHE'}
            </span>
          </span>
          <span className="text-xs text-[#94A3B8]">
            {tr(
              'Save DPI, sensitivity, crosshair & EQ profiles across PCs',
              'Đồng bộ DPI, độ nhạy, mã tâm ngắm & âm thanh theo tài khoản'
            )}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex p-1 rounded-[2px] bg-[#0A0D12] border border-[#232B3B]">
            <button
              type="button"
              onClick={() => setGameTab('VALORANT')}
              className={`px-3 py-1 rounded-[2px] font-mono text-xs font-bold transition duration-150 ${
                isValo ? 'bg-[#FF4655] text-[#EEF2F6]' : 'text-[#94A3B8] hover:text-[#EEF2F6]'
              }`}
            >
              VALORANT
            </button>
            <button
              type="button"
              onClick={() => setGameTab('PUBG')}
              className={`px-3 py-1 rounded-[2px] font-mono text-xs font-bold transition duration-150 ${
                !isValo ? 'bg-[#E59A23] text-[#0A0D12]' : 'text-[#94A3B8] hover:text-[#EEF2F6]'
              }`}
            >
              PUBG
            </button>
          </div>

          <button
            type="button"
            onClick={() => void handleExportJson()}
            className="inline-flex items-center gap-1.5 rounded-[2px] bg-[#171D28] hover:bg-[#232B3B] border border-[#232B3B] px-3 py-1.5 font-mono text-xs font-semibold text-[#38BDF8]"
          >
            {copiedId === 'EXPORT_ALL' ? (
              <Check size={13} weight="bold" aria-hidden="true" />
            ) : (
              <Copy size={13} weight="bold" aria-hidden="true" />
            )}
            <span>
              {copiedId === 'EXPORT_ALL'
                ? tr('Copied JSON', 'Đã chép JSON')
                : tr('Copy JSON', 'Sao chép JSON')}
            </span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <form
          onSubmit={(e) => void handleAddPreset(e)}
          className="lg:col-span-5 rounded-[4px] border border-[#232B3B] bg-[#0A0D12] p-4 space-y-3 h-fit"
        >
          <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-[#EEF2F6] flex items-center gap-1.5">
            <Plus size={13} weight="bold" aria-hidden="true" />
            <span>
              {tr(`Add ${gameTab} Preset`, `Thêm bộ cấu hình ${gameTab}`)}
            </span>
          </h3>

          <div className="space-y-1">
            <label htmlFor="vault-profile-name" className="text-[11px] font-mono text-[#94A3B8]">
              {tr('Preset Name *', 'Tên cấu hình *')}
            </label>
            <input
              id="vault-profile-name"
              type="text"
              required
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              placeholder={isValo ? 'e.g. Vandal 800 DPI' : 'e.g. Beryl 4x Comp'}
              className="w-full px-3 py-1.5 rounded-[2px] bg-[#10141C] border border-[#232B3B] text-xs text-[#EEF2F6] focus:outline-none focus:border-[#38BDF8]"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <label htmlFor="vault-dpi" className="text-[11px] font-mono text-[#94A3B8]">
                {tr('Mouse DPI', 'DPI Chuột')}
              </label>
              <input
                id="vault-dpi"
                type="number"
                value={dpi}
                onChange={(e) => setDpi(e.target.value)}
                className="w-full px-3 py-1.5 rounded-[2px] bg-[#10141C] border border-[#232B3B] text-xs font-mono text-[#EEF2F6]"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="vault-sens" className="text-[11px] font-mono text-[#94A3B8]">
                Sensitivity
              </label>
              <input
                id="vault-sens"
                type="number"
                step="0.01"
                value={sensitivity}
                onChange={(e) => setSensitivity(e.target.value)}
                className="w-full px-3 py-1.5 rounded-[2px] bg-[#10141C] border border-[#232B3B] text-xs font-mono text-[#EEF2F6]"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="vault-ads" className="text-[11px] font-mono text-[#94A3B8]">
              {isValo
                ? tr('ADS / Scoped Multiplier', 'Hệ số ADS / Scoped')
                : tr('Scope Sens (RedDot / 4x / 6x)', 'Độ nhạy Scope (RedDot / 4x / 6x)')}
            </label>
            <input
              id="vault-ads"
              type="text"
              value={adsOrScopedSens}
              onChange={(e) => setAdsOrScopedSens(e.target.value)}
              placeholder={isValo ? 'ADS 1.0 / Operator 1.0' : 'RedDot 30 - 4x 28 - 6x 26'}
              className="w-full px-3 py-1.5 rounded-[2px] bg-[#10141C] border border-[#232B3B] text-xs font-mono text-[#EEF2F6]"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="vault-crosshair" className="text-[11px] font-mono text-[#94A3B8]">
              {isValo
                ? tr('Crosshair Code', 'Mã Crosshair Code')
                : tr('Reticle & Hit Color', 'Kiểu tâm ngắm & Màu máu')}
            </label>
            <input
              id="vault-crosshair"
              type="text"
              value={crosshairCode}
              onChange={(e) => setCrosshairCode(e.target.value)}
              placeholder={
                isValo ? '0;P;c;5;h;0;0l;4;0o;2...' : tr('Green Dot - High Contrast', 'Chấm xanh lá')
              }
              className="w-full px-3 py-1.5 rounded-[2px] bg-[#10141C] border border-[#232B3B] text-xs font-mono text-[#EEF2F6]"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="vault-audio" className="text-[11px] font-mono text-[#94A3B8]">
              {tr('Audio / EQ Setup', 'Thiết lập âm thanh / EQ')}
            </label>
            <input
              id="vault-audio"
              type="text"
              value={audioSetup}
              onChange={(e) => setAudioSetup(e.target.value)}
              placeholder={tr('HRTF / Footstep EQ...', 'HRTF / Equalizer tiếng bước chân...')}
              className="w-full px-3 py-1.5 rounded-[2px] bg-[#10141C] border border-[#232B3B] text-xs text-[#EEF2F6]"
            />
          </div>

          <button
            type="submit"
            className={`w-full py-2 px-4 rounded-[2px] font-bold text-xs transition duration-150 ${
              isValo
                ? 'bg-[#FF4655] hover:bg-rose-500 text-[#EEF2F6]'
                : 'bg-[#E59A23] hover:bg-amber-400 text-[#0A0D12]'
            }`}
          >
            {tr('Save & Cloud Sync', 'Lưu cấu hình & Đồng bộ Cloud')}
          </button>
        </form>

        <div className="lg:col-span-7 space-y-2.5 max-h-[52vh] overflow-y-auto tactical-scrollbar pr-1">
          {filteredPresets.length === 0 ? (
            <div className="rounded-[2px] border border-dashed border-[#232B3B] bg-[#0A0D12] p-6 text-center text-xs text-[#64748B]">
              {tr(
                `No ${gameTab} presets saved yet. Add your first preset on the left.`,
                `Chưa có cấu hình ${gameTab} nào. Hãy thêm cấu hình đầu tiên ở khung bên trái.`
              )}
            </div>
          ) : (
            filteredPresets.map((item) => (
              <div
                key={item.id}
                className="rounded-[4px] border border-[#232B3B] bg-[#0A0D12] p-3.5 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-display text-sm font-bold text-[#EEF2F6]">
                      {item.profileName}
                    </h4>
                    <p className="font-mono text-[11px] text-[#38BDF8] tabular-nums">
                      {item.dpi} DPI | Sens {item.sensitivity} | eDPI{' '}
                      {Math.round(item.dpi * item.sensitivity)}
                    </p>
                  </div>

                  <button
                    type="button"
                    aria-label={tr(
                      `Delete preset ${item.profileName}`,
                      `Xóa cấu hình ${item.profileName}`
                    )}
                    onClick={() => void handleDeletePreset(item.id)}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-[2px] bg-[#171D28] hover:bg-[#F43F5E]/15 border border-[#232B3B] text-[10px] font-mono text-[#F43F5E]"
                  >
                    <Trash size={12} weight="bold" aria-hidden="true" />
                    <span>{tr('Delete', 'Xóa')}</span>
                  </button>
                </div>

                <div className="text-xs text-[#94A3B8] space-y-1 font-mono">
                  <p>
                    <span className="text-[#64748B]">ADS/Scope:</span> {item.adsOrScopedSens}
                  </p>
                  {item.audioSetup && (
                    <p>
                      <span className="text-[#64748B]">{tr('Audio:', 'Âm thanh:')}</span>{' '}
                      {item.audioSetup}
                    </p>
                  )}
                </div>

                {item.crosshairCode && (
                  <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-[2px] bg-[#10141C] border border-[#232B3B]">
                    <code className="text-[11px] font-mono text-[#10B981] truncate">
                      {item.crosshairCode}
                    </code>
                    <button
                      type="button"
                      onClick={() => void handleCopyText(item.id, item.crosshairCode)}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[2px] bg-[#171D28] hover:bg-[#232B3B] text-[10px] font-mono text-[#EEF2F6] shrink-0"
                    >
                      {copiedId === item.id ? (
                        <Check size={11} weight="bold" aria-hidden="true" />
                      ) : (
                        <Copy size={11} weight="bold" aria-hidden="true" />
                      )}
                      <span>
                        {copiedId === item.id ? tr('Copied', 'Đã chép') : tr('Copy', 'Copy mã')}
                      </span>
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export const SettingsVaultModal: React.FC<SettingsVaultModalProps> = ({
  isOpen,
  initialGame,
  onClose,
}) => {
  const { tr } = useI18n();
  const reduceMotion = useReducedMotion();

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="vault-modal-title"
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0A0D12]/85 p-4 backdrop-blur-sm"
        >
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, scale: 0.98, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98, y: 8 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            className="w-full max-w-4xl rounded-[4px] border border-[#334155] bg-[#10141C] shadow-2xl overflow-hidden flex flex-col max-h-[88vh]"
          >
            <div className="flex items-center justify-between gap-3 border-b border-[#232B3B] px-6 py-4 bg-[#0A0D12]">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-[2px] bg-[#10B981]/15 border border-[#10B981]/40 text-[#10B981] flex items-center justify-center">
                  <SlidersHorizontal size={16} weight="bold" aria-hidden="true" />
                </div>
                <h2
                  id="vault-modal-title"
                  className="font-display text-base font-bold text-[#EEF2F6]"
                >
                  {tr(
                    'Sensitivity, Crosshair & Audio Vault',
                    'Kho lưu trữ Sens, Crosshair & Âm thanh cá nhân'
                  )}
                </h2>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label={tr('Close settings vault', 'Đóng kho cấu hình')}
                className="inline-flex items-center gap-1 rounded-[2px] bg-[#171D28] hover:bg-[#232B3B] border border-[#232B3B] px-3 py-1.5 text-xs font-semibold text-[#94A3B8] hover:text-[#EEF2F6]"
              >
                <X size={14} weight="bold" aria-hidden="true" />
                <span>{tr('Close', 'Đóng')}</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto tactical-scrollbar p-6">
              <SettingsVaultPanel initialGame={initialGame} active={isOpen} />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

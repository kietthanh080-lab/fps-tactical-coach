import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Check, Copy, Plus, SlidersHorizontal, Trash, X } from '@phosphor-icons/react';

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
    profileName: 'Main Rifle / Breach Setup',
    dpi: 400,
    sensitivity: 0.51,
    adsOrScopedSens: 'ADS 1.0 - Scoped 1.0',
    crosshairCode: '0;P;c;5;h;0;f;0;0l;4;0o;2;0a;1;0f;0;1b;0',
    audioSetup: 'HRTF Bật - Bass nhẹ nghe tiếng bước chân',
    notes: 'Tâm chấm nhỏ màu xanh ngọc, kê đầu tầm trung/xa.',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'preset-pubg-default',
    gameType: 'PUBG',
    profileName: 'Competitive AR / DMR',
    dpi: 800,
    sensitivity: 32,
    adsOrScopedSens: 'General 32 - RedDot 30 - 4x 28 - 6x 26',
    crosshairCode: 'Red Dot Tâm Chấm Xanh Lá - Blood Color: Green',
    audioSetup: 'Sound Lab chuẩn tiếng chân - Tắt nhạc sảnh',
    notes: 'Kéo tâm Beryl / AUG ổn định ở tầm 30-70m.',
    updatedAt: new Date().toISOString(),
  },
];

export const SettingsVaultModal: React.FC<SettingsVaultModalProps> = ({
  isOpen,
  initialGame,
  onClose,
}) => {
  const reduceMotion = useReducedMotion();
  const [gameTab, setGameTab] = useState<'VALORANT' | 'PUBG'>(initialGame);
  const [presets, setPresets] = useState<GameConfigPreset[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // Dùng bộ mẫu mặc định nếu chưa có dữ liệu
    }
    return DEFAULT_PRESETS;
  });

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

  const isValo = gameTab === 'VALORANT';
  const filteredPresets = presets.filter((p) => p.gameType === gameTab);

  const handleAddPreset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileName.trim()) return;

    const newItem: GameConfigPreset = {
      id: `preset-${Date.now()}`,
      gameType: gameTab,
      profileName: profileName.trim(),
      dpi: Math.max(100, Number(dpi) || 800),
      sensitivity: Math.max(0.01, Number(sensitivity) || 1),
      adsOrScopedSens: adsOrScopedSens.trim() || 'Mặc định',
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
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#232B3B] px-6 py-4 bg-[#0A0D12]">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-[2px] bg-[#10B981]/15 border border-[#10B981]/40 text-[#10B981] flex items-center justify-center">
                  <SlidersHorizontal size={16} weight="bold" aria-hidden="true" />
                </div>
                <div>
                  <h2
                    id="vault-modal-title"
                    className="font-display text-base font-bold text-[#EEF2F6]"
                  >
                    Kho lưu trữ Sens, Crosshair &amp; Âm thanh cá nhân
                  </h2>
                  <p className="text-xs text-[#94A3B8]">
                    Lưu sẵn thông số chuột và mã tâm ngắm để sao chép nhanh 1 chạm khi ngồi máy mới
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex p-1 rounded-[2px] bg-[#10141C] border border-[#232B3B]">
                  <button
                    type="button"
                    onClick={() => setGameTab('VALORANT')}
                    className={`px-3 py-1.5 rounded-[2px] font-mono text-xs font-bold transition duration-150 ${
                      isValo ? 'bg-[#FF4655] text-[#EEF2F6]' : 'text-[#94A3B8] hover:text-[#EEF2F6]'
                    }`}
                  >
                    VALORANT
                  </button>
                  <button
                    type="button"
                    onClick={() => setGameTab('PUBG')}
                    className={`px-3 py-1.5 rounded-[2px] font-mono text-xs font-bold transition duration-150 ${
                      !isValo ? 'bg-[#E59A23] text-[#0A0D12]' : 'text-[#94A3B8] hover:text-[#EEF2F6]'
                    }`}
                  >
                    PUBG
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => void handleExportJson()}
                  className="inline-flex items-center gap-1.5 rounded-[2px] bg-[#171D28] hover:bg-[#232B3B] border border-[#232B3B] px-3 py-1.5 font-mono text-xs font-semibold text-[#38BDF8] transition duration-150"
                >
                  {copiedId === 'EXPORT_ALL' ? (
                    <Check size={14} weight="bold" aria-hidden="true" />
                  ) : (
                    <Copy size={14} weight="bold" aria-hidden="true" />
                  )}
                  <span>{copiedId === 'EXPORT_ALL' ? 'Đã chép JSON' : 'Sao chép JSON'}</span>
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Đóng kho cấu hình"
                  className="inline-flex items-center gap-1 rounded-[2px] bg-[#171D28] hover:bg-[#232B3B] border border-[#232B3B] px-3 py-1.5 text-xs font-semibold text-[#94A3B8] hover:text-[#EEF2F6]"
                >
                  <X size={14} weight="bold" aria-hidden="true" />
                  <span>Đóng</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-5 p-6 overflow-y-auto tactical-scrollbar">
              {/* Form them cau hinh moi */}
              <form
                onSubmit={handleAddPreset}
                className="md:col-span-5 space-y-3 rounded-[4px] border border-[#232B3B] bg-[#0A0D12] p-4"
              >
                <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-[#EEF2F6] flex items-center gap-1.5">
                  <Plus size={14} weight="bold" aria-hidden="true" />
                  <span>Thêm bộ cấu hình {gameTab}</span>
                </h3>

                <div className="space-y-1">
                  <label htmlFor="vault-profile-name" className="block text-[11px] text-[#94A3B8]">
                    Tên cấu hình *
                  </label>
                  <input
                    id="vault-profile-name"
                    type="text"
                    required
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    placeholder={isValo ? 'VD: Breach Entry 400 DPI' : 'VD: Beryl RedDot 800 DPI'}
                    className="w-full px-3 py-2 rounded-[2px] bg-[#10141C] border border-[#232B3B] text-xs text-[#EEF2F6] placeholder:text-[#64748B] focus:outline-none focus:border-[#38BDF8]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label htmlFor="vault-dpi" className="block text-[11px] text-[#94A3B8]">
                      DPI Chuột
                    </label>
                    <input
                      id="vault-dpi"
                      type="number"
                      value={dpi}
                      onChange={(e) => setDpi(e.target.value)}
                      className="w-full px-3 py-2 rounded-[2px] bg-[#10141C] border border-[#232B3B] text-xs text-[#EEF2F6] font-mono tabular-nums focus:outline-none focus:border-[#38BDF8]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="vault-sens" className="block text-[11px] text-[#94A3B8]">
                      {isValo ? 'In-game Sens' : 'General Sens'}
                    </label>
                    <input
                      id="vault-sens"
                      type="number"
                      step="0.001"
                      value={sensitivity}
                      onChange={(e) => setSensitivity(e.target.value)}
                      className="w-full px-3 py-2 rounded-[2px] bg-[#10141C] border border-[#232B3B] text-xs text-[#EEF2F6] font-mono tabular-nums focus:outline-none focus:border-[#38BDF8]"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label htmlFor="vault-ads-sens" className="block text-[11px] text-[#94A3B8]">
                    {isValo ? 'Hệ số ADS / Scoped' : 'Độ nhạy Scope (RedDot / 4x / 6x)'}
                  </label>
                  <input
                    id="vault-ads-sens"
                    type="text"
                    value={adsOrScopedSens}
                    onChange={(e) => setAdsOrScopedSens(e.target.value)}
                    placeholder={isValo ? 'ADS 1.0 - Scoped 1.0' : 'RedDot 30 - 4x 28 - 6x 25'}
                    className="w-full px-3 py-2 rounded-[2px] bg-[#10141C] border border-[#232B3B] text-xs text-[#EEF2F6] placeholder:text-[#64748B] focus:outline-none focus:border-[#38BDF8]"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="vault-crosshair" className="block text-[11px] text-[#94A3B8]">
                    {isValo ? 'Mã Crosshair Code' : 'Kiểu tâm ngắm & Màu máu'}
                  </label>
                  <input
                    id="vault-crosshair"
                    type="text"
                    value={crosshairCode}
                    onChange={(e) => setCrosshairCode(e.target.value)}
                    placeholder={isValo ? '0;P;c;5;h;0;0l;4;0o;2...' : 'Chấm xanh lá - Máu xanh lá'}
                    className="w-full px-3 py-2 rounded-[2px] bg-[#10141C] border border-[#232B3B] text-xs text-[#EEF2F6] font-mono placeholder:text-[#64748B] focus:outline-none focus:border-[#38BDF8]"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="vault-audio" className="block text-[11px] text-[#94A3B8]">
                    Thiết lập âm thanh / EQ
                  </label>
                  <input
                    id="vault-audio"
                    type="text"
                    value={audioSetup}
                    onChange={(e) => setAudioSetup(e.target.value)}
                    placeholder="HRTF / Equalizer tiếng bước chân..."
                    className="w-full px-3 py-2 rounded-[2px] bg-[#10141C] border border-[#232B3B] text-xs text-[#EEF2F6] placeholder:text-[#64748B] focus:outline-none focus:border-[#38BDF8]"
                  />
                </div>

                <button
                  type="submit"
                  className={`w-full py-2.5 rounded-[2px] text-xs font-bold transition duration-150 active:translate-y-[1px] ${
                    isValo
                      ? 'bg-[#FF4655] hover:bg-rose-500 text-[#EEF2F6]'
                      : 'bg-[#E59A23] hover:bg-amber-400 text-[#0A0D12]'
                  }`}
                >
                  Lưu cấu hình vào kho
                </button>
              </form>

              {/* Danh sach cau hinh da luu */}
              <div className="md:col-span-7 space-y-3">
                {filteredPresets.length === 0 ? (
                  <div className="rounded-[4px] border border-dashed border-[#232B3B] p-8 text-center text-xs text-[#64748B]">
                    Chưa có cấu hình {gameTab} nào. Hãy thêm cấu hình đầu tiên ở khung bên trái.
                  </div>
                ) : (
                  filteredPresets.map((item) => {
                    const edpi = Math.round(item.dpi * item.sensitivity * 100) / 100;
                    return (
                      <div
                        key={item.id}
                        className="rounded-[4px] border border-[#232B3B] bg-[#0A0D12] p-4 space-y-2.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className="font-display text-sm font-bold text-[#EEF2F6]">
                              {item.profileName}
                            </h4>
                            <p className="text-xs font-mono text-[#10B981] mt-0.5 tabular-nums">
                              {item.dpi} DPI x {item.sensitivity} Sens (eDPI: {edpi})
                            </p>
                          </div>

                          <button
                            type="button"
                            aria-label={`Xóa cấu hình ${item.profileName}`}
                            onClick={() =>
                              setPresets((prev) => prev.filter((p) => p.id !== item.id))
                            }
                            className="inline-flex items-center gap-1 rounded-[2px] px-2 py-1 text-[11px] text-[#64748B] hover:text-[#F43F5E] hover:bg-[#171D28] transition duration-150"
                          >
                            <Trash size={13} weight="bold" aria-hidden="true" />
                            <span>Xóa</span>
                          </button>
                        </div>

                        <p className="text-xs text-[#94A3B8]">
                          <span className="text-[#64748B]">Scope/ADS:</span> {item.adsOrScopedSens}
                        </p>

                        {item.audioSetup && (
                          <p className="text-xs text-[#94A3B8]">
                            <span className="text-[#64748B]">Âm thanh:</span> {item.audioSetup}
                          </p>
                        )}

                        {item.crosshairCode && (
                          <div className="flex items-center justify-between gap-2 rounded-[2px] bg-[#10141C] border border-[#232B3B] px-3 py-2">
                            <code className="font-mono text-[11px] text-[#E59A23] truncate">
                              {item.crosshairCode}
                            </code>
                            <button
                              type="button"
                              onClick={() => void handleCopyText(item.id, item.crosshairCode)}
                              className="inline-flex items-center gap-1 shrink-0 rounded-[2px] bg-[#171D28] hover:bg-[#232B3B] border border-[#232B3B] px-2.5 py-1 text-[11px] font-bold text-[#EEF2F6] transition duration-150"
                            >
                              {copiedId === item.id ? (
                                <Check size={12} weight="bold" aria-hidden="true" />
                              ) : (
                                <Copy size={12} weight="bold" aria-hidden="true" />
                              )}
                              <span>{copiedId === item.id ? 'Đã chép' : 'Copy mã'}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

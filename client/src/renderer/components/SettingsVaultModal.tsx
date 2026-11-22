import React, { useEffect, useState } from 'react';

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
    adsOrScopedSens: 'ADS 1.0 • Scoped 1.0',
    crosshairCode: '0;P;c;5;h;0;f;0;0l;4;0o;2;0a;1;0f;0;1b;0',
    audioSetup: 'HRTF Bật • Bass nhẹ nghe tiếng bước chân',
    notes: 'Tâm chấm nhỏ màu xanh ngọc, kê đầu tầm trung/xa.',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'preset-pubg-default',
    gameType: 'PUBG',
    profileName: 'Competitive AR / DMR',
    dpi: 800,
    sensitivity: 32,
    adsOrScopedSens: 'General 32 • RedDot 30 • 4x 28 • 6x 26',
    crosshairCode: 'Red Dot Tâm Chấm Xanh Lá • Blood Color: Green',
    audioSetup: 'Sound Lab chuẩn tiếng chân • Tắt nhạc sảnh',
    notes: 'Kéo tâm Beryl / AUG ổn định ở tầm 30–70m.',
    updatedAt: new Date().toISOString(),
  },
];

export const SettingsVaultModal: React.FC<SettingsVaultModalProps> = ({
  isOpen,
  initialGame,
  onClose,
}) => {
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

  if (!isOpen) return null;

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs">
      <div className="w-full max-w-4xl rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-6 py-4 bg-slate-950/70">
          <div>
            <h2 className="text-base font-extrabold text-white">
              Kho lưu trữ Sens, Crosshair &amp; Âm thanh cá nhân
            </h2>
            <p className="text-xs text-slate-400">
              Lưu sẵn thông số chuột và mã tâm ngắm để sao chép nhanh 1 chạm khi ngồi máy mới
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="flex p-1 rounded-xl bg-slate-950 border border-slate-800">
              <button
                type="button"
                onClick={() => setGameTab('VALORANT')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition ${
                  isValo ? 'bg-[#ff4655] text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                VALORANT
              </button>
              <button
                type="button"
                onClick={() => setGameTab('PUBG')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition ${
                  !isValo ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                PUBG
              </button>
            </div>

            <button
              type="button"
              onClick={() => void handleExportJson()}
              className="rounded-lg bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-xs font-semibold text-sky-300"
            >
              {copiedId === 'EXPORT_ALL' ? 'Đã chép JSON!' : 'Sao chép sao lưu'}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300"
            >
              Đóng
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 p-6 overflow-y-auto">
          {/* Cột trái: Form thêm cấu hình mới */}
          <form
            onSubmit={handleAddPreset}
            className="md:col-span-5 space-y-3 rounded-xl border border-slate-800 bg-slate-950/80 p-4"
          >
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              + Thêm bộ cấu hình {gameTab}
            </h3>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Tên cấu hình *</label>
              <input
                type="text"
                required
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                placeholder={isValo ? 'Ví dụ: Breach Entry 400 DPI' : 'Ví dụ: Beryl RedDot 800 DPI'}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">DPI Chuột</label>
                <input
                  type="number"
                  value={dpi}
                  onChange={(e) => setDpi(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  {isValo ? 'In-game Sens' : 'General Sens'}
                </label>
                <input
                  type="number"
                  step="0.001"
                  value={sensitivity}
                  onChange={(e) => setSensitivity(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1">
                {isValo ? 'Hệ số ADS / Scoped' : 'Độ nhạy Scope (RedDot / 4x / 6x)'}
              </label>
              <input
                type="text"
                value={adsOrScopedSens}
                onChange={(e) => setAdsOrScopedSens(e.target.value)}
                placeholder={isValo ? 'ADS 1.0 • Scoped 1.0' : 'RedDot 30 • 4x 28 • 6x 25'}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1">
                {isValo ? 'Mã Crosshair Code' : 'Kiểu tâm ngắm & Màu máu'}
              </label>
              <input
                type="text"
                value={crosshairCode}
                onChange={(e) => setCrosshairCode(e.target.value)}
                placeholder={isValo ? '0;P;c;5;h;0;0l;4;0o;2...' : 'Chấm xanh lá • Máu xanh lá'}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Thiết lập âm thanh / EQ</label>
              <input
                type="text"
                value={audioSetup}
                onChange={(e) => setAudioSetup(e.target.value)}
                placeholder="HRTF / Equalizer tiếng bước chân..."
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white"
              />
            </div>

            <button
              type="submit"
              className={`w-full py-2.5 rounded-lg text-xs font-extrabold transition ${
                isValo
                  ? 'bg-[#ff4655] hover:bg-rose-500 text-white'
                  : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
              }`}
            >
              Lưu cấu hình vào kho
            </button>
          </form>

          {/* Cột phải: Danh sách cấu hình đã lưu */}
          <div className="md:col-span-7 space-y-3">
            {filteredPresets.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-800 p-8 text-center text-xs text-slate-500">
                Chưa có cấu hình {gameTab} nào. Hãy thêm cấu hình đầu tiên ở khung bên trái.
              </div>
            ) : (
              filteredPresets.map((item) => {
                const edpi = Math.round(item.dpi * item.sensitivity * 100) / 100;
                return (
                  <div
                    key={item.id}
                    className="rounded-xl border border-slate-800 bg-slate-950/90 p-4 space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="text-sm font-bold text-white">{item.profileName}</h4>
                        <p className="text-xs font-mono text-emerald-400 mt-0.5">
                          {item.dpi} DPI × {item.sensitivity} Sens (eDPI: {edpi})
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setPresets((prev) => prev.filter((p) => p.id !== item.id))
                        }
                        className="text-[11px] text-slate-500 hover:text-rose-400"
                      >
                        Xóa
                      </button>
                    </div>

                    <p className="text-xs text-slate-300">
                      <span className="text-slate-500">Scope/ADS:</span> {item.adsOrScopedSens}
                    </p>

                    {item.audioSetup && (
                      <p className="text-xs text-slate-300">
                        <span className="text-slate-500">Âm thanh:</span> {item.audioSetup}
                      </p>
                    )}

                    {item.crosshairCode && (
                      <div className="flex items-center justify-between gap-2 rounded-lg bg-slate-900 border border-slate-800 px-3 py-2">
                        <code className="text-[11px] text-amber-300 truncate">
                          {item.crosshairCode}
                        </code>
                        <button
                          type="button"
                          onClick={() => void handleCopyText(item.id, item.crosshairCode)}
                          className="shrink-0 rounded bg-slate-800 hover:bg-slate-700 px-2.5 py-1 text-[11px] font-bold text-white"
                        >
                          {copiedId === item.id ? 'Đã chép!' : 'Copy mã'}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
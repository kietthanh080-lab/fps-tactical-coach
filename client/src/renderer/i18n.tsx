import React, { createContext, useCallback, useContext } from 'react';
import { AppLanguage } from './services/appSettings';

const VN_DIACRITICS_RE =
  /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;

export function translateServerTextToEn(raw: string | null | undefined, fallback = ''): string {
  if (!raw) return fallback;
  const text = String(raw).trim();
  if (!text) return fallback;

  // VALORANT rule templates
  if (text.startsWith('Opening Pick:')) {
    return 'Opening Pick: Won the opening duel to secure an early man-advantage.';
  }
  if (text.startsWith('Multi-Kill (')) {
    const k = text.match(/\((\d+)/)?.[1] || '2';
    return `Multi-Kill (${k} kills): Created major round-swing impact.`;
  }
  if (text.startsWith('Untraded Death:')) {
    return 'Untraded Death: Eliminated in an isolated position where teammates could not trade.';
  }
  if (text.startsWith('Lãng phí tài nguyên:')) {
    const ab = text.match(/dư\s+(\d+)/)?.[1] || '2';
    return `Unused Utility: Eliminated while holding ${ab} unused abilities.`;
  }
  if (text.startsWith('Thrifty Win:')) {
    return 'Thrifty Win: Won an eco round with coordinated team play.';
  }
  if (text.startsWith('Luyện kê tâm ngang tầm đầu')) {
    return 'Practice head-level crosshair placement for 10 minutes in Deathmatch before queuing.';
  }
  if (text.startsWith('Giữ khoảng cách đi cùng đồng đội')) {
    return 'Stay within 1-2 seconds spacing of a teammate so deaths can always be traded.';
  }

  // PUBG rule templates
  const phaseMatch = text.match(/Phase (\d+)/i);
  if (text.startsWith('Áp lực hỏa lực cao:')) {
    const dmg = text.match(/Gây\s+(\d+)/)?.[1] || '0';
    return `High Firepower: Dealt ${dmg} damage in Phase ${phaseMatch?.[1] || '?'}.`;
  }
  if (text.startsWith('Xử lý giao tranh gọn:')) {
    const kills = text.match(/Hạ gục\s+(\d+)/)?.[1] || '1';
    return `Clean Engagement: Eliminated ${kills} target(s) while holding position.`;
  }
  if (text.startsWith('Bắn tỉa tầm xa:')) {
    const dist = text.match(/cự ly\s+(\d+)m/)?.[1] || '?';
    const weapon = text.match(/bằng\s+(.+?)\.?$/)?.[1] || 'DMR/SR';
    return `Long-Range Marksman: Knocked/eliminated target at ${dist}m with ${weapon}.`;
  }
  if (text.startsWith('Che chắn chiến thuật:')) {
    const cnt = text.match(/Sử dụng\s+(\d+)/)?.[1] || '2';
    return `Tactical Smoke Cover: Deployed ${cnt} Smoke Grenade(s) to create a safe path.`;
  }
  if (text.startsWith('Bị bắt lẻ ở Phase')) {
    return `Caught Isolated in Phase ${phaseMatch?.[1] || '?'}: Eliminated quickly before trading back or deploying smoke.`;
  }
  if (text.startsWith('Di chuyển muộn:')) {
    return 'Late Zone Rotation: Forced into a long late-circle sprint, exposing your position.';
  }

  // Shared report fallback templates
  if (text.startsWith('Duy trì chỉ số K/D')) {
    const kd = text.match(/K\/D\s+([\d.]+)/)?.[1] || '0';
    const dmg = text.match(/với\s+(\d+)/)?.[1] || '0';
    const map = text.match(/bản đồ\s+(.+?)\.?$/)?.[1] || 'this map';
    return `Maintained a ${kd} K/D with ${dmg} total damage on ${map}.`;
  }
  if (text.startsWith('Cần chủ động phối hợp')) {
    return 'Coordinate crossfires and entry timing more proactively with teammates in key rounds.';
  }
  if (text.startsWith('Luyện kiểm soát độ giật')) {
    return 'Practice AR spray and recoil control at 50-100m in Training Mode.';
  }
  if (text.startsWith('Luôn mang theo tối thiểu')) {
    return 'Carry at least 3-4 Smoke Grenades for safer late-circle rotations.';
  }
  if (text.startsWith('Trận đấu trên bản đồ')) {
    const map = text.match(/bản đồ\s+(.+?)\s+ghi nhận/)?.[1] || 'this map';
    const kills = text.match(/(\d+)\s+hạ gục/)?.[1] || '0';
    const deaths = text.match(/(\d+)\s+lần bị hạ/)?.[1] || '0';
    const kd = text.match(/K\/D\s+([\d.]+)/)?.[1] || '0';
    const issues = text.match(/khắc phục\s+(\d+)/)?.[1] || '0';
    return `Match on ${map} recorded ${kills} kill(s) / ${deaths} death(s) (${kd} K/D). Addressing ${issues} positioning mistake(s) will directly improve your win rate.`;
  }
  if (text.startsWith('Hạ bởi ')) {
    return `Eliminated by ${text.slice('Hạ bởi '.length)}`;
  }
  if (text === 'Bị hạ gục') {
    return 'Eliminated';
  }

  if (VN_DIACRITICS_RE.test(text)) {
    return fallback || 'Tactical insight summarized from match telemetry.';
  }
  return text;
}

export interface I18nContextValue {
  lang: AppLanguage;
  isEn: boolean;
  setLang: (next: AppLanguage) => void;
  tr: (enText: string, viText: string) => string;
  ts: (raw: string | null | undefined, fallbackEn?: string, fallbackVi?: string) => string;
  localeCode: string;
}

const I18nContext = createContext<I18nContextValue>({
  lang: 'en',
  isEn: true,
  setLang: () => {},
  tr: (enText) => enText,
  ts: (raw, fallbackEn = '') => translateServerTextToEn(raw, fallbackEn),
  localeCode: 'en-US',
});

export const I18nProvider: React.FC<{
  lang: AppLanguage;
  onChangeLang: (next: AppLanguage) => void;
  children: React.ReactNode;
}> = ({ lang, onChangeLang, children }) => {
  const isEn = lang === 'en';
  const localeCode = isEn ? 'en-US' : 'vi-VN';

  const tr = useCallback(
    (enText: string, viText: string) => (isEn ? enText : viText),
    [isEn]
  );

  const ts = useCallback(
    (raw: string | null | undefined, fallbackEn = '', fallbackVi = '') => {
      if (isEn) return translateServerTextToEn(raw, fallbackEn);
      if (!raw || !String(raw).trim()) return fallbackVi || fallbackEn;
      return String(raw);
    },
    [isEn]
  );

  return (
    <I18nContext.Provider
      value={{
        lang,
        isEn,
        setLang: onChangeLang,
        tr,
        ts,
        localeCode,
      }}
    >
      {children}
    </I18nContext.Provider>
  );
};

export function useI18n(): I18nContextValue {
  return useContext(I18nContext);
}

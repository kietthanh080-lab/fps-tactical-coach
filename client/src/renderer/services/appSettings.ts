export type AppLanguage = 'en' | 'vi';
export type AutoRefreshIntervalSec = 0 | 30 | 60 | 120 | 300;

export interface AppUserSettings {
  language: AppLanguage;
  defaultGame: 'AUTO' | 'PUBG' | 'VALORANT';
  themeEffects: boolean;
  autoRefreshSec: AutoRefreshIntervalSec;
  autoPostMatchRecap: boolean;
}

export interface MatchAnnotation {
  tags: string[];
  note: string;
  updatedAt: string;
}

export interface ReplayBookmark {
  id: string;
  timeSec: number;
  label: string;
}

const APP_SETTINGS_KEY = 'tactical_replay_app_settings_v2';
const ANNOTATIONS_KEY = 'tactical_replay_match_annotations_v1';
const BOOKMARKS_PREFIX = 'tactical_replay_bookmarks_';
const SETTINGS_VAULT_KEY = 'tactical_replay_settings_vault_v1';
const TELESTRATOR_PREFIX = 'tactical_replay_telestrator_';

export const PRESET_MATCH_TAGS = [
  'Clutch',
  'IGL Review',
  'Good Rotation',
  'Positioning Fix',
  'Aim Peak',
  'Team Scrim',
] as const;

export const DEFAULT_APP_SETTINGS: AppUserSettings = {
  language: 'en', // English is strictly the default language
  defaultGame: 'AUTO',
  themeEffects: true,
  autoRefreshSec: 60,
  autoPostMatchRecap: true,
};

export function loadAppSettings(): AppUserSettings {
  try {
    const raw = localStorage.getItem(APP_SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_APP_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<AppUserSettings>;
    const lang: AppLanguage = parsed.language === 'vi' ? 'vi' : 'en';
    const defGame =
      parsed.defaultGame === 'PUBG' || parsed.defaultGame === 'VALORANT'
        ? parsed.defaultGame
        : 'AUTO';
    const allowedRefresh: AutoRefreshIntervalSec[] = [0, 30, 60, 120, 300];
    const autoRefreshSec: AutoRefreshIntervalSec = allowedRefresh.includes(
      parsed.autoRefreshSec as AutoRefreshIntervalSec
    )
      ? (parsed.autoRefreshSec as AutoRefreshIntervalSec)
      : 60;

    return {
      language: lang,
      defaultGame: defGame,
      themeEffects: parsed.themeEffects !== false,
      autoRefreshSec,
      autoPostMatchRecap: parsed.autoPostMatchRecap !== false,
    };
  } catch {
    return { ...DEFAULT_APP_SETTINGS };
  }
}

export function saveAppSettings(next: AppUserSettings): AppUserSettings {
  try {
    localStorage.setItem(APP_SETTINGS_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage quota errors
  }
  return next;
}

export function getAllMatchAnnotations(): Record<string, MatchAnnotation> {
  try {
    const raw = localStorage.getItem(ANNOTATIONS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function getMatchAnnotation(matchId: string | null | undefined): MatchAnnotation {
  if (!matchId) return { tags: [], note: '', updatedAt: '' };
  const map = getAllMatchAnnotations();
  return map[matchId] || { tags: [], note: '', updatedAt: '' };
}

export function saveMatchAnnotation(
  matchId: string,
  update: { tags: string[]; note: string }
): MatchAnnotation {
  const map = getAllMatchAnnotations();
  const cleanTags = Array.from(new Set(update.tags.map((t) => t.trim()).filter(Boolean))).slice(
    0,
    8
  );
  const cleanNote = update.note.slice(0, 1000);
  const record: MatchAnnotation = {
    tags: cleanTags,
    note: cleanNote,
    updatedAt: new Date().toISOString(),
  };

  if (cleanTags.length === 0 && !cleanNote.trim()) {
    delete map[matchId];
  } else {
    map[matchId] = record;
  }

  try {
    localStorage.setItem(ANNOTATIONS_KEY, JSON.stringify(map));
  } catch {
    // Ignore quota errors
  }
  return record;
}

export function getMatchBookmarks(matchId: string | null | undefined): ReplayBookmark[] {
  if (!matchId) return [];
  try {
    const raw = localStorage.getItem(`${BOOKMARKS_PREFIX}${matchId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((b) => b && typeof b.timeSec === 'number' && Number.isFinite(b.timeSec))
      .sort((a, b) => a.timeSec - b.timeSec);
  } catch {
    return [];
  }
}

export function saveMatchBookmarks(matchId: string, list: ReplayBookmark[]): ReplayBookmark[] {
  const sorted = [...list].sort((a, b) => a.timeSec - b.timeSec).slice(0, 24);
  try {
    if (sorted.length === 0) {
      localStorage.removeItem(`${BOOKMARKS_PREFIX}${matchId}`);
    } else {
      localStorage.setItem(`${BOOKMARKS_PREFIX}${matchId}`, JSON.stringify(sorted));
    }
  } catch {
    // Ignore quota errors
  }
  return sorted;
}

export interface FullLocalBackupPayload {
  schemaVersion: 1;
  exportedAt: string;
  appSettings: AppUserSettings;
  settingsVault: unknown[];
  matchAnnotations: Record<string, MatchAnnotation>;
  bookmarksByMatch: Record<string, ReplayBookmark[]>;
  telestratorByMatch: Record<string, unknown>;
}

export function exportFullLocalBackup(): string {
  const bookmarksByMatch: Record<string, ReplayBookmark[]> = {};
  const telestratorByMatch: Record<string, unknown> = {};

  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (key.startsWith(BOOKMARKS_PREFIX)) {
        const mId = key.slice(BOOKMARKS_PREFIX.length);
        const val = localStorage.getItem(key);
        if (val) bookmarksByMatch[mId] = JSON.parse(val);
      } else if (key.startsWith(TELESTRATOR_PREFIX)) {
        const mId = key.slice(TELESTRATOR_PREFIX.length);
        const val = localStorage.getItem(key);
        if (val) telestratorByMatch[mId] = JSON.parse(val);
      }
    }
  } catch {
    // Ignore read errors
  }

  let settingsVault: unknown[] = [];
  try {
    const rawVault = localStorage.getItem(SETTINGS_VAULT_KEY);
    if (rawVault) {
      const parsed = JSON.parse(rawVault);
      if (Array.isArray(parsed)) settingsVault = parsed;
    }
  } catch {
    // Ignore
  }

  const payload: FullLocalBackupPayload = {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    appSettings: loadAppSettings(),
    settingsVault,
    matchAnnotations: getAllMatchAnnotations(),
    bookmarksByMatch,
    telestratorByMatch,
  };

  return JSON.stringify(payload, null, 2);
}

export function importFullLocalBackup(rawJson: string): AppUserSettings {
  const parsed = JSON.parse(rawJson) as Partial<FullLocalBackupPayload>;
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid backup JSON format.');
  }

  let restoredSettings = loadAppSettings();
  if (parsed.appSettings && typeof parsed.appSettings === 'object') {
    restoredSettings = saveAppSettings({
      ...DEFAULT_APP_SETTINGS,
      ...parsed.appSettings,
      language: parsed.appSettings.language === 'vi' ? 'vi' : 'en',
    });
  }

  if (Array.isArray(parsed.settingsVault)) {
    localStorage.setItem(SETTINGS_VAULT_KEY, JSON.stringify(parsed.settingsVault));
  }

  if (parsed.matchAnnotations && typeof parsed.matchAnnotations === 'object') {
    localStorage.setItem(ANNOTATIONS_KEY, JSON.stringify(parsed.matchAnnotations));
  }

  if (parsed.bookmarksByMatch && typeof parsed.bookmarksByMatch === 'object') {
    for (const [mId, list] of Object.entries(parsed.bookmarksByMatch)) {
      if (Array.isArray(list)) {
        localStorage.setItem(`${BOOKMARKS_PREFIX}${mId}`, JSON.stringify(list));
      }
    }
  }

  if (parsed.telestratorByMatch && typeof parsed.telestratorByMatch === 'object') {
    for (const [mId, shapes] of Object.entries(parsed.telestratorByMatch)) {
      if (shapes && typeof shapes === 'object') {
        localStorage.setItem(`${TELESTRATOR_PREFIX}${mId}`, JSON.stringify(shapes));
      }
    }
  }

  return restoredSettings;
}

export function playPreviewChime(): void {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc2.type = 'triangle';
    osc1.frequency.setValueAtTime(880, now);
    osc1.frequency.setValueAtTime(1174.66, now + 0.08);
    osc2.frequency.setValueAtTime(1318.51, now + 0.08);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.14, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now + 0.08);
    osc1.stop(now + 0.24);
    osc2.stop(now + 0.24);

    window.setTimeout(() => {
      void ctx.close().catch(() => {});
    }, 350);
  } catch {
    // Ignore audio context restriction
  }
}

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  ArrowRight,
  ArrowsClockwise,
  Broadcast,
  ChartBar,
  Crosshair,
  Flame,
  FolderOpen,
  GearSix,
  Globe,
  LinkSimple,
  MagnifyingGlass,
  NotePencil,
  PushPin,
  Record,
  ShareNetwork,
  ShieldCheck,
  SignOut,
  SlidersHorizontal,
  Strategy,
  TrendDown,
  TrendUp,
  Trophy,
  VideoCamera,
  X,
} from '@phosphor-icons/react';
import { I18nProvider, useI18n } from './i18n';
import {
  AppLanguage,
  AppUserSettings,
  getAllMatchAnnotations,
  loadAppSettings,
  saveAppSettings,
} from './services/appSettings';
import {
  API_BASE_URL,
  AuthProvidersStatus,
  CaptureMode,
  clearAuthToken,
  fetchAuthProviders,
  fetchMatchDetail,
  fetchMyVideos,
  getAuthToken,
  getCaptureMode,
  getLocalVideoByMatchId,
  LocalClipItem,
  PlayerSearchResult,
  pollAuthSession,
  prepareRiotLinkUrl,
  prepareSteamLinkUrl,
  PubgMapTelemetrySummary,
  searchPlayerProfile,
  setAuthToken,
  setCaptureMode,
  syncRealPubgMatches,
  syncRealValorantMatches,
  togglePinMatch,
  unlinkRiotAccount,
  updatePubgProfile,
} from './services/localDb';
import {
  DesktopCaptureStatus,
  desktopRingRecorder,
  matchDesktopHighlightsForMatches,
  ScreenSourceItem,
} from './services/desktopCapture';
import { ReplayPlayer } from './components/ReplayPlayer';
import { AnalyzedRoundUI } from './components/RoundTimeline';
import { MatchReportUI, TacticalReport } from './components/TacticalReport';
import { FriendsLeaderboard } from './components/FriendsLeaderboard';
import { PostMatchRecapToast } from './components/PostMatchRecapToast';
import { MatchTrendModal } from './components/MatchTrendModal';
import { TacticalBoardModal } from './components/TacticalBoardModal';
import { SettingsTabId, UnifiedSettingsModal } from './components/UnifiedSettingsModal';

interface UserProfile {
  id: number;
  riot_game_name: string | null;
  riot_tag_line: string | null;
  has_riot_linked?: boolean;
  steam_id: string | null;
  steam_persona_name: string | null;
  steam_avatar: string | null;
  pubg_account_id: string | null;
  pubg_player_name: string | null;
}

interface SavedMatchItem {
  match_id: string;
  game_type: 'VALORANT' | 'PUBG';
  map_name: string;
  game_mode: string;
  match_result: string;
  score_summary: string | null;
  local_video_filename: string | null;
  cloud_video_url: string | null;
  duration_sec: number;
  played_at: string;
  is_pinned?: boolean;
}

function generateSessionId(): string {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function parseMatchQuickMetrics(v: SavedMatchItem): {
  kills: number;
  isSuccess: boolean;
  isTop1: boolean;
} {
  const res = (v.match_result || '').toUpperCase();
  const sum = v.score_summary || '';

  let kills = 0;
  const pubgKills = sum.match(/(\d+)\s*kills?/i) || res.match(/(\d+)\s*kills?/i);
  const kdaMatch = sum.match(/(\d+)\s*\/\s*\d+\s*\/\s*\d+/);
  const shortKills = sum.match(/\b(\d+)K\b/i);
  if (pubgKills) {
    kills = Number(pubgKills[1]) || 0;
  } else if (kdaMatch) {
    kills = Number(kdaMatch[1]) || 0;
  } else if (shortKills) {
    kills = Number(shortKills[1]) || 0;
  }

  if (v.game_type === 'PUBG') {
    const placeMatch = res.match(/#(\d+)/) || res.match(/TOP\s*(\d+)/i);
    const place = placeMatch ? Number(placeMatch[1]) : 99;
    const isTop1 = place === 1 || res.includes('WIN') || res.includes('THẮNG');
    const isSuccess = isTop1 || (place >= 1 && place <= 10);
    return { kills, isSuccess, isTop1 };
  }

  const isWin = res.includes('WIN') || res.includes('THẮNG') || res.includes('VICTORY');
  return { kills, isSuccess: isWin, isTop1: isWin };
}

const SteamBrandMark: React.FC = () => (
  <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.605 0 11.979 0z" />
  </svg>
);

const RiotBrandMark: React.FC = () => (
  <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12.534 21.77l-1.09-2.81 10.52.54-.451 4.5zM15.06 0L.307 6.969 2.59 17.471H5.6l-.52-7.512.461-.144 1.81 7.656h3.126l-.116-9.15.462-.144 1.582 9.294h3.31l.78-11.053.462-.144.82 11.197h4.376l1.54-15.37Z" />
  </svg>
);

const UpdateBanner: React.FC = () => {
  const { tr } = useI18n();
  const [updateState, setUpdateState] = useState<{
    status: 'idle' | 'available' | 'downloading' | 'downloaded' | 'error';
    version?: string;
    percent?: number;
  }>({ status: 'idle' });

  useEffect(() => {
    const updater = (window as any).electronUpdater;
    if (!updater?.onUpdateStatus) return;
    return updater.onUpdateStatus((data: any) => setUpdateState(data));
  }, []);

  if (updateState.status === 'idle' || updateState.status === 'error') return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-[#10141C] border border-[#10B981]/50 text-[#EEF2F6] px-4 py-3 rounded-[4px] shadow-2xl flex items-center gap-3">
      {updateState.status === 'available' && (
        <>
          <span className="text-xs font-mono">
            {tr('New version', 'Phiên bản mới')}{' '}
            <b className="text-[#10B981]">v{updateState.version}</b>{' '}
            {tr('is ready', 'sẵn sàng')}
          </span>
          <button
            type="button"
            onClick={() => (window as any).electronUpdater?.downloadUpdate()}
            className="bg-[#10B981] hover:bg-emerald-400 text-[#0A0D12] font-bold text-xs px-3 py-1.5 rounded-[2px] transition duration-150 active:translate-y-[1px]"
          >
            {tr('Update Now', 'Cập nhật ngay')}
          </button>
        </>
      )}

      {updateState.status === 'downloading' && (
        <span className="text-xs font-mono text-[#38BDF8] tabular-nums">
          {tr('Downloading update...', 'Đang tải bản cập nhật...')}{' '}
          <b>{updateState.percent ?? 0}%</b>
        </span>
      )}

      {updateState.status === 'downloaded' && (
        <>
          <span className="text-xs font-mono">
            {tr('Update ready to install', 'Tải hoàn tất')}
          </span>
          <button
            type="button"
            onClick={() => (window as any).electronUpdater?.installUpdate()}
            className="bg-[#38BDF8] hover:bg-sky-300 text-[#0A0D12] font-bold text-xs px-3 py-1.5 rounded-[2px] transition duration-150 active:translate-y-[1px]"
          >
            {tr('Restart App', 'Khởi động lại')}
          </button>
        </>
      )}
    </div>
  );
};

const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.8.0';

const AppFooterVersion: React.FC<{
  isElectronRuntime?: boolean;
  onOpenSettings: () => void;
}> = ({ isElectronRuntime = false, onOpenSettings }) => {
  const { tr } = useI18n();
  const [checking, setChecking] = useState(false);
  const [checkNote, setCheckNote] = useState<string | null>(null);

  const handleCheckUpdate = async () => {
    const updater = (window as any).electronUpdater;
    if (!updater?.checkForUpdates) return;
    setChecking(true);
    setCheckNote(tr('Checking for updates...', 'Đang kiểm tra bản mới...'));
    try {
      const res = await updater.checkForUpdates();
      if (res && res.packaged === false) {
        setCheckNote(tr('Running local dev build.', 'Đang chạy bản Dev cục bộ.'));
      } else {
        setCheckNote(tr('Up to date.', 'Đã kiểm tra cập nhật.'));
      }
    } catch {
      setCheckNote(tr('Unable to check updates right now.', 'Không thể kiểm tra cập nhật lúc này.'));
    } finally {
      setChecking(false);
      window.setTimeout(() => setCheckNote(null), 4000);
    }
  };

  return (
    <footer className="border-t border-[#232B3B] bg-[#0A0D12]/90 px-5 py-2 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-[#94A3B8]">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-bold text-[#EEF2F6]">TacticalReplayAI</span>
        <span className="px-1.5 py-0.5 rounded-[2px] bg-[#171D28] border border-[#232B3B] text-[#38BDF8] font-bold tabular-nums">
          v{APP_VERSION}
        </span>
        <span className="text-[#64748B]">
          {isElectronRuntime
            ? 'Desktop App'
            : typeof overwolf !== 'undefined'
              ? 'Overwolf Companion'
              : 'Web Client'}
        </span>
      </div>

      <div className="flex items-center gap-3">
        {checkNote && <span className="text-[#38BDF8]">{checkNote}</span>}
        <button
          type="button"
          onClick={onOpenSettings}
          className="px-2 py-0.5 rounded-[2px] bg-[#171D28] hover:bg-[#232B3B] border border-[#232B3B] text-[#94A3B8] hover:text-[#EEF2F6] transition duration-150"
        >
          {tr('Settings (Ctrl+,)', 'Cài đặt (Ctrl+,)')}
        </button>
        {isElectronRuntime && (window as any).electronUpdater?.checkForUpdates && (
          <button
            type="button"
            disabled={checking}
            onClick={() => void handleCheckUpdate()}
            className="px-2 py-0.5 rounded-[2px] bg-[#171D28] hover:bg-[#232B3B] border border-[#232B3B] text-[#94A3B8] hover:text-[#EEF2F6] disabled:opacity-50 transition duration-150"
          >
            {checking
              ? tr('Checking...', 'Đang kiểm tra...')
              : tr('Check for Updates', 'Kiểm tra cập nhật')}
          </button>
        )}
      </div>
    </footer>
  );
};

const LanguageQuickToggle: React.FC<{
  lang: AppLanguage;
  onChangeLang: (next: AppLanguage) => void;
}> = ({ lang, onChangeLang }) => {
  const { tr } = useI18n();
  return (
    <div
      role="group"
      aria-label={tr('Display language', 'Ngôn ngữ hiển thị')}
      className="inline-flex items-center p-0.5 rounded-[2px] bg-[#0A0D12] border border-[#232B3B] font-mono text-[11px] font-bold"
    >
      <Globe size={13} weight="bold" className="text-[#64748B] ml-1.5 mr-1" aria-hidden="true" />
      <button
        type="button"
        aria-pressed={lang === 'en'}
        onClick={() => onChangeLang('en')}
        className={`px-2 py-0.5 rounded-[2px] transition duration-150 ${
          lang === 'en'
            ? 'bg-[#38BDF8]/20 text-[#38BDF8]'
            : 'text-[#64748B] hover:text-[#EEF2F6]'
        }`}
      >
        EN
      </button>
      <button
        type="button"
        aria-pressed={lang === 'vi'}
        onClick={() => onChangeLang('vi')}
        className={`px-2 py-0.5 rounded-[2px] transition duration-150 ${
          lang === 'vi'
            ? 'bg-[#38BDF8]/20 text-[#38BDF8]'
            : 'text-[#64748B] hover:text-[#EEF2F6]'
        }`}
      >
        VI
      </button>
    </div>
  );
};

interface AppContentProps {
  appSettings: AppUserSettings;
  onUpdateAppSettings: (patch: Partial<AppUserSettings>) => void;
  onReplaceAppSettings: (full: AppUserSettings) => void;
}

const AppContent: React.FC<AppContentProps> = ({
  appSettings,
  onUpdateAppSettings,
  onReplaceAppSettings,
}) => {
  const { lang, setLang, tr, ts, localeCode } = useI18n();
  const reduceMotion = useReducedMotion();

  const initialDefaultGame: 'VALORANT' | 'PUBG' =
    appSettings.defaultGame === 'VALORANT' ? 'VALORANT' : 'PUBG';

  const [token, setTokenState] = useState<string | null>(() => getAuthToken());
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [videos, setVideos] = useState<SavedMatchItem[]>([]);
  const [activeGameTab, setActiveGameTab] = useState<'VALORANT' | 'PUBG'>(initialDefaultGame);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);

  const [rounds, setRounds] = useState<AnalyzedRoundUI[]>([]);
  const [report, setReport] = useState<MatchReportUI | null>(null);
  const [mapTelemetry, setMapTelemetry] = useState<PubgMapTelemetrySummary | null>(null);
  const [matchClips, setMatchClips] = useState<LocalClipItem[]>([]);
  const [selectedRound, setSelectedRound] = useState<number>(1);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);

  const [providers, setProviders] = useState<AuthProvidersStatus>({
    riotRsoReady: true,
    riotApiReady: true,
    steamReady: true,
  });

  const [searchGame, setSearchGame] = useState<'PUBG' | 'VALORANT'>(initialDefaultGame);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<PlayerSearchResult | null>(null);

  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showPostMatchRecap, setShowPostMatchRecap] = useState(false);
  const [showTrendModal, setShowTrendModal] = useState(false);
  const [showUnifiedSettings, setShowUnifiedSettings] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<SettingsTabId>('GENERAL');
  const [dataRevision, setDataRevision] = useState(0);

  const [matchSearchText, setMatchSearchText] = useState('');
  const [matchFilterMode, setMatchFilterMode] = useState<
    'ALL' | 'WINS' | 'CLIPS' | 'PINNED' | 'NOTES'
  >('ALL');

  const [captureMode, setCaptureModeState] = useState<CaptureMode>(() => getCaptureMode());
  const [isElectronRuntime, setIsElectronRuntime] = useState(false);
  const [autoStartEnabled, setAutoStartEnabled] = useState(false);
  const [desktopCaptureStatus, setDesktopCaptureStatus] = useState<DesktopCaptureStatus | null>(
    null
  );
  const [screenSources, setScreenSources] = useState<ScreenSourceItem[]>([]);
  const [compatNeedsRestart, setCompatNeedsRestart] = useState(false);
  const [testingCapture, setTestingCapture] = useState(false);
  const [blackFrameAlert, setBlackFrameAlert] = useState(false);
  const [checkingOverwolf, setCheckingOverwolf] = useState(false);
  const [pubgIgnInput, setPubgIgnInput] = useState('');
  const [savingPubgIgn, setSavingPubgIgn] = useState(false);
  const [unlinkingRiot, setUnlinkingRiot] = useState(false);

  const [loading, setLoading] = useState(false);
  const [autoRefreshing, setAutoRefreshing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [syncingPubg, setSyncingPubg] = useState(false);
  const [syncingValorant, setSyncingValorant] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const videosRef = useRef<SavedMatchItem[]>(videos);
  videosRef.current = videos;
  const activeGameTabRef = useRef(activeGameTab);
  activeGameTabRef.current = activeGameTab;
  const appSettingsRef = useRef(appSettings);
  appSettingsRef.current = appSettings;
  const trRef = useRef(tr);
  trRef.current = tr;
  const localeRef = useRef(localeCode);
  localeRef.current = localeCode;

  const pollIntervalRef = useRef<number | null>(null);
  const isBackgroundSyncingRef = useRef(false);
  const prevActiveGameRef = useRef<'VALORANT' | 'PUBG' | null>(null);
  const autoRefreshTriggerRef = useRef<
    ((showToastOnNew?: boolean, isManual?: boolean) => Promise<void>) | null
  >(null);

  const serverRootUrl = API_BASE_URL.replace(/\/api\/?$/, '');
  const isOverwolfRuntime =
    typeof overwolf !== 'undefined' && Boolean(overwolf.media?.replays || overwolf.streaming);

  const [showTacticalBoard, setShowTacticalBoard] = useState(false);

  const openSettingsAt = useCallback((tab: SettingsTabId = 'GENERAL') => {
    setSettingsInitialTab(tab);
    setShowUnifiedSettings(true);
  }, []);

  useEffect(() => {
    const onGlobalKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === ',') {
        e.preventDefault();
        setSettingsInitialTab('GENERAL');
        setShowUnifiedSettings((prev) => !prev);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setShowTacticalBoard((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onGlobalKey);
    return () => window.removeEventListener('keydown', onGlobalKey);
  }, []);

  const stopAuthPolling = useCallback(() => {
    if (pollIntervalRef.current !== null) {
      window.clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  const applyAuthenticatedToken = useCallback(
    (receivedToken: string) => {
      stopAuthPolling();
      setAuthToken(receivedToken);
      setTokenState(receivedToken);
      setStatusMsg(null);
    },
    [stopAuthPolling]
  );

  useEffect(() => {
    void fetchAuthProviders()
      .then(setProviders)
      .catch(() => {});
    return () => stopAuthPolling();
  }, [stopAuthPolling]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('token');
    const authError = params.get('authError');

    if (urlToken) {
      applyAuthenticatedToken(urlToken);
    } else if (authError) {
      setStatusMsg(authError);
    }

    if (urlToken || authError) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [applyAuthenticatedToken]);

  useEffect(() => {
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI?.onAuthToken) return;
    return electronAPI.onAuthToken((receivedToken: string) => {
      applyAuthenticatedToken(receivedToken);
    });
  }, [applyAuthenticatedToken]);

  useEffect(() => {
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI?.getBackgroundPrefs) return;
    setIsElectronRuntime(true);
    void electronAPI
      .getBackgroundPrefs()
      .then((prefs: { autoStart?: boolean }) => {
        setAutoStartEnabled(Boolean(prefs?.autoStart));
      })
      .catch(() => {});

    const cleanups: Array<() => void> = [];
    if (electronAPI.onBackgroundPrefsChanged) {
      cleanups.push(
        electronAPI.onBackgroundPrefsChanged((prefs: { autoStart?: boolean }) => {
          setAutoStartEnabled(Boolean(prefs?.autoStart));
        })
      );
    }

    let postGameSyncTimer: number | null = null;

    if (electronAPI.getCaptureStatus) {
      void electronAPI
        .getCaptureStatus()
        .then((status: DesktopCaptureStatus) => {
          prevActiveGameRef.current = status.activeGame;
          setDesktopCaptureStatus(status);
          void desktopRingRecorder.ensureState(status);
        })
        .catch(() => {});
    }

    if (electronAPI.listScreens) {
      void electronAPI
        .listScreens()
        .then((list: ScreenSourceItem[]) => {
          if (Array.isArray(list)) setScreenSources(list);
        })
        .catch(() => {});
    }

    if (electronAPI.onCaptureStateChanged) {
      cleanups.push(
        electronAPI.onCaptureStateChanged((status: DesktopCaptureStatus) => {
          const prevGame = prevActiveGameRef.current;
          prevActiveGameRef.current = status.activeGame;
          setDesktopCaptureStatus(status);
          if (status.shouldRecord) setBlackFrameAlert(false);
          void desktopRingRecorder.ensureState(status);

          if (prevGame && !status.activeGame) {
            if (postGameSyncTimer !== null) window.clearTimeout(postGameSyncTimer);
            postGameSyncTimer = window.setTimeout(() => {
              void autoRefreshTriggerRef.current?.(true, false);
            }, 10000);
          }
        })
      );
    }

    desktopRingRecorder.setOnF9Saved((clip) => {
      setStatusMsg(
        trRef.current(
          `Saved Highlight clip: ${clip.fileName} (auto-attaches on next match sync).`,
          `Đã cắt Highlight: ${clip.fileName} (tự động ghép vào trận khi đồng bộ xong).`
        )
      );
    });

    desktopRingRecorder.setOnBlackScreen(() => {
      setBlackFrameAlert(true);
      setStatusMsg(
        trRef.current(
          'Black frame detected while recording Fullscreen. Click "Fix Fullscreen Black Frame" in the left panel or Settings -> Capture.',
          'Phát hiện khung hình quay bị đen khi chơi Fullscreen. Bấm nút sửa lỗi đen hình ở cột trái để khắc phục.'
        )
      );
    });

    if (electronAPI.onHotkeyHighlight) {
      cleanups.push(
        electronAPI.onHotkeyHighlight(() => {
          void desktopRingRecorder.triggerF9Highlight(activeGameTabRef.current);
        })
      );
    }

    return () => {
      if (postGameSyncTimer !== null) window.clearTimeout(postGameSyncTimer);
      desktopRingRecorder.setOnF9Saved(null);
      desktopRingRecorder.setOnBlackScreen(null);
      void desktopRingRecorder.stop();
      for (const fn of cleanups) fn();
    };
  }, []);

  const resetSelection = useCallback(() => {
    setSelectedMatchId(null);
    setRounds([]);
    setReport(null);
    setMapTelemetry(null);
    setMatchClips([]);
    setSelectedRound(1);
    setVideoSrc(null);
  }, []);

  const handleSelectMatch = useCallback(async (match: SavedMatchItem) => {
    setSelectedMatchId(match.match_id);
    setSelectedRound(1);
    setMapTelemetry(null);

    const localRec = getLocalVideoByMatchId(match.match_id);
    setMatchClips(localRec?.clips || []);
    if (localRec?.videoUrl) {
      setVideoSrc(localRec.videoUrl);
    } else if (localRec?.filePath) {
      setVideoSrc(`file:///${localRec.filePath.replace(/\\/g, '/')}`);
    } else if (match.cloud_video_url) {
      setVideoSrc(match.cloud_video_url);
    } else {
      setVideoSrc(null);
    }

    try {
      const detail = await fetchMatchDetail(match.match_id);
      setRounds(detail.rounds || []);
      setReport(detail.report || null);
      setMapTelemetry(detail.mapTelemetry || null);
      if (detail.rounds?.length > 0) {
        setSelectedRound(detail.rounds[0].roundNumber);
      }
    } catch (err: any) {
      setStatusMsg(
        err.message ||
          trRef.current(
            'Failed to load match telemetry details.',
            'Lỗi tải chi tiết phân tích trận đấu.'
          )
      );
    }
  }, []);

  const loadUserVideos = useCallback(
    async (preferredTab?: 'VALORANT' | 'PUBG') => {
      setLoading(true);
      try {
        const data = await fetchMyVideos();
        const loadedProfile: UserProfile | null = data.profile || null;
        const loadedVideos: SavedMatchItem[] = data.videos || [];

        setProfile(loadedProfile);
        setVideos(loadedVideos);

        let targetTab = preferredTab || activeGameTabRef.current;
        if (!preferredTab) {
          const prefDefault = appSettingsRef.current.defaultGame;
          if (prefDefault === 'VALORANT' || prefDefault === 'PUBG') {
            targetTab = prefDefault;
            setActiveGameTab(prefDefault);
          } else if (loadedProfile) {
            const hasRiot = Boolean(loadedProfile.has_riot_linked || loadedProfile.riot_game_name);
            const hasPubg = Boolean(loadedProfile.steam_id || loadedProfile.pubg_player_name);
            if (hasRiot && !hasPubg) {
              targetTab = 'VALORANT';
              setActiveGameTab('VALORANT');
            } else if (hasPubg && !hasRiot) {
              targetTab = 'PUBG';
              setActiveGameTab('PUBG');
            }
          }
        }

        const tabMatches = loadedVideos.filter((v) => v.game_type === targetTab);
        const newlyMatchedIds = await matchDesktopHighlightsForMatches(tabMatches).catch(
          () => [] as string[]
        );
        if (newlyMatchedIds.length > 0) {
          setVideos((prev) => [...prev]);
        }

        if (tabMatches.length > 0) {
          await handleSelectMatch(tabMatches[0]);
          if (newlyMatchedIds.length > 0) {
            setStatusMsg(
              trRef.current(
                `Auto-trimmed and linked Highlight clips for ${newlyMatchedIds.length} recent match(es).`,
                `Đã tự động cắt và gắn clip Highlight cho ${newlyMatchedIds.length} trận vừa xong.`
              )
            );
          }
        } else {
          resetSelection();
        }
      } catch (err: any) {
        setStatusMsg(
          err.message ||
            trRef.current('Unable to load saved matches.', 'Không thể tải danh sách trận đấu.')
        );
      } finally {
        setLoading(false);
      }
    },
    [handleSelectMatch, resetSelection]
  );

  useEffect(() => {
    setPubgIgnInput(profile?.pubg_player_name || '');
  }, [profile?.pubg_player_name]);

  useEffect(() => {
    if (!token) return;
    void loadUserVideos();
  }, [token, loadUserVideos]);

  useEffect(() => {
    if (!token) {
      autoRefreshTriggerRef.current = null;
      return;
    }

    const syncAndCheckMatches = async (showToastOnNew = true, isManual = false) => {
      if (isBackgroundSyncingRef.current) return;
      isBackgroundSyncingRef.current = true;
      setAutoRefreshing(true);

      try {
        const currentTab = activeGameTabRef.current;

        if (
          currentTab === 'PUBG' &&
          (profile?.pubg_player_name || profile?.steam_persona_name)
        ) {
          const res = await syncRealPubgMatches();
          if (res.syncedCount > 0) {
            await loadUserVideos('PUBG');
            if (showToastOnNew) {
              setStatusMsg(
                trRef.current(
                  `Synced ${res.syncedCount} new PUBG match(es).`,
                  res.message
                )
              );
              if (appSettingsRef.current.autoPostMatchRecap) {
                setShowPostMatchRecap(true);
              }
            }
            setLastSyncedAt(new Date().toLocaleTimeString(localeRef.current, { hour12: false }));
            return;
          }
        } else if (
          currentTab === 'VALORANT' &&
          profile?.has_riot_linked &&
          providers.riotApiReady
        ) {
          const res = await syncRealValorantMatches();
          if (res.syncedCount > 0) {
            await loadUserVideos('VALORANT');
            if (showToastOnNew) {
              setStatusMsg(
                trRef.current(
                  `Synced ${res.syncedCount} new VALORANT match(es).`,
                  res.message
                )
              );
              if (appSettingsRef.current.autoPostMatchRecap) {
                setShowPostMatchRecap(true);
              }
            }
            setLastSyncedAt(new Date().toLocaleTimeString(localeRef.current, { hour12: false }));
            return;
          }
        }

        const latest = await fetchMyVideos();
        const latestList: SavedMatchItem[] = latest.videos || [];
        const currentList = videosRef.current;

        const currentTabList = currentList.filter((v) => v.game_type === currentTab);
        const latestTabList = latestList.filter((v) => v.game_type === currentTab);

        const hasNewTopInTab =
          latestTabList.length > 0 &&
          (currentTabList.length === 0 ||
            latestTabList[0].match_id !== currentTabList[0].match_id);

        if (hasNewTopInTab) {
          await matchDesktopHighlightsForMatches(latestTabList).catch(() => []);
          setVideos(latestList);
          await handleSelectMatch(latestTabList[0]);
          if (showToastOnNew) {
            setStatusMsg(
              trRef.current(
                `New ${currentTab} match detected; refreshed latest 20-match history.`,
                `Phát hiện trận ${currentTab} mới, đã tự động làm mới lịch sử 20 trận gần nhất.`
              )
            );
            if (appSettingsRef.current.autoPostMatchRecap) {
              setShowPostMatchRecap(true);
            }
          }
        } else {
          const matchedIds =
            latestTabList.length > 0
              ? await matchDesktopHighlightsForMatches(latestTabList).catch(() => [] as string[])
              : [];

          const totalChanged =
            latestList.length !== currentList.length ||
            latestTabList.length !== currentTabList.length ||
            latestTabList.some(
              (m, idx) => m.cloud_video_url !== currentTabList[idx]?.cloud_video_url
            );

          if (matchedIds.length > 0 || totalChanged) {
            setVideos([...latestList]);
            if (
              latestTabList[0] &&
              (matchedIds.includes(latestTabList[0].match_id) || isManual)
            ) {
              await handleSelectMatch(latestTabList[0]);
            }
          } else if (isManual && latestTabList.length > 0) {
            setStatusMsg(
              trRef.current(
                `Latest 20 ${currentTab} matches are already up to date.`,
                `Lịch sử 20 trận ${currentTab} đã là mới nhất.`
              )
            );
          }
        }

        setLastSyncedAt(new Date().toLocaleTimeString(localeRef.current, { hour12: false }));
      } catch (err: any) {
        if (isManual) {
          setStatusMsg(
            err?.message ||
              trRef.current(
                'Unable to sync match history right now.',
                'Không thể đồng bộ lịch sử trận đấu lúc này.'
              )
          );
        }
      } finally {
        isBackgroundSyncingRef.current = false;
        setAutoRefreshing(false);
      }
    };

    autoRefreshTriggerRef.current = syncAndCheckMatches;

    const initialTimer = window.setTimeout(() => {
      void syncAndCheckMatches(false, false);
    }, 2000);

    let intervalTimer: number | null = null;
    if (appSettings.autoRefreshSec > 0) {
      intervalTimer = window.setInterval(() => {
        void syncAndCheckMatches(true, false);
      }, appSettings.autoRefreshSec * 1000);
    }

    return () => {
      window.clearTimeout(initialTimer);
      if (intervalTimer !== null) {
        window.clearInterval(intervalTimer);
      }
    };
  }, [
    token,
    activeGameTab,
    appSettings.autoRefreshSec,
    profile?.pubg_player_name,
    profile?.steam_persona_name,
    profile?.has_riot_linked,
    providers.riotApiReady,
    loadUserVideos,
    handleSelectMatch,
  ]);

  const handleSwitchGameTab = async (tab: 'VALORANT' | 'PUBG') => {
    if (tab === activeGameTab) return;
    setActiveGameTab(tab);
    setStatusMsg(null);

    const tabMatches = videos.filter((v) => v.game_type === tab);
    if (tabMatches.length > 0) {
      await handleSelectMatch(tabMatches[0]);
    } else {
      resetSelection();
    }
  };

  const handleLandingSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearching(true);
    setStatusMsg(null);
    setSearchResult(null);

    try {
      const result = await searchPlayerProfile(searchGame, searchQuery.trim());
      setSearchResult(result);
    } catch (err: any) {
      setStatusMsg(
        err.message || tr('Player profile not found.', 'Không tìm thấy người chơi này.')
      );
    } finally {
      setSearching(false);
    }
  };

  const getClientReturnConfig = () => {
    const isElectronApp =
      window.location.protocol === 'file:' || Boolean((window as any).electronAPI);
    const isOverwolfApp =
      typeof overwolf !== 'undefined' && Boolean(overwolf.utils?.openUrlInDefaultBrowser);

    if (isElectronApp) {
      return { mode: 'electron' as const, returnTo: 'electron', sessionId: generateSessionId() };
    }
    if (isOverwolfApp) {
      return { mode: 'overwolf' as const, returnTo: 'poll', sessionId: generateSessionId() };
    }
    return {
      mode: 'web' as const,
      returnTo: window.location.href.split('?')[0],
      sessionId: undefined,
    };
  };

  const startSessionPolling = (sessionId: string) => {
    stopAuthPolling();
    const startedAt = Date.now();
    pollIntervalRef.current = window.setInterval(async () => {
      if (Date.now() - startedAt > 3 * 60 * 1000) {
        stopAuthPolling();
        return;
      }
      try {
        const state = await pollAuthSession(sessionId);
        if (state.status === 'completed' && state.token) {
          applyAuthenticatedToken(state.token);
        } else if (state.status === 'error' && state.error) {
          stopAuthPolling();
          setStatusMsg(state.error);
        }
      } catch {
        // Ignore transient network errors while user completes sign-in in browser
      }
    }, 2000);
  };

  const openAuthFlow = (
    authUrl: string,
    mode: 'electron' | 'overwolf' | 'web',
    sessionId?: string
  ) => {
    const electronAPI = (window as any).electronAPI;
    if (mode === 'electron' && electronAPI?.openExternal) {
      if (sessionId) startSessionPolling(sessionId);
      void electronAPI.openExternal(authUrl);
      setStatusMsg(
        tr(
          'Opened sign-in page in your browser. Complete authentication to return automatically.',
          'Đã mở trang đăng nhập trên trình duyệt. Hoàn tất xác thực để tự động quay lại ứng dụng.'
        )
      );
      return;
    }

    if (
      mode === 'overwolf' &&
      typeof overwolf !== 'undefined' &&
      overwolf.utils?.openUrlInDefaultBrowser
    ) {
      if (sessionId) startSessionPolling(sessionId);
      overwolf.utils.openUrlInDefaultBrowser(authUrl);
      setStatusMsg(
        tr(
          'Opened default browser for account sign-in. The app will sign in automatically once completed.',
          'Đã mở trình duyệt mặc định để xác thực tài khoản. Ứng dụng sẽ tự động đăng nhập sau khi hoàn tất.'
        )
      );
      return;
    }

    window.location.href = authUrl;
  };

  const handleSteamLogin = () => {
    const { mode, returnTo, sessionId } = getClientReturnConfig();
    const params = new URLSearchParams({ returnTo });
    if (sessionId) params.set('sessionId', sessionId);
    openAuthFlow(`${API_BASE_URL}/auth/steam/login?${params.toString()}`, mode, sessionId);
  };

  const handleRiotLogin = (forceLoginPrompt = false) => {
    if (!providers.riotRsoReady) {
      setStatusMsg(
        tr(
          'Riot Sign On (RSO) is awaiting official RIOT_CLIENT_ID & RIOT_CLIENT_SECRET approval from Riot Developer Portal.',
          'Riot Sign On (RSO) chưa sẵn sàng vì máy chủ đang chờ RIOT_CLIENT_ID & RIOT_CLIENT_SECRET chính thức từ Riot Developer Portal.'
        )
      );
      return;
    }

    const { mode, returnTo, sessionId } = getClientReturnConfig();
    const params = new URLSearchParams({ returnTo });
    if (sessionId) params.set('sessionId', sessionId);
    if (forceLoginPrompt) params.set('prompt', 'login');
    openAuthFlow(`${API_BASE_URL}/auth/riot/login?${params.toString()}`, mode, sessionId);
  };

  const handleLinkRiotAccount = async () => {
    setStatusMsg(null);
    const { mode, returnTo, sessionId } = getClientReturnConfig();
    try {
      const { authUrl } = await prepareRiotLinkUrl({ returnTo, sessionId });
      openAuthFlow(authUrl, mode, sessionId);
    } catch (err: any) {
      setStatusMsg(
        err.message ||
          tr('Unable to start Riot Sign On linking.', 'Không thể khởi tạo liên kết Riot Sign On.')
      );
    }
  };

  const handleLinkSteamAccount = async () => {
    setStatusMsg(null);
    const { mode, returnTo, sessionId } = getClientReturnConfig();
    try {
      const { authUrl } = await prepareSteamLinkUrl({ returnTo, sessionId });
      openAuthFlow(authUrl, mode, sessionId);
    } catch (err: any) {
      setStatusMsg(
        err.message ||
          tr('Unable to start Steam OpenID linking.', 'Không thể khởi tạo liên kết Steam.')
      );
    }
  };

  const handleSyncPubg = async () => {
    setSyncingPubg(true);
    setStatusMsg(null);
    try {
      const res = await syncRealPubgMatches();
      setStatusMsg(
        tr(
          res.syncedCount > 0
            ? `Synced ${res.syncedCount} new PUBG match(es).`
            : 'Latest 20 PUBG matches are already synced.',
          res.message
        )
      );
      await loadUserVideos('PUBG');
    } catch (err: any) {
      setStatusMsg(
        err.message || tr('Failed to sync PUBG matches.', 'Không thể đồng bộ trận PUBG.')
      );
    } finally {
      setSyncingPubg(false);
    }
  };

  const handleSyncValorant = async () => {
    setSyncingValorant(true);
    setStatusMsg(null);
    try {
      const res = await syncRealValorantMatches();
      setStatusMsg(
        tr(
          res.syncedCount > 0
            ? `Synced ${res.syncedCount} new VALORANT match(es).`
            : 'Latest 20 VALORANT matches are already synced.',
          res.message
        )
      );
      await loadUserVideos('VALORANT');
    } catch (err: any) {
      setStatusMsg(
        err.message ||
          tr('Failed to sync VALORANT matches.', 'Không thể đồng bộ trận VALORANT.')
      );
    } finally {
      setSyncingValorant(false);
    }
  };

  const handleCopyShareLink = async (matchId: string) => {
    const shareUrl = `${API_BASE_URL}/analyze/public-match/${encodeURIComponent(matchId)}`;
    await navigator.clipboard.writeText(shareUrl);
    setStatusMsg(
      tr(
        `Copied public match share link: ${shareUrl}`,
        `Đã sao chép link chia sẻ trận đấu: ${shareUrl}`
      )
    );
  };

  const handleToggleCaptureMode = (nextMode: CaptureMode) => {
    setCaptureMode(nextMode);
    setCaptureModeState(nextMode);
    setStatusMsg(
      nextMode === 'HIGHLIGHT_CLIPS'
        ? tr(
            'Switched to Highlight Clips (~23s around kills & hotkeys to save disk space).',
            'Đã chuyển sang chế độ Highlight (~23s quanh mỗi mạng hạ gục, tiết kiệm ổ cứng).'
          )
        : tr(
            'Switched to Full Match Replay mode.',
            'Đã chuyển sang chế độ Quay cả trận (Full Match Replay).'
          )
    );
  };

  const handleToggleAutoStart = async () => {
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI?.setAutoStart) return;
    const nextVal = !autoStartEnabled;
    try {
      const res = await electronAPI.setAutoStart(nextVal);
      const confirmed = Boolean(res?.autoStart);
      setAutoStartEnabled(confirmed);
      setStatusMsg(
        confirmed
          ? tr(
              'Enabled Launch at Windows Startup (runs quietly in System Tray).',
              'Đã bật tự động chạy ngầm cùng Windows ở khay hệ thống (System Tray).'
            )
          : tr(
              'Disabled Launch at Windows Startup.',
              'Đã tắt tự động khởi động cùng Windows.'
            )
      );
    } catch {
      setStatusMsg(
        tr(
          'Unable to update Windows Startup preference.',
          'Không thể thay đổi thiết lập khởi động cùng Windows.'
        )
      );
    }
  };

  const handleToggleDesktopCapture = async () => {
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI?.setDesktopCaptureEnabled) return;
    const nextVal = !(desktopCaptureStatus?.desktopCaptureEnabled ?? true);
    try {
      const res = await electronAPI.setDesktopCaptureEnabled(nextVal);
      if (res?.status) {
        setDesktopCaptureStatus(res.status);
        await desktopRingRecorder.ensureState(res.status);
      }
      setStatusMsg(
        nextVal
          ? tr(
              'Enabled Desktop Auto-Highlight Capture when VALORANT or PUBG is running.',
              'Đã bật Tự quay Highlight ngầm (.exe) khi vào VALORANT hoặc PUBG.'
            )
          : tr(
              'Paused Desktop Auto-Highlight Capture.',
              'Đã tạm tắt Tự quay Highlight trong .exe.'
            )
      );
    } catch {
      setStatusMsg(
        tr('Unable to toggle Desktop Capture state.', 'Không thể thay đổi trạng thái quay Highlight.')
      );
    }
  };

  const handleCheckOverwolf = async () => {
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI?.checkOverwolfInstalled) return;
    setCheckingOverwolf(true);
    try {
      const res = await electronAPI.checkOverwolfInstalled();
      setStatusMsg(
        res?.installed
          ? tr(
              'Overwolf detected on this PC! Hardware Game Events kill capture is available.',
              'Đã phát hiện Overwolf trên máy! Bạn có thể dùng Overwolf để bắt kill trực tiếp.'
            )
          : tr(
              'Overwolf not detected. Using built-in Desktop Auto-Clip + Hotkey recorder.',
              'Chưa phát hiện Overwolf. Ứng dụng đang dùng bộ quay Desktop Auto-Clip tích hợp sẵn.'
            )
      );
    } finally {
      setCheckingOverwolf(false);
    }
  };

  const handleOpenOverwolfDownload = () => {
    const electronAPI = (window as any).electronAPI;
    if (electronAPI?.openOverwolfDownload) {
      void electronAPI.openOverwolfDownload();
    } else {
      window.open('https://www.overwolf.com/', '_blank', 'noreferrer');
    }
  };

  const handleUpdateCaptureOptions = async (next: {
    captureCompatMode?: 'wgc' | 'dxgi';
    captureQuality?: '720p30' | '1080p60';
    preferredScreenId?: string | null;
    hotkey?: string;
    micEnabled?: boolean;
    beepEnabled?: boolean;
    maxStorageGb?: number;
  }) => {
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI?.setCaptureOptions) return;
    try {
      const res = await electronAPI.setCaptureOptions(next);
      if (res?.status) {
        setDesktopCaptureStatus(res.status);
        await desktopRingRecorder.ensureState(res.status);
      }
      if (res?.requiresRestart) {
        if (electronAPI.relaunchApp) {
          await electronAPI.relaunchApp();
          return;
        }
        setCompatNeedsRestart(true);
        setStatusMsg(
          tr(
            'Updated Fullscreen compatibility mode. Restart the app to apply immediately.',
            'Đã đổi chế độ tương thích Fullscreen. Hãy mở lại ứng dụng để áp dụng ngay.'
          )
        );
      } else if (next.captureQuality) {
        setStatusMsg(
          next.captureQuality === '720p30'
            ? tr(
                'Selected 720p 30fps (recommended for zero in-game FPS drop).',
                'Đã chọn chất lượng 720p 30fps (tối ưu giữ nguyên FPS khi bắn Fullscreen).'
              )
            : tr('Selected 1080p 60fps capture quality.', 'Đã chọn chất lượng 1080p 60fps.')
        );
      } else if (next.hotkey) {
        setStatusMsg(
          tr(
            `Updated instant Highlight hotkey to ${next.hotkey}.`,
            `Đã đổi phím cắt Highlight nhanh sang ${next.hotkey}.`
          )
        );
      } else if (typeof next.micEnabled === 'boolean') {
        setStatusMsg(
          next.micEnabled
            ? tr(
                'Enabled Microphone voice capture alongside game audio.',
                'Đã BẬT thu tiếng Micro cùng âm thanh game.'
              )
            : tr('Muted Microphone capture.', 'Đã TẮT thu tiếng Micro khi quay.')
        );
      } else if (typeof next.beepEnabled === 'boolean') {
        setStatusMsg(
          next.beepEnabled
            ? tr(
                'Enabled audio confirmation chime when saving a Highlight.',
                'Đã BẬT âm báo xác nhận khi cắt Highlight.'
              )
            : tr('Disabled audio confirmation chime.', 'Đã TẮT âm báo Beep.')
        );
      } else if (typeof next.maxStorageGb === 'number') {
        setStatusMsg(
          tr(
            `Set local clip storage cap to ${next.maxStorageGb} GB.`,
            `Đã đặt giới hạn kho clip cục bộ tối đa ${next.maxStorageGb} GB.`
          )
        );
      }
    } catch {
      setStatusMsg(
        tr('Failed to update capture options.', 'Không thể cập nhật tùy chọn quay màn hình.')
      );
    }
  };

  const handleTogglePinMatch = async (match: SavedMatchItem) => {
    const nextPinned = !Boolean(match.is_pinned);
    setVideos((prev) =>
      prev.map((m) => (m.match_id === match.match_id ? { ...m, is_pinned: nextPinned } : m))
    );
    try {
      const res = await togglePinMatch(match.match_id, nextPinned);
      setVideos((prev) =>
        prev.map((m) => (m.match_id === match.match_id ? { ...m, is_pinned: res.isPinned } : m))
      );
      setStatusMsg(
        res.isPinned
          ? tr(
              `Pinned ${match.map_name}. This match and its clips are protected from 20-match auto-cleanup.`,
              `Đã ghim trận ${match.map_name}. Trận này và clip sẽ được giữ lại, không bị xóa khi vượt 20 trận.`
            )
          : tr(`Unpinned ${match.map_name}.`, `Đã bỏ ghim trận ${match.map_name}.`)
      );
    } catch (err: any) {
      setVideos((prev) =>
        prev.map((m) => (m.match_id === match.match_id ? { ...m, is_pinned: !nextPinned } : m))
      );
      setStatusMsg(
        err?.message ||
          tr('Unable to update match pin status.', 'Không thể cập nhật trạng thái ghim trận.')
      );
    }
  };

  const handleOpenHighlightsFolder = () => {
    const electronAPI = (window as any).electronAPI;
    if (electronAPI?.openHighlightsFolder) {
      void electronAPI.openHighlightsFolder();
    } else {
      openSettingsAt('STORAGE');
    }
  };

  const handleTestCaptureFrame = async () => {
    setTestingCapture(true);
    setStatusMsg(null);
    try {
      const res = await desktopRingRecorder.testCaptureHealth();
      if (!res.ok) {
        setBlackFrameAlert(res.isBlack);
        setStatusMsg(
          res.isBlack
            ? tr(
                'Test frame is BLACK due to Fullscreen mode. Click the compatibility fix button to resolve.',
                'Khung hình kiểm tra bị ĐEN do Fullscreen. Bấm nút sửa lỗi để chuyển chế độ tương thích.'
              )
            : tr(
                'Could not capture screen stream. Check Windows display capture permissions.',
                'Không lấy được luồng màn hình. Kiểm tra quyền quay màn hình Windows.'
              )
        );
      } else {
        setBlackFrameAlert(false);
        setStatusMsg(
          tr(
            `Capture Test OK (${res.width}x${res.height}): Clean video signal verified!`,
            `Kiểm tra OK (${res.width}x${res.height}): Đang bắt được hình ảnh rõ nét!`
          )
        );
      }
    } finally {
      setTestingCapture(false);
    }
  };

  const handleSavePubgIgn = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = pubgIgnInput.trim();
    if (!trimmed) {
      setStatusMsg(
        tr(
          'Please enter your exact PUBG In-Game Name (IGN).',
          'Vui lòng nhập chính xác In-Game Name (IGN) PUBG của bạn.'
        )
      );
      return;
    }

    setSavingPubgIgn(true);
    setStatusMsg(null);
    try {
      const res = await updatePubgProfile(trimmed);
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              pubg_player_name: res.pubg_player_name,
              pubg_account_id: res.pubg_account_id,
            }
          : prev
      );
      setStatusMsg(
        tr(`Verified PUBG IGN: ${res.pubg_player_name}`, res.message)
      );
      await loadUserVideos('PUBG');
    } catch (err: any) {
      setStatusMsg(
        err.message || tr('Unable to verify PUBG IGN.', 'Không thể xác minh IGN PUBG.')
      );
    } finally {
      setSavingPubgIgn(false);
    }
  };

  const handleUnlinkRiot = async () => {
    setUnlinkingRiot(true);
    setStatusMsg(null);
    try {
      const res = await unlinkRiotAccount();
      setAuthToken(res.token);
      setTokenState(res.token);
      setStatusMsg(tr('Unlinked Riot account.', res.message));
      await loadUserVideos(activeGameTab);
    } catch (err: any) {
      setStatusMsg(
        err.message ||
          tr('Unable to unlink Riot account.', 'Không thể hủy liên kết tài khoản Riot.')
      );
    } finally {
      setUnlinkingRiot(false);
    }
  };

  const handleLogout = () => {
    stopAuthPolling();
    clearAuthToken();
    setTokenState(null);
    setProfile(null);
    setVideos([]);
    resetSelection();
  };

  const annotationsMap = useMemo(() => getAllMatchAnnotations(), [dataRevision, selectedMatchId]);

  const tabBaseVideos = useMemo(
    () => videos.filter((v) => v.game_type === activeGameTab),
    [videos, activeGameTab]
  );

  const sessionForm = useMemo(() => {
    if (tabBaseVideos.length === 0) return null;
    const recent = tabBaseVideos.slice(0, 5);
    const older = tabBaseVideos.slice(5, 20);
    const recentMetrics = recent.map(parseMatchQuickMetrics);
    const olderMetrics = older.map(parseMatchQuickMetrics);

    const recentSuccessRate = Math.round(
      (recentMetrics.filter((m) => m.isSuccess).length / recent.length) * 100
    );
    const recentTop1Count = recentMetrics.filter((m) => m.isTop1).length;
    const recentAvgKills =
      Math.round(
        (recentMetrics.reduce((acc, m) => acc + m.kills, 0) / recent.length) * 10
      ) / 10;

    const olderAvgKills =
      olderMetrics.length > 0
        ? olderMetrics.reduce((acc, m) => acc + m.kills, 0) / olderMetrics.length
        : recentAvgKills;
    const killsDelta = Math.round((recentAvgKills - olderAvgKills) * 10) / 10;

    return {
      count: recent.length,
      recentSuccessRate,
      recentTop1Count,
      recentAvgKills,
      killsDelta,
      pills: recentMetrics.map((m) => m.isSuccess),
    };
  }, [tabBaseVideos]);

  const sharedSettingsModal = (
    <UnifiedSettingsModal
      isOpen={showUnifiedSettings}
      initialTab={settingsInitialTab}
      activeGameTab={token ? activeGameTab : searchGame}
      appVersion={APP_VERSION}
      appSettings={appSettings}
      onUpdateAppSettings={onUpdateAppSettings}
      onSwitchGameThemePreview={(g) => {
        if (token) {
          void handleSwitchGameTab(g);
        } else {
          setSearchGame(g);
        }
      }}
      isElectronRuntime={isElectronRuntime}
      isOverwolfRuntime={isOverwolfRuntime}
      captureMode={captureMode}
      onToggleCaptureMode={handleToggleCaptureMode}
      autoStartEnabled={autoStartEnabled}
      onToggleAutoStart={handleToggleAutoStart}
      captureStatus={desktopCaptureStatus}
      screenSources={screenSources}
      onToggleDesktopCapture={handleToggleDesktopCapture}
      onUpdateCaptureOptions={handleUpdateCaptureOptions}
      testingCapture={testingCapture}
      onTestCaptureFrame={handleTestCaptureFrame}
      checkingOverwolf={checkingOverwolf}
      onCheckOverwolf={handleCheckOverwolf}
      onOpenOverwolfDownload={handleOpenOverwolfDownload}
      pinnedMatchIds={videos.filter((v) => v.is_pinned).map((v) => v.match_id)}
      profile={profile}
      pubgIgnInput={pubgIgnInput}
      onChangePubgIgnInput={setPubgIgnInput}
      savingPubgIgn={savingPubgIgn}
      onSavePubgIgn={handleSavePubgIgn}
      onLinkSteam={handleLinkSteamAccount}
      onLinkRiot={handleLinkRiotAccount}
      onSwitchRiotAccount={() => handleRiotLogin(true)}
      unlinkingRiot={unlinkingRiot}
      onUnlinkRiot={handleUnlinkRiot}
      onBackupRestored={(restored) => {
        onReplaceAppSettings(restored);
        setDataRevision((r) => r + 1);
      }}
      onClose={() => setShowUnifiedSettings(false)}
    />
  );

  // ==========================================================================
  // 1. PRE-LOGIN LANDING (DYNAMIC GAME THEME + BILINGUAL EN DEFAULT)
  // ==========================================================================
  if (!token) {
    const landingValo = searchGame === 'VALORANT';

    return (
      <div
        data-game-theme={landingValo ? 'valorant' : 'pubg'}
        className={`min-h-[100dvh] game-theme-backdrop ${
          appSettings.themeEffects ? 'theme-fx-on' : 'tactical-grid-bg'
        } text-[#EEF2F6] flex flex-col`}
      >
        {/* Dynamic Game Theme Top Ribbon */}
        <div
          className={`h-[3px] w-full transition-colors duration-300 ${
            landingValo
              ? 'bg-gradient-to-r from-[#FF4655] via-[#FF4655]/80 to-[#38BDF8]'
              : 'bg-gradient-to-r from-[#E59A23] via-[#E59A23]/80 to-[#10B981]'
          }`}
        />

        <header className="h-16 border-b border-[#232B3B] bg-[#0A0D12]/90 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto h-full px-6 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className={`h-8 w-8 rounded-[2px] flex items-center justify-center font-display font-bold text-sm transition-colors duration-200 ${
                  landingValo
                    ? 'bg-[#FF4655] text-[#EEF2F6] theme-cut-valo'
                    : 'bg-[#E59A23] text-[#0A0D12]'
                }`}
              >
                TR
              </div>
              <span className="font-display text-lg font-bold tracking-tight text-[#EEF2F6]">
                TacticalReplay
                <span className={landingValo ? 'text-[#FF4655]' : 'text-[#E59A23]'}>AI</span>
              </span>
            </div>

            <div className="flex items-center gap-3">
              <nav
                aria-label={tr('Legal and compliance links', 'Pháp lý và tuân thủ')}
                className="hidden md:flex items-center gap-4 text-xs text-[#94A3B8]"
              >
                <a
                  href={`${serverRootUrl}/privacy`}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-[#EEF2F6] transition duration-150"
                >
                  {tr('Privacy Policy', 'Chính sách bảo mật')}
                </a>
                <a
                  href={`${serverRootUrl}/terms`}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-[#EEF2F6] transition duration-150"
                >
                  {tr('Terms of Service', 'Điều khoản')}
                </a>
              </nav>

              <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[2px] bg-[#10B981]/10 border border-[#10B981]/30 font-mono text-[11px] font-bold text-[#10B981]">
                <ShieldCheck size={14} weight="bold" aria-hidden="true" />
                <span>{tr('Vanguard & BattlEye Safe', 'Tuân thủ Vanguard & BattlEye')}</span>
              </span>

              <LanguageQuickToggle lang={lang} onChangeLang={setLang} />

              <button
                type="button"
                onClick={() => setShowTacticalBoard(true)}
                title={tr('2D Strategy Board (Ctrl+B)', 'Sa bàn chiến thuật 2D (Ctrl+B)')}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[2px] bg-[#171D28] hover:bg-[#232B3B] border border-[#232B3B] text-xs font-semibold text-[#38BDF8] transition duration-150"
              >
                <Strategy size={14} weight="bold" aria-hidden="true" />
                <span>{tr('Strat Board', 'Sa bàn 2D')}</span>
              </button>

              <button
                type="button"
                onClick={() => openSettingsAt('GENERAL')}
                title={tr('Settings (Ctrl+,)', 'Cài đặt (Ctrl+,)')}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[2px] bg-[#171D28] hover:bg-[#232B3B] border border-[#232B3B] text-xs font-semibold text-[#EEF2F6] transition duration-150"
              >
                <GearSix size={14} weight="bold" aria-hidden="true" />
                <span>{tr('Settings', 'Cài đặt')}</span>
              </button>
            </div>
          </div>
        </header>

        <main
          id="main-content"
          className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 lg:py-12 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center"
        >
          {/* Left Column: Hero Briefing + Player Lookup */}
          <motion.section
            aria-label={tr('Overview and player search', 'Giới thiệu và tra cứu người chơi')}
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-7 space-y-6"
          >
            <div className="space-y-3">
              <p
                className={`font-mono text-[11px] font-bold uppercase tracking-[0.16em] flex items-center gap-2 transition-colors duration-200 ${
                  landingValo ? 'text-[#FF4655]' : 'text-[#E59A23]'
                }`}
              >
                <Broadcast size={14} weight="bold" aria-hidden="true" />
                <span>
                  {landingValo
                    ? tr(
                        'VALORANT PROTOCOL // RSO & ROUND ECONOMY REVIEW',
                        'VALORANT PROTOCOL // PHÂN TÍCH RSO & KINH TẾ ROUND'
                      )
                    : tr(
                        'PUBG TELEMETRY // 2D ZONE ROTATION & REPLAY REVIEW',
                        'PUBG TELEMETRY // SƠ ĐỒ VÒNG BO 2D & VIDEO REPLAY'
                      )}
                </span>
              </p>
              <h1 className="font-display text-[clamp(1.85rem,3.4vw,2.9rem)] font-bold tracking-tight leading-[1.08] text-[#EEF2F6] text-balance">
                {tr(
                  'Post-Match Tactical Replay & AI Coach for VALORANT & PUBG',
                  'Phân tích chiến thuật sau trận đấu cho VALORANT & PUBG'
                )}
              </h1>
              <p className="text-sm text-[#94A3B8] max-w-[56ch] leading-relaxed">
                {tr(
                  'Auto-capture kill highlights, scrub combat markers round-by-round, draw on VOD frames with Telestrator, and review actionable AI Coach feedback.',
                  'Tự động ghi hình highlight, đồng bộ mốc hạ gục theo từng round/vòng bo, vẽ sa bàn chiến thuật và nhận đánh giá từ AI Coach.'
                )}
              </p>
            </div>

            {/* Player Lookup Terminal */}
            <div className="theme-surface-card border border-[#232B3B] rounded-[4px] p-4 space-y-4">
              <div className="flex items-center justify-between gap-2 border-b border-[#232B3B] pb-2.5">
                <span className="font-mono text-[11px] font-bold text-[#94A3B8]">
                  {tr('QUICK PLAYER PROFILE LOOKUP', 'TRA CỨU NHANH HỒ SƠ NGƯỜI CHƠI')}
                </span>
                <span className="font-mono text-[10px] text-[#64748B]">
                  PUBG SHARD / RIOT ACCOUNT-V1
                </span>
              </div>

              <form onSubmit={handleLandingSearch} className="flex flex-col sm:flex-row gap-2">
                <div className="flex p-1 rounded-[2px] bg-[#0A0D12] border border-[#232B3B] shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setSearchGame('PUBG');
                      setSearchResult(null);
                      setStatusMsg(null);
                    }}
                    className={`px-3 py-2 rounded-[2px] font-mono text-xs font-bold transition duration-150 ${
                      searchGame === 'PUBG'
                        ? 'bg-[#E59A23] text-[#0A0D12]'
                        : 'text-[#94A3B8] hover:text-[#EEF2F6]'
                    }`}
                  >
                    PUBG
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchGame('VALORANT');
                      setSearchResult(null);
                      setStatusMsg(null);
                    }}
                    className={`px-3 py-2 rounded-[2px] font-mono text-xs font-bold transition duration-150 ${
                      searchGame === 'VALORANT'
                        ? 'bg-[#FF4655] text-[#EEF2F6] theme-cut-valo'
                        : 'text-[#94A3B8] hover:text-[#EEF2F6]'
                    }`}
                  >
                    VALORANT
                  </button>
                </div>

                <label htmlFor="landing-player-search" className="sr-only">
                  {searchGame === 'PUBG'
                    ? tr('PUBG player name to search', 'Tên nhân vật PUBG cần tìm')
                    : tr('Full Riot ID to search', 'Riot ID đầy đủ cần tìm')}
                </label>
                <input
                  id="landing-player-search"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={
                    searchGame === 'PUBG'
                      ? tr('Enter exact PUBG IGN...', 'Nhập tên nhân vật PUBG...')
                      : tr('Enter Riot ID#Tag (e.g. Player#NA1)...', 'Nhập Riot ID#Tag (VD: Player#VN1)...')
                  }
                  className="flex-1 min-w-0 px-3.5 py-2.5 rounded-[2px] bg-[#0A0D12] border border-[#232B3B] text-xs text-[#EEF2F6] placeholder:text-[#64748B] focus:outline-none focus:border-[#38BDF8]"
                />

                <button
                  type="submit"
                  disabled={searching}
                  className={`inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-[2px] font-bold text-xs transition duration-150 shrink-0 disabled:opacity-50 active:translate-y-[1px] ${
                    searchGame === 'PUBG'
                      ? 'bg-[#E59A23] hover:bg-amber-400 text-[#0A0D12]'
                      : 'bg-[#FF4655] hover:bg-rose-500 text-[#EEF2F6] theme-cut-valo'
                  }`}
                >
                  <MagnifyingGlass size={14} weight="bold" aria-hidden="true" />
                  <span>
                    {searching ? tr('Searching...', 'Đang tìm...') : tr('Search', 'Tìm kiếm')}
                  </span>
                </button>
              </form>

              {statusMsg && (
                <div
                  role="status"
                  className="p-3 rounded-[2px] bg-[#38BDF8]/10 border border-[#38BDF8]/30 text-xs text-[#38BDF8]"
                >
                  {statusMsg}
                </div>
              )}

              {searchResult && (
                <div className="p-3.5 rounded-[2px] bg-[#0A0D12] border border-[#232B3B] space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#232B3B] pb-2.5">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded-[2px] font-mono text-[10px] font-bold border ${
                          searchResult.gameType === 'PUBG'
                            ? 'bg-[#E59A23]/15 border-[#E59A23]/40 text-[#E59A23]'
                            : 'bg-[#FF4655]/15 border-[#FF4655]/40 text-[#FF4655]'
                        }`}
                      >
                        {searchResult.gameType} - {searchResult.player.region}
                      </span>
                      <span className="font-display text-sm font-bold text-[#EEF2F6]">
                        {searchResult.player.name}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        searchResult.gameType === 'PUBG'
                          ? handleSteamLogin()
                          : handleRiotLogin(false)
                      }
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#38BDF8] hover:underline"
                    >
                      <span>
                        {searchResult.gameType === 'PUBG'
                          ? tr('Sign in with Steam', 'Đăng nhập Steam')
                          : tr('Sign in with Riot RSO', 'Đăng nhập RSO')}
                      </span>
                      <ArrowRight size={12} weight="bold" aria-hidden="true" />
                    </button>
                  </div>

                  {searchResult.recentMatches.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 max-h-56 overflow-y-auto tactical-scrollbar pr-1">
                      {searchResult.recentMatches.map((m) => (
                        <div
                          key={m.matchId}
                          className="p-2.5 rounded-[2px] bg-[#10141C] border border-[#232B3B] text-xs space-y-1"
                        >
                          <div className="flex justify-between font-mono text-[10px] text-[#94A3B8]">
                            <span className="font-bold text-[#EEF2F6]">{m.mapName}</span>
                            <span className="tabular-nums">
                              {new Date(m.playedAt).toLocaleDateString(localeCode)}
                            </span>
                          </div>
                          <p className="font-mono text-[#E59A23] font-bold tabular-nums">
                            TOP #{m.winPlace} - {m.kills}K
                          </p>
                          <p className="font-mono text-[#64748B] text-[10px] tabular-nums">
                            {m.gameMode} - {m.damageDealt} DMG
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-[#94A3B8]">
                      {tr('Verified Riot account (ID:', 'Hồ sơ hợp lệ (ID:')}{' '}
                      <span className="font-mono text-[#EEF2F6]">
                        {searchResult.player.id.slice(0, 18)}...
                      </span>
                      {tr(
                        '). Sign in via Riot Sign On to sync match history and replay clips.',
                        '). Đăng nhập Riot Sign On để đồng bộ lịch sử trận đấu và video replay.'
                      )}
                    </p>
                  )}
                </div>
              )}
            </div>
          </motion.section>

          {/* Right Column: Official Game Portals */}
          <motion.section
            aria-label={tr('Official game sign-in portals', 'Cổng đăng nhập tài khoản game')}
            initial={reduceMotion ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.06, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-5 space-y-4"
          >
            {/* PUBG Portal Card */}
            <div
              onMouseEnter={() => setSearchGame('PUBG')}
              className={`theme-surface-card rounded-[4px] p-5 space-y-4 border transition duration-200 ${
                !landingValo
                  ? 'border-[#E59A23]/70 shadow-[0_0_24px_rgba(229,154,35,0.08)]'
                  : 'border-[#232B3B] hover:border-[#E59A23]/60'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="px-2 py-0.5 rounded-[2px] bg-[#E59A23]/15 border border-[#E59A23]/40 font-mono text-[10px] font-bold text-[#E59A23]">
                  PUBG: BATTLEGROUNDS
                </span>
                <span className="font-mono text-[10px] font-bold text-[#10B981]">
                  STEAM OPENID 2.0
                </span>
              </div>

              <div className="space-y-1.5">
                <h2 className="font-display text-lg font-bold text-[#EEF2F6]">
                  {tr('PUBG Tactical Cockpit', 'Không gian chiến thuật PUBG')}
                </h2>
                <p className="text-xs text-[#94A3B8] leading-relaxed max-w-[45ch]">
                  {tr(
                    'Track safe-zone phase rotations on 2D maps, weapon ballistics, kill distances, and automatic highlight clips.',
                    'Theo dõi sát thương theo từng giai đoạn vòng bo (Phase), vũ khí, cự ly hạ gục và video replay tự động.'
                  )}
                </p>
              </div>

              <button
                type="button"
                onClick={handleSteamLogin}
                className="w-full py-3 px-4 rounded-[2px] bg-[#1B2838] hover:bg-[#24364B] border border-[#38BDF8]/35 text-[#EEF2F6] font-bold text-xs transition duration-150 flex items-center justify-center gap-2.5 active:translate-y-[1px]"
              >
                <SteamBrandMark />
                <span>{tr('Sign in with Steam', 'Đăng nhập bằng Steam')}</span>
              </button>
            </div>

            {/* VALORANT Portal Card */}
            <div
              onMouseEnter={() => setSearchGame('VALORANT')}
              className={`theme-surface-card rounded-[4px] p-5 space-y-4 border transition duration-200 ${
                landingValo
                  ? 'border-[#FF4655]/70 shadow-[0_0_24px_rgba(255,70,85,0.09)]'
                  : 'border-[#232B3B] hover:border-[#FF4655]/60'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="px-2 py-0.5 rounded-[2px] bg-[#FF4655]/15 border border-[#FF4655]/40 font-mono text-[10px] font-bold text-[#FF4655]">
                  VALORANT
                </span>
                <span
                  className={`font-mono text-[10px] font-bold ${
                    providers.riotRsoReady ? 'text-[#10B981]' : 'text-[#E59A23]'
                  }`}
                >
                  {providers.riotRsoReady
                    ? tr('RSO READY', 'RSO SẴN SÀNG')
                    : tr('PENDING RSO KEY', 'CHỜ RSO CLIENT ID')}
                </span>
              </div>

              <div className="space-y-1.5">
                <h2 className="font-display text-lg font-bold text-[#EEF2F6]">
                  {tr('VALORANT Protocol Cockpit', 'Không gian chiến thuật VALORANT')}
                </h2>
                <p className="text-xs text-[#94A3B8] leading-relaxed max-w-[45ch]">
                  {tr(
                    'Official Riot Sign On (RSO) opt-in, round economy breakdowns (Eco, Force, Full Buy), and untraded death review.',
                    'Xác thực chính thức qua Riot Sign On (RSO), phân tích kinh tế round (Eco, Force, Full Buy) và lỗi vị trí.'
                  )}
                </p>
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => handleRiotLogin(false)}
                  className="w-full py-3 px-4 rounded-[2px] bg-[#FF4655] hover:bg-rose-500 text-[#EEF2F6] font-bold text-xs transition duration-150 flex items-center justify-center gap-2.5 active:translate-y-[1px] theme-cut-valo"
                >
                  <RiotBrandMark />
                  <span>{tr('Sign in with Riot Sign On (RSO)', 'Đăng nhập bằng Riot Sign On (RSO)')}</span>
                </button>

                {!providers.riotRsoReady && (
                  <p className="font-mono text-[11px] text-[#E59A23] leading-relaxed">
                    {tr(
                      'Awaiting production RIOT_CLIENT_ID & RIOT_CLIENT_SECRET approval from Riot Developer Portal.',
                      'Đang chờ cấp RIOT_CLIENT_ID & RIOT_CLIENT_SECRET chính thức từ Riot Developer Portal.'
                    )}
                  </p>
                )}
              </div>
            </div>
          </motion.section>
        </main>

        <AppFooterVersion
          isElectronRuntime={isElectronRuntime}
          onOpenSettings={() => openSettingsAt('GENERAL')}
        />
        <TacticalBoardModal
          isOpen={showTacticalBoard}
          initialGame={searchGame}
          dataRevision={dataRevision}
          onClose={() => setShowTacticalBoard(false)}
        />
        {sharedSettingsModal}
        <UpdateBanner />
      </div>
    );
  }

  // ==========================================================================
  // 2. AUTHENTICATED COCKPIT (GAME THEME HUD + UNIFIED SETTINGS + FORM TRACKER)
  // ==========================================================================
  const isValo = activeGameTab === 'VALORANT';
  const valoCount = Math.min(20, videos.filter((v) => v.game_type === 'VALORANT').length);
  const pubgCount = Math.min(20, videos.filter((v) => v.game_type === 'PUBG').length);

  const filteredVideos = tabBaseVideos.filter((v) => {
    const ann = annotationsMap[v.match_id];
    const hasAnn = Boolean(ann && (ann.tags.length > 0 || ann.note.trim().length > 0));
    const query = matchSearchText.trim().toLowerCase();

    if (query) {
      const tagsText = ann ? `${ann.tags.map((t) => `#${t}`).join(' ')} ${ann.note}` : '';
      const haystack =
        `${v.map_name} ${v.game_mode} ${v.match_result} ${v.score_summary || ''} ${tagsText}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }

    if (matchFilterMode === 'PINNED') return Boolean(v.is_pinned);
    if (matchFilterMode === 'NOTES') return hasAnn;
    if (matchFilterMode === 'CLIPS') {
      return Boolean(v.cloud_video_url || getLocalVideoByMatchId(v.match_id));
    }
    if (matchFilterMode === 'WINS') {
      const r = (v.match_result || '').toUpperCase();
      return (
        r.includes('WIN') ||
        r.includes('THẮNG') ||
        r.includes('#1') ||
        r.includes('TOP 1') ||
        r.includes('1/')
      );
    }
    return true;
  });

  const activeMatch =
    tabBaseVideos.find((v) => v.match_id === selectedMatchId) ||
    filteredVideos.find((v) => v.match_id === selectedMatchId);
  const activeRound = rounds.find((r) => r.roundNumber === selectedRound);
  const hasRiotLinked = Boolean(profile?.has_riot_linked);
  const activeHotkeyLabel = desktopCaptureStatus?.hotkey || 'F9';

  const refreshIntervalText =
    appSettings.autoRefreshSec === 0
      ? tr('Manual refresh only', 'Chỉ làm mới thủ công')
      : appSettings.autoRefreshSec < 60
        ? tr(`Auto-sync every ${appSettings.autoRefreshSec}s`, `Tự làm mới ${appSettings.autoRefreshSec}s/lần`)
        : tr(
            `Auto-sync every ${appSettings.autoRefreshSec / 60}m`,
            `Tự làm mới ${appSettings.autoRefreshSec / 60} phút/lần`
          );

  return (
    <div
      data-game-theme={isValo ? 'valorant' : 'pubg'}
      className={`min-h-[100dvh] game-theme-backdrop ${
        appSettings.themeEffects ? 'theme-fx-on' : ''
      } text-[#EEF2F6] flex flex-col`}
    >
      {/* Top 3px Dynamic Game Theme Accent Ribbon */}
      <div
        className={`h-[3px] w-full transition-colors duration-300 ${
          isValo
            ? 'bg-gradient-to-r from-[#FF4655] via-[#FF4655]/85 to-[#38BDF8]'
            : 'bg-gradient-to-r from-[#E59A23] via-[#E59A23]/85 to-[#10B981]'
        }`}
      />

      {/* Command Header */}
      <header className="min-h-[60px] border-b border-[#232B3B] px-5 py-2.5 bg-[#10141C]/95 backdrop-blur-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2.5">
            <div
              className={`h-7 w-7 rounded-[2px] flex items-center justify-center font-display font-bold text-xs transition-colors duration-200 ${
                isValo
                  ? 'bg-[#FF4655] text-[#EEF2F6] theme-cut-valo'
                  : 'bg-[#E59A23] text-[#0A0D12]'
              }`}
            >
              TR
            </div>
            <h1 className="font-display text-base font-bold tracking-tight text-[#EEF2F6]">
              TacticalReplay<span className={isValo ? 'text-[#FF4655]' : 'text-[#E59A23]'}>AI</span>
            </h1>
          </div>

          {/* Game Theme Switcher */}
          <div
            role="group"
            aria-label={tr('Select active game workspace', 'Chọn game đang phân tích')}
            className="flex items-center gap-1 p-1 rounded-[2px] bg-[#0A0D12] border border-[#232B3B]"
          >
            <button
              type="button"
              aria-pressed={isValo}
              onClick={() => void handleSwitchGameTab('VALORANT')}
              className={`px-3 py-1.5 rounded-[2px] font-mono text-xs font-bold transition duration-150 active:translate-y-[1px] ${
                isValo
                  ? 'bg-[#FF4655] text-[#EEF2F6] theme-cut-valo shadow-[0_0_14px_rgba(255,70,85,0.28)]'
                  : 'text-[#94A3B8] hover:text-[#EEF2F6]'
              }`}
            >
              VALORANT ({valoCount})
            </button>
            <button
              type="button"
              aria-pressed={!isValo}
              onClick={() => void handleSwitchGameTab('PUBG')}
              className={`px-3 py-1.5 rounded-[2px] font-mono text-xs font-bold transition duration-150 active:translate-y-[1px] ${
                !isValo
                  ? 'bg-[#E59A23] text-[#0A0D12] shadow-[0_0_14px_rgba(229,154,35,0.25)]'
                  : 'text-[#94A3B8] hover:text-[#EEF2F6]'
              }`}
            >
              PUBG ({pubgCount})
            </button>
          </div>

          {/* Streamlined Action Bar */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowLeaderboard(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[2px] bg-[#171D28] hover:bg-[#232B3B] border border-[#232B3B] text-xs font-semibold text-[#38BDF8] transition duration-150 active:translate-y-[1px]"
            >
              <Trophy size={14} weight="bold" aria-hidden="true" />
              <span>{tr('Leaderboard', 'Bảng xếp hạng')}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowTrendModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[2px] bg-[#171D28] hover:bg-[#232B3B] border border-[#232B3B] text-xs font-semibold text-[#EEF2F6] transition duration-150 active:translate-y-[1px]"
            >
              <ChartBar size={14} weight="bold" aria-hidden="true" />
              <span>{tr('20-Match Form', 'Phong độ 20 trận')}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowTacticalBoard(true)}
              title={tr('Interactive 2D Strategy & Callout Board (Ctrl+B)', 'Sa bàn Chiến thuật & Callout 2D (Ctrl+B)')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[2px] bg-[#171D28] hover:bg-[#232B3B] border border-[#232B3B] text-xs font-semibold text-[#E59A23] transition duration-150 active:translate-y-[1px]"
            >
              <Strategy size={14} weight="bold" aria-hidden="true" />
              <span>{tr('Strat Board', 'Sa bàn 2D')}</span>
            </button>

            <button
              type="button"
              onClick={() => openSettingsAt('SENS')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[2px] bg-[#171D28] hover:bg-[#232B3B] border border-[#232B3B] text-xs font-semibold text-[#10B981] transition duration-150 active:translate-y-[1px]"
            >
              <SlidersHorizontal size={14} weight="bold" aria-hidden="true" />
              <span>{tr('Sens & Crosshair', 'Kho Sens & Tâm')}</span>
            </button>

            {activeMatch && (
              <>
                <button
                  type="button"
                  onClick={() => setShowPostMatchRecap((prev) => !prev)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[2px] bg-[#171D28] hover:bg-[#232B3B] border border-[#232B3B] text-xs font-semibold text-[#E59A23] transition duration-150 active:translate-y-[1px]"
                >
                  <Crosshair size={14} weight="bold" aria-hidden="true" />
                  <span>{tr('Recap', 'Tóm tắt trận')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleCopyShareLink(activeMatch.match_id)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[2px] bg-[#171D28] hover:bg-[#232B3B] border border-[#232B3B] text-xs font-semibold text-[#EEF2F6] transition duration-150 active:translate-y-[1px]"
                >
                  <ShareNetwork size={14} weight="bold" aria-hidden="true" />
                  <span>{tr('Share', 'Chia sẻ')}</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => openSettingsAt('GENERAL')}
              title={tr(
                'Unified Settings: Language, Hotkeys, Capture, Storage, Accounts (Ctrl+,)',
                'Trung tâm Cài đặt: Ngôn ngữ, Phím tắt, Quay clip, Kho lưu trữ, Tài khoản (Ctrl+,)'
              )}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[2px] border text-xs font-bold transition duration-150 active:translate-y-[1px] ${
                isValo
                  ? 'bg-[#FF4655]/15 hover:bg-[#FF4655]/25 border-[#FF4655]/45 text-[#EEF2F6]'
                  : 'bg-[#E59A23]/15 hover:bg-[#E59A23]/25 border-[#E59A23]/45 text-[#EEF2F6]'
              }`}
            >
              <GearSix size={14} weight="bold" aria-hidden="true" />
              <span>{tr('Settings', 'Cài đặt')}</span>
            </button>
          </div>
        </div>

        {/* Language Pill + Account Badges + Sign Out */}
        <div className="flex flex-wrap items-center gap-2">
          <LanguageQuickToggle lang={lang} onChangeLang={setLang} />

          <button
            type="button"
            onClick={() => openSettingsAt('ACCOUNTS')}
            title={tr('Manage linked game accounts', 'Quản lý tài khoản game đã liên kết')}
            className="inline-flex items-center gap-2 px-2.5 py-1 rounded-[2px] bg-[#171D28] hover:bg-[#232B3B] border border-[#232B3B] text-xs font-semibold text-[#EEF2F6] transition duration-150"
          >
            {profile?.steam_avatar && !isValo && (
              <img
                src={profile.steam_avatar}
                alt={tr(
                  `Steam avatar of ${profile.steam_persona_name || 'player'}`,
                  `Ảnh đại diện Steam của ${profile.steam_persona_name || 'người chơi'}`
                )}
                className="w-4 h-4 rounded-[2px]"
              />
            )}
            <span className="font-mono">
              {isValo
                ? profile?.riot_game_name
                  ? `${profile.riot_game_name}#${profile.riot_tag_line}`
                  : profile?.steam_persona_name || tr('Link Riot ID', 'Liên kết Riot')
                : profile?.pubg_player_name
                  ? `IGN: ${profile.pubg_player_name}`
                  : profile?.steam_persona_name || tr('Set PUBG IGN', 'Cài đặt IGN')}
            </span>
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[2px] bg-[#0A0D12] hover:bg-[#F43F5E]/15 border border-[#232B3B] hover:border-[#F43F5E]/40 text-xs text-[#94A3B8] hover:text-[#F43F5E] transition duration-150 active:translate-y-[1px]"
          >
            <SignOut size={14} weight="bold" aria-hidden="true" />
            <span>{tr('Sign Out', 'Đăng xuất')}</span>
          </button>
        </div>
      </header>

      {/* Animated Game Theme Identity Banner */}
      <div className="border-b border-[#232B3B]/80 bg-[#0A0D12]/65 px-5 py-2">
        <div className="max-w-[1640px] mx-auto">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={activeGameTab}
              initial={reduceMotion ? false : { opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: 4 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="flex flex-wrap items-center justify-between gap-2 text-xs"
            >
              <div className="flex flex-wrap items-center gap-2.5">
                <span
                  className={`px-2 py-0.5 rounded-[2px] font-mono text-[10px] font-bold tracking-wider uppercase border ${
                    isValo
                      ? 'bg-[#FF4655]/15 border-[#FF4655]/45 text-[#FF4655] theme-cut-valo'
                      : 'bg-[#E59A23]/15 border-[#E59A23]/45 text-[#E59A23]'
                  }`}
                >
                  {isValo ? 'PROTOCOL // VALORANT' : 'BATTLEGROUNDS // TELEMETRY'}
                </span>
                <span className="text-[#94A3B8] text-[11px]">
                  {isValo
                    ? tr(
                        'Round Economy (Eco / Force / Full Buy) | Opening Pick & Untraded Death Review | Telestrator VOD',
                        'Kinh tế Round (Eco / Force / Full Buy) | Phân tích Opening Pick & Lỗi vị trí | Bút vẽ Telestrator'
                      )
                    : tr(
                        '2D Safe-Zone Phase Rotations | Weapon Ballistics & Kill Distance | Auto-Highlight Replay',
                        'Sơ đồ di chuyển Vòng Bo 2D | Thống kê đạn đạo & Cự ly hạ gục | Tự động cắt Highlight'
                      )}
                </span>
              </div>

              <div className="flex items-center gap-2 font-mono text-[10px] text-[#94A3B8]">
                {isElectronRuntime && (
                  <button
                    type="button"
                    onClick={() => openSettingsAt('CAPTURE')}
                    className="px-2 py-0.5 rounded-[2px] bg-[#171D28] hover:bg-[#232B3B] border border-[#232B3B] text-[#38BDF8] transition duration-150"
                  >
                    {tr(`Clip Hotkey: ${activeHotkeyLabel}`, `Phím cắt: ${activeHotkeyLabel}`)}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => openSettingsAt('STORAGE')}
                  className="px-2 py-0.5 rounded-[2px] bg-[#171D28] hover:bg-[#232B3B] border border-[#232B3B] text-[#94A3B8] hover:text-[#EEF2F6] transition duration-150"
                >
                  {tr('Clips & R2 Storage', 'Kho Clip & R2')}
                </button>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {statusMsg && (
        <div
          role="status"
          className="bg-[#10141C] border-b border-[#232B3B] px-5 py-2 text-xs text-[#38BDF8] flex justify-between items-center gap-4"
        >
          <span>{ts(statusMsg, statusMsg, statusMsg)}</span>
          <button
            type="button"
            aria-label={tr('Dismiss notification', 'Đóng thông báo')}
            onClick={() => setStatusMsg(null)}
            className="inline-flex items-center gap-1 text-[#94A3B8] hover:text-[#EEF2F6]"
          >
            <X size={13} weight="bold" aria-hidden="true" />
            <span>{tr('Close', 'Đóng')}</span>
          </button>
        </div>
      )}

      {/* Cockpit Grid */}
      <main
        id="main-content"
        className="flex-1 max-w-[1640px] w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-4 p-4"
      >
        {/* Left Sidebar: Capture Status, 5-Match Session Form, Match History */}
        <aside
          aria-label={tr('Match history and session status', 'Danh sách trận đấu và trạng thái')}
          className="lg:col-span-3 theme-surface-card bg-[#10141C] border border-[#232B3B] rounded-[4px] p-4 flex flex-col gap-3"
        >
          <div className="flex items-center justify-between border-b border-[#232B3B] pb-2.5">
            <div>
              <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-[#94A3B8] tabular-nums">
                {isValo
                  ? tr(
                      `20 VALORANT Matches (${filteredVideos.length}/20)`,
                      `20 Trận VALORANT (${filteredVideos.length}/20)`
                    )
                  : tr(
                      `20 PUBG Matches (${filteredVideos.length}/20)`,
                      `20 Trận PUBG (${filteredVideos.length}/20)`
                    )}
              </h2>
              <p className="font-mono text-[10px] text-[#64748B] tabular-nums mt-0.5">
                {autoRefreshing
                  ? tr('Syncing latest telemetry...', 'Đang tự đồng bộ...')
                  : lastSyncedAt
                    ? `${refreshIntervalText} (${lastSyncedAt})`
                    : refreshIntervalText}
              </p>
            </div>
            <button
              type="button"
              disabled={autoRefreshing}
              onClick={() => void autoRefreshTriggerRef.current?.(true, true)}
              className={`inline-flex items-center gap-1 font-mono text-xs font-bold hover:underline disabled:opacity-60 ${
                isValo ? 'text-[#FF4655]' : 'text-[#E59A23]'
              }`}
            >
              <ArrowsClockwise
                size={13}
                weight="bold"
                className={autoRefreshing ? 'animate-spin' : ''}
                aria-hidden="true"
              />
              <span>{tr('Refresh', 'Làm mới')}</span>
            </button>
          </div>

          {/* Consolidated Capture Status Card */}
          <div className="rounded-[2px] border border-[#232B3B] bg-[#0A0D12] p-2.5 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span
                className={`inline-flex items-center gap-1.5 font-mono text-[11px] font-bold ${
                  desktopCaptureStatus?.shouldRecord || isOverwolfRuntime
                    ? 'text-[#10B981]'
                    : isElectronRuntime
                      ? 'text-[#38BDF8]'
                      : 'text-[#94A3B8]'
                }`}
              >
                <Record
                  size={12}
                  weight="fill"
                  className={desktopCaptureStatus?.shouldRecord ? 'animate-pulse' : ''}
                  aria-hidden="true"
                />
                <span>
                  {isOverwolfRuntime
                    ? 'Overwolf Auto-Capture'
                    : isElectronRuntime
                      ? desktopCaptureStatus?.shouldRecord
                        ? tr(
                            `Recording ${desktopCaptureStatus.activeGame}`,
                            `Đang quay ${desktopCaptureStatus.activeGame}`
                          )
                        : desktopCaptureStatus?.desktopCaptureEnabled ?? true
                          ? tr('Auto-Capture Standby', 'Chờ vào game (.exe)')
                          : tr('Auto-Capture Paused', 'Tự quay đang tắt')
                      : tr('Web Replay Mode', 'Chế độ Web Replay')}
                </span>
              </span>

              <button
                type="button"
                onClick={() => openSettingsAt('CAPTURE')}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[2px] bg-[#171D28] hover:bg-[#232B3B] border border-[#232B3B] font-mono text-[10px] font-bold text-[#94A3B8] hover:text-[#EEF2F6] transition duration-150"
              >
                <GearSix size={11} weight="bold" aria-hidden="true" />
                <span>{tr('Configure', 'Tùy chỉnh')}</span>
              </button>
            </div>

            <div
              role="group"
              aria-label={tr('Automatic video capture mode', 'Chế độ quay video tự động')}
              className="grid grid-cols-2 gap-1 p-0.5 rounded-[2px] bg-[#10141C] border border-[#232B3B]"
            >
              <button
                type="button"
                aria-pressed={captureMode === 'FULL_MATCH'}
                onClick={() => handleToggleCaptureMode('FULL_MATCH')}
                className={`px-2 py-1 rounded-[2px] font-mono text-[11px] font-bold transition duration-150 ${
                  captureMode === 'FULL_MATCH'
                    ? 'bg-[#171D28] text-[#EEF2F6] border border-[#38BDF8]/40'
                    : 'text-[#64748B] hover:text-[#94A3B8]'
                }`}
              >
                {tr('Full Match', 'Quay cả trận')}
              </button>
              <button
                type="button"
                aria-pressed={captureMode === 'HIGHLIGHT_CLIPS'}
                onClick={() => handleToggleCaptureMode('HIGHLIGHT_CLIPS')}
                className={`px-2 py-1 rounded-[2px] font-mono text-[11px] font-bold transition duration-150 ${
                  captureMode === 'HIGHLIGHT_CLIPS'
                    ? 'bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/40'
                    : 'text-[#64748B] hover:text-[#94A3B8]'
                }`}
              >
                {tr('Highlight ~23s', 'Highlight ~23s')}
              </button>
            </div>

            {isElectronRuntime && !isOverwolfRuntime && (
              <div className="flex items-center gap-1.5 pt-0.5">
                <button
                  type="button"
                  onClick={() => void desktopRingRecorder.triggerF9Highlight(activeGameTab)}
                  className="flex-1 py-1 px-2 rounded-[2px] bg-[#171D28] hover:bg-[#232B3B] border border-[#E59A23]/40 text-[10px] font-mono font-bold text-[#E59A23] transition duration-150"
                >
                  {tr(`Clip Now (${activeHotkeyLabel})`, `Cắt ngay (${activeHotkeyLabel})`)}
                </button>
                <button
                  type="button"
                  onClick={handleOpenHighlightsFolder}
                  aria-label={tr('Open local clips folder', 'Mở thư mục lưu clip')}
                  title={tr('Open local clips folder', 'Mở thư mục lưu clip trên máy')}
                  className="p-1.5 rounded-[2px] bg-[#171D28] hover:bg-[#232B3B] border border-[#232B3B] text-[#94A3B8] hover:text-[#EEF2F6] transition duration-150"
                >
                  <FolderOpen size={13} weight="bold" aria-hidden="true" />
                </button>
              </div>
            )}

            {compatNeedsRestart && (
              <button
                type="button"
                onClick={() => void (window as any).electronAPI?.relaunchApp?.()}
                className="w-full py-1 px-2 rounded-[2px] bg-[#E59A23] hover:bg-amber-400 text-[#0A0D12] font-mono text-[10px] font-bold transition duration-150"
              >
                {tr('Restart App to Apply Capture Mode', 'Khởi động lại app để áp dụng')}
              </button>
            )}

            {blackFrameAlert && (
              <div className="p-2 rounded-[2px] bg-[#F43F5E]/10 border border-[#F43F5E]/30 space-y-1.5">
                <p className="text-[10px] text-[#F43F5E] leading-relaxed">
                  {desktopCaptureStatus?.captureCompatMode === 'dxgi'
                    ? tr(
                        'Frames are still black in Exclusive Fullscreen. Switch the game to Borderless Windowed or install Overwolf.',
                        'Khung hình vẫn bị đen khi Fullscreen độc quyền. Hãy chuyển game sang Windowed Fullscreen hoặc cài Overwolf.'
                      )
                    : tr(
                        'Black frames detected in Fullscreen mode. Enable Fullscreen Compatibility to fix:',
                        'Video đang bị đen do game chạy Fullscreen. Bật chế độ tương thích để khắc phục:'
                      )}
                </p>
                {desktopCaptureStatus?.captureCompatMode !== 'dxgi' && (
                  <button
                    type="button"
                    onClick={() =>
                      void handleUpdateCaptureOptions({ captureCompatMode: 'dxgi' })
                    }
                    className="w-full py-1 px-2 rounded-[2px] bg-[#E59A23] hover:bg-amber-400 text-[#0A0D12] font-mono text-[10px] font-bold transition duration-150"
                  >
                    {tr('Fix Fullscreen Black Frame & Restart', 'Bật chống đen Fullscreen & Khởi động lại')}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* NEW FEATURE: Recent 5-Match Session Form Tracker */}
          {sessionForm && (
            <div className="rounded-[2px] border border-[#232B3B] bg-[#0A0D12] p-2.5 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
                  <Flame
                    size={12}
                    weight="fill"
                    className={isValo ? 'text-[#FF4655]' : 'text-[#E59A23]'}
                    aria-hidden="true"
                  />
                  <span>
                    {tr(
                      `Last ${sessionForm.count} Session Form`,
                      `Phong độ ${sessionForm.count} trận gần nhất`
                    )}
                  </span>
                </span>
                <div className="flex items-center gap-1" aria-hidden="true">
                  {sessionForm.pills.map((ok, idx) => (
                    <span
                      key={idx}
                      className={`h-2 w-2 rounded-[1px] ${
                        ok ? 'bg-[#10B981]' : 'bg-[#334155]'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-1.5 font-mono text-[11px] tabular-nums">
                <div className="p-1.5 rounded-[2px] bg-[#10141C] border border-[#232B3B]">
                  <span className="block text-[9px] text-[#64748B]">
                    {isValo ? tr('WIN RATE', 'TỶ LỆ THẮNG') : 'TOP 10'}
                  </span>
                  <span className="font-bold text-[#10B981]">{sessionForm.recentSuccessRate}%</span>
                </div>
                <div className="p-1.5 rounded-[2px] bg-[#10141C] border border-[#232B3B]">
                  <span className="block text-[9px] text-[#64748B]">
                    {tr('AVG KILLS', 'KILL TB')}
                  </span>
                  <span className="font-bold text-[#EEF2F6]">{sessionForm.recentAvgKills}</span>
                </div>
                <div className="p-1.5 rounded-[2px] bg-[#10141C] border border-[#232B3B]">
                  <span className="block text-[9px] text-[#64748B]">
                    {tr('TREND', 'XU HƯỚNG')}
                  </span>
                  <span
                    className={`inline-flex items-center gap-0.5 font-bold ${
                      sessionForm.killsDelta > 0
                        ? 'text-[#10B981]'
                        : sessionForm.killsDelta < 0
                          ? 'text-[#F43F5E]'
                          : 'text-[#38BDF8]'
                    }`}
                  >
                    {sessionForm.killsDelta > 0 ? (
                      <TrendUp size={11} weight="bold" aria-hidden="true" />
                    ) : sessionForm.killsDelta < 0 ? (
                      <TrendDown size={11} weight="bold" aria-hidden="true" />
                    ) : null}
                    <span>
                      {sessionForm.killsDelta > 0
                        ? `+${sessionForm.killsDelta}K`
                        : sessionForm.killsDelta < 0
                          ? `${sessionForm.killsDelta}K`
                          : tr('Steady', 'Ổn định')}
                    </span>
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Account Sync / Setup Action */}
          {!isValo && !profile?.pubg_player_name && (
            <form
              onSubmit={(e) => void handleSavePubgIgn(e)}
              className="rounded-[2px] border border-[#E59A23]/35 bg-[#0A0D12] p-2.5 space-y-2"
            >
              <label
                htmlFor="pubg-ign-sidebar-input"
                className="block font-mono text-[10px] font-bold uppercase tracking-wider text-[#E59A23]"
              >
                {tr('Set Exact PUBG IGN to Sync Matches', 'Nhập đúng PUBG IGN để đồng bộ')}
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  id="pubg-ign-sidebar-input"
                  type="text"
                  value={pubgIgnInput}
                  onChange={(e) => setPubgIgnInput(e.target.value)}
                  placeholder={
                    profile?.steam_persona_name || tr('Enter PUBG IGN...', 'Nhập IGN PUBG...')
                  }
                  className="flex-1 min-w-0 px-2.5 py-1.5 rounded-[2px] bg-[#10141C] border border-[#232B3B] focus:border-[#E59A23] text-xs font-mono text-[#EEF2F6] placeholder-[#64748B] focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={savingPubgIgn}
                  className="px-2.5 py-1.5 rounded-[2px] bg-[#E59A23] hover:bg-amber-400 text-xs font-bold text-[#0A0D12] disabled:opacity-50 transition duration-150 shrink-0"
                >
                  {savingPubgIgn ? '...' : tr('Save', 'Lưu')}
                </button>
              </div>
            </form>
          )}

          {!isValo && (profile?.pubg_player_name || profile?.steam_persona_name) && (
            <button
              type="button"
              onClick={() => void handleSyncPubg()}
              disabled={syncingPubg}
              className="w-full py-2 px-3 rounded-[2px] bg-[#E59A23] hover:bg-amber-400 disabled:opacity-50 text-[#0A0D12] font-bold text-xs transition duration-150 active:translate-y-[1px]"
            >
              {syncingPubg
                ? tr('Syncing 20 PUBG matches...', 'Đang đồng bộ 20 trận PUBG...')
                : tr('Sync Latest 20 PUBG Matches', 'Đồng bộ 20 trận PUBG gần nhất')}
            </button>
          )}

          {!isValo && !profile?.steam_id && !profile?.pubg_player_name && (
            <button
              type="button"
              onClick={() => void handleLinkSteamAccount()}
              className="inline-flex items-center justify-center gap-1.5 w-full py-2 px-3 rounded-[2px] bg-[#1B2838] hover:bg-[#24364B] border border-[#38BDF8]/35 text-[#EEF2F6] font-bold text-xs transition duration-150 active:translate-y-[1px]"
            >
              <LinkSimple size={14} weight="bold" aria-hidden="true" />
              <span>{tr('Link Steam Account', 'Liên kết tài khoản Steam')}</span>
            </button>
          )}

          {isValo && !hasRiotLinked && (
            <button
              type="button"
              onClick={() => void handleLinkRiotAccount()}
              className="inline-flex items-center justify-center gap-1.5 w-full py-2 px-3 rounded-[2px] bg-[#FF4655] hover:bg-rose-500 text-[#EEF2F6] font-bold text-xs transition duration-150 active:translate-y-[1px] theme-cut-valo"
            >
              <LinkSimple size={14} weight="bold" aria-hidden="true" />
              <span>{tr('Link Riot Sign On (RSO)', 'Liên kết Riot Sign On (RSO)')}</span>
            </button>
          )}

          {isValo && hasRiotLinked && (
            <button
              type="button"
              onClick={() => void handleSyncValorant()}
              disabled={syncingValorant}
              className="w-full py-2 px-3 rounded-[2px] bg-[#FF4655] hover:bg-rose-500 disabled:opacity-50 text-[#EEF2F6] font-bold text-xs transition duration-150 active:translate-y-[1px] theme-cut-valo"
            >
              {syncingValorant
                ? tr('Syncing 20 VALORANT matches...', 'Đang đồng bộ 20 trận VALORANT...')
                : tr('Sync Latest 20 VALORANT Matches', 'Đồng bộ 20 trận VALORANT gần nhất')}
            </button>
          )}

          {/* Match Search + Tag / Clip / Pin Filters */}
          {tabBaseVideos.length > 0 && !loading && (
            <div className="space-y-1.5 rounded-[2px] border border-[#232B3B] bg-[#0A0D12] p-2">
              <div className="relative">
                <label htmlFor="match-search-input" className="sr-only">
                  {tr(
                    'Search matches by map, result, #tag, or personal note',
                    'Tìm kiếm trận đấu theo map, kết quả, #nhãn hoặc ghi chú'
                  )}
                </label>
                <MagnifyingGlass
                  size={12}
                  weight="bold"
                  aria-hidden="true"
                  className="absolute left-2 top-1/2 -translate-y-1/2 text-[#64748B]"
                />
                <input
                  id="match-search-input"
                  type="text"
                  value={matchSearchText}
                  onChange={(e) => setMatchSearchText(e.target.value)}
                  placeholder={tr('Map, #tag, note, result...', 'Tìm map, #nhãn, ghi chú...')}
                  className="w-full pl-6 pr-2 py-1 rounded-[2px] bg-[#10141C] border border-[#232B3B] focus:border-[#38BDF8] text-[11px] font-mono text-[#EEF2F6] placeholder-[#64748B] focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-5 gap-1">
                {(
                  [
                    { id: 'ALL', label: tr('All', 'Tất cả') },
                    { id: 'WINS', label: tr('Win/#1', 'Thắng') },
                    { id: 'CLIPS', label: tr('Clips', 'Clip') },
                    { id: 'PINNED', label: tr('Pinned', 'Ghim') },
                    { id: 'NOTES', label: tr('Notes', 'Nhãn') },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setMatchFilterMode(tab.id)}
                    className={`py-1 px-1 rounded-[2px] font-mono text-[10px] font-bold transition duration-150 truncate ${
                      matchFilterMode === tab.id
                        ? isValo
                          ? 'bg-[#FF4655] text-[#EEF2F6]'
                          : 'bg-[#E59A23] text-[#0A0D12]'
                        : 'bg-[#171D28] text-[#94A3B8] hover:text-[#EEF2F6]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {loading ? (
            <div
              className="space-y-2 py-1"
              aria-label={tr('Loading matches', 'Đang tải danh sách trận đấu')}
            >
              {[1, 2, 3, 4, 5].map((item) => (
                <div
                  key={item}
                  className="h-20 rounded-[2px] bg-[#0A0D12] border border-[#232B3B] animate-pulse"
                />
              ))}
            </div>
          ) : tabBaseVideos.length === 0 ? (
            <div className="rounded-[2px] border border-dashed border-[#232B3B] bg-[#0A0D12] p-4 text-xs text-[#94A3B8] space-y-2 leading-relaxed">
              <p className="font-bold text-[#EEF2F6]">
                {isValo
                  ? tr('No VALORANT matches synced yet.', 'Chưa có trận VALORANT nào được ghi nhận.')
                  : tr('No PUBG matches saved yet.', 'Chưa có trận PUBG nào được lưu.')}
              </p>
              <p className="text-[#64748B]">
                {isValo
                  ? tr(
                      'Link Riot Sign On (RSO) and sync your latest 20 matches, or launch VALORANT to auto-record highlights.',
                      'Liên kết Riot Sign On để đồng bộ 20 trận gần nhất hoặc vào VALORANT để tự động quay highlight.'
                    )
                  : tr(
                      'Click Sync Latest 20 PUBG Matches above, or launch PUBG to automatically capture highlights and zone telemetry.',
                      'Bấm nút đồng bộ 20 trận PUBG phía trên hoặc vào PUBG để tự động lưu highlight và phân tích vòng bo.'
                    )}
              </p>
            </div>
          ) : filteredVideos.length === 0 ? (
            <div className="rounded-[2px] border border-dashed border-[#232B3B] bg-[#0A0D12] p-4 text-xs text-[#94A3B8] space-y-2">
              <p className="font-bold text-[#EEF2F6]">
                {tr('No matches match the current filter.', 'Không có trận nào khớp bộ lọc hiện tại.')}
              </p>
              <button
                type="button"
                onClick={() => {
                  setMatchSearchText('');
                  setMatchFilterMode('ALL');
                }}
                className="px-2.5 py-1 rounded-[2px] bg-[#171D28] hover:bg-[#232B3B] border border-[#232B3B] font-mono text-[11px] font-bold text-[#38BDF8]"
              >
                {tr('Reset Filters', 'Xóa bộ lọc')}
              </button>
            </div>
          ) : (
            <div className="space-y-2 overflow-y-auto max-h-[68vh] tactical-scrollbar pr-1">
              {filteredVideos.map((v) => {
                const isSelected = v.match_id === selectedMatchId;
                const localRecord = getLocalVideoByMatchId(v.match_id);
                const clipCount = localRecord?.clips?.length || (localRecord?.filePath ? 1 : 0);
                const hasHighlight = Boolean(v.cloud_video_url || localRecord);
                const ann = annotationsMap[v.match_id];

                return (
                  <div
                    key={v.match_id}
                    className={`flex items-stretch rounded-[2px] border transition duration-150 ${
                      isSelected
                        ? isValo
                          ? 'bg-[#FF4655]/12 border-[#FF4655]'
                          : 'bg-[#E59A23]/12 border-[#E59A23]'
                        : v.is_pinned
                          ? 'bg-[#0A0D12] border-[#E59A23]/45 hover:bg-[#171D28]'
                          : 'bg-[#0A0D12] border-[#232B3B] hover:border-[#334155] hover:bg-[#171D28]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => void handleSelectMatch(v)}
                      className="flex-1 min-w-0 text-left p-3 space-y-1.5 active:translate-y-[1px]"
                    >
                      <div className="flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1 flex-wrap">
                          <span
                            className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded-[2px] border ${
                              isValo
                                ? 'bg-[#FF4655]/15 border-[#FF4655]/40 text-[#FF4655]'
                                : 'bg-[#E59A23]/15 border-[#E59A23]/40 text-[#E59A23]'
                            }`}
                          >
                            {v.game_mode || v.game_type}
                          </span>
                          {hasHighlight && (
                            <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold px-1.5 py-0.5 rounded-[2px] bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/30">
                              <VideoCamera size={10} weight="bold" aria-hidden="true" />
                              <span>{clipCount > 1 ? `${clipCount} CLIPS` : 'CLIP'}</span>
                            </span>
                          )}
                          {v.is_pinned && (
                            <span className="font-mono text-[10px] font-bold px-1 py-0.5 rounded-[2px] bg-[#E59A23]/15 text-[#E59A23] border border-[#E59A23]/40">
                              {tr('PIN', 'GHIM')}
                            </span>
                          )}
                        </div>
                        <span className="font-mono text-[11px] text-[#64748B] tabular-nums shrink-0">
                          {new Date(v.played_at).toLocaleDateString(localeCode)}
                        </span>
                      </div>
                      <p className="font-display text-sm font-bold text-[#EEF2F6] truncate">
                        {v.map_name}
                      </p>
                      <p className="font-mono text-[11px] text-[#94A3B8] tabular-nums">
                        {v.match_result} {v.score_summary ? `- ${v.score_summary}` : ''}
                      </p>

                      {ann && (ann.tags.length > 0 || ann.note.trim().length > 0) && (
                        <div className="flex flex-wrap items-center gap-1 pt-0.5">
                          {ann.tags.slice(0, 2).map((tag) => (
                            <span
                              key={tag}
                              className="px-1.5 py-0.5 rounded-[2px] bg-[#38BDF8]/10 border border-[#38BDF8]/30 font-mono text-[9px] font-bold text-[#38BDF8]"
                            >
                              #{tag}
                            </span>
                          ))}
                          {ann.tags.length > 2 && (
                            <span className="font-mono text-[9px] text-[#64748B]">
                              +{ann.tags.length - 2}
                            </span>
                          )}
                          {ann.note.trim().length > 0 && (
                            <span
                              title={ann.note}
                              className="inline-flex items-center gap-0.5 font-mono text-[9px] text-[#94A3B8]"
                            >
                              <NotePencil size={10} weight="bold" aria-hidden="true" />
                              <span>{tr('Note', 'Ghi chú')}</span>
                            </span>
                          )}
                        </div>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => void handleTogglePinMatch(v)}
                      aria-label={
                        v.is_pinned
                          ? tr(`Unpin match on ${v.map_name}`, `Bỏ ghim trận ${v.map_name}`)
                          : tr(`Pin match on ${v.map_name}`, `Ghim trận ${v.map_name}`)
                      }
                      title={
                        v.is_pinned
                          ? tr('Unpin this match', 'Bỏ ghim trận này')
                          : tr(
                              'Pin match (protects clips from 20-match auto-cleanup)',
                              'Ghim trận (giữ lại không bị xóa khi đầy 20 trận)'
                            )
                      }
                      className={`px-2 border-l border-[#232B3B]/70 flex items-center justify-center transition duration-150 ${
                        v.is_pinned
                          ? 'text-[#E59A23] bg-[#E59A23]/10 hover:bg-[#E59A23]/20'
                          : 'text-[#64748B] hover:text-[#EEF2F6] hover:bg-[#171D28]'
                      }`}
                    >
                      <PushPin
                        size={14}
                        weight={v.is_pinned ? 'fill' : 'bold'}
                        aria-hidden="true"
                      />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </aside>

        {/* Center Column: Replay Theater & Round Matrix */}
        <section
          aria-label={tr('Replay Theater and Round Timeline', 'Trình phát replay và diễn biến round')}
          className="lg:col-span-6"
        >
          <ReplayPlayer
            gameType={activeGameTab}
            matchId={activeMatch?.match_id || null}
            hasSelectedMatch={Boolean(activeMatch)}
            videoSrc={videoSrc}
            clips={matchClips}
            matchTitle={
              activeMatch ? `${activeMatch.map_name} (${activeMatch.match_result})` : ''
            }
            rounds={rounds}
            selectedRound={selectedRound}
            onSelectRound={setSelectedRound}
            onOpenHighlightsFolder={isElectronRuntime ? handleOpenHighlightsFolder : undefined}
            dataRevision={dataRevision}
            onHighlightSaved={(cloudUrl) => {
              setVideoSrc(cloudUrl);
              setStatusMsg(
                tr('Uploaded highlight video to cloud.', 'Đã lưu video highlight lên hệ thống.')
              );
              setVideos((prev) =>
                prev.map((item) =>
                  item.match_id === activeMatch?.match_id
                    ? { ...item, cloud_video_url: cloudUrl }
                    : item
                )
              );
            }}
          />
        </section>

        {/* Right Column: Tactical Report, Personal Notes & AI Coach */}
        <aside
          aria-label={tr('Tactical Report', 'Báo cáo chiến thuật')}
          className="lg:col-span-3"
        >
          <TacticalReport
            gameType={activeGameTab}
            matchId={activeMatch?.match_id || null}
            mapName={activeMatch?.map_name || ''}
            activeRound={activeRound}
            report={report}
            rounds={rounds}
            mapTelemetry={mapTelemetry}
            dataRevision={dataRevision}
            onAnnotationChange={() => setDataRevision((r) => r + 1)}
          />
        </aside>
      </main>

      <AppFooterVersion
        isElectronRuntime={isElectronRuntime}
        onOpenSettings={() => openSettingsAt('GENERAL')}
      />

      <FriendsLeaderboard
        isOpen={showLeaderboard}
        initialGame={activeGameTab}
        currentUserId={profile?.id}
        onClose={() => setShowLeaderboard(false)}
      />

      <MatchTrendModal
        isOpen={showTrendModal}
        gameType={activeGameTab}
        matches={tabBaseVideos.slice(0, 20)}
        onClose={() => setShowTrendModal(false)}
      />

      <TacticalBoardModal
        isOpen={showTacticalBoard}
        initialGame={activeGameTab}
        initialMapName={activeMatch?.map_name || ''}
        dataRevision={dataRevision}
        onClose={() => setShowTacticalBoard(false)}
      />

      {sharedSettingsModal}

      <PostMatchRecapToast
        isOpen={showPostMatchRecap}
        gameType={activeGameTab}
        mapName={activeMatch?.map_name || ''}
        matchResult={activeMatch?.match_result || ''}
        scoreSummary={activeMatch?.score_summary}
        report={report}
        onClose={() => setShowPostMatchRecap(false)}
      />

      <UpdateBanner />
    </div>
  );
};

const App: React.FC = () => {
  const [appSettings, setAppSettings] = useState<AppUserSettings>(() => loadAppSettings());

  useEffect(() => {
    document.documentElement.lang = appSettings.language;
  }, [appSettings.language]);

  const handleUpdateAppSettings = useCallback((patch: Partial<AppUserSettings>) => {
    setAppSettings((prev) => saveAppSettings({ ...prev, ...patch }));
  }, []);

  const handleReplaceAppSettings = useCallback((full: AppUserSettings) => {
    setAppSettings(saveAppSettings(full));
  }, []);

  const handleChangeLang = useCallback((nextLang: AppLanguage) => {
    setAppSettings((prev) => saveAppSettings({ ...prev, language: nextLang }));
  }, []);

  return (
    <I18nProvider lang={appSettings.language} onChangeLang={handleChangeLang}>
      <AppContent
        appSettings={appSettings}
        onUpdateAppSettings={handleUpdateAppSettings}
        onReplaceAppSettings={handleReplaceAppSettings}
      />
    </I18nProvider>
  );
};

export default App;

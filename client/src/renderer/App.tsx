import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  ArrowRight,
  ArrowsClockwise,
  Broadcast,
  ChartBar,
  Crosshair,
  FolderOpen,
  HardDrive,
  LinkBreak,
  LinkSimple,
  MagnifyingGlass,
  PushPin,
  Record,
  ShareNetwork,
  ShieldCheck,
  SignOut,
  SlidersHorizontal,
  Swap,
  Trophy,
  VideoCamera,
  X,
} from '@phosphor-icons/react';
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
import { SettingsVaultModal } from './components/SettingsVaultModal';
import { PostMatchRecapToast } from './components/PostMatchRecapToast';
import { MatchTrendModal } from './components/MatchTrendModal';
import { StorageManagerModal } from './components/StorageManagerModal';

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
            Phiên bản mới <b className="text-[#10B981]">v{updateState.version}</b> sẵn sàng
          </span>
          <button
            type="button"
            onClick={() => (window as any).electronUpdater?.downloadUpdate()}
            className="bg-[#10B981] hover:bg-emerald-400 text-[#0A0D12] font-bold text-xs px-3 py-1.5 rounded-[2px] transition duration-150 active:translate-y-[1px]"
          >
            Cập nhật ngay
          </button>
        </>
      )}

      {updateState.status === 'downloading' && (
        <span className="text-xs font-mono text-[#38BDF8] tabular-nums">
          Đang tải bản cập nhật... <b>{updateState.percent ?? 0}%</b>
        </span>
      )}

      {updateState.status === 'downloaded' && (
        <>
          <span className="text-xs font-mono">Tải hoàn tất</span>
          <button
            type="button"
            onClick={() => (window as any).electronUpdater?.installUpdate()}
            className="bg-[#38BDF8] hover:bg-sky-300 text-[#0A0D12] font-bold text-xs px-3 py-1.5 rounded-[2px] transition duration-150 active:translate-y-[1px]"
          >
            Khởi động lại
          </button>
        </>
      )}
    </div>
  );
};

const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.6.1';

const AppFooterVersion: React.FC<{ isElectronRuntime?: boolean }> = ({
  isElectronRuntime = false,
}) => {
  const [checking, setChecking] = useState(false);
  const [checkNote, setCheckNote] = useState<string | null>(null);

  const handleCheckUpdate = async () => {
    const updater = (window as any).electronUpdater;
    if (!updater?.checkForUpdates) return;
    setChecking(true);
    setCheckNote('Đang kiểm tra bản mới...');
    try {
      const res = await updater.checkForUpdates();
      if (res && res.packaged === false) {
        setCheckNote('Đang chạy bản Dev cục bộ.');
      } else {
        setCheckNote('Đã kiểm tra cập nhật.');
      }
    } catch {
      setCheckNote('Không thể kiểm tra cập nhật lúc này.');
    } finally {
      setChecking(false);
      window.setTimeout(() => setCheckNote(null), 4000);
    }
  };

  return (
    <footer className="border-t border-[#232B3B] bg-[#0A0D12] px-5 py-2 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-[#94A3B8]">
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
        {isElectronRuntime && (window as any).electronUpdater?.checkForUpdates && (
          <button
            type="button"
            disabled={checking}
            onClick={() => void handleCheckUpdate()}
            className="px-2 py-0.5 rounded-[2px] bg-[#171D28] hover:bg-[#232B3B] border border-[#232B3B] text-[#94A3B8] hover:text-[#EEF2F6] disabled:opacity-50 transition duration-150"
          >
            {checking ? 'Đang kiểm tra...' : 'Kiểm tra cập nhật'}
          </button>
        )}
      </div>
    </footer>
  );
};

const App: React.FC = () => {
  const reduceMotion = useReducedMotion();
  const [token, setTokenState] = useState<string | null>(() => getAuthToken());
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [videos, setVideos] = useState<SavedMatchItem[]>([]);
  const [activeGameTab, setActiveGameTab] = useState<'VALORANT' | 'PUBG'>('PUBG');
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

  const [searchGame, setSearchGame] = useState<'PUBG' | 'VALORANT'>('PUBG');
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<PlayerSearchResult | null>(null);

  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showSettingsVault, setShowSettingsVault] = useState(false);
  const [showPostMatchRecap, setShowPostMatchRecap] = useState(false);
  const [showTrendModal, setShowTrendModal] = useState(false);
  const [showStorageModal, setShowStorageModal] = useState(false);
  const [matchSearchText, setMatchSearchText] = useState('');
  const [matchFilterMode, setMatchFilterMode] = useState<'ALL' | 'WINS' | 'CLIPS' | 'PINNED'>('ALL');

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
  const pollIntervalRef = useRef<number | null>(null);
  const isBackgroundSyncingRef = useRef(false);
  const prevActiveGameRef = useRef<'VALORANT' | 'PUBG' | null>(null);
  const autoRefreshTriggerRef = useRef<((showToastOnNew?: boolean, isManual?: boolean) => Promise<void>) | null>(null);

  const serverRootUrl = API_BASE_URL.replace(/\/api\/?$/, '');

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

          // Khi vua thoat game, cho 10s de server API chot tran roi tu dong dong bo
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
        `Đã cắt Highlight: ${clip.fileName} (tự động ghép vào trận khi đồng bộ xong).`
      );
    });

    desktopRingRecorder.setOnBlackScreen(() => {
      setBlackFrameAlert(true);
      setStatusMsg(
        'Phát hiện khung hình quay bị đen khi chơi Fullscreen. Bấm nút "Sửa lỗi đen hình Fullscreen" ở cột trái để khắc phục.'
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
      setStatusMsg(err.message || 'Lỗi tải chi tiết phân tích trận đấu.');
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
        if (!preferredTab && loadedProfile) {
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
              `Đã tự động cắt và gắn clip Highlight cho ${newlyMatchedIds.length} trận vừa xong.`
            );
          }
        } else {
          resetSelection();
        }
      } catch (err: any) {
        setStatusMsg(err.message || 'Không thể tải danh sách trận đấu.');
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

        // 1. Tu dong dong bo tran dau moi nhat tu API chinh thuc theo tab dang mo
        if (
          currentTab === 'PUBG' &&
          (profile?.pubg_player_name || profile?.steam_persona_name)
        ) {
          const res = await syncRealPubgMatches();
          if (res.syncedCount > 0) {
            await loadUserVideos('PUBG');
            if (showToastOnNew) {
              setStatusMsg(res.message);
              setShowPostMatchRecap(true);
            }
            setLastSyncedAt(new Date().toLocaleTimeString('vi-VN', { hour12: false }));
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
              setStatusMsg(res.message);
              setShowPostMatchRecap(true);
            }
            setLastSyncedAt(new Date().toLocaleTimeString('vi-VN', { hour12: false }));
            return;
          }
        }

        // 2. Tai lai danh sach tu may chu (nhan tran moi tu Overwolf hoac thiet bi khac)
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
              `Phát hiện trận ${currentTab} mới, đã tự động làm mới lịch sử 20 trận gần nhất.`
            );
            setShowPostMatchRecap(true);
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
            setStatusMsg(`Lịch sử 20 trận ${currentTab} đã là mới nhất.`);
          }
        }

        setLastSyncedAt(new Date().toLocaleTimeString('vi-VN', { hour12: false }));
      } catch (err: any) {
        if (isManual) {
          setStatusMsg(err?.message || 'Không thể đồng bộ lịch sử trận đấu lúc này.');
        }
      } finally {
        isBackgroundSyncingRef.current = false;
        setAutoRefreshing(false);
      }
    };

    autoRefreshTriggerRef.current = syncAndCheckMatches;

    // Dong bo ngam ngay sau khi mo app / chuyen tab (khong bat popup lam phien)
    const initialTimer = window.setTimeout(() => {
      void syncAndCheckMatches(false, false);
    }, 2000);

    // Tu dong lam moi lich su moi 1 phut (60.000ms)
    const intervalTimer = window.setInterval(() => {
      void syncAndCheckMatches(true, false);
    }, 60000);

    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(intervalTimer);
    };
  }, [
    token,
    activeGameTab,
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
      setStatusMsg(err.message || 'Không tìm thấy người chơi này.');
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
        // Bỏ qua lỗi mạng tạm thời trong lúc chờ người dùng đăng nhập trên trình duyệt
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
        'Đã mở trang đăng nhập trên trình duyệt. Hoàn tất xác thực để tự động quay lại ứng dụng.'
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
        'Đã mở trình duyệt mặc định để xác thực tài khoản. Ứng dụng sẽ tự động đăng nhập sau khi hoàn tất.'
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
        'Riot Sign On (RSO) chưa sẵn sàng vì máy chủ chưa có RIOT_CLIENT_ID & RIOT_CLIENT_SECRET chính thức từ Riot Developer Portal.'
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
      setStatusMsg(err.message || 'Không thể khởi tạo liên kết Riot Sign On.');
    }
  };

  const handleLinkSteamAccount = async () => {
    setStatusMsg(null);
    const { mode, returnTo, sessionId } = getClientReturnConfig();
    try {
      const { authUrl } = await prepareSteamLinkUrl({ returnTo, sessionId });
      openAuthFlow(authUrl, mode, sessionId);
    } catch (err: any) {
      setStatusMsg(err.message || 'Không thể khởi tạo liên kết Steam.');
    }
  };

  const handleSyncPubg = async () => {
    setSyncingPubg(true);
    setStatusMsg(null);
    try {
      const res = await syncRealPubgMatches();
      setStatusMsg(res.message);
      await loadUserVideos('PUBG');
    } catch (err: any) {
      setStatusMsg(err.message || 'Không thể đồng bộ trận PUBG.');
    } finally {
      setSyncingPubg(false);
    }
  };

  const handleSyncValorant = async () => {
    setSyncingValorant(true);
    setStatusMsg(null);
    try {
      const res = await syncRealValorantMatches();
      setStatusMsg(res.message);
      await loadUserVideos('VALORANT');
    } catch (err: any) {
      setStatusMsg(err.message || 'Không thể đồng bộ trận VALORANT.');
    } finally {
      setSyncingValorant(false);
    }
  };

  const handleCopyShareLink = async (matchId: string) => {
    const shareUrl = `${API_BASE_URL}/analyze/public-match/${encodeURIComponent(matchId)}`;
    await navigator.clipboard.writeText(shareUrl);
    setStatusMsg(`Đã sao chép link chia sẻ trận đấu: ${shareUrl}`);
  };

  const handleToggleCaptureMode = (nextMode: CaptureMode) => {
    setCaptureMode(nextMode);
    setCaptureModeState(nextMode);
    setStatusMsg(
      nextMode === 'HIGHLIGHT_CLIPS'
        ? 'Đã chuyển sang chế độ Highlight (~23s quanh mỗi mạng hạ gục, tiết kiệm dung lượng ổ cứng khi chạy Overwolf).'
        : 'Đã chuyển sang chế độ Quay cả trận (Full Match Replay khi chạy Overwolf).'
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
          ? 'Đã bật tự động chạy ngầm cùng Windows ở khay hệ thống (System Tray).'
          : 'Đã tắt tự động khởi động cùng Windows.'
      );
    } catch {
      setStatusMsg('Không thể thay đổi thiết lập khởi động cùng Windows.');
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
          ? 'Đã bật Tự quay Highlight ngầm (.exe) khi vào VALORANT hoặc PUBG.'
          : 'Đã tạm tắt Tự quay Highlight trong .exe.'
      );
    } catch {
      setStatusMsg('Không thể thay đổi trạng thái quay Highlight.');
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
          ? 'Đã phát hiện Overwolf trên máy! Bạn có thể dùng Overwolf để bắt kill trực tiếp.'
          : 'Chưa phát hiện Overwolf. Ứng dụng đang dùng bộ quay Desktop Auto-Clip + F9 tích hợp sẵn.'
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
          'Đã đổi chế độ tương thích Fullscreen. Hãy mở lại ứng dụng để áp dụng ngay.'
        );
      } else if (next.captureQuality) {
        setStatusMsg(
          next.captureQuality === '720p30'
            ? 'Đã chọn chất lượng 720p 30fps (tối ưu giữ nguyên FPS khi bắn Fullscreen).'
            : 'Đã chọn chất lượng 1080p 60fps.'
        );
      } else if (next.hotkey) {
        setStatusMsg(`Đã đổi phím cắt Highlight nhanh sang ${next.hotkey}.`);
      } else if (typeof next.micEnabled === 'boolean') {
        setStatusMsg(
          next.micEnabled
            ? 'Đã BẬT thu tiếng Micro cùng âm thanh game (áp dụng cho phiên quay tiếp theo).'
            : 'Đã TẮT thu tiếng Micro khi quay.'
        );
      } else if (typeof next.beepEnabled === 'boolean') {
        setStatusMsg(
          next.beepEnabled
            ? 'Đã BẬT âm báo Beep xác nhận khi cắt Highlight.'
            : 'Đã TẮT âm báo Beep.'
        );
      } else if (typeof next.maxStorageGb === 'number') {
        setStatusMsg(`Đã đặt giới hạn kho clip cục bộ tối đa ${next.maxStorageGb} GB.`);
      }
    } catch {
      setStatusMsg('Không thể cập nhật tùy chọn quay màn hình.');
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
          ? `Đã ghim trận ${match.map_name}. Trận này và clip sẽ được giữ lại, không bị xóa khi vượt 20 trận.`
          : `Đã bỏ ghim trận ${match.map_name}.`
      );
    } catch (err: any) {
      setVideos((prev) =>
        prev.map((m) => (m.match_id === match.match_id ? { ...m, is_pinned: !nextPinned } : m))
      );
      setStatusMsg(err?.message || 'Không thể cập nhật trạng thái ghim trận.');
    }
  };

  const handleOpenHighlightsFolder = () => {
    const electronAPI = (window as any).electronAPI;
    if (electronAPI?.openHighlightsFolder) {
      void electronAPI.openHighlightsFolder();
    } else {
      setShowStorageModal(true);
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
            ? 'Khung hình kiểm tra bị ĐEN do Fullscreen. Bấm nút sửa lỗi ngay bên dưới khung Test quay để chuyển chế độ tương thích.'
            : 'Không lấy được luồng màn hình. Kiểm tra quyền quay màn hình Windows.'
        );
      } else {
        setBlackFrameAlert(false);
        setStatusMsg(
          `Kiểm tra OK (${res.width}x${res.height}): Đang bắt được hình ảnh rõ nét!`
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
      setStatusMsg('Vui lòng nhập chính xác In-Game Name (IGN) PUBG của bạn.');
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
      setStatusMsg(res.message);
      await loadUserVideos('PUBG');
    } catch (err: any) {
      setStatusMsg(err.message || 'Không thể xác minh IGN PUBG.');
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
      setStatusMsg(res.message);
      await loadUserVideos(activeGameTab);
    } catch (err: any) {
      setStatusMsg(err.message || 'Không thể hủy liên kết tài khoản Riot.');
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

  // ==========================================================================
  // 1. TRANG GIOI THIEU & XAC THUC (ASYMMETRIC TELEMETRY LANDING)
  // ==========================================================================
  if (!token) {
    return (
      <div className="min-h-[100dvh] bg-[#0A0D12] tactical-grid-bg text-[#EEF2F6] flex flex-col">
        <header className="h-16 border-b border-[#232B3B] bg-[#0A0D12]/90 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto h-full px-6 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-[2px] bg-[#FF4655] flex items-center justify-center font-display font-bold text-[#EEF2F6] text-sm">
                TR
              </div>
              <span className="font-display text-lg font-bold tracking-tight text-[#EEF2F6]">
                TacticalReplay<span className="text-[#FF4655]">AI</span>
              </span>
            </div>

            <div className="flex items-center gap-4">
              <nav aria-label="Pháp lý và tuân thủ" className="hidden sm:flex items-center gap-4 text-xs text-[#94A3B8]">
                <a
                  href={`${serverRootUrl}/privacy`}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-[#EEF2F6] transition duration-150"
                >
                  Chính sách bảo mật
                </a>
                <a
                  href={`${serverRootUrl}/terms`}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-[#EEF2F6] transition duration-150"
                >
                  Điều khoản
                </a>
              </nav>

              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-[2px] bg-[#10B981]/10 border border-[#10B981]/30 font-mono text-[11px] font-bold text-[#10B981]">
                <ShieldCheck size={14} weight="bold" aria-hidden="true" />
                <span>Tuân thủ Vanguard &amp; BattlEye</span>
              </span>
            </div>
          </div>
        </header>

        <main
          id="main-content"
          className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 lg:py-12 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center"
        >
          {/* Cot trai: Hero Briefing + Tra cuu ho so */}
          <motion.section
            aria-label="Giới thiệu và tra cứu người chơi"
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-7 space-y-6"
          >
            <div className="space-y-3">
              <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-[#E59A23] flex items-center gap-2">
                <Broadcast size={14} weight="bold" aria-hidden="true" />
                <span>Xem lại Video Replay &amp; Dữ liệu sau trận</span>
              </p>
              <h1 className="font-display text-[clamp(1.85rem,3.4vw,2.9rem)] font-bold tracking-tight leading-[1.08] text-[#EEF2F6] text-balance">
                Phân tích chiến thuật sau trận đấu cho VALORANT &amp; PUBG
              </h1>
              <p className="text-sm text-[#94A3B8] max-w-[56ch] leading-relaxed">
                Tự động ghi hình highlight, đồng bộ mốc hạ gục theo từng round và nhận đánh giá AI Coach thực chiến.
              </p>
            </div>

            {/* Player Lookup Terminal */}
            <div className="bg-[#10141C] border border-[#232B3B] rounded-[4px] p-4 space-y-4">
              <div className="flex items-center justify-between gap-2 border-b border-[#232B3B] pb-2.5">
                <span className="font-mono text-[11px] font-bold text-[#94A3B8]">
                  TRA CỨU NHANH HỒ SƠ NGƯỜI CHƠI
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
                        ? 'bg-[#FF4655] text-[#EEF2F6]'
                        : 'text-[#94A3B8] hover:text-[#EEF2F6]'
                    }`}
                  >
                    VALORANT
                  </button>
                </div>

                <label htmlFor="landing-player-search" className="sr-only">
                  {searchGame === 'PUBG'
                    ? 'Tên nhân vật PUBG cần tìm'
                    : 'Riot ID đầy đủ cần tìm'}
                </label>
                <input
                  id="landing-player-search"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={
                    searchGame === 'PUBG'
                      ? 'Nhập tên nhân vật PUBG...'
                      : 'Nhập Riot ID#Tag (VD: Player#VN1)...'
                  }
                  className="flex-1 min-w-0 px-3.5 py-2.5 rounded-[2px] bg-[#0A0D12] border border-[#232B3B] text-xs text-[#EEF2F6] placeholder:text-[#64748B] focus:outline-none focus:border-[#38BDF8]"
                />

                <button
                  type="submit"
                  disabled={searching}
                  className={`inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-[2px] font-bold text-xs transition duration-150 shrink-0 disabled:opacity-50 active:translate-y-[1px] ${
                    searchGame === 'PUBG'
                      ? 'bg-[#E59A23] hover:bg-amber-400 text-[#0A0D12]'
                      : 'bg-[#FF4655] hover:bg-rose-500 text-[#EEF2F6]'
                  }`}
                >
                  <MagnifyingGlass size={14} weight="bold" aria-hidden="true" />
                  <span>{searching ? 'Đang tìm...' : 'Tìm kiếm'}</span>
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
                          ? 'Đăng nhập Steam'
                          : 'Đăng nhập RSO'}
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
                              {new Date(m.playedAt).toLocaleDateString('vi-VN')}
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
                      Hồ sơ hợp lệ (ID:{' '}
                      <span className="font-mono text-[#EEF2F6]">
                        {searchResult.player.id.slice(0, 18)}...
                      </span>
                      ). Đăng nhập Riot Sign On để đồng bộ lịch sử trận đấu và video replay.
                    </p>
                  )}
                </div>
              )}
            </div>
          </motion.section>

          {/* Cot phai: Hai cong dang nhap chinh thuc */}
          <motion.section
            aria-label="Cổng đăng nhập tài khoản game"
            initial={reduceMotion ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.06, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-5 space-y-4"
          >
            {/* Card PUBG */}
            <div className="bg-[#10141C] border border-[#232B3B] hover:border-[#E59A23]/60 rounded-[4px] p-5 space-y-4 transition duration-200">
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
                  Không gian chiến thuật PUBG
                </h2>
                <p className="text-xs text-[#94A3B8] leading-relaxed max-w-[45ch]">
                  Theo dõi sát thương theo từng giai đoạn vòng bo (Phase), vũ khí, cự ly hạ gục và video replay tự động.
                </p>
              </div>

              <button
                type="button"
                onClick={handleSteamLogin}
                className="w-full py-3 px-4 rounded-[2px] bg-[#1B2838] hover:bg-[#24364B] border border-[#38BDF8]/35 text-[#EEF2F6] font-bold text-xs transition duration-150 flex items-center justify-center gap-2.5 active:translate-y-[1px]"
              >
                <SteamBrandMark />
                <span>Đăng nhập bằng Steam</span>
              </button>
            </div>

            {/* Card VALORANT */}
            <div className="bg-[#10141C] border border-[#232B3B] hover:border-[#FF4655]/60 rounded-[4px] p-5 space-y-4 transition duration-200">
              <div className="flex items-center justify-between gap-2">
                <span className="px-2 py-0.5 rounded-[2px] bg-[#FF4655]/15 border border-[#FF4655]/40 font-mono text-[10px] font-bold text-[#FF4655]">
                  VALORANT
                </span>
                <span
                  className={`font-mono text-[10px] font-bold ${
                    providers.riotRsoReady ? 'text-[#10B981]' : 'text-[#E59A23]'
                  }`}
                >
                  {providers.riotRsoReady ? 'RSO SẴN SÀNG' : 'CHỜ RSO CLIENT ID'}
                </span>
              </div>

              <div className="space-y-1.5">
                <h2 className="font-display text-lg font-bold text-[#EEF2F6]">
                  Không gian chiến thuật VALORANT
                </h2>
                <p className="text-xs text-[#94A3B8] leading-relaxed max-w-[45ch]">
                  Xác thực chính thức qua Riot Sign On (RSO), phân tích kinh tế round (Eco, Force, Full Buy) và lỗi vị trí.
                </p>
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => handleRiotLogin(false)}
                  className="w-full py-3 px-4 rounded-[2px] bg-[#FF4655] hover:bg-rose-500 text-[#EEF2F6] font-bold text-xs transition duration-150 flex items-center justify-center gap-2.5 active:translate-y-[1px]"
                >
                  <RiotBrandMark />
                  <span>Đăng nhập bằng Riot Sign On (RSO)</span>
                </button>

                {!providers.riotRsoReady && (
                  <p className="font-mono text-[11px] text-[#E59A23] leading-relaxed">
                    Cần cấu hình RIOT_CLIENT_ID &amp; RIOT_CLIENT_SECRET từ Riot Developer Portal trong server/.env.
                  </p>
                )}
              </div>
            </div>
          </motion.section>
        </main>

        <AppFooterVersion isElectronRuntime={isElectronRuntime} />
        <UpdateBanner />
      </div>
    );
  }

  // ==========================================================================
  // 2. KHONG GIAN COCKPIT SAU DANG NHAP (XOAY VONG 20 TRAN & HIGHLIGHT)
  // ==========================================================================
  const isValo = activeGameTab === 'VALORANT';
  const tabBaseVideos = videos.filter((v) => v.game_type === activeGameTab);
  const filteredVideos = tabBaseVideos.filter((v) => {
    const query = matchSearchText.trim().toLowerCase();
    if (query) {
      const haystack = `${v.map_name} ${v.game_mode} ${v.match_result} ${v.score_summary || ''}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    if (matchFilterMode === 'PINNED') return Boolean(v.is_pinned);
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
  const isOverwolfRuntime =
    typeof overwolf !== 'undefined' && Boolean(overwolf.media?.replays || overwolf.streaming);

  return (
    <div className="min-h-[100dvh] bg-[#0A0D12] text-[#EEF2F6] flex flex-col">
      {/* Command Header - 1 dong tren desktop */}
      <header className="min-h-[60px] border-b border-[#232B3B] px-5 py-2.5 bg-[#10141C] flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2.5">
            <div
              className={`h-7 w-7 rounded-[2px] flex items-center justify-center font-display font-bold text-xs ${
                isValo ? 'bg-[#FF4655] text-[#EEF2F6]' : 'bg-[#E59A23] text-[#0A0D12]'
              }`}
            >
              TR
            </div>
            <h1 className="font-display text-base font-bold tracking-tight text-[#EEF2F6]">
              TacticalReplayAI
            </h1>
          </div>

          <div className="flex items-center gap-1 p-1 rounded-[2px] bg-[#0A0D12] border border-[#232B3B]">
            <button
              type="button"
              onClick={() => void handleSwitchGameTab('VALORANT')}
              className={`px-3 py-1.5 rounded-[2px] font-mono text-xs font-bold transition duration-150 active:translate-y-[1px] ${
                isValo
                  ? 'bg-[#FF4655] text-[#EEF2F6]'
                  : 'text-[#94A3B8] hover:text-[#EEF2F6]'
              }`}
            >
              VALORANT ({Math.min(20, videos.filter((v) => v.game_type === 'VALORANT').length)})
            </button>
            <button
              type="button"
              onClick={() => void handleSwitchGameTab('PUBG')}
              className={`px-3 py-1.5 rounded-[2px] font-mono text-xs font-bold transition duration-150 active:translate-y-[1px] ${
                !isValo
                  ? 'bg-[#E59A23] text-[#0A0D12]'
                  : 'text-[#94A3B8] hover:text-[#EEF2F6]'
              }`}
            >
              PUBG ({Math.min(20, videos.filter((v) => v.game_type === 'PUBG').length)})
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowLeaderboard(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[2px] bg-[#171D28] hover:bg-[#232B3B] border border-[#232B3B] text-xs font-semibold text-[#38BDF8] transition duration-150 active:translate-y-[1px]"
            >
              <Trophy size={14} weight="bold" aria-hidden="true" />
              <span>Bảng xếp hạng</span>
            </button>
            <button
              type="button"
              onClick={() => setShowSettingsVault(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[2px] bg-[#171D28] hover:bg-[#232B3B] border border-[#232B3B] text-xs font-semibold text-[#10B981] transition duration-150 active:translate-y-[1px]"
            >
              <SlidersHorizontal size={14} weight="bold" aria-hidden="true" />
              <span>Kho Sens &amp; Tâm</span>
            </button>
            <button
              type="button"
              onClick={() => setShowTrendModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[2px] bg-[#171D28] hover:bg-[#232B3B] border border-[#232B3B] text-xs font-semibold text-[#EEF2F6] transition duration-150 active:translate-y-[1px]"
            >
              <ChartBar size={14} weight="bold" aria-hidden="true" />
              <span>Phong độ 20 trận</span>
            </button>
            <button
              type="button"
              onClick={() => setShowStorageModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[2px] bg-[#171D28] hover:bg-[#232B3B] border border-[#232B3B] text-xs font-semibold text-[#38BDF8] transition duration-150 active:translate-y-[1px]"
            >
              <HardDrive size={14} weight="bold" aria-hidden="true" />
              <span>Kho Clip &amp; R2</span>
            </button>
            {activeMatch && (
              <>
                <button
                  type="button"
                  onClick={() => setShowPostMatchRecap((prev) => !prev)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[2px] bg-[#171D28] hover:bg-[#232B3B] border border-[#232B3B] text-xs font-semibold text-[#E59A23] transition duration-150 active:translate-y-[1px]"
                >
                  <Crosshair size={14} weight="bold" aria-hidden="true" />
                  <span>Tóm tắt trận</span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleCopyShareLink(activeMatch.match_id)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[2px] bg-[#171D28] hover:bg-[#232B3B] border border-[#232B3B] text-xs font-semibold text-[#EEF2F6] transition duration-150 active:translate-y-[1px]"
                >
                  <ShareNetwork size={14} weight="bold" aria-hidden="true" />
                  <span>Chia sẻ link</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Account Pills + Sign Out */}
        <div className="flex items-center gap-2.5">
          {profile?.steam_persona_name && (
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-[2px] bg-[#1B2838] border border-[#38BDF8]/30 text-xs font-semibold text-[#EEF2F6]">
              {profile.steam_avatar && (
                <img
                  src={profile.steam_avatar}
                  alt={`Ảnh đại diện Steam của ${profile.steam_persona_name}`}
                  className="w-4 h-4 rounded-[2px]"
                />
              )}
              <span>{profile.steam_persona_name}</span>
            </div>
          )}

          {profile?.riot_game_name && (
            <span className="px-2.5 py-1 rounded-[2px] bg-[#FF4655]/15 border border-[#FF4655]/40 font-mono text-xs font-semibold text-[#FF4655]">
              {profile.riot_game_name}#{profile.riot_tag_line}
            </span>
          )}

          {!isValo && profile?.pubg_player_name && (
            <span className="px-2.5 py-1 rounded-[2px] bg-[#E59A23]/15 border border-[#E59A23]/40 font-mono text-xs font-semibold text-[#E59A23]">
              IGN: {profile.pubg_player_name}
            </span>
          )}

          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[2px] bg-[#0A0D12] hover:bg-[#F43F5E]/15 border border-[#232B3B] hover:border-[#F43F5E]/40 text-xs text-[#94A3B8] hover:text-[#F43F5E] transition duration-150 active:translate-y-[1px]"
          >
            <SignOut size={14} weight="bold" aria-hidden="true" />
            <span>Đăng xuất</span>
          </button>
        </div>
      </header>

      {statusMsg && (
        <div
          role="status"
          className="bg-[#10141C] border-b border-[#232B3B] px-5 py-2 text-xs text-[#38BDF8] flex justify-between items-center gap-4"
        >
          <span>{statusMsg}</span>
          <button
            type="button"
            aria-label="Đóng thông báo"
            onClick={() => setStatusMsg(null)}
            className="inline-flex items-center gap-1 text-[#94A3B8] hover:text-[#EEF2F6]"
          >
            <X size={13} weight="bold" aria-hidden="true" />
            <span>Đóng</span>
          </button>
        </div>
      )}

      {/* Cockpit Grid */}
      <main
        id="main-content"
        className="flex-1 max-w-[1640px] w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-4 p-4"
      >
        {/* Cot trai: Danh sach 20 tran gan nhat */}
        <aside
          aria-label="Danh sách trận đấu"
          className="lg:col-span-3 bg-[#10141C] border border-[#232B3B] rounded-[4px] p-4 flex flex-col gap-3"
        >
          <div className="flex items-center justify-between border-b border-[#232B3B] pb-2.5">
            <div>
              <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-[#94A3B8] tabular-nums">
                {isValo
                  ? `20 Trận VALORANT (${filteredVideos.length}/20)`
                  : `20 Trận PUBG (${filteredVideos.length}/20)`}
              </h2>
              <p className="font-mono text-[10px] text-[#64748B] tabular-nums mt-0.5">
                {autoRefreshing
                  ? 'Đang tự đồng bộ...'
                  : lastSyncedAt
                    ? `Tự làm mới 1 phút/lần (${lastSyncedAt})`
                    : 'Tự làm mới mỗi 1 phút'}
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
              <span>Làm mới</span>
            </button>
          </div>

          {/* Trang thai Overwolf Auto-Capture, chay ngam System Tray & che do quay */}
          <div className="rounded-[2px] border border-[#232B3B] bg-[#0A0D12] p-2.5 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span
                className={`inline-flex items-center gap-1.5 font-mono text-[11px] font-bold ${
                  isOverwolfRuntime
                    ? 'text-[#10B981]'
                    : isElectronRuntime
                      ? 'text-[#38BDF8]'
                      : 'text-[#94A3B8]'
                }`}
              >
                <Record size={12} weight="fill" aria-hidden="true" />
                <span>
                  {isOverwolfRuntime
                    ? 'Overwolf Auto-Capture'
                    : isElectronRuntime
                      ? 'Desktop Tray (Chạy ngầm)'
                      : 'Web Replay'}
                </span>
              </span>
              <span className="font-mono text-[10px] text-[#64748B]">
                {captureMode === 'HIGHLIGHT_CLIPS' ? '~23s/Kill' : 'Full Match'}
              </span>
            </div>

            <div
              role="group"
              aria-label="Chế độ quay video tự động"
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
                Quay cả trận
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
                Highlight ~23s
              </button>
            </div>

            {isElectronRuntime && !isOverwolfRuntime && (
              <div className="pt-1.5 border-t border-[#232B3B]/80 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[10px] font-bold text-[#94A3B8]">
                    {desktopCaptureStatus?.shouldRecord
                      ? `ĐANG QUAY ${desktopCaptureStatus.activeGame} (25s/đoạn)`
                      : desktopCaptureStatus?.overwolfRunning
                        ? 'Overwolf đang chạy (ưu tiên Overwolf)'
                        : desktopCaptureStatus?.desktopCaptureEnabled
                          ? 'Đang chờ vào VALORANT / PUBG'
                          : 'Tự quay Highlight (.exe) đang tắt'}
                  </span>
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      desktopCaptureStatus?.shouldRecord
                        ? 'bg-[#10B981] animate-pulse'
                        : 'bg-[#38BDF8]'
                    }`}
                    aria-hidden="true"
                  />
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-[#94A3B8]">
                    Tự quay ngầm (.exe + F9)
                  </span>
                  <button
                    type="button"
                    aria-pressed={desktopCaptureStatus?.desktopCaptureEnabled ?? true}
                    onClick={() => void handleToggleDesktopCapture()}
                    className={`px-2 py-0.5 rounded-[2px] font-mono text-[10px] font-bold border transition duration-150 ${
                      desktopCaptureStatus?.desktopCaptureEnabled ?? true
                        ? 'bg-[#10B981]/15 border-[#10B981]/40 text-[#10B981]'
                        : 'bg-[#171D28] border-[#232B3B] text-[#64748B] hover:text-[#94A3B8]'
                    }`}
                  >
                    {desktopCaptureStatus?.desktopCaptureEnabled ?? true ? 'ĐANG BẬT' : 'ĐANG TẮT'}
                  </button>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-[#94A3B8]">
                    Chạy ngầm cùng Windows
                  </span>
                  <button
                    type="button"
                    aria-pressed={autoStartEnabled}
                    onClick={() => void handleToggleAutoStart()}
                    className={`px-2 py-0.5 rounded-[2px] font-mono text-[10px] font-bold border transition duration-150 ${
                      autoStartEnabled
                        ? 'bg-[#10B981]/15 border-[#10B981]/40 text-[#10B981]'
                        : 'bg-[#171D28] border-[#232B3B] text-[#64748B] hover:text-[#94A3B8]'
                    }`}
                  >
                    {autoStartEnabled ? 'ĐANG BẬT' : 'ĐANG TẮT'}
                  </button>
                </div>

                <div className="space-y-1.5 pt-1 border-t border-[#232B3B]/60">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-mono text-[#94A3B8]">
                      Chất lượng (FPS)
                    </span>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          void handleUpdateCaptureOptions({ captureQuality: '720p30' })
                        }
                        className={`px-1.5 py-0.5 rounded-[2px] font-mono text-[10px] border ${
                          (desktopCaptureStatus?.captureQuality || '720p30') === '720p30'
                            ? 'bg-[#10B981]/15 border-[#10B981]/40 text-[#10B981] font-bold'
                            : 'bg-[#171D28] border-[#232B3B] text-[#64748B]'
                        }`}
                      >
                        720p30 (Nhẹ)
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          void handleUpdateCaptureOptions({ captureQuality: '1080p60' })
                        }
                        className={`px-1.5 py-0.5 rounded-[2px] font-mono text-[10px] border ${
                          desktopCaptureStatus?.captureQuality === '1080p60'
                            ? 'bg-[#38BDF8]/15 border-[#38BDF8]/40 text-[#38BDF8] font-bold'
                            : 'bg-[#171D28] border-[#232B3B] text-[#64748B]'
                        }`}
                      >
                        1080p60
                      </button>
                    </div>
                  </div>

                  {desktopCaptureStatus?.captureCompatMode === 'dxgi' && (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-mono text-[#E59A23]">
                        Chống đen Fullscreen: BẬT
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          void handleUpdateCaptureOptions({ captureCompatMode: 'wgc' })
                        }
                        className="px-1.5 py-0.5 rounded-[2px] bg-[#171D28] hover:bg-[#232B3B] border border-[#232B3B] text-[10px] font-mono text-[#94A3B8]"
                      >
                        Về mặc định
                      </button>
                    </div>
                  )}

                  {compatNeedsRestart && (
                    <button
                      type="button"
                      onClick={() => void (window as any).electronAPI?.relaunchApp?.()}
                      className="w-full py-1 px-2 rounded-[2px] bg-[#E59A23] hover:bg-amber-400 text-[#0A0D12] font-mono text-[10px] font-bold transition duration-150"
                    >
                      Khởi động lại app để áp dụng
                    </button>
                  )}

                  {screenSources.length > 1 && (
                    <div className="flex items-center justify-between gap-2">
                      <label
                        htmlFor="capture-screen-select"
                        className="text-[10px] font-mono text-[#94A3B8] shrink-0"
                      >
                        Màn hình
                      </label>
                      <select
                        id="capture-screen-select"
                        value={desktopCaptureStatus?.preferredScreenId || ''}
                        onChange={(e) =>
                          void handleUpdateCaptureOptions({
                            preferredScreenId: e.target.value || null,
                          })
                        }
                        className="flex-1 min-w-0 px-1.5 py-0.5 rounded-[2px] bg-[#10141C] border border-[#232B3B] text-[10px] font-mono text-[#EEF2F6]"
                      >
                        <option value="">Mặc định (Màn chính)</option>
                        {screenSources.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} {s.isPrimary ? '(Chính)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => void desktopRingRecorder.triggerF9Highlight(activeGameTab)}
                    className="flex-1 py-1 px-2 rounded-[2px] bg-[#171D28] hover:bg-[#232B3B] border border-[#E59A23]/40 text-[10px] font-mono font-bold text-[#E59A23] transition duration-150"
                  >
                    Cắt ngay ({desktopCaptureStatus?.hotkey || 'F9'})
                  </button>
                  <button
                    type="button"
                    disabled={testingCapture}
                    onClick={() => void handleTestCaptureFrame()}
                    className="py-1 px-2 rounded-[2px] bg-[#171D28] hover:bg-[#232B3B] border border-[#38BDF8]/40 text-[10px] font-mono font-bold text-[#38BDF8] disabled:opacity-50 transition duration-150"
                  >
                    {testingCapture ? 'Đang thử...' : 'Test quay'}
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenHighlightsFolder}
                    aria-label="Mở thư mục lưu clip"
                    title="Mở thư mục lưu clip trên máy"
                    className="p-1 rounded-[2px] bg-[#171D28] hover:bg-[#232B3B] border border-[#232B3B] text-[#94A3B8] hover:text-[#EEF2F6] transition duration-150"
                  >
                    <FolderOpen size={13} weight="bold" aria-hidden="true" />
                  </button>
                </div>

                {blackFrameAlert && (
                  <div className="p-2 rounded-[2px] bg-[#F43F5E]/10 border border-[#F43F5E]/30 space-y-1.5">
                    <p className="text-[10px] text-[#F43F5E] leading-relaxed">
                      {desktopCaptureStatus?.captureCompatMode === 'dxgi'
                        ? 'Khung hình vẫn bị đen dù đang bật chế độ tương thích Fullscreen. Hãy chuyển game sang Windowed Fullscreen, hoặc cài Overwolf để quay mượt.'
                        : 'Video đang bị đen do game chạy Fullscreen. Thử chuyển sang chế độ tương thích để khắc phục ngay:'}
                    </p>
                    {desktopCaptureStatus?.captureCompatMode !== 'dxgi' && (
                      <button
                        type="button"
                        onClick={() =>
                          void handleUpdateCaptureOptions({ captureCompatMode: 'dxgi' })
                        }
                        className="w-full py-1 px-2 rounded-[2px] bg-[#E59A23] hover:bg-amber-400 text-[#0A0D12] font-mono text-[10px] font-bold transition duration-150"
                      >
                        Bật chống đen Fullscreen &amp; Khởi động lại
                      </button>
                    )}
                  </div>
                )}

                <div className="pt-1 border-t border-[#232B3B]/60 flex items-center justify-between gap-1.5">
                  <span className="text-[10px] text-[#64748B]">
                    Overwolf:{' '}
                    <b
                      className={
                        desktopCaptureStatus?.overwolfInstalled
                          ? 'text-[#10B981]'
                          : 'text-[#E59A23]'
                      }
                    >
                      {desktopCaptureStatus?.overwolfInstalled ? 'Đã cài' : 'Chưa cài'}
                    </b>
                  </span>
                  <div className="flex items-center gap-1">
                    {!desktopCaptureStatus?.overwolfInstalled && (
                      <button
                        type="button"
                        onClick={handleOpenOverwolfDownload}
                        className="px-2 py-0.5 rounded-[2px] bg-[#171D28] hover:bg-[#232B3B] border border-[#38BDF8]/40 text-[10px] font-mono font-bold text-[#38BDF8]"
                      >
                        Tải Overwolf
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={checkingOverwolf}
                      onClick={() => void handleCheckOverwolf()}
                      className="px-2 py-0.5 rounded-[2px] bg-[#171D28] hover:bg-[#232B3B] border border-[#232B3B] text-[10px] font-mono text-[#94A3B8] disabled:opacity-50"
                    >
                      {checkingOverwolf ? '...' : 'Kiểm tra'}
                    </button>
                  </div>
                </div>

                <p className="text-[10px] text-[#64748B] leading-relaxed">
                  Mặc định quay 720p30 giữ nguyên FPS tối đa cho Fullscreen (Win 10/11). Dùng nút Test quay để kiểm tra trực tiếp.
                </p>
              </div>
            )}
          </div>

          {!isValo && (
            <form
              onSubmit={(e) => void handleSavePubgIgn(e)}
              className="rounded-[2px] border border-[#232B3B] bg-[#0A0D12] p-2.5 space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="pubg-ign-input"
                  className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#94A3B8]"
                >
                  PUBG IGN
                </label>
                {profile?.pubg_account_id && (
                  <span className="font-mono text-[10px] text-[#10B981]">ĐÃ XÁC MINH</span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  id="pubg-ign-input"
                  type="text"
                  value={pubgIgnInput}
                  onChange={(e) => setPubgIgnInput(e.target.value)}
                  placeholder={profile?.steam_persona_name || 'Nhập IGN PUBG chính xác...'}
                  className="flex-1 min-w-0 px-2.5 py-1.5 rounded-[2px] bg-[#10141C] border border-[#232B3B] focus:border-[#E59A23] text-xs font-mono text-[#EEF2F6] placeholder-[#64748B] focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={savingPubgIgn}
                  className="px-2.5 py-1.5 rounded-[2px] bg-[#171D28] hover:bg-[#232B3B] border border-[#E59A23]/40 text-xs font-bold text-[#E59A23] disabled:opacity-50 transition duration-150 shrink-0"
                >
                  {savingPubgIgn ? 'Đang lưu...' : 'Lưu IGN'}
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
              {syncingPubg ? 'Đang đồng bộ 20 trận PUBG...' : 'Đồng bộ 20 trận PUBG gần nhất'}
            </button>
          )}

          {!isValo && !profile?.steam_id && (
            <button
              type="button"
              onClick={() => void handleLinkSteamAccount()}
              className="inline-flex items-center justify-center gap-1.5 w-full py-2 px-3 rounded-[2px] bg-[#1B2838] hover:bg-[#24364B] border border-[#38BDF8]/35 text-[#EEF2F6] font-bold text-xs transition duration-150 active:translate-y-[1px]"
            >
              <LinkSimple size={14} weight="bold" aria-hidden="true" />
              <span>Liên kết tài khoản Steam</span>
            </button>
          )}

          {isValo && !hasRiotLinked && (
            <button
              type="button"
              onClick={() => void handleLinkRiotAccount()}
              className="inline-flex items-center justify-center gap-1.5 w-full py-2 px-3 rounded-[2px] bg-[#FF4655] hover:bg-rose-500 text-[#EEF2F6] font-bold text-xs transition duration-150 active:translate-y-[1px]"
            >
              <LinkSimple size={14} weight="bold" aria-hidden="true" />
              <span>Liên kết Riot Sign On (RSO)</span>
            </button>
          )}

          {isValo && hasRiotLinked && (
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => void handleSyncValorant()}
                disabled={syncingValorant}
                className="w-full py-2 px-3 rounded-[2px] bg-[#FF4655] hover:bg-rose-500 disabled:opacity-50 text-[#EEF2F6] font-bold text-xs transition duration-150 active:translate-y-[1px]"
              >
                {syncingValorant
                  ? 'Đang đồng bộ 20 trận VALORANT...'
                  : 'Đồng bộ 20 trận VALORANT gần nhất'}
              </button>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleRiotLogin(true)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-[2px] bg-[#171D28] hover:bg-[#232B3B] border border-[#232B3B] text-[11px] font-semibold text-[#EEF2F6] transition duration-150"
                >
                  <Swap size={13} weight="bold" aria-hidden="true" />
                  <span>Đổi nick Riot</span>
                </button>
                {profile?.steam_id && (
                  <button
                    type="button"
                    onClick={() => void handleUnlinkRiot()}
                    disabled={unlinkingRiot}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-[2px] bg-[#171D28] hover:bg-[#F43F5E]/15 border border-[#232B3B] hover:border-[#F43F5E]/40 text-[11px] font-semibold text-[#F43F5E] disabled:opacity-50 transition duration-150"
                  >
                    <LinkBreak size={13} weight="bold" aria-hidden="true" />
                    <span>{unlinkingRiot ? 'Đang gỡ...' : 'Hủy liên kết'}</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {tabBaseVideos.length > 0 && !loading && (
            <div className="space-y-1.5 rounded-[2px] border border-[#232B3B] bg-[#0A0D12] p-2">
              <div className="relative">
                <label htmlFor="match-search-input" className="sr-only">
                  Tìm kiếm trận đấu theo map hoặc kết quả
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
                  placeholder="Tìm map, mode, top..."
                  className="w-full pl-6 pr-2 py-1 rounded-[2px] bg-[#10141C] border border-[#232B3B] focus:border-[#38BDF8] text-[11px] font-mono text-[#EEF2F6] placeholder-[#64748B] focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-4 gap-1">
                {(
                  [
                    { id: 'ALL', label: 'Tất cả' },
                    { id: 'WINS', label: 'Thắng/#1' },
                    { id: 'CLIPS', label: 'Có Clip' },
                    { id: 'PINNED', label: 'Đã ghim' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setMatchFilterMode(tab.id)}
                    className={`py-1 px-1 rounded-[2px] font-mono text-[10px] font-bold transition duration-150 ${
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
            <div className="space-y-2 py-1" aria-label="Đang tải danh sách trận đấu">
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
                  ? 'Chưa có trận VALORANT nào được ghi nhận.'
                  : 'Chưa có trận PUBG nào được lưu.'}
              </p>
              <p className="text-[#64748B]">
                {isValo
                  ? 'Mở VALORANT qua Overwolf để tự động quay highlight hoặc bấm đồng bộ lịch sử trận đấu phía trên.'
                  : 'Bấm nút đồng bộ 20 trận PUBG hoặc chơi qua Overwolf để tự động lưu replay và phân tích.'}
              </p>
            </div>
          ) : filteredVideos.length === 0 ? (
            <div className="rounded-[2px] border border-dashed border-[#232B3B] bg-[#0A0D12] p-4 text-xs text-[#94A3B8] space-y-2">
              <p className="font-bold text-[#EEF2F6]">
                Không có trận nào khớp bộ lọc hiện tại.
              </p>
              <button
                type="button"
                onClick={() => {
                  setMatchSearchText('');
                  setMatchFilterMode('ALL');
                }}
                className="px-2.5 py-1 rounded-[2px] bg-[#171D28] hover:bg-[#232B3B] border border-[#232B3B] font-mono text-[11px] font-bold text-[#38BDF8]"
              >
                Xóa bộ lọc
              </button>
            </div>
          ) : (
            <div className="space-y-2 overflow-y-auto max-h-[75vh] tactical-scrollbar pr-1">
              {filteredVideos.map((v) => {
                const isSelected = v.match_id === selectedMatchId;
                const localRecord = getLocalVideoByMatchId(v.match_id);
                const clipCount = localRecord?.clips?.length || (localRecord?.filePath ? 1 : 0);
                const hasHighlight = Boolean(v.cloud_video_url || localRecord);

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
                              <span>{clipCount > 1 ? `${clipCount} CLIP` : 'CLIP'}</span>
                            </span>
                          )}
                          {v.is_pinned && (
                            <span className="font-mono text-[10px] font-bold px-1 py-0.5 rounded-[2px] bg-[#E59A23]/15 text-[#E59A23] border border-[#E59A23]/40">
                              GHIM
                            </span>
                          )}
                        </div>
                        <span className="font-mono text-[11px] text-[#64748B] tabular-nums shrink-0">
                          {new Date(v.played_at).toLocaleDateString('vi-VN')}
                        </span>
                      </div>
                      <p className="font-display text-sm font-bold text-[#EEF2F6] truncate">
                        {v.map_name}
                      </p>
                      <p className="font-mono text-[11px] text-[#94A3B8] tabular-nums">
                        {v.match_result} {v.score_summary ? `- ${v.score_summary}` : ''}
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => void handleTogglePinMatch(v)}
                      aria-label={
                        v.is_pinned ? `Bỏ ghim trận ${v.map_name}` : `Ghim trận ${v.map_name}`
                      }
                      title={
                        v.is_pinned
                          ? 'Bỏ ghim trận này'
                          : 'Ghim trận (giữ lại vĩnh viễn không bị xóa khi đầy 20 trận)'
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

        {/* Cot giua: Replay Theater & Round Matrix */}
        <section aria-label="Trình phát replay và diễn biến round" className="lg:col-span-6">
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
            onHighlightSaved={(cloudUrl) => {
              setVideoSrc(cloudUrl);
              setStatusMsg('Đã lưu video highlight lên hệ thống.');
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

        {/* Cot phai: Tactical Report & AI Coach */}
        <aside aria-label="Báo cáo chiến thuật" className="lg:col-span-3">
          <TacticalReport
            gameType={activeGameTab}
            matchId={activeMatch?.match_id || null}
            mapName={activeMatch?.map_name || ''}
            activeRound={activeRound}
            report={report}
            rounds={rounds}
            mapTelemetry={mapTelemetry}
          />
        </aside>
      </main>

      <AppFooterVersion isElectronRuntime={isElectronRuntime} />

      <FriendsLeaderboard
        isOpen={showLeaderboard}
        initialGame={activeGameTab}
        currentUserId={profile?.id}
        onClose={() => setShowLeaderboard(false)}
      />

      <SettingsVaultModal
        isOpen={showSettingsVault}
        initialGame={activeGameTab}
        onClose={() => setShowSettingsVault(false)}
      />

      <MatchTrendModal
        isOpen={showTrendModal}
        gameType={activeGameTab}
        matches={tabBaseVideos.slice(0, 20)}
        onClose={() => setShowTrendModal(false)}
      />

      <StorageManagerModal
        isOpen={showStorageModal}
        isElectronRuntime={isElectronRuntime}
        captureStatus={desktopCaptureStatus}
        pinnedMatchIds={videos.filter((v) => v.is_pinned).map((v) => v.match_id)}
        onUpdateOptions={handleUpdateCaptureOptions}
        onClose={() => setShowStorageModal(false)}
      />

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

export default App;

import React, { useEffect, useRef, useState } from 'react';
import {
  clearAuthToken,
  fetchMatchDetail,
  fetchMyVideos,
  getAuthToken,
  getLocalVideoByMatchId,
  PlayerSearchResult,
  searchPlayerProfile,
  setAuthToken,
  syncRealPubgMatches,
} from './services/localDb';
import { ReplayPlayer } from './components/ReplayPlayer';
import { AnalyzedRoundUI } from './components/RoundTimeline';
import { MatchReportUI, TacticalReport } from './components/TacticalReport';
import { FriendsLeaderboard } from './components/FriendsLeaderboard';
import { SettingsVaultModal } from './components/SettingsVaultModal';
import { PostMatchRecapToast } from './components/PostMatchRecapToast';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

interface UserProfile {
  id: number;
  riot_game_name: string | null;
  riot_tag_line: string | null;
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
}

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
    <div className="fixed bottom-4 right-4 z-50 bg-slate-900 border border-emerald-500/40 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3">
      {updateState.status === 'available' && (
        <>
          <span className="text-xs sm:text-sm">
            Có phiên bản mới <b className="text-emerald-400">v{updateState.version}</b>!
          </span>
          <button
            onClick={() => (window as any).electronUpdater?.downloadUpdate()}
            className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs px-3 py-1.5 rounded-lg transition"
          >
            Cập nhật ngay
          </button>
        </>
      )}

      {updateState.status === 'downloading' && (
        <span className="text-xs sm:text-sm text-sky-300">
          Đang tải bản cập nhật... <b>{updateState.percent ?? 0}%</b>
        </span>
      )}

      {updateState.status === 'downloaded' && (
        <>
          <span className="text-xs sm:text-sm">Tải hoàn tất!</span>
          <button
            onClick={() => (window as any).electronUpdater?.installUpdate()}
            className="bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs px-3 py-1.5 rounded-lg transition"
          >
            Khởi động lại để áp dụng
          </button>
        </>
      )}
    </div>
  );
};

const App: React.FC = () => {
  const [token, setTokenState] = useState<string | null>(() => getAuthToken());
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [videos, setVideos] = useState<SavedMatchItem[]>([]);
  const [activeGameTab, setActiveGameTab] = useState<'VALORANT' | 'PUBG'>('PUBG');
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);

  const [rounds, setRounds] = useState<AnalyzedRoundUI[]>([]);
  const [report, setReport] = useState<MatchReportUI | null>(null);
  const [selectedRound, setSelectedRound] = useState<number>(1);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);

  // State cho thanh tìm kiếm nhân vật ở trang giới thiệu
  const [searchGame, setSearchGame] = useState<'PUBG' | 'VALORANT'>('PUBG');
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<PlayerSearchResult | null>(null);

  // State cho Giai đoạn 3 & 4 (Bảng xếp hạng, Kho Sens/Crosshair, Post-Match Recap)
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showSettingsVault, setShowSettingsVault] = useState(false);
  const [showPostMatchRecap, setShowPostMatchRecap] = useState(false);

  const [loading, setLoading] = useState(false);
  const [syncingPubg, setSyncingPubg] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const videosRef = useRef<SavedMatchItem[]>(videos);
  videosRef.current = videos;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('token');
    if (urlToken) {
      setAuthToken(urlToken);
      setTokenState(urlToken);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Lắng nghe token trả về từ trình duyệt ngoài qua deep-link tacticalreplay://
  useEffect(() => {
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI?.onAuthToken) return;
    return electronAPI.onAuthToken((receivedToken: string) => {
      setAuthToken(receivedToken);
      setTokenState(receivedToken);
      setStatusMsg(null);
    });
  }, []);

  useEffect(() => {
    if (!token) return;
    void loadUserVideos();
  }, [token]);

  // Tự động kiểm tra trận mới mỗi 45 giây và cập nhật danh sách 20 trận gần nhất
  useEffect(() => {
    if (!token) return;

    const autoCheckNewMatches = async () => {
      try {
        if (activeGameTab === 'PUBG' && (profile?.pubg_player_name || profile?.steam_persona_name)) {
          const res = await syncRealPubgMatches();
          if (res.syncedCount > 0) {
            setStatusMsg(res.message);
            await loadUserVideos('PUBG');
            setShowPostMatchRecap(true);
            return;
          }
        }

        const latest = await fetchMyVideos();
        const latestList: SavedMatchItem[] = latest.videos || [];
        const currentList = videosRef.current;

        const hasNewTopMatch =
          latestList.length > 0 &&
          (currentList.length === 0 || latestList[0].match_id !== currentList[0].match_id);

        if (hasNewTopMatch) {
          setVideos(latestList);
          const tabMatches = latestList.filter((v) => v.game_type === activeGameTab);
          if (tabMatches.length > 0) {
            setStatusMsg('Phát hiện trận đấu mới, đã tự động cập nhật danh sách 20 trận gần nhất.');
            await handleSelectMatch(tabMatches[0]);
            setShowPostMatchRecap(true);
          }
        }
      } catch {
        // Bỏ qua lỗi mạng tạm thời khi chạy kiểm tra ngầm
      }
    };

    const timer = setInterval(() => {
      void autoCheckNewMatches();
    }, 45000);

    return () => clearInterval(timer);
  }, [token, activeGameTab, profile]);

  const loadUserVideos = async (preferredTab?: 'VALORANT' | 'PUBG') => {
    setLoading(true);
    try {
      const data = await fetchMyVideos();
      const loadedProfile: UserProfile | null = data.profile || null;
      const loadedVideos: SavedMatchItem[] = data.videos || [];

      setProfile(loadedProfile);
      setVideos(loadedVideos);

      let targetTab = preferredTab || activeGameTab;
      if (!preferredTab && loadedProfile) {
        if (loadedProfile.riot_game_name && !loadedProfile.steam_id && !loadedProfile.pubg_player_name) {
          targetTab = 'VALORANT';
          setActiveGameTab('VALORANT');
        } else if (loadedProfile.steam_id || loadedProfile.pubg_player_name) {
          targetTab = 'PUBG';
          setActiveGameTab('PUBG');
        }
      }

      const tabMatches = loadedVideos.filter((v) => v.game_type === targetTab);
      if (tabMatches.length > 0) {
        await handleSelectMatch(tabMatches[0]);
      } else {
        resetSelection();
      }
    } catch (err: any) {
      setStatusMsg(err.message || 'Không thể tải danh sách trận đấu.');
    } finally {
      setLoading(false);
    }
  };

  const resetSelection = () => {
    setSelectedMatchId(null);
    setRounds([]);
    setReport(null);
    setSelectedRound(1);
    setVideoSrc(null);
  };

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

  const handleSelectMatch = async (match: SavedMatchItem) => {
    setSelectedMatchId(match.match_id);
    setSelectedRound(1);

    const localRec = getLocalVideoByMatchId(match.match_id);
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
      if (detail.rounds?.length > 0) {
        setSelectedRound(detail.rounds[0].roundNumber);
      }
    } catch (err: any) {
      setStatusMsg(err.message || 'Lỗi tải chi tiết phân tích trận đấu.');
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

  const openAuthUrl = (authUrl: string) => {
    const electronAPI = (window as any).electronAPI;
    if (electronAPI?.openExternal) {
      void electronAPI.openExternal(authUrl);
      setStatusMsg('Đã mở trang đăng nhập trên trình duyệt. Vui lòng hoàn tất đăng nhập để quay lại ứng dụng.');
    } else {
      window.location.href = authUrl;
    }
  };

  const handleSteamLogin = () => {
    const isDesktopApp = window.location.protocol === 'file:' || Boolean((window as any).electronAPI);
    const returnTo = isDesktopApp
      ? 'electron'
      : encodeURIComponent(window.location.href.split('?')[0]);
    openAuthUrl(`${API_BASE_URL}/auth/steam/login?returnTo=${returnTo}`);
  };

  const handleRiotLogin = () => {
    const isDesktopApp = window.location.protocol === 'file:' || Boolean((window as any).electronAPI);
    const returnTo = isDesktopApp
      ? 'electron'
      : encodeURIComponent(window.location.href.split('?')[0]);
    openAuthUrl(`${API_BASE_URL}/auth/riot/login?returnTo=${returnTo}`);
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

  const handleCopyShareLink = async (matchId: string) => {
    const shareUrl = `${API_BASE_URL}/analyze/public-match/${encodeURIComponent(matchId)}`;
    await navigator.clipboard.writeText(shareUrl);
    setStatusMsg(`Đã sao chép link chia sẻ trận đấu: ${shareUrl}`);
  };

  const handleLogout = () => {
    clearAuthToken();
    setTokenState(null);
    setProfile(null);
    setVideos([]);
    resetSelection();
  };

  // ==========================================================================
  // TRANG GIỚI THIỆU: TÌM KIẾM NHÂN VẬT + CHỌN ĐĂNG NHẬP RIOT / STEAM
  // ==========================================================================
  if (!token) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
        <nav className="border-b border-slate-900 px-6 lg:px-12 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[#ff4655] to-amber-500 flex items-center justify-center font-black text-slate-950 text-sm">
              TR
            </div>
            <span className="text-lg font-extrabold tracking-tight text-white">
              TacticalReplay<span className="text-[#ff4655]">AI</span>
            </span>
          </div>

          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-xs font-medium text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Vanguard & BattlEye Compliant
          </span>
        </nav>

        <main className="flex-1 flex items-center justify-center px-6 py-10">
          <div className="max-w-3xl w-full space-y-8">
            <div className="text-center space-y-3">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                Post-Match Video Replay & Tactical Analysis
              </p>
              <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                Phân tích chiến thuật sau trận đấu cho VALORANT & PUBG
              </h1>
              <p className="text-sm text-slate-400 max-w-xl mx-auto leading-relaxed">
                Tra cứu nhanh hồ sơ người chơi hoặc đăng nhập tài khoản để tự động ghi hình, đánh dấu các mốc giao tranh và phân tích từng round.
              </p>
            </div>

            {/* Thanh tìm kiếm nhân vật đặt ngay tại trang giới thiệu */}
            <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
              <form onSubmit={handleLandingSearch} className="flex flex-col sm:flex-row gap-2.5">
                <div className="flex p-1 rounded-xl bg-slate-950 border border-slate-800 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setSearchGame('PUBG');
                      setSearchResult(null);
                      setStatusMsg(null);
                    }}
                    className={`px-3.5 py-2 rounded-lg text-xs font-extrabold transition ${
                      searchGame === 'PUBG'
                        ? 'bg-amber-500 text-slate-950'
                        : 'text-slate-400 hover:text-white'
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
                    className={`px-3.5 py-2 rounded-lg text-xs font-extrabold transition ${
                      searchGame === 'VALORANT'
                        ? 'bg-[#ff4655] text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    VALORANT
                  </button>
                </div>

                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={
                    searchGame === 'PUBG'
                      ? 'Tìm kiếm tên nhân vật PUBG...'
                      : 'Tìm kiếm Riot ID đầy đủ (Ví dụ: Player#VN1)...'
                  }
                  className="flex-1 px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-slate-600"
                />

                <button
                  type="submit"
                  disabled={searching}
                  className={`px-6 py-2.5 rounded-xl font-bold text-xs transition shrink-0 ${
                    searchGame === 'PUBG'
                      ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                      : 'bg-[#ff4655] hover:bg-rose-500 text-white'
                  } disabled:opacity-50`}
                >
                  {searching ? 'Đang tìm...' : 'Tìm kiếm'}
                </button>
              </form>

              {statusMsg && (
                <div className="p-3 rounded-xl bg-sky-950/70 border border-sky-800/80 text-xs text-sky-200 text-center">
                  {statusMsg}
                </div>
              )}

              {/* Kết quả tra cứu nhân vật ngay trên trang giới thiệu */}
              {searchResult && (
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`px-2.5 py-0.5 rounded text-[11px] font-extrabold ${
                          searchResult.gameType === 'PUBG'
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'bg-[#ff4655]/20 text-[#ff4655]'
                        }`}
                      >
                        {searchResult.gameType} • {searchResult.player.region}
                      </span>
                      <span className="text-base font-bold text-white">
                        {searchResult.player.name}
                      </span>
                    </div>

                    <button
                      onClick={searchResult.gameType === 'PUBG' ? handleSteamLogin : handleRiotLogin}
                      className="text-xs font-semibold text-sky-400 hover:underline"
                    >
                      Đăng nhập để xem phân tích chi tiết →
                    </button>
                  </div>

                  {searchResult.recentMatches.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-[11px] font-semibold text-slate-400">
                        {searchResult.recentMatches.length} trận đấu gần nhất:
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 max-h-72 overflow-y-auto pr-1">
                        {searchResult.recentMatches.map((m) => (
                          <div
                            key={m.matchId}
                            className="p-3 rounded-lg bg-slate-900 border border-slate-800/80 text-xs space-y-1"
                          >
                            <div className="flex justify-between text-slate-400">
                              <span className="font-bold text-slate-200">{m.mapName}</span>
                              <span>{new Date(m.playedAt).toLocaleDateString('vi-VN')}</span>
                            </div>
                            <p className="text-amber-400 font-bold">
                              TOP #{m.winPlace} • {m.kills} Kills
                            </p>
                            <p className="text-slate-500 text-[11px]">
                              {m.gameMode} • {m.damageDealt} DMG
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">
                      Đã xác thực hồ sơ hợp lệ (ID: <span className="font-mono text-slate-300">{searchResult.player.id.slice(0, 18)}...</span>). Đăng nhập bên dưới để đồng bộ lịch sử trận đấu và video replay.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Hai thẻ đăng nhập chính thức: Steam (PUBG) và Riot (VALORANT) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-slate-900/90 border border-slate-800 hover:border-amber-500/50 rounded-2xl p-6 flex flex-col justify-between gap-5 transition">
                <div className="space-y-2">
                  <span className="inline-block px-2.5 py-0.5 rounded bg-amber-500/15 text-amber-400 text-[11px] font-bold">
                    PUBG: BATTLEGROUNDS
                  </span>
                  <h2 className="text-lg font-bold text-white">Không gian PUBG</h2>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Phân tích diễn biến từng giai đoạn vòng bo (Phase), lượng sát thương, góc di chuyển và video replay trận đấu.
                  </p>
                </div>

                <button
                  onClick={handleSteamLogin}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#1b2838] to-[#2a475e] hover:brightness-110 border border-sky-500/30 text-white font-bold text-xs transition flex items-center justify-center gap-2.5"
                >
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                    <path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.605 0 11.979 0z" />
                  </svg>
                  <span>Đăng nhập bằng Steam</span>
                </button>
              </div>

              <div className="bg-slate-900/90 border border-slate-800 hover:border-[#ff4655]/50 rounded-2xl p-6 flex flex-col justify-between gap-5 transition">
                <div className="space-y-2">
                  <span className="inline-block px-2.5 py-0.5 rounded bg-[#ff4655]/15 text-[#ff4655] text-[11px] font-bold">
                    VALORANT
                  </span>
                  <h2 className="text-lg font-bold text-white">Không gian VALORANT</h2>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Phân loại kinh tế từng round (Eco, Force, Full Buy), nhịp độ tấn công và cảnh báo tình huống chết lẻ không trade kill.
                  </p>
                </div>

                <button
                  onClick={handleRiotLogin}
                  className="w-full py-3 px-4 rounded-xl bg-[#ff4655] hover:bg-rose-500 text-white font-bold text-xs transition flex items-center justify-center gap-2.5"
                >
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                    <path d="M12.534 21.77l-1.09-2.81 10.52.54-.451 4.5zM15.06 0L.307 6.969 2.59 17.471H5.6l-.52-7.512.461-.144 1.81 7.656h3.126l-.116-9.15.462-.144 1.582 9.294h3.31l.78-11.053.462-.144.82 11.197h4.376l1.54-15.37Z" />
                  </svg>
                  <span>Đăng nhập bằng Riot Sign On</span>
                </button>
              </div>
            </div>
          </div>
        </main>

        <UpdateBanner />
      </div>
    );
  }

  // ==========================================================================
  // KHÔNG GIAN BÊN TRONG SAU ĐĂNG NHẬP (XOAY VÒNG 20 TRẬN & LƯU HIGHLIGHT)
  // ==========================================================================
  const isValo = activeGameTab === 'VALORANT';
  const filteredVideos = videos.filter((v) => v.game_type === activeGameTab).slice(0, 20);
  const activeMatch = filteredVideos.find((v) => v.match_id === selectedMatchId);
  const activeRound = rounds.find((r) => r.roundNumber === selectedRound);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <header className="border-b border-slate-800 px-6 py-3 bg-slate-900/80 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2.5">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                isValo ? 'bg-[#ff4655]' : 'bg-amber-400'
              }`}
            />
            <span className="text-base font-extrabold tracking-wide text-white">
              TacticalReplayAI
            </span>
          </div>

          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-950 border border-slate-800">
            <button
              onClick={() => void handleSwitchGameTab('VALORANT')}
              className={`px-4 py-1.5 rounded-lg text-xs font-extrabold tracking-wide transition ${
                isValo
                  ? 'bg-[#ff4655] text-white shadow-md shadow-rose-600/25'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              VALORANT ({Math.min(20, videos.filter((v) => v.game_type === 'VALORANT').length)})
            </button>
            <button
              onClick={() => void handleSwitchGameTab('PUBG')}
              className={`px-4 py-1.5 rounded-lg text-xs font-extrabold tracking-wide transition ${
                !isValo
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/25'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              PUBG ({Math.min(20, videos.filter((v) => v.game_type === 'PUBG').length)})
            </button>
          </div>

          {/* Thanh công cụ Giai đoạn 3 & 4 */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowLeaderboard(true)}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-sky-300 transition"
            >
              Bảng xếp hạng nhóm
            </button>
            <button
              type="button"
              onClick={() => setShowSettingsVault(true)}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-emerald-300 transition"
            >
              Kho Sens &amp; Tâm
            </button>
            {activeMatch && (
              <>
                <button
                  type="button"
                  onClick={() => setShowPostMatchRecap((prev) => !prev)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-amber-300 transition"
                >
                  Tóm tắt trận
                </button>
                <button
                  type="button"
                  onClick={() => void handleCopyShareLink(activeMatch.match_id)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-200 transition"
                >
                  Chia sẻ link
                </button>
              </>
            )}
          </div>
        </div>

        {/* Huy hiệu tài khoản đang đăng nhập và nút Đăng xuất */}
        <div className="flex items-center gap-3">
          {profile?.steam_persona_name && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[#1b2838] border border-sky-500/30 text-xs font-semibold text-sky-200">
              {profile.steam_avatar && (
                <img
                  src={profile.steam_avatar}
                  alt="Steam"
                  className="w-4 h-4 rounded-full"
                />
              )}
              <span>{profile.steam_persona_name}</span>
            </div>
          )}

          {profile?.riot_game_name && (
            <span className="px-3 py-1 rounded-full bg-[#ff4655]/15 border border-[#ff4655]/30 text-xs font-semibold text-rose-300">
              {profile.riot_game_name}#{profile.riot_tag_line}
            </span>
          )}

          {!isValo && profile?.pubg_player_name && (
            <span className="px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-xs font-semibold text-amber-300">
              IGN: {profile.pubg_player_name}
            </span>
          )}

          <button
            onClick={handleLogout}
            className="px-3.5 py-1.5 rounded-lg bg-slate-950 hover:bg-rose-950/50 border border-slate-800 text-xs text-slate-400 hover:text-rose-300 transition"
          >
            Đăng xuất
          </button>
        </div>
      </header>

      {statusMsg && (
        <div className="bg-slate-900 border-b border-slate-800 px-6 py-2 text-xs text-sky-300 flex justify-between items-center">
          <span>{statusMsg}</span>
          <button onClick={() => setStatusMsg(null)} className="text-slate-400 hover:text-white">
            Đóng
          </button>
        </div>
      )}

      <main className="flex-1 grid grid-cols-12 gap-4 p-5">
        <aside className="col-span-3 bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              {isValo
                ? `20 Trận VALORANT (${filteredVideos.length}/20)`
                : `20 Trận PUBG (${filteredVideos.length}/20)`}
            </h2>
            <button
              onClick={() => void loadUserVideos(activeGameTab)}
              className={`text-xs hover:underline ${isValo ? 'text-[#ff4655]' : 'text-amber-400'}`}
            >
              Làm mới
            </button>
          </div>

          {!isValo && (profile?.pubg_player_name || profile?.steam_persona_name) && (
            <button
              onClick={() => void handleSyncPubg()}
              disabled={syncingPubg}
              className="w-full py-2 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs transition"
            >
              {syncingPubg ? 'Đang đồng bộ 20 trận PUBG...' : 'Đồng bộ 20 trận PUBG gần nhất'}
            </button>
          )}

          {loading ? (
            <p className="text-xs text-slate-500">Đang tải danh sách trận đấu...</p>
          ) : filteredVideos.length === 0 ? (
            <div className="text-xs text-slate-400 space-y-2 py-3 leading-relaxed">
              <p className="font-semibold text-slate-300">
                {isValo
                  ? 'Chưa có trận VALORANT nào được ghi nhận.'
                  : 'Chưa có trận PUBG nào được lưu.'}
              </p>
              <p className="text-slate-500">
                {isValo
                  ? 'Khi bạn mở VALORANT thông qua Overwolf, ứng dụng sẽ tự động quay video highlight, lưu vào hệ thống và cập nhật 20 trận gần nhất.'
                  : 'Bấm nút "Đồng bộ 20 trận PUBG gần nhất" phía trên hoặc chơi PUBG qua Overwolf để tự động lưu video highlight và phân tích.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2 overflow-y-auto max-h-[75vh] pr-1">
              {filteredVideos.map((v) => {
                const isSelected = v.match_id === selectedMatchId;
                const hasHighlight = Boolean(
                  v.cloud_video_url || getLocalVideoByMatchId(v.match_id)
                );
                const activeBorder = isValo
                  ? 'bg-slate-800/90 border-[#ff4655]'
                  : 'bg-slate-800/90 border-amber-500';

                return (
                  <button
                    key={v.match_id}
                    onClick={() => void handleSelectMatch(v)}
                    className={`w-full text-left p-3 rounded-xl border transition space-y-1 ${
                      isSelected
                        ? activeBorder
                        : 'bg-slate-950/70 border-slate-800/80 hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-[10px] font-extrabold px-2 py-0.5 rounded ${
                            isValo
                              ? 'bg-[#ff4655]/20 text-[#ff4655]'
                              : 'bg-amber-500/20 text-amber-300'
                          }`}
                        >
                          {v.game_mode || v.game_type}
                        </span>
                        {hasHighlight && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            Highlight
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-500">
                        {new Date(v.played_at).toLocaleDateString('vi-VN')}
                      </span>
                    </div>
                    <p className="text-sm font-bold text-slate-200 truncate">{v.map_name}</p>
                    <p className="text-xs text-slate-400">
                      {v.match_result} {v.score_summary ? `• ${v.score_summary}` : ''}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </aside>

        <section className="col-span-6">
          <ReplayPlayer
            gameType={activeGameTab}
            matchId={activeMatch?.match_id || null}
            hasSelectedMatch={Boolean(activeMatch)}
            videoSrc={videoSrc}
            matchTitle={activeMatch ? `${activeMatch.map_name} (${activeMatch.match_result})` : ''}
            rounds={rounds}
            selectedRound={selectedRound}
            onSelectRound={setSelectedRound}
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

        <aside className="col-span-3">
          <TacticalReport
            gameType={activeGameTab}
            matchId={activeMatch?.match_id || null}
            mapName={activeMatch?.map_name || ''}
            activeRound={activeRound}
            report={report}
            rounds={rounds}
          />
        </aside>
      </main>

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
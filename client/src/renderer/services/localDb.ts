const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';
const TOKEN_KEY = 'tactical_replay_auth_token';
const VIDEOS_MAP_KEY = 'tactical_replay_local_videos';

export interface LocalVideoRecord {
  matchId: string;
  gameType: 'VALORANT' | 'PUBG';
  filePath: string;
  videoUrl?: string;
  fileName: string;
  durationSec: number;
  recordedAt: string;
}

export interface TimelineEvent {
  timestampMs: number;
  round: number;
  type: 'ROUND_START' | 'KILL' | 'DEATH' | 'SPIKE_PLANTED' | 'ROUND_END';
  payload?: Record<string, unknown>;
}

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAuthToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function getAllLocalVideos(): Record<string, LocalVideoRecord> {
  try {
    const raw = localStorage.getItem(VIDEOS_MAP_KEY);
    return raw ? (JSON.parse(raw) as Record<string, LocalVideoRecord>) : {};
  } catch {
    return {};
  }
}

export function saveLocalVideoRecord(record: LocalVideoRecord): void {
  const current = getAllLocalVideos();
  current[record.matchId] = record;
  localStorage.setItem(VIDEOS_MAP_KEY, JSON.stringify(current));
}

export function getLocalVideoByMatchId(matchId: string): LocalVideoRecord | null {
  const current = getAllLocalVideos();
  return current[matchId] || null;
}

export function removeOldestLocalVideos(maxKeepCount = 15): LocalVideoRecord[] {
  const all = Object.values(getAllLocalVideos()).sort(
    (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime()
  );
  if (all.length <= maxKeepCount) return [];

  const kept = all.slice(0, maxKeepCount);
  const removed = all.slice(maxKeepCount);

  const nextMap: Record<string, LocalVideoRecord> = {};
  for (const item of kept) {
    nextMap[item.matchId] = item;
  }
  localStorage.setItem(VIDEOS_MAP_KEY, JSON.stringify(nextMap));
  return removed;
}

async function authFetch(endpoint: string, options: RequestInit = {}) {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw new Error(errBody.error || `HTTP Error ${response.status}`);
  }
  return response.json();
}

export async function fetchMyVideos() {
  return authFetch('/auth/my-videos');
}

export interface PlayerSearchResult {
  gameType: 'PUBG' | 'VALORANT';
  player: {
    id: string;
    name: string;
    region: string;
  };
  recentMatches: Array<{
    matchId: string;
    mapName: string;
    gameMode: string;
    winPlace: number;
    kills: number;
    damageDealt: number;
    playedAt: string;
  }>;
}

export async function searchPlayerProfile(
  game: 'PUBG' | 'VALORANT',
  query: string
): Promise<PlayerSearchResult> {
  const params = new URLSearchParams({ game, query });
  const response = await fetch(`${API_BASE_URL}/analyze/player-search?${params.toString()}`);

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw new Error(errBody.error || `HTTP Error ${response.status}`);
  }

  return response.json();
}

export async function syncRealPubgMatches() {
  return authFetch('/analyze/pubg/sync', {
    method: 'POST',
  });
}

export async function fetchMatchDetail(matchId: string) {
  return authFetch(`/analyze/match/${encodeURIComponent(matchId)}`);
}

export async function submitMatchForAnalysis(payload: {
  matchId: string;
  gameType: 'VALORANT' | 'PUBG';
  mapName: string;
  gameMode: string;
  matchResult: string;
  scoreSummary: string;
  localVideoFilename: string | null;
  durationSec: number;
  localEvents: TimelineEvent[];
  rawRounds?: unknown[];
}) {
  return authFetch('/analyze/match', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function uploadMatchHighlight(
  matchId: string,
  fileBlob: Blob,
  fileName: string
): Promise<{ matchId: string; cloudVideoUrl: string }> {
  const token = getAuthToken();
  const formData = new FormData();
  formData.append('matchId', matchId);
  formData.append('video', fileBlob, fileName);

  const response = await fetch(`${API_BASE_URL}/analyze/highlight/upload`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw new Error(errBody.error || `HTTP Error ${response.status}`);
  }

  return response.json();
}

export async function quickLoginWithRiotId(riotId: string): Promise<{
  token: string;
  user: {
    id: number;
    riot_game_name: string;
    riot_tag_line: string;
  };
}> {
  const existingToken = getAuthToken();
  const res = await fetch(`${API_BASE_URL}/auth/riot/quick-login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(existingToken ? { Authorization: `Bearer ${existingToken}` } : {}),
    },
    body: JSON.stringify({ riotId }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Đăng nhập bằng Riot ID thất bại.');
  }

  if (data.token) {
    setAuthToken(data.token);
  }
  return data;
}
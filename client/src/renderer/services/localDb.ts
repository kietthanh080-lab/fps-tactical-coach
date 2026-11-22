export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';
const TOKEN_KEY = 'tactical_replay_auth_token';
const VIDEOS_MAP_KEY = 'tactical_replay_local_videos';
const CAPTURE_MODE_KEY = 'tactical_replay_capture_mode';

export type CaptureMode = 'FULL_MATCH' | 'HIGHLIGHT_CLIPS';

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

export interface AuthProvidersStatus {
  riotRsoReady: boolean;
  riotApiReady: boolean;
  steamReady: boolean;
}

export interface SquadInfo {
  id: number;
  code: string;
  name: string;
  ownerUserId: number;
  memberCount: number;
}

export function getCaptureMode(): CaptureMode {
  try {
    const val = localStorage.getItem(CAPTURE_MODE_KEY);
    return val === 'FULL_MATCH' ? 'FULL_MATCH' : 'HIGHLIGHT_CLIPS';
  } catch {
    return 'HIGHLIGHT_CLIPS';
  }
}

export function setCaptureMode(mode: CaptureMode): void {
  localStorage.setItem(CAPTURE_MODE_KEY, mode);
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

export async function fetchAuthProviders(): Promise<AuthProvidersStatus> {
  const res = await fetch(`${API_BASE_URL}/auth/providers`);
  if (!res.ok) {
    return { riotRsoReady: false, riotApiReady: false, steamReady: true };
  }
  return res.json();
}

export async function pollAuthSession(
  sessionId: string
): Promise<{ status: 'pending' | 'completed' | 'error'; token?: string; error?: string }> {
  const res = await fetch(`${API_BASE_URL}/auth/session/${encodeURIComponent(sessionId)}`);
  if (!res.ok) {
    return { status: 'pending' };
  }
  return res.json();
}

export async function prepareRiotLinkUrl(payload: {
  returnTo: string;
  sessionId?: string;
  promptLogin?: boolean;
}): Promise<{ authUrl: string }> {
  return authFetch('/auth/riot/link-session', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function prepareSteamLinkUrl(payload: {
  returnTo: string;
  sessionId?: string;
}): Promise<{ authUrl: string }> {
  return authFetch('/auth/steam/link-session', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function unlinkRiotAccount(): Promise<{ token: string; message: string }> {
  return authFetch('/auth/riot/unlink', {
    method: 'POST',
  });
}

export async function updatePubgProfile(pubgPlayerName: string): Promise<{
  pubg_player_name: string;
  pubg_account_id: string | null;
  message: string;
}> {
  return authFetch('/auth/pubg-profile', {
    method: 'PUT',
    body: JSON.stringify({ pubgPlayerName }),
  });
}

export async function fetchCloudPresets() {
  return authFetch('/auth/presets');
}

export async function saveCloudPreset(preset: {
  id: string;
  gameType: 'VALORANT' | 'PUBG';
  profileName: string;
  dpi: number;
  sensitivity: number;
  adsOrScopedSens: string;
  crosshairCode: string;
  audioSetup: string;
  notes: string;
}) {
  return authFetch('/auth/presets', {
    method: 'POST',
    body: JSON.stringify(preset),
  });
}

export async function deleteCloudPreset(presetId: string) {
  return authFetch(`/auth/presets/${encodeURIComponent(presetId)}`, {
    method: 'DELETE',
  });
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

export async function syncRealValorantMatches() {
  return authFetch('/analyze/valorant/sync', {
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
): Promise<{ matchId: string; cloudVideoUrl: string; fileName?: string }> {
  // 1. Thử xin Presigned URL (Cloudflare R2 / S3) để upload trực tiếp vượt giới hạn 4.5MB của Vercel
  const presignData = await authFetch('/analyze/highlight/presign', {
    method: 'POST',
    body: JSON.stringify({
      matchId,
      fileName,
      contentType: fileBlob.type || 'video/mp4',
    }),
  }).catch(() => null);

  if (presignData?.mode === 's3-presigned' && presignData.presignedUrl && presignData.publicUrl) {
    const putRes = await fetch(presignData.presignedUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': fileBlob.type || 'video/mp4',
      },
      body: fileBlob,
    });

    if (!putRes.ok) {
      throw new Error(`Upload Cloud Storage thất bại (${putRes.status}).`);
    }

    return authFetch('/analyze/highlight/confirm', {
      method: 'POST',
      body: JSON.stringify({
        matchId,
        cloudVideoUrl: presignData.publicUrl,
        localVideoFilename: fileName,
      }),
    });
  }

  // 2. Fallback: Upload trực tiếp qua Express multipart (Docker / VPS / Local)
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

export async function askAiCoach(payload: {
  matchId: string | null;
  gameType: 'VALORANT' | 'PUBG';
  mapName: string;
  question: string;
  activeRound: unknown;
  rounds: unknown[];
  report: unknown;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
}): Promise<{ reply: string }> {
  return authFetch('/analyze/chat', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function fetchSquads(): Promise<{ squads: SquadInfo[] }> {
  return authFetch('/analyze/squads');
}

export async function createSquad(name: string): Promise<{ squad: SquadInfo }> {
  return authFetch('/analyze/squads', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export async function joinSquad(code: string): Promise<{ squad: SquadInfo }> {
  return authFetch('/analyze/squads/join', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
}

export async function leaveSquad(squadId: number): Promise<{ left: boolean }> {
  return authFetch(`/analyze/squads/${squadId}/leave`, {
    method: 'POST',
  });
}

export async function fetchLeaderboard(
  gameType: 'VALORANT' | 'PUBG',
  squadId?: number | null
) {
  const params = new URLSearchParams({ gameType });
  if (squadId && squadId > 0) {
    params.set('squadId', String(squadId));
  }
  return authFetch(`/analyze/leaderboard?${params.toString()}`);
}

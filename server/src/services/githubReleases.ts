import axios from 'axios';

export interface ReleaseEntry {
  tag: string;
  version: string;
  name: string;
  publishedAt: string;
  htmlUrl: string;
  downloadUrl: string;
  fileName: string;
  sizeMb: string;
  body: string;
}

const RELEASES_REPO = 'kietthanh080-lab/tactical-replay-releases';
const CACHE_TTL_MS = 5 * 60 * 1000;

const FALLBACK_RELEASES: ReleaseEntry[] = [
  {
    tag: 'v1.9.0',
    version: '1.9.0',
    name: 'TacticalReplayAI v1.9.0',
    publishedAt: '2026-11-28T17:00:00Z',
    htmlUrl: `https://github.com/${RELEASES_REPO}/releases/tag/v1.9.0`,
    downloadUrl: `https://github.com/${RELEASES_REPO}/releases/download/v1.9.0/TacticalReplayAI-Setup-1.9.0.exe`,
    fileName: 'TacticalReplayAI-Setup-1.9.0.exe',
    sizeMb: '125.5 MB',
    body: [
      '### Highlights',
      '- **Silent Background Auto-Updater & Instant Launch Notification**: Automatically checks for updates on app launch and downloads silently in the background. Click **Restart Now** to upgrade cleanly without re-running the Windows setup wizard.',
      '- **Streamlined Tactical Cockpit**: Removed the standalone 2D Strategy Board to keep the replay workflow focused on fast video scrubbing, Telestrator annotations, 5-axis Combat Radar, and PUBG 2D rotation playback.',
      '- **Web Portal v2 (`fps-tactical-coach.vercel.app`)**: Direct auto-updating `/download` route, dual-game VALORANT & PUBG landing theme switcher, animated 2D PUBG route scrubber in `/demo`, free `/tools` (cm/360 Sens Converter, Crosshair Lab, PUBG Lookup), `/changelog`, and upgraded Discord/OpenGraph public match showcase pages.',
    ].join('\n'),
  },
  {
    tag: 'v1.8.1',
    version: '1.8.1',
    name: 'TacticalReplayAI v1.8.1',
    publishedAt: '2026-11-25T16:00:00Z',
    htmlUrl: `https://github.com/${RELEASES_REPO}/releases/tag/v1.8.1`,
    downloadUrl: `https://github.com/${RELEASES_REPO}/releases/download/v1.8.1/TacticalReplayAI-Setup-1.8.1.exe`,
    fileName: 'TacticalReplayAI-Setup-1.8.1.exe',
    sizeMb: '125.5 MB',
    body: [
      '### Updates',
      '- **Cleaner PUBG 2D Rotation Map**: Streamlined 2D minimap with safe-zone rings, animated route playback scrubber, travel distance (km), and kill/elimination markers.',
      '- **Replay A-B Gunfight Loop & Crosshair Zoom**: Set loop markers `[` / `]` (`L` to loop), zoom `1x-3x` (`Z`), and jump events (`P` / `N`).',
      '- **5-Axis Combat Radar & Pro Metrics**: Instant `KAST%`, `ADR`, `HS%`, `Impact` rating, and 1-click `CSV` / `JSON` telemetry export.',
    ].join('\n'),
  },
  {
    tag: 'v1.7.0',
    version: '1.7.0',
    name: 'TacticalReplayAI v1.7.0',
    publishedAt: '2026-11-24T19:40:00Z',
    htmlUrl: `https://github.com/${RELEASES_REPO}/releases/tag/v1.7.0`,
    downloadUrl: `https://github.com/${RELEASES_REPO}/releases/download/v1.7.0/TacticalReplayAI-Setup-1.7.0.exe`,
    fileName: 'TacticalReplayAI-Setup-1.7.0.exe',
    sizeMb: '125.5 MB',
    body: [
      '### Highlights',
      '- **Dynamic Game-Themed UI (VALORANT & PUBG)**: Distinct Protocol Red/Cyan and Battlegrounds Amber/Emerald HUD themes.',
      '- **Unified Settings Center (Ctrl+,) & English Default**: Consolidated 5-tab settings for language, hotkeys, capture quality, storage cap, Sens Vault, accounts, and full JSON backup/restore.',
      '- **Custom Replay Bookmarks, Frame Step & Personal Match Tags**: Mark moments (`B`), step `-0.1s/+0.1s` (`,` / `.`), tag matches, and track 5-match session form.',
    ].join('\n'),
  },
  {
    tag: 'v1.6.1',
    version: '1.6.1',
    name: 'TacticalReplayAI v1.6.1',
    publishedAt: '2026-11-24T12:15:00Z',
    htmlUrl: `https://github.com/${RELEASES_REPO}/releases/tag/v1.6.1`,
    downloadUrl: `https://github.com/${RELEASES_REPO}/releases/download/v1.6.1/TacticalReplayAI-Setup-1.6.1.exe`,
    fileName: 'TacticalReplayAI-Setup-1.6.1.exe',
    sizeMb: '125.4 MB',
    body: [
      '### Highlights',
      '- **Multi-Clip Gallery & Storage Manager**: Manage local clips, pin favorite matches, configure clip hotkey/mic/beep, and inspect Cloudflare R2 sync.',
      '- **PUBG 2D Minimap & Discord PNG Copy**: Inspect safe-zone paths and copy Telestrator frames directly into Discord.',
    ].join('\n'),
  },
];

let cachedReleases: ReleaseEntry[] | null = null;
let cachedAtMs = 0;

function formatBytesToMb(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '~125 MB';
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function getReleaseHistory(): Promise<ReleaseEntry[]> {
  const now = Date.now();
  if (cachedReleases && now - cachedAtMs < CACHE_TTL_MS) {
    return cachedReleases;
  }

  try {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'TacticalReplayAI-WebPortal',
    };
    const token = String(process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '').trim();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const resp = await axios.get<any[]>(
      `https://api.github.com/repos/${RELEASES_REPO}/releases?per_page=10`,
      { headers, timeout: 4500 }
    );

    const parsed: ReleaseEntry[] = (resp.data || [])
      .filter((r) => r && !r.draft && typeof r.tag_name === 'string')
      .map((r) => {
        const assets: any[] = Array.isArray(r.assets) ? r.assets : [];
        const exeAsset = assets.find(
          (a) => typeof a?.name === 'string' && a.name.toLowerCase().endsWith('.exe')
        );
        const tag = String(r.tag_name);
        const version = tag.replace(/^v/i, '');
        return {
          tag,
          version,
          name: String(r.name || `TacticalReplayAI ${tag}`),
          publishedAt: String(r.published_at || r.created_at || ''),
          htmlUrl: String(r.html_url || `https://github.com/${RELEASES_REPO}/releases/tag/${tag}`),
          downloadUrl: String(
            exeAsset?.browser_download_url ||
              `https://github.com/${RELEASES_REPO}/releases/download/${tag}/TacticalReplayAI-Setup-${version}.exe`
          ),
          fileName: String(exeAsset?.name || `TacticalReplayAI-Setup-${version}.exe`),
          sizeMb: formatBytesToMb(Number(exeAsset?.size || 0)),
          body: String(r.body || '').trim(),
        };
      });

    if (parsed.length > 0) {
      cachedReleases = parsed;
      cachedAtMs = now;
      return parsed;
    }
  } catch {
    // Gracefully fall back to curated release metadata when offline or rate-limited
  }

  return cachedReleases || FALLBACK_RELEASES;
}

export async function getLatestReleaseInfo(): Promise<ReleaseEntry> {
  const list = await getReleaseHistory();
  return list[0] || FALLBACK_RELEASES[0];
}

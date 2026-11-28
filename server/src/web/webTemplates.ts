import { Request } from 'express';

export type WebRoutePath = '/' | '/demo' | '/tools' | '/changelog' | '/privacy' | '/terms';

export interface SimpleRoundTelemetry {
  roundNumber: number;
  result: string;
  economyType?: string;
  tacticalStyle?: string;
  kills: number;
  deaths: number;
  assists: number;
  damageDealt: number;
  mistakes?: string[];
  weaponStats?: Array<{
    weaponName: string;
    category?: string;
    kills?: number;
    headshots?: number;
    damageDealt?: number;
    hits?: number;
    throwablesUsed?: number;
  }>;
}

export interface SimplePubgMapTelemetry {
  mapSizeCm?: number;
  path?: Array<{ x: number; y: number }>;
  safeZones?: Array<{ phase: number; x: number; y: number; radius: number }>;
  kills?: Array<{ x: number; y: number; phase?: number; label?: string }>;
  deaths?: Array<{ x: number; y: number; phase?: number; label?: string }>;
}

export interface ProTelemetryMetrics {
  kastPct: number;
  adr: number;
  hsPct: number;
  impactRating: number;
  totalKills: number;
  totalDeaths: number;
  totalAssists: number;
  totalDamage: number;
  axes: Array<{ key: string; label: string; value: number }>;
}

export function escapeHtml(raw: unknown): string {
  return String(raw ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function detectIsEnglish(req: Request): boolean {
  const q = String(req.query.lang || '').trim().toLowerCase();
  if (q === 'en') return true;
  if (q === 'vi') return false;

  const accept = String(req.headers['accept-language'] || '').toLowerCase();
  if (accept.startsWith('vi') || /(?:^|,|\s)vi(?:-vn)?(?:;|,|$)/.test(accept)) {
    return false;
  }
  // English is the default language for international users and Riot/Overwolf reviewers
  return true;
}

export function langQueryString(isEn: boolean): string {
  return isEn ? '?lang=en' : '?lang=vi';
}

export function computeProMetrics(
  rounds: SimpleRoundTelemetry[],
  gameType: 'VALORANT' | 'PUBG',
  isEn: boolean
): ProTelemetryMetrics {
  const isValo = gameType === 'VALORANT';
  const totalRounds = Math.max(1, rounds.length);
  let totalKills = 0;
  let totalDeaths = 0;
  let totalAssists = 0;
  let totalDamage = 0;
  let kastRounds = 0;
  let multiKillRounds = 0;
  let cleanRounds = 0;
  let totalHits = 0;
  let totalHeadshots = 0;
  let totalThrowables = 0;

  for (const r of rounds) {
    totalKills += Number(r.kills || 0);
    totalDeaths += Number(r.deaths || 0);
    totalAssists += Number(r.assists || 0);
    totalDamage += Number(r.damageDealt || 0);
    if ((r.kills || 0) >= 2) multiKillRounds += 1;
    if (!r.mistakes || r.mistakes.length === 0) cleanRounds += 1;

    const resUp = String(r.result || '').toUpperCase();
    const isKast =
      (r.kills || 0) > 0 ||
      (r.assists || 0) > 0 ||
      (r.deaths || 0) === 0 ||
      resUp === 'WIN' ||
      resUp === 'SURVIVED';
    if (isKast) kastRounds += 1;

    for (const w of r.weaponStats || []) {
      totalHits += Number(w.hits || 0);
      totalHeadshots += Number(w.headshots || 0);
      totalThrowables += Number(w.throwablesUsed || 0);
    }
  }

  const kastPct = Math.round((kastRounds / totalRounds) * 100);
  const adr = Math.round(totalDamage / totalRounds);
  const hsPct = totalHits > 0 ? Math.round((totalHeadshots / totalHits) * 100) : isValo ? 22 : 18;
  const kpr = totalKills / totalRounds;
  const targetAdr = isValo ? 155 : 190;

  const rawImpact =
    0.42 +
    kpr * 0.62 +
    (adr / targetAdr) * 0.42 +
    (kastPct / 100) * 0.32 +
    (multiKillRounds / totalRounds) * 0.45;
  const impactRating = Math.min(2.4, Math.max(0.35, Number(rawImpact.toFixed(2))));

  const clampAxis = (val: number) => Math.min(99, Math.max(22, Math.round(val)));

  const axes = [
    {
      key: 'FIRE',
      label: isEn ? 'FIRE' : 'HOA LUC',
      value: clampAxis((adr / targetAdr) * 78 + multiKillRounds * 8),
    },
    {
      key: 'AIM',
      label: isEn ? 'AIM' : 'CHUAN XAC',
      value: clampAxis(hsPct * (isValo ? 2.4 : 2.6) + (totalKills > 0 ? 18 : 8)),
    },
    {
      key: 'KAST',
      label: 'KAST',
      value: clampAxis(kastPct),
    },
    {
      key: 'TEMPO',
      label: isEn ? 'TEMPO' : 'NHIP DO',
      value: clampAxis(kpr * 58 + (totalAssists / totalRounds) * 35 + 24),
    },
    {
      key: 'UTIL',
      label: isEn ? 'UTIL' : 'KY LUAT',
      value: clampAxis((cleanRounds / totalRounds) * 76 + Math.min(22, totalThrowables * 6)),
    },
  ];

  return {
    kastPct,
    adr,
    hsPct,
    impactRating,
    totalKills,
    totalDeaths,
    totalAssists,
    totalDamage,
    axes,
  };
}

function polarPoint(cx: number, cy: number, radius: number, index: number, total = 5) {
  const angle = -Math.PI / 2 + (index * 2 * Math.PI) / total;
  return {
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle),
  };
}

export function renderCombatRadarSvg(
  metrics: ProTelemetryMetrics,
  isValo: boolean,
  isEn: boolean
): string {
  const cx = 130;
  const cy = 108;
  const maxR = 66;
  const accent = isValo ? '#FF4655' : '#E59A23';
  const fillRgba = isValo ? 'rgba(255, 70, 85, 0.22)' : 'rgba(229, 154, 35, 0.22)';

  const rings = [0.35, 0.68, 1]
    .map((r) => {
      const pts = [0, 1, 2, 3, 4]
        .map((i) => {
          const p = polarPoint(cx, cy, maxR * r, i, 5);
          return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
        })
        .join(' ');
      return `<polygon points="${pts}" fill="none" stroke="#1E293B" stroke-width="1" />`;
    })
    .join('');

  const spokes = [0, 1, 2, 3, 4]
    .map((i) => {
      const outer = polarPoint(cx, cy, maxR, i, 5);
      return `<line x1="${cx}" y1="${cy}" x2="${outer.x.toFixed(1)}" y2="${outer.y.toFixed(1)}" stroke="#1E293B" stroke-width="1" />`;
    })
    .join('');

  const dataPts = metrics.axes
    .map((ax, i) => {
      const p = polarPoint(cx, cy, (ax.value / 100) * maxR, i, 5);
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    })
    .join(' ');

  const vertices = metrics.axes
    .map((ax, i) => {
      const dot = polarPoint(cx, cy, (ax.value / 100) * maxR, i, 5);
      const lbl = polarPoint(cx, cy, maxR + 24, i, 5);
      return `
        <circle cx="${dot.x.toFixed(1)}" cy="${dot.y.toFixed(1)}" r="3.4" fill="${accent}" stroke="#EEF2F6" stroke-width="1" />
        <text x="${lbl.x.toFixed(1)}" y="${(lbl.y - 3).toFixed(1)}" text-anchor="middle" fill="#94A3B8" font-size="8.5" font-family="ui-monospace, monospace" font-weight="700">${escapeHtml(ax.label)}</text>
        <text x="${lbl.x.toFixed(1)}" y="${(lbl.y + 8).toFixed(1)}" text-anchor="middle" fill="#EEF2F6" font-size="10" font-family="ui-monospace, monospace" font-weight="700">${ax.value}</text>
      `;
    })
    .join('');

  return `<svg viewBox="0 0 260 212" style="width:100%;max-width:280px;height:auto;display:block;margin:0 auto;" role="img" aria-label="${
    isEn ? '5-axis combat radar chart' : 'Bieu do radar 5 truc chien thuat'
  }">
    ${rings}
    ${spokes}
    <polygon points="${dataPts}" fill="${fillRgba}" stroke="${accent}" stroke-width="2" />
    ${vertices}
  </svg>`;
}

export function renderPubgMinimapSvg(
  telemetry: SimplePubgMapTelemetry | null | undefined,
  mapName: string,
  isEn: boolean
): string {
  if (!telemetry) return '';
  const pathPts = Array.isArray(telemetry.path) ? telemetry.path : [];
  const zones = Array.isArray(telemetry.safeZones) ? telemetry.safeZones : [];
  const kills = Array.isArray(telemetry.kills) ? telemetry.kills : [];
  const deaths = Array.isArray(telemetry.deaths) ? telemetry.deaths : [];

  if (pathPts.length === 0 && kills.length === 0 && deaths.length === 0) return '';

  const mapSizeCm = Math.max(100000, Number(telemetry.mapSizeCm || 816000));
  const scale = 400 / mapSizeCm;

  let distCm = 0;
  for (let i = 1; i < pathPts.length; i += 1) {
    distCm += Math.hypot(pathPts[i].x - pathPts[i - 1].x, pathPts[i].y - pathPts[i - 1].y);
  }
  const distKm = (distCm / 100000).toFixed(2);

  const gridLines = [50, 100, 150, 200, 250, 300, 350]
    .map(
      (p) =>
        `<line x1="${p}" y1="0" x2="${p}" y2="400" stroke="#1B2332" stroke-width="0.8" />` +
        `<line x1="0" y1="${p}" x2="400" y2="${p}" stroke="#1B2332" stroke-width="0.8" />`
    )
    .join('');

  const zoneCircles = zones
    .map(
      (z, idx) =>
        `<circle cx="${(z.x * scale).toFixed(1)}" cy="${(z.y * scale).toFixed(1)}" r="${Math.max(
          4,
          z.radius * scale
        ).toFixed(1)}" fill="none" stroke="${
          idx === zones.length - 1 ? '#38BDF8' : 'rgba(148,163,184,0.38)'
        }" stroke-width="${idx === zones.length - 1 ? '1.8' : '1'}" ${
          idx === zones.length - 1 ? '' : 'stroke-dasharray="4 3"'
        } />`
    )
    .join('');

  const polyStr = pathPts
    .map((p) => `${(p.x * scale).toFixed(1)},${(p.y * scale).toFixed(1)}`)
    .join(' ');

  const startDot = pathPts[0]
    ? `<circle cx="${(pathPts[0].x * scale).toFixed(1)}" cy="${(pathPts[0].y * scale).toFixed(
        1
      )}" r="4.5" fill="#38BDF8" stroke="#0A0D12" stroke-width="1.2" />`
    : '';

  const killDots = kills
    .map(
      (k) =>
        `<circle cx="${(k.x * scale).toFixed(1)}" cy="${(k.y * scale).toFixed(
          1
        )}" r="5.5" fill="#10B981" stroke="#0A0D12" stroke-width="1.5"><title>${escapeHtml(
          k.label || 'Kill'
        )}</title></circle>`
    )
    .join('');

  const deathDots = deaths
    .map(
      (d) =>
        `<circle cx="${(d.x * scale).toFixed(1)}" cy="${(d.y * scale).toFixed(
          1
        )}" r="6" fill="#FF4655" stroke="#0A0D12" stroke-width="1.5"><title>${escapeHtml(
          d.label || 'Eliminated'
        )}</title></circle>`
    )
    .join('');

  return `
    <div style="background:#0B1017;border:1px solid #232B3B;border-radius:4px;overflow:hidden;">
      <svg viewBox="0 0 400 400" style="width:100%;height:auto;display:block;" role="img" aria-label="${escapeHtml(
        isEn ? `2D rotation and safe zone map for ${mapName}` : `So do 2D di chuyen va vong bo ${mapName}`
      )}">
        ${gridLines}
        ${zoneCircles}
        ${polyStr ? `<polyline points="${polyStr}" fill="none" stroke="#E59A23" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" opacity="0.92" />` : ''}
        ${startDot}
        ${killDots}
        ${deathDots}
      </svg>
    </div>
    <div style="display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px;margin-top:8px;font-family:ui-monospace,monospace;font-size:11px;color:#94A3B8;">
      <span><strong style="color:#38BDF8;">●</strong> ${isEn ? 'Drop' : 'Nhay du'} &nbsp; <strong style="color:#10B981;">●</strong> Kill (${kills.length}) &nbsp; <strong style="color:#FF4655;">●</strong> ${isEn ? 'Eliminated' : 'Bi ha'} (${deaths.length})</span>
      <span style="color:#E59A23;">${distKm} km | ${zones.length} ${isEn ? 'zones' : 'vong bo'}</span>
    </div>
  `;
}

export function renderReleaseMarkdownLite(markdown: string): string {
  const lines = String(markdown || '')
    .replace(/\r\n/g, '\n')
    .split('\n');
  const out: string[] = [];
  let inList = false;

  const formatInline = (text: string) =>
    escapeHtml(text)
      .replace(/\*\*(.+?)\*\*/g, '<strong style="color:#EEF2F6;">$1</strong>')
      .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      if (inList) {
        out.push('</ul>');
        inList = false;
      }
      continue;
    }
    if (line.startsWith('### ')) {
      if (inList) {
        out.push('</ul>');
        inList = false;
      }
      out.push(`<h4 class="changelog-sub">${formatInline(line.slice(4))}</h4>`);
    } else if (line.startsWith('## ')) {
      if (inList) {
        out.push('</ul>');
        inList = false;
      }
      out.push(`<h3 class="changelog-heading">${formatInline(line.slice(3))}</h3>`);
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      if (!inList) {
        out.push('<ul class="changelog-list">');
        inList = true;
      }
      out.push(`<li>${formatInline(line.slice(2))}</li>`);
    } else {
      if (inList) {
        out.push('</ul>');
        inList = false;
      }
      out.push(`<p style="margin:6px 0;">${formatInline(line)}</p>`);
    }
  }
  if (inList) out.push('</ul>');
  return out.join('\n');
}

export const webPortalStyles = `
  :root,
  [data-theme='valorant'] {
    --bg-obsidian: #090C12;
    --bg-panel: #10141C;
    --bg-elevated: #171D28;
    --border-hairline: #232B3B;
    --text-primary: #EEF2F6;
    --text-secondary: #94A3B8;
    --text-muted: #64748B;
    --accent-primary: #FF4655;
    --accent-primary-fg: #FFFFFF;
    --accent-secondary: #38BDF8;
    --accent-crimson: #FF4655;
    --accent-amber: #E59A23;
    --accent-emerald: #10B981;
    --accent-sky: #38BDF8;
    --theme-grid: rgba(255, 70, 85, 0.045);
    --theme-glow-1: rgba(255, 70, 85, 0.12);
    --theme-glow-2: rgba(56, 189, 248, 0.07);
    --ribbon-gradient: linear-gradient(90deg, #FF4655 0%, #FF4655 68%, #38BDF8 100%);
  }

  [data-theme='pubg'] {
    --bg-obsidian: #0B0E12;
    --bg-panel: #11161E;
    --accent-primary: #E59A23;
    --accent-primary-fg: #0A0D12;
    --accent-secondary: #10B981;
    --theme-grid: rgba(229, 154, 35, 0.05);
    --theme-glow-1: rgba(229, 154, 35, 0.12);
    --theme-glow-2: rgba(16, 185, 129, 0.07);
    --ribbon-gradient: linear-gradient(90deg, #E59A23 0%, #E59A23 68%, #10B981 100%);
  }

  * { box-sizing: border-box; }

  body {
    margin: 0;
    font-family: "Be Vietnam Pro", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background-color: var(--bg-obsidian);
    background-image:
      radial-gradient(620px circle at 10% 0%, var(--theme-glow-1), transparent 65%),
      radial-gradient(540px circle at 92% 4%, var(--theme-glow-2), transparent 65%),
      linear-gradient(to right, var(--theme-grid) 1px, transparent 1px),
      linear-gradient(to bottom, var(--theme-grid) 1px, transparent 1px);
    background-size: auto, auto, 42px 42px, 42px 42px;
    color: var(--text-primary);
    line-height: 1.65;
    min-height: 100vh;
    transition: background-color 220ms ease;
  }

  .top-ribbon {
    height: 3px;
    width: 100%;
    background: var(--ribbon-gradient);
  }

  .container {
    max-width: 1180px;
    margin: 0 auto;
    padding: 24px 22px 56px;
  }

  header {
    border-bottom: 1px solid var(--border-hairline);
    padding-bottom: 16px;
    margin-bottom: 30px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 14px;
  }

  .brand {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    font-size: 19px;
    font-weight: 800;
    color: #ffffff;
    text-decoration: none;
    letter-spacing: -0.02em;
  }

  .brand-mark {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border-radius: 2px;
    background: var(--accent-primary);
    color: var(--accent-primary-fg);
    font-size: 13px;
    font-weight: 900;
    transition: background-color 200ms ease;
  }

  .brand span.accent { color: var(--accent-primary); }

  nav {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 14px;
  }

  nav a {
    color: var(--text-secondary);
    text-decoration: none;
    font-size: 13px;
    font-weight: 600;
    transition: color 0.15s ease;
  }

  nav a:hover { color: #ffffff; }
  nav a.nav-active {
    color: #ffffff;
    border-bottom: 2px solid var(--accent-primary);
    padding-bottom: 2px;
  }

  nav a.nav-cta {
    padding: 7px 13px;
    border-radius: 2px;
    background: var(--accent-primary);
    color: var(--accent-primary-fg);
    font-weight: 700;
  }

  nav a.nav-cta:hover { filter: brightness(1.08); }

  .lang-switch {
    display: inline-flex;
    border: 1px solid var(--border-hairline);
    background: var(--bg-panel);
    border-radius: 2px;
    overflow: hidden;
  }

  .lang-switch a {
    padding: 4px 9px;
    font-size: 11px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    color: var(--text-secondary);
    text-decoration: none;
  }

  .lang-switch a.active {
    background: var(--bg-elevated);
    color: #38BDF8;
    font-weight: 700;
  }

  h1 {
    color: #ffffff;
    font-size: clamp(26px, 3.3vw, 40px);
    line-height: 1.12;
    letter-spacing: -0.02em;
    margin: 0 0 14px;
  }

  h2 {
    color: #f8fafc;
    font-size: 20px;
    margin: 30px 0 12px;
    letter-spacing: -0.01em;
  }

  h3 {
    color: #f8fafc;
    font-size: 15px;
    margin: 0 0 6px;
  }

  p, li {
    color: #cbd5e1;
    font-size: 14px;
  }

  .badge {
    display: inline-block;
    padding: 4px 10px;
    border-radius: 2px;
    background: rgba(16, 185, 129, 0.12);
    border: 1px solid rgba(16, 185, 129, 0.35);
    color: #34d399;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 11px;
    font-weight: 700;
    margin-bottom: 14px;
    letter-spacing: 0.04em;
  }

  .hero-split {
    display: grid;
    grid-template-columns: 1.28fr 0.92fr;
    gap: 24px;
    align-items: stretch;
  }

  @media (max-width: 860px) {
    .hero-split { grid-template-columns: 1fr; }
  }

  .card {
    background: var(--bg-panel);
    border: 1px solid var(--border-hairline);
    border-radius: 4px;
    padding: 20px;
  }

  .cta-row {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 20px;
  }

  .btn-primary {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 11px 18px;
    border-radius: 2px;
    background: var(--accent-primary);
    color: var(--accent-primary-fg);
    font-weight: 700;
    font-size: 13px;
    text-decoration: none;
    border: 1px solid var(--accent-primary);
    cursor: pointer;
    transition: filter 0.15s ease;
  }

  .btn-primary:hover { filter: brightness(1.08); }

  .btn-secondary {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 11px 16px;
    border-radius: 2px;
    background: var(--bg-elevated);
    color: var(--text-primary);
    font-weight: 600;
    font-size: 13px;
    text-decoration: none;
    border: 1px solid #334155;
    cursor: pointer;
  }

  .btn-secondary:hover { background: #1e293b; }

  .game-switch-bar {
    display: inline-flex;
    gap: 4px;
    padding: 4px;
    border-radius: 2px;
    background: #0A0D12;
    border: 1px solid var(--border-hairline);
    margin-bottom: 16px;
  }

  .game-switch-btn {
    border: 0;
    padding: 7px 14px;
    border-radius: 2px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 12px;
    font-weight: 700;
    background: transparent;
    color: var(--text-secondary);
    cursor: pointer;
    transition: background-color 0.15s ease, color 0.15s ease;
  }

  .game-switch-btn.active-valo {
    background: #FF4655;
    color: #FFFFFF;
  }

  .game-switch-btn.active-pubg {
    background: #E59A23;
    color: #0A0D12;
  }

  .feature-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 14px;
    margin-top: 14px;
  }

  @media (max-width: 900px) {
    .feature-grid { grid-template-columns: repeat(2, 1fr); }
  }

  @media (max-width: 580px) {
    .feature-grid { grid-template-columns: 1fr; }
  }

  .feature-card {
    background: var(--bg-panel);
    border: 1px solid var(--border-hairline);
    border-radius: 4px;
    padding: 16px;
  }

  .feature-tag {
    display: inline-block;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--accent-secondary);
    margin-bottom: 6px;
  }

  .flow-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 14px;
    margin-top: 14px;
  }

  @media (max-width: 920px) {
    .flow-grid { grid-template-columns: repeat(2, 1fr); }
  }

  @media (max-width: 540px) {
    .flow-grid { grid-template-columns: 1fr; }
  }

  .flow-step {
    background: var(--bg-panel);
    border: 1px solid var(--border-hairline);
    border-top: 2px solid var(--accent-primary);
    border-radius: 4px;
    padding: 16px;
  }

  .step-tag {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 11px;
    font-weight: 700;
    color: var(--accent-amber);
    margin-bottom: 8px;
    display: block;
  }

  .api-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 12px;
    font-size: 13px;
  }

  .api-table th, .api-table td {
    text-align: left;
    padding: 10px 12px;
    border-bottom: 1px solid var(--border-hairline);
  }

  .api-table th {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 11px;
    color: var(--text-secondary);
    text-transform: uppercase;
  }

  .mono {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 12px;
    color: #38bdf8;
  }

  .inline-code {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 11.5px;
    background: #171D28;
    border: 1px solid #232B3B;
    color: #38BDF8;
    padding: 1px 5px;
    border-radius: 2px;
  }

  .changelog-heading {
    font-size: 15px;
    color: #EEF2F6;
    margin: 12px 0 6px;
  }

  .changelog-sub {
    font-size: 12px;
    font-family: ui-monospace, monospace;
    color: #E59A23;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin: 12px 0 6px;
  }

  .changelog-list {
    margin: 6px 0 10px;
    padding-left: 18px;
  }

  .changelog-list li {
    margin-bottom: 6px;
    font-size: 13px;
    color: #CBD5E1;
  }

  .metrics-strip {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    margin-bottom: 12px;
  }

  .metric-box {
    background: #0A0D12;
    border: 1px solid #232B3B;
    border-radius: 2px;
    padding: 8px;
    text-align: center;
    font-family: ui-monospace, monospace;
  }

  .metric-label {
    display: block;
    font-size: 10px;
    color: #64748B;
  }

  .metric-val {
    font-size: 15px;
    font-weight: 700;
  }

  footer {
    margin-top: 48px;
    padding-top: 20px;
    border-top: 1px solid var(--border-hairline);
    font-size: 12px;
    color: var(--text-muted);
  }
`;

export function renderPortalLayout(options: {
  currentPath: WebRoutePath;
  title: string;
  bodyHtml: string;
  isEn: boolean;
  latestVersion: string;
  defaultTheme?: 'valorant' | 'pubg';
  extraHead?: string;
}): string {
  const {
    currentPath,
    title,
    bodyHtml,
    isEn,
    latestVersion,
    defaultTheme = 'valorant',
    extraHead = '',
  } = options;
  const qs = langQueryString(isEn);

  return `<!DOCTYPE html>
<html lang="${isEn ? 'en' : 'vi'}" data-theme="${defaultTheme}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)} - TacticalReplayAI</title>
  <meta name="description" content="${escapeHtml(
    isEn
      ? 'TacticalReplayAI - Free post-match replay recorder, 5-axis combat radar, PUBG 2D rotation map, and AI Coach for VALORANT & PUBG.'
      : 'TacticalReplayAI - Ung dung tu dong quay highlight, bieu do radar 5 truc, so do vong bo 2D va AI Coach cho VALORANT & PUBG.'
  )}" />
  <meta property="og:site_name" content="TacticalReplayAI" />
  <meta property="og:title" content="${escapeHtml(title)} - TacticalReplayAI" />
  <meta property="og:type" content="website" />
  <meta name="theme-color" content="${defaultTheme === 'pubg' ? '#E59A23' : '#FF4655'}" />
  <style>${webPortalStyles}</style>
  ${extraHead}
</head>
<body>
  <div class="top-ribbon"></div>
  <div class="container">
    <header>
      <a class="brand" href="/${qs}">
        <span class="brand-mark">TR</span>
        <span>TacticalReplay<span class="accent">AI</span></span>
      </a>
      <nav aria-label="${isEn ? 'Primary navigation' : 'Dieu huong chinh'}">
        <a href="/${qs}" class="${currentPath === '/' ? 'nav-active' : ''}">${isEn ? 'Overview' : 'Trang chủ'}</a>
        <a href="/demo${qs}" class="${currentPath === '/demo' ? 'nav-active' : ''}">${isEn ? 'Web Demo' : 'Dùng thử Web'}</a>
        <a href="/tools${qs}" class="${currentPath === '/tools' ? 'nav-active' : ''}">${isEn ? 'Sens &amp; Crosshair' : 'Đổi Sens &amp; Tâm'}</a>
        <a href="/changelog${qs}" class="${currentPath === '/changelog' ? 'nav-active' : ''}">${isEn ? 'Changelog' : 'Nhật ký bản mới'}</a>
        <a href="/privacy${qs}" class="${currentPath === '/privacy' ? 'nav-active' : ''}">${isEn ? 'Privacy' : 'Bảo mật'}</a>
        <a href="/terms${qs}" class="${currentPath === '/terms' ? 'nav-active' : ''}">${isEn ? 'Terms' : 'Điều khoản'}</a>
        <a href="/download" class="nav-cta">${isEn ? `Download v${escapeHtml(latestVersion)}` : `Tải v${escapeHtml(latestVersion)}`}</a>
        <span class="lang-switch" aria-label="${isEn ? 'Language switcher' : 'Chuyen ngon ngu'}">
          <a href="${currentPath}?lang=en" class="${isEn ? 'active' : ''}">EN</a>
          <a href="${currentPath}?lang=vi" class="${!isEn ? 'active' : ''}">VI</a>
        </span>
      </nav>
    </header>
    ${bodyHtml}
    <footer>
      <p style="margin-bottom:6px;">
        ${
          isEn
            ? `TacticalReplayAI v${escapeHtml(latestVersion)} - Free community post-match coaching &amp; replay review for VALORANT &amp; PUBG.`
            : `TacticalReplayAI v${escapeHtml(latestVersion)} - Nền tảng xem lại video và phân tích chiến thuật sau trận đấu dành cho cộng đồng VALORANT &amp; PUBG.`
        }
      </p>
      <p>TacticalReplayAI isn't endorsed by Riot Games or KRAFTON and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, VALORANT, PUBG, and all associated properties are trademarks or registered trademarks of their respective owners.</p>
    </footer>
  </div>
</body>
</html>`;
}

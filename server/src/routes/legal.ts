import { Router, Request, Response } from 'express';

const router = Router();

const baseStyles = `
  :root {
    --bg-obsidian: #0A0D12;
    --bg-panel: #10141C;
    --bg-elevated: #171D28;
    --border-hairline: #232B3B;
    --text-primary: #EEF2F6;
    --text-secondary: #94A3B8;
    --text-muted: #64748B;
    --accent-crimson: #FF4655;
    --accent-amber: #E59A23;
    --accent-emerald: #10B981;
    --accent-sky: #38BDF8;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: var(--bg-obsidian);
    color: var(--text-primary);
    line-height: 1.6;
  }
  .container {
    max-width: 1120px;
    margin: 0 auto;
    padding: 28px 24px 56px;
  }
  header {
    border-bottom: 1px solid var(--border-hairline);
    padding-bottom: 18px;
    margin-bottom: 32px;
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
    background: var(--accent-crimson);
    color: #ffffff;
    font-size: 13px;
    font-weight: 900;
  }
  .brand span.accent { color: var(--accent-crimson); }
  nav {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 18px;
  }
  nav a {
    color: var(--text-secondary);
    text-decoration: none;
    font-size: 13px;
    font-weight: 600;
    transition: color 0.15s ease;
  }
  nav a:hover { color: #ffffff; }
  nav a.nav-cta {
    padding: 7px 14px;
    border-radius: 2px;
    background: var(--accent-crimson);
    color: #ffffff;
    font-weight: 700;
  }
  nav a.nav-cta:hover { background: #f43f5e; }
  h1 {
    color: #ffffff;
    font-size: clamp(26px, 3.2vw, 38px);
    line-height: 1.15;
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
    grid-template-columns: 1.3fr 0.9fr;
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
    padding: 22px;
  }
  .cta-row {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-top: 22px;
  }
  .btn-primary {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 11px 18px;
    border-radius: 2px;
    background: var(--accent-crimson);
    color: #ffffff;
    font-weight: 700;
    font-size: 13px;
    text-decoration: none;
    border: 1px solid var(--accent-crimson);
    cursor: pointer;
  }
  .btn-primary:hover { background: #e11d48; }
  .btn-secondary {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 11px 18px;
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
    border-top: 2px solid var(--accent-crimson);
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
  footer {
    margin-top: 52px;
    padding-top: 22px;
    border-top: 1px solid var(--border-hairline);
    font-size: 12px;
    color: var(--text-muted);
  }
`;

const layout = (title: string, bodyHtml: string, extraHead = '') => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} - TacticalReplayAI</title>
  <style>${baseStyles}</style>
  ${extraHead}
</head>
<body>
  <div class="container">
    <header>
      <a class="brand" href="/">
        <span class="brand-mark">TR</span>
        <span>TacticalReplay<span class="accent">AI</span></span>
      </a>
      <nav>
        <a href="/">Overview &amp; UX Flow</a>
        <a href="/demo" class="nav-cta">Interactive Web Prototype</a>
        <a href="/privacy">Privacy Policy</a>
        <a href="/terms">Terms of Service</a>
      </nav>
    </header>
    ${bodyHtml}
    <footer>
      <p>TacticalReplayAI isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, VALORANT, and all associated properties are trademarks or registered trademarks of Riot Games, Inc.</p>
    </footer>
  </div>
</body>
</html>`;

// 0. GET /riot.txt — Riot Developer Portal domain ownership verification
router.get('/riot.txt', (_req: Request, res: Response) => {
  const verificationToken = (
    process.env.RIOT_VERIFY_TOKEN || '4250f227-8b94-405d-99ba-8546497b81d1'
  ).trim();
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.send(verificationToken);
});

// 1. GET / — Public Overview, Visual UX Flow & Policy Showcase for Riot Reviewers
router.get('/', (_req: Request, res: Response) => {
  res.send(
    layout(
      'Post-Match Tactical Replay & Coaching',
      `
      <div class="hero-split">
        <div>
          <span class="badge">VANGUARD COMPLIANT - POST-MATCH ONLY - RSO PROTECTED</span>
          <h1>Post-Match Video Replay &amp; Tactical Analysis for VALORANT</h1>
          <p style="max-width:60ch;">
            TacticalReplayAI is a free, public community coaching platform that helps VALORANT players review completed matches by pairing local Overwolf gameplay clips with round-by-round economy breakdowns, telestrator drawing tools, and AI-assisted post-match debriefs.
          </p>
          <div class="cta-row">
            <a class="btn-primary" href="/demo">Launch Interactive Web Prototype (/demo)</a>
            <a class="btn-secondary" href="https://github.com/kietthanh080-lab/fps-tactical-coach" target="_blank" rel="noreferrer">View Source Repository</a>
          </div>
        </div>

        <div class="card">
          <h3>Riot Policy &amp; Fair Play Guarantees</h3>
          <ul style="padding-left:18px;margin:10px 0 0;">
            <li><strong>Post-Match Only:</strong> Zero live overlays, zero agent-select scouting, and zero real-time opponent or economy tracking during active matches.</li>
            <li><strong>RSO-Gated Personal Data:</strong> Players must explicitly authenticate via Riot Sign On (RSO) before accessing their match history or personal coaching reports.</li>
            <li><strong>No Store Checker / No Hidden MMR:</strong> Does not inspect the VALORANT item store, calculate hidden MMR, or expose global ranked leaderboards.</li>
            <li><strong>No Memory Reading:</strong> Relies strictly on official Riot APIs and Overwolf's compliant streaming framework.</li>
          </ul>
        </div>
      </div>

      <h2>Visual User Experience &amp; API Flow</h2>
      <p>End-to-end architecture demonstrating how players authenticate with RSO and review completed matches without requiring reviewers to install external binaries.</p>

      <div class="flow-grid">
        <div class="flow-step">
          <span class="step-tag">STEP 01 - AUTHENTICATION</span>
          <h3>Riot Sign On (RSO)</h3>
          <p>Player initiates OAuth2 login in their default browser (<span class="mono">auth.riotgames.com</span>, scopes: <span class="mono">openid offline_access</span>). Our server verifies state and fetches PUUID via <span class="mono">ACCOUNT-V1</span>.</p>
        </div>
        <div class="flow-step">
          <span class="step-tag">STEP 02 - CAPTURE</span>
          <h3>Post-Match Local Clip</h3>
          <p>During a match, Overwolf records video locally with zero overlays or live prompts. Round timestamps are saved only for post-match timeline scrubbing.</p>
        </div>
        <div class="flow-step">
          <span class="step-tag">STEP 03 - POST-MATCH API</span>
          <h3>VAL-MATCH-V1 Analysis</h3>
          <p>After match completion, the backend calls <span class="mono">val-match-v1</span> for that authenticated PUUID to classify round economy (Eco, Force, Bonus, Full Buy) and detect untraded deaths.</p>
        </div>
        <div class="flow-step">
          <span class="step-tag">STEP 04 - COACHING UI</span>
          <h3>Telestrator &amp; AI Debrief</h3>
          <p>In the desktop cockpit, players jump to round markers, draw tactical arrows on the video frame, store sensitivity presets, and ask the AI Coach about completed rounds.</p>
        </div>
      </div>

      <div class="card" style="margin-top:26px;">
        <h3>Intended Riot API Endpoints &amp; Data Scope</h3>
        <table class="api-table">
          <thead>
            <tr>
              <th>API Product</th>
              <th>Endpoint Used</th>
              <th>Purpose &amp; Timing</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Riot Sign On (RSO)</strong></td>
              <td class="mono">/authorize, /token</td>
              <td>Verify player account ownership before loading any personal match history or clips.</td>
            </tr>
            <tr>
              <td><strong>ACCOUNT-V1</strong></td>
              <td class="mono">/riot/account/v1/accounts/me<br/>/riot/account/v1/active-shards/by-game/val/by-puuid/{puuid}</td>
              <td>Read the signed-in user's PUUID, Game Name, Tag Line, and active VALORANT shard.</td>
            </tr>
            <tr>
              <td><strong>VAL-MATCH-V1</strong></td>
              <td class="mono">/val/match/v1/matchlists/by-puuid/{puuid}<br/>/val/match/v1/matches/{matchId}</td>
              <td>Retrieve the signed-in user's completed matches (up to 20 most recent) to compute post-match round economy and weapon summaries.</td>
            </tr>
          </tbody>
        </table>
      </div>
      `
    )
  );
});

// 2. GET /demo — Public Interactive Web Prototype for Riot API Reviewers (Zero Login / Zero Download)
router.get('/demo', (_req: Request, res: Response) => {
  const demoStyles = `
  <style>
    .demo-banner {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 12px 16px;
      background: #10141C;
      border: 1px solid #334155;
      border-left: 3px solid #E59A23;
      border-radius: 4px;
      margin-bottom: 18px;
      font-size: 13px;
    }
    .cockpit {
      display: grid;
      grid-template-columns: 270px 1fr 310px;
      gap: 14px;
      align-items: start;
    }
    @media (max-width: 1020px) {
      .cockpit { grid-template-columns: 1fr; }
    }
    .panel {
      background: #10141C;
      border: 1px solid #232B3B;
      border-radius: 4px;
      padding: 14px;
    }
    .panel-title {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.06em;
      color: #94A3B8;
      text-transform: uppercase;
      border-bottom: 1px solid #232B3B;
      padding-bottom: 10px;
      margin: 0 0 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .match-btn {
      width: 100%;
      text-align: left;
      padding: 10px;
      border-radius: 2px;
      border: 1px solid #232B3B;
      background: #0A0D12;
      color: #EEF2F6;
      cursor: pointer;
      margin-bottom: 8px;
      display: block;
    }
    .match-btn.active {
      border-color: #FF4655;
      background: rgba(255, 70, 85, 0.12);
    }
    .pill {
      display: inline-block;
      padding: 2px 6px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 10px;
      font-weight: 700;
      border-radius: 2px;
    }
    .pill-win { background: rgba(16,185,129,0.15); color: #34d399; border: 1px solid rgba(16,185,129,0.35); }
    .pill-loss { background: rgba(244,63,94,0.15); color: #fb7185; border: 1px solid rgba(244,63,94,0.35); }
    .pill-eco { background: rgba(56,189,248,0.15); color: #38bdf8; border: 1px solid rgba(56,189,248,0.35); }
    .stage-wrap {
      position: relative;
      width: 100%;
      aspect-ratio: 16 / 9;
      background: #0A0D12;
      border: 1px solid #232B3B;
      border-radius: 2px;
      overflow: hidden;
    }
    .stage-wrap canvas {
      display: block;
      width: 100%;
      height: 100%;
      cursor: crosshair;
    }
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      margin-bottom: 10px;
    }
    .tool-btn {
      padding: 6px 10px;
      border-radius: 2px;
      border: 1px solid #232B3B;
      background: #171D28;
      color: #cbd5e1;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
    }
    .tool-btn.active {
      background: #FF4655;
      border-color: #FF4655;
      color: #ffffff;
    }
    .round-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin-top: 12px;
    }
    @media (max-width: 640px) {
      .round-grid { grid-template-columns: repeat(2, 1fr); }
    }
    .round-card {
      padding: 9px;
      border-radius: 2px;
      border: 1px solid #232B3B;
      background: #0A0D12;
      color: #EEF2F6;
      text-align: left;
      cursor: pointer;
    }
    .round-card.active {
      border-color: #FF4655;
      background: rgba(255, 70, 85, 0.12);
    }
    .tab-row {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 4px;
      background: #0A0D12;
      border: 1px solid #232B3B;
      padding: 4px;
      border-radius: 2px;
      margin-bottom: 12px;
    }
    .tab-btn {
      padding: 7px 6px;
      border: 0;
      border-radius: 2px;
      background: transparent;
      color: #94A3B8;
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
    }
    .tab-btn.active {
      background: #FF4655;
      color: #ffffff;
    }
    .rso-sim-box {
      padding: 12px;
      background: #0A0D12;
      border: 1px solid #232B3B;
      border-radius: 2px;
      margin-bottom: 12px;
      font-size: 12px;
    }
    .callout-good {
      padding: 8px 10px;
      border-radius: 2px;
      background: rgba(16, 185, 129, 0.1);
      border: 1px solid rgba(16, 185, 129, 0.35);
      font-size: 12px;
      margin-bottom: 6px;
    }
    .callout-warn {
      padding: 8px 10px;
      border-radius: 2px;
      background: rgba(229, 154, 35, 0.1);
      border: 1px solid rgba(229, 154, 35, 0.35);
      font-size: 12px;
      margin-bottom: 6px;
    }
  </style>`;

  res.send(
    layout(
      'Interactive Web Prototype',
      `
      <div class="demo-banner">
        <div>
          <strong style="color:#E59A23;">PUBLIC REVIEW PROTOTYPE (SAMPLE DATA)</strong>
          <span style="color:#cbd5e1;"> - Interactive web walkthrough for Riot API reviewers. No login or external download required; production match access is strictly gated behind Riot Sign On (RSO).</span>
        </div>
        <button id="rsoSimBtn" type="button" class="btn-primary" style="padding:8px 14px;font-size:12px;">Simulate RSO Login Flow</button>
      </div>

      <div id="rsoFlowLog" class="rso-sim-box" style="display:none;"></div>

      <div class="cockpit">
        <!-- Left: Sample 20-Match Rolling Queue -->
        <aside class="panel">
          <div class="panel-title">
            <span>20-Match History (Demo)</span>
            <span class="mono">RSO SYNC</span>
          </div>
          <div id="matchList"></div>
          <p style="font-size:11px;color:#64748B;margin:10px 0 0;">
            In production, matches are fetched strictly post-match using the signed-in user's RSO PUUID via <span class="mono">val-match-v1</span>.
          </p>
        </aside>

        <!-- Center: Replay Canvas + Telestrator + Round Timeline -->
        <section class="panel">
          <div class="toolbar">
            <div>
              <strong id="stageTitle" style="font-size:15px;">Ascent (VICTORY 13-9)</strong>
              <div id="stageSubtitle" class="mono" style="color:#94A3B8;font-size:11px;">Round 01 - Post-Match Replay Canvas (Click &amp; drag to draw)</div>
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;">
              <button type="button" class="tool-btn active" data-tool="arrow">Arrow</button>
              <button type="button" class="tool-btn" data-tool="circle">Circle</button>
              <button type="button" class="tool-btn" data-tool="pen">Pen</button>
              <button type="button" class="tool-btn" id="clearDrawBtn">Clear Drawings</button>
            </div>
          </div>

          <div class="stage-wrap">
            <canvas id="replayCanvas" width="800" height="450"></canvas>
          </div>

          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;font-size:12px;color:#94A3B8;">
            <span class="mono" id="timelineMarkerInfo">Timeline Marker: 00:42 - Round 01 (Opening Pick)</span>
            <span class="mono">Telestrator Active</span>
          </div>

          <div class="panel-title" style="margin-top:16px;">
            <span>Round-by-Round Breakdown</span>
            <span class="mono">SELECT ROUND</span>
          </div>
          <div id="roundGrid" class="round-grid"></div>
        </section>

        <!-- Right: Tactical Analysis & AI Coach -->
        <aside class="panel">
          <div class="tab-row">
            <button type="button" class="tab-btn active" data-tab="round">Round Detail</button>
            <button type="button" class="tab-btn" data-tab="match">Match Summary</button>
            <button type="button" class="tab-btn" data-tab="coach">AI Coach</button>
          </div>
          <div id="inspectorBody"></div>
        </aside>
      </div>

      <script>
        (function() {
          var sampleMatches = [
            {
              id: 'sample-ascent-01',
              map: 'Ascent',
              mode: 'COMPETITIVE',
              result: 'VICTORY',
              score: '13-9 - 21/14/6 KDA',
              overallScore: 8.4,
              commentary: 'Strong rifle impact on A-Main control (420 DMG in R05) and disciplined eco conversion. Focus on trading early picks on B-Lane defense.',
              rounds: [
                { num: 1, res: 'WIN', kda: '2/0/1', dmg: 265, eco: 'ECO', style: 'FAST_EXECUTE', weapon: 'Classic / Ghost', time: '00:42', good: ['Opening Pick: Won first duel at A-Main creating 5v4 advantage.','Thrifty Pistol Win: Coordinated utility push on A-Site.'], bad: [] },
                { num: 3, res: 'LOSS', kda: '0/1/0', dmg: 40, eco: 'FORCE_BUY', style: 'DEFAULT_CONTROL', weapon: 'Spectre', time: '04:15', good: [], bad: ['Untraded Death: Peeked Mid Catwalk alone without teammate trade support.'] },
                { num: 5, res: 'WIN', kda: '3/0/0', dmg: 420, eco: 'FULL_BUY', style: 'FAST_EXECUTE', weapon: 'Vandal', time: '08:10', good: ['Multi-Kill (3K): High rifle accuracy holding A-Heaven post-plant.'], bad: [] },
                { num: 12, res: 'LOSS', kda: '1/1/1', dmg: 145, eco: 'BONUS', style: 'FAKE_ROTATE', weapon: 'Sheriff', time: '19:30', good: ['Converted early damage on Bonus round.'], bad: ['Unused Utility: Eliminated with 2 abilities unspent during retake.'] }
              ]
            },
            {
              id: 'sample-haven-02',
              map: 'Haven',
              mode: 'COMPETITIVE',
              result: 'DEFEAT',
              score: '11-13 - 18/17/5 KDA',
              overallScore: 6.8,
              commentary: 'Solid C-Long sniper openings, but late-half Force Buy rounds drained team economy before Round 22.',
              rounds: [
                { num: 2, res: 'WIN', kda: '2/1/0', dmg: 290, eco: 'FULL_BUY', style: 'DEFAULT_CONTROL', weapon: 'Bulldog', time: '02:20', good: ['Multi-Kill (2K): Cleared Garage pressure cleanly.'], bad: [] },
                { num: 8, res: 'LOSS', kda: '0/1/0', dmg: 0, eco: 'FORCE_BUY', style: 'DEFAULT_CONTROL', weapon: 'Sheriff', time: '12:55', good: [], bad: ['Untraded Death: Aggressive dry peek on C-Long against Operator angle.'] },
                { num: 15, res: 'WIN', kda: '2/0/1', dmg: 310, eco: 'FULL_BUY', style: 'FAST_EXECUTE', weapon: 'Phantom', time: '24:40', good: ['Opening Pick: Secured A-Short entry and early Spike plant.'], bad: [] },
                { num: 22, res: 'LOSS', kda: '1/1/0', dmg: 135, eco: 'ECO', style: 'DEFAULT_CONTROL', weapon: 'Ghost', time: '36:12', good: [], bad: ['Lost post-plant crossfire due to wide swing with 10s left.'] }
              ]
            }
          ];

          var state = {
            matchIdx: 0,
            roundIdx: 0,
            tab: 'round',
            tool: 'arrow',
            shapes: [],
            drawing: false,
            current: null,
            coachReply: 'Select a sample prompt below to preview how AI Coach explains mistakes from completed match telemetry.'
          };

          var canvas = document.getElementById('replayCanvas');
          var ctx = canvas.getContext('2d');

          function drawStage() {
            var m = sampleMatches[state.matchIdx];
            var r = m.rounds[state.roundIdx];
            ctx.fillStyle = '#0A0D12';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Tactical grid & sample map geometry
            ctx.strokeStyle = 'rgba(35, 43, 59, 0.7)';
            ctx.lineWidth = 1;
            for (var x = 0; x <= canvas.width; x += 40) {
              ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
            }
            for (var y = 0; y <= canvas.height; y += 40) {
              ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
            }

            // Simulated tactical site & lane schematics
            ctx.strokeStyle = '#334155';
            ctx.lineWidth = 2;
            ctx.strokeRect(80, 75, 220, 140);
            ctx.strokeRect(500, 75, 220, 140);
            ctx.strokeRect(310, 230, 180, 140);

            ctx.fillStyle = 'rgba(255, 70, 85, 0.14)';
            ctx.fillRect(80, 75, 220, 140);
            ctx.fillStyle = 'rgba(16, 185, 129, 0.12)';
            ctx.fillRect(500, 75, 220, 140);

            ctx.fillStyle = '#94A3B8';
            ctx.font = 'bold 13px monospace';
            ctx.fillText('A SITE - POST-MATCH REPLAY FRAME', 96, 102);
            ctx.fillText('B SITE - LANE CONTROL', 518, 102);
            ctx.fillText('MID COURTYARD', 345, 258);

            // Round telemetry HUD overlay inside replay frame
            ctx.fillStyle = 'rgba(16, 20, 28, 0.9)';
            ctx.fillRect(16, 16, 360, 44);
            ctx.strokeStyle = '#FF4655';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(16, 16, 360, 44);
            ctx.fillStyle = '#EEF2F6';
            ctx.font = 'bold 13px monospace';
            ctx.fillText(m.map.toUpperCase() + ' // ROUND ' + String(r.num).padStart(2, '0') + ' // ' + r.eco, 28, 43);

            // Sample player & event markers
            ctx.fillStyle = '#10B981';
            ctx.beginPath(); ctx.arc(190, 155, 9, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#EEF2F6';
            ctx.font = '11px monospace';
            ctx.fillText('PLAYER (' + r.weapon + ')', 206, 159);

            ctx.fillStyle = '#FF4655';
            ctx.beginPath(); ctx.arc(580, 150, 9, 0, Math.PI * 2); ctx.fill();
            ctx.fillText('ENGAGEMENT ZONE', 596, 154);

            // Draw user telestrator annotations
            var all = state.current ? state.shapes.concat([state.current]) : state.shapes;
            all.forEach(function(sh) {
              if (!sh.points.length) return;
              ctx.strokeStyle = '#E59A23';
              ctx.fillStyle = '#E59A23';
              ctx.lineWidth = 3;
              ctx.lineCap = 'round';
              if (sh.tool === 'pen') {
                ctx.beginPath();
                sh.points.forEach(function(pt, idx) {
                  if (idx === 0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y);
                });
                ctx.stroke();
              } else if (sh.tool === 'arrow' && sh.points.length >= 2) {
                var s = sh.points[0], e = sh.points[sh.points.length - 1];
                var ang = Math.atan2(e.y - s.y, e.x - s.x);
                ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(e.x, e.y); ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(e.x, e.y);
                ctx.lineTo(e.x - 14 * Math.cos(ang - Math.PI / 6), e.y - 14 * Math.sin(ang - Math.PI / 6));
                ctx.lineTo(e.x - 14 * Math.cos(ang + Math.PI / 6), e.y - 14 * Math.sin(ang + Math.PI / 6));
                ctx.closePath(); ctx.fill();
              } else if (sh.tool === 'circle' && sh.points.length >= 2) {
                var c1 = sh.points[0], c2 = sh.points[sh.points.length - 1];
                ctx.beginPath();
                ctx.ellipse((c1.x + c2.x) / 2, (c1.y + c2.y) / 2, Math.abs(c2.x - c1.x) / 2, Math.abs(c2.y - c1.y) / 2, 0, 0, Math.PI * 2);
                ctx.stroke();
              }
            });
          }

          function getCoords(ev) {
            var rect = canvas.getBoundingClientRect();
            return {
              x: (ev.clientX - rect.left) * (canvas.width / rect.width),
              y: (ev.clientY - rect.top) * (canvas.height / rect.height)
            };
          }

          canvas.addEventListener('mousedown', function(ev) {
            state.drawing = true;
            state.current = { tool: state.tool, points: [getCoords(ev)] };
            drawStage();
          });
          canvas.addEventListener('mousemove', function(ev) {
            if (!state.drawing || !state.current) return;
            var pt = getCoords(ev);
            if (state.current.tool === 'pen') state.current.points.push(pt);
            else state.current.points = [state.current.points[0], pt];
            drawStage();
          });
          window.addEventListener('mouseup', function() {
            if (!state.drawing || !state.current) return;
            state.drawing = false;
            state.shapes.push(state.current);
            state.current = null;
            drawStage();
          });

          function render() {
            var m = sampleMatches[state.matchIdx];
            var r = m.rounds[state.roundIdx];

            document.getElementById('stageTitle').textContent = m.map + ' (' + m.result + ' ' + m.score.split(' - ')[0] + ')';
            document.getElementById('stageSubtitle').textContent = 'Round ' + String(r.num).padStart(2, '0') + ' - ' + r.weapon + ' - Post-Match Replay Canvas (Drag to draw)';
            document.getElementById('timelineMarkerInfo').textContent = 'Timeline Marker: ' + r.time + ' - Round ' + String(r.num).padStart(2, '0') + ' (' + r.eco + ')';

            var matchHtml = '';
            sampleMatches.forEach(function(item, idx) {
              matchHtml += '<button type="button" class="match-btn ' + (idx === state.matchIdx ? 'active' : '') + '" data-match="' + idx + '">' +
                '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">' +
                '<span class="pill ' + (item.result === 'VICTORY' ? 'pill-win' : 'pill-loss') + '">' + item.result + '</span>' +
                '<span class="mono" style="color:#64748B;font-size:10px;">' + item.mode + '</span></div>' +
                '<strong style="display:block;font-size:14px;">' + item.map + '</strong>' +
                '<span class="mono" style="color:#94A3B8;font-size:11px;">' + item.score + '</span></button>';
            });
            document.getElementById('matchList').innerHTML = matchHtml;

            var roundHtml = '';
            m.rounds.forEach(function(rd, idx) {
              roundHtml += '<button type="button" class="round-card ' + (idx === state.roundIdx ? 'active' : '') + '" data-round="' + idx + '">' +
                '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">' +
                '<strong class="mono" style="font-size:12px;">R' + String(rd.num).padStart(2, '0') + '</strong>' +
                '<span class="pill ' + (rd.res === 'WIN' ? 'pill-win' : 'pill-loss') + '">' + rd.res + '</span></div>' +
                '<div class="mono" style="font-size:11px;color:#cbd5e1;">' + rd.kda + ' - ' + rd.dmg + ' DMG</div>' +
                '<div class="mono" style="font-size:10px;color:#64748B;margin-top:4px;">' + rd.eco + '</div></button>';
            });
            document.getElementById('roundGrid').innerHTML = roundHtml;

            var bodyHtml = '';
            if (state.tab === 'round') {
              bodyHtml += '<div style="border-bottom:1px solid #232B3B;padding-bottom:10px;margin-bottom:10px;">' +
                '<div style="display:flex;justify-content:space-between;align-items:center;">' +
                '<strong style="font-size:16px;">Round ' + String(r.num).padStart(2, '0') + '</strong>' +
                '<span class="pill ' + (r.res === 'WIN' ? 'pill-win' : 'pill-loss') + '">' + r.res + '</span></div>' +
                '<div class="mono" style="color:#94A3B8;font-size:11px;margin-top:4px;">K/D/A: ' + r.kda + ' - Damage: ' + r.dmg + '</div></div>' +
                '<div style="display:flex;gap:6px;margin-bottom:12px;">' +
                '<span class="pill pill-eco">Economy: ' + r.eco + '</span>' +
                '<span class="pill" style="background:#171D28;color:#EEF2F6;border:1px solid #334155;">' + r.style + '</span></div>' +
                '<h3 style="font-size:11px;color:#34d399;text-transform:uppercase;margin-bottom:6px;">Strengths</h3>';
              if (r.good.length) r.good.forEach(function(g){ bodyHtml += '<div class="callout-good">' + g + '</div>'; });
              else bodyHtml += '<p style="font-size:12px;color:#64748B;">No notable tactical spikes in this round.</p>';

              bodyHtml += '<h3 style="font-size:11px;color:#E59A23;text-transform:uppercase;margin:12px 0 6px;">Tactical Mistakes</h3>';
              if (r.bad.length) r.bad.forEach(function(b){ bodyHtml += '<div class="callout-warn">' + b + '</div>'; });
              else bodyHtml += '<p style="font-size:12px;color:#64748B;">Clean round positioning, zero untraded errors.</p>';
            } else if (state.tab === 'match') {
              bodyHtml += '<div style="padding:10px;background:#0A0D12;border:1px solid #232B3B;border-radius:2px;margin-bottom:12px;">' +
                '<div class="mono" style="color:#E59A23;font-size:12px;font-weight:700;">POST-MATCH SCORE: ' + m.overallScore + ' / 10</div>' +
                '<p style="font-size:12px;margin:6px 0 0;">' + m.commentary + '</p></div>' +
                '<h3 style="font-size:11px;color:#38bdf8;text-transform:uppercase;">Recommended Drills</h3>' +
                '<div class="callout-good">10 min Deathmatch focusing on A-Main headshot crosshair height before queuing.</div>' +
                '<div class="callout-warn">Pair up within 1.5s of entry duelist on Force Buy rounds to ensure trade kills.</div>';
            } else {
              bodyHtml += '<div style="padding:10px;background:#0A0D12;border:1px solid #232B3B;border-radius:2px;margin-bottom:10px;font-size:12px;">' +
                state.coachReply + '</div>' +
                '<button type="button" class="match-btn" data-prompt="eco">Ask: Why did we lose Force Buy rounds?</button>' +
                '<button type="button" class="match-btn" data-prompt="pos">Ask: Analyze my positioning in Round ' + String(r.num).padStart(2, '0') + '</button>';
            }
            document.getElementById('inspectorBody').innerHTML = bodyHtml;

            document.querySelectorAll('[data-match]').forEach(function(btn) {
              btn.addEventListener('click', function() {
                state.matchIdx = Number(btn.getAttribute('data-match'));
                state.roundIdx = 0;
                state.shapes = [];
                render();
              });
            });
            document.querySelectorAll('[data-round]').forEach(function(btn) {
              btn.addEventListener('click', function() {
                state.roundIdx = Number(btn.getAttribute('data-round'));
                render();
              });
            });
            document.querySelectorAll('[data-prompt]').forEach(function(btn) {
              btn.addEventListener('click', function() {
                var p = btn.getAttribute('data-prompt');
                if (p === 'eco') {
                  state.coachReply = '<strong>AI Coach:</strong> In Round 03 (Force Buy), your team averaged 2,400 credits against rifles. Dry-peeking Mid Catwalk resulted in an untraded death before utility landed.';
                } else {
                  state.coachReply = '<strong>AI Coach (R' + String(r.num).padStart(2, '0') + '):</strong> Using ' + r.weapon + ' (' + r.dmg + ' DMG), prioritize holding crossfire angles with teammates so every early duel is tradable within 3 seconds.';
                }
                render();
              });
            });
            drawStage();
          }

          document.querySelectorAll('[data-tool]').forEach(function(btn) {
            btn.addEventListener('click', function() {
              state.tool = btn.getAttribute('data-tool');
              document.querySelectorAll('[data-tool]').forEach(function(b) { b.classList.remove('active'); });
              btn.classList.add('active');
            });
          });

          document.getElementById('clearDrawBtn').addEventListener('click', function() {
            state.shapes = [];
            drawStage();
          });

          document.querySelectorAll('[data-tab]').forEach(function(btn) {
            btn.addEventListener('click', function() {
              state.tab = btn.getAttribute('data-tab');
              document.querySelectorAll('[data-tab]').forEach(function(b) { b.classList.remove('active'); });
              btn.classList.add('active');
              render();
            });
          });

          document.getElementById('rsoSimBtn').addEventListener('click', function() {
            var box = document.getElementById('rsoFlowLog');
            box.style.display = 'block';
            box.innerHTML = '<strong style="color:#34d399;">Simulated RSO OAuth2 Handshake:</strong> ' +
              '1) Desktop opens <span class="mono">https://auth.riotgames.com/authorize?scope=openid+offline_access</span> &rarr; ' +
              '2) Callback exchanges code at <span class="mono">/api/auth/riot/callback</span> &rarr; ' +
              '3) Server calls <span class="mono">/riot/account/v1/accounts/me</span> &rarr; ' +
              '4) Signed-in session unlocks personal <span class="mono">val-match-v1</span> post-match history below.';
          });

          render();
        })();
      </script>
      `,
      demoStyles
    )
  );
});

// 3. GET /privacy — Privacy Policy
router.get('/privacy', (_req: Request, res: Response) => {
  res.send(
    layout(
      'Privacy Policy',
      `
      <div class="card">
        <h1>Privacy Policy</h1>
        <p><strong>Effective Date:</strong> November 21, 2026</p>
        <p>TacticalReplayAI ("we", "our", or "the Application") is a public post-match coaching service for VALORANT players. We respect your privacy and protect the account data of players who sign in voluntarily using Riot Sign On (RSO).</p>

        <h2>1. Information We Collect</h2>
        <ul>
          <li><strong>Riot Account Identifiers (via RSO):</strong> Your Riot PUUID, Game Name, and Tag Line retrieved strictly after your explicit OAuth2 consent via Riot Sign On (<span class="mono">/riot/account/v1/accounts/me</span>).</li>
          <li><strong>Post-Match Statistics:</strong> Completed match history, round outcomes, weapon usage, and economy summaries retrieved from official Riot Games APIs (<span class="mono">VAL-MATCH-V1</span>) solely for the signed-in account.</li>
          <li><strong>User-Uploaded Highlights:</strong> Replay clips voluntarily recorded locally via Overwolf or uploaded by you for personal post-match review.</li>
        </ul>

        <h2>2. How We Use Your Information</h2>
        <p>Collected data is used exclusively to authenticate your session, display up to your 20 most recent completed matches, and generate post-match tactical coaching insights. We never display unauthenticated VALORANT player match histories, never calculate hidden MMR, and never sell or share your account data with third-party advertisers.</p>

        <h2>3. Data Retention &amp; Deletion</h2>
        <p>We store only a rolling window of your 20 most recent matches; older match records and associated highlight files are automatically purged. You may disconnect your Riot account or request complete deletion of your stored profile and match records at any time by contacting <strong>kietthanh080@gmail.com</strong>.</p>
      </div>
      `
    )
  );
});

// 4. GET /terms — Terms of Service
router.get('/terms', (_req: Request, res: Response) => {
  res.send(
    layout(
      'Terms of Service',
      `
      <div class="card">
        <h1>Terms of Service</h1>
        <p><strong>Effective Date:</strong> November 21, 2026</p>
        <p>By accessing or using TacticalReplayAI, you agree to these Terms of Service and all applicable Riot Games developer and player policies.</p>

        <h2>1. Permitted Use</h2>
        <p>TacticalReplayAI is a free, public, non-commercial post-match coaching and gameplay review service for the VALORANT community. You agree not to misuse the service, scrape API endpoints, or attempt to access other players' private data without RSO authorization.</p>

        <h2>2. Fair Play &amp; Anti-Cheat Compliance</h2>
        <p>The Application operates strictly outside active competitive gameplay (Post-Match Only) and provides no real-time overlays, pre-game scouting, item store checking, enemy tracking, or automated inputs. Users must comply with the Riot Games Terms of Service and Vanguard anti-cheat rules at all times.</p>

        <h2>3. Disclaimer &amp; Limitation of Liability</h2>
        <p>The service is provided "as is" without warranties of any kind. TacticalReplayAI is an independent community project and is not affiliated with, sponsored, or endorsed by Riot Games, Inc.</p>
      </div>
      `
    )
  );
});

export default router;

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
    font-family: "Be Vietnam Pro", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: var(--bg-obsidian);
    color: var(--text-primary);
    line-height: 1.65;
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
    gap: 16px;
  }
  nav a {
    color: var(--text-secondary);
    text-decoration: none;
    font-size: 13px;
    font-weight: 600;
    transition: color 0.15s ease;
  }
  nav a:hover { color: #ffffff; }
  nav a.nav-active { color: #ffffff; border-bottom: 2px solid var(--accent-crimson); padding-bottom: 2px; }
  nav a.nav-cta {
    padding: 7px 14px;
    border-radius: 2px;
    background: var(--accent-crimson);
    color: #ffffff;
    font-weight: 700;
  }
  nav a.nav-cta:hover { background: #f43f5e; }
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

function isEnglishMode(req: Request): boolean {
  return String(req.query.lang || '').toLowerCase() === 'en';
}

const layout = (
  currentPath: '/' | '/demo' | '/privacy' | '/terms',
  title: string,
  bodyHtml: string,
  isEn: boolean,
  extraHead = ''
) => {
  const qs = isEn ? '?lang=en' : '';
  return `<!DOCTYPE html>
<html lang="${isEn ? 'en' : 'vi'}">
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
      <a class="brand" href="/${qs}">
        <span class="brand-mark">TR</span>
        <span>TacticalReplay<span class="accent">AI</span></span>
      </a>
      <nav aria-label="${isEn ? 'Primary navigation' : 'Điều hướng chính'}">
        <a href="/${qs}" class="${currentPath === '/' ? 'nav-active' : ''}">${isEn ? 'Overview &amp; UX Flow' : 'Tổng quan &amp; Luồng UX'}</a>
        <a href="/demo${qs}" class="nav-cta">${isEn ? 'Interactive Web Prototype' : 'Bản thử nghiệm Web'}</a>
        <a href="/privacy${qs}" class="${currentPath === '/privacy' ? 'nav-active' : ''}">${isEn ? 'Privacy Policy' : 'Chính sách bảo mật'}</a>
        <a href="/terms${qs}" class="${currentPath === '/terms' ? 'nav-active' : ''}">${isEn ? 'Terms of Service' : 'Điều khoản dịch vụ'}</a>
        <span class="lang-switch" aria-label="${isEn ? 'Language switcher' : 'Chuyển ngôn ngữ'}">
          <a href="${currentPath}" class="${!isEn ? 'active' : ''}">VI</a>
          <a href="${currentPath}?lang=en" class="${isEn ? 'active' : ''}">EN</a>
        </span>
      </nav>
    </header>
    ${bodyHtml}
    <footer>
      <p style="margin-bottom:6px;">
        ${
          isEn
            ? 'TacticalReplayAI v1.6.1 - Free community post-match coaching & replay review.'
            : 'TacticalReplayAI v1.6.1 - Nền tảng xem lại video và phân tích chiến thuật sau trận đấu dành cho cộng đồng VALORANT &amp; PUBG.'
        }
      </p>
      <p>TacticalReplayAI isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, VALORANT, and all associated properties are trademarks or registered trademarks of Riot Games, Inc.</p>
    </footer>
  </div>
</body>
</html>`;
};

// 0. GET /riot.txt - Riot Developer Portal domain ownership verification
router.get('/riot.txt', (_req: Request, res: Response) => {
  const verificationToken = (
    process.env.RIOT_VERIFY_TOKEN || '4250f227-8b94-405d-99ba-8546497b81d1'
  ).trim();
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.send(verificationToken);
});

// 1. GET / - Tong quan cong khai, luong UX va tuân thủ Riot Policy
router.get('/', (req: Request, res: Response) => {
  const isEn = isEnglishMode(req);
  const qs = isEn ? '?lang=en' : '';

  if (isEn) {
    res.send(
      layout(
        '/',
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
            <a class="btn-primary" href="/demo${qs}">Launch Interactive Web Prototype (/demo)</a>
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
      `,
        true
      )
    );
    return;
  }

  res.send(
    layout(
      '/',
      'Xem lại Replay & Phân tích chiến thuật sau trận',
      `
      <div class="hero-split">
        <div>
          <span class="badge">TUÂN THỦ VANGUARD - CHỈ PHÂN TÍCH SAU TRẬN - BẢO VỆ BỞI RSO</span>
          <h1>Xem lại Video Replay &amp; Phân tích chiến thuật sau trận cho VALORANT</h1>
          <p style="max-width:60ch;">
            TacticalReplayAI là nền tảng huấn luyện cộng đồng miễn phí giúp người chơi VALORANT tự động xem lại các trận đấu đã kết thúc bằng cách ghép clip quay qua Overwolf với thống kê kinh tế từng round, bảng vẽ Telestrator và trợ lý AI Coach.
          </p>
          <div class="cta-row">
            <a class="btn-primary" href="/demo">Mở bản thử nghiệm Web tương tác (/demo)</a>
            <a class="btn-secondary" href="https://github.com/kietthanh080-lab/fps-tactical-coach" target="_blank" rel="noreferrer">Xem mã nguồn GitHub</a>
          </div>
        </div>

        <div class="card">
          <h3>Cam kết Fair Play &amp; Chính sách Riot Games</h3>
          <ul style="padding-left:18px;margin:10px 0 0;">
            <li><strong>Chỉ hoạt động sau trận (Post-Match Only):</strong> Không hiển thị overlay khi đang bắn, không soi rank hay tướng đối thủ trước trận, không theo dõi kinh tế địch theo thời gian thực.</li>
            <li><strong>Bảo mật qua Riot Sign On (RSO):</strong> Người chơi tự nguyện đăng nhập bằng RSO mới xem được lịch sử 20 trận gần nhất và báo cáo cá nhân.</li>
            <li><strong>Không Store Checker / Không MMR ẩn:</strong> Tuyệt đối không kiểm tra shop vật phẩm, không tính điểm MMR ẩn và không công khai bảng xếp hạng người lạ.</li>
            <li><strong>Không đọc bộ nhớ game:</strong> Chỉ dùng API chính thức của Riot Games và API ghi hình hợp lệ của Overwolf.</li>
          </ul>
        </div>
      </div>

      <h2>Trải nghiệm người dùng &amp; Luồng dữ liệu API</h2>
      <p>Kiến trúc tổng thể minh họa cách người chơi xác thực RSO và tự xem lại các trận đã kết thúc mà không cần cài thêm phần mềm bên thứ ba để xem bản demo.</p>

      <div class="flow-grid">
        <div class="flow-step">
          <span class="step-tag">BƯỚC 01 - XÁC THỰC</span>
          <h3>Riot Sign On (RSO)</h3>
          <p>Người chơi bấm đăng nhập OAuth2 trên trình duyệt (<span class="mono">auth.riotgames.com</span>, scope: <span class="mono">openid offline_access</span>). Máy chủ xác nhận state và lấy PUUID qua <span class="mono">ACCOUNT-V1</span>.</p>
        </div>
        <div class="flow-step">
          <span class="step-tag">BƯỚC 02 - GHI HÌNH</span>
          <h3>Clip Replay nội bộ</h3>
          <p>Trong trận đấu, Overwolf chỉ ghi video cục bộ (hoặc Highlight ~23s quanh mỗi mạng hạ gục) và lưu mốc thời gian round để tua nhanh sau khi hết trận.</p>
        </div>
        <div class="flow-step">
          <span class="step-tag">BƯỚC 03 - API SAU TRẬN</span>
          <h3>Phân tích VAL-MATCH-V1</h3>
          <p>Sau khi trận kết thúc, hệ thống đọc dữ liệu trận đã xong qua <span class="mono">val-match-v1</span> để phân loại kinh tế (Eco, Force, Bonus, Full Buy) và phát hiện lỗi chết lẻ.</p>
        </div>
        <div class="flow-step">
          <span class="step-tag">BƯỚC 04 - COACHING UI</span>
          <h3>Telestrator &amp; AI Debrief</h3>
          <p>Trong ứng dụng Cockpit, người chơi bấm mốc từng round, vẽ mũi tên chiến thuật ngay trên video, đồng bộ Kho Sens &amp; Tâm và hỏi đáp với AI Coach.</p>
        </div>
      </div>

      <div class="card" style="margin-top:26px;">
        <h3>Phạm vi Endpoint Riot API sử dụng</h3>
        <table class="api-table">
          <thead>
            <tr>
              <th>Sản phẩm API</th>
              <th>Endpoint sử dụng</th>
              <th>Mục đích &amp; Thời điểm gọi</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Riot Sign On (RSO)</strong></td>
              <td class="mono">/authorize, /token</td>
              <td>Xác minh chính chủ tài khoản Riot trước khi mở khóa lịch sử trận đấu và replay cá nhân.</td>
            </tr>
            <tr>
              <td><strong>ACCOUNT-V1</strong></td>
              <td class="mono">/riot/account/v1/accounts/me<br/>/riot/account/v1/active-shards/by-game/val/by-puuid/{puuid}</td>
              <td>Lấy PUUID, Game Name, Tag Line và khu vực (shard) của tài khoản vừa đăng nhập.</td>
            </tr>
            <tr>
              <td><strong>VAL-MATCH-V1</strong></td>
              <td class="mono">/val/match/v1/matchlists/by-puuid/{puuid}<br/>/val/match/v1/matches/{matchId}</td>
              <td>Đồng bộ tối đa 20 trận đã hoàn thành gần nhất của chính tài khoản đó để tổng hợp kinh tế round và hiệu suất vũ khí.</td>
            </tr>
          </tbody>
        </table>
      </div>
      `,
      false
    )
  );
});

// 2. GET /demo - Ban thu nghiem Web tuong tac (khong can dang nhap / tai app)
router.get('/demo', (req: Request, res: Response) => {
  const isEn = isEnglishMode(req);

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
      '/demo',
      isEn ? 'Interactive Web Prototype' : 'Bản thử nghiệm Web tương tác',
      `
      <div class="demo-banner">
        <div>
          <strong style="color:#E59A23;">${
            isEn
              ? 'PUBLIC REVIEW PROTOTYPE (SAMPLE DATA)'
              : 'BẢN THỬ NGHIỆM CÔNG KHAI (DỮ LIỆU MẪU)'
          }</strong>
          <span style="color:#cbd5e1;"> - ${
            isEn
              ? 'Interactive web walkthrough for Riot API reviewers. No login or external download required; production match access is strictly gated behind Riot Sign On (RSO).'
              : 'Môi trường dùng thử trực tiếp giao diện Cockpit trên web, không cần đăng nhập hay tải app. Trên bản thật, lịch sử trận đấu được khóa bảo vệ bằng Riot Sign On (RSO).'
          }</span>
        </div>
        <button id="rsoSimBtn" type="button" class="btn-primary" style="padding:8px 14px;font-size:12px;">
          ${isEn ? 'Simulate RSO Login Flow' : 'Mô phỏng luồng đăng nhập RSO'}
        </button>
      </div>

      <div id="rsoFlowLog" class="rso-sim-box" style="display:none;"></div>

      <div class="cockpit">
        <aside class="panel">
          <div class="panel-title">
            <span>${isEn ? '20-Match History (Demo)' : 'Lịch sử 20 trận (Mẫu)'}</span>
            <span class="mono">RSO SYNC</span>
          </div>
          <div id="matchList"></div>
          <p style="font-size:11px;color:#64748B;margin:10px 0 0;">
            ${
              isEn
                ? 'In production, matches are fetched strictly post-match using the signed-in user\'s RSO PUUID via <span class="mono">val-match-v1</span>.'
                : 'Ở chế độ thực tế, danh sách trận chỉ được tải sau khi kết thúc trận đấu bằng PUUID đã xác thực RSO qua <span class="mono">val-match-v1</span>.'
            }
          </p>
        </aside>

        <section class="panel">
          <div class="toolbar">
            <div>
              <strong id="stageTitle" style="font-size:15px;">Ascent (13-9)</strong>
              <div id="stageSubtitle" class="mono" style="color:#94A3B8;font-size:11px;">
                ${isEn ? 'Round 01 - Post-Match Replay Canvas (Drag to draw)' : 'Round 01 - Bảng vẽ Replay sau trận (Kéo chuột để vẽ)'}
              </div>
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;">
              <button type="button" class="tool-btn active" data-tool="arrow">${isEn ? 'Arrow' : 'Mũi tên'}</button>
              <button type="button" class="tool-btn" data-tool="circle">${isEn ? 'Circle' : 'Khoanh vùng'}</button>
              <button type="button" class="tool-btn" data-tool="pen">${isEn ? 'Pen' : 'Bút vẽ'}</button>
              <button type="button" class="tool-btn" id="clearDrawBtn">${isEn ? 'Clear Drawings' : 'Xóa nét vẽ'}</button>
            </div>
          </div>

          <div class="stage-wrap">
            <canvas id="replayCanvas" width="800" height="450"></canvas>
          </div>

          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;font-size:12px;color:#94A3B8;">
            <span class="mono" id="timelineMarkerInfo">Timeline Marker: 00:42 - Round 01</span>
            <span class="mono">${isEn ? 'Telestrator Active' : 'Telestrator sẵn sàng'}</span>
          </div>

          <div class="panel-title" style="margin-top:16px;">
            <span>${isEn ? 'Round-by-Round Breakdown' : 'Diễn biến từng Round'}</span>
            <span class="mono">${isEn ? 'SELECT ROUND' : 'CHỌN ROUND'}</span>
          </div>
          <div id="roundGrid" class="round-grid"></div>
        </section>

        <aside class="panel">
          <div class="tab-row">
            <button type="button" class="tab-btn active" data-tab="round">${isEn ? 'Round Detail' : 'Chi tiết Round'}</button>
            <button type="button" class="tab-btn" data-tab="match">${isEn ? 'Match Summary' : 'Tổng kết trận'}</button>
            <button type="button" class="tab-btn" data-tab="coach">AI Coach</button>
          </div>
          <div id="inspectorBody"></div>
        </aside>
      </div>

      <script>
        (function() {
          var isEn = ${isEn ? 'true' : 'false'};
          var sampleMatches = isEn ? [
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
          ] : [
            {
              id: 'sample-ascent-01',
              map: 'Ascent',
              mode: 'ĐẤU HẠNG',
              result: 'CHIẾN THẮNG',
              score: '13-9 - 21/14/6 KDA',
              overallScore: 8.4,
              commentary: 'Kiểm soát A-Main tốt (420 sát thương ở Round 05) và tận dụng tốt round Eco. Cần cải thiện phối hợp trade kill khi thủ B-Lane.',
              rounds: [
                { num: 1, res: 'THẮNG', kda: '2/0/1', dmg: 265, eco: 'ECO', style: 'ĐẨY NHANH', weapon: 'Classic / Ghost', time: '00:42', good: ['Mạng mở giao tranh: Thắng tay đôi đầu ở A-Main tạo lợi thế 5v4.','Thắng round lục nhờ phối hợp utility vào A-Site.'], bad: [] },
                { num: 3, res: 'THUA', kda: '0/1/0', dmg: 40, eco: 'FORCE_BUY', style: 'KIỂM SOÁT CHẬM', weapon: 'Spectre', time: '04:15', good: [], bad: ['Chết lẻ không có người đổi mạng: Peek Mid Catwalk một mình khi chưa có flash hỗ trợ.'] },
                { num: 5, res: 'THẮNG', kda: '3/0/0', dmg: 420, eco: 'FULL_BUY', style: 'ĐẨY NHANH', weapon: 'Vandal', time: '08:10', good: ['Multi-Kill (3K): Giữ góc kê A-Heaven cực chắc sau khi đặt Spike.'], bad: [] },
                { num: 12, res: 'THUA', kda: '1/1/1', dmg: 145, eco: 'BONUS', style: 'ĐẢO CÁNH', weapon: 'Sheriff', time: '19:30', good: ['Gây lượng sát thương tốt trong round Bonus.'], bad: ['Dư kỹ năng: Bị hạ gục khi vẫn còn 2 chiêu chưa dùng lúc retake.'] }
              ]
            },
            {
              id: 'sample-haven-02',
              map: 'Haven',
              mode: 'ĐẤU HẠNG',
              result: 'THẤT BẠI',
              score: '11-13 - 18/17/5 KDA',
              overallScore: 6.8,
              commentary: 'Mở góc bắn tỉa C-Long khá tốt đầu trận, nhưng ép mua Force Buy liên tiếp cuối trận khiến hụt tiền ở Round 22.',
              rounds: [
                { num: 2, res: 'THẮNG', kda: '2/1/0', dmg: 290, eco: 'FULL_BUY', style: 'KIỂM SOÁT CHẬM', weapon: 'Bulldog', time: '02:20', good: ['Multi-Kill (2K): Đẩy lùi pha ép Garage gọn gàng.'], bad: [] },
                { num: 8, res: 'THUA', kda: '0/1/0', dmg: 0, eco: 'FORCE_BUY', style: 'KIỂM SOÁT CHẬM', weapon: 'Sheriff', time: '12:55', good: [], bad: ['Chết lẻ không trade: Dry-peek ra C-Long đối đầu thẳng Operator của địch.'] },
                { num: 15, res: 'THẮNG', kda: '2/0/1', dmg: 310, eco: 'FULL_BUY', style: 'ĐẨY NHANH', weapon: 'Phantom', time: '24:40', good: ['Mạng mở tỷ số: Chiếm A-Short và đặt Spike sớm.'], bad: [] },
                { num: 22, res: 'THUA', kda: '1/1/0', dmg: 135, eco: 'ECO', style: 'KIỂM SOÁT CHẬM', weapon: 'Ghost', time: '36:12', good: [], bad: ['Mất lợi thế kê chéo hậu Spike do tự mở rộng góc khi chỉ còn 10 giây.'] }
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
            coachReply: isEn
              ? 'Select a sample prompt below to preview how AI Coach explains mistakes from completed match telemetry.'
              : 'Chọn một câu hỏi mẫu bên dưới để xem AI Coach phân tích sai sót từ dữ liệu sau trận.'
          };

          var canvas = document.getElementById('replayCanvas');
          var ctx = canvas.getContext('2d');

          function drawStage() {
            var m = sampleMatches[state.matchIdx];
            var r = m.rounds[state.roundIdx];
            ctx.fillStyle = '#0A0D12';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            ctx.strokeStyle = 'rgba(35, 43, 59, 0.7)';
            ctx.lineWidth = 1;
            for (var x = 0; x <= canvas.width; x += 40) {
              ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
            }
            for (var y = 0; y <= canvas.height; y += 40) {
              ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
            }

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
            ctx.fillText(isEn ? 'A SITE - POST-MATCH REPLAY FRAME' : 'A SITE - KHUNG HÌNH REPLAY SAU TRẬN', 96, 102);
            ctx.fillText(isEn ? 'B SITE - LANE CONTROL' : 'B SITE - KIỂM SOÁT LANE', 518, 102);
            ctx.fillText(isEn ? 'MID COURTYARD' : 'KHU VỰC MID', 345, 258);

            ctx.fillStyle = 'rgba(16, 20, 28, 0.9)';
            ctx.fillRect(16, 16, 370, 44);
            ctx.strokeStyle = '#FF4655';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(16, 16, 370, 44);
            ctx.fillStyle = '#EEF2F6';
            ctx.font = 'bold 13px monospace';
            ctx.fillText(m.map.toUpperCase() + ' // ROUND ' + String(r.num).padStart(2, '0') + ' // ' + r.eco, 28, 43);

            ctx.fillStyle = '#10B981';
            ctx.beginPath(); ctx.arc(190, 155, 9, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#EEF2F6';
            ctx.font = '11px monospace';
            ctx.fillText((isEn ? 'PLAYER (' : 'NGƯỜI CHƠI (') + r.weapon + ')', 206, 159);

            ctx.fillStyle = '#FF4655';
            ctx.beginPath(); ctx.arc(580, 150, 9, 0, Math.PI * 2); ctx.fill();
            ctx.fillText(isEn ? 'ENGAGEMENT ZONE' : 'ĐIỂM GIAO TRANH', 596, 154);

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
            var isWinMatch = m.result === 'VICTORY' || m.result === 'CHIẾN THẮNG';

            document.getElementById('stageTitle').textContent = m.map + ' (' + m.result + ' ' + m.score.split(' - ')[0] + ')';
            document.getElementById('stageSubtitle').textContent = 'Round ' + String(r.num).padStart(2, '0') + ' - ' + r.weapon + (isEn ? ' - Post-Match Replay Canvas (Drag to draw)' : ' - Bảng vẽ Replay sau trận (Kéo chuột để vẽ)');
            document.getElementById('timelineMarkerInfo').textContent = (isEn ? 'Timeline Marker: ' : 'Mốc thời gian: ') + r.time + ' - Round ' + String(r.num).padStart(2, '0') + ' (' + r.eco + ')';

            var matchHtml = '';
            sampleMatches.forEach(function(item, idx) {
              var winFlag = item.result === 'VICTORY' || item.result === 'CHIẾN THẮNG';
              matchHtml += '<button type="button" class="match-btn ' + (idx === state.matchIdx ? 'active' : '') + '" data-match="' + idx + '">' +
                '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">' +
                '<span class="pill ' + (winFlag ? 'pill-win' : 'pill-loss') + '">' + item.result + '</span>' +
                '<span class="mono" style="color:#64748B;font-size:10px;">' + item.mode + '</span></div>' +
                '<strong style="display:block;font-size:14px;">' + item.map + '</strong>' +
                '<span class="mono" style="color:#94A3B8;font-size:11px;">' + item.score + '</span></button>';
            });
            document.getElementById('matchList').innerHTML = matchHtml;

            var roundHtml = '';
            m.rounds.forEach(function(rd, idx) {
              var rdWin = rd.res === 'WIN' || rd.res === 'THẮNG';
              roundHtml += '<button type="button" class="round-card ' + (idx === state.roundIdx ? 'active' : '') + '" data-round="' + idx + '">' +
                '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">' +
                '<strong class="mono" style="font-size:12px;">R' + String(rd.num).padStart(2, '0') + '</strong>' +
                '<span class="pill ' + (rdWin ? 'pill-win' : 'pill-loss') + '">' + rd.res + '</span></div>' +
                '<div class="mono" style="font-size:11px;color:#cbd5e1;">' + rd.kda + ' - ' + rd.dmg + ' DMG</div>' +
                '<div class="mono" style="font-size:10px;color:#64748B;margin-top:4px;">' + rd.eco + '</div></button>';
            });
            document.getElementById('roundGrid').innerHTML = roundHtml;

            var bodyHtml = '';
            if (state.tab === 'round') {
              var curWin = r.res === 'WIN' || r.res === 'THẮNG';
              bodyHtml += '<div style="border-bottom:1px solid #232B3B;padding-bottom:10px;margin-bottom:10px;">' +
                '<div style="display:flex;justify-content:space-between;align-items:center;">' +
                '<strong style="font-size:16px;">Round ' + String(r.num).padStart(2, '0') + '</strong>' +
                '<span class="pill ' + (curWin ? 'pill-win' : 'pill-loss') + '">' + r.res + '</span></div>' +
                '<div class="mono" style="color:#94A3B8;font-size:11px;margin-top:4px;">K/D/A: ' + r.kda + ' - ' + (isEn ? 'Damage: ' : 'Sát thương: ') + r.dmg + '</div></div>' +
                '<div style="display:flex;gap:6px;margin-bottom:12px;">' +
                '<span class="pill pill-eco">' + (isEn ? 'Economy: ' : 'Kinh tế: ') + r.eco + '</span>' +
                '<span class="pill" style="background:#171D28;color:#EEF2F6;border:1px solid #334155;">' + r.style + '</span></div>' +
                '<h3 style="font-size:11px;color:#34d399;text-transform:uppercase;margin-bottom:6px;">' + (isEn ? 'Strengths' : 'Điểm làm tốt') + '</h3>';
              if (r.good.length) r.good.forEach(function(g){ bodyHtml += '<div class="callout-good">' + g + '</div>'; });
              else bodyHtml += '<p style="font-size:12px;color:#64748B;">' + (isEn ? 'No notable tactical spikes in this round.' : 'Chưa ghi nhận điểm nhấn nổi bật ở round này.') + '</p>';

              bodyHtml += '<h3 style="font-size:11px;color:#E59A23;text-transform:uppercase;margin:12px 0 6px;">' + (isEn ? 'Tactical Mistakes' : 'Lỗi chiến thuật cần sửa') + '</h3>';
              if (r.bad.length) r.bad.forEach(function(b){ bodyHtml += '<div class="callout-warn">' + b + '</div>'; });
              else bodyHtml += '<p style="font-size:12px;color:#64748B;">' + (isEn ? 'Clean round positioning, zero untraded errors.' : 'Giữ vị trí gọn gàng, không mắc lỗi chết lẻ.') + '</p>';
            } else if (state.tab === 'match') {
              bodyHtml += '<div style="padding:10px;background:#0A0D12;border:1px solid #232B3B;border-radius:2px;margin-bottom:12px;">' +
                '<div class="mono" style="color:#E59A23;font-size:12px;font-weight:700;">' + (isEn ? 'POST-MATCH SCORE: ' : 'ĐIỂM ĐÁNH GIÁ SAU TRẬN: ') + m.overallScore + ' / 10</div>' +
                '<p style="font-size:12px;margin:6px 0 0;">' + m.commentary + '</p></div>' +
                '<h3 style="font-size:11px;color:#38bdf8;text-transform:uppercase;">' + (isEn ? 'Recommended Drills' : 'Bài tập đề xuất') + '</h3>' +
                '<div class="callout-good">' + (isEn ? '10 min Deathmatch focusing on A-Main headshot crosshair height before queuing.' : '10 phút Deathmatch giữ tâm ngang đầu khu vực A-Main trước khi vào đấu hạng.') + '</div>' +
                '<div class="callout-warn">' + (isEn ? 'Pair up within 1.5s of entry duelist on Force Buy rounds to ensure trade kills.' : 'Đi cặp cách đồng đội 1.5s ở các round Force Buy để đảm bảo đổi mạng.') + '</div>';
            } else {
              bodyHtml += '<div style="padding:10px;background:#0A0D12;border:1px solid #232B3B;border-radius:2px;margin-bottom:10px;font-size:12px;">' +
                state.coachReply + '</div>' +
                '<button type="button" class="match-btn" data-prompt="eco">' + (isEn ? 'Ask: Why did we lose Force Buy rounds?' : 'Hỏi: Vì sao đội hay thua ở các round Force Buy?') + '</button>' +
                '<button type="button" class="match-btn" data-prompt="pos">' + (isEn ? 'Ask: Analyze my positioning in Round ' : 'Hỏi: Phân tích vị trí đứng của tôi ở Round ') + String(r.num).padStart(2, '0') + '</button>';
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
                  state.coachReply = isEn
                    ? '<strong>AI Coach:</strong> In Round 03 (Force Buy), your team averaged 2,400 credits against rifles. Dry-peeking Mid Catwalk resulted in an untraded death before utility landed.'
                    : '<strong>AI Coach:</strong> Ở Round 03 (Force Buy), lượng tiền trung bình chỉ khoảng 2.400 credits khi địch đã có súng dài. Pha tự mở góc ở Mid Catwalk khiến bạn chết lẻ trước khi có smoke hoặc flash che.';
                } else {
                  state.coachReply = isEn
                    ? '<strong>AI Coach (R' + String(r.num).padStart(2, '0') + '):</strong> Using ' + r.weapon + ' (' + r.dmg + ' DMG), prioritize holding crossfire angles with teammates so every early duel is tradable within 3 seconds.'
                    : '<strong>AI Coach (R' + String(r.num).padStart(2, '0') + '):</strong> Khi cầm ' + r.weapon + ' (' + r.dmg + ' sát thương), hãy giữ góc kê chéo cùng đồng đội để mọi pha đọ súng đầu round đều có thể trade kill trong vòng 3 giây.';
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
            box.innerHTML = isEn
              ? '<strong style="color:#34d399;">Simulated RSO OAuth2 Handshake:</strong> ' +
                '1) Desktop opens <span class="mono">https://auth.riotgames.com/authorize?scope=openid+offline_access</span> &rarr; ' +
                '2) Callback exchanges code at <span class="mono">/api/auth/riot/callback</span> &rarr; ' +
                '3) Server calls <span class="mono">/riot/account/v1/accounts/me</span> &rarr; ' +
                '4) Signed-in session unlocks personal <span class="mono">val-match-v1</span> post-match history below.'
              : '<strong style="color:#34d399;">Mô phỏng xác thực RSO OAuth2:</strong> ' +
                '1) App mở <span class="mono">https://auth.riotgames.com/authorize?scope=openid+offline_access</span> &rarr; ' +
                '2) Callback đổi mã xác thực tại <span class="mono">/api/auth/riot/callback</span> &rarr; ' +
                '3) Server gọi <span class="mono">/riot/account/v1/accounts/me</span> lấy PUUID chính chủ &rarr; ' +
                '4) Phiên đăng nhập mở khóa 20 trận <span class="mono">val-match-v1</span> cá nhân ở dưới.';
          });

          render();
        })();
      </script>
      `,
      isEn,
      demoStyles
    )
  );
});

// 3. GET /privacy - Chinh sach bao mat
router.get('/privacy', (req: Request, res: Response) => {
  const isEn = isEnglishMode(req);

  if (isEn) {
    res.send(
      layout(
        '/privacy',
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
      `,
        true
      )
    );
    return;
  }

  res.send(
    layout(
      '/privacy',
      'Chính sách bảo mật',
      `
      <div class="card">
        <h1>Chính sách bảo mật</h1>
        <p><strong>Ngày có hiệu lực:</strong> 21/11/2026</p>
        <p>TacticalReplayAI ("chúng tôi" hoặc "Ứng dụng") là dịch vụ hỗ trợ xem lại và phân tích chiến thuật sau trận đấu dành cho cộng đồng người chơi VALORANT &amp; PUBG. Chúng tôi tôn trọng quyền riêng tư và bảo vệ dữ liệu tài khoản của người chơi khi bạn tự nguyện đăng nhập qua Riot Sign On (RSO) hoặc Steam.</p>

        <h2>1. Thông tin chúng tôi thu thập</h2>
        <ul>
          <li><strong>Định danh tài khoản Riot (qua RSO):</strong> Mã PUUID, Riot Game Name và Tag Line của bạn chỉ được lấy sau khi bạn đồng ý cấp quyền OAuth2 qua Riot Sign On (<span class="mono">/riot/account/v1/accounts/me</span>).</li>
          <li><strong>Số liệu trận đấu sau trận:</strong> Lịch sử tối đa 20 trận đã hoàn thành, kết quả từng round, lượng sát thương, vũ khí và mức kinh tế lấy từ API chính thức của Riot Games (<span class="mono">VAL-MATCH-V1</span>) hoặc PUBG Official API dành riêng cho chính tài khoản đã đăng nhập.</li>
          <li><strong>Video Highlight &amp; Cấu hình cá nhân:</strong> Video quay nội bộ bằng Overwolf (hoặc bạn tự tải lên) và cấu hình DPI / Sensitivity / Crosshair mà bạn chủ động lưu trong Kho Sens &amp; Tâm.</li>
        </ul>

        <h2>2. Cách chúng tôi sử dụng dữ liệu</h2>
        <p>Dữ liệu thu thập chỉ dùng để xác thực phiên đăng nhập, hiển thị tối đa 20 trận gần nhất, tạo bảng phân tích chiến thuật sau trận đấu và chia sẻ bảng xếp hạng riêng tư trong Squad do bạn tự mời hoặc tham gia. Chúng tôi tuyệt đối không công khai lịch sử trận VALORANT khi chưa xác thực RSO, không tính điểm MMR ẩn và không bán hay chia sẻ dữ liệu cá nhân cho bên thứ ba.</p>

        <h2>3. Lưu trữ &amp; Xóa dữ liệu</h2>
        <p>Hệ thống chỉ duy trì bộ đệm xoay vòng tối đa 20 trận gần nhất; các trận cũ hơn cùng tệp liên quan sẽ được tự động dọn dẹp. Bạn có thể hủy liên kết tài khoản Riot ngay trong ứng dụng hoặc gửi yêu cầu xóa hoàn toàn hồ sơ và dữ liệu trận đấu bất kỳ lúc nào qua email <strong>kietthanh080@gmail.com</strong>.</p>
      </div>
      `,
      false
    )
  );
});

// 4. GET /terms - Dieu khoan dich vu
router.get('/terms', (req: Request, res: Response) => {
  const isEn = isEnglishMode(req);

  if (isEn) {
    res.send(
      layout(
        '/terms',
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
      `,
        true
      )
    );
    return;
  }

  res.send(
    layout(
      '/terms',
      'Điều khoản dịch vụ',
      `
      <div class="card">
        <h1>Điều khoản dịch vụ</h1>
        <p><strong>Ngày có hiệu lực:</strong> 21/11/2026</p>
        <p>Khi truy cập hoặc sử dụng TacticalReplayAI, bạn đồng ý tuân thủ các Điều khoản dịch vụ này cùng toàn bộ chính sách dành cho nhà phát triển và người chơi của Riot Games &amp; PUBG Corporation.</p>

        <h2>1. Phạm vi sử dụng hợp lệ</h2>
        <p>TacticalReplayAI là dự án cộng đồng phi thương mại, miễn phí, phục vụ xem lại video và phân tích chiến thuật sau trận đấu. Bạn cam kết không lạm dụng hệ thống, không thu thập dữ liệu trái phép (scraping API) và không tìm cách truy cập dữ liệu riêng tư của người chơi khác khi chưa được ủy quyền qua RSO.</p>

        <h2>2. Tuân thủ Fair Play &amp; Anti-Cheat</h2>
        <p>Ứng dụng chỉ hoạt động ngoài trận đấu thực tế (Post-Match Only): không chèn overlay gian lận khi đang đấu, không soi thông tin đối thủ trước khi vào trận, không kiểm tra shop vật phẩm, không đọc bộ nhớ tiến trình game và không can thiệp thao tác chuột/bàn phím. Người dùng phải luôn tuân thủ quy tắc Vanguard và BattlEye.</p>

        <h2>3. Miễn trừ trách nhiệm</h2>
        <p>Dịch vụ được cung cấp theo nguyên trạng ("as is"). TacticalReplayAI là dự án cộng đồng độc lập và không thuộc sở hữu, tài trợ hay chứng thực bởi Riot Games, Inc.</p>
      </div>
      `,
      false
    )
  );
});

export default router;

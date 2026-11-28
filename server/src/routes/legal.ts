import { Router, Request, Response } from 'express';
import { getLatestReleaseInfo, getReleaseHistory } from '../services/githubReleases';
import {
  detectIsEnglish,
  escapeHtml,
  langQueryString,
  renderPortalLayout,
  renderReleaseMarkdownLite,
} from '../web/webTemplates';
import { renderToolsPageBody, toolsPageExtraStyles } from '../web/toolsPage';

const router = Router();

function formatReleaseDate(isoDate: string, isEn: boolean): string {
  if (!isoDate) return '';
  const dt = new Date(isoDate);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toLocaleDateString(isEn ? 'en-US' : 'vi-VN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// 0. GET /riot.txt - Riot Developer Portal domain ownership verification
router.get('/riot.txt', (_req: Request, res: Response) => {
  const verificationToken = (
    process.env.RIOT_VERIFY_TOKEN || '4250f227-8b94-405d-99ba-8546497b81d1'
  ).trim();
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.send(verificationToken);
});

// 1. GET / - Dual-Game Landing Page + Live Windows Download CTA + Riot Policy Compliance
router.get('/', async (req: Request, res: Response) => {
  const isEn = detectIsEnglish(req);
  const qs = langQueryString(isEn);
  const latest = await getLatestReleaseInfo();
  const safeVer = escapeHtml(latest.version);
  const safeSize = escapeHtml(latest.sizeMb);

  const homeExtraHead = `
  <style>
    .hero-meta-row {
      display: flex;
      flex-wrap: wrap;
      gap: 10px 18px;
      margin-top: 14px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 11.5px;
      color: #94A3B8;
    }
    .smartscreen-note {
      margin-top: 14px;
      padding: 10px 12px;
      border-radius: 3px;
      background: rgba(16, 20, 28, 0.85);
      border: 1px solid #232B3B;
      border-left: 3px solid var(--accent-secondary);
      font-size: 12px;
      color: #CBD5E1;
    }
    .theme-preview-list {
      margin: 12px 0 0;
      padding-left: 18px;
    }
    .theme-preview-list li {
      margin-bottom: 7px;
      font-size: 13px;
    }
    .pill-inline {
      display: inline-block;
      padding: 2px 7px;
      border-radius: 2px;
      font-family: ui-monospace, monospace;
      font-size: 10.5px;
      font-weight: 700;
      background: rgba(56, 189, 248, 0.14);
      border: 1px solid rgba(56, 189, 248, 0.35);
      color: #38BDF8;
    }
  </style>`;

  const bodyHtml = isEn
    ? `
      <div class="hero-split">
        <div>
          <div class="game-switch-bar" role="group" aria-label="Switch active game theme">
            <button type="button" id="themeBtnValo" class="game-switch-btn active-valo" data-set-theme="valorant">VALORANT</button>
            <button type="button" id="themeBtnPubg" class="game-switch-btn" data-set-theme="pubg">PUBG: BATTLEGROUNDS</button>
          </div>

          <div>
            <span id="heroBadge" class="badge">VANGUARD COMPLIANT - POST-MATCH ONLY - RSO PROTECTED</span>
          </div>

          <h1 id="heroTitle">Post-Match Video Replay &amp; Tactical Coaching for VALORANT</h1>
          <p id="heroDesc" style="max-width:62ch;margin:0;">
            TacticalReplayAI is a free Windows desktop &amp; Overwolf companion that pairs local post-match highlight clips with round-by-round economy analysis, 5-axis combat radar, telestrator annotations, and AI debriefs.
          </p>

          <div class="cta-row">
            <a class="btn-primary" href="/download">
              Download for Windows (v${safeVer} - ${safeSize})
            </a>
            <a class="btn-secondary" href="/demo${qs}">
              Try Interactive Web Demo (/demo)
            </a>
            <a class="btn-secondary" href="/tools${qs}">
              Sens &amp; Crosshair Tools
            </a>
          </div>

          <div class="hero-meta-row">
            <span>Windows 10 / 11 (64-bit)</span>
            <span>Silent Auto-Updater Built-In</span>
            <a href="/download?page=1${isEn ? '&lang=en' : '&lang=vi'}" style="color:#38BDF8;text-decoration:none;">Install Guide &amp; Release Details</a>
            <a href="https://github.com/kietthanh080-lab/fps-tactical-coach" target="_blank" rel="noreferrer" style="color:#94A3B8;text-decoration:none;">GitHub Source</a>
          </div>

          <div class="smartscreen-note">
            <strong style="color:#EEF2F6;">Windows SmartScreen &amp; Updates:</strong>
            Community builds are unsigned open-source installers. If Windows prompts once, choose <strong>More info &rarr; Run anyway</strong>. Future updates download in the background and install silently on restart.
          </div>
        </div>

        <div class="card" style="display:flex;flex-direction:column;justify-content:space-between;">
          <div>
            <span class="feature-tag" id="sideTag">RIOT POLICY &amp; FAIR PLAY GUARANTEES</span>
            <h3 id="sideTitle">Strict Post-Match Anti-Cheat Compliance</h3>
            <ul id="sideBullets" class="theme-preview-list">
              <li><strong>Post-Match Only:</strong> Zero live overlays, zero agent-select scouting, and zero real-time opponent or economy tracking during active matches.</li>
              <li><strong>RSO-Gated Personal Data:</strong> Players must explicitly authenticate via Riot Sign On (RSO) before accessing their match history or personal coaching reports.</li>
              <li><strong>No Store Checker / No Hidden MMR:</strong> Does not inspect the VALORANT item store, calculate hidden MMR, or expose global ranked leaderboards.</li>
              <li><strong>No Memory Reading:</strong> Relies strictly on official Riot / PUBG APIs and Overwolf's compliant streaming framework.</li>
            </ul>
          </div>
          <div style="margin-top:16px;padding-top:12px;border-top:1px solid #232B3B;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
            <span class="mono" style="color:#10B981;">LATEST BUILD: v${safeVer}</span>
            <a href="/changelog${qs}" style="font-size:12px;color:#38BDF8;text-decoration:none;font-weight:600;">View Full Changelog &rarr;</a>
          </div>
        </div>
      </div>

      <h2>Desktop Cockpit Capabilities (VALORANT &amp; PUBG)</h2>
      <p style="margin-top:0;">Designed for fast post-match review without bloated overlays or manual file sorting.</p>

      <div class="feature-grid">
        <div class="feature-card">
          <span class="feature-tag">01 - AUTO CAPTURE</span>
          <h3>Automatic Highlight Clips</h3>
          <p style="margin:6px 0 0;font-size:13px;">Records clean local clips around kills, clutches, and key moments via Overwolf or hotkey with automatic storage cap management.</p>
        </div>
        <div class="feature-card">
          <span class="feature-tag">02 - PRO REPLAY PLAYER</span>
          <h3>A-B Gunfight Loop &amp; 1x-3x Zoom</h3>
          <p style="margin:6px 0 0;font-size:13px;">Inspect recoil and crosshair placement with A-B loop markers (<code class="inline-code">[</code> / <code class="inline-code">]</code>), frame step (<code class="inline-code">,</code> / <code class="inline-code">.</code>), zoom (<code class="inline-code">Z</code>), and Telestrator arrows.</p>
        </div>
        <div class="feature-card">
          <span class="feature-tag">03 - TELEMETRY ANALYTICS</span>
          <h3>5-Axis Combat Radar &amp; Pro Metrics</h3>
          <p style="margin:6px 0 0;font-size:13px;">Auto-calculates <code class="inline-code">KAST%</code>, <code class="inline-code">ADR</code>, <code class="inline-code">HS%</code>, and <code class="inline-code">Impact</code> rating with 1-click <code class="inline-code">CSV</code> / <code class="inline-code">JSON</code> telemetry export.</p>
        </div>
        <div class="feature-card">
          <span class="feature-tag">04 - BATTLEGROUNDS 2D MAP</span>
          <h3>PUBG Safe-Zone &amp; Rotation Scrubber</h3>
          <p style="margin:6px 0 0;font-size:13px;">Play back your exact match path across safe-zone phases on Erangel, Miramar, Taego, or Vikendi with travel distance (km) and kill markers.</p>
        </div>
        <div class="feature-card">
          <span class="feature-tag">05 - COACHING &amp; NOTES</span>
          <h3>AI Coach, Bookmarks &amp; Match Tags</h3>
          <p style="margin:6px 0 0;font-size:13px;">Ask context-aware post-match questions, save timestamped clip bookmarks, track 5-match form, and share public highlight pages to Discord.</p>
        </div>
        <div class="feature-card">
          <span class="feature-tag">06 - CUSTOMIZATION</span>
          <h3>Unified Settings &amp; Silent Updates</h3>
          <p style="margin:6px 0 0;font-size:13px;">English/Vietnamese UI, customizable hotkeys, Sens &amp; Crosshair Vault backup/restore, and silent background auto-updates with 1-click restart.</p>
        </div>
      </div>

      <h2>Visual User Experience &amp; Official API Flow</h2>
      <p style="margin-top:0;">End-to-end post-match architecture showing how players authenticate safely and review completed matches.</p>

      <div class="flow-grid">
        <div class="flow-step">
          <span class="step-tag">STEP 01 - AUTHENTICATION</span>
          <h3>Riot Sign On (RSO) / Steam</h3>
          <p>VALORANT players authenticate via OAuth2 in their browser (<span class="mono">auth.riotgames.com</span>, scopes: <span class="mono">openid offline_access</span>). PUBG players link their Steam/PUBG profile.</p>
        </div>
        <div class="flow-step">
          <span class="step-tag">STEP 02 - CAPTURE</span>
          <h3>Post-Match Local Clip</h3>
          <p>During gameplay, Overwolf records video locally with zero overlays or live prompts. Round/phase markers are saved solely for post-match scrubbing.</p>
        </div>
        <div class="flow-step">
          <span class="step-tag">STEP 03 - POST-MATCH API</span>
          <h3>VAL-MATCH-V1 &amp; PUBG Telemetry</h3>
          <p>After match completion, the backend pulls official match telemetry to classify VALORANT round economy, PUBG circle rotations, and untraded deaths.</p>
        </div>
        <div class="flow-step">
          <span class="step-tag">STEP 04 - COACHING UI</span>
          <h3>Telestrator, Radar &amp; AI Debrief</h3>
          <p>Review rounds on the timeline, draw tactical arrows, inspect 5-axis combat radar, copy PNG frames to Discord, or publish a shareable match showcase.</p>
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
              <td>Verify player account ownership before loading any personal VALORANT match history or clips.</td>
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

      <script>
        (function() {
          var content = {
            valorant: {
              badge: 'VANGUARD COMPLIANT - POST-MATCH ONLY - RSO PROTECTED',
              title: 'Post-Match Video Replay & Tactical Coaching for VALORANT',
              desc: 'TacticalReplayAI is a free Windows desktop & Overwolf companion that pairs local post-match highlight clips with round-by-round economy analysis, 5-axis combat radar, telestrator annotations, and AI debriefs.',
              sideTag: 'RIOT POLICY & FAIR PLAY GUARANTEES',
              sideTitle: 'Strict Post-Match Anti-Cheat Compliance',
              bullets: [
                '<strong>Post-Match Only:</strong> Zero live overlays, zero agent-select scouting, and zero real-time opponent or economy tracking during active matches.',
                '<strong>RSO-Gated Personal Data:</strong> Players must explicitly authenticate via Riot Sign On (RSO) before accessing their match history or personal coaching reports.',
                '<strong>No Store Checker / No Hidden MMR:</strong> Does not inspect the VALORANT item store, calculate hidden MMR, or expose global ranked leaderboards.',
                '<strong>No Memory Reading:</strong> Relies strictly on official Riot / PUBG APIs and Overwolf\\'s compliant streaming framework.'
              ]
            },
            pubg: {
              badge: 'BATTLEYE SAFE - OFFICIAL PUBG TELEMETRY - OVERWOLF READY',
              title: 'Post-Match 2D Rotation Map & Highlight Recorder for PUBG',
              desc: 'Automatically capture clutch kills and sync official PUBG match telemetry to scrub your 2D safe-zone route, inspect weapon ballistics, view 5-axis combat radar, and review mistakes with AI Coach.',
              sideTag: 'PUBG: BATTLEGROUNDS CAPABILITIES',
              sideTitle: 'Built for Squad & Ranked Circle Reviews',
              bullets: [
                '<strong>Animated 2D Safe-Zone Scrubber:</strong> Replay your movement path across phases on Erangel, Miramar, Taego, Vikendi, Sanhok, and Deston with distance (km).',
                '<strong>Weapon Ballistics & Long-Shot Tracking:</strong> Break down AR/DMR/SR accuracy, headshot rate, throwables used, and longest kill distances.',
                '<strong>Squad Leaderboard & Discord Share:</strong> Upload highlight clips to shareable match cards with embedded video, radar stats, and 2D route summary.',
                '<strong>100% Fair Play Compliant:</strong> Zero live radar, zero memory reading, and strictly post-match telemetry analysis.'
              ]
            }
          };

          function applyTheme(mode) {
            var data = content[mode] || content.valorant;
            document.documentElement.setAttribute('data-theme', mode);
            document.getElementById('heroBadge').textContent = data.badge;
            document.getElementById('heroTitle').textContent = data.title;
            document.getElementById('heroDesc').textContent = data.desc;
            document.getElementById('sideTag').textContent = data.sideTag;
            document.getElementById('sideTitle').textContent = data.sideTitle;
            document.getElementById('sideBullets').innerHTML = data.bullets.map(function(b) { return '<li>' + b + '</li>'; }).join('');
            document.getElementById('themeBtnValo').className = 'game-switch-btn' + (mode === 'valorant' ? ' active-valo' : '');
            document.getElementById('themeBtnPubg').className = 'game-switch-btn' + (mode === 'pubg' ? ' active-pubg' : '');
          }

          document.querySelectorAll('[data-set-theme]').forEach(function(btn) {
            btn.addEventListener('click', function() {
              applyTheme(btn.getAttribute('data-set-theme'));
            });
          });
        })();
      </script>
    `
    : `
      <div class="hero-split">
        <div>
          <div class="game-switch-bar" role="group" aria-label="Chon giao dien game">
            <button type="button" id="themeBtnValo" class="game-switch-btn active-valo" data-set-theme="valorant">VALORANT</button>
            <button type="button" id="themeBtnPubg" class="game-switch-btn" data-set-theme="pubg">PUBG: BATTLEGROUNDS</button>
          </div>

          <div>
            <span id="heroBadge" class="badge">TUÂN THỦ VANGUARD - CHỈ PHÂN TÍCH SAU TRẬN - BẢO VỆ BỞI RSO</span>
          </div>

          <h1 id="heroTitle">Xem lại Video Replay &amp; Phân tích chiến thuật sau trận cho VALORANT</h1>
          <p id="heroDesc" style="max-width:62ch;margin:0;">
            TacticalReplayAI là ứng dụng Windows miễn phí giúp người chơi VALORANT &amp; PUBG tự động lưu clip highlight sau trận, phân tích kinh tế từng round, xem biểu đồ radar 5 trục, vẽ mũi tên Telestrator và hỏi đáp cùng AI Coach.
          </p>

          <div class="cta-row">
            <a class="btn-primary" href="/download">
              Tải về cho Windows (v${safeVer} - ${safeSize})
            </a>
            <a class="btn-secondary" href="/demo${qs}">
              Dùng thử trên Web (/demo)
            </a>
            <a class="btn-secondary" href="/tools${qs}">
              Đổi Sens &amp; Tạo Tâm
            </a>
          </div>

          <div class="hero-meta-row">
            <span>Windows 10 / 11 (64-bit)</span>
            <span>Tự cập nhật ngầm không cần cài lại</span>
            <a href="/download?page=1&lang=vi" style="color:#38BDF8;text-decoration:none;">Hướng dẫn cài &amp; chi tiết bản tải</a>
            <a href="https://github.com/kietthanh080-lab/fps-tactical-coach" target="_blank" rel="noreferrer" style="color:#94A3B8;text-decoration:none;">Mã nguồn GitHub</a>
          </div>

          <div class="smartscreen-note">
            <strong style="color:#EEF2F6;">Lưu ý Windows SmartScreen &amp; Tự động cập nhật:</strong>
            Bộ cài cộng đồng chưa ký chứng chỉ trả phí nên lần đầu mở Windows có thể hiện cảnh báo. Chỉ cần chọn <strong>More info &rarr; Run anyway</strong>. Từ các bản sau app sẽ tự tải ngầm và cập nhật chỉ bằng 1 nút khởi động lại.
          </div>
        </div>

        <div class="card" style="display:flex;flex-direction:column;justify-content:space-between;">
          <div>
            <span class="feature-tag" id="sideTag">CAM KẾT FAIR PLAY &amp; CHÍNH SÁCH RIOT GAMES</span>
            <h3 id="sideTitle">Tuân thủ tuyệt đối nguyên tắc chống gian lận</h3>
            <ul id="sideBullets" class="theme-preview-list">
              <li><strong>Chỉ hoạt động sau trận (Post-Match Only):</strong> Không hiển thị overlay khi đang bắn, không soi rank hay tướng đối thủ trước trận, không theo dõi kinh tế địch theo thời gian thực.</li>
              <li><strong>Bảo mật qua Riot Sign On (RSO):</strong> Người chơi tự nguyện đăng nhập bằng RSO mới xem được lịch sử 20 trận gần nhất và báo cáo cá nhân.</li>
              <li><strong>Không Store Checker / Không MMR ẩn:</strong> Tuyệt đối không kiểm tra shop vật phẩm, không tính điểm MMR ẩn và không công khai bảng xếp hạng người lạ.</li>
              <li><strong>Không đọc bộ nhớ game:</strong> Chỉ dùng API chính thức của Riot Games / PUBG và bộ ghi hình hợp lệ của Overwolf.</li>
            </ul>
          </div>
          <div style="margin-top:16px;padding-top:12px;border-top:1px solid #232B3B;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
            <span class="mono" style="color:#10B981;">BẢN MỚI NHẤT: v${safeVer}</span>
            <a href="/changelog${qs}" style="font-size:12px;color:#38BDF8;text-decoration:none;font-weight:600;">Xem nhật ký cập nhật &rarr;</a>
          </div>
        </div>
      </div>

      <h2>Tính năng nổi bật trên Desktop Cockpit (VALORANT &amp; PUBG)</h2>
      <p style="margin-top:0;">Tối ưu tốc độ xem lại trận đấu sau khi kết thúc, gọn gàng, không làm nặng FPS khi đang thi đấu.</p>

      <div class="feature-grid">
        <div class="feature-card">
          <span class="feature-tag">01 - TỰ ĐỘNG QUAY</span>
          <h3>Ghi hình Highlight tự động</h3>
          <p style="margin:6px 0 0;font-size:13px;">Tự lưu clip quanh mỗi pha hạ gục / clutch bằng Overwolf hoặc phím tắt tùy chỉnh, kèm giới hạn dung lượng ổ cứng tự dọn dẹp.</p>
        </div>
        <div class="feature-card">
          <span class="feature-tag">02 - TRÌNH XEM REPLAY PRO</span>
          <h3>Lặp đoạn A-B &amp; Zoom 1x-3x</h3>
          <p style="margin:6px 0 0;font-size:13px;">Soi kỹ pha sấy và đặt tâm với vòng lặp A-B (<code class="inline-code">[</code> / <code class="inline-code">]</code>), tua từng khung (<code class="inline-code">,</code> / <code class="inline-code">.</code>), phóng to (<code class="inline-code">Z</code>) và vẽ mũi tên Telestrator.</p>
        </div>
        <div class="feature-card">
          <span class="feature-tag">03 - CHỈ SỐ CHUYÊN SÂU</span>
          <h3>Biểu đồ Radar 5 trục &amp; Xuất CSV/JSON</h3>
          <p style="margin:6px 0 0;font-size:13px;">Tự động tính <code class="inline-code">KAST%</code>, <code class="inline-code">ADR</code>, <code class="inline-code">HS%</code> và điểm <code class="inline-code">Impact</code> sau mỗi trận, hỗ trợ xuất file <code class="inline-code">CSV</code> / <code class="inline-code">JSON</code> 1 chạm.</p>
        </div>
        <div class="feature-card">
          <span class="feature-tag">04 - BẢN ĐỒ 2D PUBG</span>
          <h3>Tua lộ trình &amp; Vòng bo 2D PUBG</h3>
          <p style="margin:6px 0 0;font-size:13px;">Xem lại chính xác đường di chuyển qua từng vòng bo trên Erangel, Miramar, Taego, Vikendi kèm quãng đường (km) và điểm hạ gục.</p>
        </div>
        <div class="feature-card">
          <span class="feature-tag">05 - AI COACH &amp; GHI CHÚ</span>
          <h3>AI Coach, Dấu trang &amp; Chia sẻ Discord</h3>
          <p style="margin:6px 0 0;font-size:13px;">Hỏi AI Coach về từng round/phase, gắn dấu trang clip (<code class="inline-code">B</code>), gắn nhãn trận đấu và tạo link chia sẻ trận đấu đẹp mắt lên Discord.</p>
        </div>
        <div class="feature-card">
          <span class="feature-tag">06 - CÁ NHÂN HÓA</span>
          <h3>Cài đặt hợp nhất &amp; Tự cập nhật ngầm</h3>
          <p style="margin:6px 0 0;font-size:13px;">Hỗ trợ song ngữ Anh/Việt, chỉnh phím tắt chi tiết, sao lưu JSON Kho Sens &amp; Tâm và tự tải bản cập nhật mới ngay khi bật app.</p>
        </div>
      </div>

      <h2>Trải nghiệm người dùng &amp; Luồng dữ liệu API</h2>
      <p style="margin-top:0;">Kiến trúc tổng thể minh họa cách người chơi xác thực tài khoản và tự xem lại các trận đã kết thúc.</p>

      <div class="flow-grid">
        <div class="flow-step">
          <span class="step-tag">BƯỚC 01 - XÁC THỰC</span>
          <h3>Riot Sign On (RSO) / Steam</h3>
          <p>Người chơi VALORANT đăng nhập OAuth2 (<span class="mono">auth.riotgames.com</span>, scope: <span class="mono">openid offline_access</span>). Người chơi PUBG liên kết hồ sơ Steam/PUBG.</p>
        </div>
        <div class="flow-step">
          <span class="step-tag">BƯỚC 02 - GHI HÌNH</span>
          <h3>Clip Replay nội bộ</h3>
          <p>Trong trận đấu, Overwolf chỉ ghi video cục bộ và lưu mốc thời gian round/phase để tua nhanh sau khi trận kết thúc.</p>
        </div>
        <div class="flow-step">
          <span class="step-tag">BƯỚC 03 - API SAU TRẬN</span>
          <h3>Phân tích VAL-MATCH-V1 &amp; PUBG</h3>
          <p>Sau khi trận đấu hoàn tất, máy chủ tải dữ liệu chính thức để phân loại kinh tế round VALORANT, lộ trình bo PUBG và phát hiện lỗi chết lẻ.</p>
        </div>
        <div class="flow-step">
          <span class="step-tag">BƯỚC 04 - COACHING UI</span>
          <h3>Telestrator, Radar &amp; AI Debrief</h3>
          <p>Mở Cockpit xem lại mốc round, vẽ mũi tên lên video, soi biểu đồ radar 5 trục, sao chép ảnh sang Discord hoặc gửi link xem trận cho đồng đội.</p>
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

      <script>
        (function() {
          var content = {
            valorant: {
              badge: 'TUÂN THỦ VANGUARD - CHỈ PHÂN TÍCH SAU TRẬN - BẢO VỆ BỞI RSO',
              title: 'Xem lại Video Replay & Phân tích chiến thuật sau trận cho VALORANT',
              desc: 'TacticalReplayAI là ứng dụng Windows miễn phí giúp người chơi VALORANT & PUBG tự động lưu clip highlight sau trận, phân tích kinh tế từng round, xem biểu đồ radar 5 trục, vẽ mũi tên Telestrator và hỏi đáp cùng AI Coach.',
              sideTag: 'CAM KẾT FAIR PLAY & CHÍNH SÁCH RIOT GAMES',
              sideTitle: 'Tuân thủ tuyệt đối nguyên tắc chống gian lận',
              bullets: [
                '<strong>Chỉ hoạt động sau trận (Post-Match Only):</strong> Không hiển thị overlay khi đang bắn, không soi rank hay tướng đối thủ trước trận, không theo dõi kinh tế địch theo thời gian thực.',
                '<strong>Bảo mật qua Riot Sign On (RSO):</strong> Người chơi tự nguyện đăng nhập bằng RSO mới xem được lịch sử 20 trận gần nhất và báo cáo cá nhân.',
                '<strong>Không Store Checker / Không MMR ẩn:</strong> Tuyệt đối không kiểm tra shop vật phẩm, không tính điểm MMR ẩn và không công khai bảng xếp hạng người lạ.',
                '<strong>Không đọc bộ nhớ game:</strong> Chỉ dùng API chính thức của Riot Games / PUBG và bộ ghi hình hợp lệ của Overwolf.'
              ]
            },
            pubg: {
              badge: 'AN TOÀN BATTLEYE - TELEMETRY PUBG CHÍNH THỨC - HỖ TRỢ OVERWOLF',
              title: 'Tự động lưu Highlight & Tua lộ trình vòng bo 2D cho PUBG',
              desc: 'Tự động quay lại các pha clutch đẹp mắt và đồng bộ dữ liệu Telemetry chính thức từ PUBG để tua đường di chuyển 2D qua từng vòng bo, soi sát thương vũ khí, xem radar 5 trục và hỏi đáp AI Coach.',
              sideTag: 'TÍNH NĂNG CHUYÊN BIỆT CHO PUBG: BATTLEGROUNDS',
              sideTitle: 'Thiết kế riêng cho review Squad & leo Rank',
              bullets: [
                '<strong>Tua lộ trình vòng bo 2D trực quan:</strong> Xem lại đường chạy bo theo từng Phase trên Erangel, Miramar, Taego, Vikendi, Sanhok, Deston kèm tổng quãng đường (km).',
                '<strong>Thống kê đạn đạo & Khoảng cách hạ gục:</strong> Theo dõi tỉ lệ headshot, sát thương AR/DMR/SR, số lựu đạn sử dụng và phát bắn xa nhất.',
                '<strong>Bảng xếp hạng Squad & Chia sẻ Discord:</strong> Tải clip highlight lên link công khai kèm video, biểu đồ radar 5 trục và sơ đồ vòng bo 2D.',
                '<strong>100% An toàn chống gian lận:</strong> Không radar trong trận, không can thiệp bộ nhớ, chỉ phân tích dữ liệu sau khi trận kết thúc.'
              ]
            }
          };

          function applyTheme(mode) {
            var data = content[mode] || content.valorant;
            document.documentElement.setAttribute('data-theme', mode);
            document.getElementById('heroBadge').textContent = data.badge;
            document.getElementById('heroTitle').textContent = data.title;
            document.getElementById('heroDesc').textContent = data.desc;
            document.getElementById('sideTag').textContent = data.sideTag;
            document.getElementById('sideTitle').textContent = data.sideTitle;
            document.getElementById('sideBullets').innerHTML = data.bullets.map(function(b) { return '<li>' + b + '</li>'; }).join('');
            document.getElementById('themeBtnValo').className = 'game-switch-btn' + (mode === 'valorant' ? ' active-valo' : '');
            document.getElementById('themeBtnPubg').className = 'game-switch-btn' + (mode === 'pubg' ? ' active-pubg' : '');
          }

          document.querySelectorAll('[data-set-theme]').forEach(function(btn) {
            btn.addEventListener('click', function() {
              applyTheme(btn.getAttribute('data-set-theme'));
            });
          });
        })();
      </script>
    `;

  res.send(
    renderPortalLayout({
      currentPath: '/',
      title: isEn
        ? 'Post-Match Tactical Replay & Coaching'
        : 'Xem lại Replay & Phân tích chiến thuật sau trận',
      bodyHtml,
      isEn,
      latestVersion: latest.version,
      extraHead: homeExtraHead,
    })
  );
});

// 2. GET /download - Auto-updating direct .exe download (or install guide with ?page=1)
router.get('/download', async (req: Request, res: Response) => {
  const latest = await getLatestReleaseInfo();
  if (String(req.query.page || '') !== '1') {
    res.redirect(302, latest.downloadUrl);
    return;
  }

  const isEn = detectIsEnglish(req);
  const qs = langQueryString(isEn);
  const safeVer = escapeHtml(latest.version);
  const safeFile = escapeHtml(latest.fileName);
  const safeSize = escapeHtml(latest.sizeMb);
  const safeDate = escapeHtml(formatReleaseDate(latest.publishedAt, isEn));

  const bodyHtml = `
    <div class="card">
      <span class="badge">${isEn ? 'DIRECT WINDOWS INSTALLER - AUTO-UPDATING' : 'BỘ CÀI WINDOWS TRỰC TIẾP - TỰ CẬP NHẬT NGẦM'}</span>
      <h1>${isEn ? `Download TacticalReplayAI v${safeVer}` : `Tải TacticalReplayAI v${safeVer}`}</h1>
      <p style="max-width:65ch;">
        ${
          isEn
            ? 'Install once and stay current automatically. When a new version ships, the desktop app downloads it silently in the background and upgrades on restart without re-running the setup wizard.'
            : 'Chỉ cần cài đặt một lần duy nhất. Khi có phiên bản mới, ứng dụng sẽ tự tải bản cập nhật ngầm ngay khi mở app và nâng cấp bằng một nút Khởi động lại.'
        }
      </p>

      <div class="metrics-strip" style="margin-top:18px;">
        <div class="metric-box">
          <span class="metric-label">${isEn ? 'VERSION' : 'PHIÊN BẢN'}</span>
          <span class="metric-val" style="color:#10B981;">v${safeVer}</span>
        </div>
        <div class="metric-box">
          <span class="metric-label">${isEn ? 'FILE SIZE' : 'DUNG LƯỢNG'}</span>
          <span class="metric-val" style="color:#EEF2F6;">${safeSize}</span>
        </div>
        <div class="metric-box">
          <span class="metric-label">${isEn ? 'PLATFORM' : 'HỆ ĐIỀU HÀNH'}</span>
          <span class="metric-val" style="color:#38BDF8;">Win 10/11 x64</span>
        </div>
        <div class="metric-box">
          <span class="metric-label">${isEn ? 'RELEASED' : 'NGÀY PHÁT HÀNH'}</span>
          <span class="metric-val" style="color:#E59A23;">${safeDate || 'Latest'}</span>
        </div>
      </div>

      <div class="cta-row">
        <a class="btn-primary" href="${escapeHtml(latest.downloadUrl)}">
          ${isEn ? `Download ${safeFile}` : `Tải ngay ${safeFile}`}
        </a>
        <a class="btn-secondary" href="${escapeHtml(latest.htmlUrl)}" target="_blank" rel="noreferrer">
          ${isEn ? 'Inspect on GitHub Releases' : 'Xem trên GitHub Releases'}
        </a>
        <a class="btn-secondary" href="/changelog${qs}">
          ${isEn ? 'Read Changelog' : 'Xem nhật ký thay đổi'}
        </a>
      </div>

      <h2>${isEn ? 'First-Time Installation Note (Windows SmartScreen)' : 'Hướng dẫn chạy lần đầu (Windows SmartScreen)'}</h2>
      <ol style="padding-left:20px;margin:8px 0 0;">
        <li>${isEn ? 'Run the downloaded installer file' : 'Mở tệp cài đặt vừa tải về'} (<code class="inline-code">${safeFile}</code>).</li>
        <li>${
          isEn
            ? 'If Windows Defender SmartScreen appears (standard for unsigned open-source builds), click <strong>More info</strong> &rarr; <strong>Run anyway</strong>.'
            : 'Nếu Windows Defender SmartScreen hiện thông báo (bình thường với app cộng đồng mã nguồn mở chưa mua chứng chỉ ký số), bấm <strong>More info</strong> &rarr; <strong>Run anyway</strong>.'
        }</li>
        <li>${
          isEn
            ? 'Launch TacticalReplayAI, switch between VALORANT &amp; PUBG themes anytime, and sign in via RSO or Steam.'
            : 'Mở TacticalReplayAI, chuyển nhanh giữa hai chế độ VALORANT &amp; PUBG và đăng nhập bằng RSO hoặc Steam.'
        }</li>
      </ol>
    </div>
  `;

  res.send(
    renderPortalLayout({
      currentPath: '/',
      title: isEn ? `Download v${latest.version}` : `Tải về v${latest.version}`,
      bodyHtml,
      isEn,
      latestVersion: latest.version,
    })
  );
});

// 3. GET /demo - Dual-Game Interactive Web Prototype (VALORANT + PUBG 2D Route Scrubber + 5-Axis Radar)
router.get('/demo', async (req: Request, res: Response) => {
  const isEn = detectIsEnglish(req);
  const latest = await getLatestReleaseInfo();

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
      border-left: 3px solid var(--accent-primary);
      border-radius: 4px;
      margin-bottom: 16px;
      font-size: 13px;
    }
    .cockpit {
      display: grid;
      grid-template-columns: 265px 1fr 325px;
      gap: 14px;
      align-items: start;
    }
    @media (max-width: 1040px) {
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
      border-color: var(--accent-primary);
      background: var(--theme-glow-1);
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
      background: var(--accent-primary);
      border-color: var(--accent-primary);
      color: var(--accent-primary-fg);
    }
    .scrubber-bar {
      display: none;
      align-items: center;
      gap: 10px;
      margin-top: 10px;
      padding: 8px 10px;
      background: #0A0D12;
      border: 1px solid #232B3B;
      border-radius: 2px;
    }
    .scrubber-bar input[type='range'] {
      flex: 1;
      accent-color: #E59A23;
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
      border-color: var(--accent-primary);
      background: var(--theme-glow-1);
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
      background: var(--accent-primary);
      color: var(--accent-primary-fg);
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

  const bodyHtml = `
      <div class="demo-banner">
        <div>
          <strong style="color:#E59A23;">${
            isEn
              ? 'INTERACTIVE DUAL-GAME PROTOTYPE (SAMPLE TELEMETRY)'
              : 'BẢN DÙNG THỬ TƯƠNG TÁC HAI GAME (DỮ LIỆU MẪU)'
          }</strong>
          <span style="color:#cbd5e1;"> - ${
            isEn
              ? 'Switch between VALORANT (RSO + Telestrator) and PUBG (Animated 2D Safe-Zone Route Scrubber). No download or login needed.'
              : 'Chuyển nhanh giữa VALORANT (RSO + Telestrator) và PUBG (Tua lộ trình vòng bo 2D). Không cần đăng nhập hay cài app.'
          }</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <div class="game-switch-bar" style="margin-bottom:0;" role="group" aria-label="${
            isEn ? 'Select demo game' : 'Chon game dung thu'
          }">
            <button type="button" id="demoGameValo" class="game-switch-btn active-valo" data-demo-game="VALORANT">VALORANT</button>
            <button type="button" id="demoGamePubg" class="game-switch-btn" data-demo-game="PUBG">PUBG</button>
          </div>
          <button id="rsoSimBtn" type="button" class="btn-primary" style="padding:7px 12px;font-size:12px;">
            ${isEn ? 'Simulate RSO Flow' : 'Mô phỏng RSO'}
          </button>
        </div>
      </div>

      <div id="rsoFlowLog" class="rso-sim-box" style="display:none;"></div>

      <div class="cockpit">
        <aside class="panel">
          <div class="panel-title">
            <span id="historyHeading">${isEn ? '20-Match History (Demo)' : 'Lịch sử 20 trận (Mẫu)'}</span>
            <span id="historyTag" class="mono">RSO SYNC</span>
          </div>
          <div id="matchList"></div>
          <p id="historyNote" style="font-size:11px;color:#64748B;margin:10px 0 0;">
            ${
              isEn
                ? "In production, VALORANT matches are fetched strictly post-match using the signed-in user's RSO PUUID via <span class=\"mono\">val-match-v1</span>."
                : 'Ở bản thực tế, lịch sử VALORANT chỉ tải sau khi kết thúc trận bằng PUUID đã xác thực RSO qua <span class="mono">val-match-v1</span>.'
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
              <button type="button" class="tool-btn" id="clearDrawBtn">${isEn ? 'Clear' : 'Xóa nét'}</button>
            </div>
          </div>

          <div class="stage-wrap">
            <canvas id="replayCanvas" width="800" height="450"></canvas>
          </div>

          <div id="pubgScrubberBar" class="scrubber-bar">
            <button type="button" id="pubgPlayBtn" class="tool-btn" style="padding:5px 10px;background:#E59A23;border-color:#E59A23;color:#0A0D12;font-weight:700;">
              ${isEn ? 'Play Route' : 'Chạy lộ trình'}
            </button>
            <input id="pubgProgressSlider" type="range" min="10" max="100" value="100" aria-label="${
              isEn ? 'PUBG route playback progress' : 'Tien do lo trinh PUBG'
            }" />
            <span id="pubgProgressLabel" class="mono" style="color:#E59A23;min-width:96px;text-align:right;">100% | 4.8 km</span>
          </div>

          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;font-size:12px;color:#94A3B8;gap:8px;flex-wrap:wrap;">
            <span class="mono" id="timelineMarkerInfo">Timeline Marker: 00:42 - Round 01</span>
            <span class="mono" id="telestratorHint">${isEn ? 'Drag on canvas to draw Telestrator arrows' : 'Kéo chuột lên khung để vẽ mũi tên Telestrator'}</span>
          </div>

          <div class="panel-title" style="margin-top:16px;">
            <span id="breakdownHeading">${isEn ? 'Round-by-Round Breakdown' : 'Diễn biến từng Round'}</span>
            <span id="breakdownTag" class="mono">${isEn ? 'SELECT ROUND' : 'CHỌN ROUND'}</span>
          </div>
          <div id="roundGrid" class="round-grid"></div>
        </section>

        <aside class="panel">
          <div class="tab-row">
            <button type="button" class="tab-btn active" data-tab="round" id="tabRoundLabel">${isEn ? 'Round Detail' : 'Chi tiết Round'}</button>
            <button type="button" class="tab-btn" data-tab="match">${isEn ? 'Match Radar' : 'Radar & Tổng kết'}</button>
            <button type="button" class="tab-btn" data-tab="coach">AI Coach</button>
          </div>
          <div id="inspectorBody"></div>
        </aside>
      </div>

      <script>
        (function() {
          var isEn = ${isEn ? 'true' : 'false'};

          var datasets = {
            VALORANT: isEn ? [
              {
                id: 'val-ascent-01',
                map: 'Ascent',
                mode: 'COMPETITIVE',
                result: 'VICTORY',
                score: '13-9 - 21/14/6 KDA',
                overallScore: 8.4,
                metrics: { kast: 78, adr: 174, hs: 29, impact: 1.38, axes: [86, 82, 78, 84, 79] },
                commentary: 'Strong rifle impact on A-Main control (420 DMG in R05) and disciplined eco conversion. Focus on trading early picks on B-Lane defense.',
                rounds: [
                  { num: 1, res: 'WIN', kda: '2/0/1', dmg: 265, eco: 'ECO', style: 'FAST_EXECUTE', weapon: 'Classic / Ghost', time: '00:42', good: ['Opening Pick: Won first duel at A-Main creating 5v4 advantage.','Thrifty Pistol Win: Coordinated utility push on A-Site.'], bad: [] },
                  { num: 3, res: 'LOSS', kda: '0/1/0', dmg: 40, eco: 'FORCE_BUY', style: 'DEFAULT_CONTROL', weapon: 'Spectre', time: '04:15', good: [], bad: ['Untraded Death: Peeked Mid Catwalk alone without teammate trade support.'] },
                  { num: 5, res: 'WIN', kda: '3/0/0', dmg: 420, eco: 'FULL_BUY', style: 'FAST_EXECUTE', weapon: 'Vandal', time: '08:10', good: ['Multi-Kill (3K): High rifle accuracy holding A-Heaven post-plant.'], bad: [] },
                  { num: 12, res: 'LOSS', kda: '1/1/1', dmg: 145, eco: 'BONUS', style: 'FAKE_ROTATE', weapon: 'Sheriff', time: '19:30', good: ['Converted early damage on Bonus round.'], bad: ['Unused Utility: Eliminated with 2 abilities unspent during retake.'] }
                ]
              },
              {
                id: 'val-haven-02',
                map: 'Haven',
                mode: 'COMPETITIVE',
                result: 'DEFEAT',
                score: '11-13 - 18/17/5 KDA',
                overallScore: 6.8,
                metrics: { kast: 66, adr: 142, hs: 24, impact: 1.04, axes: [71, 69, 66, 73, 62] },
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
                id: 'val-ascent-01',
                map: 'Ascent',
                mode: 'ĐẤU HẠNG',
                result: 'CHIẾN THẮNG',
                score: '13-9 - 21/14/6 KDA',
                overallScore: 8.4,
                metrics: { kast: 78, adr: 174, hs: 29, impact: 1.38, axes: [86, 82, 78, 84, 79] },
                commentary: 'Kiểm soát A-Main tốt (420 sát thương ở Round 05) và tận dụng tốt round Eco. Cần cải thiện phối hợp trade kill khi thủ B-Lane.',
                rounds: [
                  { num: 1, res: 'THẮNG', kda: '2/0/1', dmg: 265, eco: 'ECO', style: 'ĐẨY NHANH', weapon: 'Classic / Ghost', time: '00:42', good: ['Mạng mở giao tranh: Thắng tay đôi đầu ở A-Main tạo lợi thế 5v4.','Thắng round lục nhờ phối hợp utility vào A-Site.'], bad: [] },
                  { num: 3, res: 'THUA', kda: '0/1/0', dmg: 40, eco: 'FORCE_BUY', style: 'KIỂM SOÁT CHẬM', weapon: 'Spectre', time: '04:15', good: [], bad: ['Chết lẻ không có người đổi mạng: Peek Mid Catwalk một mình khi chưa có flash hỗ trợ.'] },
                  { num: 5, res: 'THẮNG', kda: '3/0/0', dmg: 420, eco: 'FULL_BUY', style: 'ĐẨY NHANH', weapon: 'Vandal', time: '08:10', good: ['Multi-Kill (3K): Giữ góc kê A-Heaven cực chắc sau khi đặt Spike.'], bad: [] },
                  { num: 12, res: 'THUA', kda: '1/1/1', dmg: 145, eco: 'BONUS', style: 'ĐẢO CÁNH', weapon: 'Sheriff', time: '19:30', good: ['Gây lượng sát thương tốt trong round Bonus.'], bad: ['Dư kỹ năng: Bị hạ gục khi vẫn còn 2 chiêu chưa dùng lúc retake.'] }
                ]
              },
              {
                id: 'val-haven-02',
                map: 'Haven',
                mode: 'ĐẤU HẠNG',
                result: 'THẤT BẠI',
                score: '11-13 - 18/17/5 KDA',
                overallScore: 6.8,
                metrics: { kast: 66, adr: 142, hs: 24, impact: 1.04, axes: [71, 69, 66, 73, 62] },
                commentary: 'Mở góc bắn tỉa C-Long khá tốt đầu trận, nhưng ép mua Force Buy liên tiếp cuối trận khiến hụt tiền ở Round 22.',
                rounds: [
                  { num: 2, res: 'THẮNG', kda: '2/1/0', dmg: 290, eco: 'FULL_BUY', style: 'KIỂM SOÁT CHẬM', weapon: 'Bulldog', time: '02:20', good: ['Multi-Kill (2K): Đẩy lùi pha ép Garage gọn gàng.'], bad: [] },
                  { num: 8, res: 'THUA', kda: '0/1/0', dmg: 0, eco: 'FORCE_BUY', style: 'KIỂM SOÁT CHẬM', weapon: 'Sheriff', time: '12:55', good: [], bad: ['Chết lẻ không trade: Dry-peek ra C-Long đối đầu thẳng Operator của địch.'] },
                  { num: 15, res: 'THẮNG', kda: '2/0/1', dmg: 310, eco: 'FULL_BUY', style: 'ĐẨY NHANH', weapon: 'Phantom', time: '24:40', good: ['Mạng mở tỷ số: Chiếm A-Short và đặt Spike sớm.'], bad: [] },
                  { num: 22, res: 'THUA', kda: '1/1/0', dmg: 135, eco: 'ECO', style: 'KIỂM SOÁT CHẬM', weapon: 'Ghost', time: '36:12', good: [], bad: ['Mất lợi thế kê chéo hậu Spike do tự mở rộng góc khi chỉ còn 10 giây.'] }
                ]
              }
            ],
            PUBG: isEn ? [
              {
                id: 'pubg-erangel-01',
                map: 'Erangel',
                mode: 'SQUAD-FPP',
                result: 'TOP #1',
                score: '6 Kills - 785 DMG - 4.8 km',
                overallScore: 9.1,
                distanceKm: 4.8,
                metrics: { kast: 92, adr: 196, hs: 31, impact: 1.72, axes: [91, 84, 92, 86, 88] },
                commentary: 'Textbook center-compound rotation from Pochinki into Phase 4 Mylta ridge. Excellent 184m Kar98k knock opened the final 2v2 Chicken Dinner.',
                zones: [
                  { x: 430, y: 235, r: 178 },
                  { x: 475, y: 215, r: 118 },
                  { x: 515, y: 196, r: 68 },
                  { x: 535, y: 185, r: 34 }
                ],
                route: [
                  { x: 185, y: 315 }, { x: 245, y: 295 }, { x: 318, y: 262 },
                  { x: 392, y: 244 }, { x: 455, y: 222 }, { x: 505, y: 204 },
                  { x: 532, y: 188 }
                ],
                kills: [
                  { x: 318, y: 262, label: 'M416 (42m)' },
                  { x: 455, y: 222, label: 'Kar98k (184m)' },
                  { x: 525, y: 192, label: 'M416 Clutch (28m)' }
                ],
                deaths: [],
                rounds: [
                  { num: 1, res: 'SURVIVED', kda: '1/0/1', dmg: 148, eco: 'EARLY_LOOT', style: 'HOT_DROP', weapon: 'M416', time: '03:18', good: ['Clean Pochinki west compound clear with zero squad knocks.'], bad: [] },
                  { num: 3, res: 'SURVIVED', kda: '2/0/0', dmg: 215, eco: 'MID_ROTATE', style: 'CENTER_HOLD', weapon: 'Kar98k (184m)', time: '14:40', good: ['Early vehicle rotation secured Phase 4 ridge before blue closed.'], bad: [] },
                  { num: 5, res: 'SURVIVED', kda: '1/0/2', dmg: 162, eco: 'LATE_ZONE', style: 'UTILITY_WALL', weapon: 'Mini 14 + 3 Smokes', time: '22:05', good: ['Layered smoke wall allowed safe cross-road push.'], bad: [] },
                  { num: 6, res: 'WIN', kda: '2/0/0', dmg: 260, eco: 'FINAL_CIRCLE', style: 'HIGH_GROUND', weapon: 'M416', time: '27:12', good: ['Final 2v2 double spray secured Chicken Dinner with full utility control.'], bad: [] }
                ]
              },
              {
                id: 'pubg-miramar-02',
                map: 'Miramar',
                mode: 'SQUAD-FPP',
                result: 'TOP #4',
                score: '4 Kills - 512 DMG - 6.1 km',
                overallScore: 7.3,
                distanceKm: 6.1,
                metrics: { kast: 75, adr: 128, hs: 22, impact: 1.15, axes: [76, 68, 75, 79, 64] },
                commentary: 'Strong mid-game DMR pressure around Pecado cliffs, but late Phase 5 edge-play forced an uphill sprint without smoke cover.',
                zones: [
                  { x: 380, y: 225, r: 175 },
                  { x: 340, y: 205, r: 112 },
                  { x: 310, y: 175, r: 62 }
                ],
                route: [
                  { x: 615, y: 340 }, { x: 540, y: 300 }, { x: 465, y: 255 },
                  { x: 398, y: 225 }, { x: 342, y: 192 }, { x: 305, y: 168 }
                ],
                kills: [
                  { x: 465, y: 255, label: 'Beryl M762 (35m)' },
                  { x: 350, y: 196, label: 'Mk12 (142m)' }
                ],
                deaths: [
                  { x: 305, y: 168, label: 'Eliminated Phase 5' }
                ],
                rounds: [
                  { num: 1, res: 'SURVIVED', kda: '1/0/0', dmg: 120, eco: 'EARLY_LOOT', style: 'SPLIT_LOOT', weapon: 'Beryl M762', time: '04:10', good: ['Secured vehicle and Level 2 gear cleanly before Phase 1 shift.'], bad: [] },
                  { num: 3, res: 'SURVIVED', kda: '2/0/1', dmg: 230, eco: 'MID_ROTATE', style: 'RIDGE_POKE', weapon: 'Mk12 (142m)', time: '15:22', good: ['Two long-range knocks slowed third-party push from south ridge.'], bad: [] },
                  { num: 5, res: 'ELIMINATED', kda: '1/1/0', dmg: 162, eco: 'LATE_ZONE', style: 'LATE_EDGE', weapon: 'Beryl M762', time: '24:05', good: [], bad: ['Late Edge Rotation: Held blue line too long and had zero smoke grenades left for uphill push.'] }
                ]
              }
            ] : [
              {
                id: 'pubg-erangel-01',
                map: 'Erangel',
                mode: 'SQUAD-FPP',
                result: 'TOP #1',
                score: '6 Kills - 785 DMG - 4.8 km',
                overallScore: 9.1,
                distanceKm: 4.8,
                metrics: { kast: 92, adr: 196, hs: 31, impact: 1.72, axes: [91, 84, 92, 86, 88] },
                commentary: 'Di chuyển vào tâm bo cực chuẩn từ Pochinki lên đồi Mylta ở Phase 4. Cú bắn Kar98k 184m mở khóa pha 2v2 ăn Top 1.',
                zones: [
                  { x: 430, y: 235, r: 178 },
                  { x: 475, y: 215, r: 118 },
                  { x: 515, y: 196, r: 68 },
                  { x: 535, y: 185, r: 34 }
                ],
                route: [
                  { x: 185, y: 315 }, { x: 245, y: 295 }, { x: 318, y: 262 },
                  { x: 392, y: 244 }, { x: 455, y: 222 }, { x: 505, y: 204 },
                  { x: 532, y: 188 }
                ],
                kills: [
                  { x: 318, y: 262, label: 'M416 (42m)' },
                  { x: 455, y: 222, label: 'Kar98k (184m)' },
                  { x: 525, y: 192, label: 'M416 Clutch (28m)' }
                ],
                deaths: [],
                rounds: [
                  { num: 1, res: 'SURVIVED', kda: '1/0/1', dmg: 148, eco: 'EARLY_LOOT', style: 'NHẢY NÓNG', weapon: 'M416', time: '03:18', good: ['Dọn gọn khu tây Pochinki mà không mất thành viên nào.'], bad: [] },
                  { num: 3, res: 'SURVIVED', kda: '2/0/0', dmg: 215, eco: 'MID_ROTATE', style: 'CHIẾM TÂM BO', weapon: 'Kar98k (184m)', time: '14:40', good: ['Chạy xe chiếm sớm sườn đồi Phase 4 trước khi bo xanh khép.'], bad: [] },
                  { num: 5, res: 'SURVIVED', kda: '1/0/2', dmg: 162, eco: 'LATE_ZONE', style: 'TƯỜNG SMOKE', weapon: 'Mini 14 + 3 Smoke', time: '22:05', good: ['Trải 3 quả smoke liên hoàn giúp cả đội băng qua đường an toàn.'], bad: [] },
                  { num: 6, res: 'THẮNG', kda: '2/0/0', dmg: 260, eco: 'FINAL_CIRCLE', style: 'GIỮ ĐỒI CAO', weapon: 'M416', time: '27:12', good: ['Sấy hạ 2 địch ở bo cuối giữ vững lợi thế cao độ ăn Top #1.'], bad: [] }
                ]
              },
              {
                id: 'pubg-miramar-02',
                map: 'Miramar',
                mode: 'SQUAD-FPP',
                result: 'TOP #4',
                score: '4 Kills - 512 DMG - 6.1 km',
                overallScore: 7.3,
                distanceKm: 6.1,
                metrics: { kast: 75, adr: 128, hs: 22, impact: 1.15, axes: [76, 68, 75, 79, 64] },
                commentary: 'Gây áp lực DMR tốt quanh vách đá Pecado, nhưng bám mép bo Phase 5 quá lâu khiến thiếu smoke khi leo dốc.',
                zones: [
                  { x: 380, y: 225, r: 175 },
                  { x: 340, y: 205, r: 112 },
                  { x: 310, y: 175, r: 62 }
                ],
                route: [
                  { x: 615, y: 340 }, { x: 540, y: 300 }, { x: 465, y: 255 },
                  { x: 398, y: 225 }, { x: 342, y: 192 }, { x: 305, y: 168 }
                ],
                kills: [
                  { x: 465, y: 255, label: 'Beryl M762 (35m)' },
                  { x: 350, y: 196, label: 'Mk12 (142m)' }
                ],
                deaths: [
                  { x: 305, y: 168, label: 'Bị hạ ở Phase 5' }
                ],
                rounds: [
                  { num: 1, res: 'SURVIVED', kda: '1/0/0', dmg: 120, eco: 'EARLY_LOOT', style: 'TÁCH LOOT', weapon: 'Beryl M762', time: '04:10', good: ['Tìm được xe sớm và đủ giáp 2 trước khi bo 1 đóng.'], bad: [] },
                  { num: 3, res: 'SURVIVED', kda: '2/0/1', dmg: 230, eco: 'MID_ROTATE', style: 'RỈA TẦM XA', weapon: 'Mk12 (142m)', time: '15:22', good: ['Hạ gục 2 mục tiêu tầm xa chặn đội thứ ba ép từ đồi nam.'], bad: [] },
                  { num: 5, res: 'ELIMINATED', kda: '1/1/0', dmg: 162, eco: 'LATE_ZONE', style: 'BÁM MÉP BO', weapon: 'Beryl M762', time: '24:05', good: [], bad: ['Di chuyển trễ ở mép bo: Hết sạch lựu đạn khói khi phải đẩy ngược dốc ở Phase 5.'] }
                ]
              }
            ]
          };

          var state = {
            game: 'VALORANT',
            matchIdx: 0,
            roundIdx: 0,
            tab: 'round',
            tool: 'arrow',
            shapes: [],
            drawing: false,
            current: null,
            pubgProgress: 100,
            pubgTimer: null,
            coachReply: isEn
              ? 'Select a sample prompt below to preview how AI Coach explains mistakes from completed match telemetry.'
              : 'Chọn một câu hỏi mẫu bên dưới để xem AI Coach phân tích sai sót từ dữ liệu sau trận.'
          };

          var canvas = document.getElementById('replayCanvas');
          var ctx = canvas.getContext('2d');

          function buildInlineRadarSvg(metrics, isValo) {
            var cx = 125, cy = 102, maxR = 62;
            var accent = isValo ? '#FF4655' : '#E59A23';
            var fill = isValo ? 'rgba(255,70,85,0.22)' : 'rgba(229,154,35,0.22)';
            var labels = isEn ? ['FIRE', 'AIM', 'KAST', 'TEMPO', 'UTIL'] : ['HỎA LỰC', 'CHUẨN XÁC', 'KAST', 'NHỊP ĐỘ', 'KỶ LUẬT'];
            function pt(r, i) {
              var a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
              return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
            }
            var svg = '<svg viewBox="0 0 250 202" style="width:100%;max-width:255px;display:block;margin:4px auto 8px;">';
            [0.35, 0.68, 1].forEach(function(r) {
              var pts = [0,1,2,3,4].map(function(i){ var p = pt(maxR*r, i); return p.x.toFixed(1)+','+p.y.toFixed(1); }).join(' ');
              svg += '<polygon points="' + pts + '" fill="none" stroke="#1E293B" stroke-width="1"/>';
            });
            [0,1,2,3,4].forEach(function(i){
              var p = pt(maxR, i);
              svg += '<line x1="'+cx+'" y1="'+cy+'" x2="'+p.x.toFixed(1)+'" y2="'+p.y.toFixed(1)+'" stroke="#1E293B" stroke-width="1"/>';
            });
            var dPts = metrics.axes.map(function(v, i){ var p = pt((v/100)*maxR, i); return p.x.toFixed(1)+','+p.y.toFixed(1); }).join(' ');
            svg += '<polygon points="'+dPts+'" fill="'+fill+'" stroke="'+accent+'" stroke-width="2"/>';
            metrics.axes.forEach(function(v, i){
              var dot = pt((v/100)*maxR, i);
              var lbl = pt(maxR + 22, i);
              svg += '<circle cx="'+dot.x.toFixed(1)+'" cy="'+dot.y.toFixed(1)+'" r="3.2" fill="'+accent+'" stroke="#EEF2F6" stroke-width="1"/>';
              svg += '<text x="'+lbl.x.toFixed(1)+'" y="'+(lbl.y-3).toFixed(1)+'" text-anchor="middle" fill="#94A3B8" font-size="8" font-family="ui-monospace,monospace" font-weight="700">'+labels[i]+'</text>';
              svg += '<text x="'+lbl.x.toFixed(1)+'" y="'+(lbl.y+8).toFixed(1)+'" text-anchor="middle" fill="#EEF2F6" font-size="9.5" font-family="ui-monospace,monospace" font-weight="700">'+v+'</text>';
            });
            svg += '</svg>';
            return svg;
          }

          function drawTelestratorShapes() {
            var all = state.current ? state.shapes.concat([state.current]) : state.shapes;
            all.forEach(function(sh) {
              if (!sh.points.length) return;
              ctx.strokeStyle = state.game === 'PUBG' ? '#38BDF8' : '#E59A23';
              ctx.fillStyle = state.game === 'PUBG' ? '#38BDF8' : '#E59A23';
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

          function drawStage() {
            var m = datasets[state.game][state.matchIdx];
            var r = m.rounds[state.roundIdx];
            ctx.fillStyle = '#0A0D12';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            ctx.strokeStyle = 'rgba(35, 43, 59, 0.72)';
            ctx.lineWidth = 1;
            for (var x = 0; x <= canvas.width; x += 40) {
              ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
            }
            for (var y = 0; y <= canvas.height; y += 40) {
              ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
            }

            if (state.game === 'VALORANT') {
              ctx.strokeStyle = '#334155';
              ctx.lineWidth = 2;
              ctx.strokeRect(80, 82, 220, 140);
              ctx.strokeRect(500, 82, 220, 140);
              ctx.strokeRect(310, 236, 180, 140);

              ctx.fillStyle = 'rgba(255, 70, 85, 0.14)';
              ctx.fillRect(80, 82, 220, 140);
              ctx.fillStyle = 'rgba(16, 185, 129, 0.12)';
              ctx.fillRect(500, 82, 220, 140);

              ctx.fillStyle = '#94A3B8';
              ctx.font = 'bold 12px monospace';
              ctx.fillText(isEn ? 'A SITE - POST-MATCH REPLAY FRAME' : 'A SITE - KHUNG HÌNH REPLAY SAU TRẬN', 94, 108);
              ctx.fillText(isEn ? 'B SITE - LANE CONTROL' : 'B SITE - KIỂM SOÁT LANE', 518, 108);
              ctx.fillText(isEn ? 'MID COURTYARD' : 'KHU VỰC MID', 345, 264);

              ctx.fillStyle = '#10B981';
              ctx.beginPath(); ctx.arc(190, 160, 9, 0, Math.PI * 2); ctx.fill();
              ctx.fillStyle = '#EEF2F6';
              ctx.font = '11px monospace';
              ctx.fillText((isEn ? 'PLAYER (' : 'NGƯỜI CHƠI (') + r.weapon + ')', 206, 164);

              ctx.fillStyle = '#FF4655';
              ctx.beginPath(); ctx.arc(580, 154, 9, 0, Math.PI * 2); ctx.fill();
              ctx.fillText(isEn ? 'ENGAGEMENT ZONE' : 'ĐIỂM GIAO TRANH', 596, 158);
            } else {
              // PUBG 2D Safe-Zone & Route Scrubber
              var zones = m.zones || [];
              zones.forEach(function(z, idx) {
                ctx.save();
                ctx.beginPath();
                ctx.arc(z.x, z.y, z.r, 0, Math.PI * 2);
                ctx.strokeStyle = idx === zones.length - 1 ? '#38BDF8' : 'rgba(148, 163, 184, 0.42)';
                ctx.lineWidth = idx === zones.length - 1 ? 2.4 : 1.3;
                if (idx !== zones.length - 1) ctx.setLineDash([6, 4]);
                ctx.stroke();
                ctx.restore();
              });

              var route = m.route || [];
              var visibleCount = Math.max(2, Math.round((state.pubgProgress / 100) * route.length));
              if (route.length > 1) {
                ctx.strokeStyle = '#E59A23';
                ctx.lineWidth = 3;
                ctx.lineJoin = 'round';
                ctx.lineCap = 'round';
                ctx.beginPath();
                for (var i = 0; i < visibleCount; i++) {
                  if (i === 0) ctx.moveTo(route[i].x, route[i].y);
                  else ctx.lineTo(route[i].x, route[i].y);
                }
                ctx.stroke();

                // Drop point
                ctx.fillStyle = '#38BDF8';
                ctx.beginPath(); ctx.arc(route[0].x, route[0].y, 6, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#EEF2F6';
                ctx.font = '11px monospace';
                ctx.fillText(isEn ? 'DROP' : 'NHẢY DÙ', route[0].x + 10, route[0].y + 4);

                // Current scrubber head
                var curPt = route[visibleCount - 1];
                ctx.fillStyle = '#E59A23';
                ctx.beginPath(); ctx.arc(curPt.x, curPt.y, 7, 0, Math.PI * 2); ctx.fill();
                ctx.strokeStyle = '#EEF2F6';
                ctx.lineWidth = 1.5;
                ctx.stroke();
              }

              // Kill markers visible within progress
              (m.kills || []).forEach(function(k, idx) {
                var ratio = (idx + 1) / ((m.kills || []).length + 0.5);
                if (state.pubgProgress / 100 >= ratio * 0.85) {
                  ctx.fillStyle = '#10B981';
                  ctx.beginPath(); ctx.arc(k.x, k.y, 7, 0, Math.PI * 2); ctx.fill();
                  ctx.fillStyle = '#EEF2F6';
                  ctx.font = 'bold 11px monospace';
                  ctx.fillText('KILL: ' + k.label, k.x + 11, k.y + 4);
                }
              });

              if (state.pubgProgress >= 95) {
                (m.deaths || []).forEach(function(d) {
                  ctx.fillStyle = '#FF4655';
                  ctx.beginPath(); ctx.arc(d.x, d.y, 8, 0, Math.PI * 2); ctx.fill();
                  ctx.fillStyle = '#FDA4AF';
                  ctx.font = 'bold 11px monospace';
                  ctx.fillText(d.label, d.x + 11, d.y + 4);
                });
              }
            }

            // Top-left tactical HUD badge
            ctx.fillStyle = 'rgba(16, 20, 28, 0.92)';
            ctx.fillRect(16, 16, 410, 42);
            ctx.strokeStyle = state.game === 'PUBG' ? '#E59A23' : '#FF4655';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(16, 16, 410, 42);
            ctx.fillStyle = '#EEF2F6';
            ctx.font = 'bold 12.5px monospace';
            var unitLabel = state.game === 'PUBG' ? 'PHASE ' : 'ROUND ';
            ctx.fillText(m.map.toUpperCase() + ' // ' + unitLabel + String(r.num).padStart(2, '0') + ' // ' + r.eco, 28, 42);

            drawTelestratorShapes();
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

          function stopPubgPlayback() {
            if (state.pubgTimer) {
              clearInterval(state.pubgTimer);
              state.pubgTimer = null;
              document.getElementById('pubgPlayBtn').textContent = isEn ? 'Play Route' : 'Chạy lộ trình';
            }
          }

          function render() {
            var isValo = state.game === 'VALORANT';
            var list = datasets[state.game];
            var m = list[state.matchIdx];
            var r = m.rounds[state.roundIdx];

            document.documentElement.setAttribute('data-theme', isValo ? 'valorant' : 'pubg');
            document.getElementById('demoGameValo').className = 'game-switch-btn' + (isValo ? ' active-valo' : '');
            document.getElementById('demoGamePubg').className = 'game-switch-btn' + (!isValo ? ' active-pubg' : '');
            document.getElementById('rsoSimBtn').style.display = isValo ? 'inline-flex' : 'none';
            document.getElementById('pubgScrubberBar').style.display = isValo ? 'none' : 'flex';
            if (isValo) stopPubgPlayback();

            document.getElementById('historyTag').textContent = isValo ? 'RSO SYNC' : 'PUBG API';
            document.getElementById('breakdownHeading').textContent = isValo
              ? (isEn ? 'Round-by-Round Breakdown' : 'Diễn biến từng Round')
              : (isEn ? 'Safe-Zone Phase Breakdown' : 'Diễn biến từng Vòng bo');
            document.getElementById('breakdownTag').textContent = isValo
              ? (isEn ? 'SELECT ROUND' : 'CHỌN ROUND')
              : (isEn ? 'SELECT PHASE' : 'CHỌN PHASE');
            document.getElementById('tabRoundLabel').textContent = isValo
              ? (isEn ? 'Round Detail' : 'Chi tiết Round')
              : (isEn ? 'Phase Detail' : 'Chi tiết Phase');

            var unitName = isValo ? 'Round ' : 'Phase ';
            document.getElementById('stageTitle').textContent = m.map + ' (' + m.result + ' - ' + m.score.split(' - ')[0] + ')';
            document.getElementById('stageSubtitle').textContent = unitName + String(r.num).padStart(2, '0') + ' - ' + r.weapon + (isValo
              ? (isEn ? ' - Post-Match Replay Canvas (Drag to draw)' : ' - Bảng vẽ Replay sau trận (Kéo chuột để vẽ)')
              : (isEn ? ' - 2D Safe-Zone & Rotation Map (Drag to draw arrows)' : ' - Sơ đồ vòng bo 2D & Lộ trình (Kéo chuột để vẽ mũi tên)'));
            document.getElementById('timelineMarkerInfo').textContent = (isEn ? 'Timeline Marker: ' : 'Mốc thời gian: ') + r.time + ' - ' + unitName + String(r.num).padStart(2, '0') + ' (' + r.eco + ')';

            if (!isValo) {
              var kmShown = ((m.distanceKm || 4.8) * (state.pubgProgress / 100)).toFixed(1);
              document.getElementById('pubgProgressSlider').value = String(state.pubgProgress);
              document.getElementById('pubgProgressLabel').textContent = state.pubgProgress + '% | ' + kmShown + ' km';
            }

            var matchHtml = '';
            list.forEach(function(item, idx) {
              var winFlag = item.result === 'VICTORY' || item.result === 'CHIẾN THẮNG' || item.result === 'TOP #1';
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
              var rdWin = rd.res === 'WIN' || rd.res === 'THẮNG' || rd.res === 'SURVIVED';
              roundHtml += '<button type="button" class="round-card ' + (idx === state.roundIdx ? 'active' : '') + '" data-round="' + idx + '">' +
                '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">' +
                '<strong class="mono" style="font-size:12px;">' + (isValo ? 'R' : 'P') + String(rd.num).padStart(2, '0') + '</strong>' +
                '<span class="pill ' + (rdWin ? 'pill-win' : 'pill-loss') + '">' + rd.res + '</span></div>' +
                '<div class="mono" style="font-size:11px;color:#cbd5e1;">' + rd.kda + ' - ' + rd.dmg + ' DMG</div>' +
                '<div class="mono" style="font-size:10px;color:#64748B;margin-top:4px;">' + rd.eco + '</div></button>';
            });
            document.getElementById('roundGrid').innerHTML = roundHtml;

            var bodyHtml = '';
            if (state.tab === 'round') {
              var curWin = r.res === 'WIN' || r.res === 'THẮNG' || r.res === 'SURVIVED';
              bodyHtml += '<div style="border-bottom:1px solid #232B3B;padding-bottom:10px;margin-bottom:10px;">' +
                '<div style="display:flex;justify-content:space-between;align-items:center;">' +
                '<strong style="font-size:16px;">' + unitName + String(r.num).padStart(2, '0') + '</strong>' +
                '<span class="pill ' + (curWin ? 'pill-win' : 'pill-loss') + '">' + r.res + '</span></div>' +
                '<div class="mono" style="color:#94A3B8;font-size:11px;margin-top:4px;">K/D/A: ' + r.kda + ' - ' + (isEn ? 'Damage: ' : 'Sát thương: ') + r.dmg + '</div></div>' +
                '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px;">' +
                '<span class="pill pill-eco">' + r.eco + '</span>' +
                '<span class="pill" style="background:#171D28;color:#EEF2F6;border:1px solid #334155;">' + r.style + '</span></div>' +
                '<h3 style="font-size:11px;color:#34d399;text-transform:uppercase;margin-bottom:6px;">' + (isEn ? 'Strengths' : 'Điểm làm tốt') + '</h3>';
              if (r.good.length) r.good.forEach(function(g){ bodyHtml += '<div class="callout-good">' + g + '</div>'; });
              else bodyHtml += '<p style="font-size:12px;color:#64748B;">' + (isEn ? 'No notable tactical spikes in this segment.' : 'Chưa ghi nhận điểm nhấn nổi bật ở đoạn này.') + '</p>';

              bodyHtml += '<h3 style="font-size:11px;color:#E59A23;text-transform:uppercase;margin:12px 0 6px;">' + (isEn ? 'Tactical Mistakes' : 'Lỗi chiến thuật cần sửa') + '</h3>';
              if (r.bad.length) r.bad.forEach(function(b){ bodyHtml += '<div class="callout-warn">' + b + '</div>'; });
              else bodyHtml += '<p style="font-size:12px;color:#64748B;">' + (isEn ? 'Clean positioning, zero critical mistakes.' : 'Giữ vị trí gọn gàng, không mắc lỗi nghiêm trọng.') + '</p>';
            } else if (state.tab === 'match') {
              var met = m.metrics;
              bodyHtml += '<div class="metrics-strip">' +
                '<div class="metric-box"><span class="metric-label">KAST</span><span class="metric-val" style="color:#10B981;">' + met.kast + '%</span></div>' +
                '<div class="metric-box"><span class="metric-label">ADR</span><span class="metric-val" style="color:#EEF2F6;">' + met.adr + '</span></div>' +
                '<div class="metric-box"><span class="metric-label">HS%</span><span class="metric-val" style="color:#38BDF8;">' + met.hs + '%</span></div>' +
                '<div class="metric-box"><span class="metric-label">IMP</span><span class="metric-val" style="color:#E59A23;">' + met.impact.toFixed(2) + '</span></div>' +
                '</div>' +
                buildInlineRadarSvg(met, isValo) +
                '<div style="padding:10px;background:#0A0D12;border:1px solid #232B3B;border-radius:2px;">' +
                '<div class="mono" style="color:#E59A23;font-size:11.5px;font-weight:700;">' + (isEn ? 'AI COACH RATING: ' : 'ĐIỂM AI COACH: ') + m.overallScore + ' / 10</div>' +
                '<p style="font-size:12px;margin:6px 0 0;">' + m.commentary + '</p></div>';
            } else {
              var p1 = isValo
                ? (isEn ? 'Ask: Why did we lose Force Buy rounds?' : 'Hỏi: Vì sao đội hay thua ở các round Force Buy?')
                : (isEn ? 'Ask: How can I improve Phase 4-5 circle rotations?' : 'Hỏi: Cách di chuyển bo Phase 4-5 hiệu quả hơn?');
              var p2 = isValo
                ? (isEn ? 'Ask: Analyze my positioning in Round ' : 'Hỏi: Phân tích vị trí của tôi ở Round ') + String(r.num).padStart(2, '0')
                : (isEn ? 'Ask: Review my weapon & smoke timing in Phase ' : 'Hỏi: Đánh giá súng và timing smoke ở Phase ') + String(r.num).padStart(2, '0');
              bodyHtml += '<div style="padding:10px;background:#0A0D12;border:1px solid #232B3B;border-radius:2px;margin-bottom:10px;font-size:12px;">' +
                state.coachReply + '</div>' +
                '<button type="button" class="match-btn" data-prompt="p1">' + p1 + '</button>' +
                '<button type="button" class="match-btn" data-prompt="p2">' + p2 + '</button>';
            }
            document.getElementById('inspectorBody').innerHTML = bodyHtml;

            document.querySelectorAll('[data-match]').forEach(function(btn) {
              btn.addEventListener('click', function() {
                state.matchIdx = Number(btn.getAttribute('data-match'));
                state.roundIdx = 0;
                state.shapes = [];
                state.pubgProgress = 100;
                stopPubgPlayback();
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
                if (isValo && p === 'p1') {
                  state.coachReply = isEn
                    ? '<strong>AI Coach:</strong> In Round 03 (Force Buy), your team averaged 2,400 credits against rifles. Dry-peeking Mid Catwalk resulted in an untraded death before utility landed.'
                    : '<strong>AI Coach:</strong> Ở Round 03 (Force Buy), lượng tiền trung bình chỉ khoảng 2.400 credits khi địch đã có súng dài. Pha tự mở góc Mid Catwalk khiến bạn chết lẻ trước khi có smoke hoặc flash che.';
                } else if (isValo) {
                  state.coachReply = isEn
                    ? '<strong>AI Coach (R' + String(r.num).padStart(2, '0') + '):</strong> Using ' + r.weapon + ' (' + r.dmg + ' DMG), prioritize holding crossfire angles so every early duel is tradable within 3 seconds.'
                    : '<strong>AI Coach (R' + String(r.num).padStart(2, '0') + '):</strong> Khi cầm ' + r.weapon + ' (' + r.dmg + ' sát thương), hãy giữ góc kê chéo cùng đồng đội để mọi pha đọ súng đều có thể đổi mạng trong 3 giây.';
                } else if (p === 'p1') {
                  state.coachReply = isEn
                    ? '<strong>AI Coach (PUBG):</strong> Rotate by vehicle within the first 45s of Phase 3 toward high-ground compounds near center circle, keeping at least 3 smoke grenades for Phase 5-6 foot pushes.'
                    : '<strong>AI Coach (PUBG):</strong> Hãy chạy xe chiếm khu nhà đồi cao gần tâm bo trong 45 giây đầu Phase 3, luôn giữ tối thiểu 3 quả smoke cho pha đẩy chân ở bo 5-6.';
                } else {
                  state.coachReply = isEn
                    ? '<strong>AI Coach (Phase ' + String(r.num).padStart(2, '0') + '):</strong> Strong ' + r.weapon + ' output (' + r.dmg + ' DMG). Pre-smoke choke points before peeking ridges to deny third-party DMR angles.'
                    : '<strong>AI Coach (Phase ' + String(r.num).padStart(2, '0') + '):</strong> Hiệu suất ' + r.weapon + ' tốt (' + r.dmg + ' sát thương). Hãy thả smoke trước khi băng qua vùng trống để chặn góc bắn DMR của đội thứ ba.';
                }
                render();
              });
            });
            drawStage();
          }

          document.querySelectorAll('[data-demo-game]').forEach(function(btn) {
            btn.addEventListener('click', function() {
              state.game = btn.getAttribute('data-demo-game');
              state.matchIdx = 0;
              state.roundIdx = 0;
              state.shapes = [];
              state.pubgProgress = 100;
              stopPubgPlayback();
              render();
            });
          });

          document.getElementById('pubgProgressSlider').addEventListener('input', function(e) {
            stopPubgPlayback();
            state.pubgProgress = Number(e.target.value);
            render();
          });

          document.getElementById('pubgPlayBtn').addEventListener('click', function() {
            if (state.pubgTimer) {
              stopPubgPlayback();
              return;
            }
            if (state.pubgProgress >= 100) state.pubgProgress = 10;
            this.textContent = isEn ? 'Pause' : 'Tạm dừng';
            state.pubgTimer = setInterval(function() {
              state.pubgProgress += 6;
              if (state.pubgProgress >= 100) {
                state.pubgProgress = 100;
                stopPubgPlayback();
              }
              render();
            }, 180);
          });

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
  `;

  res.send(
    renderPortalLayout({
      currentPath: '/demo',
      title: isEn ? 'Interactive Web Demo' : 'Dùng thử Web tương tác',
      bodyHtml,
      isEn,
      latestVersion: latest.version,
      extraHead: demoStyles,
    })
  );
});

// 4. GET /tools - Sensitivity Converter, Crosshair Lab & Public PUBG Lookup
router.get('/tools', async (req: Request, res: Response) => {
  const isEn = detectIsEnglish(req);
  const latest = await getLatestReleaseInfo();

  res.send(
    renderPortalLayout({
      currentPath: '/tools',
      title: isEn ? 'FPS Sens Converter & Crosshair Lab' : 'Quy đổi Sens & Tạo Tâm ngắm FPS',
      bodyHtml: renderToolsPageBody(isEn),
      isEn,
      latestVersion: latest.version,
      extraHead: toolsPageExtraStyles,
    })
  );
});

// 5. GET /changelog - Auto-Synced GitHub Releases History
router.get('/changelog', async (req: Request, res: Response) => {
  const isEn = detectIsEnglish(req);
  const releases = await getReleaseHistory();
  const latest = releases[0];

  const cardsHtml = releases
    .map((rel, idx) => {
      const dateStr = formatReleaseDate(rel.publishedAt, isEn);
      const latestPill =
        idx === 0
          ? `<span style="padding:3px 8px;border-radius:2px;background:rgba(16,185,129,0.16);border:1px solid rgba(16,185,129,0.4);color:#34D399;font-family:ui-monospace,monospace;font-size:10.5px;font-weight:700;">${
              isEn ? 'LATEST' : 'MỚI NHẤT'
            }</span>`
          : '';
      return `
        <article class="card" style="margin-bottom:16px;border-left:3px solid ${
          idx === 0 ? '#10B981' : '#334155'
        };">
          <div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:10px;border-bottom:1px solid #232B3B;padding-bottom:12px;margin-bottom:12px;">
            <div>
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                <h2 style="margin:0;font-size:19px;">${escapeHtml(rel.name)}</h2>
                <span class="mono" style="color:#38BDF8;">${escapeHtml(rel.tag)}</span>
                ${latestPill}
              </div>
              <div class="mono" style="color:#64748B;font-size:11px;margin-top:4px;">
                ${dateStr ? `${escapeHtml(dateStr)} | ` : ''}${escapeHtml(rel.fileName)} (${escapeHtml(rel.sizeMb)})
              </div>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <a class="btn-primary" style="padding:7px 13px;font-size:12px;" href="${escapeHtml(rel.downloadUrl)}">
                ${isEn ? `Download ${escapeHtml(rel.tag)}` : `Tải ${escapeHtml(rel.tag)}`}
              </a>
              <a class="btn-secondary" style="padding:7px 12px;font-size:12px;" href="${escapeHtml(rel.htmlUrl)}" target="_blank" rel="noreferrer">
                GitHub
              </a>
            </div>
          </div>
          <div>${renderReleaseMarkdownLite(rel.body)}</div>
        </article>
      `;
    })
    .join('\n');

  const bodyHtml = `
    <div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:flex-end;gap:14px;margin-bottom:22px;">
      <div>
        <span class="badge">${isEn ? 'LIVE RELEASE FEED - GITHUB RELEASES' : 'CẬP NHẬT TỰ ĐỘNG TỪ GITHUB RELEASES'}</span>
        <h1>${isEn ? 'Release Changelog &amp; Windows Builds' : 'Nhật ký Cập nhật &amp; Các phiên bản Windows'}</h1>
        <p style="max-width:64ch;margin:0;">
          ${
            isEn
              ? 'Every desktop build ships with silent background updates. Install the latest version below or review recent improvements.'
              : 'Mỗi phiên bản Desktop đều hỗ trợ tự tải ngầm và cập nhật chỉ với một nút khởi động lại. Tải bản mới nhất bên dưới.'
          }
        </p>
      </div>
      <a class="btn-primary" href="/download">
        ${isEn ? `Download Latest (v${escapeHtml(latest.version)})` : `Tải bản mới nhất (v${escapeHtml(latest.version)})`}
      </a>
    </div>
    ${cardsHtml}
  `;

  res.send(
    renderPortalLayout({
      currentPath: '/changelog',
      title: isEn ? 'Changelog & Releases' : 'Nhật ký cập nhật',
      bodyHtml,
      isEn,
      latestVersion: latest.version,
    })
  );
});

// 6. GET /privacy - Privacy Policy
router.get('/privacy', async (req: Request, res: Response) => {
  const isEn = detectIsEnglish(req);
  const latest = await getLatestReleaseInfo();

  const bodyHtml = isEn
    ? `
      <div class="card">
        <h1>Privacy Policy</h1>
        <p><strong>Effective Date:</strong> November 21, 2026</p>
        <p>TacticalReplayAI ("we", "our", or "the Application") is a public post-match coaching service for VALORANT and PUBG players. We respect your privacy and protect the account data of players who sign in voluntarily using Riot Sign On (RSO) or Steam.</p>

        <h2>1. Information We Collect</h2>
        <ul>
          <li><strong>Riot Account Identifiers (via RSO):</strong> Your Riot PUUID, Game Name, and Tag Line retrieved strictly after your explicit OAuth2 consent via Riot Sign On (<span class="mono">/riot/account/v1/accounts/me</span>).</li>
          <li><strong>Post-Match Statistics:</strong> Completed match history, round outcomes, weapon usage, and economy/telemetry summaries retrieved from official Riot Games APIs (<span class="mono">VAL-MATCH-V1</span>) or the official PUBG API solely for the signed-in account.</li>
          <li><strong>User-Uploaded Highlights &amp; Preferences:</strong> Replay clips voluntarily recorded locally via Overwolf or uploaded by you for personal post-match review, along with optional sensitivity/crosshair presets saved in your Sens Vault.</li>
        </ul>

        <h2>2. How We Use Your Information</h2>
        <p>Collected data is used exclusively to authenticate your session, display up to your 20 most recent completed matches, and generate post-match tactical coaching insights. We never display unauthenticated VALORANT player match histories, never calculate hidden MMR, and never sell or share your account data with third-party advertisers.</p>

        <h2>3. Data Retention &amp; Deletion</h2>
        <p>We store only a rolling window of your 20 most recent unpinned matches; older match records and associated highlight files are automatically purged. You may disconnect your Riot account or request complete deletion of your stored profile and match records at any time by contacting <strong>kietthanh080@gmail.com</strong>.</p>
      </div>
    `
    : `
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
        <p>Hệ thống chỉ duy trì bộ đệm xoay vòng tối đa 20 trận gần nhất (không tính các trận bạn chủ động ghim); các trận cũ hơn cùng tệp liên quan sẽ được tự động dọn dẹp. Bạn có thể hủy liên kết tài khoản Riot ngay trong ứng dụng hoặc gửi yêu cầu xóa hoàn toàn hồ sơ và dữ liệu trận đấu bất kỳ lúc nào qua email <strong>kietthanh080@gmail.com</strong>.</p>
      </div>
    `;

  res.send(
    renderPortalLayout({
      currentPath: '/privacy',
      title: isEn ? 'Privacy Policy' : 'Chính sách bảo mật',
      bodyHtml,
      isEn,
      latestVersion: latest.version,
    })
  );
});

// 7. GET /terms - Terms of Service
router.get('/terms', async (req: Request, res: Response) => {
  const isEn = detectIsEnglish(req);
  const latest = await getLatestReleaseInfo();

  const bodyHtml = isEn
    ? `
      <div class="card">
        <h1>Terms of Service</h1>
        <p><strong>Effective Date:</strong> November 21, 2026</p>
        <p>By accessing or using TacticalReplayAI, you agree to these Terms of Service and all applicable Riot Games and PUBG developer and player policies.</p>

        <h2>1. Permitted Use</h2>
        <p>TacticalReplayAI is a free, public, non-commercial post-match coaching and gameplay review service for the VALORANT and PUBG community. You agree not to misuse the service, scrape API endpoints, or attempt to access other players' private data without RSO authorization.</p>

        <h2>2. Fair Play &amp; Anti-Cheat Compliance</h2>
        <p>The Application operates strictly outside active competitive gameplay (Post-Match Only) and provides no real-time overlays, pre-game scouting, item store checking, enemy tracking, or automated inputs. Users must comply with the Riot Games Terms of Service, Vanguard, and BattlEye anti-cheat rules at all times.</p>

        <h2>3. Disclaimer &amp; Limitation of Liability</h2>
        <p>The service is provided "as is" without warranties of any kind. TacticalReplayAI is an independent community project and is not affiliated with, sponsored, or endorsed by Riot Games, Inc. or KRAFTON, Inc.</p>
      </div>
    `
    : `
      <div class="card">
        <h1>Điều khoản dịch vụ</h1>
        <p><strong>Ngày có hiệu lực:</strong> 21/11/2026</p>
        <p>Khi truy cập hoặc sử dụng TacticalReplayAI, bạn đồng ý tuân thủ các Điều khoản dịch vụ này cùng toàn bộ chính sách dành cho nhà phát triển và người chơi của Riot Games &amp; PUBG Corporation.</p>

        <h2>1. Phạm vi sử dụng hợp lệ</h2>
        <p>TacticalReplayAI là dự án cộng đồng phi thương mại, miễn phí, phục vụ xem lại video và phân tích chiến thuật sau trận đấu. Bạn cam kết không lạm dụng hệ thống, không thu thập dữ liệu trái phép (scraping API) và không tìm cách truy cập dữ liệu riêng tư của người chơi khác khi chưa được ủy quyền qua RSO.</p>

        <h2>2. Tuân thủ Fair Play &amp; Anti-Cheat</h2>
        <p>Ứng dụng chỉ hoạt động ngoài trận đấu thực tế (Post-Match Only): không chèn overlay gian lận khi đang đấu, không soi thông tin đối thủ trước khi vào trận, không kiểm tra shop vật phẩm, không đọc bộ nhớ tiến trình game và không can thiệp thao tác chuột/bàn phím. Người dùng phải luôn tuân thủ quy tắc Vanguard và BattlEye.</p>

        <h2>3. Miễn trừ trách nhiệm</h2>
        <p>Dịch vụ được cung cấp theo nguyên trạng ("as is"). TacticalReplayAI là dự án cộng đồng độc lập và không thuộc sở hữu, tài trợ hay chứng thực bởi Riot Games, Inc. hay KRAFTON, Inc.</p>
      </div>
    `;

  res.send(
    renderPortalLayout({
      currentPath: '/terms',
      title: isEn ? 'Terms of Service' : 'Điều khoản dịch vụ',
      bodyHtml,
      isEn,
      latestVersion: latest.version,
    })
  );
});

export default router;

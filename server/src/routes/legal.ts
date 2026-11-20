import { Router, Request, Response } from 'express';

const router = Router();

const baseStyles = `
  body {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: #020617;
    color: #e2e8f0;
    line-height: 1.65;
  }
  .container {
    max-width: 820px;
    margin: 0 auto;
    padding: 48px 24px;
  }
  header {
    border-bottom: 1px solid #1e293b;
    padding-bottom: 20px;
    margin-bottom: 32px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px;
  }
  .brand {
    font-size: 20px;
    font-weight: 800;
    color: #ffffff;
    text-decoration: none;
  }
  .brand span { color: #ff4655; }
  nav a {
    color: #94a3b8;
    text-decoration: none;
    margin-left: 18px;
    font-size: 14px;
    font-weight: 600;
  }
  nav a:hover { color: #ffffff; }
  h1 { color: #ffffff; font-size: 30px; margin-bottom: 8px; }
  h2 { color: #f8fafc; font-size: 19px; margin-top: 28px; }
  p, li { color: #cbd5e1; font-size: 15px; }
  .badge {
    display: inline-block;
    padding: 4px 12px;
    border-radius: 999px;
    background: rgba(16, 185, 129, 0.12);
    border: 1px solid rgba(16, 185, 129, 0.3);
    color: #34d399;
    font-size: 12px;
    font-weight: 700;
    margin-bottom: 16px;
  }
  .card {
    background: #0f172a;
    border: 1px solid #1e293b;
    border-radius: 14px;
    padding: 24px;
    margin-top: 24px;
  }
  footer {
    margin-top: 56px;
    padding-top: 24px;
    border-top: 1px solid #1e293b;
    font-size: 13px;
    color: #64748b;
  }
`;

const layout = (title: string, bodyHtml: string) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} - TacticalReplayAI</title>
  <style>${baseStyles}</style>
</head>
<body>
  <div class="container">
    <header>
      <a class="brand" href="/">TacticalReplay<span>AI</span></a>
      <nav>
        <a href="/">Home</a>
        <a href="/privacy">Privacy Policy</a>
        <a href="/terms">Terms of Service</a>
      </nav>
    </header>
    ${bodyHtml}
    <footer>
      <p>TacticalReplayAI isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc.</p>
    </footer>
  </div>
</body>
</html>`;

// 1. GET / — Trang giới thiệu ứng dụng cho Riot Reviewer
router.get('/', (_req: Request, res: Response) => {
  res.send(
    layout(
      'Post-Match Tactical Analysis',
      `
      <span class="badge">Vanguard Compliant • Post-Match Only</span>
      <h1>Post-Match Video Replay &amp; Tactical Analysis for VALORANT</h1>
      <p>TacticalReplayAI is a desktop coaching companion designed to help players review their completed matches, analyze round-by-round economy decisions, and synchronize local highlight clips with official post-match statistics.</p>
      <div class="card">
        <h2>Fair Play &amp; Riot Policy Compliance</h2>
        <ul>
          <li><strong>Zero In-Game Advantage:</strong> All tactical reports and economy breakdowns are generated strictly after a match concludes.</li>
          <li><strong>No Memory Reading:</strong> Uses only official Riot Games APIs (Riot Sign On &amp; Match-v1) and compliant screen-capture frameworks.</li>
          <li><strong>Player-Controlled Data:</strong> Players authenticate voluntarily via Riot Sign On and can revoke access or request data deletion at any time.</li>
        </ul>
      </div>
      `
    )
  );
});

// 2. GET /privacy — Chính sách bảo mật (Privacy Policy)
router.get('/privacy', (_req: Request, res: Response) => {
  res.send(
    layout(
      'Privacy Policy',
      `
      <h1>Privacy Policy</h1>
      <p><strong>Effective Date:</strong> November 21, 2026</p>
      <p>TacticalReplayAI ("we", "our", or "the Application") respects your privacy and is committed to protecting the personal data of players who sign in using Riot Sign On (RSO).</p>

      <h2>1. Information We Collect</h2>
      <ul>
        <li><strong>Riot Account Identifiers:</strong> Your Riot PUUID, Game Name, and Tag Line obtained with your explicit consent via Riot Sign On.</li>
        <li><strong>Post-Match Statistics:</strong> Publicly accessible match history, round outcomes, weapon usage, and economy summaries retrieved from official Riot Games APIs.</li>
        <li><strong>User-Uploaded Highlights:</strong> Replay clips voluntarily recorded or uploaded by you for personal post-match review.</li>
      </ul>

      <h2>2. How We Use Your Information</h2>
      <p>Collected data is used exclusively to authenticate your desktop session, display your recent 20 matches, and generate personalized post-match tactical coaching insights. We never sell, rent, or share your account data with third-party advertisers.</p>

      <h2>3. Data Retention &amp; Deletion</h2>
      <p>We store only your 20 most recent matches per game mode; older match records are automatically purged. You may disconnect your Riot account or request complete deletion of your stored profile and match records at any time by contacting <strong>support@tacticalreplay.ai</strong>.</p>
      `
    )
  );
});

// 3. GET /terms — Điều khoản sử dụng (Terms of Service)
router.get('/terms', (_req: Request, res: Response) => {
  res.send(
    layout(
      'Terms of Service',
      `
      <h1>Terms of Service</h1>
      <p><strong>Effective Date:</strong> November 21, 2026</p>
      <p>By accessing or using TacticalReplayAI, you agree to be bound by these Terms of Service and all applicable Riot Games developer and player policies.</p>

      <h2>1. Permitted Use</h2>
      <p>TacticalReplayAI is provided solely for personal, non-commercial post-match analysis and educational gameplay improvement. You agree not to misuse the service, scrape API endpoints, or attempt to access other players' private data without authorization.</p>

      <h2>2. Fair Play &amp; Anti-Cheat Compliance</h2>
      <p>The Application operates strictly outside active competitive gameplay and provides no real-time overlays, enemy tracking, or automated inputs. Users must comply with the Riot Games Terms of Service and Vanguard anti-cheat rules at all times.</p>

      <h2>3. Disclaimer &amp; Limitation of Liability</h2>
      <p>The service is provided "as is" without warranties of any kind. TacticalReplayAI is an independent community project and is not affiliated with, sponsored, or endorsed by Riot Games, Inc.</p>
      `
    )
  );
});

export default router;
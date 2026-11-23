import crypto from 'crypto';
import https from 'https';
import { Router, Request, Response, NextFunction } from 'express';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { dbPool, ensureAuthSessionsTable, ensureFeatureTables } from '../config/db';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'tactical_replay_secret';
const steamHttpsAgent = new https.Agent({ family: 4 });

export interface AuthUserPayload {
  userId: number;
  puuid?: string;
  steamId?: string;
  riotGameName?: string;
  riotTagLine?: string;
}

export interface AuthRequest extends Request {
  user?: AuthUserPayload;
}

interface OAuthStatePayload {
  provider: 'riot' | 'steam';
  returnTo: string;
  linkUserId?: number;
  sessionId?: string;
  nonce: string;
}

export function isConfiguredEnv(value?: string): boolean {
  const trimmed = String(value || '').trim();
  if (!trimmed) return false;
  if (/^your_/i.test(trimmed)) return false;
  if (/placeholder|example/i.test(trimmed)) return false;
  return true;
}

export function isRiotRsoConfigured(): boolean {
  const redirectUri = String(process.env.RIOT_REDIRECT_URI || '').trim();
  return (
    isConfiguredEnv(process.env.RIOT_CLIENT_ID) &&
    isConfiguredEnv(process.env.RIOT_CLIENT_SECRET) &&
    isConfiguredEnv(redirectUri) &&
    /^https?:\/\//i.test(redirectUri)
  );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getDefaultClientUrl(): string {
  const origin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
  return `${origin.replace(/\/$/, '')}/index.html`;
}

function isSafeRedirectTarget(target: string): boolean {
  if (!target) return false;
  if (target === 'electron' || target === 'poll') return true;
  if (
    target.startsWith('http://localhost:') ||
    target.startsWith('http://127.0.0.1:') ||
    target.startsWith('overwolf-extension://')
  ) {
    return true;
  }
  const clientOrigin = process.env.CLIENT_ORIGIN?.trim();
  return Boolean(clientOrigin && target.startsWith(clientOrigin));
}

function sanitizeSessionId(raw: unknown): string | undefined {
  const val = String(raw || '').trim();
  if (!val) return undefined;
  return /^[a-zA-Z0-9_-]{16,64}$/.test(val) ? val : undefined;
}

function signOAuthState(payload: Omit<OAuthStatePayload, 'nonce'>): string {
  return jwt.sign(
    {
      ...payload,
      nonce: crypto.randomBytes(16).toString('hex'),
    },
    JWT_SECRET,
    { expiresIn: '10m' }
  );
}

function verifyOAuthState(
  rawState: unknown,
  expectedProvider: 'riot' | 'steam'
): OAuthStatePayload | null {
  if (typeof rawState !== 'string' || !rawState.trim()) return null;
  try {
    const decoded = jwt.verify(rawState, JWT_SECRET) as OAuthStatePayload;
    if (decoded?.provider !== expectedProvider) return null;
    return {
      provider: decoded.provider,
      returnTo: isSafeRedirectTarget(decoded.returnTo)
        ? decoded.returnTo
        : getDefaultClientUrl(),
      linkUserId:
        typeof decoded.linkUserId === 'number' && decoded.linkUserId > 0
          ? decoded.linkUserId
          : undefined,
      sessionId: sanitizeSessionId(decoded.sessionId),
      nonce: String(decoded.nonce || ''),
    };
  } catch {
    return null;
  }
}

async function saveAuthSessionResult(
  sessionId: string | undefined,
  result: { token?: string; error?: string }
): Promise<void> {
  if (!sessionId) return;
  try {
    await ensureAuthSessionsTable();
    await dbPool.query('DELETE FROM auth_sessions WHERE expires_at < NOW()');
    await dbPool.query(
      `INSERT INTO auth_sessions (session_id, token, error_message, expires_at)
       VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE))
       ON DUPLICATE KEY UPDATE
         token = VALUES(token),
         error_message = VALUES(error_message),
         expires_at = VALUES(expires_at)`,
      [sessionId, result.token || null, result.error || null]
    );
  } catch (err) {
    console.warn('Không thể lưu trạng thái phiên đăng nhập:', err);
  }
}

function renderAuthStatusHtml(options: {
  success: boolean;
  title: string;
  message: string;
  deepLink?: string;
  autoRedirect?: boolean;
}): string {
  const accent = options.success ? '#10b981' : '#f43f5e';
  const badgeText = options.success ? 'AUTHENTICATED' : 'AUTH ERROR';
  const buttonHtml = options.deepLink
    ? `<a href="${escapeHtml(options.deepLink)}" style="display:inline-block;margin-top:18px;padding:12px 24px;background:${accent};color:#020617;font-weight:700;border-radius:10px;text-decoration:none;font-size:14px;">Mở lại TacticalReplayAI</a>`
    : `<p style="margin-top:18px;font-size:13px;color:#64748b;">Bạn có thể đóng tab trình duyệt này và quay lại ứng dụng <b>TacticalReplayAI</b>.</p>`;
  const scriptHtml =
    options.deepLink && options.autoRedirect
      ? `<script>window.location.href = ${JSON.stringify(options.deepLink)};</script>`
      : '';

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(options.title)} - TacticalReplayAI</title>
</head>
<body style="background:#020617;color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:20px;">
  <div style="text-align:center;max-width:460px;width:100%;padding:32px;background:#0f172a;border:1px solid #1e293b;border-radius:16px;box-shadow:0 25px 50px -12px rgba(0,0,0,0.5);">
    <span style="display:inline-block;padding:4px 10px;border-radius:999px;font-size:11px;font-weight:800;letter-spacing:0.06em;background:rgba(255,255,255,0.06);color:${accent};margin-bottom:12px;">${badgeText}</span>
    <h2 style="margin:0 0 10px;font-size:22px;">${escapeHtml(options.title)}</h2>
    <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:0;">${escapeHtml(options.message)}</p>
    ${buttonHtml}
  </div>
  ${scriptHtml}
</body>
</html>`;
}

async function completeAuthRedirect(
  req: Request,
  res: Response,
  options: {
    returnTo: string;
    sessionId?: string;
    token?: string;
    errorMessage?: string;
    providerLabel: string;
  }
): Promise<void> {
  const { returnTo, sessionId, token, errorMessage, providerLabel } = options;

  await saveAuthSessionResult(sessionId, {
    token,
    error: errorMessage,
  });

  if (errorMessage) {
    if (returnTo !== 'electron' && returnTo !== 'poll' && isSafeRedirectTarget(returnTo)) {
      const sep = returnTo.includes('?') ? '&' : '?';
      res.redirect(`${returnTo}${sep}authError=${encodeURIComponent(errorMessage)}`);
      return;
    }

    res.status(400).send(
      renderAuthStatusHtml({
        success: false,
        title: `Đăng nhập ${providerLabel} chưa hoàn tất`,
        message: errorMessage,
      })
    );
    return;
  }

  const serverOrigin = `${req.protocol}://${req.get('host')}`;

  if (returnTo === 'electron') {
    res.redirect(`${serverOrigin}/api/auth/desktop-callback?token=${encodeURIComponent(token || '')}`);
    return;
  }

  if (returnTo === 'poll') {
    res.send(
      renderAuthStatusHtml({
        success: true,
        title: `Đăng nhập ${providerLabel} thành công!`,
        message: 'Hệ thống đã xác thực tài khoản của bạn. Hãy quay lại cửa sổ ứng dụng TacticalReplayAI.',
      })
    );
    return;
  }

  const target = isSafeRedirectTarget(returnTo) ? returnTo : getDefaultClientUrl();
  const separator = target.includes('?') ? '&' : '?';
  res.redirect(`${target}${separator}token=${encodeURIComponent(token || '')}`);
}

function signUserJwt(user: {
  id: number;
  riot_puuid?: string | null;
  steam_id?: string | null;
  riot_game_name?: string | null;
  riot_tag_line?: string | null;
}): string {
  const payload: AuthUserPayload = {
    userId: user.id,
  };
  if (user.riot_puuid) payload.puuid = user.riot_puuid;
  if (user.steam_id) payload.steamId = user.steam_id;
  if (user.riot_game_name) payload.riotGameName = user.riot_game_name;
  if (user.riot_tag_line) payload.riotTagLine = user.riot_tag_line;

  return jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });
}

async function fetchRiotAccountMe(accessToken: string): Promise<{
  puuid: string;
  gameName: string;
  tagLine: string;
}> {
  const preferredCluster = (process.env.RIOT_ACCOUNT_CLUSTER || 'asia').trim().toLowerCase();
  const clusters = Array.from(new Set([preferredCluster, 'asia', 'americas', 'europe']));

  let lastError: unknown = null;
  for (const cluster of clusters) {
    try {
      const accountRes = await axios.get(
        `https://${cluster}.api.riotgames.com/riot/account/v1/accounts/me`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          timeout: 10000,
        }
      );
      if (accountRes.data?.puuid) {
        return {
          puuid: String(accountRes.data.puuid),
          gameName: String(accountRes.data.gameName || 'RiotPlayer'),
          tagLine: String(accountRes.data.tagLine || '0000'),
        };
      }
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('Không thể lấy thông tin tài khoản từ Riot Account API.');
}

export async function refreshRiotAccessToken(userId: number): Promise<string | null> {
  if (!isRiotRsoConfigured()) return null;

  const [rows] = await dbPool.query<RowDataPacket[]>(
    'SELECT riot_refresh_token FROM users WHERE id = ? LIMIT 1',
    [userId]
  );
  const refreshToken = rows[0]?.riot_refresh_token;
  if (!refreshToken) return null;

  try {
    const basicAuth = Buffer.from(
      `${process.env.RIOT_CLIENT_ID}:${process.env.RIOT_CLIENT_SECRET}`
    ).toString('base64');

    const tokenRes = await axios.post(
      'https://auth.riotgames.com/token',
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: String(refreshToken),
      }),
      {
        headers: {
          Authorization: `Basic ${basicAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 10000,
      }
    );

    const newAccessToken = tokenRes.data?.access_token;
    const newRefreshToken = tokenRes.data?.refresh_token || refreshToken;
    if (!newAccessToken) return null;

    await dbPool.query(
      'UPDATE users SET riot_access_token = ?, riot_refresh_token = ? WHERE id = ?',
      [newAccessToken, newRefreshToken, userId]
    );
    return String(newAccessToken);
  } catch (err) {
    console.warn('Không thể làm mới Riot RSO token:', err);
    return null;
  }
}

router.get('/desktop-callback', (req: Request, res: Response) => {
  const token = String(req.query.token || '');
  const deepLink = `tacticalreplay://auth?token=${encodeURIComponent(token)}`;

  res.send(
    renderAuthStatusHtml({
      success: true,
      title: 'Đăng nhập thành công!',
      message:
        'Đang chuyển hướng về ứng dụng TacticalReplayAI. Nếu trình duyệt không tự chuyển, hãy bấm nút bên dưới hoặc quay lại cửa sổ ứng dụng.',
      deepLink,
      autoRedirect: true,
    })
  );
});

export function authenticateToken(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'Vui lòng đăng nhập để sử dụng tính năng này.' });
    return;
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err || !decoded || typeof decoded === 'string') {
      res.status(403).json({ error: 'Phiên đăng nhập hết hạn, vui lòng đăng nhập lại.' });
      return;
    }
    req.user = decoded as AuthUserPayload;
    next();
  });
}

// ============================================================================
// 0. TRẠNG THÁI CÁC NHÀ CUNG CẤP ĐĂNG NHẬP & POLLING CHO DESKTOP/OVERWOLF
// ============================================================================
router.get('/providers', (_req: Request, res: Response) => {
  res.json({
    riotRsoReady: isRiotRsoConfigured(),
    riotApiReady: isConfiguredEnv(process.env.RIOT_API_KEY),
    steamReady: true,
  });
});

router.get('/session/:sessionId', async (req: Request, res: Response) => {
  const sessionId = sanitizeSessionId(req.params.sessionId);
  if (!sessionId) {
    res.status(400).json({ error: 'Mã phiên đăng nhập không hợp lệ.' });
    return;
  }

  try {
    await ensureAuthSessionsTable();
    await dbPool.query('DELETE FROM auth_sessions WHERE expires_at < NOW()');

    const [rows] = await dbPool.query<RowDataPacket[]>(
      `SELECT token, error_message
       FROM auth_sessions
       WHERE session_id = ? AND expires_at >= NOW()
       LIMIT 1`,
      [sessionId]
    );

    if (rows.length === 0) {
      res.json({ status: 'pending' });
      return;
    }

    const row = rows[0];
    await dbPool.query('DELETE FROM auth_sessions WHERE session_id = ?', [sessionId]);

    if (row.error_message) {
      res.json({ status: 'error', error: String(row.error_message) });
      return;
    }

    if (row.token) {
      res.json({ status: 'completed', token: String(row.token) });
      return;
    }

    res.json({ status: 'pending' });
  } catch (err) {
    console.error('Lỗi kiểm tra auth session:', err);
    res.status(500).json({ error: 'Không thể kiểm tra trạng thái đăng nhập.' });
  }
});

// ============================================================================
// 1. ĐĂNG NHẬP / LIÊN KẾT BẰNG STEAM (STEAM OPENID 2.0)
// ============================================================================
function buildSteamAuthorizeUrl(req: Request, stateToken: string): string {
  const serverOrigin = `${req.protocol}://${req.get('host')}`;
  const callbackUrl = `${serverOrigin}/api/auth/steam/callback?state=${encodeURIComponent(
    stateToken
  )}`;

  const params = new URLSearchParams({
    'openid.ns': 'http://specs.openid.net/auth/2.0',
    'openid.mode': 'checkid_setup',
    'openid.return_to': callbackUrl,
    'openid.realm': serverOrigin,
    'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
    'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select',
  });

  return `https://steamcommunity.com/openid/login?${params.toString()}`;
}

router.get('/steam/login', (req: Request, res: Response) => {
  const rawReturnTo = String(req.query.returnTo || '');
  const clientReturnTo = isSafeRedirectTarget(rawReturnTo) ? rawReturnTo : getDefaultClientUrl();
  const sessionId = sanitizeSessionId(req.query.sessionId);

  const stateToken = signOAuthState({
    provider: 'steam',
    returnTo: clientReturnTo,
    sessionId,
  });

  res.redirect(buildSteamAuthorizeUrl(req, stateToken));
});

router.post('/steam/link-session', authenticateToken, (req: AuthRequest, res: Response) => {
  const rawReturnTo = String(req.body?.returnTo || '');
  const clientReturnTo = isSafeRedirectTarget(rawReturnTo) ? rawReturnTo : getDefaultClientUrl();
  const sessionId = sanitizeSessionId(req.body?.sessionId);

  const stateToken = signOAuthState({
    provider: 'steam',
    returnTo: clientReturnTo,
    linkUserId: req.user?.userId,
    sessionId,
  });

  res.json({ authUrl: buildSteamAuthorizeUrl(req, stateToken) });
});

router.get('/steam/callback', async (req: Request, res: Response) => {
  const stateObj = verifyOAuthState(req.query.state, 'steam');
  const fallbackReturnTo = String(req.query.returnTo || '');
  const returnTo =
    stateObj?.returnTo ||
    (isSafeRedirectTarget(fallbackReturnTo) ? fallbackReturnTo : getDefaultClientUrl());
  const sessionId = stateObj?.sessionId;

  try {
    const verifyParams = new URLSearchParams();
    for (const [key, value] of Object.entries(req.query)) {
      if (key.startsWith('openid.') && typeof value === 'string') {
        verifyParams.append(key, value);
      }
    }
    verifyParams.set('openid.mode', 'check_authentication');

    const verifyRes = await axios.post(
      'https://steamcommunity.com/openid/login',
      verifyParams.toString(),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        httpsAgent: steamHttpsAgent,
        timeout: 10000,
      }
    );

    const isValid =
      typeof verifyRes.data === 'string' && verifyRes.data.includes('is_valid:true');

    if (!isValid) {
      await completeAuthRedirect(req, res, {
        returnTo,
        sessionId,
        providerLabel: 'Steam',
        errorMessage: 'Mã xác thực Steam đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.',
      });
      return;
    }

    const claimedId = String(req.query['openid.claimed_id'] || '');
    const idMatch = claimedId.match(/^https?:\/\/steamcommunity\.com\/openid\/id\/(\d+)$/);
    const steamId = idMatch ? idMatch[1] : null;

    if (!steamId) {
      await completeAuthRedirect(req, res, {
        returnTo,
        sessionId,
        providerLabel: 'Steam',
        errorMessage: 'Không lấy được SteamID từ phản hồi của Steam.',
      });
      return;
    }

    let personaName = `Steam_${steamId.slice(-5)}`;
    let avatarUrl = '';
    try {
      const profileXmlRes = await axios.get(
        `https://steamcommunity.com/profiles/${steamId}/?xml=1`,
        { httpsAgent: steamHttpsAgent, timeout: 6000 }
      );
      const xml = String(profileXmlRes.data || '');
      const nameMatch = xml.match(/<steamID><!\[CDATA\[(.*?)\]\]><\/steamID>/);
      const avatarMatch = xml.match(/<avatarFull><!\[CDATA\[(.*?)\]\]><\/avatarFull>/);
      if (nameMatch?.[1]) personaName = nameMatch[1];
      if (avatarMatch?.[1]) avatarUrl = avatarMatch[1];
    } catch {
      // Bỏ qua nếu hồ sơ Steam đặt ở chế độ riêng tư
    }

    let targetUserId: number;

    if (stateObj?.linkUserId) {
      const [existingSteamRows] = await dbPool.query<RowDataPacket[]>(
        'SELECT id, riot_puuid FROM users WHERE steam_id = ? LIMIT 1',
        [steamId]
      );
      const conflict = existingSteamRows[0];
      if (conflict && Number(conflict.id) !== stateObj.linkUserId) {
        const [matchCountRows] = await dbPool.query<RowDataPacket[]>(
          'SELECT COUNT(*) AS cnt FROM matches WHERE user_id = ?',
          [conflict.id]
        );
        const isEmptyStub = !conflict.riot_puuid && Number(matchCountRows[0]?.cnt || 0) === 0;
        if (isEmptyStub) {
          await dbPool.query('DELETE FROM users WHERE id = ?', [conflict.id]);
        } else {
          await completeAuthRedirect(req, res, {
            returnTo,
            sessionId,
            providerLabel: 'Steam',
            errorMessage: 'Tài khoản Steam này đã được liên kết với một hồ sơ khác.',
          });
          return;
        }
      }

      await dbPool.query(
        `UPDATE users
         SET steam_id = ?, steam_persona_name = ?, steam_avatar = ?
         WHERE id = ?`,
        [steamId, personaName, avatarUrl, stateObj.linkUserId]
      );
      targetUserId = stateObj.linkUserId;
    } else {
      await dbPool.query<ResultSetHeader>(
        `INSERT INTO users (steam_id, steam_persona_name, steam_avatar)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE
           steam_persona_name = VALUES(steam_persona_name),
           steam_avatar = VALUES(steam_avatar)`,
        [steamId, personaName, avatarUrl]
      );

      const [rows] = await dbPool.query<RowDataPacket[]>(
        'SELECT id FROM users WHERE steam_id = ? LIMIT 1',
        [steamId]
      );
      targetUserId = Number(rows[0].id);
    }

    const [userRows] = await dbPool.query<RowDataPacket[]>(
      `SELECT id, riot_puuid, steam_id, riot_game_name, riot_tag_line
       FROM users WHERE id = ? LIMIT 1`,
      [targetUserId]
    );

    const appToken = signUserJwt(userRows[0] as any);
    await completeAuthRedirect(req, res, {
      returnTo,
      sessionId,
      token: appToken,
      providerLabel: 'Steam',
    });
  } catch (error: any) {
    console.error('Lỗi xác thực Steam OpenID:', error);
    await completeAuthRedirect(req, res, {
      returnTo,
      sessionId,
      providerLabel: 'Steam',
      errorMessage: error?.message || 'Không thể đăng nhập bằng tài khoản Steam.',
    });
  }
});

// ============================================================================
// 2. ĐĂNG NHẬP & LIÊN KẾT BẰNG RIOT SIGN ON (RSO) CHÍNH THỨC
// ============================================================================
function buildRiotAuthorizeUrl(stateToken: string, forceLoginPrompt = false): string {
  const params = new URLSearchParams({
    client_id: String(process.env.RIOT_CLIENT_ID || '').trim(),
    redirect_uri: String(process.env.RIOT_REDIRECT_URI || '').trim(),
    response_type: 'code',
    scope: 'openid offline_access',
    state: stateToken,
  });

  if (forceLoginPrompt) {
    params.set('prompt', 'login');
  }

  return `https://auth.riotgames.com/authorize?${params.toString()}`;
}

router.get('/riot/login', async (req: Request, res: Response) => {
  const rawReturnTo = String(req.query.returnTo || '');
  const clientReturnTo = isSafeRedirectTarget(rawReturnTo) ? rawReturnTo : getDefaultClientUrl();
  const sessionId = sanitizeSessionId(req.query.sessionId);

  if (!isRiotRsoConfigured()) {
    await completeAuthRedirect(req, res, {
      returnTo: clientReturnTo,
      sessionId,
      providerLabel: 'Riot Sign On',
      errorMessage:
        'Máy chủ chưa có RIOT_CLIENT_ID / RIOT_CLIENT_SECRET chính thức từ Riot Developer Portal (hiện vẫn đang là giá trị mẫu).',
    });
    return;
  }

  const stateToken = signOAuthState({
    provider: 'riot',
    returnTo: clientReturnTo,
    sessionId,
  });

  const forceLoginPrompt = req.query.prompt === 'login';
  res.redirect(buildRiotAuthorizeUrl(stateToken, forceLoginPrompt));
});

router.post('/riot/link-session', authenticateToken, (req: AuthRequest, res: Response) => {
  if (!isRiotRsoConfigured()) {
    res.status(503).json({
      error:
        'Máy chủ chưa cấu hình RIOT_CLIENT_ID / RIOT_CLIENT_SECRET chính thức từ Riot Developer Portal.',
    });
    return;
  }

  const rawReturnTo = String(req.body?.returnTo || '');
  const clientReturnTo = isSafeRedirectTarget(rawReturnTo) ? rawReturnTo : getDefaultClientUrl();
  const sessionId = sanitizeSessionId(req.body?.sessionId);
  const forceLoginPrompt = Boolean(req.body?.promptLogin);

  const stateToken = signOAuthState({
    provider: 'riot',
    returnTo: clientReturnTo,
    linkUserId: req.user?.userId,
    sessionId,
  });

  res.json({ authUrl: buildRiotAuthorizeUrl(stateToken, forceLoginPrompt) });
});

router.post('/riot/unlink', authenticateToken, async (req: AuthRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ error: 'Phiên đăng nhập không hợp lệ.' });
    return;
  }

  try {
    const [rows] = await dbPool.query<RowDataPacket[]>(
      'SELECT id, steam_id FROM users WHERE id = ? LIMIT 1',
      [userId]
    );
    const user = rows[0];
    if (!user) {
      res.status(404).json({ error: 'Không tìm thấy tài khoản.' });
      return;
    }

    if (!user.steam_id) {
      res.status(400).json({
        error: 'Cần liên kết Steam trước khi hủy liên kết Riot để tránh mất quyền truy cập tài khoản.',
      });
      return;
    }

    await dbPool.query(
      `UPDATE users
       SET riot_puuid = NULL,
           riot_game_name = NULL,
           riot_tag_line = NULL,
           riot_access_token = NULL,
           riot_refresh_token = NULL
       WHERE id = ?`,
      [userId]
    );

    const newToken = signUserJwt({ id: user.id, steam_id: user.steam_id });
    res.json({ token: newToken, message: 'Đã hủy liên kết tài khoản Riot.' });
  } catch (err) {
    console.error('Lỗi hủy liên kết Riot:', err);
    res.status(500).json({ error: 'Không thể hủy liên kết tài khoản Riot lúc này.' });
  }
});

router.get('/riot/callback', async (req: Request, res: Response) => {
  const stateObj = verifyOAuthState(req.query.state, 'riot');
  const returnTo = stateObj?.returnTo || 'poll';
  const sessionId = stateObj?.sessionId;

  const oauthError = String(req.query.error || '');
  if (oauthError) {
    const desc = String(req.query.error_description || oauthError);
    await completeAuthRedirect(req, res, {
      returnTo,
      sessionId,
      providerLabel: 'Riot Sign On',
      errorMessage:
        oauthError === 'access_denied'
          ? 'Bạn đã hủy bước cấp quyền đăng nhập Riot Sign On.'
          : `Riot Sign On từ chối yêu cầu: ${desc}`,
    });
    return;
  }

  if (!stateObj) {
    res.status(400).send(
      renderAuthStatusHtml({
        success: false,
        title: 'Phiên xác thực Riot không hợp lệ',
        message:
          'Liên kết đăng nhập đã hết hạn (quá 10 phút) hoặc không hợp lệ. Vui lòng quay lại ứng dụng TacticalReplayAI và bấm đăng nhập lại.',
      })
    );
    return;
  }

  if (!isRiotRsoConfigured()) {
    await completeAuthRedirect(req, res, {
      returnTo,
      sessionId,
      providerLabel: 'Riot Sign On',
      errorMessage: 'Máy chủ chưa được cấu hình đầy đủ Riot Sign On.',
    });
    return;
  }

  const code = String(req.query.code || '').trim();
  if (!code) {
    await completeAuthRedirect(req, res, {
      returnTo,
      sessionId,
      providerLabel: 'Riot Sign On',
      errorMessage: 'Thiếu mã xác thực (code) trả về từ Riot Games.',
    });
    return;
  }

  try {
    const basicAuth = Buffer.from(
      `${process.env.RIOT_CLIENT_ID}:${process.env.RIOT_CLIENT_SECRET}`
    ).toString('base64');

    const tokenRes = await axios.post(
      'https://auth.riotgames.com/token',
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: String(process.env.RIOT_REDIRECT_URI || '').trim(),
      }),
      {
        headers: {
          Authorization: `Basic ${basicAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 10000,
      }
    );

    const { access_token, refresh_token } = tokenRes.data || {};
    if (!access_token) {
      throw new Error('Riot không trả về access_token.');
    }

    const { puuid, gameName, tagLine } = await fetchRiotAccountMe(String(access_token));
    let targetUserId: number;

    if (stateObj.linkUserId) {
      const [existingRiotRows] = await dbPool.query<RowDataPacket[]>(
        'SELECT id, steam_id FROM users WHERE riot_puuid = ? LIMIT 1',
        [puuid]
      );
      const conflict = existingRiotRows[0];
      if (conflict && Number(conflict.id) !== stateObj.linkUserId) {
        const [matchCountRows] = await dbPool.query<RowDataPacket[]>(
          'SELECT COUNT(*) AS cnt FROM matches WHERE user_id = ?',
          [conflict.id]
        );
        const isEmptyStub = !conflict.steam_id && Number(matchCountRows[0]?.cnt || 0) === 0;
        if (isEmptyStub) {
          await dbPool.query('DELETE FROM users WHERE id = ?', [conflict.id]);
        } else {
          await completeAuthRedirect(req, res, {
            returnTo,
            sessionId,
            providerLabel: 'Riot Sign On',
            errorMessage: 'Tài khoản Riot này đã được liên kết với một hồ sơ khác.',
          });
          return;
        }
      }

      await dbPool.query(
        `UPDATE users
         SET riot_puuid = ?,
             riot_game_name = ?,
             riot_tag_line = ?,
             riot_access_token = ?,
             riot_refresh_token = ?
         WHERE id = ?`,
        [puuid, gameName, tagLine, access_token, refresh_token || null, stateObj.linkUserId]
      );
      targetUserId = stateObj.linkUserId;
    } else {
      await dbPool.query<ResultSetHeader>(
        `INSERT INTO users (riot_puuid, riot_game_name, riot_tag_line, riot_access_token, riot_refresh_token)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           riot_game_name = VALUES(riot_game_name),
           riot_tag_line = VALUES(riot_tag_line),
           riot_access_token = VALUES(riot_access_token),
           riot_refresh_token = COALESCE(VALUES(riot_refresh_token), riot_refresh_token)`,
        [puuid, gameName, tagLine, access_token, refresh_token || null]
      );

      const [rows] = await dbPool.query<RowDataPacket[]>(
        'SELECT id FROM users WHERE riot_puuid = ? LIMIT 1',
        [puuid]
      );
      targetUserId = Number(rows[0].id);
    }

    const [userRows] = await dbPool.query<RowDataPacket[]>(
      `SELECT id, riot_puuid, steam_id, riot_game_name, riot_tag_line
       FROM users WHERE id = ? LIMIT 1`,
      [targetUserId]
    );

    const appToken = signUserJwt(userRows[0] as any);
    await completeAuthRedirect(req, res, {
      returnTo,
      sessionId,
      token: appToken,
      providerLabel: 'Riot Sign On',
    });
  } catch (error: any) {
    console.error('Lỗi xác thực RSO:', error?.response?.data || error);
    const riotDetail =
      error?.response?.data?.error_description ||
      error?.response?.data?.error ||
      error?.message;
    await completeAuthRedirect(req, res, {
      returnTo,
      sessionId,
      providerLabel: 'Riot Sign On',
      errorMessage: riotDetail
        ? `Không thể hoàn tất đăng nhập Riot Sign On (${riotDetail}).`
        : 'Không thể đăng nhập bằng tài khoản Riot.',
    });
  }
});

// ============================================================================
// 3. LẤY HỒ SƠ & DANH SÁCH TRẬN ĐẤU / VIDEO CỦA NGƯỜI DÙNG
// ============================================================================
router.get('/my-videos', authenticateToken, async (req: AuthRequest, res: Response) => {
  const userId = req.user?.userId;

  try {
    await ensureFeatureTables();
    const [users] = await dbPool.query<RowDataPacket[]>(
      `SELECT id,
              riot_game_name,
              riot_tag_line,
              (riot_puuid IS NOT NULL AND riot_puuid != '') AS has_riot_linked,
              steam_id,
              steam_persona_name,
              steam_avatar,
              pubg_account_id,
              pubg_player_name
       FROM users WHERE id = ?`,
      [userId]
    );

    const [matches] = await dbPool.query<RowDataPacket[]>(
      `SELECT match_id, game_type, map_name, game_mode, match_result,
              score_summary, local_video_filename, cloud_video_url, duration_sec,
              COALESCE(is_pinned, 0) AS is_pinned, played_at
       FROM matches
       WHERE user_id = ?
       ORDER BY is_pinned DESC, played_at DESC`,
      [userId]
    );

    const rawProfile = users[0] || null;
    res.json({
      profile: rawProfile
        ? {
            ...rawProfile,
            has_riot_linked: Boolean(rawProfile.has_riot_linked),
          }
        : null,
      videos: matches.map((m) => ({
        ...m,
        is_pinned: Boolean(m.is_pinned),
      })),
    });
  } catch (error) {
    console.error('Lỗi lấy danh sách video:', error);
    res.status(500).json({ error: 'Không thể tải danh sách video.' });
  }
});

// ============================================================================
// 4. CẬP NHẬT PUBG IN-GAME NAME (IGN) & KHO PRESET SENS/CROSSHAIR TRÊN CLOUD
// ============================================================================
router.put('/pubg-profile', authenticateToken, async (req: AuthRequest, res: Response) => {
  const userId = req.user?.userId;
  const rawName = String(req.body?.pubgPlayerName || '').trim();

  if (!userId || rawName.length < 3 || rawName.length > 32) {
    res.status(400).json({
      error: 'Tên nhân vật PUBG (IGN) phải dài từ 3 đến 32 ký tự.',
    });
    return;
  }

  try {
    let exactName = rawName;
    let accountId: string | null = null;

    if (isConfiguredEnv(process.env.PUBG_API_KEY)) {
      const shard = process.env.PUBG_SHARD || 'steam';
      try {
        const playerRes = await axios.get(
          `https://api.pubg.com/shards/${shard}/players?filter[playerNames]=${encodeURIComponent(
            rawName
          )}`,
          {
            headers: {
              Authorization: `Bearer ${process.env.PUBG_API_KEY}`,
              Accept: 'application/vnd.api+json',
            },
            timeout: 10000,
          }
        );

        const playerObj = playerRes.data?.data?.[0];
        if (!playerObj) {
          res.status(404).json({
            error: `Không tìm thấy nhân vật PUBG "${rawName}" (lưu ý phân biệt chữ hoa/thường).`,
          });
          return;
        }
        exactName = String(playerObj.attributes?.name || rawName);
        accountId = String(playerObj.id || '') || null;
      } catch (err: any) {
        if (err?.response?.status === 404) {
          res.status(404).json({
            error: `Không tìm thấy nhân vật PUBG "${rawName}" (lưu ý phân biệt chữ hoa/thường).`,
          });
          return;
        }
        if (err?.response?.status === 429) {
          res.status(429).json({
            error: 'PUBG API đang giới hạn lượt kiểm tra, vui lòng thử lại sau ít giây.',
          });
          return;
        }
        throw err;
      }
    }

    await dbPool.query(
      `UPDATE users
       SET pubg_player_name = ?,
           pubg_account_id = COALESCE(?, pubg_account_id)
       WHERE id = ?`,
      [exactName, accountId, userId]
    );

    res.json({
      pubg_player_name: exactName,
      pubg_account_id: accountId,
      message: `Đã cập nhật PUBG IGN thành ${exactName}.`,
    });
  } catch (error) {
    console.error('Lỗi cập nhật PUBG IGN:', error);
    res.status(500).json({ error: 'Không thể cập nhật tên nhân vật PUBG lúc này.' });
  }
});

router.get('/presets', authenticateToken, async (req: AuthRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ error: 'Chưa đăng nhập.' });
    return;
  }

  try {
    await ensureFeatureTables();
    const [rows] = await dbPool.query<RowDataPacket[]>(
      `SELECT id, game_type, profile_name, dpi, sensitivity,
              ads_or_scoped_sens, crosshair_code, audio_setup, notes, updated_at
       FROM user_presets
       WHERE user_id = ?
       ORDER BY updated_at DESC`,
      [userId]
    );

    const presets = rows.map((r) => ({
      id: String(r.id),
      gameType: r.game_type === 'PUBG' ? 'PUBG' : 'VALORANT',
      profileName: String(r.profile_name),
      dpi: Number(r.dpi),
      sensitivity: Number(r.sensitivity),
      adsOrScopedSens: String(r.ads_or_scoped_sens || 'Mặc định'),
      crosshairCode: String(r.crosshair_code || ''),
      audioSetup: String(r.audio_setup || ''),
      notes: String(r.notes || ''),
      updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString(),
    }));

    res.json({ presets });
  } catch (error) {
    console.error('Lỗi tải kho preset:', error);
    res.status(500).json({ error: 'Không thể tải cấu hình đã lưu.' });
  }
});

router.post('/presets', authenticateToken, async (req: AuthRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ error: 'Chưa đăng nhập.' });
    return;
  }

  const gameType = req.body?.gameType === 'PUBG' ? 'PUBG' : 'VALORANT';
  const profileName = String(req.body?.profileName || '').trim().slice(0, 120);
  const dpi = Math.max(100, Math.min(32000, Math.round(Number(req.body?.dpi) || 800)));
  const sensitivity = Math.max(0.001, Math.min(1000, Number(req.body?.sensitivity) || 1));
  const adsOrScopedSens = String(req.body?.adsOrScopedSens || 'Mặc định').trim().slice(0, 255);
  const crosshairCode = String(req.body?.crosshairCode || '').trim().slice(0, 2000);
  const audioSetup = String(req.body?.audioSetup || '').trim().slice(0, 255);
  const notes = String(req.body?.notes || '').trim().slice(0, 1000);
  const id = String(req.body?.id || `preset-${Date.now()}`)
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 64);

  if (!profileName || !id) {
    res.status(400).json({ error: 'Thiếu tên cấu hình hợp lệ.' });
    return;
  }

  try {
    await ensureFeatureTables();
    await dbPool.query(
      `INSERT INTO user_presets (
        id, user_id, game_type, profile_name, dpi, sensitivity,
        ads_or_scoped_sens, crosshair_code, audio_setup, notes, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
      ON DUPLICATE KEY UPDATE
        game_type = VALUES(game_type),
        profile_name = VALUES(profile_name),
        dpi = VALUES(dpi),
        sensitivity = VALUES(sensitivity),
        ads_or_scoped_sens = VALUES(ads_or_scoped_sens),
        crosshair_code = VALUES(crosshair_code),
        audio_setup = VALUES(audio_setup),
        notes = VALUES(notes),
        updated_at = NOW()`,
      [
        id,
        userId,
        gameType,
        profileName,
        dpi,
        sensitivity,
        adsOrScopedSens,
        crosshairCode,
        audioSetup,
        notes,
      ]
    );

    res.json({
      preset: {
        id,
        gameType,
        profileName,
        dpi,
        sensitivity,
        adsOrScopedSens,
        crosshairCode,
        audioSetup,
        notes,
        updatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Lỗi lưu preset:', error);
    res.status(500).json({ error: 'Không thể lưu cấu hình lên cloud.' });
  }
});

router.delete('/presets/:presetId', authenticateToken, async (req: AuthRequest, res: Response) => {
  const userId = req.user?.userId;
  const presetId = String(req.params.presetId || '').trim();
  if (!userId || !presetId) {
    res.status(400).json({ error: 'Thiếu thông tin cấu hình cần xóa.' });
    return;
  }

  try {
    await ensureFeatureTables();
    await dbPool.query('DELETE FROM user_presets WHERE id = ? AND user_id = ?', [
      presetId,
      userId,
    ]);
    res.json({ deleted: true });
  } catch (error) {
    console.error('Lỗi xóa preset:', error);
    res.status(500).json({ error: 'Không thể xóa cấu hình lúc này.' });
  }
});

export default router;

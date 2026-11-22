import https from 'https';
import { Router, Request, Response, NextFunction } from 'express';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { dbPool } from '../config/db';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'tactical_replay_secret';
const steamHttpsAgent = new https.Agent({ family: 4 });

export interface AuthRequest extends Request {
  user?: { userId: number; puuid?: string; steamId?: string };
}

function getDefaultClientUrl(): string {
  const origin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
  return `${origin}/public/index.html`;
}

function isSafeRedirectTarget(target: string): boolean {
  return (
    target === 'electron' ||
    target.startsWith('http://localhost:') ||
    target.startsWith('http://127.0.0.1:') ||
    (Boolean(process.env.CLIENT_ORIGIN) && target.startsWith(process.env.CLIENT_ORIGIN!))
  );
}

router.get('/desktop-callback', (req: Request, res: Response) => {
  const token = String(req.query.token || '');
  const deepLink = `tacticalreplay://auth?token=${encodeURIComponent(token)}`;

  res.send(`<!DOCTYPE html>
<html lang="vi">
<head><meta charset="UTF-8" /><title>Đăng nhập thành công</title></head>
<body style="background:#020617;color:#f8fafc;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
  <div style="text-align:center;max-width:420px;padding:32px;background:#0f172a;border:1px solid #1e293b;border-radius:16px;">
    <h2 style="margin-top:0;">Đăng nhập thành công!</h2>
    <p style="color:#94a3b8;font-size:14px;">Đang chuyển hướng về ứng dụng <b>TacticalReplayAI</b>...</p>
    <a href="${deepLink}" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#10b981;color:#020617;font-weight:bold;border-radius:10px;text-decoration:none;">
      Mở lại TacticalReplayAI
    </a>
  </div>
  <script>window.location.href = ${JSON.stringify(deepLink)};</script>
</body>
</html>`);
});

export function authenticateToken(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'Vui lòng đăng nhập để xem video của bạn.' });
    return;
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      res.status(403).json({ error: 'Phiên đăng nhập hết hạn, vui lòng đăng nhập lại.' });
      return;
    }
    req.user = decoded as { userId: number; puuid?: string; steamId?: string };
    next();
  });
}

// ============================================================================
// 1. ĐĂNG NHẬP BẰNG STEAM (STEAM OPENID 2.0)
// ============================================================================
router.get('/steam/login', (req: Request, res: Response) => {
  const serverOrigin = `${req.protocol}://${req.get('host')}`;
  const rawReturnTo = String(req.query.returnTo || '');
  const clientReturnTo = isSafeRedirectTarget(rawReturnTo) ? rawReturnTo : getDefaultClientUrl();

  const callbackUrl = `${serverOrigin}/api/auth/steam/callback?returnTo=${encodeURIComponent(
    clientReturnTo
  )}`;

  const params = new URLSearchParams({
    'openid.ns': 'http://specs.openid.net/auth/2.0',
    'openid.mode': 'checkid_setup',
    'openid.return_to': callbackUrl,
    'openid.realm': serverOrigin,
    'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
    'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select',
  });

  res.redirect(`https://steamcommunity.com/openid/login?${params.toString()}`);
});

router.get('/steam/callback', async (req: Request, res: Response) => {
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
      res.status(401).json({
        error: 'Mã xác thực Steam đã hết hạn hoặc không hợp lệ. Vui lòng quay lại trang chủ và bấm đăng nhập lại.',
      });
      return;
    }

    const claimedId = String(req.query['openid.claimed_id'] || '');
    const idMatch = claimedId.match(/^https?:\/\/steamcommunity\.com\/openid\/id\/(\d+)$/);
    const steamId = idMatch ? idMatch[1] : null;

    if (!steamId) {
      res.status(400).json({ error: 'Không lấy được SteamID từ phản hồi.' });
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

    await dbPool.query<ResultSetHeader>(
      `INSERT INTO users (steam_id, steam_persona_name, steam_avatar)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE
         steam_persona_name = VALUES(steam_persona_name),
         steam_avatar = VALUES(steam_avatar)`,
      [steamId, personaName, avatarUrl]
    );

    const [rows] = await dbPool.query<RowDataPacket[]>(
      'SELECT id FROM users WHERE steam_id = ?',
      [steamId]
    );
    const userId = rows[0].id;

    const appToken = jwt.sign({ userId, steamId }, JWT_SECRET, { expiresIn: '30d' });
    const rawReturnTo = String(req.query.returnTo || '');
    const redirectTarget = isSafeRedirectTarget(rawReturnTo) ? rawReturnTo : getDefaultClientUrl();
    const serverOrigin = `${req.protocol}://${req.get('host')}`;

    if (redirectTarget === 'electron') {
      res.redirect(`${serverOrigin}/api/auth/desktop-callback?token=${appToken}`);
      return;
    }

    const separator = redirectTarget.includes('?') ? '&' : '?';
    res.redirect(`${redirectTarget}${separator}token=${appToken}`);
  } catch (error: any) {
    console.error('Lỗi xác thực Steam OpenID:', error);
    res.status(500).json({
      error: 'Không thể đăng nhập bằng tài khoản Steam.',
      detail: error?.message || String(error),
    });
  }
});

// ============================================================================
// 2. ĐĂNG NHẬP BẰNG RIOT SIGN ON (RSO)
// ============================================================================
router.get('/riot/login', (req: Request, res: Response) => {
  const clientId = process.env.RIOT_CLIENT_ID;
  const redirectUri = encodeURIComponent(process.env.RIOT_REDIRECT_URI || '');
  const rawReturnTo = String(req.query.returnTo || '');
  const clientReturnTo = isSafeRedirectTarget(rawReturnTo) ? rawReturnTo : getDefaultClientUrl();
  const state = Buffer.from(clientReturnTo, 'utf8').toString('base64url');

  const authorizeUrl = `https://auth.riotgames.com/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=openid+offline_access&state=${encodeURIComponent(
    state
  )}`;

  res.redirect(authorizeUrl);
});

router.get('/riot/callback', async (req: Request, res: Response) => {
  const { code, state } = req.query;
  if (!code) {
    res.status(400).json({ error: 'Thiếu mã xác thực từ Riot.' });
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
        code: String(code),
        redirect_uri: process.env.RIOT_REDIRECT_URI || '',
      }),
      {
        headers: {
          Authorization: `Basic ${basicAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    const { access_token, refresh_token } = tokenRes.data;

    const accountRes = await axios.get(
      'https://asia.api.riotgames.com/riot/account/v1/accounts/me',
      { headers: { Authorization: `Bearer ${access_token}` } }
    );

    const { puuid, gameName, tagLine } = accountRes.data;

    await dbPool.query<ResultSetHeader>(
      `INSERT INTO users (riot_puuid, riot_game_name, riot_tag_line, riot_access_token, riot_refresh_token)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         riot_game_name = VALUES(riot_game_name),
         riot_tag_line = VALUES(riot_tag_line),
         riot_access_token = VALUES(riot_access_token),
         riot_refresh_token = VALUES(riot_refresh_token)`,
      [puuid, gameName, tagLine, access_token, refresh_token]
    );

    const [rows] = await dbPool.query<RowDataPacket[]>(
      'SELECT id FROM users WHERE riot_puuid = ?',
      [puuid]
    );
    const userId = rows[0].id;

    const appToken = jwt.sign({ userId, puuid }, JWT_SECRET, { expiresIn: '30d' });

    let decodedReturnTo = '';
    if (typeof state === 'string' && state) {
      try {
        decodedReturnTo = Buffer.from(state, 'base64url').toString('utf8');
      } catch {
        decodedReturnTo = '';
      }
    }

    const redirectTarget = isSafeRedirectTarget(decodedReturnTo)
      ? decodedReturnTo
      : getDefaultClientUrl();
    const serverOrigin = `${req.protocol}://${req.get('host')}`;

    if (redirectTarget === 'electron') {
      res.redirect(`${serverOrigin}/api/auth/desktop-callback?token=${appToken}`);
      return;
    }

    const separator = redirectTarget.includes('?') ? '&' : '?';
    res.redirect(`${redirectTarget}${separator}token=${appToken}`);
  } catch (error) {
    console.error('Lỗi xác thực RSO:', error);
    res.status(500).json({ error: 'Không thể đăng nhập bằng tài khoản Riot.' });
  }
});

// ============================================================================
// 3. LẤY HỒ SƠ & DANH SÁCH TRẬN ĐẤU / VIDEO CỦA NGƯỜI DÙNG
// ============================================================================
router.get('/my-videos', authenticateToken, async (req: AuthRequest, res: Response) => {
  const userId = req.user?.userId;

  try {
    const [users] = await dbPool.query<RowDataPacket[]>(
      `SELECT id, riot_game_name, riot_tag_line,
              steam_id, steam_persona_name, steam_avatar,
              pubg_account_id, pubg_player_name
       FROM users WHERE id = ?`,
      [userId]
    );

    const [matches] = await dbPool.query<RowDataPacket[]>(
      `SELECT match_id, game_type, map_name, game_mode, match_result,
              score_summary, local_video_filename, cloud_video_url, duration_sec, played_at
       FROM matches
       WHERE user_id = ?
       ORDER BY played_at DESC`,
      [userId]
    );

    res.json({
      profile: users[0] || null,
      videos: matches,
    });
  } catch (error) {
    console.error('Lỗi lấy danh sách video:', error);
    res.status(500).json({ error: 'Không thể tải danh sách video.' });
  }
});

// POST /api/auth/riot/quick-login — Đăng nhập hoặc liên kết nhanh bằng Riot ID#Tag
router.post('/riot/quick-login', async (req: Request, res: Response) => {
  try {
    const rawRiotId = String(req.body?.riotId || '').trim();
    const hashIndex = rawRiotId.indexOf('#');

    if (hashIndex <= 0 || hashIndex === rawRiotId.length - 1) {
      res.status(400).json({
        error: 'Vui lòng nhập đúng định dạng Riot ID#Tag (Ví dụ: Player#VN1).',
      });
      return;
    }

    let gameName = rawRiotId.slice(0, hashIndex).trim();
    let tagLine = rawRiotId.slice(hashIndex + 1).trim();

    if (gameName.length < 2 || tagLine.length < 2 || tagLine.length > 10) {
      res.status(400).json({ error: 'Tên nhân vật hoặc Tag Line không hợp lệ.' });
      return;
    }

    let verifiedPuuid: string | null = null;

    // Xác thực qua Riot Account-V1 nếu server đang có RIOT_API_KEY còn hạn
    const riotApiKey = process.env.RIOT_API_KEY;
    if (riotApiKey) {
      try {
        const riotRes = await fetch(
          `https://asia.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(
            gameName
          )}/${encodeURIComponent(tagLine)}`,
          { headers: { 'X-Riot-Token': riotApiKey } }
        );

        if (riotRes.status === 404) {
          res.status(404).json({
            error: `Không tìm thấy tài khoản "${gameName}#${tagLine}" trên hệ thống Riot Games.`,
          });
          return;
        }

        if (riotRes.ok) {
          const accountData: any = await riotRes.json();
          gameName = accountData.gameName || gameName;
          tagLine = accountData.tagLine || tagLine;
          verifiedPuuid = accountData.puuid || null;
        }
        // Nếu key dev 24h hết hạn (401/403), hệ thống vẫn cho phép đăng nhập theo Riot ID đã nhập
      } catch {
        // Bỏ qua lỗi mạng tạm thời tới Riot API
      }
    }

    const dbMod = await import('../config/db');
    const executor: any =
      (dbMod as any).pool || (dbMod as any).db || (dbMod as any).default;

    if (!executor?.query) {
      res.status(500).json({ error: 'Không thể kết nối cơ sở dữ liệu.' });
      return;
    }

    const jwtMod = await import('jsonwebtoken');
    const jwtLib: any = (jwtMod as any).default || jwtMod;
    const jwtSecret = process.env.JWT_SECRET || 'tactical-replay-secret';

    // Kiểm tra xem người dùng có đang gửi kèm token (ví dụ đã đăng nhập Steam từ trước) không
    let linkedUserId: number | null = null;
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const decoded: any = jwtLib.verify(authHeader.slice(7), jwtSecret);
        linkedUserId = Number(decoded?.userId || decoded?.id) || null;
      } catch {
        linkedUserId = null;
      }
    }

    // Kiểm tra cột riot_puuid có tồn tại trong bảng users hay không
    const [puuidCol]: any = await executor.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'riot_puuid'
       LIMIT 1`
    );
    const hasPuuidColumn = Boolean(puuidCol?.length);

    let userRecord: any = null;

    if (linkedUserId) {
      if (hasPuuidColumn && verifiedPuuid) {
        await executor.query(
          `UPDATE users SET riot_game_name = ?, riot_tag_line = ?, riot_puuid = ? WHERE id = ?`,
          [gameName, tagLine, verifiedPuuid, linkedUserId]
        );
      } else {
        await executor.query(
          `UPDATE users SET riot_game_name = ?, riot_tag_line = ? WHERE id = ?`,
          [gameName, tagLine, linkedUserId]
        );
      }
      const [rows]: any = await executor.query(`SELECT * FROM users WHERE id = ? LIMIT 1`, [
        linkedUserId,
      ]);
      userRecord = rows?.[0];
    } else {
      const [existingRows]: any = await executor.query(
        `SELECT * FROM users
         WHERE LOWER(riot_game_name) = LOWER(?) AND LOWER(riot_tag_line) = LOWER(?)
         LIMIT 1`,
        [gameName, tagLine]
      );

      if (existingRows?.length > 0) {
        userRecord = existingRows[0];
        if (hasPuuidColumn && verifiedPuuid && !userRecord.riot_puuid) {
          await executor.query(`UPDATE users SET riot_puuid = ? WHERE id = ?`, [
            verifiedPuuid,
            userRecord.id,
          ]);
        }
      } else {
        if (hasPuuidColumn && verifiedPuuid) {
          const [insertRes]: any = await executor.query(
            `INSERT INTO users (riot_game_name, riot_tag_line, riot_puuid) VALUES (?, ?, ?)`,
            [gameName, tagLine, verifiedPuuid]
          );
          const [createdRows]: any = await executor.query(
            `SELECT * FROM users WHERE id = ? LIMIT 1`,
            [insertRes.insertId]
          );
          userRecord = createdRows?.[0];
        } else {
          const [insertRes]: any = await executor.query(
            `INSERT INTO users (riot_game_name, riot_tag_line) VALUES (?, ?)`,
            [gameName, tagLine]
          );
          const [createdRows]: any = await executor.query(
            `SELECT * FROM users WHERE id = ? LIMIT 1`,
            [insertRes.insertId]
          );
          userRecord = createdRows?.[0];
        }
      }
    }

    const token = jwtLib.sign(
      {
        id: userRecord.id,
        userId: userRecord.id,
        riotGameName: userRecord.riot_game_name,
        riotTagLine: userRecord.riot_tag_line,
      },
      jwtSecret,
      { expiresIn: '30d' }
    );

    res.json({
      token,
      user: {
        id: userRecord.id,
        riot_game_name: userRecord.riot_game_name,
        riot_tag_line: userRecord.riot_tag_line,
      },
    });
  } catch (err: any) {
    console.error('Lỗi /api/auth/riot/quick-login:', err);
    res.status(500).json({ error: 'Không thể đăng nhập bằng Riot ID lúc này.' });
  }
});

export default router;
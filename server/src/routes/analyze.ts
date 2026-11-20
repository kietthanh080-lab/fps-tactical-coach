import { Router, Response } from 'express';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { RowDataPacket } from 'mysql2';
import { dbPool } from '../config/db';
import { authenticateToken, AuthRequest } from './auth';
import {
  analyzeRoundTactics,
  parsePubgTelemetryToRounds,
  RawRoundInput,
  TimelineEventInput,
  WeaponUsageStat,
} from '../engine/tacticalRules';
import { generateMatchReport } from '../engine/aiCoach';

const router = Router();
const MAX_STORED_MATCHES = 20;

const HIGHLIGHT_UPLOAD_DIR = process.env.VERCEL
  ? '/tmp/uploads/highlights'
  : path.join(__dirname, '../../uploads/highlights');

try {
  if (!fs.existsSync(HIGHLIGHT_UPLOAD_DIR)) {
    fs.mkdirSync(HIGHLIGHT_UPLOAD_DIR, { recursive: true });
  }
} catch (err) {
  console.warn('Không thể tạo sẵn thư mục upload khi khởi động:', err);
}

const highlightStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    if (!fs.existsSync(HIGHLIGHT_UPLOAD_DIR)) {
      fs.mkdirSync(HIGHLIGHT_UPLOAD_DIR, { recursive: true });
    }
    cb(null, HIGHLIGHT_UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const rawMatchId = String(req.body?.matchId || 'highlight').replace(/[^a-zA-Z0-9_-]/g, '_');
    const ext = path.extname(file.originalname) || '.mp4';
    cb(null, `${rawMatchId}_${Date.now()}${ext}`);
  },
});

const uploadHighlight = multer({
  storage: highlightStorage,
  limits: { fileSize: 500 * 1024 * 1024 },
});

const PUBG_MAP_NAMES: Record<string, string> = {
  Baltic_Main: 'Erangel',
  Erangel_Main: 'Erangel',
  Desert_Main: 'Miramar',
  Savage_Main: 'Sanhok',
  DihorOtok_Main: 'Vikendi',
  Vikendi_Main: 'Vikendi',
  Tiger_Main: 'Taego',
  Kiki_Main: 'Deston',
  Neon_Main: 'Rondo',
  Chimera_Main: 'Paramo',
  Summerland_Main: 'Karakin',
};

const VALORANT_WEAPONS: Record<
  string,
  { name: string; category: WeaponUsageStat['category'] }
> = {
  '29A0CFAB-485B-F5D5-779A-B59F85E204A8': { name: 'Classic', category: 'Pistol' },
  '42DA8CCC-40D5-AFFC-BEEC-15AA47B42EDA': { name: 'Shorty', category: 'SG' },
  '44D4E95C-4157-0037-81B2-17841BF2E8E3': { name: 'Frenzy', category: 'Pistol' },
  '1BAA85B4-4C70-1284-64BB-6481DFC3BB4E': { name: 'Ghost', category: 'Pistol' },
  'E336C6B8-418D-9340-D77F-7A9E4CFE0702': { name: 'Sheriff', category: 'Pistol' },
  'F7E1B454-4AD4-1063-EC0A-159E56B58941': { name: 'Stinger', category: 'SMG' },
  '462080D1-4035-2937-7C09-27AA2A5C27A7': { name: 'Spectre', category: 'SMG' },
  '910BE174-449B-C412-AB22-D0873436B21B': { name: 'Bucky', category: 'SG' },
  'EC845BF4-4F79-DDDA-A3DA-0DB3774B2794': { name: 'Judge', category: 'SG' },
  'AE3DE142-4D85-2547-DD26-4E90BED35CF7': { name: 'Bulldog', category: 'AR' },
  '4ADE7FAA-4CF1-8376-95EF-39884480959B': { name: 'Guardian', category: 'DMR' },
  'EE8E8D15-496B-07AC-E5F6-8FAE5D4C7B1A': { name: 'Phantom', category: 'AR' },
  '9C82E19D-4575-0200-1A81-3EACF00CF872': { name: 'Vandal', category: 'AR' },
  'C4883E50-4494-202C-3EC3-6B8A9284F00B': { name: 'Marshal', category: 'SR' },
  '5F0AAF7A-4B50-7B5D-4610-D4A940C0B425': { name: 'Outlaw', category: 'SR' },
  'A03B24D3-4319-996D-0F8C-94BBFBA1DFC7': { name: 'Operator', category: 'SR' },
  '55D8A0F4-4274-CA67-FE2C-06AB45EFDF58': { name: 'Ares', category: 'LMG' },
  '63E6C2B6-4A8E-869C-3D4C-E38355226584': { name: 'Odin', category: 'LMG' },
};

function safeParseJson<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'object') return value as T;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}

async function enforceRollingMatchLimit(
  userId: number,
  gameType: 'VALORANT' | 'PUBG',
  maxKeep = MAX_STORED_MATCHES
): Promise<void> {
  const [rows] = await dbPool.query<RowDataPacket[]>(
    `SELECT match_id, cloud_video_url
     FROM matches
     WHERE user_id = ? AND game_type = ?
     ORDER BY played_at DESC`,
    [userId, gameType]
  );

  if (rows.length <= maxKeep) return;

  const evicted = rows.slice(maxKeep);
  const evictedIds = evicted.map((r) => String(r.match_id));

  for (const row of evicted) {
    const url = String(row.cloud_video_url || '');
    const marker = '/uploads/highlights/';
    const idx = url.indexOf(marker);
    if (idx !== -1) {
      const fileName = url.slice(idx + marker.length);
      const fullPath = path.join(HIGHLIGHT_UPLOAD_DIR, path.basename(fileName));
      fs.promises.unlink(fullPath).catch(() => {});
    }
  }

  await dbPool.query('DELETE FROM match_rounds WHERE match_id IN (?)', [evictedIds]);
  await dbPool.query('DELETE FROM match_reports WHERE match_id IN (?)', [evictedIds]);
  await dbPool.query('DELETE FROM matches WHERE user_id = ? AND match_id IN (?)', [
    userId,
    evictedIds,
  ]);
}

function parseValorantMatchToRounds(
  matchData: any,
  targetPuuid: string,
  localTimeline: TimelineEventInput[]
): RawRoundInput[] {
  const roundResults = matchData?.roundResults || [];
  const players = matchData?.players || [];
  const me = players.find((p: any) => p.puuid === targetPuuid);
  const myTeamId = me?.teamId;

  return roundResults.map((rr: any, index: number) => {
    const roundNum = (rr.roundNum ?? index) + 1;
    const myStats = (rr.playerStats || []).find((ps: any) => ps.puuid === targetPuuid);
    const kills = myStats?.kills?.length || 0;
    const damageDealt = (myStats?.damage || []).reduce(
      (sum: number, d: any) => sum + Number(d.damage || 0),
      0
    );

    const weaponId = String(myStats?.economy?.weapon || '').toUpperCase();
    const resolvedWeapon = VALORANT_WEAPONS[weaponId];
    const weaponStats: WeaponUsageStat[] = resolvedWeapon
      ? [
          {
            weaponName: resolvedWeapon.name,
            category: resolvedWeapon.category,
            kills,
            headshots: 0,
            damageDealt,
            hits: kills,
          },
        ]
      : [];

    const diedInRound = roundResults[index]?.playerStats?.some((ps: any) =>
      (ps.kills || []).some((k: any) => k.victim === targetPuuid)
    );

    const roundEvents = localTimeline.filter((e) => e.round === roundNum);
    const startMs = roundEvents[0]?.timestampMs ?? index * 90000;
    const endMs = roundEvents[roundEvents.length - 1]?.timestampMs ?? startMs + 85000;

    return {
      roundNumber: roundNum,
      startTimestampMs: startMs,
      endTimestampMs: endMs,
      result: rr.winningTeam === myTeamId ? 'WIN' : 'LOSS',
      kills,
      deaths: diedInRound ? 1 : 0,
      assists: 0,
      damageDealt,
      teamAvgLoadoutValue: myStats?.economy?.loadoutValue ?? 3900,
      plantTimeMs: rr.plantRoundTime ?? 0,
      wonOpeningDuel: false,
      wasTradedWithin3s: true,
      unusedAbilitiesCount: 0,
      weaponStats,
      events: roundEvents,
    };
  });
}

// 1. POST /api/analyze/highlight/upload
router.post(
  '/highlight/upload',
  authenticateToken,
  uploadHighlight.single('video'),
  async (req: AuthRequest, res: Response) => {
    const userId = req.user?.userId;
    const matchId = String(req.body?.matchId || '').trim();

    if (!req.file || !matchId) {
      res.status(400).json({ error: 'Thiếu file video highlight hoặc mã trận đấu (matchId).' });
      return;
    }

    const serverOrigin = `${req.protocol}://${req.get('host')}`;
    const cloudVideoUrl = `${serverOrigin}/uploads/highlights/${req.file.filename}`;

    try {
      await dbPool.query(
        `UPDATE matches
         SET cloud_video_url = ?, local_video_filename = COALESCE(local_video_filename, ?)
         WHERE match_id = ? AND user_id = ?`,
        [cloudVideoUrl, req.file.originalname, matchId, userId]
      );

      res.json({
        matchId,
        cloudVideoUrl,
        fileName: req.file.filename,
      });
    } catch (error) {
      console.error('Lỗi lưu URL highlight vào database:', error);
      res.status(500).json({ error: 'Không thể lưu video highlight lên hệ thống.' });
    }
  }
);

function buildRoundsFromLocalEvents(localEvents: TimelineEventInput[]): RawRoundInput[] {
  if (!Array.isArray(localEvents) || localEvents.length === 0) return [];

  const roundMap = new Map<number, TimelineEventInput[]>();
  for (const ev of localEvents) {
    const rNum = Number(ev.round) || 1;
    if (!roundMap.has(rNum)) roundMap.set(rNum, []);
    roundMap.get(rNum)!.push(ev);
  }

  return Array.from(roundMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([roundNumber, events]) => {
      const sorted = [...events].sort((a, b) => a.timestampMs - b.timestampMs);
      const kills = sorted.filter((e) => e.type === 'KILL').length;
      const deaths = sorted.filter((e) => e.type === 'DEATH').length;
      const plantEvent = sorted.find((e) => e.type === 'SPIKE_PLANTED');
      const startMs = sorted[0]?.timestampMs ?? 0;
      const endMs = sorted[sorted.length - 1]?.timestampMs ?? startMs + 45000;

      return {
        roundNumber,
        startTimestampMs: startMs,
        endTimestampMs: Math.max(startMs + 5000, endMs),
        result: deaths > 0 ? 'LOSS' : 'WIN',
        kills,
        deaths,
        assists: 0,
        damageDealt: kills * 140,
        plantTimeMs: plantEvent ? Math.max(0, plantEvent.timestampMs - startMs) : 0,
        wonOpeningDuel: sorted.find((e) => e.type === 'KILL' || e.type === 'DEATH')?.type === 'KILL',
        wasTradedWithin3s: true,
        unusedAbilitiesCount: 0,
        events: sorted,
      };
    });
}

// 2. POST /api/analyze/match
router.post('/match', authenticateToken, async (req: AuthRequest, res: Response) => {
  const userId = req.user?.userId;
  const userPuuid = req.user?.puuid;

  const {
    matchId,
    gameType,
    mapName = 'Unknown Map',
    gameMode = 'Competitive',
    matchResult = 'COMPLETED',
    scoreSummary = '',
    localVideoFilename = null,
    cloudVideoUrl = null,
    durationSec = 0,
    localEvents = [],
    rawRounds = [],
  } = req.body;

  if (!matchId || !gameType || !userId) {
    res.status(400).json({ error: 'Thiếu thông tin matchId hoặc gameType.' });
    return;
  }

  try {
    let roundsToAnalyze: RawRoundInput[] = Array.isArray(rawRounds) ? rawRounds : [];

    if (gameType === 'PUBG' && roundsToAnalyze.length === 0 && process.env.PUBG_API_KEY) {
      const [userRows] = await dbPool.query<RowDataPacket[]>(
        'SELECT pubg_player_name, steam_persona_name FROM users WHERE id = ?',
        [userId]
      );
      const playerName = userRows[0]?.pubg_player_name || userRows[0]?.steam_persona_name;

      if (playerName) {
        const shard = process.env.PUBG_SHARD || 'steam';
        const matchRes = await axios.get(
          `https://api.pubg.com/shards/${shard}/matches/${encodeURIComponent(matchId)}`,
          {
            headers: {
              Authorization: `Bearer ${process.env.PUBG_API_KEY}`,
              Accept: 'application/vnd.api+json',
            },
          }
        );

        const telemetryAsset = matchRes.data?.included?.find(
          (item: any) => item.type === 'asset'
        );
        const telemetryUrl = telemetryAsset?.attributes?.URL;

        if (telemetryUrl) {
          const telemetryRes = await axios.get(telemetryUrl, {
            headers: { 'Accept-Encoding': 'gzip' },
          });
          roundsToAnalyze = parsePubgTelemetryToRounds(
            telemetryRes.data,
            playerName,
            localEvents as TimelineEventInput[]
          );
        }
      }
    }

    if (
      gameType === 'VALORANT' &&
      roundsToAnalyze.length === 0 &&
      process.env.RIOT_API_KEY &&
      userPuuid
    ) {
      try {
        const region = process.env.RIOT_REGION || 'ap';
        const valRes = await axios.get(
          `https://${region}.api.riotgames.com/val/match/v1/matches/${encodeURIComponent(matchId)}`,
          {
            headers: { 'X-Riot-Token': process.env.RIOT_API_KEY },
          }
        );
        roundsToAnalyze = parseValorantMatchToRounds(
          valRes.data,
          userPuuid,
          localEvents as TimelineEventInput[]
        );
      } catch {
        console.warn('Dùng dữ liệu timeline cục bộ cho VALORANT.');
      }
    }

    if (roundsToAnalyze.length === 0 && Array.isArray(localEvents) && localEvents.length > 0) {
      roundsToAnalyze = buildRoundsFromLocalEvents(localEvents as TimelineEventInput[]);
    }

    const analyzedRounds = roundsToAnalyze.map((r) => analyzeRoundTactics(r, gameType));
    const report = await generateMatchReport(gameType, mapName, analyzedRounds);

    const conn = await dbPool.getConnection();
    try {
      await conn.beginTransaction();

      await conn.query(
        `INSERT INTO matches (
          match_id, user_id, game_type, map_name, game_mode,
          match_result, score_summary, local_video_filename, cloud_video_url, duration_sec, played_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE
          local_video_filename = COALESCE(VALUES(local_video_filename), local_video_filename),
          cloud_video_url = COALESCE(VALUES(cloud_video_url), cloud_video_url),
          score_summary = VALUES(score_summary),
          duration_sec = VALUES(duration_sec)`,
        [
          matchId,
          userId,
          gameType,
          mapName,
          gameMode,
          matchResult,
          scoreSummary,
          localVideoFilename,
          cloudVideoUrl,
          durationSec,
        ]
      );

      await conn.query('DELETE FROM match_rounds WHERE match_id = ?', [matchId]);

      for (const round of analyzedRounds) {
        await conn.query(
          `INSERT INTO match_rounds (
            match_id, round_number, start_timestamp_ms, end_timestamp_ms,
            round_result, economy_type, tactical_style, kills, deaths, assists,
            damage_dealt, strengths_json, mistakes_json, timeline_events_json, weapon_stats_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            matchId,
            round.roundNumber,
            round.startTimestampMs,
            round.endTimestampMs,
            round.result,
            round.economyType,
            round.tacticalStyle,
            round.kills,
            round.deaths,
            round.assists,
            round.damageDealt,
            JSON.stringify(round.strengths),
            JSON.stringify(round.mistakes),
            JSON.stringify(round.events),
            JSON.stringify(round.weaponStats),
          ]
        );
      }

      await conn.query(
        `INSERT INTO match_reports (
          match_id, overall_score, strengths_summary, weaknesses_summary,
          recommended_drills, coach_commentary
        ) VALUES (?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          overall_score = VALUES(overall_score),
          strengths_summary = VALUES(strengths_summary),
          weaknesses_summary = VALUES(weaknesses_summary),
          recommended_drills = VALUES(recommended_drills),
          coach_commentary = VALUES(coach_commentary)`,
        [
          matchId,
          report.overallScore,
          JSON.stringify(report.strengthsSummary),
          JSON.stringify(report.weaknessesSummary),
          JSON.stringify(report.recommendedDrills),
          report.coachCommentary,
        ]
      );

      await conn.commit();
    } catch (txError) {
      await conn.rollback();
      throw txError;
    } finally {
      conn.release();
    }

    await enforceRollingMatchLimit(userId, gameType, MAX_STORED_MATCHES);

    res.json({
      matchId,
      gameType,
      mapName,
      rounds: analyzedRounds,
      report,
    });
  } catch (error) {
    console.error('Lỗi phân tích trận đấu:', error);
    res.status(500).json({ error: 'Không thể hoàn tất phân tích trận đấu.' });
  }
});

// 3. GET /api/analyze/match/:matchId
router.get('/match/:matchId', authenticateToken, async (req: AuthRequest, res: Response) => {
  const matchId = String(req.params.matchId);
  const userId = req.user?.userId;

  try {
    const [matches] = await dbPool.query<RowDataPacket[]>(
      'SELECT * FROM matches WHERE match_id = ? AND user_id = ?',
      [matchId, userId]
    );

    if (matches.length === 0) {
      res.status(404).json({ error: 'Không tìm thấy dữ liệu trận đấu này.' });
      return;
    }

    const [roundRows] = await dbPool.query<RowDataPacket[]>(
      'SELECT * FROM match_rounds WHERE match_id = ? ORDER BY round_number ASC',
      [matchId]
    );

    const formattedRounds = roundRows.map((row) => ({
      roundNumber: row.round_number,
      startTimestampMs: row.start_timestamp_ms,
      endTimestampMs: row.end_timestamp_ms,
      result: row.round_result,
      economyType: row.economy_type,
      tacticalStyle: row.tactical_style,
      kills: row.kills,
      deaths: row.deaths,
      assists: row.assists,
      damageDealt: row.damage_dealt,
      strengths: safeParseJson<string[]>(row.strengths_json, []),
      mistakes: safeParseJson<string[]>(row.mistakes_json, []),
      weaponStats: safeParseJson<WeaponUsageStat[]>(row.weapon_stats_json, []),
      events: safeParseJson<TimelineEventInput[]>(row.timeline_events_json, []),
    }));

    const [reportRows] = await dbPool.query<RowDataPacket[]>(
      'SELECT * FROM match_reports WHERE match_id = ?',
      [matchId]
    );

    const rawReport = reportRows[0];
    const formattedReport = rawReport
      ? {
          overallScore: Number(rawReport.overall_score),
          strengthsSummary: safeParseJson<string[]>(rawReport.strengths_summary, []),
          weaknessesSummary: safeParseJson<string[]>(rawReport.weaknesses_summary, []),
          recommendedDrills: safeParseJson<string[]>(rawReport.recommended_drills, []),
          coachCommentary: rawReport.coach_commentary,
        }
      : null;

    res.json({
      match: matches[0],
      rounds: formattedRounds,
      report: formattedReport,
    });
  } catch (error) {
    console.error('Lỗi tải chi tiết trận đấu:', error);
    res.status(500).json({ error: 'Lỗi máy chủ khi tải dữ liệu trận đấu.' });
  }
});

// 4. POST /api/analyze/pubg/sync — Đồng bộ 20 trận gần nhất & tự bổ sung chi tiết vũ khí
router.post('/pubg/sync', authenticateToken, async (req: AuthRequest, res: Response) => {
  const userId = req.user?.userId;

  if (!process.env.PUBG_API_KEY || !userId) {
    res.status(400).json({ error: 'Chưa cấu hình PUBG_API_KEY trên máy chủ.' });
    return;
  }

  try {
    const [userRows] = await dbPool.query<RowDataPacket[]>(
      'SELECT pubg_account_id, pubg_player_name, steam_persona_name FROM users WHERE id = ?',
      [userId]
    );
    const playerName = userRows[0]?.pubg_player_name || userRows[0]?.steam_persona_name;

    if (!playerName) {
      res.status(400).json({ error: 'Chưa xác định được tên nhân vật PUBG của tài khoản này.' });
      return;
    }

    const shard = process.env.PUBG_SHARD || 'steam';
    const playerRes = await axios.get(
      `https://api.pubg.com/shards/${shard}/players?filter[playerNames]=${encodeURIComponent(playerName)}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PUBG_API_KEY}`,
          Accept: 'application/vnd.api+json',
        },
      }
    );

    const playerObj = playerRes.data?.data?.[0];
    const recentMatchRefs: Array<{ id: string }> = playerObj?.relationships?.matches?.data || [];

    if (recentMatchRefs.length === 0) {
      res.json({
        syncedCount: 0,
        message: 'Tài khoản này chưa có trận đấu PUBG nào trong 14 ngày gần đây.',
      });
      return;
    }

    const candidateIds = recentMatchRefs.slice(0, MAX_STORED_MATCHES).map((m) => m.id);

    const [existingRows] = await dbPool.query<RowDataPacket[]>(
      `SELECT DISTINCT m.match_id
       FROM matches m
       INNER JOIN match_rounds mr ON mr.match_id = m.match_id
       WHERE m.user_id = ? AND m.match_id IN (?) AND mr.weapon_stats_json IS NOT NULL`,
      [userId, candidateIds]
    );
    const completeSet = new Set(existingRows.map((r) => String(r.match_id)));
    const targetMatchIds = candidateIds.filter((id) => !completeSet.has(id));

    if (targetMatchIds.length === 0) {
      await enforceRollingMatchLimit(userId, 'PUBG', MAX_STORED_MATCHES);
      res.json({
        syncedCount: 0,
        message: 'Danh sách 20 trận gần nhất đã cập nhật đầy đủ chi tiết vũ khí.',
      });
      return;
    }

    let syncedCount = 0;
    const batches = chunkArray(targetMatchIds, 5);

    for (const batch of batches) {
      await Promise.all(
        batch.map(async (matchId) => {
          try {
            const matchRes = await axios.get(
              `https://api.pubg.com/shards/${shard}/matches/${encodeURIComponent(matchId)}`,
              {
                headers: {
                  Authorization: `Bearer ${process.env.PUBG_API_KEY}`,
                  Accept: 'application/vnd.api+json',
                },
                timeout: 15000,
              }
            );

            const attrs = matchRes.data?.data?.attributes || {};
            const included: any[] = matchRes.data?.included || [];

            const rawMap = String(attrs.mapName || 'Unknown');
            const mapName = PUBG_MAP_NAMES[rawMap] || rawMap;
            const gameMode = String(attrs.gameMode || 'Battle Royale').toUpperCase();
            const durationSec = Number(attrs.duration || 0);
            const playedAt = attrs.createdAt ? new Date(attrs.createdAt) : new Date();

            const participant = included.find(
              (item) => item.type === 'participant' && item.attributes?.stats?.name === playerName
            );
            const stats = participant?.attributes?.stats || {};
            const winPlace = stats.winPlace ? `TOP #${stats.winPlace}` : 'COMPLETED';
            const kills = Number(stats.kills || 0);
            const damage = Math.round(Number(stats.damageDealt || 0));
            const scoreSummary = `${kills} Kills • ${damage} DMG`;

            const telemetryAsset = included.find((item) => item.type === 'asset');
            const telemetryUrl = telemetryAsset?.attributes?.URL;

            let rawRounds: RawRoundInput[] = [];
            if (telemetryUrl) {
              const telemetryRes = await axios.get(telemetryUrl, {
                headers: { 'Accept-Encoding': 'gzip' },
                timeout: 20000,
              });
              rawRounds = parsePubgTelemetryToRounds(telemetryRes.data, playerName, []);
            }

            const analyzedRounds = rawRounds.map((r) => analyzeRoundTactics(r, 'PUBG'));
            const report = await generateMatchReport('PUBG', mapName, analyzedRounds);

            const conn = await dbPool.getConnection();
            try {
              await conn.beginTransaction();

              await conn.query(
                `INSERT INTO matches (
                  match_id, user_id, game_type, map_name, game_mode,
                  match_result, score_summary, duration_sec, played_at
                ) VALUES (?, ?, 'PUBG', ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                  score_summary = VALUES(score_summary)`,
                [matchId, userId, mapName, gameMode, winPlace, scoreSummary, durationSec, playedAt]
              );

              await conn.query('DELETE FROM match_rounds WHERE match_id = ?', [matchId]);

              for (const round of analyzedRounds) {
                await conn.query(
                  `INSERT INTO match_rounds (
                    match_id, round_number, start_timestamp_ms, end_timestamp_ms,
                    round_result, economy_type, tactical_style, kills, deaths, assists,
                    damage_dealt, strengths_json, mistakes_json, timeline_events_json, weapon_stats_json
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                  [
                    matchId,
                    round.roundNumber,
                    round.startTimestampMs,
                    round.endTimestampMs,
                    round.result,
                    round.economyType,
                    round.tacticalStyle,
                    round.kills,
                    round.deaths,
                    round.assists,
                    round.damageDealt,
                    JSON.stringify(round.strengths),
                    JSON.stringify(round.mistakes),
                    JSON.stringify(round.events),
                    JSON.stringify(round.weaponStats),
                  ]
                );
              }

              await conn.query(
                `INSERT INTO match_reports (
                  match_id, overall_score, strengths_summary, weaknesses_summary,
                  recommended_drills, coach_commentary
                ) VALUES (?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                  overall_score = VALUES(overall_score),
                  coach_commentary = VALUES(coach_commentary)`,
                [
                  matchId,
                  report.overallScore,
                  JSON.stringify(report.strengthsSummary),
                  JSON.stringify(report.weaknessesSummary),
                  JSON.stringify(report.recommendedDrills),
                  report.coachCommentary,
                ]
              );

              await conn.commit();
              syncedCount += 1;
            } catch (txErr) {
              await conn.rollback();
              throw txErr;
            } finally {
              conn.release();
            }
          } catch (matchErr) {
            console.warn(`Bỏ qua trận ${matchId} do lỗi tải dữ liệu:`, matchErr);
          }
        })
      );
    }

    await enforceRollingMatchLimit(userId, 'PUBG', MAX_STORED_MATCHES);

    res.json({
      syncedCount,
      message:
        syncedCount > 0
          ? `Đã cập nhật dữ liệu và thống kê vũ khí cho ${syncedCount} trận PUBG.`
          : 'Không có trận mới nào cần cập nhật.',
    });
  } catch (error: any) {
    if (error?.response?.status === 429) {
      res.status(429).json({
        error: 'PUBG API đang giới hạn lượt tra cứu (10 lượt/phút), vui lòng thử lại sau ít giây.',
      });
      return;
    }
    console.error('Lỗi đồng bộ 20 trận PUBG:', error);
    res.status(500).json({ error: 'Không thể đồng bộ dữ liệu trận đấu từ PUBG API.' });
  }
});

// 5. GET /api/analyze/player-search
router.get('/player-search', async (req, res: Response) => {
  const game = String(req.query.game || 'PUBG').toUpperCase();
  const query = String(req.query.query || '').trim();

  if (!query) {
    res.status(400).json({ error: 'Vui lòng nhập tên nhân vật cần tìm kiếm.' });
    return;
  }

  try {
    if (game === 'PUBG') {
      if (!process.env.PUBG_API_KEY) {
        res.status(400).json({ error: 'Máy chủ chưa cấu hình PUBG_API_KEY.' });
        return;
      }

      const shard = process.env.PUBG_SHARD || 'steam';
      const playerRes = await axios.get(
        `https://api.pubg.com/shards/${shard}/players?filter[playerNames]=${encodeURIComponent(query)}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.PUBG_API_KEY}`,
            Accept: 'application/vnd.api+json',
          },
        }
      );

      const playerObj = playerRes.data?.data?.[0];
      if (!playerObj) {
        res.status(404).json({
          error: 'Không tìm thấy nhân vật PUBG này (lưu ý phân biệt chữ hoa/thường).',
        });
        return;
      }

      const exactName: string = playerObj.attributes.name;
      const accountId: string = playerObj.id;
      const matchRefs: Array<{ id: string }> = playerObj.relationships?.matches?.data || [];

      const matchResults = await Promise.allSettled(
        matchRefs.slice(0, MAX_STORED_MATCHES).map(async (m) => {
          const mRes = await axios.get(
            `https://api.pubg.com/shards/${shard}/matches/${encodeURIComponent(m.id)}`,
            {
              headers: {
                Authorization: `Bearer ${process.env.PUBG_API_KEY}`,
                Accept: 'application/vnd.api+json',
              },
              timeout: 10000,
            }
          );
          const attrs = mRes.data?.data?.attributes || {};
          const included: any[] = mRes.data?.included || [];
          const participant = included.find(
            (item) => item.type === 'participant' && item.attributes?.stats?.name === exactName
          );
          const stats = participant?.attributes?.stats || {};
          const rawMap = String(attrs.mapName || 'Unknown');

          return {
            matchId: m.id,
            mapName: PUBG_MAP_NAMES[rawMap] || rawMap,
            gameMode: String(attrs.gameMode || 'Battle Royale').toUpperCase(),
            winPlace: Number(stats.winPlace || 0),
            kills: Number(stats.kills || 0),
            damageDealt: Math.round(Number(stats.damageDealt || 0)),
            playedAt: attrs.createdAt || new Date().toISOString(),
          };
        })
      );

      const recentMatches = matchResults
        .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
        .map((r) => r.value);

      res.json({
        gameType: 'PUBG',
        player: {
          id: accountId,
          name: exactName,
          region: shard.toUpperCase(),
        },
        recentMatches,
      });
      return;
    }

    if (!query.includes('#')) {
      res.status(400).json({
        error: 'Vui lòng nhập đúng định dạng Riot ID gồm dấu # (Ví dụ: TenZ#0505).',
      });
      return;
    }

    if (!process.env.RIOT_API_KEY) {
      res.status(400).json({ error: 'Máy chủ chưa cấu hình RIOT_API_KEY.' });
      return;
    }

    const [gameName, tagLine] = query.split('#');
    const accountRes = await axios.get(
      `https://asia.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(
        gameName.trim()
      )}/${encodeURIComponent(tagLine.trim())}`,
      {
        headers: { 'X-Riot-Token': process.env.RIOT_API_KEY },
      }
    );

    const { puuid, gameName: exactGameName, tagLine: exactTagLine } = accountRes.data;

    let activeShard = 'AP';
    try {
      const shardRes = await axios.get(
        `https://asia.api.riotgames.com/riot/account/v1/active-shards/by-game/val/by-puuid/${encodeURIComponent(
          puuid
        )}`,
        {
          headers: { 'X-Riot-Token': process.env.RIOT_API_KEY },
        }
      );
      if (shardRes.data?.activeShard) {
        activeShard = String(shardRes.data.activeShard).toUpperCase();
      }
    } catch {
      // Giữ mặc định AP
    }

    res.json({
      gameType: 'VALORANT',
      player: {
        id: puuid,
        name: `${exactGameName}#${exactTagLine}`,
        region: activeShard,
      },
      recentMatches: [],
    });
  } catch (error: any) {
    const status = error?.response?.status;
    if (status === 404) {
      res.status(404).json({ error: 'Không tìm thấy người chơi này trên máy chủ game.' });
      return;
    }
    if (status === 403 || status === 401) {
      res.status(401).json({ error: 'API Key trên máy chủ đã hết hạn hoặc không hợp lệ.' });
      return;
    }
    if (status === 429) {
      res.status(429).json({
        error: 'Hệ thống API đang giới hạn lượt tra cứu, vui lòng thử lại sau ít giây.',
      });
      return;
    }
    console.error('Lỗi tra cứu nhân vật:', error);
    res.status(500).json({ error: 'Không thể tra cứu thông tin nhân vật lúc này.' });
  }
});

export default router;
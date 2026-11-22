import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const dbHost = process.env.DB_HOST || 'localhost';
const isLocalDb = dbHost === 'localhost' || dbHost === '127.0.0.1';

export const dbPool = mysql.createPool({
  host: dbHost,
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'fps_tactical_coach',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ...(isLocalDb
    ? {}
    : {
        ssl: {
          minVersion: 'TLSv1.2',
          rejectUnauthorized: true,
        },
      }),
});

let authSessionsReadyPromise: Promise<void> | null = null;

export async function ensureAuthSessionsTable(): Promise<void> {
  if (!authSessionsReadyPromise) {
    authSessionsReadyPromise = dbPool
      .query(
        `CREATE TABLE IF NOT EXISTS auth_sessions (
          session_id VARCHAR(64) PRIMARY KEY,
          token TEXT NULL,
          error_message TEXT NULL,
          expires_at DATETIME NOT NULL
        )`
      )
      .then(() => undefined)
      .catch((err) => {
        authSessionsReadyPromise = null;
        throw err;
      });
  }
  await authSessionsReadyPromise;
}

export async function testDatabaseConnection(): Promise<void> {
  try {
    const connection = await dbPool.getConnection();
    console.log(`Kết nối MySQL (${process.env.DB_NAME || 'fps_tactical_coach'}) thành công.`);

    await connection.query(
      `CREATE TABLE IF NOT EXISTS auth_sessions (
        session_id VARCHAR(64) PRIMARY KEY,
        token TEXT NULL,
        error_message TEXT NULL,
        expires_at DATETIME NOT NULL
      )`
    );

    const alterQueries = [
      'ALTER TABLE users ADD COLUMN steam_id VARCHAR(50) UNIQUE NULL AFTER riot_refresh_token',
      'ALTER TABLE users ADD COLUMN steam_persona_name VARCHAR(100) NULL AFTER steam_id',
      'ALTER TABLE users ADD COLUMN steam_avatar TEXT NULL AFTER steam_persona_name',
      'ALTER TABLE match_rounds ADD COLUMN weapon_stats_json LONGTEXT NULL AFTER timeline_events_json',
    ];

    for (const sql of alterQueries) {
      try {
        await connection.query(sql);
      } catch (err: any) {
        if (err?.errno !== 1060) {
          console.warn('Cảnh báo cập nhật cấu trúc bảng:', err.message);
        }
      }
    }

    connection.release();
  } catch (error) {
    console.error('Lỗi kết nối MySQL:', error);
  }
}
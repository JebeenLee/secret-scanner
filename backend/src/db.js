import pg from 'pg';
import 'dotenv/config';
import { SECRET_TYPES } from './secretTypes.js';

const { Pool } = pg;

// 예) postgres://scanner:scanner@db:5432/secret_scanner
// Neon/Render 등 관리형 Postgres는 SSL이 필요하므로 자동 감지한다.
const NEED_SSL = /sslmode=require|neon\.tech|render\.com/.test(process.env.DATABASE_URL || '');
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: NEED_SSL ? { rejectUnauthorized: false } : false,
});

let ready = false;
export const isDbReady = () => ready;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS secret_types (
  id     TEXT PRIMARY KEY,
  name   TEXT NOT NULL,
  risk   TEXT NOT NULL,
  what   TEXT,
  impact TEXT,
  fix    TEXT
);
CREATE TABLE IF NOT EXISTS scan_stats (
  type       TEXT PRIMARY KEY,
  count      BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS metrics (
  key   TEXT PRIMARY KEY,
  value BIGINT NOT NULL DEFAULT 0
);
`;

// 스키마 생성 + 백과사전 시드. DB가 없으면 ready=false 로 두고 폴백 모드로 동작한다.
export async function initDb() {
  try {
    await pool.query(SCHEMA);
    for (const t of SECRET_TYPES) {
      await pool.query(
        `INSERT INTO secret_types (id, name, risk, what, impact, fix)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO UPDATE
           SET name = EXCLUDED.name, risk = EXCLUDED.risk,
               what = EXCLUDED.what, impact = EXCLUDED.impact, fix = EXCLUDED.fix`,
        [t.id, t.name, t.risk, t.what, t.impact, t.fix]
      );
    }
    await pool.query(
      `INSERT INTO metrics (key, value) VALUES ('total_scans', 0) ON CONFLICT (key) DO NOTHING`
    );
    ready = true;
    console.log('DB ready: 스키마 생성 + 백과사전 시드 완료');
  } catch (err) {
    ready = false;
    console.warn('DB 미연결 — 메모리 폴백 모드로 동작:', err.message);
  }
  return ready;
}

export async function pingDb() {
  const { rows } = await pool.query('SELECT NOW() AS now');
  return rows[0].now;
}

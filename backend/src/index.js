import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import { SECRET_TYPES } from './secretTypes.js';
import { pool, initDb, isDbReady, pingDb } from './db.js';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: '1mb' }));

// DB 미연결 시 사용할 메모리 폴백 (dev 편의용)
const memStats = {};
let memScans = 0;

// 헬스체크
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'secret-scanner-api', db: isDbReady() ? 'on' : 'memory', time: new Date().toISOString() });
});

// DB 연결 확인
app.get('/api/db-health', async (req, res) => {
  try {
    const now = await pingDb();
    res.json({ db: 'ok', now });
  } catch (err) {
    res.status(503).json({ db: 'down', error: err.message });
  }
});

// 시크릿 종류 백과사전 — DB 우선, 실패 시 코드 상수 폴백
app.get('/api/secret-types', async (req, res) => {
  if (isDbReady()) {
    try {
      const { rows } = await pool.query(
        'SELECT id, name, risk, what, impact, fix FROM secret_types ORDER BY id'
      );
      if (rows.length) return res.json(rows);
    } catch { /* 폴백 */ }
  }
  res.json(SECRET_TYPES);
});

// 익명 통계 기록 — 원문은 저장하지 않고 "종류·개수"만 집계
app.post('/api/stats', async (req, res) => {
  const counts = req.body?.counts || {};
  if (isDbReady()) {
    try {
      await pool.query(`UPDATE metrics SET value = value + 1 WHERE key = 'total_scans'`);
      for (const [type, n] of Object.entries(counts)) {
        await pool.query(
          `INSERT INTO scan_stats (type, count, updated_at) VALUES ($1, $2, now())
           ON CONFLICT (type) DO UPDATE
             SET count = scan_stats.count + EXCLUDED.count, updated_at = now()`,
          [type, Number(n) || 0]
        );
      }
      return res.status(201).json({ recorded: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }
  // 메모리 폴백
  memScans += 1;
  for (const [type, n] of Object.entries(counts)) memStats[type] = (memStats[type] || 0) + (Number(n) || 0);
  res.status(201).json({ recorded: true, mode: 'memory' });
});

// 누적 통계 조회 — 시크릿 종류 분포
app.get('/api/stats', async (req, res) => {
  if (isDbReady()) {
    try {
      const totalScans = (await pool.query(`SELECT value FROM metrics WHERE key = 'total_scans'`)).rows[0]?.value ?? 0;
      const { rows } = await pool.query(
        `SELECT s.type, s.count, t.name, t.risk
         FROM scan_stats s LEFT JOIN secret_types t ON t.id = s.type
         WHERE s.count > 0 ORDER BY s.count DESC`
      );
      const byType = rows.map((r) => ({ type: r.type, name: r.name || r.type, risk: r.risk, count: Number(r.count) }));
      return res.json({ totalScans: Number(totalScans), totalFindings: byType.reduce((a, b) => a + b.count, 0), byType });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }
  // 메모리 폴백
  const byType = Object.entries(memStats)
    .filter(([, c]) => c > 0)
    .map(([type, count]) => {
      const meta = SECRET_TYPES.find((t) => t.id === type);
      return { type, name: meta?.name || type, risk: meta?.risk, count };
    })
    .sort((a, b) => b.count - a.count);
  res.json({ totalScans: memScans, totalFindings: byType.reduce((a, b) => a + b.count, 0), byType, mode: 'memory' });
});

// AI 보조 분석 — 마스킹된 후보 + 주변 맥락만 입력 (원문 시크릿 전송 X)
// TODO(M3): Vercel AI Gateway + AI SDK generateObject 로 진위 판정 / 수정 제안
app.post('/api/ai/verify', async (req, res) => {
  res.status(501).json({ error: 'not implemented', todo: 'wire Vercel AI Gateway' });
});

initDb().finally(() => {
  app.listen(PORT, () => console.log(`Secret Scanner API listening on :${PORT}`));
});

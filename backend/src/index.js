import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import { SECRET_TYPES } from './secretTypes.js';
import { pingDb } from './db.js';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: '1mb' }));

// 헬스체크
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'secret-scanner-api', time: new Date().toISOString() });
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

// 시크릿 종류 백과사전 (정체 / 노출 영향 / 수정법)
// TODO: 추후 PostgreSQL secret_types 테이블로 이전
app.get('/api/secret-types', (req, res) => {
  res.json(SECRET_TYPES);
});

// 익명 통계 — 원문은 저장하지 않고 "종류·개수"만 집계
// TODO: 메모리 → PostgreSQL scan_stats 테이블로 이전
const stats = {};
app.get('/api/stats', (req, res) => {
  const total = Object.values(stats).reduce((a, b) => a + b, 0);
  res.json({ total, byType: stats });
});
app.post('/api/stats', (req, res) => {
  const counts = req.body?.counts || {};
  for (const [type, n] of Object.entries(counts)) {
    stats[type] = (stats[type] || 0) + Number(n || 0);
  }
  res.status(201).json({ recorded: true });
});

// AI 보조 분석 — 마스킹된 후보 + 주변 맥락만 입력 (원문 시크릿 전송 X)
// TODO: Vercel AI Gateway + AI SDK generateObject 로 진위 판정 / 수정 제안 구현
app.post('/api/ai/verify', async (req, res) => {
  res.status(501).json({ error: 'not implemented', todo: 'wire Vercel AI Gateway' });
});

app.listen(PORT, () => {
  console.log(`Secret Scanner API listening on :${PORT}`);
});

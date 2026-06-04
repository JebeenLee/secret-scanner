import { useEffect, useState } from 'react';
import { RISK_COLOR } from './lib/constants';

// 익명 통계 대시보드 — 백엔드에서 누적 분포를 받아 막대 그래프로 표시
export default function StatsDashboard({ refreshKey }) {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetch('/api/stats')
      .then((r) => (r.ok ? r.json() : null))
      .then(setStats)
      .catch(() => {});
  }, [refreshKey]);

  // 전체 통계 비우기 → 비면 대시보드 자체가 사라짐
  function clearStats() {
    fetch('/api/stats', { method: 'DELETE' })
      .then(() => setStats({ totalScans: 0, totalFindings: 0, byType: [] }))
      .catch(() => {});
  }

  if (!stats || !stats.byType?.length) return null;

  const max = Math.max(...stats.byType.map((t) => t.count), 1);

  return (
    <section className="stats">
      <div className="stats-head">
        <h3>전체 통계 (익명 · 종류·개수만 집계)</h3>
        <button className="link" onClick={clearStats}>전체 비우기</button>
      </div>
      <div className="stat-nums">
        <span>총 스캔 <b>{stats.totalScans}</b>회</span>
        <span>누적 발견 <b>{stats.totalFindings}</b>건</span>
      </div>
      <ul className="bars">
        {stats.byType.map((t) => (
          <li key={t.type}>
            <span className="bar-label">{t.name}</span>
            <span className="bar">
              <span className="bar-fill" style={{ width: `${(t.count / max) * 100}%`, background: RISK_COLOR[t.risk] || '#888' }} />
            </span>
            <span className="bar-count">{t.count}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

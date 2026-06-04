import { useState, useEffect } from 'react';
import { scan, summarize } from './lib/detector';
import { loadHistory, addHistory, clearHistory } from './lib/history';
import './App.css';

const RISK_COLOR = {
  critical: '#e5484d',
  high: '#f76808',
  medium: '#ffc53d',
  low: '#46a758',
};
const RISK_LABEL = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' };
const RISK_ORDER = ['critical', 'high', 'medium', 'low'];

const SAMPLE = `// 예제 코드 — 하드코딩된 시크릿이 들어 있습니다
const awsKey = "AKIAQ7Z3WMPLN5RT8XYV";
const githubToken = "ghp_A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8";
const config = {
  apiKey: "a1B2c3D4e5F6g7H8i9J0kLmN",
  password: "S3cur3P@ssw0rd2024",
};`;

export default function App() {
  const [code, setCode] = useState('');
  const [findings, setFindings] = useState(null);
  const [info, setInfo] = useState({});      // 시크릿 종류 백과사전 (id → 해설)
  const [open, setOpen] = useState(null);     // 펼쳐진 카드 인덱스
  const [history, setHistory] = useState(loadHistory());

  // 백엔드에서 시크릿 종류 백과사전을 불러와 해설 카드에 사용
  useEffect(() => {
    fetch('/api/secret-types')
      .then((r) => (r.ok ? r.json() : []))
      .then((list) => {
        const map = {};
        for (const t of list) map[t.id] = t;
        setInfo(map);
      })
      .catch(() => {});
  }, []);

  function runScan(text) {
    const result = scan(text);
    setFindings(result);
    setOpen(null);
    if (text.trim()) {
      setHistory(addHistory({ at: new Date().toISOString(), total: result.length, summary: summarize(result) }));
    }
  }

  async function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setCode(text);
    runScan(text);
  }

  const summary = findings ? summarize(findings) : null;

  return (
    <div className="app">
      <header className="head">
        <h1>Secret Scanner</h1>
        <p className="tagline">프론트엔드 코드에 하드코딩된 시크릿을 배포 전에 찾아냅니다.</p>
        <span className="badge">파일은 서버로 전송되지 않습니다 — 분석은 브라우저에서만 실행됩니다.</span>
      </header>

      <section className="input">
        <textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="코드를 붙여넣거나 파일을 선택하세요..."
          spellCheck={false}
        />
        <div className="actions">
          <input type="file" onChange={onFile} />
          <button className="primary" onClick={() => runScan(code)}>스캔하기</button>
          <button onClick={() => { setCode(SAMPLE); runScan(SAMPLE); }}>예제 체험</button>
        </div>
      </section>

      {findings && (
        <section className="results">
          <div className="summary">
            <h2>결과: {findings.length}건 발견</h2>
            {findings.length > 0 && (
              <div className="chips">
                {RISK_ORDER.filter((r) => summary[r] > 0).map((r) => (
                  <span key={r} className="chip" style={{ borderColor: RISK_COLOR[r], color: RISK_COLOR[r] }}>
                    {RISK_LABEL[r]} {summary[r]}
                  </span>
                ))}
              </div>
            )}
          </div>

          {findings.length === 0 ? (
            <p className="clean">하드코딩된 시크릿이 발견되지 않았습니다.</p>
          ) : (
            <ul className="cards">
              {findings.map((f, i) => {
                const meta = info[f.type];
                const isOpen = open === i;
                return (
                  <li key={i} className={`card ${isOpen ? 'open' : ''}`}>
                    <button className="card-head" onClick={() => setOpen(isOpen ? null : i)}>
                      <span className="risk" style={{ background: RISK_COLOR[f.risk] }}>{RISK_LABEL[f.risk]}</span>
                      <strong>{f.name}</strong>
                      <code>{f.masked}</code>
                      <span className="meta">line {f.line}:{f.column} · entropy {f.entropy}</span>
                      <span className="caret">{isOpen ? '▾' : '▸'}</span>
                    </button>
                    {isOpen && meta && (
                      <div className="card-body">
                        <p><b>정체</b> {meta.what}</p>
                        <p><b>노출 영향</b> {meta.impact}</p>
                        <p><b>수정 방법</b> {meta.fix}</p>
                      </div>
                    )}
                    {isOpen && !meta && (
                      <div className="card-body"><p className="muted">해설 정보를 불러오지 못했습니다. (백엔드 /api/secret-types 확인)</p></div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {history.length > 0 && (
        <section className="history">
          <div className="history-head">
            <h3>최근 스캔 이력</h3>
            <button className="link" onClick={() => setHistory(clearHistory())}>비우기</button>
          </div>
          <ul>
            {history.slice(0, 8).map((h, i) => (
              <li key={i}>
                <span className="time">{new Date(h.at).toLocaleString('ko-KR')}</span>
                <span>{h.total}건</span>
                {h.summary.critical > 0 && <span className="dot" style={{ color: RISK_COLOR.critical }}>● {h.summary.critical}</span>}
                {h.summary.high > 0 && <span className="dot" style={{ color: RISK_COLOR.high }}>● {h.summary.high}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="foot">
        Secret Scanner — 다음 단계: 익명 통계 대시보드 · AI 보조 분석
      </footer>
    </div>
  );
}

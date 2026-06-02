import { useState } from 'react';
import { scan } from './lib/detector';
import './App.css';

const RISK_COLOR = {
  critical: '#e5484d',
  high: '#f76808',
  medium: '#ffc53d',
  low: '#46a758',
};

const SAMPLE = `// 예제: 아래 코드에는 하드코딩된 시크릿이 들어있습니다
const awsKey = "AKIAIOSFODNN7EXAMPLE";
const config = {
  apiKey: "AIzaSyD-1234567890abcdefghijklmnopqrstuv",
  token: "ghp_abcdefghijklmnopqrstuvwxyz0123456789",
};`;

export default function App() {
  const [code, setCode] = useState('');
  const [findings, setFindings] = useState(null);

  function runScan(text) {
    setFindings(scan(text));
  }

  async function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setCode(text);
    runScan(text);
  }

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
          <h2>결과: {findings.length}건 발견</h2>
          {findings.length === 0 ? (
            <p className="clean">하드코딩된 시크릿이 발견되지 않았습니다.</p>
          ) : (
            <ul>
              {findings.map((f, i) => (
                <li key={i}>
                  <span className="risk" style={{ background: RISK_COLOR[f.risk] }}>{f.risk}</span>
                  <strong>{f.name}</strong>
                  <code>{f.masked}</code>
                  <span className="meta">line {f.line} · entropy {f.entropy}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <footer className="foot">
        스켈레톤 버전 — 탐지 규칙·AI 보조 분석·통계 대시보드는 구현 예정
      </footer>
    </div>
  );
}

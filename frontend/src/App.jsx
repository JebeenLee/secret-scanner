import { useState, useEffect, useRef } from 'react';
import { scan, summarize, countByType } from './lib/detector';
import { loadHistory, addHistory, clearHistory } from './lib/history';
import { RISK_COLOR, RISK_LABEL, RISK_ORDER } from './lib/constants';
import StatsDashboard from './StatsDashboard';
import './App.css';

const SAMPLE = `// 예제 코드 — 하드코딩된 시크릿이 들어 있습니다
const awsKey = "AKIAQ7Z3WMPLN5RT8XYV";
const githubToken = "ghp_A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8";
const config = {
  apiKey: "a1B2c3D4e5F6g7H8i9J0kLmN",
  password: "S3cur3P@ssw0rd2024",
};`;

// 총 용량 제한 — 브라우저에서 스캔하므로 메인스레드 프리징 방지용 (느린 기기에서도 ~1초 내)
const MAX_TOTAL_BYTES = 5 * 1024 * 1024; // 5MB
// 폴더 업로드 시 제외할 디렉토리 / 바이너리 형식
const SKIP_DIR = /(^|\/)(node_modules|\.git|dist|build|\.next|coverage|vendor)\//i;
const SKIP_EXT = /\.(png|jpe?g|gif|webp|bmp|ico|svg|woff2?|ttf|eot|otf|pdf|zip|gz|tar|7z|rar|mp4|mp3|mov|avi|exe|dll|so|class|jar|wasm|lock)$/i;

const riskRank = (r) => RISK_ORDER.indexOf(r);
const mb = (b) => (b / 1024 / 1024).toFixed(2);

export default function App() {
  const [code, setCode] = useState('');
  const [findings, setFindings] = useState(null);
  const [info, setInfo] = useState({});      // 시크릿 종류 백과사전 (id → 해설)
  const [open, setOpen] = useState(null);     // 펼쳐진 카드 인덱스
  const [history, setHistory] = useState(loadHistory());
  const [statsRefresh, setStatsRefresh] = useState(0);
  const [scannedFiles, setScannedFiles] = useState([]);
  const [scanNote, setScanNote] = useState('');
  const dirRef = useRef(null);

  // 폴더 선택용 input 에 webkitdirectory 속성 부여
  useEffect(() => {
    if (dirRef.current) {
      dirRef.current.setAttribute('webkitdirectory', '');
      dirRef.current.setAttribute('directory', '');
    }
  }, []);

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

  function reportStats(result) {
    fetch('/api/stats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ total: result.length, counts: countByType(result) }),
    })
      .then(() => setStatsRefresh((x) => x + 1))
      .catch(() => {});
  }

  function record(result) {
    setHistory(addHistory({ at: new Date().toISOString(), total: result.length, summary: summarize(result) }));
    reportStats(result);
  }

  // 붙여넣기 / 예제 — 단일 텍스트 스캔
  function runScan(text) {
    const result = scan(text);
    setFindings(result);
    setScannedFiles([]);
    setScanNote('');
    setOpen(null);
    if (text.trim()) record(result);
  }

  // 파일/폴더 스캔 — 바이너리·무시 디렉토리 제외 후, 총 용량 5MB까지만 스캔
  async function scanFileList(fileList) {
    const incoming = Array.from(fileList || []);
    if (!incoming.length) return;

    const candidates = incoming.filter((f) => {
      const path = f.webkitRelativePath || f.name;
      return !SKIP_DIR.test(path) && !SKIP_EXT.test(f.name);
    });

    // 누적 용량이 제한을 넘으면 거기서 중단
    const picked = [];
    let bytes = 0;
    for (const f of candidates) {
      if (bytes + f.size > MAX_TOTAL_BYTES) break;
      picked.push(f);
      bytes += f.size;
    }
    const skipped = incoming.length - picked.length;

    const all = [];
    for (const file of picked) {
      const text = await file.text();
      const label = file.webkitRelativePath || file.name;
      for (const f of scan(text)) all.push({ ...f, file: label });
    }
    all.sort((a, b) => riskRank(a.risk) - riskRank(b.risk) || a.line - b.line);

    setFindings(all);
    setScannedFiles(picked.map((f) => f.webkitRelativePath || f.name));
    setScanNote(
      skipped > 0
        ? `${mb(bytes)}MB 스캔 · ${skipped}개 건너뜀 (용량 ${MAX_TOTAL_BYTES / 1024 / 1024}MB 초과 또는 바이너리 제외)`
        : `${mb(bytes)}MB 스캔`
    );
    setCode('');
    setOpen(null);
    record(all);
  }

  function onPick(e) {
    const input = e.currentTarget;
    scanFileList(input.files).finally(() => {
      input.value = ''; // 같은 항목 다시 선택 가능하게
    });
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
          placeholder="코드를 붙여넣거나 파일/폴더를 선택하세요..."
          spellCheck={false}
        />
        <div className="actions">
          <label className="picker">파일 <input type="file" multiple onChange={onPick} /></label>
          <label className="picker">폴더 <input type="file" ref={dirRef} onChange={onPick} /></label>
          <button className="primary" onClick={() => runScan(code)}>스캔하기</button>
          <button onClick={() => { setCode(SAMPLE); runScan(SAMPLE); }}>예제 체험</button>
        </div>
        <p className="hint">파일·폴더 합쳐 최대 {MAX_TOTAL_BYTES / 1024 / 1024}MB까지 스캔됩니다. (node_modules·바이너리 자동 제외)</p>
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

          {scannedFiles.length > 0 && (
            <p className="scanned-files">
              스캔한 파일 {scannedFiles.length}개{scannedFiles.length <= 5 ? `: ${scannedFiles.join(', ')}` : ''}
              {scanNote ? ` · ${scanNote}` : ''}
            </p>
          )}

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
                      <span className="meta">
                        {f.file && <span className="fname">{f.file}</span>}
                        line {f.line}:{f.column} · entropy {f.entropy}
                      </span>
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

      <StatsDashboard refreshKey={statsRefresh} />

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
        Secret Scanner — 다음 단계: AI 보조 분석
      </footer>
    </div>
  );
}

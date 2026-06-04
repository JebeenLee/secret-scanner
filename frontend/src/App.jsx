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
const SKIP_DIR = /(^|\/)(node_modules|\.git|dist|build|\.next|coverage|vendor)\//i;
const SKIP_DIRNAMES = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'coverage', 'vendor']);
const SKIP_EXT = /\.(png|jpe?g|gif|webp|bmp|ico|svg|woff2?|ttf|eot|otf|pdf|zip|gz|tar|7z|rar|mp4|mp3|mov|avi|exe|dll|so|class|jar|wasm|lock)$/i;

const riskRank = (r) => RISK_ORDER.indexOf(r);
const mb = (b) => (b / 1024 / 1024).toFixed(2);

// 드래그앤드롭 폴더 재귀 순회 (webkitGetAsEntry)
function walkEntry(entry, out) {
  return new Promise((resolve) => {
    if (entry.isFile) {
      entry.file(
        (file) => { out.push({ file, path: entry.fullPath.replace(/^\//, '') }); resolve(); },
        () => resolve()
      );
    } else if (entry.isDirectory) {
      if (SKIP_DIRNAMES.has(entry.name)) { resolve(); return; }
      const reader = entry.createReader();
      const read = () => {
        reader.readEntries(async (batch) => {
          if (!batch.length) { resolve(); return; }
          for (const e of batch) await walkEntry(e, out);
          read(); // readEntries는 배치로 반환 — 빌 때까지 반복
        }, () => resolve());
      };
      read();
    } else {
      resolve();
    }
  });
}

async function collectFromDataTransfer(dt) {
  const out = [];
  const entries = (dt.items ? Array.from(dt.items) : [])
    .map((it) => (it.webkitGetAsEntry ? it.webkitGetAsEntry() : null))
    .filter(Boolean);
  if (entries.length) {
    for (const entry of entries) await walkEntry(entry, out);
  } else {
    for (const file of Array.from(dt.files || [])) out.push({ file, path: file.name });
  }
  return out;
}

export default function App() {
  const [code, setCode] = useState('');
  const [findings, setFindings] = useState(null);
  const [info, setInfo] = useState({});
  const [open, setOpen] = useState(null);
  const [history, setHistory] = useState(loadHistory());
  const [statsRefresh, setStatsRefresh] = useState(0);
  const [scannedFiles, setScannedFiles] = useState([]);
  const [scanNote, setScanNote] = useState('');
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef(null);

  // 드롭존 밖에 떨어뜨려도 브라우저가 파일을 열지 않도록 차단
  useEffect(() => {
    const prevent = (e) => e.preventDefault();
    window.addEventListener('dragover', prevent);
    window.addEventListener('drop', prevent);
    return () => {
      window.removeEventListener('dragover', prevent);
      window.removeEventListener('drop', prevent);
    };
  }, []);

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

  // {file, path} 목록을 필터·용량제한 후 스캔
  async function scanItems(items) {
    if (!items.length) return;
    const candidates = items.filter(({ file, path }) => !SKIP_DIR.test(path) && !SKIP_EXT.test(file.name));

    const picked = [];
    let bytes = 0;
    for (const it of candidates) {
      if (bytes + it.file.size > MAX_TOTAL_BYTES) break;
      picked.push(it);
      bytes += it.file.size;
    }
    const skipped = items.length - picked.length;

    const all = [];
    for (const { file, path } of picked) {
      const text = await file.text();
      for (const f of scan(text)) all.push({ ...f, file: path });
    }
    all.sort((a, b) => riskRank(a.risk) - riskRank(b.risk) || a.line - b.line);

    setFindings(all);
    setScannedFiles(picked.map((it) => it.path));
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
    const items = Array.from(input.files || []).map((file) => ({ file, path: file.webkitRelativePath || file.name }));
    scanItems(items).finally(() => { input.value = ''; });
  }

  async function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    const items = await collectFromDataTransfer(e.dataTransfer);
    scanItems(items);
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
          placeholder="코드를 붙여넣고 [스캔하기]..."
          spellCheck={false}
        />
        <div className="actions">
          <button className="primary" onClick={() => runScan(code)}>스캔하기</button>
          <button onClick={() => { setCode(SAMPLE); runScan(SAMPLE); }}>예제 체험</button>
        </div>

        <div
          className={`dropzone ${dragging ? 'dragging' : ''}`}
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false); }}
          onDrop={onDrop}
        >
          <p className="dz-title">파일·폴더를 여기에 끌어다 놓기</p>
          <p className="dz-sub">또는 클릭해서 파일 선택 (여러 개 가능) · 폴더는 드래그 · 최대 {MAX_TOTAL_BYTES / 1024 / 1024}MB (node_modules·바이너리 제외)</p>
        </div>
        <input ref={fileRef} type="file" multiple onChange={onPick} hidden />
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

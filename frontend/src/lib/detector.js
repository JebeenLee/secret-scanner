// 하드코딩 시크릿 탐지 엔진
// 패턴 매칭 + 엔트로피 분석. 전부 브라우저(클라이언트)에서 실행되며 파일은 서버로 전송되지 않는다.

export const PATTERNS = [
  { id: 'aws_access_key', name: 'AWS Access Key', risk: 'critical', regex: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g },
  { id: 'google_api_key', name: 'Google API Key', risk: 'high', regex: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  { id: 'github_token', name: 'GitHub Token', risk: 'high', regex: /\b(?:ghp|gho|ghs|ghr|ghu)_[0-9A-Za-z]{36}\b/g },
  { id: 'github_pat', name: 'GitHub Fine-grained PAT', risk: 'high', regex: /\bgithub_pat_[0-9A-Za-z_]{22,}\b/g },
  { id: 'slack_token', name: 'Slack Token', risk: 'high', regex: /\bxox[baprs]-[0-9A-Za-z-]{10,}\b/g },
  { id: 'stripe_key', name: 'Stripe Secret Key', risk: 'critical', regex: /\b(?:sk|rk)_live_[0-9A-Za-z]{20,}\b/g },
  { id: 'openai_key', name: 'OpenAI API Key', risk: 'high', regex: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g },
  { id: 'private_key', name: 'Private Key', risk: 'critical', regex: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/g },
  { id: 'jwt', name: 'JSON Web Token', risk: 'medium', regex: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g },
  // 일반 시크릿: 변수/키 이름 + 따옴표 값. 캡처 그룹 1 = 실제 값
  { id: 'generic_secret', name: 'Generic Secret', risk: 'medium', regex: /(?:api[_-]?key|secret|token|password|passwd|pwd|access[_-]?key|auth)\s*[:=]\s*['"`]([^'"`\s]{8,})['"`]/gi },
];

// 위양성(false positive)으로 거를 placeholder / 예시 값
const PLACEHOLDER = /(your[_-]?|example|sample|placeholder|change[_-]?me|dummy|test[_-]?key|foobar|xxxx+|\.\.\.|<[^>]+>|\$\{)/i;

const RISK_RANK = { critical: 0, high: 1, medium: 2, low: 3 };

// 마스킹: 앞 4 + 뒤 4만 노출 (원문은 그대로 보여주지 않는다)
export function mask(value) {
  const v = String(value);
  if (v.length <= 8) return '•'.repeat(v.length);
  return v.slice(0, 4) + '•'.repeat(Math.max(4, v.length - 8)) + v.slice(-4);
}

// Shannon 엔트로피 — 패턴에 없어도 "무작위해 보이는" 정도를 보조 판단
export function entropy(str) {
  if (!str) return 0;
  const freq = {};
  for (const ch of str) freq[ch] = (freq[ch] || 0) + 1;
  return Object.values(freq).reduce((h, c) => {
    const p = c / str.length;
    return h - p * Math.log2(p);
  }, 0);
}

function makeFinding(pattern, match, lineIdx) {
  const secret = match[1] ?? match[0]; // 캡처 그룹이 있으면 실제 값
  const start = match.index ?? 0;
  return {
    type: pattern.id,
    name: pattern.name,
    risk: pattern.risk,
    line: lineIdx + 1,
    column: start + 1,
    masked: mask(secret),
    length: secret.length,
    entropy: Number(entropy(secret).toFixed(2)),
  };
}

// 코드 텍스트 스캔 → findings 배열 (위험도 순 정렬)
export function scan(text) {
  const lines = String(text).split('\n');
  const found = [];
  const generic = PATTERNS.find((p) => p.id === 'generic_secret');

  lines.forEach((line, i) => {
    const ranges = []; // 구체 패턴이 이미 잡은 구간 [start, end]

    // 1) 구체 패턴 우선
    for (const p of PATTERNS) {
      if (p.id === 'generic_secret') continue;
      for (const m of line.matchAll(p.regex)) {
        const secret = m[1] ?? m[0];
        if (PLACEHOLDER.test(secret)) continue;
        const start = m.index ?? 0;
        ranges.push([start, start + m[0].length]);
        found.push(makeFinding(p, m, i));
      }
    }

    // 2) 일반 패턴 — 구체 패턴과 겹치면 중복이므로 건너뜀
    for (const m of line.matchAll(generic.regex)) {
      const secret = m[1] ?? m[0];
      if (PLACEHOLDER.test(secret)) continue;
      const start = m.index ?? 0;
      const end = start + m[0].length;
      if (ranges.some(([s, e]) => start < e && end > s)) continue;
      found.push(makeFinding(generic, m, i));
    }
  });

  found.sort((a, b) => RISK_RANK[a.risk] - RISK_RANK[b.risk] || a.line - b.line);
  return found;
}

// 위험도별 개수 요약
export function summarize(findings) {
  const s = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const f of findings) s[f.risk] = (s[f.risk] || 0) + 1;
  return s;
}

// 하드코딩 시크릿 탐지 엔진 (스켈레톤)
// 1) 패턴 매칭  2) 엔트로피 분석 — 전부 브라우저(클라이언트)에서 실행된다.
// 점검 대상 파일은 서버로 전송되지 않는다.

export const PATTERNS = [
  { id: 'aws_access_key', name: 'AWS Access Key', risk: 'critical', regex: /AKIA[0-9A-Z]{16}/g },
  { id: 'google_api_key', name: 'Google API Key', risk: 'high', regex: /AIza[0-9A-Za-z_-]{35}/g },
  { id: 'github_token', name: 'GitHub Token', risk: 'high', regex: /ghp_[0-9A-Za-z]{36}/g },
  { id: 'jwt', name: 'JSON Web Token', risk: 'medium', regex: /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g },
  { id: 'private_key', name: 'Private Key', risk: 'critical', regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
  { id: 'generic_secret', name: 'Generic Secret', risk: 'medium', regex: /(?:api[_-]?key|secret|token|password)\s*[:=]\s*['"][^'"]{8,}['"]/gi },
];

// 위양성(false positive)으로 거를 placeholder/예시 값
const PLACEHOLDER = /(your[_-]?|example|xxxx|placeholder|changeme|<.*?>|\.\.\.)/i;

// 마스킹: 앞 4글자 + 뒤 4글자만 노출 (원문 그대로 보여주지 않는다)
export function mask(value) {
  if (value.length <= 8) return '•'.repeat(value.length);
  return value.slice(0, 4) + '•'.repeat(Math.max(4, value.length - 8)) + value.slice(-4);
}

// Shannon 엔트로피 — 패턴에 없어도 "무작위해 보이는" 문자열을 보조 판단 (TODO: 임계값 튜닝)
export function entropy(str) {
  if (!str) return 0;
  const freq = {};
  for (const ch of str) freq[ch] = (freq[ch] || 0) + 1;
  return Object.values(freq).reduce((h, c) => {
    const p = c / str.length;
    return h - p * Math.log2(p);
  }, 0);
}

// 코드 텍스트 스캔 → findings 배열
export function scan(text) {
  const findings = [];
  const lines = text.split('\n');

  lines.forEach((line, i) => {
    for (const p of PATTERNS) {
      for (const m of line.matchAll(p.regex)) {
        const value = m[0];
        if (PLACEHOLDER.test(value)) continue; // 위양성 제외
        findings.push({
          type: p.id,
          name: p.name,
          risk: p.risk,
          line: i + 1,
          masked: mask(value),
          entropy: Number(entropy(value).toFixed(2)),
        });
      }
    }
  });

  return findings;
}

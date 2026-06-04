// 스캔 이력 — 사용자 브라우저 localStorage 에만 저장 (서버 전송 없음)
const KEY = 'secret-scanner:history';
const MAX = 20;

export function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || [];
  } catch {
    return [];
  }
}

export function addHistory(entry) {
  const list = [entry, ...loadHistory()].slice(0, MAX);
  localStorage.setItem(KEY, JSON.stringify(list));
  return list;
}

export function clearHistory() {
  localStorage.removeItem(KEY);
  return [];
}

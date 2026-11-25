// 익명 결과 집계: 결과 화면 진입 시 1회, 조합별 카운터를 +1 한다.
// 보내는 값: 레벨, 대표 유형, 성별, 나이대, 의심 여부(y/n), 예상 일치 여부 — 이 여섯뿐이다.
// 고민 부위·두피 타입·증상·탈락량은 보내지 않는다.
// 보내지 않는 값: 사진, 측정값, 기기 ID, 쿠키, 시각. 쿠키는 credentials:'omit' 로 막는다.
import { STATS } from './config.js';

const LEVELS = new Set([1, 2, 3, 4, 5]);
const TYPES = new Set(['L', 'M', 'C', 'U', 'V', 'F']);
const GENDERS = new Set(['m', 'f']);
const AGES = new Set(['10', '20', '30', '40', '50']);
const SUSPECTS = new Set(['y', 'n']);
const MATCHES = new Set(['confirmed', 'early', 'relief', 'elsewhere', 'fine', 'surprise']);

const rpc = (name, body) => fetch(`${STATS.url.replace(/\/$/, '')}/rest/v1/rpc/${name}`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    apikey: STATS.anonKey,
    Authorization: `Bearer ${STATS.anonKey}`,
  },
  body: JSON.stringify(body),
  credentials: 'omit',
  keepalive: true,
  referrerPolicy: 'no-referrer',
});

// 카운터 +1. 끝나면(성공·실패 무관) resolve 되는 Promise 를 돌려준다 — 내 기록이 들어간 뒤 통계를 읽기 위해.
export function countResult({ level, type, gender, age, suspect, match }) {
  if (!STATS.url || !STATS.anonKey) return Promise.resolve();
  if (!LEVELS.has(level) || !TYPES.has(type) || !GENDERS.has(gender) || !AGES.has(age)
    || !SUSPECTS.has(suspect) || !MATCHES.has(match)) return Promise.resolve();
  try {
    return rpc('increment_result_v2', { p_level: level, p_type: type, p_gender: gender, p_age: age, p_suspect: suspect, p_match: match })
      .then(() => {}, () => { /* 집계 실패가 서비스를 막지 않게 */ });
  } catch { return Promise.resolve(); }
}

// 레벨별 누적 인원 → { total, same } 또는 실패 시 null
export async function levelShare(level) {
  if (!STATS.url || !STATS.anonKey || !LEVELS.has(level)) return null;
  try {
    const res = await rpc('level_counts', {});
    if (!res.ok) return null;
    const rows = await res.json();
    let total = 0, same = 0;
    for (const r of rows) {
      const n = Number(r.total) || 0;
      total += n;
      if (Number(r.level) === level) same = n;
    }
    return total > 0 ? { total, same } : null;
  } catch { return null; }
}

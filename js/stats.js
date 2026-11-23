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

export function countResult({ level, type, gender, age, suspect, match }) {
  if (!STATS.url || !STATS.anonKey) return;
  if (!LEVELS.has(level) || !TYPES.has(type) || !GENDERS.has(gender) || !AGES.has(age)
    || !SUSPECTS.has(suspect) || !MATCHES.has(match)) return;
  try {
    fetch(`${STATS.url.replace(/\/$/, '')}/rest/v1/rpc/increment_result_v2`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: STATS.anonKey,
        Authorization: `Bearer ${STATS.anonKey}`,
      },
      body: JSON.stringify({ p_level: level, p_type: type, p_gender: gender, p_age: age, p_suspect: suspect, p_match: match }),
      credentials: 'omit',
      keepalive: true,
      referrerPolicy: 'no-referrer',
    }).catch(() => { /* 집계 실패가 서비스를 막지 않게 */ });
  } catch { /* 위와 같음 */ }
}

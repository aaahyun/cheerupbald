// 퍼널 이벤트만 기록한다. 사진·측정값·기본 정보·증상은 절대 넣지 않는다 (의심 여부·고민 부위 개수·일치 여부만).
// 분석 도구를 붙일 때는 window.cheerupTrack = (name, props) => { ... } 를 정의하면 된다
// (예: GA4 gtag('event', name, props), Plausible plausible(name, { props })).
const ALLOWED_PROPS = new Set(['step', 'reason', 'stage', 'channel', 'variant', 'from', 'type', 'suspect', 'areas', 'match']);

export function track(name, props = {}) {
  const clean = {};
  for (const [k, v] of Object.entries(props)) if (ALLOWED_PROPS.has(k)) clean[k] = v;
  (window.dataLayer = window.dataLayer || []).push({ event: name, ...clean });
  try { window.cheerupTrack?.(name, clean); } catch { /* 분석 실패가 서비스를 막지 않게 */ }
  if (/^(localhost|127\.)/.test(location.hostname)) console.debug('[track]', name, clean);
}

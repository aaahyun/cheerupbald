// 판정 로직 — 측정값 → 노우드/루드비히 단계 → 서비스 5단계.
// DOM·모델 의존성이 없는 순수 함수만 둔다 (node로 테스트 가능).
// 기준값은 PRD「판정 로직」초안이며, 보정은 아래 THRESHOLDS만 고치면 된다.

export const THRESHOLDS = {
  tolRatio: 0.05, // F·M 경계 ±0.05 안이면 낮은 단계 (원칙 4)
  tolPct: 3,      // C 경계 ±3%p
  tolPart: 1,     // 가르마 폭 경계 ±1%p (PRD에 없어 보수적으로 설정)
  F: [1.1, 1.2, 1.4, 1.7, 2.0],   // I | II | III | IV | V | VI
  M: [0.15, 0.3],                 // I | II | III
  C: [15, 30, 40, 60, 80],        // 1 | III vertex | IV | V | VI | VII
  ludwigC: [10, 25, 45],          // 정상 | I | II | III
  ludwigPart: [3, 6, 10],
};

// 노우드 내부 수치: III vertex = 3.5
export const NORWOOD_LABEL = { 1: 'I', 2: 'II', 3: 'III', 3.5: 'III vertex', 4: 'IV', 5: 'V', 6: 'VI', 7: 'VII' };
export const LUDWIG_LABEL = { 0: '정상', 1: 'I', 2: 'II', 3: 'III' };

// value가 경계값 + tol 이하면 아직 아래 칸으로 본다 → value - tol 로 칸을 찾는다.
function bucket(value, bounds, tol, inclusive = true) {
  const v = value - tol - 1e-9; // 경계 자체(정확히 ±tol)도 낮은 단계 쪽
  for (let i = 0; i < bounds.length; i++) {
    if (inclusive ? v <= bounds[i] : v < bounds[i]) return i;
  }
  return bounds.length;
}

/** 정면: F, M → 노우드 앞머리 단계 (1~6). 두 지표 중 높은 쪽. */
export function frontNorwood({ F, M }) {
  const T = THRESHOLDS;
  const sF = [1, 2, 3, 4, 5, 6][bucket(F, T.F, T.tolRatio, true)];
  const sM = M == null ? 1 : [1, 2, 3][bucket(M, T.M, T.tolRatio, false)];
  return Math.max(sF, sM);
}

/** 정수리: C(%), B('present'|'thin'|'none') → 노우드 정수리 단계. */
export function crownNorwood({ C, B }) {
  const T = THRESHOLDS;
  let s = [1, 3.5, 4, 5, 6, 7][bucket(C, T.C, T.tolPct, false)];
  // VI·VII는 앞-정수리 사이 띠가 사라져야 한다. 띠가 남아 있으면 V로 내린다.
  if (s >= 6 && B !== 'none') s = 5;
  return s;
}

export function norwoodToService(n) {
  if (n <= 1) return 1;
  if (n <= 2) return 2;
  if (n <= 3.5) return 3;
  if (n <= 5) return 4;
  return 5;
}

/**
 * 남성 최종 판정.
 * front: { F, M } 또는 { hairlineMissing: true }
 * crown: { C, B }
 * 반환: { retake: 'front' } | { norwood, service }
 */
export function judgeMale(front, crown) {
  if (front.hairlineMissing) {
    // 규칙 5: 헤어라인을 못 찾았는데 C > 80%면 VII, 아니면 재촬영
    if (crown.C > THRESHOLDS.C[4]) return { norwood: 7, service: 5 };
    return { retake: 'front' };
  }
  const n = Math.max(frontNorwood(front), crownNorwood(crown));
  return { norwood: n, service: norwoodToService(n) };
}

/** 여성: 정수리 C와 가르마 폭(part, 원 지름 대비 %) 중 높은 쪽. */
export function judgeFemale(crown) {
  const T = THRESHOLDS;
  const sC = bucket(crown.C, T.ludwigC, T.tolPct, false);
  const sP = bucket(crown.part ?? 0, T.ludwigPart, T.tolPart, false);
  const ludwig = Math.max(sC, sP);
  return { ludwig, service: ludwig + 1 };
}

/**
 * 진행 가능성. info: { age: '10'|'20'|'30'|'40'|'50', family: 'yes'|'no'|'unknown' }
 * 반환: { level: 'low'|'mid'|'high'|'teen'|null, score, reasons[] }
 */
export function progression(info, service) {
  if (info.age === '10') return { level: 'teen', score: null, reasons: [] };
  if (service >= 5) return { level: null, score: null, reasons: [] };
  let score = 0;
  const reasons = [];
  if (info.family === 'yes') { score += 2; reasons.push('가족 중 탈모인이 있어요'); }
  if (info.family === 'unknown') { score += 1; reasons.push('가족력을 잘 모르면 조금 더 보수적으로 봤어요'); }
  if (info.age === '20' && service >= 2) { score += 2; reasons.push('20대에 변화가 시작됐어요'); }
  if (service >= 3) { score += 1; reasons.push('이미 변화가 눈에 띄는 단계예요'); }
  const level = score <= 1 ? 'low' : score <= 3 ? 'mid' : 'high';
  return { level, score, reasons };
}

// 오버레이용 단계별 대표 F·M (기준표 범위의 중간값)
export const REPRESENTATIVE = {
  1: { F: 1.0, M: 0.07 },
  2: { F: 1.15, M: 0.22 },
  3: { F: 1.3, M: 0.4 },
  4: { F: 1.7, M: 0.45 },
  5: { F: 2.2, M: 0.5 },
};

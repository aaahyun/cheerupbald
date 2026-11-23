// 판정 로직 — 측정값 → BASP 유형·등급 → 5단계 레벨 (PRD v1.1「판정 로직」).
// DOM·모델 의존성이 없는 순수 함수만 둔다 (node로 테스트 가능).
// 기준값은 PRD 초안이며, 보정은 아래 THRESHOLDS만 고치면 된다.

export const THRESHOLDS = {
  tolRatio: 0.05,       // H·M 경계 ±0.05 안이면 낮은 쪽 (원칙 4)
  tolPct: 3,            // P·V율·T율·U 위치 경계 ±3%p
  H_L: 1.1,             // H ≤ 1.1 이면 이마 높이 정상
  M_shape: 0.15,        // M ≥ 0.15 이면 M자형, 미만이면 일자 후퇴(C형)
  P: [5, 33, 67],       // 기본형 등급 0 | 1 | 2 | 3   (P > 100 = 가마 뒤 → U형)
  U: [33.3, 66.7],      // U1 | U2 | U3  (가마~뒤통수 거리의 1/3씩)
  specific: [10, 25, 45], // 특이형 없음 | 1 | 2 | 3  (V율·T율 공통)
};

// value가 경계값 + tol 이하면 아직 아래 칸으로 본다 → value - tol 로 칸을 찾는다.
// up = true (사용자가 걱정한 부위): 경계 ±tol 안이면 높은 쪽 → value + tol 로 칸을 찾는다.
function bucket(value, bounds, tol, up = false) {
  const v = up ? value + tol : value - tol - 1e-9; // 기본: 경계 자체(정확히 +tol)도 낮은 쪽
  for (let i = 0; i < bounds.length; i++) if (v < bounds[i]) return i;
  return bounds.length;
}

// 고민 부위 → 자세히 볼 측정 차원. H = 헤어라인(H·M·P), V = 정수리(V율), F = 윗머리 숱(T율)
export const AREA_FOCUS = {
  m: ['H'],
  temple: ['H'],
  crown: ['V'],
  part: ['F'],
  diffuse: ['F', 'V'],
};

/** 고민 부위 목록 → focus Set */
export function focusFromAreas(areas = []) {
  return new Set(areas.flatMap((a) => AREA_FOCUS[a] || []));
}

/**
 * 기본형 (L/M/C/U + 등급).
 * front: { H, M, hairlineMissing }
 * crown: { P, uPos, shape } — P: 현재 헤어라인 위치(%), 100 = 가마. uPos: 가마 뒤 위치(%).
 *        shape: 정수리 사진에서 본 후퇴 모양 'M'|'C' (정면 헤어라인을 못 찾았을 때만 씀)
 * 반환: { type, grade, level } 또는 null (판정 불가)
 */
export function basicType(front, crown, focus = new Set()) {
  const T = THRESHOLDS;
  const up = focus.has('H');
  const sign = up ? 1 : -1; // 걱정한 부위면 경계 ±tol 안을 높은 쪽으로
  if (crown.P == null) return null;
  if (up ? crown.P >= 100 - T.tolPct : crown.P > 100 + T.tolPct) {
    const grade = 1 + bucket(crown.uPos ?? 0, T.U, T.tolPct, up);
    return { type: 'U', grade, level: 5 };
  }
  const grade = bucket(crown.P, T.P, T.tolPct, up);
  let type;
  if (front.hairlineMissing) {
    type = grade === 0 ? 'L' : crown.shape === 'M' ? 'M' : 'C';
  } else {
    const mShape = front.M != null && front.M + sign * T.tolRatio >= T.M_shape;
    const highForehead = front.H + sign * T.tolRatio > T.H_L;
    if (mShape) type = 'M';
    else if (highForehead || grade > 0) type = 'C';
    else type = 'L';
  }
  const level = type === 'L' ? 1 : grade + 1;
  return { type, grade: type === 'L' ? 0 : grade, level };
}

/**
 * 특이형 (V/F + 등급). crown: { V, T, vtConnected }
 * 두 노출이 이어져 구분이 어려우면 더 높은 쪽 하나만 남긴다.
 * 반환: { V: 0~3, F: 0~3 }
 */
export function specificTypes(crown, focus = new Set()) {
  const T = THRESHOLDS;
  let V = bucket(crown.V ?? 0, T.specific, T.tolPct, focus.has('V'));
  let F = bucket(crown.T ?? 0, T.specific, T.tolPct, focus.has('F'));
  if (V && F && crown.vtConnected) {
    if (V >= F) F = 0; else V = 0;
  }
  return { V, F };
}

/**
 * 최종 판정 (남녀 공용).
 * focus: 사용자가 걱정한 차원 Set ('H'|'V'|'F'). 경계값일 때만 높은 쪽으로 본다.
 * 반환: { retake: 'front' } | { level, code, basic, specific, rep, extra[], boosted[] }
 *  - rep: 대표 유형 코드 (레벨을 정한 쪽. 같으면 기본형)
 *  - extra: 대표가 아닌 특이형 ('V'|'F') — "+ 정수리 주의" 등으로 붙인다
 *  - boosted: focus 때문에 등급이 한 칸 올라간 차원 ('H'|'V'|'F')
 */
export function judge(front, crown, focus = new Set()) {
  const res = judgeOnce(front, crown, focus);
  if (res.retake) return res;
  if (!focus.size) return { ...res, boosted: [] };
  const plain = judgeOnce(front, crown);
  const boosted = [];
  if (res.basic.level > plain.basic.level) boosted.push('H');
  if (res.specific.V > plain.specific.V) boosted.push('V');
  if (res.specific.F > plain.specific.F) boosted.push('F');
  return { ...res, boosted };
}

function judgeOnce(front, crown, focus) {
  const basic = basicType(front, crown, focus);
  if (!basic) return { retake: front.hairlineMissing ? 'front' : 'crown' };
  const specific = specificTypes(crown, focus);
  const specLevel = Math.max(specific.V, specific.F) + 1;
  const level = Math.max(basic.level, basic.type === 'U' ? 5 : specLevel);

  let rep = basic.type;
  if (specLevel > basic.level) rep = specific.V >= specific.F ? 'V' : 'F';
  const extra = ['V', 'F'].filter((k) => specific[k] > 0 && k !== rep);

  const code = (basic.type === 'L' ? 'L' : `${basic.type}${basic.grade}`)
    + (specific.V ? `V${specific.V}` : '') + (specific.F ? `F${specific.F}` : '');
  return { level, code, basic, specific, rep, extra };
}

/** 남성용 대략적인 노우드 단계 (참고 한 줄). 정확한 대응이 아니다. */
export function norwoodRef({ basic, specific }) {
  const { type, grade } = basic;
  if (type === 'U') return 'VI~VII';
  if (type === 'C') return grade > 0 ? 'A형 변형' : null;
  if (type === 'L' || grade === 0) return specific.V ? null : 'I';
  return { 1: 'II', 2: specific.V ? 'III vertex' : 'III', 3: 'IV~V' }[grade];
}

/**
 * 진행 가능성. info: { age: '10'|'20'|'30'|'40'|'50', family: 'yes'|'no'|'unknown' }
 * concern (선택): { shedding: 'normal'|'more'|'lots'|'unknown' }
 * 반환: { level: 'low'|'mid'|'high'|'teen'|null, score, reasons[] }
 */
export function progression(info, level, concern = null) {
  if (info.age === '10') return { level: 'teen', score: null, reasons: [] };
  if (level >= 5) return { level: null, score: null, reasons: [] };
  let score = 0;
  const reasons = [];
  if (info.family === 'yes') { score += 2; reasons.push('가족 중 탈모인이 있어요'); }
  if (info.family === 'unknown') { score += 1; reasons.push('가족력을 잘 모르면 조금 더 보수적으로 봤어요'); }
  if (info.age === '20' && level >= 2) { score += 2; reasons.push('20대에 변화가 시작됐어요'); }
  if (level >= 3) { score += 1; reasons.push('이미 변화가 눈에 띄는 단계예요'); }
  if (concern?.shedding === 'lots') { score += 1; reasons.push('빠지는 양이 확 늘었다고 했어요'); }
  if (concern?.shedding === 'more') reasons.push('빠지는 양이 조금 늘었다고 했어요');
  const prog = score <= 1 ? 'low' : score <= 3 ? 'mid' : 'high';
  return { level: prog, score, reasons };
}

/** 고민 부위별 사진상 정도 (0 괜찮음 | 1 살짝 | 2+ 뚜렷) */
export function areaStatus(area, { basic, specific }) {
  if (area === 'm' || area === 'temple') return basic.type === 'L' ? 0 : basic.type === 'U' ? 3 : basic.grade;
  if (area === 'crown') return specific.V;
  if (area === 'part') return specific.F;
  if (area === 'diffuse') return Math.max(specific.F, specific.V);
  return 0;
}

/**
 * 예상과 결과 비교.
 * info.suspect: 'yes'|'no', concern: { areas[] } | null
 * 반환: { match, areas: [{ key, status }] }
 *  match: 'confirmed' | 'early' | 'relief' | 'elsewhere' | 'fine' | 'surprise'
 */
export function expectation(info, concern, judged) {
  const level = judged.level;
  if (info.suspect !== 'yes' || !concern) {
    return { match: level >= 3 ? 'surprise' : 'fine', areas: [] };
  }
  const areas = concern.areas.map((key) => ({ key, status: areaStatus(key, judged) }));
  const hit = areas.some((a) => a.status >= 1);
  let match;
  if (level >= 3) match = hit ? 'confirmed' : 'elsewhere';
  else match = hit ? 'early' : 'relief';
  return { match, areas };
}

// 겹치기용 유형·등급별 대표 수치 (기준표 범위의 중간값).
// 정면 H·M: M형은 관자놀이가 더 높고(M>0), C형은 가운데가 더 높다(M<0 → 반원).
export const REPRESENTATIVE = {
  P: { 0: 2, 1: 19, 2: 50, 3: 83 },
  L: { H: 1.0, M: 0.07 },
  M: { 0: { H: 1.0, M: 0.2 }, 1: { H: 1.05, M: 0.32 }, 2: { H: 1.15, M: 0.5 }, 3: { H: 1.35, M: 0.65 } },
  C: { 0: { H: 1.05, M: -0.05 }, 1: { H: 1.3, M: -0.12 }, 2: { H: 1.6, M: -0.2 }, 3: { H: 2.0, M: -0.25 } },
};

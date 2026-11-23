import assert from 'node:assert/strict';
import { basicType, specificTypes, judge, norwoodRef, progression, expectation, focusFromAreas, areaStatus } from '../js/judge.js';
import { measureCrownGrid, CELL } from '../js/vision.js';

const front = (H, M) => ({ H, M, hairlineMissing: false });
const crown = (P, extra = {}) => ({ P, uPos: 0, shape: 'C', V: 0, T: 0, vtConnected: false, ...extra });

// ── 기본형 ──
assert.deepEqual(basicType(front(1.0, 0.05), crown(2)), { type: 'L', grade: 0, level: 1 });
assert.deepEqual(basicType(front(1.0, 0.4), crown(2)), { type: 'M', grade: 0, level: 1 }, 'M0 = 레벨 1');
assert.deepEqual(basicType(front(1.0, 0.18), crown(2)), { type: 'L', grade: 0, level: 1 }, 'M 0.18은 0.15+0.05 경계 안 → M자 아님');
assert.deepEqual(basicType(front(1.1, 0.4), crown(20)), { type: 'M', grade: 1, level: 2 });
assert.deepEqual(basicType(front(1.4, 0.05), crown(50)), { type: 'C', grade: 2, level: 3 }, '일자 후퇴 = C형');
assert.deepEqual(basicType(front(1.0, 0.05), crown(20)), { type: 'C', grade: 1, level: 2 }, '정면은 정상이어도 P가 후퇴를 보이면 C형');
assert.equal(basicType(front(1.2, 0.4), crown(35)).grade, 1, 'P 35는 33+3 경계 안 → 낮은 등급');
assert.equal(basicType(front(1.2, 0.4), crown(37)).grade, 2);
assert.deepEqual(basicType(front(1.6, 0.4), crown(85)), { type: 'M', grade: 3, level: 4 });
assert.equal(basicType(front(2, 0), crown(102)).type, 'C', 'P 102는 가마 경계 안 → U 아님');
assert.deepEqual(basicType(front(2, 0), crown(120, { uPos: 50 })), { type: 'U', grade: 2, level: 5 });
// 정면 헤어라인을 못 찾으면 정수리만으로 (규칙 5)
const missing = { H: null, M: null, hairlineMissing: true };
assert.deepEqual(basicType(missing, crown(50, { shape: 'M' })), { type: 'M', grade: 2, level: 3 });
assert.deepEqual(basicType(missing, crown(130, { uPos: 80 })), { type: 'U', grade: 3, level: 5 });
assert.equal(basicType(missing, { P: null }), null);

// ── 특이형 ──
assert.deepEqual(specificTypes({ V: 5, T: 5 }), { V: 0, F: 0 });
assert.deepEqual(specificTypes({ V: 12, T: 5 }), { V: 0, F: 0 }, 'V 12는 10+3 경계 안');
assert.deepEqual(specificTypes({ V: 30, T: 15 }), { V: 2, F: 1 });
assert.deepEqual(specificTypes({ V: 30, T: 15, vtConnected: true }), { V: 2, F: 0 }, '이어지면 높은 쪽만');
assert.deepEqual(specificTypes({ V: 50, T: 50 }), { V: 3, F: 3 });

// ── 종합 ──
let j = judge(front(1.0, 0.05), crown(2));
assert.equal(j.level, 1); assert.equal(j.rep, 'L'); assert.equal(j.code, 'L');
j = judge(front(1.2, 0.4), crown(50, { V: 20 }));
assert.equal(j.code, 'M2V1'); assert.equal(j.level, 3); assert.equal(j.rep, 'M'); assert.deepEqual(j.extra, ['V']);
j = judge(front(1.0, 0.05), crown(2, { V: 50 }));
assert.equal(j.level, 4); assert.equal(j.rep, 'V'); assert.deepEqual(j.extra, []);
j = judge(front(1.0, 0.05), crown(2, { T: 30 }));
assert.equal(j.level, 3); assert.equal(j.rep, 'F'); assert.equal(j.code, 'LF2');
j = judge(front(1.2, 0.4), crown(20, { V: 20 }));
assert.equal(j.level, 2); assert.equal(j.rep, 'M', '같은 레벨이면 기본형이 대표');
j = judge(front(2, 0), crown(140, { uPos: 10, V: 60 }));
assert.equal(j.level, 5); assert.equal(j.rep, 'U');
assert.deepEqual(judge(missing, { P: null }), { retake: 'front' });

// ── 노우드 참고 ──
assert.equal(norwoodRef(judge(front(1.0, 0.05), crown(2))), 'I');
assert.equal(norwoodRef(judge(front(1.1, 0.4), crown(20))), 'II');
assert.equal(norwoodRef(judge(front(1.2, 0.4), crown(50, { V: 20 }))), 'III vertex');
assert.equal(norwoodRef(judge(front(1.6, 0.4), crown(85))), 'IV~V');
assert.equal(norwoodRef(judge(front(1.4, 0.05), crown(50))), 'A형 변형');
assert.equal(norwoodRef(judge(front(2, 0), crown(140, { uPos: 10 }))), 'VI~VII');

// ── 진행 가능성 ──
assert.equal(progression({ age: '30', family: 'no' }, 1).level, 'low');
assert.equal(progression({ age: '20', family: 'yes' }, 2).level, 'high');
assert.equal(progression({ age: '40', family: 'unknown' }, 3).level, 'mid');
assert.equal(progression({ age: '10', family: 'yes' }, 3).level, 'teen');

// ── 걱정한 부위: 경계값일 때만 높은 쪽 ──
const H = new Set(['H']), Vf = new Set(['V']), Ff = new Set(['F']);
assert.deepEqual(judge(front(1.0, 0.18), crown(2)).boosted, [], 'focus 없으면 boosted 없음');
assert.equal(basicType(front(1.0, 0.18), crown(2), H).type, 'M', 'M 0.18 + 헤어라인 걱정 → M자형');
assert.equal(basicType(front(1.0, 0.11), crown(2), H).type, 'M', 'M 0.11도 0.15-0.05 경계 안 → M자형');
assert.equal(basicType(front(1.0, 0.09), crown(0), H).type, 'L', '경계 밖은 그대로');
assert.equal(basicType(front(1.0, 0.09), crown(2), H).grade, 1, 'P 2는 5±3 안 → 등급 1');
assert.equal(basicType(front(1.2, 0.4), crown(35), H).grade, 2, 'P 35 + 헤어라인 걱정 → 높은 등급');
assert.equal(basicType(front(1.2, 0.4), crown(31), H).grade, 2, 'P 31도 33±3 안 → 높은 등급');
assert.equal(basicType(front(1.2, 0.4), crown(20), H).grade, 1, 'P 20은 경계 밖 → 그대로');
assert.equal(basicType(front(2, 0), crown(98), H).type, 'U', 'P 98 + 헤어라인 걱정 → 가마 경계 안 → U');
assert.deepEqual(specificTypes({ V: 12, T: 5 }, Vf), { V: 1, F: 0 }, 'V 12 + 정수리 걱정 → V1');
assert.deepEqual(specificTypes({ V: 12, T: 12 }, Vf), { V: 1, F: 0 }, '걱정 안 한 F는 그대로');
j = judge(front(1.2, 0.4), crown(35), H);
assert.equal(j.level, 3); assert.deepEqual(j.boosted, ['H']);
j = judge(front(1.0, 0.05), crown(2, { V: 12, T: 23 }), focusFromAreas(['diffuse']));
assert.deepEqual(j.boosted, ['V', 'F']); assert.equal(j.level, 3, 'T 23 → F2');
j = judge(front(1.0, 0.18), crown(0), H);
assert.equal(j.basic.type, 'M');
assert.deepEqual(j.boosted, [], '유형만 L→M, 레벨이 그대로면 boosted 아님');
assert.deepEqual([...focusFromAreas(['m', 'temple', 'crown'])].sort(), ['H', 'V']);

// ── 탈락량 → 진행 가능성 ──
assert.equal(progression({ age: '30', family: 'no' }, 1, { shedding: 'lots' }).score, 1);
assert.equal(progression({ age: '30', family: 'unknown' }, 1, { shedding: 'lots' }).level, 'mid');
assert.equal(progression({ age: '30', family: 'no' }, 1, { shedding: 'more' }).score, 0);
assert.equal(progression({ age: '30', family: 'no' }, 1, { shedding: 'more' }).reasons.length, 1);

// ── 예상 vs 결과 ──
const yes = { suspect: 'yes' }, no = { suspect: 'no' };
const ok = judge(front(1.0, 0.05), crown(2));                 // 레벨 1, 아무것도 없음
const m1 = judge(front(1.1, 0.4), crown(20));                 // M1, 레벨 2
const m2 = judge(front(1.2, 0.4), crown(50));                 // M2, 레벨 3
const v2 = judge(front(1.0, 0.05), crown(2, { V: 30 }));      // V2, 레벨 3
assert.equal(expectation(yes, { areas: ['m'] }, m2).match, 'confirmed');
assert.equal(expectation(yes, { areas: ['m', 'crown'] }, m1).match, 'early');
assert.equal(expectation(yes, { areas: ['crown'] }, ok).match, 'relief');
assert.equal(expectation(yes, { areas: ['crown', 'part'] }, m2).match, 'elsewhere');
assert.equal(expectation(no, null, ok).match, 'fine');
assert.equal(expectation(no, null, v2).match, 'surprise');
assert.equal(expectation(yes, { areas: ['diffuse'] }, v2).match, 'confirmed', '전체 숱은 V·F 둘 다로 본다');
assert.deepEqual(expectation(yes, { areas: ['m', 'crown'] }, m1).areas, [{ key: 'm', status: 1 }, { key: 'crown', status: 0 }]);
assert.equal(areaStatus('temple', judge(front(2, 0), crown(120, { uPos: 50 }))), 3, 'U형이면 옆머리도 뚜렷');
assert.equal(progression({ age: '30', family: 'yes' }, 5).level, null);

// ── 정수리 격자 측정 (합성 격자) ──
const G = 160;
function makeGrid(paint) {
  const g = new Uint8Array(G * G);
  for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) {
    const inC = (x + 0.5 - G / 2) ** 2 + (y + 0.5 - G / 2) ** 2 <= (G / 2) ** 2;
    g[y * G + x] = inC ? (paint(x, y) ? CELL.scalp : CELL.hair) : CELL.out;
  }
  return g;
}
const near = (v, target, tol, msg) => assert.ok(Math.abs(v - target) <= tol, `${msg}: ${v.toFixed(1)} (기대 ${target}±${tol})`);

let m = measureCrownGrid(makeGrid(() => false), G);
near(m.P, 0, 1, '풍성: P'); near(m.V, 0, 0.1, '풍성: V'); near(m.T, 0, 0.1, '풍성: T');

// 앞에서 y<40 까지 일자로 후퇴 → 가운데 열 기준 P ≈ 50% 안팎
m = measureCrownGrid(makeGrid((x, y) => y < 40), G);
assert.ok(m.P > 33 && m.P < 67, `일자 후퇴: P ${m.P.toFixed(1)} → 등급 2`);
assert.equal(m.shape, 'C');
near(m.V, 0, 0.1, '후퇴 영역은 V에 안 들어감');

// 관자놀이 쪽만 깊이 후퇴 → M자
m = measureCrownGrid(makeGrid((x, y) => Math.abs(x - 80) > 18 && y < 45), G);
assert.equal(m.shape, 'M');

// 가마 원(반지름 32) 안 반지름 20 원형 노출 → V ≈ (20/32)² ≈ 39%
m = measureCrownGrid(makeGrid((x, y) => (x - 80) ** 2 + (y - 80) ** 2 <= 400), G);
near(m.P, 0, 1, '정수리형: P'); near(m.V, 39, 4, '정수리형: V');

// 가운데 넓은 숱 감소 띠 (폭 30, 앞머리 아래 y 20~80) → T 있음
m = measureCrownGrid(makeGrid((x, y) => Math.abs(x - 80) < 15 && y >= 20 && y <= 80), G);
near(m.P, 0, 1, '윗머리 숱형: P'); assert.ok(m.T >= 13, `윗머리 숱형: T ${m.T.toFixed(1)}`);

// 가마 뒤까지 후퇴 → U
m = measureCrownGrid(makeGrid((x, y) => y < 110), G);
assert.ok(m.P > 100 && m.uPos > 0, `말굽형: P ${m.P.toFixed(1)} uPos ${m.uPos.toFixed(1)}`);

console.log('judge: all tests passed');

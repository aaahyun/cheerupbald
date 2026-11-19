import assert from 'node:assert/strict';
import { frontNorwood, crownNorwood, judgeMale, judgeFemale, progression } from '../js/judge.js';

// 앞머리
assert.equal(frontNorwood({ F: 1.0, M: 0.05 }), 1);
assert.equal(frontNorwood({ F: 1.14, M: 0.05 }), 1, 'F 경계 +0.04 → 낮은 단계');
assert.equal(frontNorwood({ F: 1.18, M: 0.05 }), 2);
assert.equal(frontNorwood({ F: 1.0, M: 0.2 }), 1, 'M 0.2는 0.15+0.05 경계 안 → I');
assert.equal(frontNorwood({ F: 1.0, M: 0.25 }), 2);
assert.equal(frontNorwood({ F: 1.0, M: 0.4 }), 3);
assert.equal(frontNorwood({ F: 1.6, M: 0.4 }), 4);
assert.equal(frontNorwood({ F: 2.3, M: null }), 6);
// 정수리
assert.equal(crownNorwood({ C: 5, B: 'present' }), 1);
assert.equal(crownNorwood({ C: 17, B: 'present' }), 1, 'C 경계 +2%p → 낮은 단계');
assert.equal(crownNorwood({ C: 22, B: 'present' }), 3.5);
assert.equal(crownNorwood({ C: 50, B: 'thin' }), 5);
assert.equal(crownNorwood({ C: 70, B: 'present' }), 5, '띠가 남아 있으면 VI 아님');
assert.equal(crownNorwood({ C: 70, B: 'none' }), 6);
assert.equal(crownNorwood({ C: 90, B: 'none' }), 7);
// 종합
assert.deepEqual(judgeMale({ F: 1.3, M: 0.4 }, { C: 22, B: 'present' }), { norwood: 3.5, service: 3 });
assert.deepEqual(judgeMale({ F: 1.0, M: 0.1 }, { C: 5, B: 'present' }), { norwood: 1, service: 1 });
assert.deepEqual(judgeMale({ hairlineMissing: true }, { C: 90, B: 'none' }), { norwood: 7, service: 5 });
assert.deepEqual(judgeMale({ hairlineMissing: true }, { C: 40, B: 'thin' }), { retake: 'front' });
assert.deepEqual(judgeMale({ F: 1.85, M: 0.5 }, { C: 50, B: 'thin' }), { norwood: 5, service: 4 });
// 여성
assert.deepEqual(judgeFemale({ C: 5, part: 2 }), { ludwig: 0, service: 1 });
assert.deepEqual(judgeFemale({ C: 12, part: 2 }), { ludwig: 0, service: 1 }, 'C 12는 경계 안');
assert.deepEqual(judgeFemale({ C: 20, part: 2 }), { ludwig: 1, service: 2 });
assert.deepEqual(judgeFemale({ C: 5, part: 8 }), { ludwig: 2, service: 3 });
// 진행 가능성
assert.equal(progression({ age: '30', family: 'no' }, 1).level, 'low');
assert.equal(progression({ age: '20', family: 'yes' }, 2).level, 'high');
assert.equal(progression({ age: '40', family: 'unknown' }, 3).level, 'mid');
assert.equal(progression({ age: '10', family: 'yes' }, 3).level, 'teen');
assert.equal(progression({ age: '30', family: 'yes' }, 5).level, null);
console.log('judge: all tests passed');

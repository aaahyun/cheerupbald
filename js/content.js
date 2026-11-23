// 서비스 문구. 금지 표현: "진단", "질환", "치료 필요", 특정 약·제품·병원.
// tools/build.mjs 가 공유 페이지·OG 이미지를 만들 때도 이 파일을 읽는다.

export const SERVICE_NAME = '당신은 탈모입니까?';

export const DISCLAIMER =
  '이 테스트는 재미와 참고를 위한 것으로 의료적 진단이 아닙니다. 정확한 상태는 피부과 전문의와 상담하세요.';

export const PRIVACY_NOTE = '사진은 내 기기 안에서만 분석되고 어디에도 전송·저장되지 않아요.';

export const STAGES = {
  1: {
    name: '풍성',
    tone: '걱정 넣어두세요',
    desc: '헤어라인과 정수리 모두 안정적이에요. 지금처럼만 지내면 돼요.',
    consult: null,
    color: '#2F9E6B',
  },
  2: {
    name: '살짝 주의',
    tone: '관자놀이가 슬슬 눈치 보는 중',
    desc: '양옆이 살짝 올라갔지만, 나이 들며 생기는 자연스러운 변화일 수도 있어요.',
    consult: null,
    color: '#8DAA2B',
  },
  3: {
    name: '진행 시작',
    tone: '지금 관리하면 지킬 수 있어요',
    desc: 'M자가 뚜렷해졌거나 정수리 숱이 줄기 시작했어요.',
    consult: '피부과에서 한 번 확인해보세요.',
    color: '#E0A100',
  },
  4: {
    name: '진행 중',
    tone: '전문가와 이야기할 타이밍',
    desc: '앞머리와 정수리 모두 변화가 뚜렷하게 보여요.',
    consult: '전문의 상담을 추천해요.',
    color: '#E0701F',
  },
  5: {
    name: '많이 진행',
    tone: '당당함이 경쟁력',
    desc: '앞머리와 정수리가 이어진 상태예요.',
    consult: '원하면 전문의와 선택지를 살펴보세요.',
    color: '#C8473B',
  },
};

// BASP 유형 라벨과 유형별 디테일 (PRD v1.1「유형 라벨」「유형별 디테일」). 코드(M2V1)는 화면에 내보이지 않는다.
export const TYPES = {
  L: { label: '일자 헤어라인', desc: '헤어라인이 제자리에 있어요.' },
  M: { label: 'M자형', desc: '관자놀이 쪽이 먼저 올라가는, 가장 흔한 남성형 패턴이에요.' },
  C: { label: '이마 확장형', desc: '이마 가운데부터 반원으로 넓어지는 패턴이에요.' },
  U: { label: '말굽형', desc: '앞머리가 정수리 뒤까지 올라간 패턴이에요.' },
  V: { label: '정수리형', desc: '가마 주변 숱이 먼저 줄어드는 패턴이에요. 거울로 잘 안 보여서 늦게 알아차리기 쉬워요.' },
  F: { label: '윗머리 숱형', desc: '헤어라인은 그대로인데 윗머리 전체가 얇아지는 패턴이에요. 가르마가 넓어 보일 수 있어요.' },
};

// 대표 유형이 아닌 특이형이 함께 있을 때 붙이는 라벨과 설명 한 줄
export const EXTRA_NOTES = {
  V: { label: '정수리 주의', desc: '가마 주변 숱도 조금 줄어 보여요.' },
  F: { label: '윗머리 숱 주의', desc: '윗머리 숱도 조금 얇아 보여요.' },
};

export const STATS_NOTE = '더 나은 서비스를 위해 결과 유형만 익명으로 집계해요. 사진과 개인을 알아볼 수 있는 정보는 저장하지 않아요.';

export const PROGRESSION = {
  low: { label: '낮음', text: '지금 상태를 유지할 가능성이 높아요' },
  mid: { label: '보통', text: '1년에 한 번씩 다시 체크해보세요' },
  high: { label: '높음', text: '가족력과 나이를 보면 진행될 가능성이 있어요. 빠를수록 선택지가 많아요' },
  teen: { label: '성장기', text: '성장기에는 변화가 커요. 몇 년 뒤에 다시 체크해보세요' },
};

export const FAIL_MESSAGES = {
  face: '얼굴이 한 명만 잘 보이게 찍어주세요',
  tilt: '카메라를 정면으로 바라봐주세요',
  hairline: '앞머리를 올려 이마를 보여주세요',
  light: '밝은 곳에서 다시 찍어주세요',
  circle: '원 안에 정수리가 들어오게 찍어주세요',
  crown_again: '정수리 사진을 한 번 더 찍어주세요',
  file: '사진을 읽지 못했어요. 다른 사진으로 시도해주세요',
};

export const ANALYZING_STEPS = ['헤어라인 찾는 중…', 'M자 각도 재는 중…', '정수리 살피는 중…', '결과 정리 중…'];

// ───────── 의심 여부·고민 체크 (PRD「의심 여부·고민 체크」) ─────────
export const AREAS = {
  m: { label: 'M자 헤어라인', short: 'M자 라인' },
  crown: { label: '정수리', short: '정수리' },
  part: { label: '중앙 가르마', short: '가르마' },
  temple: { label: '측두부(옆머리)', short: '옆머리', note: '옆머리는 정면 사진의 관자놀이 쪽으로만 봤어요' },
  diffuse: { label: '전체적인 숱 감소', short: '전체 숱' },
};

// focus 차원 → 사람이 읽는 부위 이름 (경계값 반영 안내용)
export const FOCUS_LABELS = { H: '헤어라인', V: '정수리', F: '윗머리 숱' };

// 대표 유형 → "다른 부위" 이름 (elsewhere 안내용)
export const REP_AREA = { M: 'M자 라인', C: '앞머리 라인', U: '앞머리 라인', V: '정수리', F: '윗머리 숱', L: '앞머리 라인' };

export const AREA_STATUS = [
  { label: '괜찮아요', tone: 'ok' },
  { label: '살짝 보여요', tone: 'mild' },
  { label: '뚜렷해요', tone: 'clear' },
];

export const SCALP_TYPES = { oily: '지성', dry: '건성', sensitive: '민감성', unknown: '잘 모르겠어요' };

export const SYMPTOMS = { itch: '가려움', flake: '각질', red: '붉은기', bump: '뾰루지', heat: '열감', none: '없음' };

// 붉은기·뾰루지·열감은 탈모 레벨과 별개로 상담 안내를 띄운다
export const SYMPTOM_CONSULT_KEYS = ['red', 'bump', 'heat'];
export const SYMPTOM_CONSULT = '붉은기·뾰루지·열감이 계속되면 탈모 레벨과 별개로 피부과에서 두피를 확인해보세요.';

// 두피 타입별 일반 관리 팁 (특정 제품·성분 언급 금지)
export const SCALP_TIPS = {
  oily: '피지가 많은 편이라면 저녁에 감고, 두피까지 충분히 헹군 뒤 바로 말려주세요.',
  dry: '건조한 편이라면 너무 뜨거운 물은 피하고, 하루 한 번 이하로 부드럽게 감아주세요.',
  sensitive: '민감한 편이라면 손톱 대신 손끝으로 감고, 새로운 제품은 조금씩 바꿔보세요.',
  unknown: '머리 감은 다음 날 오후에 두피가 번들거리는지, 당기는지 보면 내 두피 타입을 알 수 있어요.',
};

export const SHEDDING = {
  normal: '평소 수준',
  more: '좀 늘었어요',
  lots: '확 늘었어요',
  unknown: '잘 모르겠어요',
};

// 예상 vs 결과. {areas}: 걱정한 부위, {other}: 실제로 변화가 보인 부위
export const EXPECTATION = {
  confirmed: { title: '예상이 맞았어요', text: '걱정한 {areas}에서 변화가 보여요. 일찍 알아챈 만큼 선택지가 많아요.' },
  early: { title: '느낌은 맞았어요, 아직 초기예요', text: '{areas}에 작은 변화가 보여요. 지금 알아둔 게 이득이에요.' },
  relief: { title: '너무 걱정하지 마세요', text: '걱정한 {areas}는 사진상 안정적이에요.' },
  elsewhere: { title: '걱정한 곳은 괜찮아요', text: '다만 {other} 쪽이 먼저 변하고 있어요.' },
  fine: { title: '역시 괜찮아요', text: '지금처럼만 지내면 돼요.' },
  surprise: { title: '생각보다 변화가 있어요', text: '미리 알게 돼서 다행이에요. 아래 안내를 천천히 읽어보세요.' },
};
export const EXPECTATION_SHEDDING =
  '사진상은 괜찮지만 빠지는 양이 늘었다면 계절·스트레스로 잠깐 그럴 수 있어요. 2~3달 넘게 계속되면 피부과에서 확인해보세요.';
export const EXPECTATION_BOOSTED = '{parts}는 경계값이라, 걱정하신 걸 반영해 한 칸 높게 봤어요.';

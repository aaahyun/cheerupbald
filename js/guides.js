// 촬영 가이드 일러스트 (자체 제작 임시본, 정식 일러스트 나오면 교체)

export const FRONT_GUIDE = `<svg viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="정면 촬영 가이드: 앞머리를 올려 이마를 드러내고 정면을 봅니다">
  <ellipse cx="120" cy="128" rx="78" ry="98" fill="none" stroke="#FF6B3D" stroke-width="3" stroke-dasharray="10 8"/>
  <ellipse cx="62" cy="134" rx="10" ry="16" fill="#F5D2B3"/><ellipse cx="178" cy="134" rx="10" ry="16" fill="#F5D2B3"/>
  <ellipse cx="120" cy="130" rx="58" ry="74" fill="#F5D2B3"/>
  <path fill="#3B2A22" d="M60,120 C56,62 84,40 120,40 C156,40 184,62 180,120 L172,120 L172,86 Q170,70 150,68 Q120,62 90,68 Q70,70 68,86 L68,120 Z"/>
  <path d="M92,58 q8,-14 18,-2 M118,54 q8,-14 18,-2" stroke="#FF6B3D" stroke-width="3" fill="none" stroke-linecap="round"/>
  <path d="M96,48 l0,-14 m-6,6 l6,-6 6,6 M144,48 l0,-14 m-6,6 l6,-6 6,6" stroke="#FF6B3D" stroke-width="3" fill="none" stroke-linecap="round"/>
  <path d="M86,104 q10,-6 20,0 M134,104 q10,-6 20,0" stroke="#3B2A22" stroke-width="4" fill="none" stroke-linecap="round"/>
  <circle cx="96" cy="122" r="5" fill="#1d1d1f"/><circle cx="144" cy="122" r="5" fill="#1d1d1f"/>
  <path d="M120,128 l-4,20 h8" stroke="#D9A98A" stroke-width="3" fill="none" stroke-linecap="round"/>
  <path d="M106,166 q14,8 28,0" stroke="#1d1d1f" stroke-width="4" fill="none" stroke-linecap="round"/>
  <text x="120" y="232" text-anchor="middle" font-size="13" font-weight="700" fill="#8C7B6D" font-family="Pretendard, sans-serif">이마가 다 보이게!</text>
</svg>`;

export const CROWN_GUIDE = `<svg viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="정수리 촬영 가이드: 정수리를 위에서 내려다보고 원 안에 머리를 맞춥니다">
  <text x="120" y="18" text-anchor="middle" font-size="13" font-weight="700" fill="#FF6B3D" font-family="Pretendard, sans-serif">▲ 이마 쪽</text>
  <circle cx="120" cy="124" r="100" fill="none" stroke="#FF6B3D" stroke-width="3" stroke-dasharray="10 8"/>
  <ellipse cx="120" cy="128" rx="74" ry="86" fill="#3B2A22"/>
  <ellipse cx="46" cy="132" rx="9" ry="18" fill="#F5D2B3"/><ellipse cx="194" cy="132" rx="9" ry="18" fill="#F5D2B3"/>
  <path d="M120,138 m-4,0 a4,4 0 1,1 8,0 a10,10 0 1,1 -20,0 a16,16 0 1,1 32,0" stroke="#6B5345" stroke-width="3" fill="none"/>
  <path d="M120,44 L120,212" stroke="#6B5345" stroke-width="2" opacity=".5"/>
  <path d="M84,52 q36,-16 72,0" stroke="#F5D2B3" stroke-width="6" fill="none" stroke-linecap="round" opacity=".9"/>
</svg>`;

export const GUIDES = {
  front: {
    step: '1 / 2 · 정면',
    title: '정면 사진을 찍어주세요',
    svg: FRONT_GUIDE,
    tips: ['앞머리를 올려 이마를 모두 드러내기', '카메라를 정면으로 바라보기', '밝은 곳에서 찍기', '모자·안경은 벗기'],
    capture: 'user',
  },
  crown: {
    step: '2 / 2 · 정수리',
    title: '정수리 사진을 찍어주세요',
    svg: CROWN_GUIDE,
    tips: ['정수리를 위에서 내려다보는 각도로', '원 안에 머리가 꽉 차게, 이마 쪽이 사진 위로', '다른 사람이 찍어주면 더 정확해요', '밝은 곳에서 찍기'],
    capture: 'environment',
  },
};

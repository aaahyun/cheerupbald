# 당신은 탈모입니까? (파일럿)

정면·정수리 사진 2장으로 BASP 분류(남녀 공용) 기준 5단계 레벨과 유형(M자형·정수리형 등)을 보여주는 재미용 자가 체크. 기획: [PRD.md](PRD.md) (v1.1)
**서버 없음**: 사진 분석·판정·결과 생성은 모두 브라우저에서 돌고, 사진은 어디에도 전송·저장되지 않는다. 서버 쪽에는 익명 결과 카운터 하나만 둔다 (아래 「익명 결과 집계」).

## 실행

```bash
npm run serve        # http://localhost:8000  (모듈·모델 로드 때문에 file:// 로는 안 됨)
npm test             # 판정 로직 + 정수리 격자 측정 단위 테스트
```

- `?debug=1` : 결과 화면에 BASP 코드(예: M2V1)와 H·M·P·V율·T율 측정값 표시 (기준값 보정용)
- `?variant=A` / `?variant=B` : 겹치기 일러스트 A/B 고정 (기본은 무작위 50:50, 기기별로 고정)

## 배포 (GitHub Pages)

1. GitHub에 저장소를 만들고 이 폴더를 올린다.
2. OG 태그에 들어갈 절대 URL로 다시 빌드한다. **크롤러는 상대 경로 og:image를 못 읽으므로 꼭 필요하다.**
   ```bash
   SITE_URL=https://<깃허브ID>.github.io/<저장소명> npm run build
   ```
   → `result/1~5/index.html` (단계별 og:image), `assets/og/*.png` (1200×630), `index.html`의 og 태그가 갱신된다.
   OG 이미지 렌더링에는 로컬 Chrome이 필요하다 (`CHROME=` 로 경로 지정 가능).
3. Settings → Pages → Branch `main` / root 로 공개.

## 익명 결과 집계 (Supabase)

결과 화면 진입 시 1회, `레벨 · 대표 유형 · 성별 · 나이대` 조합의 카운터를 +1 한다. 개별 기록은 쌓지 않는다.
**`js/config.js`가 비어 있으면 아무것도 보내지 않는다** (지금 상태).

1. Supabase 무료 프로젝트를 만든다.
2. SQL Editor에서 `tools/stats.sql`을 실행한다 → `result_counts` 테이블과 `increment_result` 함수가 생기고, anon 키로는 이 함수만 부를 수 있다.
3. `js/config.js`에 Project URL과 anon public 키를 넣고 배포한다.
4. 집계 보기: `select * from result_counts order by count desc;`

요청은 쿠키 없이(`credentials: 'omit'`) 보낸다. 다만 Supabase API 게이트웨이 로그에는 요청 IP가 일정 기간 남을 수 있으니, "IP는 저장하지 않는다" 고지와 맞는지 법률 검토 때 함께 확인한다.

## 구조

| 파일 | 역할 |
|---|---|
| `index.html`, `js/app.js` | 랜딩 → 정보 입력 → 정면 → 정수리 → 검사 중 → 결과 |
| `js/vision.js` | MediaPipe 얼굴 랜드마크 + 머리카락 분할, 품질 검증, 정면 H·M / 정수리 P·V율·T율 측정 (`measureCrownGrid`는 DOM 없는 순수 함수) |
| `js/judge.js` | BASP 기본형·특이형 등급, 레벨 매핑, 대표 유형, 노우드 참고, 진행 가능성. **기준값 보정은 `THRESHOLDS`만 고치면 됨** |
| `js/content.js` | 모든 서비스 문구 (단계명, 톤, 유형 라벨·설명, 면책, 집계 고지, 실패 문구) |
| `js/render.js` | 정면/정수리 오버레이, 단계 일러스트(SVG), 스토리 카드 1080×1920 |
| `js/share.js` | Web Share API / 링크 복사 / 카드 저장 (인앱 브라우저는 길게 눌러 저장) |
| `js/stats.js`, `js/config.js`, `tools/stats.sql` | 익명 결과 집계 |
| `js/track.js` | 퍼널 이벤트 (`window.dataLayer` + `window.cheerupTrack` 훅). 사진·측정값·기본 정보는 넣지 않음 |
| `result/N/` | 공유 링크 착지 페이지 (단계 카드 + "나도 테스트하기") |
| `models/` | `face_landmarker.task` 3.6MB, `hair_segmenter.tflite` 0.8MB (총 4.5MB) |

### 퍼널 이벤트
`landing_view` → `start_click` → `info_complete` → `photo_upload`/`photo_pass`/`photo_fail{step,reason}` → `result_view{stage,type,variant}` → `share_click`/`share_done{channel}`/`save_click`/`card_saved`, `retry_click`, 공유 페이지의 `shared_view`/`shared_cta_click`.
- 완주율 = result_view / landing_view, 공유율 = share_click / result_view, 재촬영률 = photo_fail / photo_upload

## PRD와 다르게 구현한 부분 / PRD에 없어 정한 것

- **공유 URL**: `/result?stage=3` 대신 `/result/3/`. 정적 호스팅에서는 쿼리스트링으로 다른 HTML(=다른 og:image)을 줄 수 없다. `/result/?stage=3`로 들어와도 `/result/3/`로 리다이렉트된다.
- **가마 위치**: 사진에서 가마를 찾지 않고 가이드 원 한가운데로 본다. 촬영 가이드에 "가마가 원 한가운데에, 이마 쪽이 사진 위로"를 안내한다.
- **P 측정**: 정수리 사진의 각 열에서 머리 앞 윤곽(원래 헤어라인 추정) → 처음 나오는 머리카락 띠(3칸 이상)까지를 현재 헤어라인으로 본다. 머리 폭 가운데 50% 열들 중 80번째 백분위(가장 많이 후퇴한 쪽)를 P로 쓴다.
- **후퇴 영역 분리**: 현재 헤어라인 앞의 두피는 기본형 몫으로 보고 V율·T율에서 뺀다. V 원 반지름은 원 지름의 20%.
- **"후퇴가 있다"의 기준**: 정면 H > 1.1 이거나 P 등급 ≥ 1. 정면이 정상(L)이어도 P가 후퇴를 보이면 C형으로 본다.
- **대표 유형 동점**: 기본형 레벨 = 특이형 레벨이면 기본형을 대표로. V·F 동점이면 V.
- **정면 헤어라인을 못 찾을 때 M/C 구분**: 정수리 사진에서 관자놀이 쪽 후퇴가 가운데보다 10%p 이상 깊으면 M자형.
- **노우드 참고**: M2 + 정수리(V) 있음은 "III vertex", L/등급 0은 "I"로 표시한다.
- **기울기**: roll·yaw는 15°, pitch는 20° (랜드마크 깊이값의 기본 편차가 있어 조금 느슨하게).
- **옆 앞머리**: 관자놀이 쪽이 눈썹 바로 위에서 머리카락에 막히면 "앞머리를 올려 이마를 보여주세요"로 재촬영.

## 출시 전 확인할 것

- [ ] `hair_segmenter.tflite` 상업 이용 라이선스 최종 확인 (PRD 열린 항목)
- [ ] 팀원 사진 10~20장으로 `?debug=1` 보정 → `js/judge.js`의 `THRESHOLDS` 조정
- [ ] 실제 정수리 사진으로 P·V율·T율 측정 확인 (개발 중에는 합성 격자로만 검증). 특히 이마 피부가 찍혀 P가 부풀지 않는지, 가마가 원 가운데가 아닐 때 얼마나 틀어지는지
- [ ] 익명 집계: Supabase 연결(`js/config.js`) 여부 결정
- [ ] iOS Safari / Android Chrome / 카카오톡 인앱 브라우저 촬영·분석·공유
- [ ] 중급 안드로이드에서 분석 3초 이내인지 측정
- [ ] 일러스트: 단계 이미지는 `assets/stages/stage-N.jpg` (원본 `image/`, `js/render.js`의 `STAGE_IMAGES`). 교체 시 원본에서 같은 위치로 잘라 넣고 재빌드. 가이드 2장(`js/guides.js`)도 교체 필요
- [ ] 달걀 원본의 생성 도구 워터마크(✦)는 잘라냈지만, 이미지 사용 라이선스 확인
- [ ] 분석 도구 연결: `window.cheerupTrack` 정의
- [ ] 법률 검토 1회

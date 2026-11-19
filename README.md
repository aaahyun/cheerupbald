# 당신은 탈모입니까? (파일럿)

정면·정수리 사진 2장으로 노우드-해밀턴(남성)/루드비히(여성) 기준 단계를 보여주는 재미용 자가 체크.
**서버 없음**: 사진 분석·판정·결과 생성은 모두 브라우저에서 돌고, 사진은 어디에도 전송·저장되지 않는다.

## 실행

```bash
npm run serve        # http://localhost:8000  (모듈·모델 로드 때문에 file:// 로는 안 됨)
npm test             # 판정 로직 단위 테스트
```

- `?debug=1` : 결과 화면에 F·M·C·B·가르마 폭 측정값 표시 (기준값 보정용)
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

## 구조

| 파일 | 역할 |
|---|---|
| `index.html`, `js/app.js` | 랜딩 → 정보 입력 → 정면 → 정수리 → 검사 중 → 결과 |
| `js/vision.js` | MediaPipe 얼굴 랜드마크 + 머리카락 분할, 품질 검증, F·M·C·B·가르마 폭 측정 |
| `js/judge.js` | 기준표·경계값(`THRESHOLDS`)·판정 규칙·진행 가능성. **기준값 보정은 여기만 고치면 됨** |
| `js/content.js` | 모든 서비스 문구 (단계명, 톤, 면책, 실패 문구) |
| `js/render.js` | 정면/정수리 오버레이, 단계 일러스트(SVG), 스토리 카드 1080×1920 |
| `js/share.js` | Web Share API / 링크 복사 / 카드 저장 (인앱 브라우저는 길게 눌러 저장) |
| `js/track.js` | 퍼널 이벤트 (`window.dataLayer` + `window.cheerupTrack` 훅). 사진·측정값·기본 정보는 넣지 않음 |
| `result/N/` | 공유 링크 착지 페이지 (단계 카드 + "나도 테스트하기") |
| `models/` | `face_landmarker.task` 3.6MB, `hair_segmenter.tflite` 0.8MB (총 4.5MB) |

### 퍼널 이벤트
`landing_view` → `start_click` → `info_complete` → `photo_upload`/`photo_pass`/`photo_fail{step,reason}` → `result_view{stage,variant}` → `share_click`/`share_done{channel}`/`save_click`/`card_saved`, `retry_click`, 공유 페이지의 `shared_view`/`shared_cta_click`.
- 완주율 = result_view / landing_view, 공유율 = share_click / result_view, 재촬영률 = photo_fail / photo_upload

## PRD와 다르게 구현한 부분

- **공유 URL**: `/result?stage=3` 대신 `/result/3/`. 정적 호스팅에서는 쿼리스트링으로 다른 HTML(=다른 og:image)을 줄 수 없다. `/result/?stage=3`로 들어와도 `/result/3/`로 리다이렉트된다.
- **정수리 C의 분모**: 원 전체가 아니라 원 안의 "머리 영역(머리카락+두피)" 픽셀. 둥근 머리가 원을 다 채우지 못해 배경이 C를 깎는 것을 막는다.
- **정수리 사진 방향**: B(앞-정수리 띠) 판정을 위해 "이마 쪽이 사진 위로" 오게 찍도록 가이드에 추가.
- **가르마 폭 경계 허용치**: PRD에 없어 ±1%p로 정함. 둥근 탈모 부위는 가르마로 치지 않고 C로만 반영한다.
- **기울기**: roll·yaw는 15°, pitch는 20° (랜드마크 깊이값의 기본 편차가 있어 조금 느슨하게).
- **옆 앞머리**: 관자놀이 쪽이 눈썹 바로 위에서 머리카락에 막히면 "앞머리를 올려 이마를 보여주세요"로 재촬영.
- **여성 정면 오버레이**: 단계별 대표 헤어라인 대신 측정된 내 헤어라인을 그린다 (루드비히는 앞머리 후퇴 기준이 아니라서).

## 출시 전 확인할 것

- [ ] `hair_segmenter.tflite` 상업 이용 라이선스 최종 확인 (PRD 열린 항목)
- [ ] 팀원 사진 10~20장으로 `?debug=1` 보정 → `js/judge.js`의 `THRESHOLDS` 조정
- [ ] 실제 정수리 사진으로 C·B·가르마 측정 확인 (개발 중에는 합성 이미지로만 검증)
- [ ] iOS Safari / Android Chrome / 카카오톡 인앱 브라우저 촬영·분석·공유
- [ ] 중급 안드로이드에서 분석 3초 이내인지 측정
- [ ] 일러스트 교체: `js/guides.js`(가이드 2장), `stageSVG`(단계 5장), `assets/og/` (재빌드)
- [ ] 분석 도구 연결: `window.cheerupTrack` 정의
- [ ] 법률 검토 1회

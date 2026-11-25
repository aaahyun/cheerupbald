import { loadModels, fileToCanvas, analyzeFront, analyzeCrown, QualityError, CROWN_CIRCLE } from './vision.js';
import { judge, norwoodRef, progression, expectation, focusFromAreas } from './judge.js';
import {
  STAGES, TYPES, EXTRA_NOTES, PROGRESSION, FAIL_MESSAGES, ANALYZING_STEPS, DISCLAIMER, PRIVACY_NOTE, STATS_NOTE,
  AREAS, AREA_STATUS, FOCUS_LABELS, REP_AREA, SCALP_TYPES, SCALP_TIPS, SYMPTOMS, SYMPTOM_CONSULT, SYMPTOM_CONSULT_KEYS,
  EXPECTATION, EXPECTATION_SHEDDING, EXPECTATION_BOOSTED,
} from './content.js';
import { stageArt, eggLineup, drawFrontOverlay, drawCrownOverlay } from './render.js';
import { icon, hydrateIcons } from './icons.js';
import { GUIDES } from './guides.js';
import { shareLink, saveCard } from './share.js';
import { track } from './track.js';
import { countResult, levelShare } from './stats.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ───────────────────────── 상태 ─────────────────────────
// 사진·측정값은 이 메모리 객체에만 있고, 탭을 닫으면 사라진다.
const state = {
  info: { suspect: null, gender: null, age: null, family: null },
  concern: emptyConcern(), // 의심 중(suspect=yes)일 때만 채운다
  front: null, frontCanvas: null,
  crown: null, crownCanvas: null,
  result: null,
  pendingError: null,
  busy: false,
  variant: pickVariant(),
};
// ?debug=1 : 결과 화면에 측정값 표시 (기준값 보정용, 팀 내부 테스트 전용)
const DEBUG = new URLSearchParams(location.search).has('debug');
if (DEBUG) window.__cub = state;

function emptyConcern() {
  return { areas: [], scalp: null, symptoms: [], shedding: null };
}

function pickVariant() {
  const q = new URLSearchParams(location.search).get('variant');
  if (q && /^[ab]$/i.test(q)) return q.toUpperCase();
  try {
    let v = localStorage.getItem('cub_variant');
    if (v !== 'A' && v !== 'B') { v = Math.random() < 0.5 ? 'A' : 'B'; localStorage.setItem('cub_variant', v); }
    return v;
  } catch {
    return Math.random() < 0.5 ? 'A' : 'B';
  }
}

// ───────────────────────── 화면 전환 ─────────────────────────
let current = { screen: null, step: null };
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function show(screen, step = null) {
  const apply = () => {
    current = { screen, step };
    $$('.screen').forEach((s) => { s.hidden = s.dataset.screen !== screen; });
    if (screen === 'capture') renderCapture(step);
    if (screen === 'result') renderResult();
    updateProgress();
    window.scrollTo(0, 0);
  };
  // 화면 전환은 View Transition 으로 (미지원 브라우저는 CSS 등장 애니메이션)
  if (document.startViewTransition && current.screen && !reduceMotion()) {
    document.documentElement.classList.add('vt');
    document.startViewTransition(apply);
  } else {
    apply();
  }
}

// 상단 달걀 진행 표시: 의심 여부 → 기본 정보 → (고민 체크) → 정면 → 정수리
function updateProgress() {
  const steps = ['suspect', 'info', ...(needsConcern() ? ['concern'] : []), 'front', 'crown'];
  const names = { suspect: '의심 여부', info: '기본 정보', concern: '고민 체크', front: '정면 사진', crown: '정수리 사진' };
  const key = current.screen === 'capture' ? current.step : current.screen;
  const idx = steps.indexOf(key);
  if (idx < 0) return;
  const pad = (n) => String(n).padStart(2, '0');
  const sec = $(`[data-screen="${current.screen}"]`);
  $('.eggbar', sec).innerHTML = steps.map((_, i) => `<i class="${i < idx ? 'done' : i === idx ? 'now' : ''}"></i>`).join('');
  $('.progress', sec).textContent = `${pad(idx + 1)} / ${pad(steps.length)} · ${names[key]}`;
}

function go(screen, step = null, { replace = false } = {}) {
  const st = { screen, step };
  if (replace) history.replaceState(st, ''); else history.pushState(st, '');
  show(screen, step);
}

window.addEventListener('popstate', (e) => {
  let { screen, step } = e.state || { screen: 'landing' };
  if (screen === 'analyzing') { screen = 'capture'; step = 'crown'; }
  if (screen === 'result' && !state.result) screen = 'landing';
  if (screen === 'capture' && step === 'crown' && !state.front) step = 'front';
  if (['info', 'concern', 'capture'].includes(screen) && !state.info.suspect) screen = 'suspect';
  else if ((screen === 'capture' || screen === 'concern') && !infoComplete()) screen = 'info';
  else if (screen === 'concern' && !needsConcern()) screen = 'info';
  else if (screen === 'capture' && needsConcern() && !concernComplete()) screen = 'concern';
  show(screen, step);
});

// ───────────────────────── 랜딩 ─────────────────────────
function initLanding() {
  // 큰 달걀 5장을 겹쳐 두고 하나씩 켠다 + 아래 라인업에서 같은 달걀에 스포트라이트
  const hero = $('#heroEgg');
  hero.innerHTML = [1, 2, 3, 4, 5].map((s) => stageArt(s, { size: 300 })).join('');
  $('#landingLineup').innerHTML = eggLineup(0, { names: false });
  const imgs = $$('img', hero);
  const slots = $$('#landingLineup .egg-slot');
  let s = 1;
  const tick = () => {
    imgs.forEach((im, i) => im.classList.toggle('on', i + 1 === s));
    slots.forEach((el, i) => el.classList.toggle('is-lit', i + 1 === s));
    $('#heroCaption').innerHTML = `<b>LV.${String(s).padStart(2, '0')}</b>${STAGES[s].name}`;
    s = (s % 5) + 1;
  };
  tick();
  if (!reduceMotion()) setInterval(() => { if (current.screen === 'landing') tick(); }, 1600);
  hero.addEventListener('click', () => {
    hero.classList.remove('wobble');
    void hero.offsetWidth; // 애니메이션 재시작
    hero.classList.add('wobble');
  });
  $$('[data-disclaimer]').forEach((el) => { el.textContent = DISCLAIMER; });
  $$('[data-privacy]').forEach((el) => { el.textContent = PRIVACY_NOTE; });
}

// ───────────────────────── 기본 정보 · 고민 체크 ─────────────────────────
const infoComplete = () => Object.values(state.info).every(Boolean);
const needsConcern = () => state.info.suspect === 'yes';
const concernComplete = () => {
  const c = state.concern;
  return c.areas.length > 0 && !!c.scalp && c.symptoms.length > 0 && !!c.shedding;
};

function syncChoices(group) {
  const owner = group.closest('[data-screen]').dataset.screen === 'concern' ? state.concern : state.info;
  const v = owner[group.dataset.field];
  $$('button', group).forEach((b) => {
    const on = Array.isArray(v) ? v.includes(b.dataset.value) : v === b.dataset.value;
    b.setAttribute('aria-pressed', String(on));
  });
}

function initInfo() {
  $$('.choices').forEach((group) => {
    const field = group.dataset.field;
    const isConcern = group.closest('[data-screen]').dataset.screen === 'concern';
    const multi = group.hasAttribute('data-multi');
    group.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      const owner = isConcern ? state.concern : state.info;
      const val = btn.dataset.value;
      if (multi) {
        // 여러 개 선택. data-exclusive(없음)는 다른 것과 함께 고를 수 없다
        const excl = $$('[data-exclusive]', group).map((b) => b.dataset.value);
        let list = owner[field];
        if (list.includes(val)) list = list.filter((x) => x !== val);
        else if (excl.includes(val)) list = [val];
        else list = [...list.filter((x) => !excl.includes(x)), val];
        owner[field] = list;
      } else {
        owner[field] = val;
      }
      syncChoices(group);
      if (field === 'suspect') onSuspectChange();
      $('[data-action="info-next"]').disabled = !infoComplete();
      $('[data-action="concern-next"]').disabled = !concernComplete();
    });
    syncChoices(group);
  });
}

// 의심 여부 화면은 질문 하나뿐이라, 고르면 눌린 모습을 잠깐 보여준 뒤 바로 기본 정보로 간다.
let suspectTimer = 0;
function onSuspectChange() {
  if (!needsConcern()) {
    state.concern = emptyConcern();
    $$('[data-screen="concern"] .choices').forEach(syncChoices);
  }
  clearTimeout(suspectTimer); // 연달아 눌러도 한 번만 넘어간다
  suspectTimer = setTimeout(() => {
    if (current.screen !== 'suspect') return;
    track('suspect_answer', { suspect: state.info.suspect });
    go('info');
  }, reduceMotion() ? 0 : 320);
}

// ───────────────────────── 촬영 ─────────────────────────
function setStatus(kind, html) {
  const el = $('#capStatus');
  if (!kind) { el.hidden = true; return; }
  el.className = `cap-status ${kind}`;
  const ico = kind === 'ok' ? icon('check', 18) : kind === 'err' ? icon('alert', 18) : '';
  el.innerHTML = ico + `<span>${html}</span>`;
  el.hidden = false;
  if (kind === 'err') {
    const f = $('#capFrame');
    f.classList.remove('shake');
    void f.offsetWidth;
    f.classList.add('shake');
  }
}
const OK_MSG = '좋아요! 잘 찍혔어요';
const setShootLabel = (t) => { $('#capShootLabel .lbl').textContent = t; };
const setNextLabel = (step) => {
  $('#capNext').innerHTML = `${step === 'front' ? '다음' : '결과 보기'} ${icon('arrow')}`;
};

function previewCanvas(canvas, step) {
  const size = 720;
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, size, size);
  if (step === 'crown') {
    // 분석에 쓰는 원과 같은 영역을 보여준다
    const r = Math.min(canvas.width, canvas.height) * CROWN_CIRCLE.radiusRatio;
    const sx = canvas.width / 2 - r, sy = canvas.height / 2 - r;
    ctx.drawImage(canvas, sx, sy, 2 * r, 2 * r, 0, 0, size, size);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; ctx.setLineDash([18, 14]);
    ctx.beginPath(); ctx.arc(size / 2, size / 2, size / 2 - 4, 0, Math.PI * 2); ctx.stroke();
  } else {
    const k = Math.min(size / canvas.width, size / canvas.height);
    const w = canvas.width * k, h = canvas.height * k;
    ctx.drawImage(canvas, (size - w) / 2, (size - h) / 2, w, h);
  }
  return c;
}

function renderCapture(step) {
  const g = GUIDES[step];
  $('#capTitle').textContent = g.title;
  $('#capHud').textContent = step === 'front' ? 'Front' : 'Crown';
  $('#capTips').innerHTML = g.tips.map((t) => `<li>${t}</li>`).join('');
  $('#capShoot').setAttribute('capture', g.capture);
  const done = state[step];
  const guide = $('#capGuide');
  $('#capFrame').classList.toggle('has-photo', !!done);
  if (done) {
    guide.replaceChildren(previewCanvas(state[`${step}Canvas`], step));
    setStatus('ok', OK_MSG);
  } else {
    guide.innerHTML = g.svg;
    setStatus(null);
  }
  if (state.pendingError) {
    setStatus('err', FAIL_MESSAGES[state.pendingError]);
    state.pendingError = null;
  }
  $('#capNext').hidden = !done;
  setNextLabel(step);
  setShootLabel(done ? '다시 찍기' : '촬영하기');
}

async function handleFile(file) {
  const step = current.step;
  if (!file || state.busy || current.screen !== 'capture') return;
  state.busy = true;
  state[step] = null;
  $('#capNext').hidden = true;
  track('photo_upload', { step });

  const modelsReady = await Promise.race([loadModels().then(() => true, () => false), sleep(50).then(() => null)]);
  setStatus('busy', `<span class="spinner"></span>${modelsReady === null ? '분석 도구 준비 중… (처음 한 번만)' : '사진 확인 중…'}`);

  try {
    const canvas = await fileToCanvas(file);
    $('#capGuide').replaceChildren(previewCanvas(canvas, step));
    $('#capFrame').classList.add('has-photo');
    setStatus('busy', '<span class="spinner"></span>사진 확인 중…');
    const result = step === 'front' ? await analyzeFront(canvas) : await analyzeCrown(canvas);
    if (current.step !== step) return; // 처리 중 화면이 바뀜
    state[step] = result;
    state[`${step}Canvas`] = canvas;
    setStatus('ok', OK_MSG);
    $('#capNext').hidden = false;
    setShootLabel('다시 찍기');
    track('photo_pass', { step });
  } catch (err) {
    const reason = err instanceof QualityError ? err.reason : 'model';
    const msg = FAIL_MESSAGES[reason] || '분석 도구를 불러오지 못했어요. 네트워크를 확인하고 다시 시도해주세요';
    if (reason === 'model') console.error(err);
    setStatus('err', msg);
    setShootLabel('다시 찍기');
    track('photo_fail', { step, reason });
  } finally {
    state.busy = false;
  }
}

function initCapture() {
  for (const id of ['capShoot', 'capAlbum']) {
    const input = $(`#${id}`);
    input.addEventListener('change', () => {
      const f = input.files && input.files[0];
      input.value = ''; // 같은 파일을 다시 골라도 change가 나도록
      handleFile(f);
    });
  }
  $('#capNext').addEventListener('click', () => {
    if (current.step === 'front') go('capture', 'crown');
    else runAnalysis();
  });
}

// ───────────────────────── 검사 중 ─────────────────────────
async function runAnalysis() {
  go('analyzing', null, { replace: true });
  const text = $('#analyzeText');
  const lab = $('#lab');
  const steps = $('#labSteps');
  steps.innerHTML = ANALYZING_STEPS.map(() => '<li></li>').join('');
  const bars = $$('li', steps);

  const { info, front, crown } = state;
  const concern = needsConcern() ? state.concern : null;
  const focus = concern ? focusFromAreas(concern.areas) : new Set();
  const judged = judge(front, crown, focus);

  // 내 사진 위에 실제 측정 결과를 단계적으로 그린다 (사진은 이 화면에서만 쓰고 저장하지 않음)
  const plates = setupLabPlates(judged);
  lab.classList.remove('done');
  const t0 = performance.now();
  const clock = setInterval(() => { $('#labClock').textContent = `${((performance.now() - t0) / 1000).toFixed(1)}s`; }, 100);

  // 최소 3초 노출: 문구 4개 × 900ms
  for (let i = 0; i < ANALYZING_STEPS.length; i++) {
    text.textContent = ANALYZING_STEPS[i];
    bars.forEach((b, k) => b.classList.toggle('on', k <= i));
    if (i === 0) plates.front.classList.add('on');
    if (i === 1) plates.front.classList.add('drawn');
    if (i === 2) { plates.front.classList.remove('on'); plates.crown.classList.add('on'); setTimeout(() => plates.crown.classList.add('drawn'), 350); }
    if (i === 3) lab.classList.add('done');
    await sleep(900);
  }
  clearInterval(clock);

  if (judged.retake) {
    // 판정 규칙 5: 정면·정수리 둘 다로 기본형을 못 정하면 재촬영
    const step = judged.retake;
    state[step] = null;
    state[`${step}Canvas`] = null;
    state.pendingError = step === 'front' ? 'hairline' : 'crown_again';
    track('photo_fail', { step, reason: 'judge_retake' });
    go('capture', step, { replace: true });
    return;
  }
  const norwood = info.gender === 'm' ? norwoodRef(judged) : null;
  state.result = {
    judged, level: judged.level, norwood, concern, focus,
    prog: progression(info, judged.level, concern),
    expect: expectation(info, concern, judged),
    counted: false,
  };
  go('result', null, { replace: true });
}

// 검사 화면 도판: 원본 사진(base) 위에 측정 오버레이(ov)를 겹친다. 재촬영 판정이면 원본만.
function setupLabPlates(judged) {
  const front = $('[data-plate="front"]'), crown = $('[data-plate="crown"]');
  [front, crown].forEach((p) => { p.className = p.className.replace(/\s*(on|drawn)\b/g, ''); p.replaceChildren(); });
  try {
    const geom = state.front.geom;
    const base = cropFace(state.frontCanvas, geom);
    base.className = 'base';
    front.append(base);
    if (!judged.retake) {
      const ov = cropFace(drawFrontOverlay(state.frontCanvas, state.front, judged, state.variant), geom);
      ov.className = 'ov';
      front.append(ov);
    }
  } catch (e) { console.warn(e); }
  try {
    const { cx, cy, r } = state.crown.grid;
    const size = Math.round(2 * r);
    const base = document.createElement('canvas');
    base.width = size; base.height = size;
    base.getContext('2d').drawImage(state.crownCanvas, cx - r, cy - r, size, size, 0, 0, size, size);
    base.className = 'base';
    crown.append(base);
    if (!judged.retake) {
      const ov = drawCrownOverlay(state.crownCanvas, state.crown, judged);
      ov.className = 'ov';
      crown.append(ov);
    }
  } catch (e) { console.warn(e); }
  return { front, crown };
}

// ───────────────────────── 결과 ─────────────────────────

function typeLabel(judged) {
  return [TYPES[judged.rep].label, ...judged.extra.map((k) => `+ ${EXTRA_NOTES[k].label}`)].join(' ');
}

const fill = (tpl, vars) => tpl.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
const joinKo = (arr) => arr.join(', ');

function expectBanner(st) {
  const { judged, concern, expect } = state.result;
  const e = EXPECTATION[expect.match];
  const hitOnly = ['confirmed', 'early'].includes(expect.match);
  const worried = expect.areas.filter((a) => !hitOnly || a.status >= 1);
  const vars = {
    areas: joinKo(worried.map((a) => AREAS[a.key].short)),
    other: REP_AREA[judged.rep],
  };
  const lines = [fill(e.text, vars)];
  if (['relief', 'fine'].includes(expect.match) && concern?.shedding === 'lots') lines.push(EXPECTATION_SHEDDING);
  if (judged.boosted.length) lines.push(fill(EXPECTATION_BOOSTED, { parts: joinKo(judged.boosted.map((k) => FOCUS_LABELS[k])) }));
  const guess = concern
    ? joinKo(expect.areas.map((a) => AREAS[a.key].short)) + ' 걱정'
    : '그냥 궁금했어요';
  return `<div class="expect will-in">
    <div class="expect-vs">
      <div><small>내 예상</small><b>${guess}</b></div>
      <div class="arrow">${icon('arrow', 18)}</div>
      <div class="res"><small>결과</small><b>${e.title}</b></div>
    </div>
    <div class="expect-body">${lines.map((l) => `<p>${l}</p>`).join('')}</div>
  </div>`;
}

function concernCards(judged) {
  const { concern, expect } = state.result;
  if (!concern) return '';
  const marked = new Set([judged.rep, ...judged.extra]);
  const rows = expect.areas.map(({ key, status }) => {
    const a = AREAS[key];
    const stx = AREA_STATUS[Math.min(status, 2)];
    const onPhoto = status > 0 && ((key === 'crown' && marked.has('V')) || (key === 'part' && marked.has('F'))
      || (key === 'diffuse' && (marked.has('V') || marked.has('F'))));
    const note = a.note || (onPhoto ? '사진에 표시했어요' : '');
    return `<li><span>${a.label}${note ? `<span class="note">${note}</span>` : ''}</span><span class="chip ${stx.tone}">${stx.label}</span></li>`;
  }).join('');
  const sym = concern.symptoms.filter((k) => k !== 'none').map((k) => SYMPTOMS[k]);
  const symLine = sym.length ? `<p class="type-extra">요즘 느끼는 증상: ${joinKo(sym)}</p>` : '';
  return `
    <div class="card will-in"><h3>걱정한 부위 체크</h3><ul class="area-list">${rows}</ul></div>
    <div class="card will-in"><h3>두피 상태</h3><p class="h">${SCALP_TYPES[concern.scalp]}</p><p>${SCALP_TIPS[concern.scalp]}</p>${symLine}</div>`;
}

function consultCard(st) {
  const sym = state.result.concern?.symptoms.some((k) => SYMPTOM_CONSULT_KEYS.includes(k));
  const lines = [st.consult, sym ? SYMPTOM_CONSULT : null].filter(Boolean);
  if (!lines.length) return '';
  return `<div class="card consult will-in"><h3>상담 안내</h3>${lines.map((l) => `<p>${l}</p>`).join('')}</div>`;
}

function progCard(prog) {
  if (!prog.level) return '';
  const p = PROGRESSION[prog.level];
  const gauge = prog.level === 'teen' ? '' : `<div class="gauge" role="img" aria-label="진행 가능성 ${p.label}">${['low', 'mid', 'high']
    .map((k) => `<span class="${k === prog.level ? 'on' : ''}">${PROGRESSION[k].label}</span>`).join('')}</div>`;
  const why = prog.reasons.length ? `<p class="prog-why">${prog.reasons.join(' · ')}</p>` : '';
  return `<div class="card will-in"><h3>진행 가능성</h3><p class="h">${p.label}</p>${gauge}<p>${p.text}</p>${why}</div>`;
}

const todayLabel = () => {
  const d = new Date();
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
};

// 리빌: 라인업 위 스포트라이트가 1→내 레벨까지 이동 → 큰 달걀 착지 → 이름 등장 → 레벨 색 번짐
async function revealResult(root, level) {
  const screen = root.closest('.screen');
  const slots = $$('.lineup .egg-slot', root);
  const finish = () => {
    slots.forEach((el) => el.classList.remove('is-lit'));
    slots[level - 1].classList.add('is-me');
    root.classList.remove('pre');
    screen.classList.add('lit');
  };
  if (state.result.revealed || reduceMotion()) { finish(); return; }
  state.result.revealed = true;
  await sleep(250);
  for (let s = 1; s <= level; s++) {
    if (!root.isConnected) return;
    slots.forEach((el, i) => el.classList.toggle('is-lit', i + 1 === s));
    await sleep(s === level ? 120 : 260);
  }
  finish();
  const egg = $('.big-egg', root);
  setTimeout(() => egg.classList.add('land'), 380);
  try { navigator.vibrate?.(30); } catch { /* 미지원 */ }
}

function observeIn(root) {
  const els = $$('.will-in', root);
  if (!('IntersectionObserver' in window) || reduceMotion()) { els.forEach((el) => el.classList.add('in')); return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
  }, { rootMargin: '0px 0px -8% 0px' });
  els.forEach((el, i) => { el.style.setProperty('--i', i % 3); io.observe(el); });
}

function renderResult() {
  const { judged, level: s, norwood, prog } = state.result;
  const st = STAGES[s];
  const typeNotes = judged.extra.map((k) => `<p class="type-extra">${EXTRA_NOTES[k].desc}</p>`).join('');
  const frontCap = ['M', 'C'].includes(judged.basic.type)
    ? (state.variant === 'B' ? '등급별 헤어라인' : '내 등급 헤어라인') : '내 헤어라인';
  const typeChips = [TYPES[judged.rep].label, ...judged.extra.map((k) => `+ ${EXTRA_NOTES[k].label}`)];
  const screen = $('[data-screen="result"]');
  screen.style.setProperty('--lv', st.color);
  screen.classList.remove('lit');

  $('#resultBody').innerHTML = `
    <article class="result pre" aria-label="${typeLabel(judged)} 레벨 ${s} ${st.name}">
    <header class="result-hero">
      <p class="eyebrow rule"><span>Specimen Report</span><span>${todayLabel()}</span></p>
      <div class="big-egg">${stageArt(s, { size: 250 })}</div>
      ${eggLineup(0)}
      <div class="reveal-text">
        <p class="level-chip"><i></i>레벨 ${s} / 5</p>
        <h1 class="stage-name">${st.name}</h1>
        <ul class="type-chips">${typeChips.map((t) => `<li>${t}</li>`).join('')}</ul>
        <p class="tone">${st.tone}</p>
        ${norwood ? `<p class="scale-ref">노우드-해밀턴 기준으로는 대략 ${norwood}형에 가까워요 (참고)</p>` : ''}
        <p class="peer-stat" id="peerStat" hidden></p>
      </div>
    </header>
    ${expectBanner(st)}
    <section class="figs will-in">
      <figure class="fig"><div id="ovFront"></div><figcaption><b>FIG.1</b>${frontCap}</figcaption></figure>
      <figure class="fig"><div id="ovCrown"></div><figcaption><b>FIG.2</b>정수리 노출 영역</figcaption></figure>
    </section>
    <p class="photo-note">${icon('lock', 13)}사진은 이 화면에만 보이고 저장되지 않아요</p>
    <div class="card will-in"><h3>내 상태</h3><p class="h">${st.name}</p><p>${st.desc}</p></div>
    <div class="card will-in"><h3>내 유형</h3><p class="h">${TYPES[judged.rep].label}</p><p>${TYPES[judged.rep].desc}</p>${typeNotes}</div>
    ${concernCards(judged)}
    ${consultCard(st)}
    ${progCard(prog)}
    <div class="actions-bar">
      <button class="btn primary" data-action="share">${icon('share')}결과 공유하기</button>
      <button class="btn icon" data-action="save" aria-label="이미지 저장">${icon('download')}</button>
    </div>
    <div class="retry-row"><button class="btn ghost" data-action="retry">${icon('retry', 18)}다시 하기</button></div>
    <footer class="disclaimer">${DISCLAIMER}<br>${STATS_NOTE}</footer>
    ${DEBUG ? `<pre class="debug">${debugText()}</pre>` : ''}
    </article>
  `;
  const fc = drawFrontOverlay(state.frontCanvas, state.front, judged, state.variant);
  $('#ovFront').replaceWith(cropFace(fc, state.front.geom));
  $('#ovCrown').replaceWith(drawCrownOverlay(state.crownCanvas, state.crown, judged));
  const root = $('#resultBody .result');
  revealResult(root, s);
  observeIn(root);
  let counted = Promise.resolve();
  if (!state.result.counted) {
    // 결과 화면 진입 시 1회 (뒤로·앞으로 가기로 다시 그려도 다시 세지 않는다)
    state.result.counted = true;
    counted = countResult({
      level: s, type: judged.rep, gender: state.info.gender, age: state.info.age,
      suspect: needsConcern() ? 'y' : 'n', match: state.result.expect.match,
    });
    track('result_view', { stage: s, type: judged.rep, variant: state.variant, match: state.result.expect.match });
  }
  // 내 기록이 반영된 뒤 읽는다. 실패하면 문구를 아예 띄우지 않는다.
  const { gender, age } = state.info;
  counted.then(() => levelShare(s, gender, age)).then((share) => {
    const el = $('#peerStat', root);
    // 나 혼자뿐인 그룹이면 "100%"가 되어 의미가 없으니 띄우지 않는다
    if (!share || share.total < 3 || !el || !root.isConnected) return;
    const pct = Math.round((share.same / share.total) * 100);
    const group = `${age === '50' ? '50대 이상' : `${age}대`} ${gender === 'm' ? '남성' : '여성'}`;
    el.innerHTML = `나와 같은 <b>${group}</b>의 <b>${pct}%</b>가 나와 같은 레벨 ${s}${[1, 3].includes(s) ? '이에요' : '예요'}`;
    el.hidden = false;
  });
}

function debugText() {
  const f = state.front, c = state.crown, j = state.result.judged, r = (v, d = 2) => (v == null ? '–' : v.toFixed(d));
  return [
    `variant ${state.variant} · ${j.code} · rep ${j.rep} · level ${j.level} · norwood ${state.result.norwood ?? '–'}`,
    `H ${r(f.H)}  M ${r(f.M)}  hairlineMissing ${f.hairlineMissing}`,
    `P ${r(c.P, 1)}%  uPos ${r(c.uPos, 1)}%  shape ${c.shape}  V ${r(c.V, 1)}%  T ${r(c.T, 1)}%  vtConnected ${c.vtConnected}`,
    `progression ${JSON.stringify(state.result.prog)}`,
    `focus [${[...state.result.focus].join(',')}] · boosted [${j.boosted.join(',')}] · match ${state.result.expect.match}`,
    `concern ${JSON.stringify(state.result.concern)}`,
  ].join('\n');
}

// 정면 오버레이를 얼굴 중심 정사각형으로 자른다
function cropFace(canvas, geom) {
  const { browC, U } = geom;
  const half = U * 2.7;
  const cx = browC.x, cy = browC.y - U * 0.8;
  const c = document.createElement('canvas');
  const size = 720;
  c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#eee';
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(canvas, cx - half, cy - half, half * 2, half * 2, 0, 0, size, size);
  return c;
}

// ───────────────────────── 액션 ─────────────────────────
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const a = el.dataset.action;
  if (a === 'start') {
    track('start_click');
    go('suspect');
    loadModels().catch(() => {}); // 정보 입력 중 미리 로드
  } else if (a === 'back') {
    history.back();
  } else if (a === 'info-next') {
    if (!infoComplete()) return;
    track('info_complete', { suspect: state.info.suspect });
    if (needsConcern()) go('concern');
    else go('capture', 'front');
  } else if (a === 'concern-next') {
    if (!concernComplete()) return;
    track('concern_complete', { areas: state.concern.areas.length });
    go('capture', 'front');
  } else if (a === 'share') {
    track('share_click', { stage: state.result.level, variant: state.variant });
    shareLink(state.result.level);
  } else if (a === 'save') {
    track('save_click', { stage: state.result.level });
    saveCard(state.result.level);
  } else if (a === 'retry') {
    track('retry_click', { stage: state.result.level });
    Object.assign(state, { front: null, frontCanvas: null, crown: null, crownCanvas: null, result: null });
    go('capture', 'front');
  } else if (a === 'close-sheet') {
    $('#sheet').hidden = true;
  }
});

// ───────────────────────── 시작 ─────────────────────────
hydrateIcons();
initLanding();
initInfo();
initCapture();
history.replaceState({ screen: 'landing' }, '');
show('landing');
track('landing_view', { variant: state.variant });

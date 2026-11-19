// 공유 링크로 들어온 사람의 단계 카드 페이지 (result/N/)
import { track } from './track.js';
import { shareLink } from './share.js';

const stage = Number(document.body.dataset.stage);
const root = new URL('../../', location.href).href;
track('shared_view', { stage });
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  if (el.dataset.action === 'cta') track('shared_cta_click', { stage });
  if (el.dataset.action === 'share') { track('share_click', { stage, from: 'shared' }); shareLink(stage, root); }
});

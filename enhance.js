/* ══════════════════════════════════════════════════════════════
   enhance.js — 풍선 메타포 강화 + 파티클 + Tweaks 패널
   game.js 의 동작을 손대지 않고 시각만 강화합니다.
   ══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ─────────────────────────────────────────────
     1) 카드/카테고리 버튼에 data-category-idx 태깅
        — 카테고리별 색상 매핑용
        — game.js 가 DOM을 갈아엎으므로 MutationObserver 사용
     ───────────────────────────────────────────── */
  function getCategoryIndex(categoryName) {
    if (typeof state === 'undefined' || !state.currentTopic) return -1;
    return state.currentTopic.categories.findIndex(c => c.name === categoryName);
  }

  function tagCards() {
    if (typeof state === 'undefined' || !state.cards) return;
    document.querySelectorAll('#cards-grid .card').forEach(el => {
      const id = Number(el.dataset.cardId);
      const card = state.cards.find(c => c.id === id);
      if (!card) return;
      // 카드에는 카테고리 색 힌트를 주지 않음 (정답 유추 방지)
      // data-category-idx 를 의도적으로 설정하지 않는다
      // 풍선마다 살짝 다른 떠다님 (자연스럽게)
      if (!el.style.getPropertyValue('--float-delay')) {
        el.style.setProperty('--float-delay', (Math.random() * -3).toFixed(2) + 's');
        el.style.setProperty('--float-dur', (3 + Math.random() * 1.8).toFixed(2) + 's');
      }
    });
  }

  function tagCategoryButtons() {
    document.querySelectorAll('#category-buttons .category-btn').forEach(btn => {
      const name = btn.dataset.category;
      if (!name) return;
      const idx = getCategoryIndex(name);
      if (idx >= 0) btn.dataset.categoryIdx = idx;
    });
  }

  // cards-grid + category-buttons 변경 감시
  function observeGameDOM() {
    const grid = document.getElementById('cards-grid');
    const catBox = document.getElementById('category-buttons');
    if (grid) {
      new MutationObserver(() => tagCards()).observe(grid, { childList: true, subtree: false });
    }
    if (catBox) {
      new MutationObserver(() => tagCategoryButtons()).observe(catBox, { childList: true });
    }
    tagCards();
    tagCategoryButtons();
  }


  /* ─────────────────────────────────────────────
     2) 풍선 터지는 파티클 (Canvas)
     ───────────────────────────────────────────── */
  const canvas = document.getElementById('confetti-canvas');
  const ctx = canvas ? canvas.getContext('2d') : null;
  let particles = [];
  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  let confettiEnabled = true;
  let rafId = null;

  function resizeCanvas() {
    if (!canvas) return;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    if (ctx) ctx.scale(dpr, dpr);
  }
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  // 카테고리 색을 CSS 변수에서 읽어오기
  function getBalloonColors() {
    const root = getComputedStyle(document.body);
    return [0,1,2,3,4].map(i => root.getPropertyValue('--balloon-' + i).trim() || '#7c4dff');
  }

  function spawnBurst(x, y, baseColor) {
    if (!confettiEnabled || !ctx) return;
    const colors = getBalloonColors();
    const N = 24;
    for (let i = 0; i < N; i++) {
      const angle = (Math.PI * 2 * i) / N + (Math.random() - 0.5) * 0.4;
      const speed = 3 + Math.random() * 5;
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        life: 1.0,
        decay: 0.018 + Math.random() * 0.012,
        size: 4 + Math.random() * 5,
        color: baseColor || colors[Math.floor(Math.random() * colors.length)],
        rot: Math.random() * Math.PI * 2,
        vrot: (Math.random() - 0.5) * 0.3,
        gravity: 0.18,
        shape: Math.random() < 0.4 ? 'balloon' : 'rect',
      });
    }
    // 한가운데 광채 한 번
    particles.push({
      x, y, vx: 0, vy: 0,
      life: 0.6, decay: 0.05,
      size: 30, color: baseColor || '#fff',
      rot: 0, vrot: 0, gravity: 0,
      shape: 'flash',
    });
    if (!rafId) loop();
  }

  function loop() {
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles = particles.filter(p => p.life > 0);
    if (particles.length === 0) { rafId = null; return; }
    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.rot += p.vrot;
      p.life -= p.decay;

      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;

      if (p.shape === 'flash') {
        ctx.globalAlpha = p.life * 0.7;
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, p.size);
        grad.addColorStop(0, p.color);
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(-p.size, -p.size, p.size * 2, p.size * 2);
      } else if (p.shape === 'balloon') {
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size * 0.6, p.size * 0.75, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 1.4);
      }
      ctx.restore();
    });
    rafId = requestAnimationFrame(loop);
  }

  // pop-out 애니메이션 시작 시 파티클 발생
  document.addEventListener('animationstart', (e) => {
    if (e.animationName !== 'popOut') return;
    if (!(e.target instanceof HTMLElement)) return;
    if (!e.target.classList.contains('pop-out')) return;

    const rect = e.target.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const color = getComputedStyle(e.target).getPropertyValue('--card-bg').trim();
    spawnBurst(cx, cy, color || null);
  }, true);


  /* ─────────────────────────────────────────────
     3) Tweaks 패널 (호스트 프로토콜)
     ───────────────────────────────────────────── */
  const panel = document.getElementById('tweaks-panel');
  const closeBtn = document.getElementById('tweaks-close');

  const tweakState = Object.assign({
    theme: 'arcade',
    cardSize: 'md',
    floating: 'on',
    confetti: 'on',
  }, (window.TWEAK_DEFAULTS || {}));

  function applyTweaks() {
    document.body.setAttribute('data-theme', tweakState.theme);
    document.body.setAttribute('data-card-size', tweakState.cardSize);
    document.body.setAttribute('data-floating', tweakState.floating);
    confettiEnabled = (tweakState.confetti !== 'off');

    // active 표시 동기화
    document.querySelectorAll('.tweak-radio, .tweak-toggle').forEach(group => {
      const key = group.dataset.tweak;
      if (!key) return;
      group.querySelectorAll('button').forEach(b => {
        b.classList.toggle('active', b.dataset.value === tweakState[key]);
      });
    });
  }

  function setTweak(key, value) {
    tweakState[key] = value;
    applyTweaks();
    // 호스트에 저장 요청 (보이는 환경에서만)
    try {
      window.parent.postMessage({ type: '__edit_mode_set_keys', edits: { [key]: value } }, '*');
    } catch (_) {}
  }

  // 클릭 위임
  if (panel) {
    panel.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-value]');
      if (btn) {
        const group = btn.closest('[data-tweak]');
        if (!group) return;
        setTweak(group.dataset.tweak, btn.dataset.value);
        return;
      }
      const jump = e.target.closest('button[data-jump]');
      if (jump) {
        const id = jump.dataset.jump;
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById(id).classList.add('active');
      }
    });
  }

  // 호스트 메시지 — 토글
  window.addEventListener('message', (e) => {
    const data = e.data;
    if (!data || !data.type) return;
    if (data.type === '__activate_edit_mode') {
      panel && (panel.style.display = '');
    } else if (data.type === '__deactivate_edit_mode') {
      panel && (panel.style.display = 'none');
    }
  });

  // 닫기 버튼
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      panel.style.display = 'none';
      try {
        window.parent.postMessage({ type: '__edit_mode_dismissed' }, '*');
      } catch (_) {}
    });
  }

  // 호스트에 사용 가능 알림 (리스너 등록 후)
  try {
    window.parent.postMessage({ type: '__edit_mode_available' }, '*');
  } catch (_) {}

  // 초기 적용
  applyTweaks();


  /* ─────────────────────────────────────────────
     4) DOM 준비 후 observer 시작
     ───────────────────────────────────────────── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', observeGameDOM);
  } else {
    observeGameDOM();
  }
})();

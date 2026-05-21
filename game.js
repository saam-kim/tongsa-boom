/**
 * game.js — 통사 풍선 터뜨리기 게임 로직
 *
 * 이 파일은 수정하지 않아도 됩니다.
 * 학습 주제·카드 내용 → data.js
 * 게임 URL·GAS URL·반 목록  → config.js
 */

'use strict';

/* ══════════════════════════════════════════════
   게임 상태
   ══════════════════════════════════════════════ */
const state = {
  currentTopic: null,
  nickname: '',
  className: '',              // 반 이름 ('1반' 등) — 빈 문자열이면 미설정
  cards: [],
  initialCards: [],           // 게임 시작 시 스냅샷 (개념 정리용)
  completedCategories: new Set(),
  selectedCategory: null,
  selectedCardIds: [],
  wrongCount: 0,
  timerInterval: null,
  startTime: null,
  elapsedMs: 0,
  isLocked: false,
  isStudentMode: false,       // URL 파라미터로 진입한 학생 모드
};

/* ══════════════════════════════════════════════
   초기화
   ══════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  bindButtons();
  detectMode();
});

function bindButtons() {
  // 교사 모드 — QR 생성
  document.getElementById('show-qr-btn').addEventListener('click', onShowQrClick);

  // 교사 모드 — 활동 가이드
  document.getElementById('guide-btn').addEventListener('click', openGuideModal);
  document.getElementById('guide-close-btn').addEventListener('click', closeGuideModal);
  document.getElementById('guide-modal').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeGuideModal();
  });

  // 교사 모드 — 설정 패널 토글
  document.getElementById('settings-toggle').addEventListener('click', toggleSettingsPanel);

  // 교사 모드 — 설정 저장
  document.getElementById('settings-save-btn').addEventListener('click', saveSettings);
  document.getElementById('settings-guide-link').addEventListener('click', () => {
    closeSettingsPanel();
    openGuideModal();
  });

  // 학생 모드
  document.getElementById('student-start-btn').addEventListener('click', onStudentStartClick);

  // QR 화면
  document.getElementById('qr-back-btn').addEventListener('click', () => showScreen('start-screen'));

  // 게임 화면
  document.getElementById('restart-btn').addEventListener('click', onRestartClick);

  // 결과 화면
  document.getElementById('retry-btn').addEventListener('click', onRetryClick);
  document.getElementById('back-btn').addEventListener('click', onBackClick);
  document.getElementById('clear-ranking-btn').addEventListener('click', onClearRankingClick);
}


/* ══════════════════════════════════════════════
   localStorage 기반 설정 헬퍼
   config.js 의 값보다 localStorage 값이 우선됨
   ══════════════════════════════════════════════ */
function getGasUrl() {
  return localStorage.getItem('tonsa_gasUrl') ||
    (typeof gameConfig !== 'undefined' && gameConfig.gasWebAppUrl) || '';
}

function getGameBaseUrl() {
  return localStorage.getItem('tonsa_gameUrl') ||
    (typeof gameConfig !== 'undefined' && gameConfig.gameBaseUrl) ||
    // 아무것도 설정되지 않은 경우 현재 페이지 URL을 자동 사용
    (window.location.href.split('?')[0]);
}


/* ══════════════════════════════════════════════
   설정 패널 토글 / 저장
   ══════════════════════════════════════════════ */
function toggleSettingsPanel() {
  const body  = document.getElementById('settings-body');
  const panel = body.closest('.settings-panel');
  const open  = body.style.display === 'none' || body.style.display === '';

  if (open) {
    body.style.display = 'flex';
    panel.classList.add('open');
    // 현재 저장된 값 불러오기
    document.getElementById('setting-game-url').value = getGameBaseUrl();
    document.getElementById('setting-gas-url').value  = getGasUrl();
  } else {
    closeSettingsPanel();
  }
}

function closeSettingsPanel() {
  const body  = document.getElementById('settings-body');
  const panel = body.closest('.settings-panel');
  body.style.display = 'none';
  panel.classList.remove('open');
}

function saveSettings() {
  const gameUrl = document.getElementById('setting-game-url').value.trim();
  const gasUrl  = document.getElementById('setting-gas-url').value.trim();

  if (gameUrl) localStorage.setItem('tonsa_gameUrl', gameUrl);
  else         localStorage.removeItem('tonsa_gameUrl');

  if (gasUrl)  localStorage.setItem('tonsa_gasUrl', gasUrl);
  else         localStorage.removeItem('tonsa_gasUrl');

  renderConnectStatus();

  const msg = document.getElementById('settings-saved-msg');
  msg.style.display = '';
  setTimeout(() => { msg.style.display = 'none'; }, 2200);
}

/* 연동 상태 배지 렌더 */
function renderConnectStatus() {
  const badge  = document.getElementById('connect-status');
  const gasUrl = getGasUrl();
  const gameUrl = getGameBaseUrl();

  if (gasUrl && gameUrl) {
    badge.textContent = '연동됨';
    badge.className = 'connect-status connected';
  } else if (gasUrl || gameUrl) {
    badge.textContent = '부분 설정';
    badge.className = 'connect-status connected';
  } else {
    badge.textContent = '미설정';
    badge.className = 'connect-status disconnected';
  }
}


/* ══════════════════════════════════════════════
   활동 가이드 모달
   ══════════════════════════════════════════════ */
function openGuideModal() {
  document.getElementById('guide-modal').style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeGuideModal() {
  document.getElementById('guide-modal').style.display = 'none';
  document.body.style.overflow = '';
}


/* ══════════════════════════════════════════════
   모드 감지: URL 파라미터 → 학생 모드
   ══════════════════════════════════════════════ */
function detectMode() {
  const params = new URLSearchParams(window.location.search);
  const topicId   = params.get('topic');
  const className = params.get('class');

  if (topicId && className) {
    // ── 학생 모드 ──
    const topic = (typeof gameSets !== 'undefined')
      ? gameSets.find(t => t.id === topicId)
      : null;

    if (!topic) {
      // 유효하지 않은 파라미터 → 교사 모드로 복귀
      buildTeacherStartScreen();
      return;
    }

    state.isStudentMode = true;
    state.currentTopic  = topic;
    state.className     = className;

    buildStudentStartScreen(topic, className);
  } else {
    // ── 교사 모드 ──
    buildTeacherStartScreen();
  }
}


/* ══════════════════════════════════════════════
   화면 전환
   ══════════════════════════════════════════════ */
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function showStartScreen() {
  stopTimer();
  // URL 파라미터가 있으면 학생 모드, 없으면 교사 모드 재빌드
  const params = new URLSearchParams(window.location.search);
  if (params.get('topic') && params.get('class')) {
    const topic = gameSets.find(t => t.id === params.get('topic'));
    if (topic) {
      buildStudentStartScreen(topic, params.get('class'));
    } else {
      buildTeacherStartScreen();
    }
  } else {
    state.currentTopic = null;
    state.className    = '';
    buildTeacherStartScreen();
  }
  showScreen('start-screen');
}


/* ══════════════════════════════════════════════
   교사 모드 시작 화면 구성
   ══════════════════════════════════════════════ */
function buildTeacherStartScreen() {
  document.getElementById('teacher-section').style.display = '';
  document.getElementById('student-section').style.display = 'none';

  const errorBox = document.getElementById('start-error');
  const qrBtn    = document.getElementById('show-qr-btn');

  const errors = validateAllData();
  if (errors.length > 0) {
    errorBox.style.display = 'block';
    errorBox.textContent = '[데이터 오류]\n' + errors.join('\n');
    qrBtn.disabled = true;
    buildTopicList([]);
    buildClassButtons();
    renderConnectStatus();
    return;
  }

  errorBox.style.display = 'none';

  buildTopicList(gameSets);
  buildClassButtons();
  renderConnectStatus();
  refreshTeacherButtons();
}

/* 주제 카드 목록 */
function buildTopicList(topics) {
  const container = document.getElementById('topic-list');
  container.innerHTML = '';
  topics.forEach(topic => {
    const card = document.createElement('div');
    card.className = 'topic-card';
    card.dataset.topicId = topic.id;
    card.innerHTML = `
      <div class="topic-card-title">${escapeHtml(topic.title)}</div>
      <div class="topic-card-desc">${escapeHtml(topic.description)}</div>
    `;
    card.addEventListener('click', () => selectTopic(topic.id));
    container.appendChild(card);
  });
}

/* 반 선택 버튼 생성 (config.js 의 classes 배열 사용) */
function buildClassButtons() {
  const container = document.getElementById('class-buttons');
  container.innerHTML = '';

  const classes = (typeof gameConfig !== 'undefined' && gameConfig.classes)
    ? gameConfig.classes
    : [];

  if (classes.length === 0) {
    container.innerHTML = '<span style="color:#bbb;font-size:0.82rem;">config.js 에 반 목록이 없습니다.</span>';
    return;
  }

  classes.forEach(cls => {
    const btn = document.createElement('button');
    btn.className = 'class-btn';
    btn.textContent = cls;
    btn.dataset.class = cls;
    btn.addEventListener('click', () => selectClass(cls));
    container.appendChild(btn);
  });
}

/* 주제 선택 */
function selectTopic(topicId) {
  state.currentTopic = gameSets.find(t => t.id === topicId) || null;
  document.querySelectorAll('.topic-card').forEach(c => {
    c.classList.toggle('selected', c.dataset.topicId === topicId);
  });
  refreshTeacherButtons();
}

/* 반 선택 */
function selectClass(className) {
  state.className = (state.className === className) ? '' : className;
  document.querySelectorAll('.class-btn').forEach(b => {
    b.classList.toggle('selected', b.dataset.class === state.className);
  });
  refreshTeacherButtons();
}

/* QR 버튼 활성화 여부 갱신 */
function refreshTeacherButtons() {
  const qrBtn = document.getElementById('show-qr-btn');
  const ready = !!(state.currentTopic && state.className);
  qrBtn.disabled = !ready;
}


/* ══════════════════════════════════════════════
   학생 모드 시작 화면 구성
   ══════════════════════════════════════════════ */
function buildStudentStartScreen(topic, className) {
  document.getElementById('teacher-section').style.display = 'none';
  document.getElementById('student-section').style.display = '';

  document.getElementById('student-topic-name').textContent = topic.title;
  document.getElementById('student-class-name').textContent = className;

  // 입력 포커스
  setTimeout(() => {
    const input = document.getElementById('student-nickname-input');
    if (input) input.focus();
  }, 150);
}


/* ══════════════════════════════════════════════
   QR 화면
   ══════════════════════════════════════════════ */
function onShowQrClick() {
  if (!state.currentTopic || !state.className) return;
  buildQrScreen(state.currentTopic, state.className);
  showScreen('qr-screen');
}

function buildQrScreen(topic, className) {
  document.getElementById('qr-topic-name').textContent = topic.title;
  document.getElementById('qr-class-name').textContent = className;

  const baseUrl = getGameBaseUrl().replace(/\/$/, '');

  if (!baseUrl) {
    // gameBaseUrl 미설정
    document.getElementById('qr-image').style.display = 'none';
    document.getElementById('qr-error').style.display = 'none';
    document.getElementById('qr-url-text').textContent = '';
    document.getElementById('qr-url-box').style.display = 'none';
    document.getElementById('qr-no-url-warning').style.display = '';
    return;
  }

  document.getElementById('qr-no-url-warning').style.display = 'none';
  document.getElementById('qr-url-box').style.display = '';

  const gameUrl = `${baseUrl}?topic=${encodeURIComponent(topic.id)}&class=${encodeURIComponent(className)}`;

  // URL 표시 + 직접 테스트 링크
  document.getElementById('qr-url-text').textContent = gameUrl;
  const directLink = document.getElementById('qr-direct-link');
  directLink.href = gameUrl;
  directLink.style.display = '';

  // QR 이미지 (api.qrserver.com — 무료/안정)
  const qrSize    = 320;
  const qrApiUrl  = `https://api.qrserver.com/v1/create-qr-code/?size=${qrSize}x${qrSize}&data=${encodeURIComponent(gameUrl)}&margin=8`;

  const img = document.getElementById('qr-image');
  img.style.display = '';
  img.src = qrApiUrl;
  img.onerror = () => {
    img.style.display = 'none';
    document.getElementById('qr-error').style.display = '';
  };
  img.onload = () => {
    document.getElementById('qr-error').style.display = 'none';
  };
}


/* ══════════════════════════════════════════════
   게임 시작 버튼 핸들러
   ══════════════════════════════════════════════ */

/* 학생 — QR 스캔 후 닉네임 입력 */
function onStudentStartClick() {
  const nickname = document.getElementById('student-nickname-input').value.trim();
  if (!nickname) { alert('닉네임을 입력하세요.'); return; }
  state.nickname = escapeHtml(nickname);
  initGame();
  showScreen('game-screen');
}


/* ══════════════════════════════════════════════
   게임 초기화
   ══════════════════════════════════════════════ */
function initGame() {
  stopTimer();

  state.cards               = generateCards(state.currentTopic);
  state.initialCards        = [...state.cards];
  state.completedCategories = new Set();
  state.selectedCategory    = null;
  state.selectedCardIds     = [];
  state.wrongCount          = 0;
  state.isLocked            = false;

  renderGameScreen();
  startTimer();
}

function renderGameScreen() {
  document.getElementById('topic-title').textContent = state.currentTopic.title;
  document.getElementById('timer').textContent = '0.0';
  document.getElementById('wrong-count').textContent = '0';
  document.getElementById('remaining-count').textContent = state.cards.length;

  // 헤더 반 배지
  const classBadge = document.getElementById('class-badge-game');
  if (state.className) {
    classBadge.textContent = state.className;
    classBadge.style.display = '';
  } else {
    classBadge.style.display = 'none';
  }

  hideFeedback();
  buildCategoryButtons();
  buildCardGrid();
}

function buildCategoryButtons() {
  const container = document.getElementById('category-buttons');
  container.innerHTML = '';
  state.currentTopic.categories.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'category-btn';
    btn.dataset.category = cat.name;
    const count = state.cards.filter(c => c.category === cat.name).length;
    btn.textContent = `${cat.name} (${count})`;
    btn.addEventListener('click', () => onCategoryClick(cat.name));
    container.appendChild(btn);
  });
}

function buildCardGrid() {
  const grid = document.getElementById('cards-grid');
  grid.innerHTML = '';
  state.cards.forEach(card => {
    const el = document.createElement('div');
    el.className = 'card';
    el.dataset.cardId = card.id;
    el.textContent = card.text;
    el.addEventListener('click', () => onCardClick(card.id));
    grid.appendChild(el);
  });
}


/* ══════════════════════════════════════════════
   개념 유형 버튼
   ══════════════════════════════════════════════ */
function onCategoryClick(categoryName) {
  if (state.isLocked) return;
  if (state.completedCategories.has(categoryName)) return;

  if (state.selectedCategory === categoryName) {
    state.selectedCategory = null;
    clearCardSelection();
    updateCategoryButtons();
    return;
  }

  state.selectedCategory = categoryName;
  clearCardSelection();
  updateCategoryButtons();
}

function updateCategoryButtons() {
  document.querySelectorAll('.category-btn').forEach(btn => {
    const catName     = btn.dataset.category;
    const isSelected  = catName === state.selectedCategory;
    const isCompleted = state.completedCategories.has(catName);

    btn.classList.toggle('selected',  isSelected && !isCompleted);
    btn.classList.toggle('completed', isCompleted);
    btn.disabled = isCompleted;

    if (isCompleted) {
      btn.textContent = `✓ ${catName}`;
    } else {
      const remaining = state.cards.filter(c => c.category === catName).length;
      btn.textContent = `${catName} (${remaining})`;
    }
  });
}


/* ══════════════════════════════════════════════
   카드 클릭
   ══════════════════════════════════════════════ */
function onCardClick(cardId) {
  if (state.isLocked) return;

  if (!state.selectedCategory) {
    showFeedback('먼저 개념 유형을 선택하세요.', 'info');
    return;
  }

  const cardEl = getCardEl(cardId);
  if (!cardEl) return;

  const idx = state.selectedCardIds.indexOf(cardId);
  if (idx !== -1) {
    state.selectedCardIds.splice(idx, 1);
    cardEl.classList.remove('selected');
    return;
  }

  if (state.selectedCardIds.length >= 2) return;

  state.selectedCardIds.push(cardId);
  cardEl.classList.add('selected');

  if (state.selectedCardIds.length === 2) judgeAnswer();
}


/* ══════════════════════════════════════════════
   정답 판정
   ══════════════════════════════════════════════ */
function judgeAnswer() {
  state.isLocked = true;

  const [id1, id2] = state.selectedCardIds;
  const card1 = state.cards.find(c => c.id === id1);
  const card2 = state.cards.find(c => c.id === id2);

  if (!card1 || !card2) { state.isLocked = false; return; }

  const isCorrect =
    card1.category === state.selectedCategory &&
    card2.category === state.selectedCategory;

  if (isCorrect) handleCorrect(card1, card2);
  else           handleWrong(card1, card2);
}

/* ─── 정답 ─── */
function handleCorrect(card1, card2) {
  showFeedback('정답!', 'correct');

  const el1 = getCardEl(card1.id);
  const el2 = getCardEl(card2.id);
  if (el1) el1.classList.add('pop-out');
  if (el2) el2.classList.add('pop-out');

  setTimeout(() => {
    state.cards = state.cards.filter(c => c.id !== card1.id && c.id !== card2.id);
    if (el1 && el1.parentNode) el1.parentNode.removeChild(el1);
    if (el2 && el2.parentNode) el2.parentNode.removeChild(el2);

    state.selectedCardIds = [];

    const remainingInCat = state.cards.filter(c => c.category === state.selectedCategory).length;
    if (remainingInCat === 0 && state.selectedCategory) {
      state.completedCategories.add(state.selectedCategory);
      state.selectedCategory = null;
    }

    updateCategoryButtons();
    document.getElementById('remaining-count').textContent = state.cards.length;
    state.isLocked = false;

    if (state.cards.length === 0) endGame();
  }, 440);
}

/* ─── 오답 ─── */
function handleWrong(card1, card2) {
  state.wrongCount++;
  document.getElementById('wrong-count').textContent = state.wrongCount;
  showFeedback(makeWrongMessage(card1, card2), 'wrong');

  const el1 = getCardEl(card1.id);
  const el2 = getCardEl(card2.id);
  if (el1) el1.classList.add('shake');
  if (el2) el2.classList.add('shake');

  setTimeout(() => {
    if (el1) el1.classList.remove('shake', 'selected');
    if (el2) el2.classList.remove('shake', 'selected');
    state.selectedCardIds = [];
    state.isLocked = false;
  }, 500);
}

/* 상황별 오답 메시지 */
function makeWrongMessage(card1, card2) {
  const sel = state.selectedCategory;

  if (card1.category === card2.category && card1.category !== sel)
    return `두 카드 모두 '${card1.category}'에 해당해요. 유형 선택을 바꿔보세요. (+3초)`;

  if (card1.category === sel && card2.category !== sel)
    return `한 카드가 '${card2.category}'에 해당해요. 다른 카드를 골라보세요. (+3초)`;

  if (card2.category === sel && card1.category !== sel)
    return `한 카드가 '${card1.category}'에 해당해요. 다른 카드를 골라보세요. (+3초)`;

  if (card1.category !== card2.category)
    return `두 카드가 각각 '${card1.category}'·'${card2.category}'이에요. (+3초)`;

  return `틀렸어요. 다시 생각해 보세요. (+3초)`;
}


/* ══════════════════════════════════════════════
   피드백
   ══════════════════════════════════════════════ */
let feedbackTimer = null;

function showFeedback(message, type) {
  const bar  = document.getElementById('feedback-bar');
  const text = document.getElementById('feedback-text');
  if (feedbackTimer) clearTimeout(feedbackTimer);
  text.textContent = message;
  bar.className = `feedback-bar ${type}`;
  bar.style.display = 'block';
  const delay = type === 'wrong' ? 2600 : type === 'info' ? 2000 : 1400;
  feedbackTimer = setTimeout(hideFeedback, delay);
}

function hideFeedback() {
  document.getElementById('feedback-bar').style.display = 'none';
}


/* ══════════════════════════════════════════════
   타이머
   ══════════════════════════════════════════════ */
function startTimer() {
  state.startTime = Date.now();
  state.elapsedMs = 0;
  state.timerInterval = setInterval(() => {
    state.elapsedMs = Date.now() - state.startTime;
    document.getElementById('timer').textContent = msToSec(state.elapsedMs);
  }, 100);
}

function stopTimer() {
  if (state.timerInterval) { clearInterval(state.timerInterval); state.timerInterval = null; }
  if (state.startTime)     { state.elapsedMs = Date.now() - state.startTime; }
}

function msToSec(ms) { return (ms / 1000).toFixed(1); }


/* ══════════════════════════════════════════════
   게임 종료
   ══════════════════════════════════════════════ */
async function endGame() {
  stopTimer();

  const clearMs   = state.elapsedMs;
  const wrongs    = state.wrongCount;
  const penaltyMs = wrongs * 3000;
  const finalMs   = clearMs + penaltyMs;

  const record = {
    nickname:   state.nickname,
    className:  state.className,
    topicId:    state.currentTopic.id,
    topicTitle: state.currentTopic.title,
    clearMs,
    wrongCount: wrongs,
    penaltyMs,
    finalMs,
    createdAt:  new Date().toISOString(),
  };

  // 로컬 저장
  saveLocalRanking(record);

  // 결과 화면 먼저 표시 (로컬 랭킹으로)
  buildResultScreen(record, loadLocalRanking(record.topicId, record.className));
  showScreen('result-screen');

  // GAS 연동 (설정된 경우)
  const gasUrl = getGasUrl();
  if (gasUrl) {
    setRankingLoading(true);
    try {
      await submitToGas(record, gasUrl);
      const gasRankings = await fetchGasRankings(record.topicTitle, record.className, gasUrl);
      if (gasRankings && gasRankings.length > 0) {
        updateRankingDisplay(gasRankings, record, 'sheets');
      }
    } catch (e) {
      console.warn('GAS 통신 오류:', e);
    } finally {
      setRankingLoading(false);
    }
  }
}


/* ══════════════════════════════════════════════
   결과 화면 구성
   ══════════════════════════════════════════════ */
function buildResultScreen(record, rankings) {
  document.getElementById('result-subtitle').textContent =
    `${record.nickname}님, 수고했어요!`;

  document.getElementById('result-nickname').textContent  = record.nickname;
  document.getElementById('result-topic').textContent     = record.topicTitle;
  document.getElementById('result-clear-time').textContent = msToSec(record.clearMs) + '초';
  document.getElementById('result-wrong-count').textContent = record.wrongCount + '회';
  document.getElementById('result-penalty').textContent   = msToSec(record.penaltyMs) + '초';
  document.getElementById('result-final-time').textContent = msToSec(record.finalMs) + '초';

  // 반 행 표시/숨김
  const classRow = document.getElementById('result-class-row');
  if (record.className) {
    classRow.style.display = '';
    document.getElementById('result-class').textContent = record.className;
  } else {
    classRow.style.display = 'none';
  }

  updateRankingDisplay(rankings, record, 'local');
  buildConceptSummary();
}

/* 랭킹 표시 업데이트 */
function updateRankingDisplay(rankings, currentRecord, source) {
  const list   = document.getElementById('ranking-list');
  const badge  = document.getElementById('ranking-source-badge');

  // 출처 배지
  badge.textContent = source === 'sheets' ? '스프레드시트' : '로컬';
  badge.className   = `ranking-source-badge ${source}`;

  list.innerHTML = '';

  if (!rankings || rankings.length === 0) {
    list.innerHTML = '<div class="ranking-empty">아직 기록이 없습니다.</div>';
    return;
  }

  // GAS 랭킹은 finalTime(초), 로컬은 finalMs(ms)
  const toMs = r => source === 'sheets'
    ? (r.finalTime  * 1000)
    : r.finalMs;

  const currentIdx = currentRecord
    ? rankings.findIndex(r => {
        if (source === 'sheets') {
          return r.nickname === currentRecord.nickname &&
                 Math.abs(r.finalTime - currentRecord.finalMs / 1000) < 0.05;
        }
        return r.createdAt === currentRecord.createdAt && r.nickname === currentRecord.nickname;
      })
    : -1;

  rankings.forEach((r, i) => {
    const isCurrent  = (i === currentIdx);
    const item = document.createElement('div');
    item.className = 'ranking-item' + (isCurrent ? ' current-entry' : '');

    const badgeClass = ['gold', 'silver', 'bronze'][i] || '';
    const timeLabel  = source === 'sheets'
      ? Number(r.finalTime).toFixed(1) + '초'
      : msToSec(r.finalMs) + '초';

    item.innerHTML = `
      <div class="ranking-badge ${badgeClass}">${i + 1}</div>
      <div class="ranking-name ${isCurrent ? 'me' : ''}">${escapeHtml(r.nickname)}</div>
      <div class="ranking-time">${timeLabel}</div>
    `;
    list.appendChild(item);
  });
}

function setRankingLoading(on) {
  document.getElementById('ranking-loading').style.display = on ? '' : 'none';
  document.getElementById('ranking-list').style.opacity    = on ? '0.4' : '';
}

/* 개념 정리 아코디언 */
function buildConceptSummary() {
  const container = document.getElementById('concept-summary');
  if (!container) return;
  container.innerHTML = '';

  const byCategory = {};
  state.initialCards.forEach(card => {
    if (!byCategory[card.category]) byCategory[card.category] = [];
    byCategory[card.category].push(card.text);
  });

  state.currentTopic.categories.forEach(cat => {
    const cards = byCategory[cat.name] || [];
    const details = document.createElement('details');
    const summary = document.createElement('summary');
    summary.innerHTML = `<span class="summary-name">${escapeHtml(cat.name)}</span><span class="summary-toggle">▾</span>`;
    details.appendChild(summary);

    const ul = document.createElement('ul');
    ul.className = 'concept-card-list';
    cards.forEach(text => {
      const li = document.createElement('li');
      li.textContent = text;
      ul.appendChild(li);
    });
    details.appendChild(ul);
    container.appendChild(details);
  });
}


/* ══════════════════════════════════════════════
   GAS 통신 (GET 방식 — CORS 이슈 없음)
   ══════════════════════════════════════════════ */

/**
 * 게임 결과를 GAS로 전송.
 * 모든 데이터를 URL 쿼리 파라미터로 전달 (GET 방식).
 */
async function submitToGas(record, gasUrl) {
  const params = new URLSearchParams({
    action:     'submit',
    nickname:   record.nickname,
    className:  record.className,
    topicTitle: record.topicTitle,
    clearMs:    record.clearMs,
    wrongCount: record.wrongCount,
    penaltyMs:  record.penaltyMs,
    finalMs:    record.finalMs,
  });

  const res = await fetch(`${gasUrl}?${params}`, { method: 'GET' });
  if (!res.ok) throw new Error(`GAS 응답 오류: ${res.status}`);
  return res.json();
}

/**
 * GAS에서 랭킹 목록 가져오기.
 * topic 과 class 로 필터링된 상위 10개를 받음.
 */
async function fetchGasRankings(topicTitle, className, gasUrl) {
  const params = new URLSearchParams({
    action: 'getRanking',
    topic:  topicTitle,
    class:  className,
  });

  const res = await fetch(`${gasUrl}?${params}`, { method: 'GET' });
  if (!res.ok) throw new Error(`GAS 랭킹 응답 오류: ${res.status}`);
  return res.json();
}


/* ══════════════════════════════════════════════
   로컬 랭킹 (localStorage)
   ══════════════════════════════════════════════ */
const localRankingKey = (topicId, className) =>
  `tonsa_ranking_${topicId}_${className || 'all'}`;

function saveLocalRanking(record) {
  let rankings = loadLocalRanking(record.topicId, record.className);
  rankings.push(record);
  rankings.sort((a, b) => a.finalMs - b.finalMs);
  rankings = rankings.slice(0, 10);
  try {
    localStorage.setItem(localRankingKey(record.topicId, record.className), JSON.stringify(rankings));
  } catch (e) {
    console.warn('로컬 랭킹 저장 실패:', e);
  }
}

function loadLocalRanking(topicId, className) {
  try {
    const raw = localStorage.getItem(localRankingKey(topicId, className));
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function clearLocalRanking(topicId, className) {
  try {
    localStorage.removeItem(localRankingKey(topicId, className));
  } catch { /* 무시 */ }
}


/* ══════════════════════════════════════════════
   버튼 이벤트 핸들러
   ══════════════════════════════════════════════ */
function onRestartClick() {
  if (!state.currentTopic) return;
  if (!confirm('진행 중인 게임을 재시작할까요?')) return;
  initGame();
}

function onRetryClick() {
  if (!state.currentTopic) { showStartScreen(); return; }
  initGame();
  showScreen('game-screen');
}

function onBackClick() {
  showStartScreen();
}

function onClearRankingClick() {
  if (!state.currentTopic) return;
  const label = state.className
    ? `"${state.currentTopic.title}" (${state.className})`
    : `"${state.currentTopic.title}"`;
  if (!confirm(`${label} 로컬 랭킹을 초기화할까요?`)) return;
  clearLocalRanking(state.currentTopic.id, state.className);
  updateRankingDisplay([], null, 'local');
}


/* ══════════════════════════════════════════════
   카드 선택 초기화
   ══════════════════════════════════════════════ */
function clearCardSelection() {
  state.selectedCardIds.forEach(id => {
    const el = getCardEl(id);
    if (el) el.classList.remove('selected');
  });
  state.selectedCardIds = [];
}


/* ══════════════════════════════════════════════
   카드 생성 및 섞기
   ══════════════════════════════════════════════ */
function generateCards(topic) {
  const PER_CAT = 6;
  let cardId = 0;
  const all = [];
  topic.categories.forEach(cat => {
    shuffleArray([...cat.cards]).slice(0, PER_CAT).forEach(text => {
      all.push({ id: cardId++, category: cat.name, text });
    });
  });
  return shuffleArray(all);
}

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}


/* ══════════════════════════════════════════════
   데이터 검증
   ══════════════════════════════════════════════ */
function validateAllData() {
  const errors = [];
  if (typeof gameSets === 'undefined' || !Array.isArray(gameSets)) {
    errors.push('gameSets 변수가 정의되지 않았습니다. data.js를 확인하세요.');
    return errors;
  }
  if (gameSets.length === 0) {
    errors.push('gameSets에 주제가 없습니다. data.js에 주제를 추가하세요.');
    return errors;
  }
  gameSets.forEach(topic => errors.push(...validateTopic(topic)));
  return errors;
}

function validateTopic(topic) {
  const errors = [];
  const label = `"${topic.title || topic.id || '(이름 없음)'}"`;
  if (!topic.categories || !Array.isArray(topic.categories)) {
    errors.push(`${label} 주제에 categories 배열이 없습니다.`); return errors;
  }
  if (topic.categories.length < 2) {
    errors.push(`${label} 주제에 개념 유형이 2개 미만입니다. (현재 ${topic.categories.length}개)`); return errors;
  }
  const names = topic.categories.map(c => c.name);
  if (new Set(names).size !== names.length)
    errors.push(`${label} 주제 안에 중복된 유형 이름이 있습니다.`);
  topic.categories.forEach(cat => errors.push(...validateCategory(cat, label)));
  return errors;
}

function validateCategory(cat, topicLabel) {
  const errors  = [];
  const catLabel = `"${cat.name || '(이름 없음)'}"`;
  if (!cat.cards || !Array.isArray(cat.cards)) {
    errors.push(`${topicLabel} > ${catLabel} 유형에 cards 배열이 없습니다.`); return errors;
  }
  const count = cat.cards.length;
  if (count < 6) {
    errors.push(`${catLabel}의 카드 수가 6개보다 적습니다. (현재 ${count}개)`); return errors;
  }
  if (count % 2 !== 0)
    errors.push(`${catLabel}의 카드 수가 ${count}개입니다. 카드 수는 반드시 짝수여야 합니다.`);
  if (cat.cards.some(c => !c || !String(c).trim()))
    errors.push(`${catLabel} 안에 빈 카드 텍스트가 있습니다.`);
  if (new Set(cat.cards.map(c => String(c).trim())).size !== cat.cards.length)
    errors.push(`${catLabel} 안에 중복된 카드 문장이 있습니다.`);
  return errors;
}


/* ══════════════════════════════════════════════
   유틸리티
   ══════════════════════════════════════════════ */
function getCardEl(cardId) {
  return document.querySelector(`.card[data-card-id="${cardId}"]`);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(String(str)));
  return div.innerHTML;
}

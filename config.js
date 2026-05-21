/**
 * config.js — 교사 설정 파일
 * ════════════════════════════════════════════════════════════════
 *
 * ★ 이 파일에서 설정할 항목 ★
 *   1. gameBaseUrl  — 학생이 접속할 게임 주소  (QR 코드 생성에 사용)
 *   2. gasWebAppUrl — Google Apps Script 주소  (결과 스프레드시트 저장)
 *   3. classes      — 반 목록
 *
 * ════════════════════════════════════════════════════════════════
 * Google 스프레드시트 연동 설정 방법 (처음 한 번만)
 * ════════════════════════════════════════════════════════════════
 *
 * [1단계] Google Drive에서 새 스프레드시트를 만드세요.
 *
 * [2단계] 스프레드시트 상단 메뉴: 확장 프로그램 > Apps Script
 *
 * [3단계] Apps Script 편집기에서 기존 코드를 모두 지운 뒤,
 *         아래 ★ GAS 코드 ★ 를 통째로 붙여넣으세요.
 *
 * [4단계] 저장(Ctrl+S) 후 상단 오른쪽 '배포' > '새 배포' 클릭
 *           - 유형 선택: 웹 앱
 *           - 설명: 통사 풍선 터뜨리기 (선택 사항)
 *           - 다음 사용자로 실행: 나 (자신의 Google 계정)
 *           - 액세스 권한: 모든 사용자 (익명 포함)
 *         '배포' 버튼 클릭 → 권한 허용
 *
 * [5단계] 배포 후 표시되는 '웹 앱 URL'을 복사해서
 *         아래 gasWebAppUrl 값에 붙여넣으세요.
 *
 * [6단계] 이 게임 파일들을 웹에 업로드하세요.
 *         (GitHub Pages, Google Sites 등 정적 호스팅 서비스)
 *         index.html 의 전체 주소를 gameBaseUrl 에 입력하세요.
 *
 * ★ 참고 ★
 *   - gasWebAppUrl 을 비워두면 '로컬 모드'로 동작합니다.
 *     결과가 스프레드시트에 저장되지 않고 기기 안에만 저장됩니다.
 *   - gameBaseUrl 을 비워두면 QR 코드가 생성되지 않습니다.
 *     로컬 테스트 시에는 비워두거나 'http://localhost/index.html' 로 설정하세요.
 *
 * ════════════════════════════════════════════════════════════════
 * ★ GAS 코드 — Apps Script 에 붙여넣기 ★
 * ════════════════════════════════════════════════════════════════
 *
 * // ──────────────────────────────────────────
 * // 통사 풍선 터뜨리기 — Google Apps Script
 * // ──────────────────────────────────────────
 *
 * const SHEET_NAME = '플레이 기록';
 *
 * // 모든 요청 처리 (결과 저장 + 랭킹 조회 모두 GET 방식)
 * function doGet(e) {
 *   const action = e.parameter.action || 'getRanking';
 *
 *   if (action === 'submit') {
 *     try {
 *       recordResult(e.parameter);
 *       return respond({ ok: true });
 *     } catch (err) {
 *       return respond({ ok: false, msg: err.message });
 *     }
 *   }
 *
 *   // 랭킹 조회 (action === 'getRanking' 또는 기본값)
 *   try {
 *     const topic = e.parameter.topic || '';
 *     const cls   = e.parameter.class || '';
 *     return respond(fetchRankings(topic, cls));
 *   } catch (err) {
 *     return respond([]);
 *   }
 * }
 *
 * // 결과 한 행 저장
 * function recordResult(p) {
 *   const sheet = getSheet();
 *   sheet.appendRow([
 *     Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'),
 *     p.nickname   || '',
 *     p.className  || '',
 *     p.topicTitle || '',
 *     toNum(p.clearMs)   / 1000,   // 클리어 시간(초)
 *     toNum(p.wrongCount),          // 오답 횟수
 *     toNum(p.penaltyMs) / 1000,   // 페널티(초)
 *     toNum(p.finalMs)   / 1000,   // 최종기록(초)
 *   ]);
 * }
 *
 * // 랭킹 상위 10개 반환
 * function fetchRankings(topic, cls) {
 *   const sheet = getSheet();
 *   const rows  = sheet.getDataRange().getValues();
 *   if (rows.length < 2) return [];
 *
 *   return rows.slice(1)
 *     .filter(r =>
 *       r[1] &&
 *       (!topic || r[3] === topic) &&
 *       (!cls   || r[2] === cls)
 *     )
 *     .map(r => ({
 *       nickname:   String(r[1]),
 *       className:  String(r[2]),
 *       topicTitle: String(r[3]),
 *       clearTime:  Number(r[4]),
 *       wrongCount: Number(r[5]),
 *       finalTime:  Number(r[7]),
 *     }))
 *     .sort((a, b) => a.finalTime - b.finalTime)
 *     .slice(0, 10);
 * }
 *
 * // 시트가 없으면 만들고, 있으면 가져옴
 * function getSheet() {
 *   const ss = SpreadsheetApp.getActiveSpreadsheet();
 *   let sh = ss.getSheetByName(SHEET_NAME);
 *   if (!sh) {
 *     sh = ss.insertSheet(SHEET_NAME);
 *     sh.appendRow(['기록 시간', '닉네임', '반', '주제', '클리어(초)', '오답', '페널티(초)', '최종기록(초)']);
 *     sh.setFrozenRows(1);
 *     sh.autoResizeColumns(1, 8);
 *   }
 *   return sh;
 * }
 *
 * function respond(data) {
 *   return ContentService
 *     .createTextOutput(JSON.stringify(data))
 *     .setMimeType(ContentService.MimeType.JSON);
 * }
 *
 * function toNum(v) { return Number(v) || 0; }
 *
 * ════════════════════════════════════════════════════════════════
 */

const gameConfig = {

  // ────────────────────────────────────────────────────────────
  // [1] 게임 접속 주소 (QR 코드 생성에 사용)
  //
  // 학생이 브라우저에서 접속할 index.html 의 전체 URL 입력.
  // 예시: 'https://yourname.github.io/tonsa-game/index.html'
  //
  // 로컬 테스트 중이거나 QR 기능을 쓰지 않는다면 비워두세요.
  // ────────────────────────────────────────────────────────────
  gameBaseUrl: 'https://saam-kim.github.io/tongsa-boom/index.html',

  // ────────────────────────────────────────────────────────────
  // [2] Google Apps Script 배포 URL
  //
  // 위 설정 방법의 [5단계]에서 받은 URL을 붙여넣으세요.
  // 예시: 'https://script.google.com/macros/s/AKfy.../exec'
  //
  // 비워두면 오프라인(로컬) 모드로 동작합니다.
  // ────────────────────────────────────────────────────────────
  gasWebAppUrl: '',

  // ────────────────────────────────────────────────────────────
  // [3] 반 목록
  //
  // 수업 상황에 맞게 추가·수정하세요.
  // 예: ['1반', '2반', '3반'] 또는 ['1학년 1반', '1학년 2반', ...]
  // ────────────────────────────────────────────────────────────
  classes: ['1반', '2반', '3반', '4반', '5반', '6반'],

};

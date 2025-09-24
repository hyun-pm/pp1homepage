// ===== 설정 =====
const CHARACTERS = [
  { key: 'nahyun',   label: '나현'   },
  { key: 'chulho',   label: '김철호' },
  { key: 'jihye',    label: '설지혜' },
  { key: 'suji',     label: '김수지' },
  { key: 'rokjeong', label: '정록정' },
  { key: 'guhee',    label: '한구희' },
  { key: 'yonsoo',   label: '박연수' },
  { key: 'kabmin',   label: '김갑민' },
];

const SHOW_ALL_MS = 3000;   // 시작 공개 3초 (앞면)
const LIMIT_MS    = 10000;   // 제한시간 7초

// ===== 엘리먼트 =====
const board      = document.getElementById('board');
const statusEl   = document.getElementById('status');
const restartBtn = document.getElementById('restartBtn');
const timerLabel = document.getElementById('timerLabel');
const timerFill  = document.getElementById('timerFill');

// ===== 유틸 =====
function shuffle(arr){
  for(let i=arr.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
function preload(urls){
  return Promise.all(urls.map(url => new Promise(res=>{
    const img = new Image();
    img.onload = img.onerror = () => res(true);
    img.src = url;
  })));
}
function wait(ms){ return new Promise(r => setTimeout(r, ms)); }

// ===== 상태 =====
let deck = [];           // 16개 카드
let first = null;        // 첫 선택 카드 엘리먼트
let lock = true;         // 입력 잠금
let matchedCount = 0;    // 매칭된 카드쌍 수(0~8)
let rafId = null;
let startAt = 0;

// ===== 초기화 =====
restartBtn.addEventListener('click', setup);
setup();

async function setup(){
  cancelAnimationFrame(rafId);

  // UI 초기화
  statusEl.hidden = true;
  statusEl.textContent = '';
  statusEl.classList.remove('show');
  timerLabel.textContent = '이미지 로딩 중…';
  timerFill.style.transform = 'scaleX(1)';
  board.innerHTML = '';
  matchedCount = 0;
  first = null;
  lock = true;

  // 덱 생성 (각 캐릭터 2장)
  deck = [];
  for (const c of CHARACTERS) {
    deck.push({ key: c.key, label: c.label, id: c.key + '_a' });
    deck.push({ key: c.key, label: c.label, id: c.key + '_b' });
  }
  shuffle(deck);

  // 이미지 프리로드
  const frontUrls = CHARACTERS.map(c => `/cards/${c.key}.png`);
  const backUrl   = `/cards/back.png`;
  await preload([...frontUrls, backUrl]);

  // DOM에 카드 그리기
  for (const card of deck) {
    const btn = document.createElement('button');
    btn.className = 'card';
    btn.type = 'button';
    btn.dataset.key = card.key;
    btn.dataset.id  = card.id;
    btn.setAttribute('aria-label', `${card.label} 카드`);
    btn.addEventListener('click', () => onFlip(btn));

    const inner = document.createElement('div');
    inner.className = 'card-inner';

    // 뒷면
    const back = document.createElement('div');
    back.className = 'face back';
    const backImg = document.createElement('img');
    backImg.src = backUrl;
    backImg.alt = '카드 뒷면';
    backImg.draggable = false;
    back.appendChild(backImg);
    back.classList.add('has-image');

    // 앞면
    const front = document.createElement('div');
    front.className = 'face front';
    const frontImg = document.createElement('img');
    frontImg.src = `/cards/${card.key}.png`;
    frontImg.alt = `${card.label} 카드 앞면`;
    frontImg.draggable = false;
    front.appendChild(frontImg);

    inner.appendChild(back);
    inner.appendChild(front);
    btn.appendChild(inner);
    board.appendChild(btn);
  }

  // 시작 연출: 3초 동안 "앞면" 보여주고 → 모두 뒤집어 "뒷면" 만들기
  const allCards = [...board.querySelectorAll('.card')];
  // 기본 상태는 앞면(= flipped 없음)
  timerLabel.textContent = '시작! 카드 암기 시간 1초';
  await wait(SHOW_ALL_MS);

  // 모두 뒷면으로 전환
  allCards.forEach(c => c.classList.add('flipped'));
  lock = false; // 입력 해제
  startTimer();
}

// ===== 타이머 =====
function startTimer(){
  startAt = performance.now();
  timerLabel.textContent = `남은 시간: ${(LIMIT_MS/1000).toFixed(2)}초`;
  timerFill.style.transform = 'scaleX(1)';

  const tick = (now) => {
    const elapsed = now - startAt;
    const left = Math.max(0, LIMIT_MS - elapsed);
    timerLabel.textContent = `남은 시간: ${(left/1000).toFixed(2)}초`;
    const ratio = Math.max(0, left / LIMIT_MS);
    timerFill.style.transform = `scaleX(${ratio})`;

    if (matchedCount >= 8) {
      win();
      return;
    }
    if (left <= 0) {
      timeover();
      return;
    }
    rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);
}

// ===== 카드 뒤집기 로직 =====
async function onFlip(btn){
  if (lock) return;
  if (btn.classList.contains('matched')) return;

  // 현재 뒷면이면 앞면으로 보여주기 (flipped 제거)
  if (btn.classList.contains('flipped')) {
    btn.classList.remove('flipped');
  } else {
    // 이미 앞면이면 무시
    return;
  }

  if (!first){
    first = btn;
    return;
  }

  // 두 번째 선택
  lock = true;
  const second = btn;

  const isMatch = first.dataset.key === second.dataset.key;

  if (isMatch){
    // 매칭: 앞면 상태 유지 + 매칭 표시 + 재클릭 방지
    first.classList.add('matched');
    second.classList.add('matched');
    first.setAttribute('disabled','true');
    second.setAttribute('disabled','true');

    matchedCount += 1;
    first = null;
    lock = false;
  } else {
    // 실패: 잠깐 보여준 뒤 다시 모두 뒷면으로 (flipped 추가)
    await wait(550);
    first.classList.add('flipped');
    second.classList.add('flipped');
    first = null;
    lock = false;
  }
}

// ===== 결과 처리 =====
function win(){
  cancelAnimationFrame(rafId);
  lock = true;
  statusEl.textContent = '🎉 성공! 모든 카드를 10초 안에 맞췄습니다.';
  statusEl.hidden = false;
  statusEl.classList.add('show');   // 디밍 표시(보드 클릭 차단), HUD는 위라 클릭 가능
  timerLabel.textContent = '클리어!';
}

function timeover(){
  cancelAnimationFrame(rafId);
  lock = true;
  // 뒤집혀 있던 카드들 다시 닫기 & 입력 막기 (이미 뒷면이니 별도 처리 불필요)
  statusEl.textContent = '⏰ 시간 초과! RESTART로 다시 도전하세요.';
  statusEl.hidden = false;
  statusEl.classList.add('show');   // 디밍 표시(보드 클릭 차단), HUD는 위라 클릭 가능
  timerLabel.textContent = '시간 종료';
}

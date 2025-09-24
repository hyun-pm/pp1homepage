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

const SHOW_ALL_MS = 1000;   // 시작 공개 1초
const LIMIT_MS    = 7000;   // 제한시간 7초

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
  statusEl.classList.remove('show'); // ★ 추가: 디밍 클래스 제거
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
    back.classList.add('has-image'); // back.png 없으면 그냥 안 보임

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

  // 시작 연출: 1초 공개 → 뒤집기 → 타이머 7초
  const allCards = [...board.querySelectorAll('.card')];
  allCards.forEach(c => c.classList.add('flipped')); // 앞면 보이기
  timerLabel.textContent = '시작! 카드 암기 시간 1초';

  await wait(SHOW_ALL_MS);

  allCards.forEach(c => c.classList.remove('flipped')); // 뒤집기
  lock = false; // 입력 해제
  startTimer();
}

// ===== 타이머 =====
function startTimer(){
  startAt = performance.now();
  timerLabel.textContent = '남은 시간: 7.00초';
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
  if (btn.classList.contains('flipped') || btn.classList.contains('matched')) return;

  btn.classList.add('flipped');

  if (!first){
    first = btn;
    return;
  }

  // 두 번째 선택
  lock = true;
  const second = btn;

  const isMatch = first.dataset.key === second.dataset.key;

  if (isMatch){
    first.classList.add('matched');
    second.classList.add('matched');
    first.setAttribute('disabled','true');
    second.setAttribute('disabled','true');
    matchedCount += 1; // 쌍 1개 완료
    // 바로 다음 입력 허용
    first = null;
    lock = false;
  } else {
    // 잠깐 보여주고 다시 뒤집기
    await wait(550);
    first.classList.remove('flipped');
    second.classList.remove('flipped');
    first = null;
    lock = false;
  }
}

// ===== 결과 처리 =====
function win(){
  cancelAnimationFrame(rafId);
  lock = true;
  statusEl.textContent = '🎉 성공! 모든 카드를 7초 안에 맞췄습니다.';
  statusEl.hidden = false;
  statusEl.classList.add('show');   // ★ 추가: 디밍/클릭차단 켬
  timerLabel.textContent = '클리어!';
}

function timeover(){
  cancelAnimationFrame(rafId);
  lock = true;
  // 뒤집혀 있던 카드들 다시 닫기 & 입력 막기
  [...board.querySelectorAll('.card')].forEach(c=>{
    if (!c.classList.contains('matched')) c.removeAttribute('disabled');
  });
  statusEl.textContent = '⏰ 시간 초과! RESTART로 다시 도전하세요.';
  statusEl.hidden = false;
  statusEl.classList.add('show');   // ★ 추가: 디밍/클릭차단 켬
  timerLabel.textContent = '시간 종료';
}

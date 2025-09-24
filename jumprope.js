// ===== 설정 =====
const STAGE = document.getElementById('stage');
const PLAYER = document.getElementById('player');
const ROPE = document.querySelector('.rope'); // SVG
const STATUS = document.getElementById('statusText');
const SCORE_EL = document.getElementById('score');
const BEST_EL = document.getElementById('best');
const RESTART = document.getElementById('restartBtn');
const OVERLAY = document.getElementById('overlay');
const OVERLAY_TEXT = document.getElementById('overlayText');
const OVERLAY_RESTART = document.getElementById('overlayRestart');

// 리소스 경로 안내(이미지 3장):
// ./jumprope/guhee.png
// ./jumprope/chulho.png
// ./jumprope/nahyun.png

// 물리/난이도
const GRAVITY = 2300;     // px/s^2
const JUMP_VY = 930;      // 초기 점프 속도(px/s)
const START_SPEED = 150;  // 시작 각속도(도/초)
const SPEED_UP = 8;       // 한 바퀴당 각속도 증가량(도/초)
const MAX_SPEED = 480;    // 상한

// 판정
const HIT_WINDOW = 18;    // 0° 근처 이 정도 범위면 로프 지면 스침
const SAFE_HEIGHT = 46;   // 이 높이(px) 이상이면 로프를 넘었다고 판정

// 상태
let running = false;
let gameOver = false;
let angle = 0;            // 0~360 (도)
let omega = START_SPEED;  // 각속도 (도/초)
let lastTime = 0;
let y = 0;                // 플레이어 발 높이(px)
let vy = 0;               // 속도
let score = 0;
let best = Number(localStorage.getItem('ppm_jump_best') || 0);
BEST_EL.textContent = best;

// 입력
let jumpQueued = false;

function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }

// 시작/리셋
function reset(){
  running = false;
  gameOver = false;
  angle = -100;     // 살짝 뒤에서 시작해서 눈에 들어오게
  omega = START_SPEED;
  lastTime = 0;
  y = 0;
  vy = 0;
  score = 0;
  SCORE_EL.textContent = score;
  setPlayerY(0);
  setAngle(angle);
  OVERLAY.hidden = false;
  OVERLAY_TEXT.textContent = '스페이스 / 화면 탭으로 시작!';
  STATUS.textContent = '스페이스 / 탭으로 점프!';
}

function start(){
  if (running) return;
  running = true;
  OVERLAY.hidden = true;
  lastTime = performance.now();
  requestAnimationFrame(tick);
}

function gameover(){
  running = false;
  gameOver = true;
  OVERLAY_TEXT.textContent = `게임 오버! 점수: ${score}`;
  OVERLAY.hidden = false;

  if (score > best){
    best = score;
    localStorage.setItem('ppm_jump_best', best);
    BEST_EL.textContent = best;
  }
}

function setAngle(deg){
  // SVG 전체를 회전
  ROPE.style.transform = `rotate(${deg}deg)`;
}

function setPlayerY(py){
  PLAYER.style.transform = `translateX(-50%) translateY(${-py}px)`;
}

function jump(){
  if (!running){
    start();
    // 첫 입력 = 시작 & 점프
  }
  // 착지 상태일 때만 점프
  if (y <= 0){
    y = 0;
    vy = JUMP_VY;
  }
}

function tick(now){
  if (!running) return;
  const dt = (now - lastTime) / 1000; // 초
  lastTime = now;

  // 각도/속도
  angle += omega * dt;
  if (angle >= 360){
    angle -= 360;
    // 한 바퀴 돌 때마다 속도 증가 & 점수 +1
    omega = clamp(omega + SPEED_UP, START_SPEED, MAX_SPEED);
    score += 1;
    SCORE_EL.textContent = score;
  }
  setAngle(angle);

  // 플레이어 물리
  vy -= GRAVITY * dt;
  y += vy * dt;
  if (y <= 0){ y = 0; vy = 0; }
  setPlayerY(y);

  // 충돌 판정: 로프가 지면을 스칠 때(0° 근처) & 플레이어가 충분히 안 뛰었으면 아웃
  const a = ((angle % 360) + 360) % 360;
  const nearZero = (a <= HIT_WINDOW) || (a >= 360 - HIT_WINDOW);
  if (nearZero && y < SAFE_HEIGHT){
    gameover();
    return;
  }

  requestAnimationFrame(tick);
}

// 이벤트
document.addEventListener('keydown', (e)=>{
  if (e.code === 'Space'){
    e.preventDefault();
    jump();
  }
});
document.addEventListener('pointerdown', ()=>{
  jump();
});
RESTART.addEventListener('click', ()=>{
  reset();
});
OVERLAY_RESTART.addEventListener('click', ()=>{
  reset();
  start();
});

// 초기화
reset();

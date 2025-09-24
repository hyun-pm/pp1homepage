// ===== 엘리먼트 =====
const STAGE = document.getElementById('stage');
const PLAYER = document.getElementById('player');
const ROPE_SVG = document.getElementById('ropeSvg');
const ROPE_CIRCLE = document.getElementById('ropeCircle');
const HANDLE_L = document.getElementById('handleLeft');
const HANDLE_R = document.getElementById('handleRight');

const STATUS = document.getElementById('statusText');
const SCORE_EL = document.getElementById('score');
const BEST_EL = document.getElementById('best');
const RESTART = document.getElementById('restartBtn');
const OVERLAY = document.getElementById('overlay');
const OVERLAY_TEXT = document.getElementById('overlayText');
const OVERLAY_START = document.getElementById('overlayRestart');

// ===== 파라미터 =====
const GRAVITY = 2300;     // px/s^2
const JUMP_VY = 930;      // px/s
const START_SPEED = 150;  // deg/s
const SPEED_UP = 8;       // per revolution
const MAX_SPEED = 480;    // deg/s

const GROUND_ANGLE = 90;  // 로프가 바닥을 스칠 때 각도
const HIT_WINDOW = 18;    // 허용 각도 범위
const SAFE_HEIGHT = 46;   // 넘었다고 인정하는 높이(px)

// ===== 상태 =====
let running = false;
let angle = -60;          // 시작 각도(왼쪽 위에서 내려오도록)
let omega = START_SPEED;
let lastTime = 0;
let y = 0;                // 플레이어 발 높이(px)
let vy = 0;
let score = 0;
let best = Number(localStorage.getItem('ppm_jump_best') || 0);
BEST_EL.textContent = best;

// 원(로프) 기하
let cx = 500, cy = 500, r = 300; // 로프 원의 중심/반지름 (SVG 좌표계)

// ===== 유틸 =====
function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }
function norm360(a){ a%=360; if(a<0)a+=360; return a; }

// 손잡이 기준으로 원(로프) 재계산
function layoutRope(){
  // 스테이지 기준 좌표
  const stageRect = STAGE.getBoundingClientRect();
  const l = HANDLE_L.getBoundingClientRect();
  const rH = HANDLE_R.getBoundingClientRect();

  // 손잡이 중심 좌표(화면 px)
  const lx = (l.left + l.right)/2 - stageRect.left;
  const ly = (l.top + l.bottom)/2 - stageRect.top;
  const rx = (rH.left + rH.right)/2 - stageRect.left;
  const ry = (rH.top + rH.bottom)/2 - stageRect.top;

  // 두 점이 지름이 되도록 원을 정의
  const mx = (lx + rx)/2;
  const my = (ly + ry)/2;
  const dx = rx - lx;
  const dy = ry - ly;
  const dist = Math.hypot(dx, dy);
  const radius = dist/2;

  // SVG viewBox는 0..1000 고정, 실제 픽셀에 맞춰 스케일
  ROPE_SVG.setAttribute('viewBox', `0 0 ${stageRect.width} ${stageRect.height}`);

  // 원(로프) 갱신
  cx = mx; cy = my; r = radius;
  ROPE_CIRCLE.setAttribute('cx', cx);
  ROPE_CIRCLE.setAttribute('cy', cy);
  ROPE_CIRCLE.setAttribute('r', r);

  // 현재 각도 유지한 채로 회전 기준을 cx,cy로 적용
  ROPE_CIRCLE.setAttribute('transform', `rotate(${angle} ${cx} ${cy})`);
}

// ===== 시작/리셋 =====
function reset(){
  running = false;
  angle = -60;
  omega = START_SPEED;
  lastTime = 0;
  y = 0; vy = 0;
  score = 0;
  SCORE_EL.textContent = score;
  setPlayerY(0);
  layoutRope();

  OVERLAY.hidden = false;
  OVERLAY_TEXT.textContent = 'START!';
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
  OVERLAY_TEXT.textContent = `게임 오버! 점수: ${score}`;
  OVERLAY.hidden = false;

  if (score > best){
    best = score;
    localStorage.setItem('ppm_jump_best', best);
    BEST_EL.textContent = best;
  }
}

// ===== 렌더/물리 =====
function setAngle(deg){
  angle = deg;
  ROPE_CIRCLE.setAttribute('transform', `rotate(${angle} ${cx} ${cy})`);
}
function setPlayerY(py){
  PLAYER.style.transform = `translateX(-50%) translateY(${-py}px)`;
}

// ===== 입력 =====
function jump(){
  if (!running){
    start(); // 첫 입력으로 시작
  }
  if (y <= 0){
    y = 0;
    vy = JUMP_VY;
  }
}

// ===== 루프 =====
function tick(now){
  if (!running) return;
  const dt = (now - lastTime) / 1000;
  lastTime = now;

  // 로프 회전
  let newAngle = angle + omega * dt;
  if (newAngle >= 360){
    newAngle -= 360;
    omega = clamp(omega + SPEED_UP, START_SPEED, MAX_SPEED);
    score += 1;
    SCORE_EL.textContent = score;
  }
  setAngle(newAngle);

  // 플레이어 물리
  vy -= GRAVITY * dt;
  y += vy * dt;
  if (y <= 0){ y = 0; vy = 0; }
  setPlayerY(y);

  // 충돌 판정: 로프가 바닥(90°) 근처를 통과할 때 & 점프 높이가 부족하면 아웃
  const a = norm360(angle);
  const nearGround = Math.min(Math.abs(a - GROUND_ANGLE), 360 - Math.abs(a - GROUND_ANGLE)) <= HIT_WINDOW;
  if (nearGround && y < SAFE_HEIGHT){
    gameover();
    return;
  }

  requestAnimationFrame(tick);
}

// ===== 이벤트 =====
document.addEventListener('keydown', (e)=>{
  if (e.code === 'Space'){
    e.preventDefault();
    jump();
  }
});
document.addEventListener('pointerdown', jump);
RESTART.addEventListener('click', reset);
OVERLAY_START.addEventListener('click', ()=>{
  reset();
  start();
});
window.addEventListener('resize', layoutRope);

// ===== 초기화 =====
layoutRope();
reset();

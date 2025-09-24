// ===== 엘리먼트 =====
const STAGE = document.getElementById('stage');
const PLAYER = document.getElementById('player');

const ROPE_SVG  = document.getElementById('ropeSvg');
const ROPE_PATH = document.getElementById('ropePath');
const HANDLE_L  = document.getElementById('handleLeft');
const HANDLE_R  = document.getElementById('handleRight');

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

const GROUND_ANGLE = 90;      // 로프가 바닥을 스칠 때 각도
const HIT_WINDOW_DEG = 18;    // ±18°
const SAFE_HEIGHT = 46;       // 넘었다고 인정하는 높이(px)

// ===== 상태 =====
let running = false;
let angle = -120;         // 시작 각도(바닥에서 멀리)
let omega = START_SPEED;  // deg/s
let lastTime = 0;
let y = 0;                // 플레이어 발 높이(px)
let vy = 0;
let score = 0;
let best = Number(localStorage.getItem('ppm_jump_best') || 0);
BEST_EL.textContent = best;

// 손 좌표 / 중점 / 반경
let L = {x:100, y:100};
let R = {x:900, y:100};
let C = {x:500, y:100};  // midpoint
let RAD = 200;           // 제어점 회전 반경

// ===== 유틸 =====
const clamp = (v,min,max)=> Math.max(min, Math.min(max, v));
const norm360 = a => { a%=360; if(a<0)a+=360; return a; };
const shortestDegDist = (a,b) => {
  let d = Math.abs(norm360(a) - norm360(b));
  return Math.min(d, 360 - d);
};

// 스테이지 픽셀 좌표를 SVG 뷰박스로 맞춰줌
function layout(){
  const rect = STAGE.getBoundingClientRect();
  ROPE_SVG.setAttribute('viewBox', `0 0 ${rect.width} ${rect.height}`);

  const lr = HANDLE_L.getBoundingClientRect();
  const rr = HANDLE_R.getBoundingClientRect();

  // 손잡이 중심 (스테이지 좌표계)
  L.x = (lr.left + lr.right)/2 - rect.left;
  L.y = (lr.top  + lr.bottom)/2 - rect.top;
  R.x = (rr.left + rr.right)/2 - rect.left;
  R.y = (rr.top  + rr.bottom)/2 - rect.top;

  // 중점/반경
  C.x = (L.x + R.x)/2;
  C.y = (L.y + R.y)/2;
  const dx = R.x - L.x;
  const dy = R.y - L.y;
  RAD = Math.hypot(dx, dy) * 0.55; // 손 사이 거리의 절반보다 약간 크게

  // 최초 로프 그리기
  drawRope(angle);
}

// angle(도)에 따라 로프 곡선을 그린다.
// - 좌/우 손은 고정.
// - 제어점(QBezier)이 중점 C를 중심으로 반지름 RAD 원을 따라 회전 → ‘하나의 줄’이 도는 느낌.
function drawRope(deg){
  const t = deg * Math.PI / 180;
  const biasX = 0.85;  // 좌우로 조금 더 크게
  const biasY = 1.05;  // 위아래는 더 크게 (지면 쓸어내리는 느낌)
  const cx = C.x + Math.cos(t) * RAD * biasX;
  const cy = C.y + Math.sin(t) * RAD * biasY;

  const d = `M ${L.x} ${L.y} Q ${cx} ${cy} ${R.x} ${R.y}`;
  ROPE_PATH.setAttribute('d', d);
}

// ===== 시작/리셋 =====
function reset(){
  running = false;
  angle = -120;
  omega = START_SPEED;
  lastTime = 0;
  y = 0; vy = 0;
  score = 0;
  SCORE_EL.textContent = score;
  setPlayerY(0);

  layout(); // ← 중요: 손 위치를 기반으로 첫 그리기
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
  drawRope(deg);
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
  let newAngle = angle + omega * dt; // deg
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

  // 충돌 판정: 바닥 스침 각도(90°) 근처 통과 + 점프 부족
  const near = shortestDegDist(angle, GROUND_ANGLE) <= HIT_WINDOW_DEG;
  if (near && y < SAFE_HEIGHT){
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
OVERLAY_START.addEventListener('click', ()=>{ reset(); start(); });
window.addEventListener('resize', layout);

// ===== 초기화 =====
layout();
reset();

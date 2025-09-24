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
const MAX_SPEED = 520;    // deg/s

// angle=0 이 "앞 바닥" (넘어야 하는 순간)
const BOTTOM_FRONT_ANGLE = 0;   // 기준
const HIT_WINDOW_DEG = 16;      // ±16°
const SAFE_HEIGHT = 50;         // 이 높이(px) 이상이면 성공으로 간주

// ===== 상태 =====
let running = false;
let angle = -110;         // 시작 각도(앞바닥에서 멀리)
let omega = START_SPEED;  // deg/s
let lastTime = 0;
let y = 0;                // 플레이어 발 높이(px)
let vy = 0;
let score = 0;
let best = Number(localStorage.getItem('ppm_jump_best') || 0);
BEST_EL.textContent = best;

// 손 좌표 / 중점 / 타원 반경
let L = {x:100, y:100};
let R = {x:900, y:100};
let C = {x:500, y:100};  // midpoint
let RX = 260;            // 타원의 가로 반경
let RY = 180;            // 타원의 세로 반경 (크면 앞/뒤 움직임이 강조)

// ===== 유틸 =====
const clamp = (v,min,max)=> Math.max(min, Math.min(max, v));
const norm360 = a => { a%=360; if(a<0)a+=360; return a; };
const shortDegDist = (a,b) => {
  let d = Math.abs(norm360(a) - norm360(b));
  return Math.min(d, 360 - d);
};

// 스테이지 픽셀 좌표로 앵커 재계산
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

  // 중점
  C.x = (L.x + R.x)/2;
  C.y = (L.y + R.y)/2;

  // 손 사이 거리 기반으로 타원 반경을 정해 "앞/뒤" 깊이감을 줌
  const handDist = Math.hypot(R.x - L.x, R.y - L.y);
  RX = handDist * 0.55;      // 좌우로 넓게
  RY = handDist * 0.38;      // 위/아래로 과하지 않게 (앞바닥 스침을 분명히)

  drawRope(angle);
}

// angle(도)에 따라 로프 곡선을 그린다.
//  - 좌/우 손은 고정.
//  - 제어점(QBezier)이 중심 C를 기준으로 타원 궤도를 따라 회전.
//  - t = angle(도)를 라디안으로 바꾼 뒤, "0°=앞바닥"이 되도록 +90° 오프셋.
function drawRope(deg){
  const t = (deg * Math.PI / 180) + (Math.PI / 2); // 0° -> 아래쪽(앞바닥)
  const depthBoost = 1.08; // 앞쪽으로 약간 더 내려오게(시각적 강조)

  const cx = C.x + Math.cos(t) * RX * 0.9;            // 좌우 살짝 덜 넓게
  const cy = C.y + Math.sin(t) * RY * depthBoost;     // 앞/뒤 느낌 강조

  const d = `M ${L.x} ${L.y} Q ${cx} ${cy} ${R.x} ${R.y}`;
  ROPE_PATH.setAttribute('d', d);
}

// ===== 시작/리셋 =====
function reset(){
  running = false;
  angle = -110;             // 안전한 시작
  omega = START_SPEED;
  lastTime = 0;

  y = 0; vy = 0;
  score = 0;
  SCORE_EL.textContent = score;
  setPlayerY(0);

  layout();                 // ← 중요: 손 위치 반영
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
    start();         // 첫 입력으로 시작
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

  // 충돌 판정: "앞바닥(0°)" 근처일 때 + 높이 부족이면 실패
  const nearFrontBottom = shortDegDist(angle, BOTTOM_FRONT_ANGLE) <= HIT_WINDOW_DEG;
  if (nearFrontBottom && y < SAFE_HEIGHT){
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

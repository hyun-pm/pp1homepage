// ===== 엘리먼트 =====
const STAGE = document.getElementById('stage');
const PLAYER = document.getElementById('player');
const ROPE_SVG = document.getElementById('ropeSvg');
const ROPE_CIRCLE = document.getElementById('ropeCircle'); // HTML의 <circle id="ropeCircle">

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

// "바닥 스침" 기준 각도 (시계방향 회전에서 바닥 통과 지점)
const GROUND_ANGLE = 90;           // 90°
const HIT_WINDOW_DEG = 18;         // ±18°
const HIT_WINDOW_RAD = HIT_WINDOW_DEG * Math.PI / 180;
const SAFE_HEIGHT = 46;            // 넘었다고 인정하는 높이(px)

// ===== 상태 =====
let running = false;
let angle = -120;         // 시작 각도(왼쪽 위에서 내려오도록), 0에 가까우면 시작하자마자 죽음
let omega = START_SPEED;  // deg/s
let lastTime = 0;
let y = 0;                // 플레이어 발 높이(px)
let vy = 0;
let score = 0;
let best = Number(localStorage.getItem('ppm_jump_best') || 0);
BEST_EL.textContent = best;

// 로프 길이(둘레) — viewBox/반지름이 바뀔 때마다 갱신
let ropeLen = 1000 * Math.PI * 0.6; // 초기 대충값(레이아웃 후 갱신)

// ===== 유틸 =====
const clamp = (v,min,max)=> Math.max(min, Math.min(max, v));
const norm360 = a => { a%=360; if(a<0)a+=360; return a; };
const shortestDegDist = (a,b) => {
  let d = Math.abs(norm360(a) - norm360(b));
  return Math.min(d, 360 - d);
};

// 로프 시각 회전용: 원은 회전해도 안 보이므로 dashoffset으로 "움직임"을 만든다.
function updateRopeVisualByAngle(deg){
  // 각도 → dashoffset으로 변환
  const offset = (deg / 360) * ropeLen;
  ROPE_CIRCLE.style.strokeDashoffset = `${offset}`;
}

// viewBox / 원 둘레 / dasharray 세팅
function layoutRope(){
  const rect = STAGE.getBoundingClientRect();
  // 스테이지 픽셀 크기를 viewBox로 그대로 사용
  ROPE_SVG.setAttribute('viewBox', `0 0 ${rect.width} ${rect.height}`);

  // circle의 cx, cy, r는 HTML에서 초기값을 쓰되, 둘레만 실제 픽셀 기준으로 다시 계산
  const cx = Number(ROPE_CIRCLE.getAttribute('cx'));
  const cy = Number(ROPE_CIRCLE.getAttribute('cy'));
  const r  = Number(ROPE_CIRCLE.getAttribute('r'));

  // 만약 r가 상대값(디폴트)라면 스테이지 폭에 비례해 보정 (원본 HTML은 1000 기반이었음)
  const scaleX = rect.width / 1000;
  const scaleY = rect.height / 1000;
  const scale = (scaleX + scaleY) / 2; // 대충 평균 스케일
  const realR = r * scale;

  ropeLen = 2 * Math.PI * realR;

  // 거의 끊김 없는 실선이지만 1px 갭을 둠 → dashoffset 변화가 "회전"처럼 보임
  const gap = Math.max(1, Math.round(ropeLen * 0.006)); // 화면에 따라 1~몇 px
  const solid = Math.max(1, Math.round(ropeLen - gap));
  ROPE_CIRCLE.style.strokeDasharray = `${solid} ${gap}`;

  // 현재 각도 반영
  updateRopeVisualByAngle(angle);
}

// ===== 시작/리셋 =====
function reset(){
  running = false;
  angle = -120;         // 안전한 시작 각도(바닥 근처가 아님)
  omega = START_SPEED;
  lastTime = 0;
  y = 0; vy = 0;
  score = 0;
  SCORE_EL.textContent = score;
  setPlayerY(0);

  layoutRope();                 // ← 중요! 시작 전에 레이아웃 갱신
  updateRopeVisualByAngle(angle);

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
  updateRopeVisualByAngle(deg);
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

  // 충돌 판정: 바닥 스침 각도(GROUND_ANGLE) 근처 통과 + 점프 부족
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
OVERLAY_START.addEventListener('click', ()=>{
  reset();
  start();
});
window.addEventListener('resize', layoutRope);

// ===== 초기화 =====
layoutRope();
reset();

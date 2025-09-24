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

// ===== 난이도/물리 =====
const GRAVITY = 2300;     // px/s^2
const JUMP_VY = 930;      // px/s
const START_SPEED = 150;  // deg/s
const SPEED_UP = 8;       // per revolution
const MAX_SPEED = 520;    // deg/s

// 판정: "앞바닥"이 0°. 이때 점프해야 함.
const FRONT_BOTTOM_ANGLE = 0;
const HIT_WINDOW_DEG = 16;  // ±16°
const SAFE_HEIGHT = 50;     // px

// ===== 상태 =====
let running = false;
let angle = -110;         // 시작 각도(안전)
let omega = START_SPEED;  // deg/s
let lastTime = 0;
let y = 0;                // 플레이어 발 높이(px)
let vy = 0;
let score = 0;
let best = Number(localStorage.getItem('ppm_jump_best') || 0);
BEST_EL.textContent = best;

// ===== 손 위치: 캐릭터 이미지 안에서 "손"이 차지하는 퍼센트 오프셋 =====
//   그림마다 손의 위치가 다르니, 필요하면 이 퍼센트를 살짝 조절하면 돼.
//   (왼쪽/오른쪽 이미지는 서로 좌우 반전이 있으니 값도 다를 수 있음)
const LEFT_HAND_OFFSET  = { x: 0.82, y: 0.45 }; // (0~1) 이미지 내부에서 오른쪽으로 82%, 위에서 45%
const RIGHT_HAND_OFFSET = { x: 0.18, y: 0.45 }; // 이미지 내부에서 왼쪽으로 18%, 위에서 45%

// 손/중점/타원 반경
let L = {x:100, y:100};
let R = {x:900, y:100};
let C = {x:500, y:100};
let RX = 260;            // 가로 반경
let RY = 180;            // 세로 반경

// ===== 유틸 =====
const clamp = (v,min,max)=> Math.max(min, Math.min(max, v));
const norm360 = a => { a%=360; if(a<0)a+=360; return a; };
const shortDegDist = (a,b) => {
  let d = Math.abs(norm360(a) - norm360(b));
  return Math.min(d, 360 - d);
};

// 스테이지 좌표로 핸들 좌표 계산(이미지의 손 위치에 붙임)
function computeHandlePositions(){
  const rect = STAGE.getBoundingClientRect();
  const imgL = document.querySelector('.side-left').getBoundingClientRect();
  const imgR = document.querySelector('.side-right').getBoundingClientRect();

  // 왼쪽 이미지는 scaleX(-1) 되어 있으니, 내부 좌표 계산에 주의
  const lX = imgL.left + imgL.width  * (1 - LEFT_HAND_OFFSET.x);
  const lY = imgL.top  + imgL.height * LEFT_HAND_OFFSET.y;

  const rX = imgR.left + imgR.width  * RIGHT_HAND_OFFSET.x;
  const rY = imgR.top  + imgR.height * RIGHT_HAND_OFFSET.y;

  L.x = lX - rect.left;
  L.y = lY - rect.top;
  R.x = rX - rect.left;
  R.y = rY - rect.top;
}

// SVG 크기/뷰박스 세팅 + 타원 파라미터 구성
function layout(){
  const rect = STAGE.getBoundingClientRect();
  ROPE_SVG.setAttribute('viewBox', `0 0 ${rect.width} ${rect.height}`);

  // 손 좌표 갱신
  computeHandlePositions();

  // 중점
  C.x = (L.x + R.x)/2;
  C.y = (L.y + R.y)/2;

  // 손 사이 거리 기반으로 타원 반경
  const handDist = Math.hypot(R.x - L.x, R.y - L.y);
  RX = handDist * 0.55;   // 좌우로 넓게
  RY = handDist * 0.38;   // 위/아래는 과하지 않게

  drawRope(angle);
}

// angle(도)에 따라 로프 곡선을 그린다.
// - 좌/우 손은 고정.
// - 제어점이 중심 C를 기준으로 타원 궤도를 따라 회전.
// - 시각적으로 "앞으로 내려오면 플레이어 앞"이 되게 z-index를 바꿔준다.
function drawRope(deg){
  // 0° = 앞바닥. 그려지는 제어점은 +90° 오프셋을 주면 아래 방향이 0°가 됨.
  const t = (deg * Math.PI / 180) + (Math.PI / 2);
  const depthBoost = 1.10;

  const cx = C.x + Math.cos(t) * RX * 0.9;
  const cy = C.y + Math.sin(t) * RY * depthBoost;

  const d = `M ${L.x} ${L.y} Q ${cx} ${cy} ${R.x} ${R.y}`;
  ROPE_PATH.setAttribute('d', d);

  // ★ 앞/뒤 레이어 전환: 0°를 기준으로 ±90° 이내면 "앞면"
  const frontHalf = shortDegDist(deg, FRONT_BOTTOM_ANGLE) <= 90;
  ROPE_SVG.classList.toggle('front', frontHalf);
}

// ===== 시작/리셋 =====
function reset(){
  running = false;
  angle = -110;
  omega = START_SPEED;
  lastTime = 0;

  y = 0; vy = 0;
  score = 0;
  SCORE_EL.textContent = score;
  setPlayerY(0);

  layout();
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
    start();  // 첫 입력으로 시작
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

  // 충돌 판정: 앞바닥(0°) 근처 + 높이 부족이면 실패
  const nearFrontBottom = shortDegDist(angle, FRONT_BOTTOM_ANGLE) <= HIT_WINDOW_DEG;
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

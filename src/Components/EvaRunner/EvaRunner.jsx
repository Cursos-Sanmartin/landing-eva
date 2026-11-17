import { useEffect, useRef } from "react";
import "./EvaRunner.css";

// Juego escondido: el logo de EVA, con patitas, corre por el piso.
// Salta las pilas de cuadernos y se agacha (o salta) para esquivar
// los aviones de papel. Se abre al clickear la carta de Lean en Equipo.

const W = 800; // ancho lógico del canvas
const H = 240; // alto lógico
const GROUND = 205; // línea del piso
const GRAVITY = 2600; // px/s²
const FAST_FALL = 3; // agachado en el aire, cae más rápido
const JUMP = -820; // velocidad inicial del salto
const START_SPEED = 380; // px/s
const MAX_SPEED = 900;
const PLANES_FROM = 120; // puntaje desde el que aparecen aviones
const LOGO_CROP = { w: 219, h: 71 }; // la palabra "eva" dentro de eva-logo.png
const BEST_KEY = "eva-runner-best";

// El jugador: la palabra "eva". Corre inclinada a 45° y se acuesta
// (horizontal) al agacharse.
const PX = 60; // borde izquierdo del jugador
const BODY_W = 84;
const BODY_H = 27;
const RUN_ANGLE = -Math.PI / 4; // 45°, subiendo hacia adelante
const LEG_H = 13; // patitas estiradas (corriendo)
const DUCK_LEG_H = 5; // patitas dobladas (agachado)
const TURN_SPEED = 14; // qué tan rápido pasa de inclinado a horizontal

const NAVY = "#0a2e5e";
const CYAN = "#00a9e9";
const SKY = "#a9def8";
const MUTED = "#4d6a8a";
const COVERS = ["#00a9e9", "#0a2e5e", "#4fbdf0", "#005a82", "#ffcf5c"];

function readBest() {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
}

function saveBest(n) {
  try {
    localStorage.setItem(BEST_KEY, String(n));
  } catch {
    /* sin almacenamiento: no pasa nada */
  }
}

function rand(a, b) {
  return a + Math.random() * (b - a);
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

// Obstáculos ---------------------------------------------------------------

// Pila de cuadernos en el piso: hay que saltarla
function makeNotebooks(x) {
  const piles = Math.random() < 0.25 ? 2 : 1;
  const count = 1 + Math.floor(Math.random() * 3); // 1 a 3 por pila
  const stack = Array.from({ length: count }, (_, i) => ({
    color: pick(COVERS),
    shift: i === 0 ? 0 : rand(-3, 3),
  }));
  const pileW = 40;
  const w = piles === 2 ? pileW * 2 + 6 : pileW;
  return { kind: "notebooks", x, w, h: count * 11, piles, pileW, stack };
}

// Avión de papel: "alto" pasa a la altura de la cabeza (agacharse o saltar),
// "bajo" va casi rozando el piso (hay que saltarlo)
function makePlane(x) {
  const high = Math.random() < 0.6;
  const bottom = high ? 174 : 199;
  return {
    kind: "plane",
    x,
    w: 46,
    h: 17,
    top: bottom - 17,
    phase: rand(0, Math.PI * 2),
    extra: rand(30, 70), // vuela un poco más rápido que el piso
  };
}

function obstacleTop(o) {
  return o.kind === "plane" ? o.top : GROUND - o.h;
}

function drawNotebookPile(ctx, x, stack) {
  stack.forEach((nb, i) => {
    const y = GROUND - (i + 1) * 11;
    const nx = x + nb.shift;
    // tapa
    ctx.fillStyle = nb.color;
    ctx.fillRect(nx, y, 40, 10);
    // hojas (canto blanco)
    ctx.fillStyle = "#fff";
    ctx.fillRect(nx + 4, y + 7, 34, 2);
    // espiral
    ctx.fillStyle = "#dbe8f2";
    for (let s = 0; s < 4; s++) ctx.fillRect(nx + 1, y + 1 + s * 2.3, 3, 1.4);
    // etiqueta
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillRect(nx + 16, y + 2, 12, 3);
  });
}

function drawPlane(ctx, o, t) {
  const y = o.top + Math.sin(t / 180 + o.phase) * 1.5;
  const x = o.x;
  // ala de abajo (sombra)
  ctx.fillStyle = SKY;
  ctx.beginPath();
  ctx.moveTo(x, y + 8);
  ctx.lineTo(x + 46, y + 11);
  ctx.lineTo(x + 40, y + 17);
  ctx.closePath();
  ctx.fill();
  // ala de arriba
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = NAVY;
  ctx.lineWidth = 1.5;
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(x, y + 8); // punta
  ctx.lineTo(x + 46, y); // cola arriba
  ctx.lineTo(x + 46, y + 11);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // pliegue del medio
  ctx.beginPath();
  ctx.moveTo(x + 2, y + 8);
  ctx.lineTo(x + 46, y + 6);
  ctx.stroke();
  // estela
  ctx.strokeStyle = "rgba(10,46,94,0.18)";
  ctx.setLineDash([4, 5]);
  ctx.beginPath();
  ctx.moveTo(x + 52, y + 7);
  ctx.lineTo(x + 78, y + 7);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawCloud(ctx, c) {
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(c.x, c.y, 12, 0, Math.PI * 2);
  ctx.arc(c.x + 14, c.y - 6, 15, 0, Math.PI * 2);
  ctx.arc(c.x + 30, c.y, 11, 0, Math.PI * 2);
  ctx.fill();
}

function lerp(a, b, f) {
  return a + (b - a) * f;
}

// Cuánto está inclinado: 1 = 45° (corriendo), 0 = horizontal (agachado)
function tiltOf(angle) {
  return Math.max(0, Math.min(1, angle / RUN_ANGLE));
}

// Dónde está el jugador según su ángulo: el punto más bajo del cuerpo
// queda apoyado sobre las patitas, y las patitas sobre el piso
function playerPose(angle, lift) {
  const f = tiltOf(angle);
  const legH = lerp(DUCK_LEG_H, LEG_H, f);
  const halfY =
    (BODY_W / 2) * Math.abs(Math.sin(angle)) +
    (BODY_H / 2) * Math.abs(Math.cos(angle));
  const halfX =
    (BODY_W / 2) * Math.abs(Math.cos(angle)) +
    (BODY_H / 2) * Math.abs(Math.sin(angle));
  const cx = PX + halfX;
  const cy = GROUND - lift - legH - halfY;

  // Caderas: dos puntos sobre el borde de abajo de la palabra.
  // Inclinado salen de la "e" (la parte que queda abajo); acostado,
  // se separan debajo de toda la palabra.
  const v = BODY_H / 2 - 2;
  const hips = [lerp(-22, -36, f), lerp(22, -21, f)].map((u) => ({
    x: cx + u * Math.cos(angle) - v * Math.sin(angle),
    y: cy + u * Math.sin(angle) + v * Math.cos(angle),
  }));
  const feetY = GROUND - lift - 2;
  return { cx, cy, hips, feetY };
}

// Para los choques, la palabra se aproxima con 4 círculos en fila
// a lo largo de su eje (así la caja inclinada no tiene esquinas vacías)
// más un círculo para los pies, que también se chocan los cuadernos
function playerCircles(angle, lift) {
  const { cx, cy, hips, feetY } = playerPose(angle, lift);
  const r = BODY_H / 2 - 2;
  const body = [-0.36, -0.12, 0.12, 0.36].map((k) => ({
    x: cx + Math.cos(angle) * k * BODY_W,
    y: cy + Math.sin(angle) * k * BODY_W,
    r,
  }));
  const feet = { x: (hips[0].x + hips[1].x) / 2, y: feetY - 4, r: 6 };
  return [...body, feet];
}

// Patitas: dos piernas que se mueven al correr, recogidas en el aire,
// dobladas al agacharse
function drawLegs(ctx, hips, feetY, mode, t) {
  ctx.strokeStyle = NAVY;
  ctx.fillStyle = NAVY;
  ctx.lineWidth = 3.5;
  ctx.lineCap = "round";
  hips.forEach((hip, i) => {
    let fx = hip.x;
    let fy = feetY;
    let kneeX = hip.x + 3;
    let kneeY = (hip.y + feetY) / 2;
    if (mode === "run") {
      const s = Math.sin(t / 55 + i * Math.PI);
      fx = hip.x + s * 8;
      fy = feetY - Math.max(0, -s) * 4; // el pie que vuelve se levanta
      kneeX = hip.x + s * 3 + 4;
    } else if (mode === "air") {
      fx = hip.x - 4;
      fy = Math.min(feetY, hip.y + 9);
      kneeX = hip.x + 6;
      kneeY = hip.y + 5;
    } else if (mode === "duck") {
      fx = hip.x + (i ? 7 : -7);
      kneeX = hip.x + (i ? 8 : -8);
      kneeY = hip.y + 1;
    }
    ctx.beginPath();
    ctx.moveTo(hip.x, hip.y);
    ctx.quadraticCurveTo(kneeX, kneeY, fx, fy);
    ctx.stroke();
    // pie
    ctx.beginPath();
    ctx.ellipse(fx + 3, fy, 5, 2.6, 0, 0, Math.PI * 2);
    ctx.fill();
  });
}

function circleHitsBox(c, x1, y1, x2, y2) {
  const nx = Math.max(x1, Math.min(c.x, x2));
  const ny = Math.max(y1, Math.min(c.y, y2));
  return (c.x - nx) ** 2 + (c.y - ny) ** 2 < c.r * c.r;
}

function EvaRunner({ onClose }) {
  const canvasRef = useRef(null);
  const dialogRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    const logo = new Image();
    logo.src = "/eva-logo.png";

    const g = {
      state: "ready", // ready | running | over
      lift: 0, // altura de los pies sobre el piso
      vy: 0,
      duck: false,
      angle: RUN_ANGLE,
      speed: START_SPEED,
      score: 0,
      best: readBest(),
      obstacles: [],
      nextGap: 0,
      clouds: [
        { x: 120, y: 50 },
        { x: 430, y: 80 },
        { x: 700, y: 40 },
      ],
      groundOffset: 0,
      overAt: 0,
      flash: 0,
    };

    const onGround = () => g.lift <= 0.01;

    function spawn(x) {
      const planesOn = g.score >= PLANES_FROM;
      return planesOn && Math.random() < 0.4 ? makePlane(x) : makeNotebooks(x);
    }

    function reset() {
      g.state = "running";
      g.lift = 0;
      g.vy = 0;
      g.angle = RUN_ANGLE;
      g.speed = START_SPEED;
      g.score = 0;
      g.obstacles = [makeNotebooks(W + 40)];
      g.nextGap = rand(1, 1.8) * START_SPEED * 0.75;
    }

    function jump() {
      if (g.state === "ready") {
        reset();
        g.vy = JUMP;
        return;
      }
      if (g.state === "over") {
        if (performance.now() - g.overAt > 450) reset();
        return;
      }
      if (onGround()) g.vy = JUMP;
    }

    function setDuck(on) {
      g.duck = on;
    }

    function update(dt) {
      // Nubes se mueven siempre (más lento si no estás jugando)
      const drift = g.state === "running" ? g.speed : 60;
      for (const c of g.clouds) {
        c.x -= drift * 0.15 * dt;
        if (c.x < -50) {
          c.x = W + rand(20, 200);
          c.y = rand(30, 95);
        }
      }
      if (g.state !== "running") return;

      g.groundOffset = (g.groundOffset + g.speed * dt) % 40;
      g.speed = Math.min(MAX_SPEED, g.speed + 9 * dt);

      const before = Math.floor(g.score / 100);
      g.score += (g.speed * dt) / 40;
      if (Math.floor(g.score / 100) > before) g.flash = 0.6;
      g.flash = Math.max(0, g.flash - dt);

      // Salto (vy negativo = sube)
      const grav = g.duck && !onGround() ? GRAVITY * FAST_FALL : GRAVITY;
      g.vy += grav * dt;
      g.lift = Math.max(0, g.lift - g.vy * dt);
      if (g.lift === 0 && g.vy > 0) g.vy = 0;

      for (const o of g.obstacles) {
        o.x -= (g.speed + (o.kind === "plane" ? o.extra : 0)) * dt;
      }
      g.obstacles = g.obstacles.filter((o) => o.x + o.w > -90);
      const last = g.obstacles[g.obstacles.length - 1];
      if (!last || W - (last.x + last.w) > g.nextGap) {
        g.obstacles.push(spawn(W + 10));
        g.nextGap = rand(1, 2.1) * g.speed * 0.7;
      }

      // Gira suave entre inclinado (corriendo) y horizontal (agachado)
      const target = g.duck ? 0 : RUN_ANGLE;
      g.angle += (target - g.angle) * Math.min(1, TURN_SPEED * dt);

      // Choque: los círculos de la palabra contra cada obstáculo
      const circles = playerCircles(g.angle, g.lift);
      for (const o of g.obstacles) {
        const oTop = obstacleTop(o) + 2;
        const oBottom = obstacleTop(o) + o.h - 2;
        const hit = circles.some((c) =>
          circleHitsBox(c, o.x + 3, oTop, o.x + o.w - 3, oBottom),
        );
        if (hit) {
          g.state = "over";
          g.duck = false;
          g.overAt = performance.now();
          const final = Math.floor(g.score);
          if (final > g.best) {
            g.best = final;
            saveBest(final);
          }
          break;
        }
      }
    }

    function drawPlayer(t) {
      const running = g.state === "running";
      const { cx, cy, hips, feetY } = playerPose(g.angle, g.lift);
      // Rebotecito al correr por el piso
      const bob =
        running && onGround() && !g.duck ? -Math.abs(Math.sin(t / 55)) * 1.5 : 0;

      let mode = "stand";
      if (running && !onGround()) mode = "air";
      else if (g.duck && running) mode = "duck";
      else if (running) mode = "run";
      const bobbedHips = hips.map((h) => ({ x: h.x, y: h.y + bob }));
      drawLegs(ctx, bobbedHips, feetY, mode, t);
      const bodyW = BODY_W;
      const bodyH = BODY_H;
      ctx.save();
      ctx.translate(cx, cy + bob);
      ctx.rotate(g.angle);
      if (logo.complete && logo.naturalWidth) {
        ctx.drawImage(
          logo,
          0,
          0,
          LOGO_CROP.w,
          LOGO_CROP.h,
          -bodyW / 2,
          -bodyH / 2,
          bodyW,
          bodyH,
        );
      } else {
        ctx.fillStyle = NAVY;
        ctx.font = "800 26px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("eva", 0, 0);
      }
      ctx.restore();
    }

    function draw(t) {
      ctx.clearRect(0, 0, W, H);

      for (const c of g.clouds) drawCloud(ctx, c);

      // Piso
      ctx.fillStyle = NAVY;
      ctx.fillRect(0, GROUND, W, 2);
      ctx.fillStyle = SKY;
      for (let x = -g.groundOffset; x < W; x += 40) {
        ctx.fillRect(x, GROUND + 9, 14, 2);
        ctx.fillRect(x + 22, GROUND + 18, 6, 2);
      }

      for (const o of g.obstacles) {
        if (o.kind === "plane") drawPlane(ctx, o, t);
        else {
          drawNotebookPile(ctx, o.x, o.stack);
          if (o.piles === 2) drawNotebookPile(ctx, o.x + o.pileW + 6, o.stack);
        }
      }

      drawPlayer(t);

      // Puntaje
      ctx.textAlign = "right";
      ctx.textBaseline = "top";
      ctx.font = "700 16px ui-monospace, monospace";
      const blink = g.flash > 0 && Math.floor(g.flash * 10) % 2 === 0;
      ctx.fillStyle = blink ? CYAN : NAVY;
      ctx.fillText(String(Math.floor(g.score)).padStart(5, "0"), W - 16, 14);
      if (g.best) {
        ctx.fillStyle = MUTED;
        ctx.fillText(`MEJOR ${String(g.best).padStart(5, "0")}`, W - 90, 14);
      }

      ctx.textAlign = "center";
      if (g.state === "ready") {
        ctx.fillStyle = NAVY;
        ctx.font = "700 20px sans-serif";
        ctx.fillText("Tocá, clickeá o apretá espacio para arrancar", W / 2, 70);
        ctx.font = "600 15px sans-serif";
        ctx.fillStyle = MUTED;
        ctx.fillText("Saltá los cuadernos · agachate bajo los aviones", W / 2, 100);
      } else if (g.state === "over") {
        ctx.fillStyle = NAVY;
        ctx.font = "800 26px sans-serif";
        ctx.fillText("¡Uy, te chocaste!", W / 2, 66);
        ctx.font = "600 16px sans-serif";
        ctx.fillStyle = MUTED;
        ctx.fillText("Tocá o apretá espacio para volver a jugar", W / 2, 102);
      }
    }

    let raf = 0;
    let last = performance.now();
    function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      update(dt);
      draw(now);
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    const isDuckKey = (e) => e.key === "ArrowDown" || e.key === "s" || e.key === "S";

    function onKeyDown(e) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.code === "Space" || e.key === "ArrowUp" || e.key === "w" || e.key === "W") {
        e.preventDefault();
        if (!e.repeat) jump();
      } else if (isDuckKey(e)) {
        e.preventDefault();
        setDuck(true);
      }
    }
    function onKeyUp(e) {
      if (isDuckKey(e)) setDuck(false);
    }

    // En pantalla táctil: mitad de arriba salta, mitad de abajo agacha
    function onPointerDown(e) {
      e.preventDefault();
      if (g.state !== "running") {
        jump();
        return;
      }
      const rect = canvas.getBoundingClientRect();
      const lower = e.clientY - rect.top > rect.height / 2;
      if (lower) {
        setDuck(true);
        canvas.setPointerCapture?.(e.pointerId);
      } else {
        jump();
      }
    }
    function onPointerUp() {
      setDuck(false);
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <div className="runner-backdrop" onClick={onClose}>
      <div
        ref={dialogRef}
        className="runner-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="EVA Runner, juego"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="runner-head">
          <strong>EVA Runner</strong>
          <button
            type="button"
            className="runner-close"
            onClick={onClose}
            aria-label="Cerrar el juego"
          >
            ×
          </button>
        </div>
        <canvas ref={canvasRef} className="runner-canvas" />
        <p className="runner-help">
          Saltá con <kbd>espacio</kbd> o <kbd>↑</kbd>, agachate con <kbd>↓</kbd>.
          En el celu: tocá arriba para saltar y mantené abajo para agacharte.
          Cerrá con <kbd>Esc</kbd>.
        </p>
      </div>
    </div>
  );
}

export default EvaRunner;

import { useEffect, useRef } from "react";
import "./EvaRunner.css";

// Juego escondido: el logo de EVA corre y salta pilas de libros y lápices.
// Se abre al clickear la carta de Lean en la sección Equipo.

const W = 800; // ancho lógico del canvas
const H = 240; // alto lógico
const GROUND = 205; // línea del piso
const GRAVITY = 2600; // px/s²
const JUMP = -820; // velocidad inicial del salto
const START_SPEED = 380; // px/s
const MAX_SPEED = 900;
const LOGO_CROP = { w: 219, h: 71 }; // la palabra "eva" dentro de eva-logo.png
const PLAYER = { x: 60, w: 84, h: 27 };
const BEST_KEY = "eva-runner-best";

const NAVY = "#0a2e5e";
const CYAN = "#00a9e9";
const SKY = "#a9def8";
const SUN = "#ffe499";

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

// Obstáculos: pila de libros, lápiz parado o dos pilas juntas
function makeObstacle(x) {
  const r = Math.random();
  if (r < 0.45) {
    const books = Math.random() < 0.5 ? 2 : 3;
    return { kind: "books", x, w: 34, h: books * 13, books };
  }
  if (r < 0.8) return { kind: "pencil", x, w: 14, h: rand(44, 58) };
  return { kind: "double", x, w: 62, h: 26, books: 2 };
}

function drawBooks(ctx, x, y, w, count) {
  const colors = [CYAN, NAVY, "#4fbdf0", "#005a82"];
  for (let i = 0; i < count; i++) {
    const by = y + i * 13;
    const inset = i % 2 ? 2 : 0;
    ctx.fillStyle = colors[i % colors.length];
    ctx.fillRect(x + inset, by, w - inset * 2, 12);
    ctx.fillStyle = "#fff";
    ctx.fillRect(x + inset + 3, by + 3, w - inset * 2 - 6, 2);
  }
}

function drawObstacle(ctx, o) {
  const y = GROUND - o.h;
  if (o.kind === "pencil") {
    ctx.fillStyle = SUN;
    ctx.fillRect(o.x, y + 10, o.w, o.h - 10);
    ctx.fillStyle = NAVY;
    ctx.fillRect(o.x, GROUND - 6, o.w, 6); // goma
    ctx.fillStyle = "#e9c98f";
    ctx.beginPath();
    ctx.moveTo(o.x, y + 10);
    ctx.lineTo(o.x + o.w / 2, y);
    ctx.lineTo(o.x + o.w, y + 10);
    ctx.fill();
    ctx.fillStyle = NAVY;
    ctx.beginPath();
    ctx.moveTo(o.x + o.w / 2 - 2.5, y + 3);
    ctx.lineTo(o.x + o.w / 2, y);
    ctx.lineTo(o.x + o.w / 2 + 2.5, y + 3);
    ctx.fill();
    return;
  }
  if (o.kind === "double") {
    drawBooks(ctx, o.x, y, 28, o.books);
    drawBooks(ctx, o.x + 34, y, 28, o.books);
    return;
  }
  drawBooks(ctx, o.x, y, o.w, o.books);
}

function drawCloud(ctx, c) {
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(c.x, c.y, 12, 0, Math.PI * 2);
  ctx.arc(c.x + 14, c.y - 6, 15, 0, Math.PI * 2);
  ctx.arc(c.x + 30, c.y, 11, 0, Math.PI * 2);
  ctx.fill();
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
      y: GROUND - PLAYER.h,
      vy: 0,
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

    function reset() {
      g.state = "running";
      g.y = GROUND - PLAYER.h;
      g.vy = 0;
      g.speed = START_SPEED;
      g.score = 0;
      g.obstacles = [makeObstacle(W + 40)];
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
      if (g.y >= GROUND - PLAYER.h - 0.5) g.vy = JUMP;
    }

    function update(dt) {
      // Nubes y piso se mueven siempre (más lento si no estás jugando)
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

      g.vy += GRAVITY * dt;
      g.y = Math.min(GROUND - PLAYER.h, g.y + g.vy * dt);
      if (g.y === GROUND - PLAYER.h) g.vy = 0;

      for (const o of g.obstacles) o.x -= g.speed * dt;
      g.obstacles = g.obstacles.filter((o) => o.x + o.w > -10);
      const last = g.obstacles[g.obstacles.length - 1];
      if (!last || W - (last.x + last.w) > g.nextGap) {
        g.obstacles.push(makeObstacle(W + 10));
        g.nextGap = rand(1, 2.1) * g.speed * 0.7;
      }

      // Choque: cajas con un margen para que sea justo
      const pad = 5;
      const px1 = PLAYER.x + pad;
      const px2 = PLAYER.x + PLAYER.w - pad;
      const py2 = g.y + PLAYER.h - 2;
      for (const o of g.obstacles) {
        const oy = GROUND - o.h;
        if (px2 > o.x + 2 && px1 < o.x + o.w - 2 && py2 > oy + 3) {
          g.state = "over";
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

    function draw() {
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

      for (const o of g.obstacles) drawObstacle(ctx, o);

      // Jugador: la palabra "eva", inclinada según el salto
      const tilt = g.state === "running" ? Math.max(-0.25, Math.min(0.25, g.vy / 3200)) : 0;
      const bob =
        g.state === "running" && g.y === GROUND - PLAYER.h
          ? Math.sin(performance.now() / 60) * 1.2
          : 0;
      ctx.save();
      ctx.translate(PLAYER.x + PLAYER.w / 2, g.y + PLAYER.h / 2 + bob);
      ctx.rotate(tilt);
      if (logo.complete && logo.naturalWidth) {
        ctx.drawImage(
          logo,
          0,
          0,
          LOGO_CROP.w,
          LOGO_CROP.h,
          -PLAYER.w / 2,
          -PLAYER.h / 2,
          PLAYER.w,
          PLAYER.h,
        );
      } else {
        ctx.fillStyle = NAVY;
        ctx.font = "800 26px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("eva", 0, 0);
      }
      ctx.restore();

      // Puntaje
      ctx.textAlign = "right";
      ctx.textBaseline = "top";
      ctx.font = "700 16px ui-monospace, monospace";
      const blink = g.flash > 0 && Math.floor(g.flash * 10) % 2 === 0;
      ctx.fillStyle = blink ? CYAN : NAVY;
      ctx.fillText(String(Math.floor(g.score)).padStart(5, "0"), W - 16, 14);
      if (g.best) {
        ctx.fillStyle = "#4d6a8a";
        ctx.fillText(`MEJOR ${String(g.best).padStart(5, "0")}`, W - 90, 14);
      }

      ctx.textAlign = "center";
      if (g.state === "ready") {
        ctx.fillStyle = NAVY;
        ctx.font = "700 20px sans-serif";
        ctx.fillText("Tocá, clickeá o apretá espacio para arrancar", W / 2, 80);
      } else if (g.state === "over") {
        ctx.fillStyle = NAVY;
        ctx.font = "800 26px sans-serif";
        ctx.fillText("¡Uy, te chocaste!", W / 2, 66);
        ctx.font = "600 16px sans-serif";
        ctx.fillStyle = "#4d6a8a";
        ctx.fillText("Tocá o apretá espacio para volver a jugar", W / 2, 102);
      }
    }

    let raf = 0;
    let last = performance.now();
    function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      update(dt);
      draw();
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    function onKey(e) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.code === "Space" || e.key === "ArrowUp" || e.key === "w") {
        e.preventDefault();
        if (!e.repeat) jump();
      }
    }
    function onPointer(e) {
      e.preventDefault();
      jump();
    }

    window.addEventListener("keydown", onKey);
    canvas.addEventListener("pointerdown", onPointer);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
      canvas.removeEventListener("pointerdown", onPointer);
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
          Saltá con <kbd>espacio</kbd>, <kbd>↑</kbd> o tocando la pantalla.
          Cerrá con <kbd>Esc</kbd>.
        </p>
      </div>
    </div>
  );
}

export default EvaRunner;

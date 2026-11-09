import { useEffect, useRef } from "react";
import {
  BROWS,
  DOTS,
  EXPRESSIONS,
  EXPRESSION_KEYS,
  EYES,
  LETTERS,
  ORDER,
  PATHS,
  browPath,
  mouthGeo,
} from "./evaShape";

// Personaje animado de Eva. El SVG se arma una sola vez y después se mueve
// cuadro a cuadro tocando atributos, sin volver a renderizar React.
//
// state: "idle" | "listening" | "thinking" | "speaking"
// talking: mientras sea true, la boca y las letras se mueven como si hablara
// reduced: deja al personaje quieto (reducir movimiento)

const NS = "http://www.w3.org/2000/svg";
let uid = 0;

function el(tag, attrs, parent) {
  const node = document.createElementNS(NS, tag);
  for (const key in attrs) node.setAttribute(key, attrs[key]);
  if (parent) parent.appendChild(node);
  return node;
}

function buildRig(svg, withDots) {
  const id = "eva-rig-" + uid++;
  const defs = el("defs", {}, svg);
  el("path", { d: PATHS.EH }, el("clipPath", { id: id + "-e" }, defs));
  el("path", { d: PATHS.AH }, el("clipPath", { id: id + "-a" }, defs));
  const mouthClip = el("path", { d: "" }, el("clipPath", { id: id + "-m" }, defs));

  const body = el("g", {}, svg);
  const rig = {
    svg,
    body,
    letters: {},
    pupils: {},
    lids: {},
    brows: {},
    dots: [],
    mouthClip,
    state: "idle",
    talking: false,
    cur: { ...EXPRESSIONS.idle, gx: 0, gy: 0 },
    nextBlink: 1.2 + Math.random() * 2,
    blinkAt: -10,
    hopAt: -10,
    nextFlash: 4 + Math.random() * 4,
    flashAt: -10,
    amp: 0,
    h: { e: 0, v: 0, a: 0 },
    ht: { e: 0, v: 0, a: 0 },
    nextSyl: 0,
    wander: { gx: 0, gy: 0, next: 0 },
  };

  for (const key of ORDER) {
    const letter = LETTERS[key];
    const g = el("g", {}, body);
    el("path", { d: letter.d, fill: "currentColor", "fill-rule": letter.evenodd ? "evenodd" : "nonzero" }, g);
    rig.letters[key] = g;

    if (key === "v") {
      const mouth = el("g", { class: "eva-face" }, g);
      rig.mouth = el("path", { d: "", class: "eva-mouth" }, mouth);
      rig.tongue = el(
        "ellipse",
        { cx: 0, cy: 0, rx: 0, ry: 0, fill: "currentColor", opacity: 0.35, "clip-path": `url(#${id}-m)` },
        mouth,
      );
    }

    if (letter.eye) {
      const eye = EYES[letter.eye];
      const clipped = el("g", { "clip-path": `url(#${id}-${letter.eye})` }, g);
      const pupil = el("g", {}, clipped);
      el("circle", { cx: 0, cy: 0, r: eye.r, fill: "currentColor" }, pupil);
      el("circle", { cx: eye.r * 0.36, cy: -eye.r * 0.38, r: eye.r * 0.3, class: "eva-shine" }, pupil);
      const [x0, y0, x1, y1] = eye.hole;
      const h = y1 - y0 + 2;
      const lid = el("rect", { x: x0 - 1, y: y0 - h, width: x1 - x0 + 2, height: h, fill: "currentColor" }, clipped);
      rig.pupils[letter.eye] = pupil;
      rig.lids[letter.eye] = { node: lid, h };
      rig.brows[letter.eye] = el("path", { d: "", fill: "currentColor", class: "eva-face eva-brow" }, g);
    }
  }

  if (withDots) {
    const group = el("g", {}, svg);
    for (const [cx, cy, r] of DOTS) {
      rig.dots.push(el("circle", { cx, cy, r, fill: "currentColor", opacity: 0 }, group));
    }
  }
  return rig;
}

function kick(rig, amount) {
  rig.amp = Math.max(rig.amp, amount);
  for (const key of ORDER) rig.ht[key] = 0.35 + Math.random() * 0.65;
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (rate, dt) => 1 - Math.exp(-rate * dt);

function stepRig(rig, live, t, dt, pointer) {
  if (live.state !== rig.state) {
    if (live.state === "listening") rig.hopAt = t;
    rig.state = live.state;
  }
  rig.talking = live.talking;

  const target = EXPRESSIONS[rig.state] || EXPRESSIONS.idle;
  const rm = live.reduced;
  const c = rig.cur;
  const k = rm ? 1 : ease(7, dt);
  const kg = rm ? 1 : ease(11, dt);

  // Hacia dónde mira
  let gx = 0;
  let gy = 0;
  const follow = !rm && t - pointer.t < 2.5 && (rig.state === "idle" || rig.state === "listening");
  if (follow) {
    const box = rig.svg.getBoundingClientRect();
    gx = clamp((pointer.x - (box.left + box.width / 2)) / (box.width * 0.5 + 140), -1, 1);
    gy = clamp((pointer.y - (box.top + box.height * 0.45)) / (box.height * 0.8 + 140), -1, 1);
  } else if (rig.state === "idle") {
    if (t > rig.wander.next) {
      const spots = [[0, 0], [0, 0], [-0.6, 0.1], [0.6, 0.1], [0.3, 0.5], [-0.35, -0.4]];
      const [wx, wy] = rm ? [0, 0] : spots[Math.floor(Math.random() * spots.length)];
      rig.wander = { gx: wx, gy: wy, next: t + 1.6 + Math.random() * 2.6 };
    }
    gx = rig.wander.gx;
    gy = rig.wander.gy;
  } else if (rig.state === "listening") {
    gy = 0.15;
  } else if (rig.state === "thinking") {
    gx = rm ? 0.6 : 0.55 + 0.32 * Math.sin(t * 0.9);
    gy = -0.7;
  } else if (rig.state === "speaking") {
    gx = rm ? 0 : 0.18 * Math.sin(t * 0.8);
    gy = 0.05;
  }
  c.gx += (gx - c.gx) * kg;
  c.gy += (gy - c.gy) * kg;
  for (const key of EXPRESSION_KEYS) c[key] += (target[key] - c[key]) * k;

  // Parpadeo
  if (!rm && t > rig.nextBlink) {
    rig.blinkAt = t;
    rig.nextBlink = t + (Math.random() < 0.2 ? 0.3 : 2.2 + Math.random() * 3.6);
  }
  const bt = (t - rig.blinkAt) / 0.17;
  const blink = !rm && bt >= 0 && bt < 1 ? Math.sin(Math.PI * bt) : 0;
  const lid = Math.max(c.lid, blink);

  // Cuerpo: respira en reposo, se balancea pensando
  const breath = !rm && (rig.state === "idle" || rig.state === "listening") ? Math.sin(t * 1.7) * 0.014 : 0;
  const sway = !rm && rig.state === "thinking" ? Math.sin(t * 0.8) * 1.3 : 0;
  rig.body.setAttribute(
    "transform",
    `translate(0 ${c.lift.toFixed(2)}) translate(109 70.7) rotate(${(c.rot + sway).toFixed(2)}) ` +
      `scale(${c.scale.toFixed(4)} ${(c.scale * (1 + breath)).toFixed(4)}) translate(-109 -70.7)`,
  );

  // Voz: golpes de amplitud por sílaba
  if (rig.talking && !rm && t > rig.nextSyl) {
    kick(rig, 0.5 + Math.random() * 0.45);
    rig.nextSyl = t + 0.11 + Math.random() * 0.12 + (Math.random() < 0.08 ? 0.3 : 0);
  }
  rig.amp *= Math.exp(-dt * (rig.talking ? 3.2 : 6));
  ORDER.forEach((key, i) => {
    rig.h[key] += (rig.ht[key] * rig.amp - rig.h[key]) * ease(22, dt);
    const level = rm ? 0 : rig.h[key] * (0.7 + 0.3 * Math.sin(t * 15 + i * 2.1));
    const ht = (t - rig.hopAt - i * 0.07) / 0.34;
    const hop = !rm && ht > 0 && ht < 1 ? Math.sin(Math.PI * ht) : 0;
    const { ox, oy } = LETTERS[key];
    rig.letters[key].setAttribute(
      "transform",
      `translate(${ox} ${(oy - 2.4 * level - 7 * hop).toFixed(2)}) scale(1 ${(1 + 0.11 * level).toFixed(4)}) translate(${-ox} ${-oy})`,
    );
  });

  // Ojos
  for (const key of ["e", "a"]) {
    const eye = EYES[key];
    rig.pupils[key].setAttribute(
      "transform",
      `translate(${(eye.cx + c.gx * eye.mx).toFixed(2)} ${(eye.cy + c.gy * eye.my).toFixed(2)}) scale(${c.pupil.toFixed(3)})`,
    );
    rig.lids[key].node.setAttribute("transform", `translate(0 ${(lid * rig.lids[key].h).toFixed(2)})`);
  }

  // Cejas: suben de golpe cada tanto, acompañan la voz y bajan al parpadear
  if (!rm && rig.state === "idle" && t > rig.nextFlash) {
    rig.flashAt = t;
    rig.nextFlash = t + 6 + Math.random() * 7;
  }
  const ft = (t - rig.flashAt) / 0.6;
  const flash = !rm && ft >= 0 && ft < 1 ? Math.sin(Math.PI * ft) * 3 : 0;
  const talkBrow = rm ? 0 : rig.amp * 1.8;
  rig.brows.e.setAttribute("d", browPath(BROWS.e, c.bre + flash + talkBrow - blink * 1.5, c.bte));
  rig.brows.a.setAttribute("d", browPath(BROWS.a, c.bra + flash + talkBrow - blink * 1.5, c.bta));

  // Boca: se abre con la voz
  const flap = rm ? 0 : Math.min(1, rig.amp * (0.55 + 0.45 * Math.abs(Math.sin(t * 13))));
  const mouth = mouthGeo(c.mw + 2 * flap, Math.min(1, c.mo + 0.8 * flap), c.ms, c.mk, c.mx);
  rig.mouth.setAttribute("d", mouth.d);
  rig.mouthClip.setAttribute("d", mouth.d);
  rig.tongue.setAttribute("cx", mouth.cx);
  rig.tongue.setAttribute("cy", mouth.ty);
  rig.tongue.setAttribute("rx", mouth.rx);
  rig.tongue.setAttribute("ry", mouth.ry);

  // Tres puntos de "pensando"
  rig.dots.forEach((dot, i) => {
    const v = rm ? 1 : 0.25 + 0.75 * Math.max(0, Math.sin(t * 4 - i * 0.9));
    dot.setAttribute("opacity", (c.dots * v).toFixed(3));
  });
}

function EvaCharacter({ state = "idle", talking = false, reduced = false, face = true, dots = false, label, className = "" }) {
  const svgRef = useRef(null);
  const live = useRef({ state, talking, reduced });

  useEffect(() => {
    live.current = { state, talking, reduced };
  }, [state, talking, reduced]);

  useEffect(() => {
    const svg = svgRef.current;
    const rig = buildRig(svg, dots);
    const pointer = { x: 0, y: 0, t: -10 };
    const onMove = (e) => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pointer.t = performance.now() / 1000;
    };
    window.addEventListener("pointermove", onMove, { passive: true });

    let frame = 0;
    let last = performance.now() / 1000;
    const tick = (ms) => {
      const t = ms / 1000;
      const dt = Math.min(0.05, Math.max(0, t - last));
      last = t;
      stepRig(rig, live.current, t, dt, pointer);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
      svg.replaceChildren();
    };
  }, [dots]);

  const a11y = label ? { role: "img", "aria-label": label } : { "aria-hidden": "true" };
  return (
    <svg
      ref={svgRef}
      className={`eva-char ${face ? "" : "eva-no-face"} ${className}`}
      viewBox={dots ? "-20 -36 258 128" : "-6 -18 231 96"}
      focusable="false"
      {...a11y}
    />
  );
}

export default EvaCharacter;

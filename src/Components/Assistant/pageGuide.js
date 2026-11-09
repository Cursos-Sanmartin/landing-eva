// Lo que Eva necesita saber de la página que se está viendo:
// las tarjetas de trabajos, las temáticas del inicio y el visor de trabajos.
// Usa los mismos botones que tocaría una persona, así no duplica la lógica del sitio.

import { PROJECTS, THEMES } from "../../data/projects";
import { normalize } from "./commands";

const text = (node) => (node?.textContent || "").replace(/\s+/g, " ").trim();

// Temática de la página actual (/tematicas/robotica → "robotica")
export function currentThemeSlug() {
  const match = window.location.pathname.match(/^\/tematicas\/([^/]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

// ---------- Tarjetas de trabajos ----------

export function projectCards() {
  return Array.from(document.querySelectorAll("main article.project-card"));
}

export function cardName(card) {
  return text(card.querySelector("h3"));
}

export function findCardByName(name) {
  const wanted = normalize(name);
  return projectCards().find((card) => normalize(cardName(card)) === wanted) || null;
}

// Posición 1, 2, 3… o −1 para la última
export function pickByPosition(list, position) {
  if (position === -1) return list[list.length - 1] || null;
  return list[position - 1] || null;
}

function firstSentence(value) {
  const sentence = value.split(/(?<=[.!?])\s/)[0] || "";
  return sentence.length > 220 ? sentence.slice(0, 217).trimEnd() + "…" : sentence;
}

// «Pixel Quest», un videojuego… → lo que Eva cuenta de cada tarjeta
export function describeCard(card) {
  const name = cardName(card);
  const school = text(card.querySelector(".project-school"));
  const students = text(card.querySelector(".project-students"));
  const action = text(card.querySelector(".project-link"));
  let kind = "una página web";
  if (/video/i.test(action)) kind = "un video";
  else if (/trabajo/i.test(action)) kind = "un documento";
  else if (/grande/i.test(action)) kind = "un diseño";
  const by = school ? `de ${school}` : students.replace(/^hecho por estudiantes de /i, "de ");
  const about = firstSentence(text(card.querySelector(".project-desc")));
  return `«${name}», ${kind} ${by}. ${about}`.trim();
}

// ---------- Temáticas del inicio ----------

export function themeTiles() {
  return Array.from(document.querySelectorAll('#tematicas a[href^="/tematicas/"]')).map((node) => {
    const slug = decodeURIComponent(node.getAttribute("href").replace("/tematicas/", ""));
    const count = PROJECTS.filter((p) => p.theme === slug).length;
    return { node, slug, to: `/tematicas/${slug}`, name: THEMES[slug]?.name || text(node.querySelector("b")), count };
  });
}

export function describeTile(tile) {
  if (tile.count === 0) return `${tile.name}: todavía sin proyectos.`;
  return `${tile.name}: ${tile.count === 1 ? "un proyecto" : `${tile.count} proyectos`}.`;
}

// ---------- Abrir y cerrar un trabajo ----------

// Qué pasó al abrir un trabajo:
// "viewer": se abrió en el visor del sitio. "frame": es una página web que se puede mostrar adentro.
// "web": se abrió en otra pestaña. "blocked": el navegador no dejó abrir la pestaña (queda el foco en el botón).
export function openCard(card) {
  const zoom = card.querySelector("button.project-link");
  if (zoom) {
    zoom.click();
    return { result: "viewer" };
  }
  const link = card.querySelector("a.project-link");
  if (!link) return { result: "none" };
  const frame = frameUrl(link.href);
  if (frame) return { result: "frame", frame, href: link.href };
  return { result: openTab(link.href, link), href: link.href };
}

// Abre otra pestaña. Eva no puede abrir enlaces externos por su cuenta (el navegador lo bloquea
// si no lo pidió una persona tocando algo), así que deja el foco en el enlace: con Enter se abre.
export function openTab(href, link) {
  const tab = window.open(href, "_blank");
  if (tab) {
    try {
      tab.opener = null;
    } catch {
      // otra pestaña de otro sitio: no hace falta
    }
    return "web";
  }
  if (link) {
    link.focus({ preventScroll: false });
    link.classList.add("eva-focus-link");
    link.addEventListener("blur", () => link.classList.remove("eva-focus-link"), { once: true });
  }
  return "blocked";
}

// ---------- Páginas web de los trabajos, adentro del sitio ----------

// Sitios que no se dejan mostrar dentro de otra página
const NO_FRAME = /(^|\.)(google\.com|youtube\.com|youtu\.be|instagram\.com|facebook\.com|tiktok\.com|canva\.com|figma\.com|notion\.so|notion\.site)$/;

export function hostOf(href) {
  try {
    return new URL(href).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

// Dirección para mostrar la página adentro del sitio (así Eva sigue escuchando), o null si no se puede
export function frameUrl(href) {
  let url;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.replace(/^www\./, "");
  // Gamma tiene una dirección especial para mostrarse dentro de otras páginas
  if (host === "gamma.app") {
    const match = url.pathname.match(/^\/(?:docs|public)\/(?:.*-)?([a-z0-9]{10,})\/?$/i);
    return match ? `https://gamma.app/embed/${match[1]}` : null;
  }
  if (NO_FRAME.test(host)) return null;
  return url.href;
}

// ---------- La sección del programa ----------

// Lo que Eva cuenta del programa: el título, las unidades del curso y cada paso.
// Cada paso se lleva a la altura donde el sitio lo activa, así la tarjeta «Tu trabajo final» se va armando.
export function programBlocks() {
  const section = document.getElementById("programa");
  if (!section) return [];
  const blocks = [];
  const head = section.querySelector(".program-head");
  if (head) {
    const kicker = text(head.querySelector(".kicker"));
    const title = text(head.querySelector("h2"));
    const lead = text(head.querySelector(".section-lead"));
    const top = kicker && title ? `${kicker}: ${title}.` : title ? `${title}.` : "";
    blocks.push({ node: head, text: [top, lead].filter(Boolean).join(" ") });
  }
  const kit = section.querySelector(".kit");
  const label = text(kit?.querySelector(".kit-label"));
  if (kit && label) {
    blocks.push({
      node: kit,
      text: `${label}. Mientras te cuento cada una, mirá cómo se va armando tu trabajo final en la tarjeta.`,
    });
  }
  section.querySelectorAll(".steps .step").forEach((step) => {
    const small = text(step.querySelector("small"));
    const title = text(step.querySelector("h3"));
    const body = text(step.querySelector("p"));
    blocks.push({ node: step, band: true, text: `${small ? `${small}: ` : ""}${title}. ${body}`.trim() });
  });
  return blocks;
}

// Lo que Eva cuenta de otra sección del inicio (por ejemplo, el equipo): el título y cada tarjeta
export function sectionBlocks(id) {
  if (id === "programa") return programBlocks();
  const section = document.getElementById(id);
  if (!section) return [];
  const blocks = [];
  const head = section.querySelector("[class*='-head']");
  if (head) {
    const kicker = text(head.querySelector(".kicker"));
    const title = text(head.querySelector("h2"));
    const lead = text(head.querySelector("p"));
    const top = kicker && title ? `${kicker}: ${title}.` : title ? `${title}.` : "";
    blocks.push({ node: head, text: [top, lead].filter(Boolean).join(" ") });
  }
  section.querySelectorAll("li").forEach((li) => {
    const name = text(li.querySelector("strong, b, h3"));
    const detail = text(li.querySelector("small, p"));
    const line = name && detail ? `${name}, ${detail.charAt(0).toLowerCase()}${detail.slice(1)}.` : text(li).replace(/^\d+\s*/, "");
    if (line) blocks.push({ node: li, text: line });
  });
  return blocks;
}

// Lleva un paso a la franja de la pantalla donde el sitio lo activa
// (el medio en la compu; más abajo en pantallas chicas, porque arriba está la tarjeta)
export function scrollToBand(node, smooth) {
  const small = window.matchMedia("(max-width: 64rem)").matches;
  const band = small ? 0.74 : 0.5;
  const rect = node.getBoundingClientRect();
  const top = window.scrollY + rect.top + rect.height / 2 - window.innerHeight * band;
  window.scrollTo({ top: Math.max(0, top), behavior: smooth ? "smooth" : "auto" });
}

export function openViewer() {
  return document.querySelector("dialog.lightbox[open]");
}

export function closeOpenViewer() {
  const dialog = openViewer();
  if (!dialog) return false;
  // El botón del sitio también frena el video, si lo hay
  const close = dialog.querySelector(".lightbox-close");
  if (close) close.click();
  if (dialog.open) dialog.close();
  return true;
}

// "ok" | "edge" (primera o última) | "single" (una sola página) | "none" (no hay visor abierto)
export function turnViewerPage(dir) {
  const dialog = openViewer();
  if (!dialog) return { result: "none" };
  const buttons = dialog.querySelectorAll(".lightbox-bar button");
  if (buttons.length < 2) return { result: "single" };
  const button = dir > 0 ? buttons[1] : buttons[0];
  if (button.disabled) return { result: "edge" };
  button.click();
  return { result: "ok", dialog };
}

export function viewerPageLabel(dialog) {
  return text(dialog?.querySelector(".lightbox-bar span"));
}

// Espera a que aparezca algo en la página (por ejemplo, después de cambiar de temática)
export function waitFor(check, timeout = 2500) {
  return new Promise((resolve) => {
    const started = Date.now();
    const tick = () => {
      const value = check();
      if (value || Date.now() - started > timeout) resolve(value || null);
      else window.setTimeout(tick, 100);
    };
    tick();
  });
}

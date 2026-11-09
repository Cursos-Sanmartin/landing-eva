// Cuando Eva no entiende sola, le pregunta a la IA (Gemini) a través de /api/eva.
// La IA solo puede elegir una de las acciones de Eva o contestar sobre EVA; acá se controla
// que lo que devuelve exista de verdad (el trabajo, la temática) antes de hacerlo.

import { PROJECTS, THEMES } from "../../data/projects";
import { SITE_INFO } from "./siteInfo";

const SECTIONS = {
  programa: { to: "/#programa", label: "al programa" },
  tematicas: { to: "/#tematicas", label: "a las temáticas" },
  equipo: { to: "/#equipo", label: "al equipo" },
  inicio: { to: "/", label: "al inicio" },
};

const TOGGLES = { contrast: "contrast", font: "font", links: "links" };

// Lo que no cambia: lo que dice el sitio, las temáticas y los trabajos
export function siteFacts(about) {
  return {
    site: SITE_INFO,
    themes: Object.entries(THEMES).map(([slug, theme]) => ({
      slug,
      name: theme.name,
      about: theme.description || "",
      count: PROJECTS.filter((p) => p.theme === slug).length,
    })),
    projects: PROJECTS.map((p) => ({ name: p.name, theme: p.theme })),
    about,
  };
}

// Los trabajos de la página que se está viendo, con sus datos (para contestar sobre ellos)
export function projectDetails(names) {
  return names.map((name) => {
    const p = PROJECTS.find((item) => item.name === name);
    if (!p) return { name };
    return { name, students: p.students || "", school: p.school || "", about: (p.description || "").slice(0, 240) };
  });
}

const SECTION_IDS = ["programa", "tematicas", "equipo"];

let warned = false;

// Devuelve un pedido de Eva ({ type, ... }) o null si la IA no está o no entendió
export async function askAI(text, context) {
  let res;
  try {
    res = await fetch("/api/eva", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, context }),
      signal: AbortSignal.timeout(9000),
    });
  } catch {
    return null;
  }
  if (!res.ok) {
    if (!warned) {
      warned = true;
      const why = await res.json().catch(() => ({}));
      console.info("Eva: la IA no está disponible —", why.error || res.status);
    }
    return null;
  }
  const answer = await res.json().catch(() => null);
  return answer ? toIntent(answer) : null;
}

function toIntent(a) {
  const theme = a.theme && THEMES[a.theme] ? a.theme : null;
  switch (a.action) {
    case "open": {
      const project = a.project && PROJECTS.find((p) => p.name.toLowerCase() === a.project.toLowerCase());
      if (project) return { type: "open", project };
      // Nombró un trabajo que no existe: mejor decirlo que abrir otro
      if (a.project) return { type: "answer", text: "No encontré un trabajo con ese nombre. ¿Me lo decís de otra forma?" };
      if (Number.isInteger(a.index) && a.index !== 0) return { type: "open", index: a.index };
      return { type: "open", which: "this" };
    }
    case "tour":
      return { type: "tour", theme };
    case "program":
      return { type: "program" };
    case "section_tour":
      if (a.section === "programa") return { type: "program" };
      if (a.section === "tematicas") return { type: "tour", theme: null, home: true };
      return SECTION_IDS.includes(a.section) ? { type: "sectionTour", section: a.section } : null;
    case "go_theme":
      return theme ? { type: "go", to: `/tematicas/${theme}`, label: `a ${THEMES[theme].name}` } : null;
    case "go_section": {
      const section = SECTIONS[a.section];
      return section ? { type: "go", to: section.to, label: section.label } : null;
    }
    case "next":
      return { type: "page", dir: 1 };
    case "prev":
      return { type: "page", dir: -1 };
    case "resume":
      return { type: "resume" };
    case "stop":
      return { type: "stop" };
    case "close_work":
      return { type: "closeWork", plain: false };
    case "new_tab":
      return { type: "newTab" };
    case "read":
      return { type: "read", selection: false };
    case "bigger":
      return { type: "size", dir: 1 };
    case "smaller":
      return { type: "size", dir: -1 };
    case "contrast":
    case "font":
    case "links":
      return { type: "toggle", key: TOGGLES[a.action], value: typeof a.value === "boolean" ? a.value : null };
    case "animations":
      // «activá las animaciones» = sacar la pausa
      return { type: "toggle", key: "pause", value: typeof a.value === "boolean" ? !a.value : null };
    case "reset":
    case "help":
    case "themes":
    case "hello":
    case "thanks":
      return { type: a.action };
    case "bye":
      return { type: "close" };
    case "answer": {
      const reply = String(a.reply || "").trim().slice(0, 400);
      const section = SECTION_IDS.includes(a.section) ? a.section : null;
      return reply ? { type: "answer", text: reply, section } : null;
    }
    default:
      return null;
  }
}

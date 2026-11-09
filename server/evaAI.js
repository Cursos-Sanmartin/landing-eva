// Cuando Eva no entiende un pedido, le pregunta a Gemini (la IA de Google) qué quiso decir la persona.
// Esto corre en el servidor: en tu compu dentro de `npm run dev`, y más adelante en Vercel.
// La clave (GEMINI_API_KEY) nunca llega al navegador.
//
// Gemini solo puede elegir una de las acciones de Eva (abrir un trabajo, recorrer la página, etc.)
// o contestar una pregunta corta sobre EVA con la información del sitio. No puede hacer otra cosa.

const ACTIONS = [
  "open",
  "tour",
  "program",
  "go_theme",
  "go_section",
  "next",
  "prev",
  "resume",
  "stop",
  "close_work",
  "new_tab",
  "read",
  "bigger",
  "smaller",
  "contrast",
  "font",
  "links",
  "animations",
  "reset",
  "help",
  "themes",
  "hello",
  "bye",
  "thanks",
  "answer",
  "unknown",
];

// Modelos gratis, en orden. Si Google cambia el nombre de uno, se prueba el siguiente.
const MODELS = ["gemini-3.5-flash-lite", "gemini-flash-lite-latest", "gemini-3.1-flash-lite"];

const SCHEMA = {
  type: "OBJECT",
  properties: {
    action: { type: "STRING", enum: ACTIONS },
    project: { type: "STRING", nullable: true },
    theme: { type: "STRING", nullable: true },
    section: { type: "STRING", nullable: true },
    index: { type: "INTEGER", nullable: true },
    value: { type: "BOOLEAN", nullable: true },
    reply: { type: "STRING", nullable: true },
  },
  required: ["action"],
};

const RULES = `Sos el intérprete de Eva, la asistente de accesibilidad del sitio de EVA (Entornos Virtuales de Aprendizaje).
Recibís lo que una persona le dijo a Eva por voz o por escrito. Puede venir mal transcripto (palabras cambiadas o
cortadas) o con pedazos de lo que decía Eva mezclados. Decidí qué acción quiere y respondé solo con el JSON pedido.

Acciones:
- open: abrir un trabajo. project = el nombre EXACTO de la lista de trabajos; o index = posición en la página
  (1 = el primero, -1 = el último); o, si dice «este», «ese» o «el que estás contando», no pongas project ni index.
- tour: recorrer la página contando los proyectos. theme = el slug si nombra una temática.
- program: contar de qué se trata el programa EVA (sus 6 unidades).
- go_theme: ir a una temática. theme = el slug.
- go_section: ir a una sección del inicio. section = programa, tematicas, equipo o inicio.
- next / prev: el siguiente / el anterior (en un recorrido o en un trabajo abierto).
- resume: que siga con lo que estaba haciendo.
- stop: que pare o se calle.
- close_work: cerrar el trabajo o la página abierta.
- new_tab: abrir en otra pestaña la página web que está mostrando.
- read: leer la página en voz alta.
- bigger / smaller: agrandar / achicar el texto.
- contrast, font (letra más legible), links (resaltar enlaces), animations: value true = activar, false = desactivar,
  null = cambiar al otro estado.
- reset: volver todos los ajustes a como estaban.
- help: qué puede hacer Eva. themes: qué temáticas hay.
- hello: saluda. bye: se despide. thanks: agradece.
- answer: reply = lo que Eva contesta, corto (una o dos oraciones), cálido, en español rioplatense con voseo. Usalo para:
  · preguntas sobre EVA, sus temáticas o sus trabajos: respondé solo con la información de abajo, sin inventar nada;
  · charla corta («¿cómo estás?», «¿quién sos?», «qué linda voz»): respondé amable y ofrecé ayuda;
  · pedidos que no tienen que ver con EVA ni con este sitio (el clima, chistes, tareas, noticias, otras páginas,
    preguntas generales): decí con amabilidad que solo podés ayudar con el sitio y el programa EVA, y ofrecé
    algo concreto, por ejemplo: «Solo puedo ayudarte con el sitio de EVA y su programa. ¿Querés que te cuente
    de qué se trata o que te muestre los proyectos?».
- unknown: solo si no se entiende lo que dijo (palabras sueltas sin sentido).

Usá solo trabajos y temáticas de las listas. Si dudás entre dos acciones, elegí answer y preguntá qué quiso decir.`;

function describe(context = {}) {
  const lines = [];
  if (context.page) lines.push(`Página actual: ${context.page}.`);
  if (context.projectsHere?.length) lines.push(`Trabajos en esta página, en orden: ${context.projectsHere.join("; ")}.`);
  if (context.openWork) lines.push("Hay un trabajo o una página web abierta.");
  if (context.paused) lines.push("Eva estaba recorriendo o leyendo la página y frenó para escuchar.");
  if (context.themes?.length) {
    lines.push(
      "Temáticas (slug — nombre — cantidad de trabajos): " +
        context.themes.map((t) => `${t.slug} — ${t.name} — ${t.count}`).join("; ") +
        ".",
    );
  }
  if (context.projects?.length) {
    lines.push("Todos los trabajos (nombre — temática): " + context.projects.map((p) => `${p.name} — ${p.theme}`).join("; ") + ".");
  }
  if (context.about) lines.push(`Sobre EVA: ${context.about}`);
  if (context.units?.length) lines.push(`Unidades del programa: ${context.units.join("; ")}.`);
  return lines.join("\n");
}

// Devuelve { status, body } para que lo pueda usar cualquier servidor
export async function askGemini({ text, context } = {}, { apiKey, model } = {}) {
  if (!apiKey) return { status: 503, body: { error: "Falta la clave GEMINI_API_KEY" } };
  const said = String(text || "").slice(0, 300).trim();
  if (!said) return { status: 400, body: { error: "Sin texto" } };

  const payload = {
    systemInstruction: { parts: [{ text: `${RULES}\n\n${describe(context)}` }] },
    contents: [{ role: "user", parts: [{ text: said }] }],
    generationConfig: { temperature: 0, responseMimeType: "application/json", responseSchema: SCHEMA },
  };

  const models = [model, ...MODELS].filter((m, i, list) => m && list.indexOf(m) === i);
  for (const name of models) {
    let res;
    try {
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${name}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(8000),
      });
    } catch {
      return { status: 504, body: { error: "Gemini no respondió" } };
    }
    if (res.status === 404) continue; // ese modelo ya no existe: probamos el siguiente
    if (!res.ok) return { status: res.status === 429 ? 429 : 502, body: { error: `Gemini respondió ${res.status}` } };
    const data = await res.json().catch(() => null);
    const raw = (data?.candidates?.[0]?.content?.parts || []).map((part) => part.text || "").join("");
    try {
      const answer = JSON.parse(raw);
      if (!ACTIONS.includes(answer?.action)) throw new Error("acción desconocida");
      return { status: 200, body: answer };
    } catch {
      return { status: 502, body: { error: "Gemini respondió algo que no se entiende" } };
    }
  }
  return { status: 502, body: { error: "No encontré un modelo de Gemini disponible" } };
}

// Lee el cuerpo JSON de un pedido de Node
function readJson(req) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 100000) req.destroy();
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch {
        resolve({});
      }
    });
    req.on("error", () => resolve({}));
  });
}

// Plugin de Vite: atiende /api/eva mientras corre `npm run dev` (o `npm run preview`)
export function evaApi({ apiKey, model } = {}) {
  const handle = async (req, res, next) => {
    if (req.method !== "POST") {
      next();
      return;
    }
    const input = await readJson(req);
    const out = await askGemini(input, { apiKey, model });
    res.statusCode = out.status;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(out.body));
  };
  return {
    name: "eva-api",
    configureServer(server) {
      server.middlewares.use("/api/eva", handle);
    },
    configurePreviewServer(server) {
      server.middlewares.use("/api/eva", handle);
    },
  };
}

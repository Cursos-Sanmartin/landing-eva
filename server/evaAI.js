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
  "section_tour",
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
- open: abrir y mostrar UN trabajo de cualquier parte del sitio (Eva cambia de página sola). Siempre que puedas,
  project = el nombre EXACTO de la lista de todos los trabajos (aunque lo diga incompleto, mal pronunciado o mal
  transcripto, elegí el que corresponde). Si dice «este», «ese» o «el que estás contando», es el trabajo que Eva está
  contando ahora o el último que abrió. Si dice una posición, index (1 = el primero de la página, -1 = el último).
  Si pide «un trabajo», «alguno», «uno de…» o «uno sobre…» (de una temática, de un tema, de un tipo: video, página web,
  documento), elegí vos el que mejor coincida mirando de qué se trata cada uno, y abrilo. Si no queda claro cuál, answer
  preguntando cuál quiere.
  reply: cómo lo presenta Eva al abrirlo, en una o dos oraciones: nombre, escuela y de qué se trata, solo con los datos
  de la lista; si eligió entre varios por un tema, decí por qué es ese. Terminá ofreciendo ver otro.
- tour: recorrer contando TODOS los proyectos de una página o temática, uno por uno. theme = el slug si nombra una
  temática. Usalo solo si pide que le cuenten, recorran o naveguen todos los proyectos; si pide uno, es open.
- program: contar de qué se trata el programa EVA (sus 6 unidades). Usalo cuando pida que le cuenten o le expliquen el
  programa, EVA, «el proyecto» (sin nombrar un trabajo) o de qué se trata todo esto.
- section_tour: ir a una sección del inicio y contarla mostrándola. section = equipo, tematicas o programa.
  Usalo cuando pida que le cuenten, le muestren o le expliquen el equipo o las temáticas.
- go_theme: ir a una temática. theme = el slug. reply: qué hay ahí (cuántos proyectos y dos o tres nombres) y ofrecé
  mostrar alguno o contarlos. Si además pidió un trabajo sobre algo que en esa temática no hay, decilo en reply y ofrecé
  otros parecidos de ahí.
- go_section: ir a una sección del inicio. section = programa, tematicas, equipo o inicio. reply: opcional, corto.
- next / prev: el siguiente / el anterior (en un recorrido o en un trabajo abierto).
- resume: que siga con lo que estaba haciendo.
- stop: que pare o se calle.
- close_work: cerrar el trabajo o la página abierta.
- new_tab: abrir en otra pestaña la página web que está mostrando.
- read: leer la página en voz alta. Si pide ir a otro lado y leer ahí, theme (temática) o section: Eva va y lee.
- bigger / smaller: agrandar / achicar el texto.
- contrast, font (letra más legible), links (resaltar enlaces), animations: value true = activar, false = desactivar,
  null = cambiar al otro estado.
- reset: volver todos los ajustes a como estaban.
- help: qué puede hacer Eva. themes: qué temáticas hay.
- hello: saluda. bye: se despide. thanks: agradece.
- answer: reply = lo que Eva contesta, corto (una o dos oraciones), cálido, en español rioplatense con voseo. Usalo para:
  · preguntas puntuales sobre EVA, el sitio, el equipo, las temáticas o los trabajos: respondé solo con la información
    de abajo, sin inventar nada. Si la respuesta está en una sección del inicio, poné section (programa, tematicas o
    equipo) para que Eva la muestre mientras contesta;
  · charla corta («¿cómo estás?», «¿quién sos?», «qué linda voz»): respondé amable y ofrecé ayuda;
  · pedidos que no tienen que ver con EVA ni con este sitio (el clima, chistes, tareas, noticias, otras páginas,
    preguntas generales): decí con amabilidad que solo podés ayudar con el sitio y el programa EVA, y ofrecé
    algo concreto, por ejemplo: «Solo puedo ayudarte con el sitio de EVA y su programa. ¿Querés que te cuente
    de qué se trata o que te muestre los proyectos?».
- unknown: solo si no se entiende lo que dijo (palabras sueltas sin sentido).

Charla: abajo tenés lo último que se dijeron Eva y la persona. Usala para entender respuestas cortas o que se refieren
a algo anterior: «sí», «dale», «ok», «ese», «el que me dijiste», «no lo abriste». Si Eva acababa de ofrecer algo
(por ejemplo «¿Querés que lo abramos?») y la persona acepta, hacé esa acción con el nombre EXACTO del trabajo; si la persona
dice que algo no pasó («no lo abriste»), hacelo. Si rechaza, answer amable ofreciendo otra cosa.
Si pide que elijas o recomiendes un trabajo, podés abrirlo directamente (open) en vez de preguntar.

Guía por todo el sitio: tenés la lista de TODOS los trabajos de todas las temáticas, no solo los de la página actual.
Pedidos de varias cosas («andá a inteligencia artificial y mostrame uno de salud»): elegí la acción del final (lo que
quiere ver o hacer, no solo ir); open, read y tour ya llevan a la página que corresponde.

Usá solo trabajos y temáticas de las listas. Si dudás entre dos acciones, elegí answer y preguntá qué quiso decir.`;

function describe(context = {}) {
  const lines = [];
  if (context.page) lines.push(`Página actual: ${context.page}.`);
  if (context.site) lines.push(`Lo que dice el sitio:\n${context.site}`);
  if (context.projectsHere?.length) {
    const here = context.projectsHere.map((p) => (typeof p === "string" ? p : p.name));
    lines.push(`Trabajos en esta página, en orden (sus datos están en la lista de todo el sitio): ${here.join("; ")}.`);
  }
  if (context.openWork) lines.push("Hay un trabajo o una página web abierta.");
  if (context.paused) lines.push("Eva estaba recorriendo o leyendo la página y frenó para escuchar.");
  if (context.themes?.length) {
    lines.push(
      "Temáticas (slug — nombre — cantidad de trabajos): " +
        context.themes.map((t) => `${t.slug} — ${t.name} — ${t.count}${t.about ? ` — ${t.about}` : ""}`).join("; ") +
        ".",
    );
  }
  if (context.projects?.length) {
    const all = context.projects.map((p) =>
      [p.name, p.theme, p.students, p.school, p.kind, p.about].filter(Boolean).join(" — "),
    );
    lines.push(`Todos los trabajos del sitio (nombre — temática — estudiantes — escuela — tipo — de qué se trata):\n${all.join("\n")}`);
  }
  if (context.about) lines.push(`Sobre EVA: ${context.about}`);
  if (context.current) lines.push(`Trabajo que Eva está contando ahora en el recorrido («este»): ${context.current}.`);
  if (context.lastOpened) lines.push(`Último trabajo que abrió o contó Eva: ${context.lastOpened}.`);
  if (context.history?.length) {
    const talk = context.history
      .slice(-8)
      .map((m) => `${m.from === "user" ? "Persona" : "Eva"}: ${String(m.text || "").slice(0, 300)}`);
    lines.push(`Charla reciente (lo último está al final):\n${talk.join("\n")}`);
  }
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

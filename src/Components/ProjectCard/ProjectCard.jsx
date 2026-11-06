import { useRef, useState } from "react";
import BrowserMock from "../BrowserMock/BrowserMock";
import { THEMES } from "../../data/projects";
import "./ProjectCard.css";

const DEFAULT_THEME = { name: "Sin temática", color: "#00a9e9" };

function getHost(url) {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function ProjectCard({ project }) {
  const theme = THEMES[project.theme] ?? DEFAULT_THEME;
  // Sin url es un trabajo para ver acá mismo: un diseño (image) o varias páginas (pages)
  const pages = project.pages ?? (project.image ? [project.image] : []);
  const isDesign = !project.url && pages.length > 0;
  const isDoc = Boolean(project.pages);
  const isVideo = Boolean(project.video);
  const total = pages.length;

  const viewer = useRef(null);
  const player = useRef(null);
  const touchX = useRef(0);
  const [page, setPage] = useState(0);

  // Avanza o retrocede sin pasarse de la primera ni de la última página
  const go = (step) =>
    setPage((current) => Math.min(total - 1, Math.max(0, current + step)));

  const openViewer = () => {
    setPage(0);
    viewer.current.showModal();
  };

  // Cerrar el visor siempre frena el video, si lo hay
  const closeViewer = () => {
    player.current?.pause();
    viewer.current.close();
  };

  return (
    <article className="project-card" style={{ "--tc": theme.color }}>
      {project.example && <span className="tag-example">Ejemplo</span>}

      {isDesign ? (
        <div className={isVideo ? "design-thumb is-video" : "design-thumb"}>
          <img src={pages[0]} alt="" loading="lazy" />
          {isVideo && (
            <span className="play-badge" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
          )}
        </div>
      ) : (
        <BrowserMock
          name={project.name}
          url={getHost(project.url)}
          color={theme.color}
          art={project.theme === "ciencia-de-datos" ? "data" : undefined}
          image={project.image}
        />
      )}

      <div className="project-body">
        <span className="project-theme">{theme.name}</span>
        <h3>{project.name}</h3>
        {/* Si no hay nombres, mostramos solo la escuela */}
        {project.students ? (
          <>
            <span className="project-students">{project.students}</span>
            <span className="project-school">{project.school}</span>
          </>
        ) : (
          <span className="project-students">
            Hecho por estudiantes de {project.school}
          </span>
        )}
        <p className="project-desc">{project.description}</p>

        {isDesign ? (
          <button
            type="button"
            className="project-link is-zoom"
            onClick={openViewer}
            aria-label={`Ver ${project.name} en grande`}
          >
            {isVideo ? "Ver el video" : isDoc ? "Ver el trabajo" : "Ver en grande"}
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
            </svg>
          </button>
        ) : (
          <a
            className="project-link"
            href={project.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Visitar ${project.name} (se abre en otra pestaña)`}
          >
            Visitar la web
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </a>
        )}
      </div>

      {/* Visor: <dialog> ya trae el fondo oscuro y se cierra con Escape */}
      {isDesign && (
        <dialog
          ref={viewer}
          className={isDoc ? "lightbox is-doc" : "lightbox"}
          aria-label={project.name}
          // Escape también cierra: frenamos el video antes
          onCancel={() => player.current?.pause()}
          onClick={(e) => {
            // Click afuera de la imagen (en el fondo) cierra el visor
            if (e.target === e.currentTarget) closeViewer();
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") go(1);
            if (e.key === "ArrowLeft") go(-1);
          }}
          onTouchStart={(e) => {
            touchX.current = e.touches[0].clientX;
          }}
          onTouchEnd={(e) => {
            // Deslizar con el dedo: más de 50px hacia un lado cambia de página
            const dx = e.changedTouches[0].clientX - touchX.current;
            if (dx < -50) go(1);
            if (dx > 50) go(-1);
          }}
        >
          {isVideo ? (
            <video
              ref={player}
              src={project.video}
              poster={project.image}
              controls
              playsInline
              preload="none"
            />
          ) : (
            <img
              key={pages[page]}
              src={pages[page]}
              alt={
                total > 1
                  ? `${project.name}, página ${page + 1} de ${total}`
                  : `${project.name}, trabajo de estudiantes de ${project.school}`
              }
            />
          )}

          <button
            type="button"
            className="lightbox-close"
            onClick={closeViewer}
            aria-label="Cerrar"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>

          {/* Barra de abajo: flechas y número de página */}
          {total > 1 && (
            <div className="lightbox-bar">
              <button
                type="button"
                onClick={() => go(-1)}
                disabled={page === 0}
                aria-label="Página anterior"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M15 6l-6 6 6 6" />
                </svg>
              </button>
              <span aria-live="polite">
                Página {page + 1} de {total}
              </span>
              <button
                type="button"
                onClick={() => go(1)}
                disabled={page === total - 1}
                aria-label="Página siguiente"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </button>
            </div>
          )}
        </dialog>
      )}
    </article>
  );
}

export default ProjectCard;

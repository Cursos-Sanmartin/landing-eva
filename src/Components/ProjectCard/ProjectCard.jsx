import { useRef } from "react";
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
  // Sin url es un diseño (imagen): en vez de visitar la web, se abre en grande
  const isDesign = !project.url && project.image;
  const viewer = useRef(null);

  return (
    <article className="project-card" style={{ "--tc": theme.color }}>
      {project.example && <span className="tag-example">Ejemplo</span>}

      {isDesign ? (
        <div className="design-thumb">
          <img src={project.image} alt="" loading="lazy" />
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
            onClick={() => viewer.current.showModal()}
            aria-label={`Ver ${project.name} en grande`}
          >
            Ver en grande
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
          className="lightbox"
          aria-label={project.name}
          onClick={(e) => {
            // Click afuera de la imagen (en el fondo) cierra el visor
            if (e.target === e.currentTarget) e.currentTarget.close();
          }}
        >
          <img
            src={project.image}
            alt={`${project.name}, diseño de estudiantes de ${project.school}`}
          />
          <button
            type="button"
            className="lightbox-close"
            onClick={() => viewer.current.close()}
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
        </dialog>
      )}
    </article>
  );
}

export default ProjectCard;

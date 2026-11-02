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

  return (
    <article className="project-card" style={{ "--tc": theme.color }}>
      {project.example && <span className="tag-example">Ejemplo</span>}

      <BrowserMock
        name={project.name}
        url={getHost(project.url)}
        color={theme.color}
        art={project.theme === "ciencia-de-datos" ? "data" : undefined}
      />

      <div className="project-body">
        <span className="project-theme">{theme.name}</span>
        <h3>{project.name}</h3>
        <span className="project-students">{project.students}</span>
        <span className="project-school">{project.school}</span>
        <p className="project-desc">{project.description}</p>

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
      </div>
    </article>
  );
}

export default ProjectCard;
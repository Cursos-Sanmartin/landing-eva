import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { THEMES } from "../data/projects";
import { THEME_ICONS } from "../data/themeIcons";
import { getProjects } from "../data/getProjects";
import ProjectCard from "../Components/ProjectCard/ProjectCard";
import "../Components/Hero/Hero.css";
import "../Components/Projects/Projects.css";
import "./ThemePage.css";

function ThemePage() {
  const { slug } = useParams();
  const theme = THEMES[slug];
  const [projects, setProjects] = useState([]);

  // Al entrar a una temática, arrancamos desde arriba
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [slug]);

  useEffect(() => {
    let active = true;

    getProjects().then((data) => {
      if (active) setProjects(data);
    });

    return () => {
      active = false;
    };
  }, []);

  if (!theme) {
    return (
      <section className="theme-hero">
        <div className="wrap">
          <h1>No encontramos esa temática</h1>
          <Link to="/#tematicas" className="theme-back">
            Ver todas las temáticas
          </Link>
        </div>
      </section>
    );
  }

  // Solo los proyectos de esta temática, y cuántas escuelas distintas hay
  const list = projects.filter((p) => p.theme === slug);
  const schools = new Set(list.map((p) => p.school)).size;

  return (
    <>
      <section
        className="theme-hero"
        style={{
          "--tc": theme.color,
          "--from": theme.palette?.[0],
          "--to": theme.palette?.[1],
        }}
      >
        <div className="wrap theme-grid">
          <div>
            <nav className="crumbs" aria-label="Ubicación">
              <Link to="/#tematicas">Temáticas</Link>
              <span aria-hidden="true">/</span>
              <span>{theme.name}</span>
            </nav>
            <h1>{theme.name}</h1>
            <p className="theme-lead">{theme.description}</p>

            <div className="stats">
              <div>
                <b>{list.length}</b>
                <span>{list.length === 1 ? "proyecto" : "proyectos"}</span>
              </div>
              <div>
                <b>{schools}</b>
                <span>{schools === 1 ? "escuela" : "escuelas"}</span>
              </div>
            </div>
          </div>

          <div className="theme-badge" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {THEME_ICONS[slug]}
            </svg>
          </div>
        </div>

        <svg
          className="hero-wave"
          viewBox="0 0 1440 110"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path d="M0 110V60C240 10 480 0 720 30s480 70 720 10v70z" fill="#fff" />
        </svg>
      </section>

      <section>
        <div className="wrap">
          <span className="kicker">Proyectos</span>
          <h2>Lo que crearon los chicos</h2>

          {list.length > 0 ? (
            <div className="projects-grid">
              {list.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          ) : (
            <div className="theme-empty">
              <b>Todavía no hay proyectos publicados</b>
              Muy pronto vas a ver acá las webs de esta temática.
            </div>
          )}
        </div>
      </section>
    </>
  );
}

export default ThemePage;
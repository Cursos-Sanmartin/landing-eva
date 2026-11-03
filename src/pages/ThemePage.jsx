import { useEffect } from "react";
import { Link, useParams } from "react-router";
import { THEMES } from "../data/projects";
import "./ThemePage.css";

function ThemePage() {
  const { slug } = useParams();
  const theme = THEMES[slug];

  // Al entrar a una temática, arrancamos desde arriba
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [slug]);

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

  return (
    <section className="theme-hero" style={{ "--tc": theme.color }}>
      <div className="wrap">
        <Link to="/#tematicas" className="theme-back">
          ← Temáticas
        </Link>
        <h1>{theme.name}</h1>
        <p>{theme.description}</p>
      </div>
    </section>
  );
}

export default ThemePage;
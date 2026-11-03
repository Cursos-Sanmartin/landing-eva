import { Link } from "react-router";
import { useEffect, useState } from "react";
import { THEMES } from "../../data/projects";
import { THEME_ICONS } from "../../data/themeIcons";
import { getProjects } from "../../data/getProjects";
import "./Themes.css";

function countLabel(n) {
  if (n === 0) return "Próximamente";
  return n === 1 ? "1 proyecto" : `${n} proyectos`;
}

function Themes() {
  const [projects, setProjects] = useState([]);

  useEffect(() => {
    let active = true;

    getProjects().then((data) => {
      if (active) setProjects(data);
    });

    return () => {
      active = false;
    };
  }, []);

  return (
    <section id="tematicas" className="themes">
      <div className="wrap">
        <div className="themes-head">
          <div>
            <span className="kicker">Temáticas</span>
            <h2>Diez caminos para crear</h2>
          </div>
          <p className="section-lead">
            Elegí una temática para ver todos los proyectos que hicieron los chicos.
          </p>
        </div>

        <div className="tiles">
          {Object.entries(THEMES).map(([slug, theme]) => {
            const count = projects.filter((p) => p.theme === slug).length;

            return (
              <Link
                key={slug}
                className="tile"
                to={`/tematicas/${slug}`}
                style={{ "--tc": theme.color }}
              >
                <span className="tile-icon">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    {THEME_ICONS[slug]}
                  </svg>
                </span>
                <b>{theme.name}</b>
                <span className="tile-count">{countLabel(count)}</span>
                <svg
                  className="tile-go"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default Themes;
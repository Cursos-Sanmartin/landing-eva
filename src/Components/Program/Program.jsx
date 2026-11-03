import "../BrowserMock/BrowserMock.css";
import "./Program.css";
import { useEffect, useRef, useState } from "react";
import "../BrowserMock/BrowserMock.css";
import "./Program.css";

const UNITS = [
  {
    title: "Primeros pasos",
    text: "Conocés las bases del curso y arrancás tu actividad.",
  },
  {
    title: "Sumás herramientas",
    text: "Nuevos conceptos que aplicás sobre lo que ya hiciste.",
  },
  {
    title: "Toma forma",
    text: "La actividad crece y empieza a parecerse a un proyecto.",
  },
  {
    title: "Profundizás",
    text: "Conceptos más avanzados para darle identidad propia.",
  },
  {
    title: "Ajustás detalles",
    text: "Revisás, mejorás y preparás todo para el cierre.",
  },
  {
    title: "Integrás todo",
    text: "Reunís lo aprendido en las seis unidades en tu trabajo final.",
  },
];

function Program() {
  const [step, setStep] = useState(0);
  const stepsRef = useRef(null);

  useEffect(() => {
    const items = stepsRef.current.querySelectorAll(".step");

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setStep(Number(entry.target.dataset.step));
          }
        });
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );

    items.forEach((item) => observer.observe(item));

    return () => observer.disconnect();
  }, []);
  const done = Math.min(step, UNITS.length);
  const percent = Math.round((done / UNITS.length) * 100);

  return (
    <section id="programa" className="program">
      <div className="wrap">
        <div className="program-head">
          <div>
            <span className="kicker">El programa</span>
            <h2>Un recorrido en 6 unidades</h2>
          </div>
          <p className="section-lead">
            Cada curso es distinto, pero todos siguen la misma lógica: en cada
            unidad se trabajan nuevos conceptos que se suman a una actividad que
            crece, hasta completar el trabajo final.
          </p>
        </div>

        <div className="scrolly">
          {/* Columna izquierda: la card que se queda quieta */}
          <div className="builder-wrap">
            <div className={`builder ${step > UNITS.length ? "final" : ""}`}>
              <div className="builder-top">
                <div>
                  <small>Actividad progresiva</small>
                  <b>Tu trabajo final</b>
                </div>

                <div className="ring" aria-hidden="true">
                  <svg viewBox="0 0 44 44">
                    <circle cx="22" cy="22" r="19" />
                    <circle
                      className="ring-fg"
                      cx="22"
                      cy="22"
                      r="19"
                      pathLength="100"
                      strokeDasharray="100"
                      strokeDashoffset={100 - percent}
                    />
                  </svg>
                  <span>{percent}%</span>
                </div>
              </div>

              <div className="browser builder-window" aria-hidden="true">
                <div className="browser-bar">
                  <i></i>
                  <i></i>
                  <i></i>
                  <span>mi-trabajo-final.com</span>
                </div>
                                <div className={`builder-canvas ${step >= UNITS.length ? "done" : ""}`}>
                  <div className={`builder-empty ${step > 0 ? "hidden" : ""}`}>
                    Empezá por la Unidad 1
                  </div>
                                    {/* Capa 1: el boceto (se va cuando el trabajo está terminado) */}
                  <div className={`layer ${step >= 1 && step < UNITS.length ? "show" : ""}`}>
                    <i className="sketch sketch-nav"></i>
                    <i className="sketch sketch-hero"></i>
                    <i className="sketch sketch-card card-1"></i>
                    <i className="sketch sketch-card card-2"></i>
                    <i className="sketch sketch-card card-3"></i>
                  </div>

                  {/* Capa 2: la navegación */}
                  <div className={`layer ${step >= 2 ? "show" : ""}`}>
                    <i className="nav-bar">
                      <b></b>
                      <u></u>
                      <u></u>
                      <u></u>
                    </i>
                  </div>
                  
                  {/* Capa 3: título e imagen principal */}
                  <div className={`layer ${step >= 3 ? "show" : ""}`}>
                    <i className="hero-title"></i>
                    <i className="hero-title short"></i>
                    <i className="hero-text"></i>
                    <i className="hero-image"></i>
                  </div>

                  {/* Capa 4: las tres tarjetas */}
                  <div className={`layer ${step >= 4 ? "show" : ""}`}>
                    <i className="mini-card card-1"></i>
                    <i className="mini-card card-2"></i>
                    <i className="mini-card card-3"></i>
                  </div>

                  {/* Capa 5: detalles */}
                  <div className={`layer ${step >= 5 ? "show" : ""}`}>
                    <i className="hero-button"></i>
                    <span className="chart">
                      <i></i>
                      <i></i>
                      <i></i>
                      <i></i>
                    </span>
                    <i className="star star-1"></i>
                    <i className="star star-2"></i>
                  </div>

                  {/* Capa 6: el sello de publicado */}
                  <div className={`layer ${step >= 6 ? "show" : ""}`}>
                    <span className="published">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="m5 12.5 4.5 4.5L19 7.5" />
                      </svg>
                      Publicado
                    </span>
                  </div>
                </div>
              </div>

              <div className="builder-chips">
                {UNITS.map((unit, i) => (
                  <span
                    key={unit.title}
                    className={`chip-unit ${i + 1 <= step ? "on" : ""}`}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="m5 12.5 4.5 4.5L19 7.5" />
                    </svg>
                    Unidad {i + 1}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Columna derecha: las unidades que se scrollean */}
          <ol
            className="steps"
            ref={stepsRef}
            aria-label="Recorrido del programa"
          >
            {UNITS.map((unit, i) => (
              <li
                key={unit.title}
                data-step={i + 1}
                className={`step ${step === i + 1 ? "active" : ""}`}
              >
                <span className="step-num">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <small>Unidad {i + 1}</small>
                <h3>{unit.title}</h3>
                <p>{unit.text}</p>
              </li>
            ))}

            <li
              data-step={UNITS.length + 1}
              className={`step final ${step > UNITS.length ? "active" : ""}`}
            >
              <span className="step-num">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M5 21V4M5 4h11l-2 4 2 4H5" />
                </svg>
              </span>
              <small>Cierre</small>
              <h3>Presentación final</h3>
              <p>
                Cada estudiante presenta su trabajo terminado y lo comparte con
                toda la Comunidad EVA.
              </p>
            </li>
          </ol>
        </div>
      </div>
    </section>
  );
}

export default Program;

import "../BrowserMock/BrowserMock.css";
import "./Program.css";

const UNITS = [
  { title: "Primeros pasos", text: "Conocés las bases del curso y arrancás tu actividad." },
  { title: "Sumás herramientas", text: "Nuevos conceptos que aplicás sobre lo que ya hiciste." },
  { title: "Toma forma", text: "La actividad crece y empieza a parecerse a un proyecto." },
  { title: "Profundizás", text: "Conceptos más avanzados para darle identidad propia." },
  { title: "Ajustás detalles", text: "Revisás, mejorás y preparás todo para el cierre." },
  { title: "Integrás todo", text: "Reunís lo aprendido en las seis unidades en tu trabajo final." },
];

function Program() {
  // Día 4: este número lo va a cambiar el scroll
  const step = 0;
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
            <div className="builder">
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
                <div className="builder-canvas">
                  <div className="builder-empty">Empezá por la Unidad 1</div>
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
          <ol className="steps" aria-label="Recorrido del programa">
            {UNITS.map((unit, i) => (
              <li
                key={unit.title}
                className={`step ${step === i + 1 ? "active" : ""}`}
              >
                <span className="step-num">{String(i + 1).padStart(2, "0")}</span>
                <small>Unidad {i + 1}</small>
                <h3>{unit.title}</h3>
                <p>{unit.text}</p>
              </li>
            ))}

            <li className={`step final ${step > UNITS.length ? "active" : ""}`}>
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
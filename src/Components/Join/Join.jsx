import "./Join.css";

const STEPS = [
  "Estate atento a la convocatoria",
  "Anotate entre febrero y marzo",
  "Arrancás tu proyecto en 2027",
];

function Join() {
  return (
    <section id="inscripcion" className="join">
      <div className="wrap join-grid">
        <div>
          <span className="kicker join-kicker">Edición 2027</span>
          <h2>
            ¿Querés ser parte de <em>EVA 2027</em>?
          </h2>
          <p className="join-lead">
            Si te gustó lo que viste y querés crear tu propio proyecto, prepará
            las ganas: la convocatoria para la próxima edición abre entre
            febrero y marzo de 2027.
          </p>

          <ol className="join-steps">
            {STEPS.map((text, i) => (
              <li key={text} className="join-step">
                <b>{i + 1}</b>
                {text}
              </li>
            ))}
          </ol>
        </div>

        {/* Tarjeta con la fecha de la convocatoria */}
        <div className="join-card">
          <span className="join-icon" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="4.5" width="18" height="16" rx="3" />
              <path d="M3 9.5h18M8 2.5v4M16 2.5v4" />
            </svg>
          </span>
          <small>Convocatoria 2027</small>
          <strong>Febrero – Marzo</strong>
          <p>
            Consultá en tu escuela: ahí te van a contar cómo anotarte cuando
            abra la inscripción. ¡Te esperamos!
          </p>
        </div>
      </div>
    </section>
  );
}

export default Join;
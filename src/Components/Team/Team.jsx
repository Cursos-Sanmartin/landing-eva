import "./Team.css";

// Las 7 personas del equipo: nombre, cargo y foto.
// photo: ruta de la foto dentro de public (ej. "/equipo/ana.webp").
// Si queda vacío (""), la carta muestra la silueta de una persona.
const TEAM = [
  { name: "Fran", role: "Coordinador general", photo: "/equipo/fran.webp" },
  { name: "Marti", role: "Referente territorial", photo: "/equipo/marti.webp" },
  { name: "Abru", role: "Coordinadora pedagógica", photo: "/equipo/abru.webp" },
  { name: "Feli", role: "Tutor", photo: "" },
  { name: "Eri", role: "Tutora", photo: "" },
  { name: "Lean", role: "Tutor", photo: "/equipo/lean.webp" },
  { name: "Yaz", role: "Tutora", photo: "" },
];

const MIDDLE = (TEAM.length - 1) / 2;

function Team() {
  return (
    <section id="equipo" className="team">
      <div className="wrap team-inner">
        <div className="team-head">
          <span className="kicker team-kicker">Quiénes te acompañan</span>
          <h2>
            Detrás de cada proyecto, <em>hay un equipo</em>
          </h2>
        </div>

        {/* Las cartas abiertas en abanico, como un mazo en la mano */}
        <ul className="fan">
          {TEAM.map((person, i) => {
            const offset = i - MIDDLE; // -3 … 0 … 3
            return (
              <li
                key={i}
                className="fan-card"
                tabIndex={0}
                style={{
                  "--rot": `${offset * 7}deg`,
                  "--drop": `${Math.abs(offset) ** 1.6 * 0.6}rem`,
                  "--z": 10 - Math.abs(offset),
                }}
              >
                <div className="fan-photo">
                  {person.photo ? (
                    <img
                      src={person.photo}
                      alt={person.name}
                      loading="lazy"
                    />
                  ) : (
                    // Sin foto: la silueta de una persona
                    <svg viewBox="0 0 100 125" aria-hidden="true">
                      <circle cx="50" cy="52" r="20" />
                      <path d="M10 125c0-28 18-46 40-46s40 18 40 46z" />
                    </svg>
                  )}
                  <span className="fan-num" aria-hidden="true">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>

                <div className="fan-info">
                  <strong>{person.name}</strong>
                  <small>{person.role}</small>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

export default Team;

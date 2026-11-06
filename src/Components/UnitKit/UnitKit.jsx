import "./UnitKit.css";

const KIT = [
  {
    name: "Video",
    text: "Encontrarás disponible una clase virtual teórica.",
    icon: (
      <>
        <rect x="2.5" y="5" width="19" height="14" rx="3" />
        <path d="m10 9 5 3-5 3z" />
      </>
    ),
  },
  {
    name: "Material",
    text: "Tendrás presentaciones, lecturas, ejemplos y recursos distintos para apoyarte en el estudio.",
    icon: (
      <path d="M4 19.5V5a2 2 0 0 1 2-2h13v15H6a2 2 0 0 0-2 2zm0 0a2 2 0 0 0 2 2h13M9 7h6M9 10.5h6" />
    ),
  },
  {
    name: "Actividades y entregas",
    text: "En cada unidad, realizarás una actividad. Tu proyecto se construye paso a paso.",
    icon: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="4" />
        <path d="m8.5 12 2.5 2.5 4.5-5" />
      </>
    ),
  },
  {
    name: "Entrega final",
    text: "Con la entrega final, das por finalizado tu proyecto.",
    highlight: true,
    icon: <path d="M5 21V4M5 4h11l-2 4 2 4H5" />,
  },
];

function UnitKit() {
  return (
    <div className="kit">
      <span className="kit-label">Cada curso cuenta con 6 unidades</span>

      <ul className="kit-items">
        {KIT.map((item) => (
          <li
            key={item.name}
            className={`kit-item ${item.highlight ? "highlight" : ""}`}
          >
            <span className="kit-icon">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                {item.icon}
              </svg>
            </span>
            <b>{item.name}</b>
            <small>{item.text}</small>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default UnitKit;
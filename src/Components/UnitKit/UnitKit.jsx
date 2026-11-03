import "./UnitKit.css";

const KIT = [
  {
    name: "Video",
    text: "Una clase grabada para ver a tu ritmo.",
    icon: (
      <>
        <rect x="2.5" y="5" width="19" height="14" rx="3" />
        <path d="m10 9 5 3-5 3z" />
      </>
    ),
  },
  {
    name: "Presentación",
    text: "Las diapositivas (PPT) con los conceptos clave.",
    icon: (
      <>
        <rect x="3" y="3.5" width="18" height="12" rx="2" />
        <path d="M12 15.5V20M8 20.5h8M7 11.5l3-3 2 2 4-4" />
      </>
    ),
  },
  {
    name: "Material adicional",
    text: "Lecturas, ejemplos y recursos para profundizar.",
    icon: (
      <path d="M4 19.5V5a2 2 0 0 1 2-2h13v15H6a2 2 0 0 0-2 2zm0 0a2 2 0 0 0 2 2h13M9 7h6M9 10.5h6" />
    ),
  },
  {
    name: "Actividad progresiva",
    text: "Un paso más de tu proyecto, que se suma al anterior.",
    highlight: true,
    icon: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="4" />
        <path d="m8.5 12 2.5 2.5 4.5-5" />
      </>
    ),
  },
];

function UnitKit() {
  return (
    <div className="kit">
      <span className="kit-label">Cada unidad incluye</span>

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
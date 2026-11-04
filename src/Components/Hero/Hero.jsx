import BrowserMock from "../BrowserMock/BrowserMock";
import "./Hero.css";

// Tres proyectos reales con su captura (las imágenes están en public/proyectos)
const MOCKS = [
  { name: "Yvy Ecología", url: "yvy-ecologia.netlify.app", color: "#4471d7", image: "/proyectos/21.jpg" },
  { name: "Desconecta para Conectar", url: "desconectapara.netlify.app", color: "#4471d7", image: "/proyectos/24.jpg" },
  { name: "Decidí Informado/a", url: "decidi-informado.netlify.app", color: "#4471d7", image: "/proyectos/13.jpg" },
];

function Hero() {
  return (
    <section className="hero">
      <div className="wrap hero-grid">
        <img
          className="badge-ca"
          src="/comunidad-activa-blanco.png"
          alt="Comunidad Activa"
        />

        <div className="hero-text">
          <span className="eyebrow">
            <i aria-hidden="true"></i>
            Comunidad EVA · Vitrina de proyectos
          </span>

          <h1>
            Descubrí lo que <em>crearon</em> en EVA
          </h1>

          <p className="lead">
            Estudiantes de las escuelas de San Martín diseñaron y publicaron sus
            propias webs. Este es el lugar para recorrerlas, compartirlas y
            celebrarlas.
          </p>

          <div className="cta">
            <a className="btn btn-primary" href="#programa">
              Conocé el programa
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M12 5v14M5 12l7 7 7-7" />
              </svg>
            </a>
            <a className="btn btn-ghost" href="#tematicas">
              Ver temáticas
            </a>
          </div>

          <div className="stats">
            <div>
              <b>12</b>
              <span>proyectos</span>
            </div>
            <div>
              <b>10</b>
              <span>temáticas</span>
            </div>
            <div>
              <b>6</b>
              <span>unidades</span>
            </div>
          </div>
        </div>

        <div className="hero-art" aria-hidden="true">
          {MOCKS.map((mock) => (
            <BrowserMock key={mock.name} {...mock} />
          ))}
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
  );
}

export default Hero;

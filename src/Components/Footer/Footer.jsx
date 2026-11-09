import "./Footer.css";
import { AccessibilityLink } from "../Assistant/AssistantEntry";

function Footer() {
  return (
    <footer className="footer">
      <div className="wrap">
        <div className="footer-row">
          <img
            className="footer-eva"
            src="/eva-logo-blanco.png"
            alt="EVA · Entornos Virtuales de Aprendizaje"
          />
          <img
            className="footer-inst"
            src="/logos-institucionales-blanco.png"
            alt="San Martín · OEI · Gobierno de la Provincia de Buenos Aires · Secretaría de Extensión y Vinculación UNSAM"
          />
        </div>

        <hr />

        <div className="footer-row">
          <span>Comunidad EVA · Entornos Virtuales de Aprendizaje</span>
          <AccessibilityLink />
          <span>Proyectos realizados por estudiantes del programa EVA</span>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
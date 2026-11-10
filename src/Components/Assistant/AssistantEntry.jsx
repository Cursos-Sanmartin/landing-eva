import { useId } from "react";
import { requestOpen, toggleWakeByUser, useWakeEnabled, useWakeLive } from "./assistantStore";
import { WAKE_PHRASE } from "./commands";
import { TAP_TO_TALK } from "./speech";
import "./Assistant.css";

// Puertas de entrada al asistente, que no se ve hasta que lo llaman.

// Interruptor del header: activa la escucha de «Eva, ¿estás ahí?»
export function VoiceSwitch({ className = "" }) {
  const enabled = useWakeEnabled();
  const live = useWakeLive();
  const hintId = useId();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label="Eva por voz"
      aria-describedby={hintId}
      className={`eva-voice-switch${live ? " is-live" : ""}${className ? ` ${className}` : ""}`}
      title={
        TAP_TO_TALK
          ? "Eva por voz: tocá para hablar con la asistente"
          : `Eva por voz: decí «${WAKE_PHRASE}» para llamar a la asistente`
      }
      onClick={() => toggleWakeByUser(!enabled)}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
        <rect x="9" y="3" width="6" height="11" rx="3" />
        <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
      </svg>
      <span className="eva-voice-track" aria-hidden="true">
        <span />
      </span>
      <span id={hintId} className="eva-sr">
        {TAP_TO_TALK
          ? enabled
            ? "Activado. Para hablarle, tocá el micrófono o a Eva."
            : "Al activarlo, aparece la asistente y te escucha."
          : enabled
            ? `Activado. Decí «${WAKE_PHRASE}» para llamar a la asistente.`
            : `Al activarlo, la asistente aparece cuando decís «${WAKE_PHRASE}».`}
      </span>
    </button>
  );
}

// Enlace del pie de página
export function AccessibilityLink() {
  return (
    <button type="button" className="eva-a11y-link" onClick={requestOpen}>
      Accesibilidad
    </button>
  );
}

// Primer elemento al navegar con teclado: solo se ve cuando recibe el foco
export function AssistantSkipLink() {
  return (
    <button type="button" className="eva-skip" onClick={requestOpen}>
      Abrir asistente de accesibilidad (Alt + A)
    </button>
  );
}

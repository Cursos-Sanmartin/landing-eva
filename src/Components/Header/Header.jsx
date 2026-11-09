import { Link, useLocation } from 'react-router';
import {useState, useEffect} from 'react';
import './Header.css';
import { AssistantSkipLink, VoiceSwitch } from '../Assistant/AssistantEntry';

function Header() {
  const [scrolled, setScrolled] = useState(false);
  // Menú hamburguesa en pantallas angostas
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname, hash } = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 40);
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
        window.removeEventListener('scroll', handleScroll);}
  },[]);

  // Al cambiar de página o de sección, el menú se cierra
  const place = pathname + hash;
  const [lastPlace, setLastPlace] = useState(place);
  if (lastPlace !== place) {
    setLastPlace(place);
    setMenuOpen(false);
  }

  // Con el menú abierto: Escape lo cierra, y si la pantalla se agranda también
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    const wide = window.matchMedia('(min-width: 48.01rem)');
    const onWide = () => {
      if (wide.matches) setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    wide.addEventListener('change', onWide);
    return () => {
      window.removeEventListener('keydown', onKey);
      wide.removeEventListener('change', onWide);
    };
  }, [menuOpen]);

  const close = () => setMenuOpen(false);

  return(
    <header className={`header ${scrolled || menuOpen ? 'scrolled' : ''} ${menuOpen ? 'menu-open' : ''}`}>
      <AssistantSkipLink />
      <div className="wrap">
                <Link to="/" className="logo">
          <img src="/eva-logo-blanco.png" alt="EVA" className="logo-light" />
          <img src="/eva-logo.png" alt="EVA" className="logo-dark" />
        </Link>
        <div className="header-actions">
          <nav id="site-nav" className="nav" aria-label="Principal">
            <Link to="/#programa" onClick={close}>El programa</Link>
            <Link to="/#tematicas" onClick={close}>Temáticas</Link>
            <VoiceSwitch className="voice-in-nav" />
            <Link to="/#equipo" className="pill" onClick={close}>Nuestro equipo</Link>
          </nav>
          {/* En pantallas angostas el interruptor queda a la vista, al lado del menú */}
          <VoiceSwitch className="voice-in-bar" />
          <button
            type="button"
            className="menu-toggle"
            aria-expanded={menuOpen}
            aria-controls="site-nav"
            aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span aria-hidden="true" />
            <span aria-hidden="true" />
            <span aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>
  )
}

export default Header;

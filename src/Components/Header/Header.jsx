import { Link } from 'react-router';
import {useState, useEffect} from 'react';
import './Header.css';

function Header() {
  const [scrolled, setScrolled] = useState(false);
 
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 40);
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
        window.removeEventListener('scroll', handleScroll);}
  },[]);

  return(
    <header className={`header ${scrolled ? 'scrolled' : ''}`}>
      <div className="wrap">
                <Link to="/" className="logo">
          <img src="/eva-logo-blanco.png" alt="EVA" className="logo-light" />
          <img src="/eva-logo.png" alt="EVA" className="logo-dark" />
        </Link>
        <nav className="nav">
          <Link to="/#programa">El programa</Link>
          <Link to="/#tematicas">Temáticas</Link>
          <Link to="/#inscripcion" className="pill">Quiero ser parte</Link>
        </nav>
      </div>
    </header>
  )
}

export default Header;
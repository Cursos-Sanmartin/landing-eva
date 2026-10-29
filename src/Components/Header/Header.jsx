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
        <a href="#" className="logo">
          <img src="eva-logo-blanco.png" alt="EVA" className="logo-light" />
          <img src="eva-logo.png" alt="EVA" className="logo-dark" />
        </a>
        <nav className="nav">
          <a href="#proyecto">El proyecto</a>
          <a href="#programa">El programa</a>
          <a href="#tematicas">Temáticas</a>
          <a href="#inscripcion" className="pill">Inscripción 2027</a>
        </nav>
      </div>
    </header>
  )
}

export default Header;
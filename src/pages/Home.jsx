import { useEffect } from "react";
import { useLocation } from "react-router";
import Hero from "../Components/Hero/Hero";
import Projects from "../Components/Projects/Projects";
import Program from "../Components/Program/Program";
import Themes from "../Components/Themes/Themes";

function Home() {
  const { hash, key } = useLocation();

  // Si la dirección trae #seccion, bajamos hasta ella; si no, arriba de todo
  useEffect(() => {
    if (!hash) {
      window.scrollTo(0, 0);
      return;
    }
    document.getElementById(hash.slice(1))?.scrollIntoView();
  }, [hash, key]);

  return (
    <>
      <Hero />
      <Projects />
      <Program />
      <Themes />
    </>
  );
}

export default Home;
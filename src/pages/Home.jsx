import { useEffect } from "react";
import { useLocation } from "react-router";
import Hero from "../Components/Hero/Hero";
import Program from "../Components/Program/Program";
import Themes from "../Components/Themes/Themes";
import Team from "../Components/Team/Team";

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
      <Program />
      <Themes />
      <Team />
    </>
  );
}

export default Home;

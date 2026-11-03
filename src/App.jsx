import Header from './Components/Header/Header'
import Hero from './Components/Hero/Hero'
import Program from './Components/Program/Program.jsx'
import Projects from './Components/Projects/Projects.jsx'
import Themes from './Components/Themes/Themes'
function App() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <Projects />
        <Program />
        <Themes />
      </main>
    </>
  )
}

export default App
import { Routes, Route } from 'react-router'
import Header from './Components/Header/Header'
import Home from './pages/Home'
import ThemePage from './pages/ThemePage'
import Footer from './Components/Footer/Footer'

function App() {
  return (
    <>
      <Header />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/tematicas/:slug" element={<ThemePage />} />
        </Routes>
      </main>
      <Footer />
    </>
  )
}

export default App
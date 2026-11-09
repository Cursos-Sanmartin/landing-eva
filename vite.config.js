import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { defineConfig, loadEnv } from 'vite'
import { evaApi } from './server/evaAI.js'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // GEMINI_API_KEY va en .env.local (no se sube a GitHub y no llega al navegador)
  const env = loadEnv(mode, '.', '')
  return {
    plugins: [
      react(),
      babel({ presets: [reactCompilerPreset()] }),
      evaApi({ apiKey: env.GEMINI_API_KEY, model: env.GEMINI_MODEL }),
    ],
  }
})

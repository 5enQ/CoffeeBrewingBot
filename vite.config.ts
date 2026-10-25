import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// base: './' — относительные пути, чтобы одна сборка работала на любом хостинге,
// в Telegram и внутри Capacitor (file:// / capacitor://).
// `npm run build:single` собирает всё в один index.html (удобно для превью и офлайн-раздачи).
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [react(), ...(mode === 'single' ? [viteSingleFile()] : [])],
  build: { outDir: mode === 'single' ? 'dist-single' : 'dist' },
}))

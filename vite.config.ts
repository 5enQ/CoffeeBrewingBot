import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { roasterSvg } from './src/ui/roaster.ts'

// the loading animation right in index.html: seen while the app's script loads, then React draws the same one
const bootLoader = () => ({
  name: 'boot-loader',
  transformIndexHtml: (html: string) => html.replace('<div id="root"></div>', `<div id="root"><div class="loader boot-loader" role="status">${roasterSvg()}<p>Brewbook</p></div></div>`),
})

// base: './' — относительные пути, чтобы одна сборка работала на любом хостинге,
// в Telegram и внутри Capacitor (file:// / capacitor://).
// `npm run build:single` собирает всё в один index.html (удобно для превью и офлайн-раздачи).
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [react(), bootLoader(), ...(mode === 'single' ? [viteSingleFile()] : [])],
  build: { outDir: mode === 'single' ? 'dist-single' : 'dist' },
}))

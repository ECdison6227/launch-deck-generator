import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
export default defineConfig({
  base: './', publicDir: false,
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  build: { outDir: '.player-build', emptyOutDir: true, rolldownOptions: { input: fileURLToPath(new URL('./player.html', import.meta.url)) } },
})

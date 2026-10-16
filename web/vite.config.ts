import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { analyzer } from 'vite-bundle-analyzer'
export default defineConfig({
  plugins: [react(), tailwindcss(), ...(process.env.ANALYZE ? [analyzer({ analyzerMode: 'static', fileName: 'bundle-report.html', openAnalyzer: false })] : [])],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: { host: '127.0.0.1', port: 5173, strictPort: true, watch: { ignored: ['**/evidence/**', '**/test-results/**', '**/.player-build/**', '**/releases/**'] } },
})

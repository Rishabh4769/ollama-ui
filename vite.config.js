import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Exposes the dev server on your local network (0.0.0.0) so you can
// open it from your phone at http://<your-computer-ip>:5173
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173
  },
  preview: {
    host: true,
    port: 5173
  }
})

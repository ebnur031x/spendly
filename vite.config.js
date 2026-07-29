import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
    host: true, // listen on the LAN too, so a phone on the same wifi can reach it
  },
})

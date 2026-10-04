import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const raiz = path.dirname(fileURLToPath(import.meta.url));
// Reglas de niveles compartidas con el backend (fuente única, sin copias).
const shared = path.resolve(raiz, '../shared');

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@shared': shared }
  },
  server: {
    port: 5173,
    // `shared/` está fuera de la carpeta de la webapp: hay que permitir servirla.
    fs: { allow: [raiz, shared] },
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY || 'http://localhost:3000',
        changeOrigin: true
      }
    }
  }
});

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// En desarrollo la app llama a /v1 en su mismo origen y Vite lo reenvía a la API,
// así no hace falta configurar CORS para probar en local.
const api = process.env.API_PROXY ?? 'http://localhost:3000';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { '/v1': api } },
  preview: { port: 4173, proxy: { '/v1': api } },
});

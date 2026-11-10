import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './estilos.css';

const raiz = document.getElementById('root');
if (!raiz) throw new Error('Falta #root en index.html');
createRoot(raiz).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// El service worker permite instalar la app, abrirla sin conexión y recibir los recordatorios.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // sin service worker la app sigue funcionando, solo sin modo instalable ni avisos
    });
  });
}

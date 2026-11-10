# web — PesoXPeso (React + Vite, PWA)

```bash
npm run dev:web      # desde la raíz; abre http://localhost:5173 (necesita la API en :3000)
npm run build -w web # genera web/dist
```

En desarrollo la app llama a `/v1` en su mismo origen y Vite lo reenvía a la API (`API_PROXY`, por defecto `http://localhost:3000`). En producción se define `VITE_API_URL` con la URL pública de la API.

## Estructura

```
src/
  api.ts            cliente de la API: sesión, renovación del token, errores
  contexto.tsx      cuenta, perfil y categorías compartidos; avisos; useCarga
  formato.ts        pesos y fechas (siempre en hora de Colombia)
  componentes/      Marco (navegación + botón Anotar), ModalGasto, Graficos, ...
  paginas/          Acceso, Onboarding, Inicio, Calendario, Graficos, Ajustes, Privacidad
public/
  sw.js             service worker: app sin conexión y notificaciones push
  manifest.webmanifest
```

Sin librerías de interfaz ni de gráficos: los gráficos son HTML y CSS (`componentes/Graficos.tsx`).

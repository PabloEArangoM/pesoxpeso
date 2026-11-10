// Iconos de trazo (24px), sin dependencias.
const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

export const IconoInicio = () => (
  <svg {...base}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.5V21h14V9.5" />
  </svg>
);
export const IconoCalendario = () => (
  <svg {...base}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </svg>
);
export const IconoGraficos = () => (
  <svg {...base}>
    <path d="M4 21V10M10 21V4M16 21v-8M22 21H2" />
  </svg>
);
export const IconoAjustes = () => (
  <svg {...base}>
    <path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h8M16 18h4" />
    <circle cx="16" cy="6" r="2" />
    <circle cx="8" cy="12" r="2" />
    <circle cx="14" cy="18" r="2" />
  </svg>
);
export const IconoMas = () => (
  <svg {...base}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
export const IconoIzquierda = () => (
  <svg {...base}>
    <path d="m15 5-7 7 7 7" />
  </svg>
);
export const IconoDerecha = () => (
  <svg {...base}>
    <path d="m9 5 7 7-7 7" />
  </svg>
);
export const IconoCerrar = () => (
  <svg {...base}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

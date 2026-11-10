/** Cliente de la API: guarda la sesión, renueva el token al vencer y unifica los errores. */

const BASE = `${(import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '')}/v1`;
const CLAVE = 'pxp.sesion';

export interface Sesion {
  token: string;
  refresh_token: string;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public codigo: string,
    mensaje: string,
  ) {
    super(mensaje);
  }
}

/** Mensaje listo para mostrar a partir de cualquier error. */
export function mensajeDe(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  return 'No se pudo conectar. Revisa tu conexión e inténtalo de nuevo.';
}

function leer(): Sesion | null {
  try {
    const s = JSON.parse(localStorage.getItem(CLAVE) ?? 'null');
    return s?.token && s?.refresh_token ? s : null;
  } catch {
    return null;
  }
}

let sesion: Sesion | null = leer();
const oyentes = new Set<() => void>();

export const haySesion = () => sesion !== null;
/** Avisa cuando se abre o se cierra la sesión (también si vence sola). */
export function alCambiarSesion(fn: () => void): () => void {
  oyentes.add(fn);
  return () => oyentes.delete(fn);
}
export function guardarSesion(s: Sesion | null) {
  sesion = s;
  try {
    if (s) localStorage.setItem(CLAVE, JSON.stringify({ token: s.token, refresh_token: s.refresh_token }));
    else localStorage.removeItem(CLAVE);
  } catch {
    // modo privado sin almacenamiento: la sesión dura lo que dure la pestaña
  }
  for (const fn of oyentes) fn();
}

// Si varias peticiones fallan a la vez por token vencido, se renueva una sola vez.
let renovando: Promise<boolean> | null = null;
function renovar(): Promise<boolean> {
  renovando ??= (async () => {
    try {
      const r = await fetch(`${BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: sesion?.refresh_token }),
      });
      if (!r.ok) {
        // Solo un rechazo explícito cierra la sesión; un fallo de red no.
        if (r.status === 401) guardarSesion(null);
        return false;
      }
      guardarSesion(await r.json());
      return true;
    } catch {
      return false;
    } finally {
      renovando = null;
    }
  })();
  return renovando;
}

async function pedirCrudo(metodo: string, ruta: string, cuerpo?: unknown, reintentar = true): Promise<Response> {
  const headers: Record<string, string> = {};
  if (cuerpo !== undefined) headers['Content-Type'] = 'application/json';
  if (sesion) headers.Authorization = `Bearer ${sesion.token}`;
  const r = await fetch(BASE + ruta, {
    method: metodo,
    headers,
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  if (r.status === 401 && sesion && reintentar && !ruta.startsWith('/auth/')) {
    if (await renovar()) return pedirCrudo(metodo, ruta, cuerpo, false);
  }
  if (!r.ok) {
    let codigo = 'ERROR';
    let mensaje = 'Algo salió mal. Inténtalo de nuevo.';
    try {
      const j = await r.json();
      codigo = j.error?.codigo ?? codigo;
      mensaje = j.error?.mensaje ?? mensaje;
    } catch {
      // respuesta sin JSON
    }
    throw new ApiError(r.status, codigo, mensaje);
  }
  return r;
}

async function pedir<T>(metodo: string, ruta: string, cuerpo?: unknown): Promise<T> {
  const r = await pedirCrudo(metodo, ruta, cuerpo);
  return (r.status === 204 ? undefined : await r.json()) as T;
}

export const api = {
  get: <T>(ruta: string) => pedir<T>('GET', ruta),
  post: <T>(ruta: string, cuerpo?: unknown) => pedir<T>('POST', ruta, cuerpo ?? {}),
  patch: <T>(ruta: string, cuerpo: unknown) => pedir<T>('PATCH', ruta, cuerpo),
  put: <T>(ruta: string, cuerpo: unknown) => pedir<T>('PUT', ruta, cuerpo),
  del: <T = void>(ruta: string, cuerpo?: unknown) => pedir<T>('DELETE', ruta, cuerpo),

  /** Descarga un archivo protegido (el CSV) y lo guarda con el nombre que manda el servidor. */
  async descargar(ruta: string, nombrePorDefecto: string) {
    const r = await pedirCrudo('GET', ruta);
    const nombre = /filename="([^"]+)"/.exec(r.headers.get('Content-Disposition') ?? '')?.[1] ?? nombrePorDefecto;
    const url = URL.createObjectURL(await r.blob());
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
};

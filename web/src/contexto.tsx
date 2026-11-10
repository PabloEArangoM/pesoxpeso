import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { alCambiarSesion, api, ApiError, guardarSesion, haySesion, type Sesion } from './api';
import type { Categoria, Cuenta, Perfil } from './tipos';

interface Datos {
  autenticado: boolean;
  /** true mientras se cargan la cuenta y el perfil tras abrir la app o entrar */
  cargando: boolean;
  /** hubo un problema de red al cargar: se puede reintentar */
  sinConexion: boolean;
  cuenta: Cuenta | null;
  /** null = todavía no ha hecho el onboarding */
  perfil: Perfil | null;
  categorias: Categoria[];
  /** cambia cada vez que se crea, edita o borra un gasto: las pantallas recargan al verlo */
  version: number;
  refrescar: () => void;
  entrar: (s: Sesion) => void;
  salir: () => void;
  recargar: () => Promise<void>;
  recargarCategorias: () => Promise<void>;
  setCuenta: (c: Cuenta) => void;
  setPerfil: (p: Perfil) => void;
  avisar: (mensaje: string) => void;
}

const Ctx = createContext<Datos | null>(null);

export function useDatos(): Datos {
  const d = useContext(Ctx);
  if (!d) throw new Error('useDatos fuera de <Proveedor>');
  return d;
}

export function Proveedor({ children }: { children: ReactNode }) {
  const [autenticado, setAutenticado] = useState(haySesion());
  const [cargando, setCargando] = useState(haySesion());
  const [sinConexion, setSinConexion] = useState(false);
  const [cuenta, setCuenta] = useState<Cuenta | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [version, setVersion] = useState(0);
  const [tostadas, setTostadas] = useState<Array<{ id: number; mensaje: string }>>([]);
  const siguienteId = useRef(1);

  useEffect(() => alCambiarSesion(() => setAutenticado(haySesion())), []);

  const recargar = useCallback(async () => {
    if (!haySesion()) return;
    setCargando(true);
    setSinConexion(false);
    try {
      const [c, cats, p] = await Promise.all([
        api.get<Cuenta>('/cuenta'),
        api.get<Categoria[]>('/categorias'),
        api.get<Perfil>('/perfil').catch((e) => {
          if (e instanceof ApiError && e.status === 404) return null; // aún sin perfil
          throw e;
        }),
      ]);
      setCuenta(c);
      setCategorias(cats);
      setPerfil(p);
    } catch (e) {
      // Un 401 ya cerró la sesión en el cliente de la API; lo demás es red o servidor.
      if (!(e instanceof ApiError && e.status === 401)) setSinConexion(true);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (autenticado) void recargar();
    else {
      setCuenta(null);
      setPerfil(null);
      setCategorias([]);
      setCargando(false);
    }
  }, [autenticado, recargar]);

  const avisar = useCallback((mensaje: string) => {
    const id = siguienteId.current++;
    setTostadas((t) => [...t, { id, mensaje }]);
    setTimeout(() => setTostadas((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);

  const valor = useMemo<Datos>(
    () => ({
      autenticado,
      cargando,
      sinConexion,
      cuenta,
      perfil,
      categorias,
      version,
      refrescar: () => setVersion((v) => v + 1),
      entrar: (s) => {
        setCargando(true);
        guardarSesion(s);
      },
      salir: () => guardarSesion(null),
      recargar,
      recargarCategorias: async () => setCategorias(await api.get<Categoria[]>('/categorias')),
      setCuenta,
      setPerfil,
      avisar,
    }),
    [autenticado, cargando, sinConexion, cuenta, perfil, categorias, version, recargar, avisar],
  );

  return (
    <Ctx.Provider value={valor}>
      {children}
      <div className="tostadas" role="status" aria-live="polite">
        {tostadas.map((t) => (
          <div key={t.id} className="tostada">
            {t.mensaje}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

/** Carga datos de la API y los vuelve a pedir cuando cambian `deps` o se registra un gasto. */
export function useCarga<T>(cargar: () => Promise<T>, deps: unknown[]) {
  const { version } = useDatos();
  const [datos, setDatos] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [intento, setIntento] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `cargar` cambia en cada render; las dependencias reales son `deps`
  useEffect(() => {
    let vigente = true;
    setError(null);
    cargar()
      .then((d) => vigente && setDatos(d))
      .catch((e) => vigente && setError(e));
    return () => {
      vigente = false;
    };
  }, [...deps, version, intento]);

  return { datos, error, reintentar: () => setIntento((i) => i + 1) };
}

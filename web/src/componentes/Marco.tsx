import { createContext, type ReactNode, useCallback, useContext, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { IconoAjustes, IconoCalendario, IconoGraficos, IconoInicio, IconoMas } from '../iconos';
import type { Gasto } from '../tipos';
import { ModalGasto } from './ModalGasto';

interface Registro {
  /** Abre el registro rápido; con `fecha` propone ese día. */
  anotar: (fecha?: string) => void;
  editar: (g: Gasto) => void;
}
const Ctx = createContext<Registro>({ anotar: () => {}, editar: () => {} });
export const useRegistro = () => useContext(Ctx);

const enlaces = [
  { a: '/', texto: 'Inicio', Icono: IconoInicio },
  { a: '/calendario', texto: 'Calendario', Icono: IconoCalendario },
  { a: '/graficos', texto: 'Gráficos', Icono: IconoGraficos },
  { a: '/ajustes', texto: 'Ajustes', Icono: IconoAjustes },
];

/** Marco de la app con sesión: contenido, botón de anotar y navegación inferior. */
export function Marco({ children }: { children: ReactNode }) {
  const [modal, setModal] = useState<{ gasto?: Gasto; fecha?: string } | null>(null);
  const anotar = useCallback((fecha?: string) => setModal({ fecha }), []);
  const editar = useCallback((gasto: Gasto) => setModal({ gasto }), []);
  const cerrar = useCallback(() => setModal(null), []);

  return (
    <Ctx.Provider value={{ anotar, editar }}>
      <main className="app pila">{children}</main>
      <button type="button" className="fab" onClick={() => anotar()}>
        <IconoMas /> Anotar
      </button>
      <nav className="nav" aria-label="Principal">
        <div className="nav-int">
          {enlaces.map(({ a, texto, Icono }) => (
            <NavLink key={a} to={a} end={a === '/'} className={({ isActive }) => (isActive ? 'activo' : undefined)}>
              <Icono />
              {texto}
            </NavLink>
          ))}
        </div>
      </nav>
      {modal && <ModalGasto gasto={modal.gasto} fecha={modal.fecha} alCerrar={cerrar} />}
    </Ctx.Provider>
  );
}

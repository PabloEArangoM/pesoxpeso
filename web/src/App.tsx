import type { ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Marco } from './componentes/Marco';
import { Proveedor, useDatos } from './contexto';
import { Entrar, Recuperar, Registro, Restablecer, Verificar } from './paginas/Acceso';
import { Ajustes } from './paginas/Ajustes';
import { Calendario } from './paginas/Calendario';
import { Graficos } from './paginas/Graficos';
import { Inicio } from './paginas/Inicio';
import { Onboarding } from './paginas/Onboarding';
import { Privacidad } from './paginas/Privacidad';

/** Solo con sesión. Sin perfil todavía, todo lleva al onboarding. */
function Privado({ children, onboarding = false }: { children: ReactNode; onboarding?: boolean }) {
  const { autenticado, cargando, sinConexion, cuenta, perfil, recargar } = useDatos();
  const ubicacion = useLocation();
  if (!autenticado) return <Navigate to="/entrar" replace state={{ desde: ubicacion.pathname + ubicacion.search }} />;
  if (sinConexion) {
    return (
      <div className="cargando">
        <div className="vacio">
          <p>No pudimos conectar con PesoXPeso.</p>
          <button type="button" className="btn" style={{ marginTop: 12 }} onClick={() => void recargar()}>
            Reintentar
          </button>
        </div>
      </div>
    );
  }
  if (cargando || !cuenta) return <div className="cargando">Cargando…</div>;
  if (!perfil && !onboarding) return <Navigate to="/onboarding" replace />;
  if (perfil && onboarding) return <Navigate to="/" replace />;
  return onboarding ? children : <Marco>{children}</Marco>;
}

/** Entrar, registro y recuperar: con sesión abierta no tienen sentido. */
function Publico({ children }: { children: ReactNode }) {
  const { autenticado } = useDatos();
  const ubicacion = useLocation();
  if (autenticado) return <Navigate to={(ubicacion.state as { desde?: string } | null)?.desde ?? '/'} replace />;
  return children;
}

export function App() {
  return (
    <BrowserRouter>
      <Proveedor>
        <Routes>
          <Route path="/entrar" element={<Publico><Entrar /></Publico>} />
          <Route path="/registro" element={<Publico><Registro /></Publico>} />
          <Route path="/recuperar" element={<Publico><Recuperar /></Publico>} />
          {/* Los enlaces del correo funcionan con o sin sesión */}
          <Route path="/restablecer" element={<Restablecer />} />
          <Route path="/verificar" element={<Verificar />} />
          <Route path="/privacidad" element={<Privacidad />} />

          <Route path="/onboarding" element={<Privado onboarding><Onboarding /></Privado>} />
          <Route path="/" element={<Privado><Inicio /></Privado>} />
          <Route path="/calendario" element={<Privado><Calendario /></Privado>} />
          <Route path="/graficos" element={<Privado><Graficos /></Privado>} />
          <Route path="/ajustes" element={<Privado><Ajustes /></Privado>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Proveedor>
    </BrowserRouter>
  );
}

import { type FormEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, mensajeDe, type Sesion } from '../api';
import { MensajeError } from '../componentes/Campos';
import { useDatos } from '../contexto';

function Caja({ titulo, bajada, children }: { titulo: string; bajada?: string; children: ReactNode }) {
  return (
    <main className="acceso">
      <div className="marca-app">
        <img src="/icon.svg" alt="" /> PesoXPeso
      </div>
      <div className="pila-s">
        <h1>{titulo}</h1>
        {bajada && <p className="suave">{bajada}</p>}
      </div>
      {children}
    </main>
  );
}

/** Estado común de los formularios: ocupado, error y envío protegido. */
function useEnvio() {
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function enviar(fn: () => Promise<void>) {
    setOcupado(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(mensajeDe(e));
    } finally {
      setOcupado(false);
    }
  }
  return { ocupado, error, setError, enviar };
}

export function Entrar() {
  const { entrar } = useDatos();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { ocupado, error, enviar } = useEnvio();
  const alEnviar = (e: FormEvent) => {
    e.preventDefault();
    void enviar(async () => entrar(await api.post<Sesion>('/auth/login', { email, password })));
  };
  return (
    <Caja titulo="Entrar" bajada="Cada peso cuenta. Apúntalo.">
      <form className="pila" onSubmit={alEnviar}>
        <label className="campo">
          <span>Correo</span>
          <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="campo">
          <span>Contraseña</span>
          <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <MensajeError>{error}</MensajeError>
        <button type="submit" className="btn primario bloque" disabled={ocupado}>
          Entrar
        </button>
      </form>
      <p>
        <Link to="/recuperar">Olvidé mi contraseña</Link>
      </p>
      <p className="suave">
        ¿No tienes cuenta? <Link to="/registro">Crear cuenta</Link>
      </p>
    </Caja>
  );
}

export function Registro() {
  const { entrar } = useDatos();
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [acepta, setAcepta] = useState(false);
  const { ocupado, error, enviar } = useEnvio();
  const alEnviar = (e: FormEvent) => {
    e.preventDefault();
    void enviar(async () =>
      entrar(await api.post<Sesion>('/auth/registro', { email, password, ...(nombre.trim() ? { nombre } : {}) })),
    );
  };
  return (
    <Caja titulo="Crear cuenta" bajada="Anota tus gastos pequeños en segundos y mira en qué se te va la plata.">
      <form className="pila" onSubmit={alEnviar}>
        <label className="campo">
          <span>Nombre (opcional)</span>
          <input type="text" autoComplete="given-name" maxLength={80} value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </label>
        <label className="campo">
          <span>Correo</span>
          <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="campo">
          <span>Contraseña</span>
          <input type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
          <small>Mínimo 8 caracteres.</small>
        </label>
        <label className="fila" style={{ alignItems: 'flex-start' }}>
          <input type="checkbox" required checked={acepta} onChange={(e) => setAcepta(e.target.checked)} style={{ marginTop: 4 }} />
          <span className="suave" style={{ fontSize: '0.9rem' }}>
            Acepto el tratamiento de mis datos según la <Link to="/privacidad">política de privacidad</Link>.
          </span>
        </label>
        <MensajeError>{error}</MensajeError>
        <button type="submit" className="btn primario bloque" disabled={ocupado}>
          Crear cuenta
        </button>
      </form>
      <p className="suave">
        ¿Ya tienes cuenta? <Link to="/entrar">Entrar</Link>
      </p>
    </Caja>
  );
}

export function Recuperar() {
  const [email, setEmail] = useState('');
  const [enviado, setEnviado] = useState(false);
  const { ocupado, error, enviar } = useEnvio();
  const alEnviar = (e: FormEvent) => {
    e.preventDefault();
    void enviar(async () => {
      await api.post('/auth/recuperar', { email });
      setEnviado(true);
    });
  };
  if (enviado) {
    return (
      <Caja titulo="Revisa tu correo">
        <p className="suave">
          Si <b>{email}</b> tiene una cuenta, le enviamos un enlace para elegir una contraseña nueva. Vale 1 hora.
        </p>
        <Link className="btn bloque" to="/entrar">
          Volver a entrar
        </Link>
      </Caja>
    );
  }
  return (
    <Caja titulo="Recuperar contraseña" bajada="Te enviamos un enlace para elegir una nueva.">
      <form className="pila" onSubmit={alEnviar}>
        <label className="campo">
          <span>Correo</span>
          <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <MensajeError>{error}</MensajeError>
        <button type="submit" className="btn primario bloque" disabled={ocupado}>
          Enviar enlace
        </button>
      </form>
      <p>
        <Link to="/entrar">Volver</Link>
      </p>
    </Caja>
  );
}

export function Restablecer() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navegar = useNavigate();
  const { salir, avisar } = useDatos();
  const [password, setPassword] = useState('');
  const { ocupado, error, enviar } = useEnvio();
  const alEnviar = (e: FormEvent) => {
    e.preventDefault();
    void enviar(async () => {
      await api.post('/auth/restablecer', { token, password_nueva: password });
      salir(); // el servidor cerró todas las sesiones
      avisar('Contraseña cambiada. Ya puedes entrar.');
      navegar('/entrar', { replace: true });
    });
  };
  if (!token) {
    return (
      <Caja titulo="Enlace incompleto">
        <p className="suave">Abre el enlace completo que llegó a tu correo, o pide uno nuevo.</p>
        <Link className="btn bloque" to="/recuperar">
          Pedir otro enlace
        </Link>
      </Caja>
    );
  }
  return (
    <Caja titulo="Nueva contraseña">
      <form className="pila" onSubmit={alEnviar}>
        <label className="campo">
          <span>Contraseña nueva</span>
          <input type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
          <small>Mínimo 8 caracteres. Se cerrarán tus otras sesiones.</small>
        </label>
        <MensajeError>{error}</MensajeError>
        <button type="submit" className="btn primario bloque" disabled={ocupado}>
          Guardar contraseña
        </button>
      </form>
      {error && (
        <p>
          <Link to="/recuperar">Pedir otro enlace</Link>
        </p>
      )}
    </Caja>
  );
}

export function Verificar() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const { autenticado, recargar } = useDatos();
  const [estado, setEstado] = useState<'verificando' | 'ok' | 'error'>(token ? 'verificando' : 'error');
  const [mensaje, setMensaje] = useState('El enlace está incompleto.');
  const hecho = useRef(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: el enlace es de un solo uso; se consume una vez al abrir
  useEffect(() => {
    if (!token || hecho.current) return;
    hecho.current = true;
    api
      .post('/auth/verificar-email', { token })
      .then(() => {
        setEstado('ok');
        if (autenticado) void recargar();
      })
      .catch((e) => {
        setMensaje(mensajeDe(e));
        setEstado('error');
      });
  }, [token]);

  return (
    <Caja titulo={estado === 'ok' ? 'Correo confirmado' : estado === 'error' ? 'No se pudo confirmar' : 'Confirmando…'}>
      {estado === 'ok' && <p className="suave">Listo, tu correo quedó verificado.</p>}
      {estado === 'error' && <p className="suave">{mensaje} Puedes pedir un enlace nuevo desde Ajustes.</p>}
      {estado !== 'verificando' && (
        <Link className="btn primario bloque" to="/">
          Ir a PesoXPeso
        </Link>
      )}
    </Caja>
  );
}

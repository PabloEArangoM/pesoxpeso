import { type FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, guardarSesion, mensajeDe, type Sesion } from '../../api';
import { Estado, MensajeError } from '../../componentes/Campos';
import { useCarga, useDatos } from '../../contexto';
import { hoy, instante, limitesDelMes, sumarDias } from '../../formato';
import type { ApiToken, Cuenta } from '../../tipos';
import { Seccion, useAccion } from './Seccion';

// ---------- Recordatorios (notificaciones push) ----------

function claveABytes(base64url: string): Uint8Array<ArrayBuffer> {
  const b64 = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const crudo = atob(b64);
  const bytes = new Uint8Array(new ArrayBuffer(crudo.length));
  for (let i = 0; i < crudo.length; i++) bytes[i] = crudo.charCodeAt(i);
  return bytes;
}

const navegadorSoportaPush = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

export function SeccionRecordatorios() {
  const { cuenta, setCuenta } = useDatos();
  const [hora, setHora] = useState(cuenta?.recordatorio_hora ?? '20:00');
  const { ocupado, ejecutar } = useAccion();
  if (!cuenta) return null;
  const activo = cuenta.recordatorio_activo;

  async function activar() {
    const clave = cuenta?.push.clave_publica;
    if (!clave) throw new Error('sin clave');
    if ((await Notification.requestPermission()) !== 'granted') {
      throw new Error('permiso');
    }
    const registro = await navigator.serviceWorker.ready;
    const sub =
      (await registro.pushManager.getSubscription()) ??
      (await registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: claveABytes(clave) }));
    const j = sub.toJSON();
    await api.post('/cuenta/push', { endpoint: j.endpoint, keys: j.keys });
    setCuenta(await api.patch<Cuenta>('/cuenta', { recordatorio_activo: true, recordatorio_hora: hora }));
  }
  async function desactivar() {
    setCuenta(await api.patch<Cuenta>('/cuenta', { recordatorio_activo: false }));
    const registro = await navigator.serviceWorker.ready;
    const sub = await registro.pushManager.getSubscription();
    if (sub) {
      await api.del('/cuenta/push', { endpoint: sub.endpoint });
      await sub.unsubscribe();
    }
  }

  let cuerpo: React.ReactNode;
  if (!cuenta.push.disponible || !cuenta.push.clave_publica) {
    cuerpo = <p className="aviso">Los recordatorios aún no están activados en el servidor (faltan las llaves VAPID).</p>;
  } else if (!navegadorSoportaPush()) {
    cuerpo = (
      <p className="aviso">
        Este navegador no admite notificaciones. En iPhone, primero agrega PesoXPeso a la pantalla de inicio (Compartir → Agregar a inicio) y ábrela desde ahí.
      </p>
    );
  } else {
    cuerpo = (
      <>
        <label className="campo" style={{ maxWidth: 180 }}>
          <span>Hora del aviso</span>
          <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
        </label>
        <div className="fila ajusta">
          {activo ? (
            <>
              <button
                type="button"
                className="btn"
                disabled={ocupado || hora === cuenta.recordatorio_hora}
                onClick={() => void ejecutar(async () => setCuenta(await api.patch<Cuenta>('/cuenta', { recordatorio_hora: hora })), 'Hora actualizada.')}
              >
                Cambiar hora
              </button>
              <button type="button" className="btn peligro" disabled={ocupado} onClick={() => void ejecutar(desactivar, 'Recordatorio desactivado.')}>
                Desactivar
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn primario"
              disabled={ocupado}
              onClick={() =>
                void ejecutar(async () => {
                  try {
                    await activar();
                  } catch (e) {
                    if (e instanceof Error && e.message === 'permiso') {
                      throw new Error('Necesitamos tu permiso para enviar notificaciones. Actívalo en los ajustes del navegador.', { cause: e });
                    }
                    throw e;
                  }
                }, 'Recordatorio activado.')
              }
            >
              Activar recordatorio
            </button>
          )}
        </div>
      </>
    );
  }

  return (
    <Seccion id="recordatorios" emoji="🔔" titulo="Recordatorio diario">
      <p className="tenue">
        Un aviso al día, solo si a esa hora todavía no has anotado nada. {activo && `Activo a las ${cuenta.recordatorio_hora}.`}
      </p>
      {cuerpo}
    </Seccion>
  );
}

// ---------- Atajos (tokens personales) ----------

export function SeccionAtajo() {
  const { datos, error, reintentar } = useCarga(() => api.get<ApiToken[]>('/auth/api-tokens'), []);
  const [lista, setLista] = useState<ApiToken[] | null>(null);
  const [nombre, setNombre] = useState('');
  const [nuevo, setNuevo] = useState<ApiToken | null>(null);
  const { ocupado, ejecutar } = useAccion();
  const { avisar } = useDatos();
  const tokens = lista ?? datos;

  const crear = (e: FormEvent) => {
    e.preventDefault();
    void ejecutar(async () => {
      const t = await api.post<ApiToken>('/auth/api-tokens', nombre.trim() ? { nombre } : {});
      setNuevo(t);
      setNombre('');
      setLista(await api.get<ApiToken[]>('/auth/api-tokens'));
    });
  };
  const revocar = (t: ApiToken) => {
    if (!window.confirm(`¿Revocar "${t.nombre}"? El atajo que lo use dejará de funcionar de inmediato.`)) return;
    void ejecutar(async () => {
      await api.del(`/auth/api-tokens/${t.id}`);
      if (nuevo?.id === t.id) setNuevo(null);
      setLista(await api.get<ApiToken[]>('/auth/api-tokens'));
    }, 'Token revocado.');
  };
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(nuevo?.token ?? '');
      avisar('Token copiado.');
    } catch {
      avisar('No se pudo copiar; selecciónalo y cópialo a mano.');
    }
  };

  return (
    <Seccion id="atajo" emoji="⚡" titulo="Atajo de iPhone o Android">
      <p className="tenue">
        Anota gastos sin abrir la app, desde un Atajo. Cada atajo usa un token que solo puede registrar y consultar gastos; si pierdes el teléfono, lo revocas aquí.
      </p>
      {nuevo?.token && (
        <div className="aviso alerta pila-s">
          <b>Copia este token ahora: no se volverá a mostrar.</b>
          <code className="token">{nuevo.token}</code>
          <div>
            <button type="button" className="btn chico" onClick={copiar}>
              Copiar
            </button>
          </div>
        </div>
      )}
      {!tokens ? (
        <Estado error={error} reintentar={reintentar} />
      ) : (
        tokens.length > 0 && (
          <div>
            {tokens.map((t) => (
              <div className="item" key={t.id}>
                <div className="crece">
                  <div style={{ fontWeight: 600 }}>{t.nombre}</div>
                  <div className="tenue">Último uso: {instante(t.ultimo_uso)}</div>
                </div>
                <button type="button" className="btn chico peligro" disabled={ocupado} onClick={() => revocar(t)}>
                  Revocar
                </button>
              </div>
            ))}
          </div>
        )
      )}
      <form className="fila ajusta" style={{ alignItems: 'flex-end' }} onSubmit={crear}>
        <label className="campo crece" style={{ minWidth: 160 }}>
          <span>Nombre del token</span>
          <input type="text" value={nombre} maxLength={60} placeholder="Atajo iPhone" onChange={(e) => setNombre(e.target.value)} />
        </label>
        <button type="submit" className="btn" disabled={ocupado}>
          Crear token
        </button>
      </form>
    </Seccion>
  );
}

// ---------- Exportar ----------

export function SeccionExportar() {
  const h = hoy();
  const [desde, setDesde] = useState(limitesDelMes(h).desde);
  const [hasta, setHasta] = useState(h);
  const { ocupado, ejecutar } = useAccion();
  const descargar = (e: FormEvent) => {
    e.preventDefault();
    void ejecutar(() => api.descargar(`/gastos/exportar?desde=${desde}&hasta=${hasta}`, `pesoxpeso_${desde}_${hasta}.csv`));
  };
  return (
    <Seccion id="exportar" emoji="📤" titulo="Exportar mis gastos">
      <p className="tenue">Descarga un archivo CSV que abre en Excel o Google Sheets. Máximo 5 años por archivo.</p>
      <form className="pila" onSubmit={descargar}>
        <div className="fila ajusta">
          <label className="campo crece" style={{ minWidth: 140 }}>
            <span>Desde</span>
            <input type="date" value={desde} max={hasta} min={sumarDias(hasta, -1830)} required onChange={(e) => setDesde(e.target.value)} />
          </label>
          <label className="campo crece" style={{ minWidth: 140 }}>
            <span>Hasta</span>
            <input type="date" value={hasta} min={desde} max={h} required onChange={(e) => setHasta(e.target.value)} />
          </label>
        </div>
        <button type="submit" className="btn" disabled={ocupado}>
          Descargar CSV
        </button>
      </form>
    </Seccion>
  );
}

// ---------- Cuenta y seguridad ----------

export function SeccionSeguridad() {
  const { cuenta, setCuenta, salir, avisar } = useDatos();
  const [nombre, setNombre] = useState(cuenta?.nombre ?? '');
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { ocupado, ejecutar } = useAccion();

  async function cambiarClave(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      // El servidor revoca las demás sesiones y devuelve una nueva para este dispositivo.
      guardarSesion(await api.patch<Sesion>('/auth/password', { password_actual: actual, password_nueva: nueva }));
      setActual('');
      setNueva('');
      avisar('Contraseña cambiada. Se cerraron tus otras sesiones.');
    } catch (err) {
      setError(mensajeDe(err));
    }
  }

  return (
    <Seccion id="seguridad" emoji="🔒" titulo="Cuenta y seguridad">
      <p className="tenue">
        {cuenta?.email} · {cuenta?.email_verificado ? 'correo verificado' : 'correo sin verificar'}
      </p>
      <form
        className="fila ajusta"
        style={{ alignItems: 'flex-end' }}
        onSubmit={(e) => {
          e.preventDefault();
          void ejecutar(async () => setCuenta(await api.patch<Cuenta>('/cuenta', { nombre: nombre.trim() || null })), 'Nombre guardado.');
        }}
      >
        <label className="campo crece" style={{ minWidth: 160 }}>
          <span>Nombre</span>
          <input type="text" value={nombre} maxLength={80} autoComplete="given-name" onChange={(e) => setNombre(e.target.value)} />
        </label>
        <button type="submit" className="btn" disabled={ocupado}>
          Guardar
        </button>
      </form>

      <form className="pila" onSubmit={cambiarClave}>
        <h3>Cambiar contraseña</h3>
        <label className="campo">
          <span>Contraseña actual</span>
          <input type="password" autoComplete="current-password" required value={actual} onChange={(e) => setActual(e.target.value)} />
        </label>
        <label className="campo">
          <span>Contraseña nueva</span>
          <input type="password" autoComplete="new-password" required minLength={8} value={nueva} onChange={(e) => setNueva(e.target.value)} />
          <small>Mínimo 8 caracteres.</small>
        </label>
        <MensajeError>{error}</MensajeError>
        <div>
          <button type="submit" className="btn">
            Cambiar contraseña
          </button>
        </div>
      </form>

      <div className="fila ajusta">
        <button type="button" className="btn" onClick={salir}>
          Cerrar sesión
        </button>
        <button
          type="button"
          className="btn"
          disabled={ocupado}
          onClick={() => {
            if (!window.confirm('¿Cerrar sesión en todos tus dispositivos, incluido este?')) return;
            void ejecutar(async () => {
              await api.post('/auth/cerrar-sesiones');
              salir();
            });
          }}
        >
          Cerrar en todos los dispositivos
        </button>
      </div>
    </Seccion>
  );
}

export function SeccionBorrarCuenta() {
  const { salir, avisar } = useDatos();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function borrar(e: FormEvent) {
    e.preventDefault();
    if (!window.confirm('Esto borra tu cuenta y todos tus gastos para siempre. ¿Continuar?')) return;
    setOcupado(true);
    setError(null);
    try {
      await api.del('/auth/cuenta', { password });
      avisar('Tu cuenta y tus datos fueron borrados.');
      salir();
    } catch (err) {
      setError(mensajeDe(err));
      setOcupado(false);
    }
  }

  return (
    <Seccion id="borrar" emoji="🗑️" titulo="Borrar mi cuenta">
      <p className="tenue">
        Se eliminan tu perfil, tus gastos, categorías, presupuestos y tokens. No se puede deshacer; si quieres conservar algo, expórtalo antes. Más detalles en la{' '}
        <Link to="/privacidad">política de privacidad</Link>.
      </p>
      <form className="pila" onSubmit={borrar}>
        <label className="campo">
          <span>Escribe tu contraseña para confirmar</span>
          <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <MensajeError>{error}</MensajeError>
        <div>
          <button type="submit" className="btn peligro lleno" disabled={ocupado}>
            Borrar mi cuenta para siempre
          </button>
        </div>
      </form>
    </Seccion>
  );
}

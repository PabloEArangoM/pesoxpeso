import { type FormEvent, useEffect, useState } from 'react';
import { api } from '../../api';
import { CampoPesos, Estado } from '../../componentes/Campos';
import { FormularioPerfil, perfilInicial, perfilParaApi } from '../../componentes/FormularioPerfil';
import { useCarga, useDatos } from '../../contexto';
import { fechaCorta, hoy, pesos } from '../../formato';
import type { Frecuencia, Perfil, Presupuestos, Recurrente } from '../../tipos';
import { Seccion, useAccion } from './Seccion';

export function SeccionPerfil() {
  const { perfil, setPerfil } = useDatos();
  const [valores, setValores] = useState(perfilInicial(perfil));
  const { ocupado, ejecutar } = useAccion();
  const guardar = (e: FormEvent) => {
    e.preventDefault();
    void ejecutar(async () => setPerfil(await api.patch<Perfil>('/perfil', perfilParaApi(valores))), 'Perfil guardado.');
  };
  return (
    <Seccion id="perfil" emoji="👤" titulo="Mi perfil financiero">
      <form className="pila" onSubmit={guardar}>
        <FormularioPerfil valores={valores} onChange={setValores} />
        <button type="submit" className="btn primario" disabled={ocupado}>
          Guardar perfil
        </button>
      </form>
    </Seccion>
  );
}

export function SeccionPresupuesto() {
  const { refrescar } = useDatos();
  const { datos, error, reintentar } = useCarga(() => api.get<Presupuestos>('/presupuesto'), []);
  const [semanal, setSemanal] = useState('');
  const [mensual, setMensual] = useState('');
  const { ocupado, ejecutar } = useAccion();

  useEffect(() => {
    if (!datos) return;
    setSemanal(datos.semanal ? String(datos.semanal.monto) : '');
    setMensual(datos.mensual ? String(datos.mensual.monto) : '');
  }, [datos]);

  const guardar = (e: FormEvent) => {
    e.preventDefault();
    void ejecutar(async () => {
      // Campo vacío = sin tope en ese periodo.
      await api.put('/presupuesto', { semanal: semanal ? Number(semanal) : null, mensual: mensual ? Number(mensual) : null });
      refrescar();
    }, 'Presupuesto guardado.');
  };

  return (
    <Seccion id="presupuesto" emoji="🎯" titulo="Presupuesto">
      {!datos ? (
        <Estado error={error} reintentar={reintentar} />
      ) : (
        <form className="pila" onSubmit={guardar}>
          <p className="tenue">Te avisamos al llegar al 80% y si te pasas. Deja un campo vacío para no tener tope.</p>
          <label className="campo">
            <span>Tope semanal (lunes a domingo)</span>
            <CampoPesos valor={semanal} onChange={setSemanal} placeholder="Sin tope" />
            {datos.semanal && <small>Esta semana llevas {pesos(datos.semanal.gastado)}.</small>}
          </label>
          <label className="campo">
            <span>Tope mensual</span>
            <CampoPesos valor={mensual} onChange={setMensual} placeholder="Sin tope" />
            {datos.mensual && <small>Este mes llevas {pesos(datos.mensual.gastado)}.</small>}
          </label>
          <button type="submit" className="btn primario" disabled={ocupado}>
            Guardar presupuesto
          </button>
        </form>
      )}
    </Seccion>
  );
}

export function SeccionCategorias() {
  const { categorias, recargarCategorias, refrescar } = useDatos();
  const [nombre, setNombre] = useState('');
  const [icono, setIcono] = useState('');
  const { ocupado, ejecutar } = useAccion();
  const propias = categorias.filter((c) => c.propia);

  const crear = async (e: FormEvent) => {
    e.preventDefault();
    const ok = await ejecutar(async () => {
      await api.post('/categorias', { nombre, ...(icono.trim() ? { icono } : {}) });
      await recargarCategorias();
    }, 'Categoría creada.');
    if (ok) {
      setNombre('');
      setIcono('');
    }
  };
  const borrar = (id: string, n: string) => {
    if (!window.confirm(`¿Borrar "${n}"? Sus gastos pasarán a la categoría Otro.`)) return;
    void ejecutar(async () => {
      await api.del(`/categorias/${id}`);
      await recargarCategorias();
      refrescar();
    }, 'Categoría borrada.');
  };

  return (
    <Seccion id="categorias" emoji="🏷️" titulo="Mis categorías">
      <p className="tenue">Además de las 5 que vienen por defecto puedes crear las tuyas (hasta 20).</p>
      {propias.length > 0 && (
        <div>
          {propias.map((c) => (
            <div className="item" key={c.id}>
              <span style={{ fontSize: '1.25rem' }} aria-hidden>
                {c.icono}
              </span>
              <span className="crece">{c.nombre}</span>
              <button type="button" className="btn chico peligro" onClick={() => borrar(c.id, c.nombre)} disabled={ocupado}>
                Borrar
              </button>
            </div>
          ))}
        </div>
      )}
      <form className="fila ajusta" style={{ alignItems: 'flex-end' }} onSubmit={crear}>
        <label className="campo" style={{ width: 76 }}>
          <span>Emoji</span>
          <input type="text" value={icono} maxLength={16} placeholder="🏷️" onChange={(e) => setIcono(e.target.value)} />
        </label>
        <label className="campo crece" style={{ minWidth: 140 }}>
          <span>Nombre</span>
          <input type="text" value={nombre} required maxLength={30} placeholder="Ej.: Gimnasio" onChange={(e) => setNombre(e.target.value)} />
        </label>
        <button type="submit" className="btn" disabled={ocupado}>
          Crear
        </button>
      </form>
    </Seccion>
  );
}

const FRECUENCIAS: Record<Frecuencia, string> = { diaria: 'Cada día', semanal: 'Cada semana', mensual: 'Cada mes' };

export function SeccionRecurrentes() {
  const { categorias, refrescar } = useDatos();
  const { datos, error, reintentar } = useCarga(() => api.get<Recurrente[]>('/recurrentes'), []);
  const [monto, setMonto] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [frecuencia, setFrecuencia] = useState<Frecuencia>('mensual');
  const [inicio, setInicio] = useState(hoy());
  const [nota, setNota] = useState('');
  const { ocupado, ejecutar } = useAccion();

  const crear = async (e: FormEvent) => {
    e.preventDefault();
    const ok = await ejecutar(async () => {
      await api.post('/recurrentes', { monto: Number(monto), categoria_id: categoriaId, frecuencia, inicio, nota });
      refrescar();
    }, 'Gasto recurrente creado.');
    if (ok) {
      setMonto('');
      setNota('');
    }
  };
  const cambiar = (r: Recurrente, cuerpo: object, exito: string) =>
    void ejecutar(async () => {
      await api.patch(`/recurrentes/${r.id}`, cuerpo);
      refrescar();
    }, exito);
  const borrar = (r: Recurrente) => {
    if (!window.confirm('¿Borrar este gasto recurrente? Los gastos que ya creó se conservan.')) return;
    void ejecutar(async () => {
      await api.del(`/recurrentes/${r.id}`);
      refrescar();
    }, 'Gasto recurrente borrado.');
  };

  return (
    <Seccion id="recurrentes" emoji="🔁" titulo="Gastos recurrentes">
      <p className="tenue">Se anotan solos cuando toca: el pasaje diario, la suscripción del mes… No cuentan para tu racha.</p>
      {!datos ? (
        <Estado error={error} reintentar={reintentar} />
      ) : (
        datos.length > 0 && (
          <div>
            {datos.map((r) => (
              <div className="item" key={r.id} style={{ opacity: r.activo ? 1 : 0.6 }}>
                <span style={{ fontSize: '1.25rem' }} aria-hidden>
                  {r.icono}
                </span>
                <div className="crece">
                  <div style={{ fontWeight: 600 }} className="num">
                    {pesos(r.monto)} · {r.categoria}
                  </div>
                  <div className="tenue">
                    {FRECUENCIAS[r.frecuencia]}
                    {r.nota && ` · ${r.nota}`} · {r.activo ? `próximo: ${fechaCorta(r.proxima_fecha)}` : 'en pausa'}
                  </div>
                </div>
                <button type="button" className="btn chico" disabled={ocupado} onClick={() => cambiar(r, { activo: !r.activo }, r.activo ? 'En pausa.' : 'Reanudado.')}>
                  {r.activo ? 'Pausar' : 'Reanudar'}
                </button>
                <button type="button" className="btn chico peligro" disabled={ocupado} onClick={() => borrar(r)} aria-label={`Borrar ${r.categoria}`}>
                  ✕
                </button>
              </div>
            ))}
          </div>
        )
      )}
      <form className="pila" onSubmit={crear}>
        <h3>Nuevo gasto recurrente</h3>
        <div className="fila ajusta">
          <label className="campo crece" style={{ minWidth: 120 }}>
            <span>Monto</span>
            <CampoPesos valor={monto} onChange={setMonto} />
          </label>
          <label className="campo crece" style={{ minWidth: 150 }}>
            <span>Categoría</span>
            <select value={categoriaId} required onChange={(e) => setCategoriaId(e.target.value)}>
              <option value="" disabled>
                Elige…
              </option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icono} {c.nombre}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="fila ajusta">
          <label className="campo crece" style={{ minWidth: 130 }}>
            <span>Se repite</span>
            <select value={frecuencia} onChange={(e) => setFrecuencia(e.target.value as Frecuencia)}>
              {Object.entries(FRECUENCIAS).map(([v, t]) => (
                <option key={v} value={v}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className="campo crece" style={{ minWidth: 140 }}>
            <span>Empieza el</span>
            <input type="date" value={inicio} min={hoy()} required onChange={(e) => setInicio(e.target.value)} />
          </label>
        </div>
        <label className="campo">
          <span>Nota (opcional)</span>
          <input type="text" value={nota} maxLength={200} onChange={(e) => setNota(e.target.value)} placeholder="Ej.: plan del celular" />
        </label>
        <button type="submit" className="btn" disabled={ocupado || !monto}>
          Crear gasto recurrente
        </button>
      </form>
    </Seccion>
  );
}

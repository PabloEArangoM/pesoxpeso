import { type FormEvent, useEffect, useState } from 'react';
import { api, mensajeDe } from '../api';
import { useDatos } from '../contexto';
import { hoy, pesos } from '../formato';
import { IconoCerrar } from '../iconos';
import type { Gasto, GastoCreado } from '../tipos';
import { CampoPesos, MensajeError } from './Campos';

/** Registro rápido: monto, categoría y listo. Con `gasto` sirve para editar o borrar. */
export function ModalGasto(props: { gasto?: Gasto; fecha?: string; alCerrar: () => void }) {
  const { gasto, alCerrar } = props;
  const { categorias, refrescar, avisar } = useDatos();
  const [monto, setMonto] = useState(gasto ? String(gasto.monto) : '');
  const [categoriaId, setCategoriaId] = useState(gasto?.categoria_id ?? '');
  const [nota, setNota] = useState(gasto?.nota ?? '');
  const [fecha, setFecha] = useState(gasto?.fecha ?? props.fecha ?? hoy());
  const [hora, setHora] = useState(gasto?.hora ?? '');
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [confirmarBorrado, setConfirmarBorrado] = useState(false);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && alCerrar();
    document.addEventListener('keydown', tecla);
    const previo = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', tecla);
      document.body.style.overflow = previo;
    };
  }, [alCerrar]);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (!monto || Number(monto) <= 0) return setError('Escribe cuánto gastaste.');
    if (!categoriaId) return setError('Elige una categoría.');
    setOcupado(true);
    setError(null);
    try {
      if (gasto) {
        await api.patch(`/gastos/${gasto.id}`, { monto: Number(monto), categoria_id: categoriaId, nota, fecha, hora });
        avisar('Gasto actualizado.');
      } else {
        // Si la fecha es hoy no se envía: el servidor pone fecha y hora de Colombia.
        const r = await api.post<GastoCreado>('/gastos', {
          monto: Number(monto),
          categoria_id: categoriaId,
          nota,
          ...(fecha === hoy() ? {} : { fecha }),
        });
        avisar(
          fecha === hoy() ? `Anotado. Hoy llevas ${pesos(r.resumen.total_dia)}.` : `Anotado: ${pesos(r.monto)}.`,
        );
        r.resumen.alertas.forEach(avisar);
      }
      refrescar();
      alCerrar();
    } catch (err) {
      setError(mensajeDe(err));
      setOcupado(false);
    }
  }

  async function borrar() {
    if (!gasto) return;
    setOcupado(true);
    try {
      await api.del(`/gastos/${gasto.id}`);
      avisar('Gasto borrado.');
      refrescar();
      alCerrar();
    } catch (err) {
      setError(mensajeDe(err));
      setOcupado(false);
    }
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: tocar el telón cierra el diálogo; con teclado se cierra con Escape o el botón Cerrar
    <div className="telon" onMouseDown={(e) => e.target === e.currentTarget && alCerrar()}>
      <form className="modal pila" role="dialog" aria-modal="true" aria-labelledby="titulo-modal" onSubmit={guardar}>
        <div className="fila entre">
          <h2 id="titulo-modal">{gasto ? 'Editar gasto' : '¿Cuánto gastaste?'}</h2>
          <button type="button" className="icono-btn" onClick={alCerrar} aria-label="Cerrar">
            <IconoCerrar />
          </button>
        </div>

        <label className="monto-grande num">
          <span aria-hidden>$</span>
          <CampoPesos valor={monto} onChange={setMonto} autoFocus aria-label="Monto en pesos" />
        </label>

        <div className="pila-s">
          <span className="etiqueta" id="rot-categoria">
            Categoría
          </span>
          <div className="opciones" role="group" aria-labelledby="rot-categoria">
            {categorias.map((c) => (
              <button
                key={c.id}
                type="button"
                className="opcion"
                aria-pressed={categoriaId === c.id}
                onClick={() => setCategoriaId(c.id)}
              >
                <span className="emoji" aria-hidden>
                  {c.icono}
                </span>
                {c.nombre}
              </button>
            ))}
          </div>
        </div>

        <label className="campo">
          <span>Nota (opcional)</span>
          <input type="text" value={nota} maxLength={200} onChange={(e) => setNota(e.target.value)} placeholder="Ej.: empanada en la U" />
        </label>

        <div className="fila">
          <label className="campo crece">
            <span>Fecha</span>
            <input type="date" value={fecha} max={hoy()} required onChange={(e) => setFecha(e.target.value)} />
          </label>
          {gasto && (
            <label className="campo crece">
              <span>Hora</span>
              <input type="time" value={hora} required onChange={(e) => setHora(e.target.value)} />
            </label>
          )}
        </div>

        <MensajeError>{error}</MensajeError>

        <button type="submit" className="btn primario bloque" disabled={ocupado}>
          {gasto ? 'Guardar cambios' : 'Anotar gasto'}
        </button>
        {gasto &&
          (confirmarBorrado ? (
            <div className="fila">
              <button type="button" className="btn crece" onClick={() => setConfirmarBorrado(false)}>
                Cancelar
              </button>
              <button type="button" className="btn peligro lleno crece" onClick={borrar} disabled={ocupado}>
                Sí, borrar
              </button>
            </div>
          ) : (
            <button type="button" className="btn peligro bloque" onClick={() => setConfirmarBorrado(true)}>
              Borrar gasto
            </button>
          ))}
      </form>
    </div>
  );
}

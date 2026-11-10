import { useState } from 'react';
import { api } from '../api';
import { Estado } from '../componentes/Campos';
import { ListaGastos } from '../componentes/ListaGastos';
import { useRegistro } from '../componentes/Marco';
import { useCarga } from '../contexto';
import { diaSemana, fechaRelativa, hoy, limitesDelMes, mayuscula, mesYAnio, pesos, pesosCorto, sumarDias, sumarMeses } from '../formato';
import { IconoDerecha, IconoIzquierda } from '../iconos';
import type { Rango } from '../tipos';

const DIAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const DIAS_LARGOS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

export function Calendario() {
  const h = hoy();
  const { anotar, editar } = useRegistro();
  const [mes, setMes] = useState(h.slice(0, 7)); // YYYY-MM
  const [elegido, setElegido] = useState(h);
  const { desde, hasta } = limitesDelMes(`${mes}-01`);
  const { datos, error, reintentar } = useCarga(() => api.get<Rango>(`/gastos?desde=${desde}&hasta=${hasta}`), [mes]);

  function cambiarMes(delta: number) {
    const nuevo = sumarMeses(`${mes}-01`, delta).slice(0, 7);
    setMes(nuevo);
    setElegido(nuevo === h.slice(0, 7) ? h : `${nuevo}-01`);
  }

  const dias: string[] = [];
  for (let f = desde; f <= hasta; f = sumarDias(f, 1)) dias.push(f);
  const esMesActual = mes === h.slice(0, 7);
  const delDia = datos?.gastos.filter((g) => g.fecha === elegido) ?? [];

  return (
    <>
      <div className="cabecera">
        <h1>Calendario</h1>
      </div>
      <div className="fila entre">
        <button type="button" className="icono-btn" onClick={() => cambiarMes(-1)} aria-label="Mes anterior">
          <IconoIzquierda />
        </button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 650 }}>{mayuscula(mesYAnio(desde))}</div>
          <div className="tenue num">{datos ? `Total: ${pesos(datos.total)}` : ' '}</div>
        </div>
        <button type="button" className="icono-btn" onClick={() => cambiarMes(1)} disabled={esMesActual} aria-label="Mes siguiente">
          <IconoDerecha />
        </button>
      </div>

      {!datos ? (
        <Estado error={error} reintentar={reintentar} />
      ) : (
        <>
          <div className="cal">
            {DIAS.map((d, i) => (
              <div key={DIAS_LARGOS[i]} className="dia-nombre" title={DIAS_LARGOS[i]}>
                {d}
              </div>
            ))}
            {Array.from({ length: diaSemana(desde) }, (_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: celdas vacías de relleno, sin identidad
              <span key={`hueco-${i}`} />
            ))}
            {dias.map((f) => {
              const total = datos.por_dia[f] ?? 0;
              const clases = [total > 0 && 'con-gasto', f === h && 'hoy'].filter(Boolean).join(' ');
              return (
                <button
                  key={f}
                  type="button"
                  className={clases || undefined}
                  aria-pressed={f === elegido}
                  aria-label={`${fechaRelativa(f)}: ${total > 0 ? pesos(total) : 'sin gastos'}`}
                  disabled={f > h}
                  onClick={() => setElegido(f)}
                >
                  <span className="n">{Number(f.slice(8))}</span>
                  <span className="t num">{total > 0 ? pesosCorto(total).replace('$', '') : ' '}</span>
                </button>
              );
            })}
          </div>

          <section className="tarjeta">
            <div className="fila entre" style={{ marginBottom: 8 }}>
              <div>
                <h2>{fechaRelativa(elegido)}</h2>
                <div className="tenue num">{pesos(datos.por_dia[elegido] ?? 0)}</div>
              </div>
              <button type="button" className="btn chico" onClick={() => anotar(elegido)}>
                + Anotar aquí
              </button>
            </div>
            {delDia.length ? <ListaGastos gastos={delDia} alTocar={editar} /> : <div className="vacio">Sin gastos este día.</div>}
          </section>
        </>
      )}
    </>
  );
}

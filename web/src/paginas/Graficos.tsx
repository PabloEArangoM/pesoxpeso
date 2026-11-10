import { useMemo, useState } from 'react';
import { api } from '../api';
import { Estado } from '../componentes/Campos';
import { BarrasH, Columnas, type DatoColumna } from '../componentes/Graficos';
import { useCarga, useDatos } from '../contexto';
import { diaSemana, fechaCorta, fechaLarga, hoy, limitesDelMes, lunesDe, mayuscula, pesos, sumarDias, sumarMeses } from '../formato';
import type { Rango } from '../tipos';

type Periodo = 'mes' | 'mes-pasado' | '7' | '30' | '90';
const PERIODOS: Array<[Periodo, string]> = [
  ['mes', 'Este mes'],
  ['mes-pasado', 'Mes pasado'],
  ['7', '7 días'],
  ['30', '30 días'],
  ['90', '90 días'],
];

function limites(p: Periodo): { desde: string; hasta: string } {
  const h = hoy();
  if (p === 'mes') return { desde: limitesDelMes(h).desde, hasta: h };
  if (p === 'mes-pasado') return limitesDelMes(sumarMeses(h, -1));
  return { desde: sumarDias(h, -(Number(p) - 1)), hasta: h };
}

/** Hasta 31 días se muestra una columna por día; más que eso, una por semana. */
function columnas(r: Rango): { datos: DatoColumna[]; porSemana: boolean } {
  const fechas = Object.keys(r.por_dia).sort();
  if (fechas.length <= 31) {
    const cada = fechas.length <= 10 ? 1 : 5;
    return {
      porSemana: false,
      datos: fechas.map((f, i) => ({
        clave: f,
        rotulo: fechas.length <= 10 ? 'LMXJVSD'[diaSemana(f)] : i % cada === 0 ? String(Number(f.slice(8))) : '',
        titulo: mayuscula(fechaLarga(f)),
        valor: r.por_dia[f],
      })),
    };
  }
  const semanas = new Map<string, number>();
  for (const f of fechas) semanas.set(lunesDe(f), (semanas.get(lunesDe(f)) ?? 0) + r.por_dia[f]);
  const claves = [...semanas.keys()];
  return {
    porSemana: true,
    datos: claves.map((lunes, i) => ({
      clave: lunes,
      rotulo: i % 2 === 0 ? fechaCorta(lunes) : '',
      titulo: `Semana del ${fechaCorta(lunes)}`,
      valor: semanas.get(lunes) ?? 0,
    })),
  };
}

export function Graficos() {
  const { categorias } = useDatos();
  const [periodo, setPeriodo] = useState<Periodo>('mes');
  const [tabla, setTabla] = useState(false);
  const { desde, hasta } = limites(periodo);
  const { datos, error, reintentar } = useCarga(() => api.get<Rango>(`/gastos?desde=${desde}&hasta=${hasta}`), [desde, hasta]);

  const porCategoria = useMemo(
    () =>
      Object.entries(datos?.por_categoria ?? {})
        .map(([nombre, valor]) => ({ nombre, valor, icono: categorias.find((c) => c.nombre === nombre)?.icono }))
        .sort((a, b) => b.valor - a.valor),
    [datos, categorias],
  );
  const cols = useMemo(() => (datos ? columnas(datos) : null), [datos]);
  const diasConGasto = datos ? Object.values(datos.por_dia).filter((v) => v > 0).length : 0;
  const dias = datos ? Object.keys(datos.por_dia).length : 1;

  return (
    <>
      <div className="cabecera">
        <h1>Gráficos</h1>
      </div>
      <div className="segmentos" role="group" aria-label="Periodo">
        {PERIODOS.map(([p, texto]) => (
          <button key={p} type="button" aria-pressed={periodo === p} onClick={() => setPeriodo(p)}>
            {texto}
          </button>
        ))}
      </div>

      {!datos || !cols ? (
        <Estado error={error} reintentar={reintentar} />
      ) : (
        <>
          <section className="cifras" aria-label="Resumen del periodo">
            <div className="cifra principal">
              <div className="rotulo">
                Gastaste del {fechaCorta(desde)} al {fechaCorta(hasta)}
              </div>
              <div className="valor num">{pesos(datos.total)}</div>
            </div>
            <div className="cifra">
              <div className="rotulo">Promedio por día</div>
              <div className="valor num">{pesos(Math.round(datos.total / dias))}</div>
            </div>
            <div className="cifra" style={{ gridColumn: 'span 2' }}>
              <div className="rotulo">Días con gastos</div>
              <div className="valor num">
                {diasConGasto} de {dias}
              </div>
            </div>
          </section>

          {datos.total === 0 ? (
            <div className="tarjeta vacio">
              <span className="emoji" aria-hidden>
                📊
              </span>
              No hay gastos en este periodo.
            </div>
          ) : (
            <>
              <div className="fila entre">
                <span className="tenue">{tabla ? 'Viendo los datos en tabla' : 'Toca una barra para ver el detalle'}</span>
                <button type="button" className="btn chico" aria-pressed={tabla} onClick={() => setTabla(!tabla)}>
                  {tabla ? 'Ver gráficos' : 'Ver como tabla'}
                </button>
              </div>

              <section className="tarjeta">
                <h2>En qué se fue la plata</h2>
                {tabla ? (
                  <table className="datos">
                    <thead>
                      <tr>
                        <th>Categoría</th>
                        <th>Parte</th>
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {porCategoria.map((c) => (
                        <tr key={c.nombre}>
                          <td>
                            {c.icono} {c.nombre}
                          </td>
                          <td className="num">{Math.round((c.valor / datos.total) * 100)}%</td>
                          <td className="num">{pesos(c.valor)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <BarrasH datos={porCategoria} />
                )}
              </section>

              <section className="tarjeta">
                <h2>{cols.porSemana ? 'Gasto por semana' : 'Gasto por día'}</h2>
                {tabla ? (
                  <table className="datos">
                    <thead>
                      <tr>
                        <th>{cols.porSemana ? 'Semana' : 'Día'}</th>
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cols.datos.map((d) => (
                        <tr key={d.clave}>
                          <td>{d.titulo}</td>
                          <td className="num">{pesos(d.valor)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <Columnas datos={cols.datos} />
                )}
              </section>
            </>
          )}
        </>
      )}
    </>
  );
}

import { type MouseEvent, type ReactNode, useState } from 'react';
import { pesos, pesosCorto } from '../formato';
import type { Presupuesto } from '../tipos';

// ---------- Globo flotante compartido ----------

interface Globo {
  x: number;
  y: number;
  titulo: string;
  detalle: string;
}

function useGlobo() {
  const [globo, setGlobo] = useState<Globo | null>(null);
  const sobre = (titulo: string, detalle: string) => ({
    onMouseMove: (e: MouseEvent) => setGlobo({ x: e.clientX, y: e.clientY, titulo, detalle }),
    onMouseLeave: () => setGlobo(null),
    // En pantallas táctiles: tocar muestra el dato sobre la marca.
    onClick: (e: MouseEvent) => {
      const r = e.currentTarget.getBoundingClientRect();
      setGlobo({ x: r.left + r.width / 2, y: r.top, titulo, detalle });
    },
  });
  const nodo: ReactNode = globo && (
    <div className="globo" style={{ left: Math.min(Math.max(globo.x, 80), window.innerWidth - 80), top: Math.max(globo.y, 60) }}>
      <b>{globo.titulo}</b>
      {globo.detalle}
    </div>
  );
  return { sobre, nodo };
}

// ---------- Barras horizontales: cuánto por categoría ----------

export interface DatoBarra {
  nombre: string;
  icono?: string;
  valor: number;
}

/** Una sola serie (un color); cada barra lleva su valor en la punta. */
export function BarrasH({ datos }: { datos: DatoBarra[] }) {
  const { sobre, nodo } = useGlobo();
  const max = Math.max(...datos.map((d) => d.valor), 1);
  const total = datos.reduce((s, d) => s + d.valor, 0) || 1;
  return (
    <div className="barras" role="list">
      {datos.map((d) => (
        <div
          key={d.nombre}
          className="fila-b"
          role="listitem"
          aria-label={`${d.nombre}: ${pesos(d.valor)}`}
          {...sobre(d.nombre, `${pesos(d.valor)} · ${Math.round((d.valor / total) * 100)}% del total`)}
        >
          <span className="rot">
            {d.icono && <span aria-hidden>{d.icono} </span>}
            {d.nombre}
          </span>
          <span className="carril">
            <span className="barra" style={{ width: `${(d.valor / max) * 70}%` }} />
            <span className="val num">{pesos(d.valor)}</span>
          </span>
        </div>
      ))}
      {nodo}
    </div>
  );
}

// ---------- Columnas: cuánto por día o por semana ----------

export interface DatoColumna {
  clave: string;
  /** texto del eje X; vacío = sin rótulo en esa posición */
  rotulo: string;
  /** título del globo, p. ej. "Martes 10 de noviembre" */
  titulo: string;
  valor: number;
}

/** Tope del eje redondeado a 1, 2 o 5 × 10ⁿ para que las marcas sean números limpios. */
function escala(max: number): { tope: number; marcas: number[] } {
  if (max <= 0) return { tope: 1000, marcas: [0, 500, 1000] };
  const bruto = max / 3; // apunta a unas cuatro marcas
  const potencia = 10 ** Math.floor(Math.log10(bruto));
  const paso = [1, 2, 5, 10].map((m) => m * potencia).find((p) => p >= bruto) ?? 10 * potencia;
  const tope = Math.ceil(max / paso) * paso;
  const marcas: number[] = [];
  for (let v = 0; v <= tope; v += paso) marcas.push(v);
  return { tope, marcas };
}

export function Columnas({ datos }: { datos: DatoColumna[] }) {
  const { sobre, nodo } = useGlobo();
  const { tope, marcas } = escala(Math.max(...datos.map((d) => d.valor), 0));
  return (
    <div className="columnas">
      <div className="eje-y num" aria-hidden>
        {marcas.map((m) => (
          <span key={m}>{pesosCorto(m)}</span>
        ))}
      </div>
      <div className="lienzo">
        <div className="rejilla" aria-hidden>
          {[...marcas].reverse().map((m) => (
            <i key={m} />
          ))}
        </div>
        <div className="cols" role="list">
          {datos.map((d) => (
            <div key={d.clave} className="col" role="listitem" aria-label={`${d.titulo}: ${pesos(d.valor)}`} {...sobre(d.titulo, pesos(d.valor))}>
              {d.valor > 0 && <div className="marca" style={{ height: `${Math.max((d.valor / tope) * 100, 1.5)}%` }} />}
            </div>
          ))}
        </div>
      </div>
      <div className="eje-x" aria-hidden>
        {datos.map((d) => (
          <span key={d.clave}>{d.rotulo}</span>
        ))}
      </div>
      {nodo}
    </div>
  );
}

// ---------- Medidor de presupuesto ----------

const ESTADOS = {
  ok: { icono: '✓', texto: 'Vas bien' },
  cerca: { icono: '⚠', texto: 'Cerca del tope' },
  excedido: { icono: '⛔', texto: 'Te pasaste' },
} as const;

/** El color indica el estado, pero siempre va acompañado de icono y texto. */
export function Medidor({ titulo, p }: { titulo: string; p: Presupuesto }) {
  const e = ESTADOS[p.estado];
  return (
    <div className="medidor" data-estado={p.estado}>
      <div className="fila entre">
        <span style={{ fontWeight: 600 }}>{titulo}</span>
        <span className="estado">
          <span aria-hidden>{e.icono}</span> {e.texto}
        </span>
      </div>
      <div
        className="pista"
        role="progressbar"
        aria-label={`Presupuesto ${titulo.toLowerCase()}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(p.porcentaje, 100)}
        aria-valuetext={`${p.porcentaje}%: ${pesos(p.gastado)} de ${pesos(p.monto)}`}
      >
        <div className="lleno" style={{ width: `${Math.min(p.porcentaje, 100)}%` }} />
      </div>
      <div className="fila entre tenue num">
        <span>
          {pesos(p.gastado)} de {pesos(p.monto)}
        </span>
        <span>{p.restante >= 0 ? `Quedan ${pesos(p.restante)}` : `${pesos(-p.restante)} de más`}</span>
      </div>
    </div>
  );
}

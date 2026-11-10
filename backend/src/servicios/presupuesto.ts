import { query } from '../db';
import type { Totales } from './totales';

export type Periodo = 'semanal' | 'mensual';
export type EstadoPresupuesto = 'ok' | 'cerca' | 'excedido';

export interface Presupuesto {
  monto: number;
  gastado: number;
  restante: number; // negativo si ya se pasó
  porcentaje: number; // entero; puede superar 100
  estado: EstadoPresupuesto;
}

/** Desde este porcentaje se avisa que el presupuesto está por agotarse. */
export const UMBRAL_CERCA = 80;

function calcular(monto: number, gastado: number): Presupuesto {
  const porcentaje = Math.round((gastado / monto) * 100);
  const estado: EstadoPresupuesto = gastado >= monto ? 'excedido' : porcentaje >= UMBRAL_CERCA ? 'cerca' : 'ok';
  return { monto, gastado, restante: monto - gastado, porcentaje, estado };
}

export async function estadoPresupuesto(
  usuarioId: string,
  t: Totales,
): Promise<Record<Periodo, Presupuesto | null>> {
  const r = await query<{ periodo: Periodo; monto: number }>(
    `SELECT periodo, monto FROM presupuestos WHERE usuario_id = $1`,
    [usuarioId],
  );
  const de = (p: Periodo) => r.rows.find((x) => x.periodo === p)?.monto;
  const semanal = de('semanal');
  const mensual = de('mensual');
  return {
    semanal: semanal ? calcular(semanal, t.total_semana) : null,
    mensual: mensual ? calcular(mensual, t.total_mes) : null,
  };
}

const pesos = (n: number) => `$${Math.abs(n).toLocaleString('es-CO')}`;

/** Frases cortas para la notificación del Atajo y el aviso de la app. */
export function alertasDePresupuesto(p: Record<Periodo, Presupuesto | null>): string[] {
  const alertas: string[] = [];
  for (const periodo of ['semanal', 'mensual'] as const) {
    const x = p[periodo];
    if (!x || x.estado === 'ok') continue;
    alertas.push(
      x.estado === 'excedido'
        ? x.restante === 0
          ? `Llegaste al tope de tu presupuesto ${periodo} (${pesos(x.monto)}).`
          : `Te pasaste ${pesos(x.restante)} de tu presupuesto ${periodo}.`
        : `Llevas el ${x.porcentaje}% de tu presupuesto ${periodo}; te quedan ${pesos(x.restante)}.`,
    );
  }
  return alertas;
}

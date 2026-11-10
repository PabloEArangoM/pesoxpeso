import { query } from '../db';
import { diasEntre, sumarDias } from '../util/fecha';

export interface Racha {
  actual: number; // días seguidos registrando, contando hoy o hasta ayer
  mejor: number;
  registro_hoy: boolean;
}

/**
 * La racha mide el hábito de anotar, así que solo cuentan los gastos que el usuario
 * registró a mano: los creados por un gasto recurrente no la alimentan.
 */
export async function calcularRacha(usuarioId: string, hoy: string): Promise<Racha> {
  const r = await query<{ fecha: string }>(
    `SELECT DISTINCT fecha FROM gastos
      WHERE usuario_id = $1 AND recurrente_id IS NULL AND fecha <= $2
      ORDER BY fecha DESC`,
    [usuarioId, hoy],
  );
  const fechas = r.rows.map((x) => x.fecha);
  if (fechas.length === 0) return { actual: 0, mejor: 0, registro_hoy: false };

  const registroHoy = fechas[0] === hoy;
  // Si hoy aún no hay registro la racha sigue viva mientras ayer sí lo haya.
  let actual = 0;
  if (registroHoy || fechas[0] === sumarDias(hoy, -1)) {
    actual = 1;
    while (actual < fechas.length && diasEntre(fechas[actual], fechas[actual - 1]) === 1) actual++;
  }

  let mejor = 1;
  let corrida = 1;
  for (let i = 1; i < fechas.length; i++) {
    corrida = diasEntre(fechas[i], fechas[i - 1]) === 1 ? corrida + 1 : 1;
    if (corrida > mejor) mejor = corrida;
  }
  return { actual, mejor: Math.max(mejor, actual), registro_hoy: registroHoy };
}

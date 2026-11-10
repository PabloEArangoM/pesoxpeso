import { withTx } from '../db';
import { diasEntre, hoyBogota, sumarDias, sumarMeses } from '../util/fecha';

export type Frecuencia = 'diaria' | 'semanal' | 'mensual';

/** La fecha que sigue a `actual` en la serie que empezó en `inicio`. */
export function siguienteFecha(frecuencia: Frecuencia, inicio: string, actual: string): string {
  if (frecuencia === 'diaria') return sumarDias(actual, 1);
  if (frecuencia === 'semanal') return sumarDias(actual, 7);
  // Mensual: se cuenta desde `inicio` para no perder el día (31 -> 28 -> 31, no 31 -> 28 -> 28).
  const [a1, m1] = inicio.split('-').map(Number);
  const [a2, m2] = actual.split('-').map(Number);
  return sumarMeses(inicio, (a2 - a1) * 12 + (m2 - m1) + 1);
}

/** Primera fecha de la serie que cae en `desde` o después (para reanudar sin crear atrasados). */
export function primeraFechaDesde(frecuencia: Frecuencia, inicio: string, desde: string): string {
  if (inicio >= desde) return inicio;
  if (frecuencia === 'diaria') return desde;
  if (frecuencia === 'semanal') return sumarDias(inicio, Math.ceil(diasEntre(inicio, desde) / 7) * 7);
  let f = inicio;
  while (f < desde) f = siguienteFecha('mensual', inicio, f);
  return f;
}

/** Tope de gastos creados de una vez por cada recurrente (algo más de un año de diarios). */
const MAX_POR_PASADA = 400;

/**
 * Crea los gastos que ya tocaban (proxima_fecha <= hoy) y avanza cada recurrente.
 * Se llama al consultar gastos o el resumen y cada hora desde el servidor.
 * Es seguro llamarla en paralelo: cada fila se bloquea y las ya tomadas se saltan.
 */
export async function generarRecurrentes(usuarioId?: string, hoy = hoyBogota()): Promise<number> {
  return withTx(async (client) => {
    const pendientes = await client.query<{
      id: string;
      usuario_id: string;
      categoria_id: string;
      monto: number;
      nota: string;
      frecuencia: Frecuencia;
      inicio: string;
      proxima_fecha: string;
    }>(
      `SELECT id, usuario_id, categoria_id, monto, nota, frecuencia, inicio, proxima_fecha
         FROM gastos_recurrentes
        WHERE activo AND proxima_fecha <= $1 AND ($2::uuid IS NULL OR usuario_id = $2)
        FOR UPDATE SKIP LOCKED`,
      [hoy, usuarioId ?? null],
    );
    let creados = 0;
    for (const r of pendientes.rows) {
      let f = r.proxima_fecha;
      for (let i = 0; f <= hoy && i < MAX_POR_PASADA; i++) {
        await client.query(
          `INSERT INTO gastos (usuario_id, categoria_id, monto, fecha, hora, nota, recurrente_id)
           VALUES ($1, $2, $3, $4, '00:00', $5, $6)`,
          [r.usuario_id, r.categoria_id, r.monto, f, r.nota, r.id],
        );
        creados++;
        f = siguienteFecha(r.frecuencia, r.inicio, f);
      }
      await client.query(`UPDATE gastos_recurrentes SET proxima_fecha = $1 WHERE id = $2`, [f, r.id]);
    }
    return creados;
  });
}

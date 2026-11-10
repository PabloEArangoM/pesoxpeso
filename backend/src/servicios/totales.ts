import { query } from '../db';

export interface Totales {
  total_dia: number;
  total_semana: number;
  total_mes: number;
}

/** Totales del día, de la semana (lunes a domingo) y del mes a los que pertenece `dia`. */
export async function totales(usuarioId: string, dia: string): Promise<Totales> {
  // SUM de integer es bigint y pg lo entrega como texto: se convierte aquí en vez de
  // forzar ::int en SQL, que desbordaría (error 500) con totales sobre ~2.147 millones.
  const r = await query<{ dia: string; semana: string; mes: string }>(
    `SELECT
       COALESCE(SUM(monto) FILTER (WHERE fecha = $2::date), 0) AS dia,
       COALESCE(SUM(monto) FILTER (
         WHERE fecha >= date_trunc('week', $2::date)::date
           AND fecha <  date_trunc('week', $2::date)::date + 7), 0) AS semana,
       COALESCE(SUM(monto) FILTER (
         WHERE fecha >= date_trunc('month', $2::date)::date
           AND fecha <  (date_trunc('month', $2::date) + interval '1 month')::date), 0) AS mes
     FROM gastos WHERE usuario_id = $1`,
    [usuarioId, dia],
  );
  const f = r.rows[0];
  return { total_dia: Number(f.dia), total_semana: Number(f.semana), total_mes: Number(f.mes) };
}

import { query } from '../db';
import { log } from '../log';
import { enviarPush, pushConfigurado, type Suscripcion } from '../push';
import { horaBogota, hoyBogota } from '../util/fecha';

/**
 * Avisa a quien activó el recordatorio, ya pasó su hora y hoy todavía no ha anotado nada.
 * Máximo un aviso por usuario al día. El servidor la ejecuta cada minuto.
 */
export async function enviarRecordatorios(ahora = new Date()): Promise<number> {
  if (!pushConfigurado()) return 0;
  const hoy = hoyBogota(ahora);

  // Marcar y seleccionar en una sola sentencia evita avisos duplicados si corren dos instancias.
  const r = await query<{ id: string }>(
    `UPDATE usuarios u SET ultimo_recordatorio = $1
      WHERE u.recordatorio_activo
        AND u.recordatorio_hora <= $2::time
        AND (u.ultimo_recordatorio IS NULL OR u.ultimo_recordatorio < $1)
        AND EXISTS (SELECT 1 FROM push_suscripciones s WHERE s.usuario_id = u.id)
        AND NOT EXISTS (
          SELECT 1 FROM gastos g
           WHERE g.usuario_id = u.id AND g.fecha = $1 AND g.recurrente_id IS NULL)
      RETURNING u.id`,
    [hoy, horaBogota(ahora)],
  );

  let enviados = 0;
  for (const { id } of r.rows) {
    const subs = await query<Suscripcion & { id: string }>(
      `SELECT id, endpoint, p256dh, auth FROM push_suscripciones WHERE usuario_id = $1`,
      [id],
    );
    for (const s of subs.rows) {
      try {
        const resultado = await enviarPush(s, {
          titulo: 'PesoXPeso',
          cuerpo: '¿Gastaste algo hoy? Anótalo en 10 segundos.',
          url: '/?nuevo=1',
        });
        if (resultado === 'caducada') await query(`DELETE FROM push_suscripciones WHERE id = $1`, [s.id]);
        else enviados++;
      } catch (e) {
        log.error({ err: e, usuario_id: id }, 'no se pudo enviar el recordatorio');
      }
    }
  }
  return enviados;
}

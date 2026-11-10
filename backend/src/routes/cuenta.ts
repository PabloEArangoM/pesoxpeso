import { Router } from 'express';
import { z } from 'zod';
import { autenticar, soloJwt } from '../auth/middleware';
import { config } from '../config';
import { query } from '../db';
import { AppError } from '../errors';
import { esEndpointPushValido, pushConfigurado } from '../push';

export const cuentaRouter = Router();
cuentaRouter.use(autenticar, soloJwt);

const COLUMNAS = `id, email, nombre, email_verificado, recordatorio_activo, recordatorio_hora, creado_en`;

function formatear(u: any) {
  return {
    ...u,
    recordatorio_hora: String(u.recordatorio_hora).slice(0, 5),
    // Sin llaves VAPID en el servidor la app no ofrece activar notificaciones.
    push: { disponible: pushConfigurado(), clave_publica: config.vapidPublicKey ?? null },
  };
}

const noExiste = () => new AppError(401, 'NO_AUTENTICADO', 'Falta o es inválido el token de autenticación');

cuentaRouter.get('/', async (req, res) => {
  const r = await query(`SELECT ${COLUMNAS} FROM usuarios WHERE id = $1`, [req.userId]);
  if (!r.rows[0]) throw noExiste();
  res.json(formatear(r.rows[0]));
});

const editarSchema = z.object({
  nombre: z.string().trim().min(1).max(80).nullable().optional(),
  recordatorio_activo: z.boolean().optional(),
  recordatorio_hora: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'formato inválido, usa HH:MM')
    .optional(),
});

cuentaRouter.patch('/', async (req, res) => {
  const cambios = editarSchema.parse(req.body);
  const sets: string[] = [];
  const params: unknown[] = [];
  for (const [col, valor] of Object.entries(cambios)) {
    if (valor === undefined) continue;
    params.push(valor);
    sets.push(`${col} = $${params.length}`); // las columnas salen del esquema, no del cliente
  }
  if (sets.length === 0) throw new AppError(400, 'VALIDACION', 'No enviaste ningún campo para actualizar');
  params.push(req.userId);
  const r = await query(
    `UPDATE usuarios SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING ${COLUMNAS}`,
    params,
  );
  if (!r.rows[0]) throw noExiste();
  res.json(formatear(r.rows[0]));
});

// ---- Notificaciones push de este navegador ----

const suscripcionSchema = z.object({
  endpoint: z.string().max(1000).refine(esEndpointPushValido, 'servicio de notificaciones no reconocido'),
  keys: z.object({ p256dh: z.string().min(10).max(300), auth: z.string().min(10).max(100) }),
});

cuentaRouter.post('/push', async (req, res) => {
  if (!pushConfigurado()) throw new AppError(503, 'PUSH_NO_DISPONIBLE', 'Las notificaciones no están configuradas en el servidor');
  const s = suscripcionSchema.parse(req.body);
  // El mismo navegador puede cambiar de cuenta: la suscripción pasa al usuario actual.
  await query(
    `INSERT INTO push_suscripciones (usuario_id, endpoint, p256dh, auth) VALUES ($1, $2, $3, $4)
     ON CONFLICT (endpoint) DO UPDATE SET usuario_id = EXCLUDED.usuario_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth`,
    [req.userId, s.endpoint, s.keys.p256dh, s.keys.auth],
  );
  res.status(204).end();
});

cuentaRouter.delete('/push', async (req, res) => {
  const { endpoint } = z.object({ endpoint: z.string().max(1000) }).parse(req.body ?? {});
  await query(`DELETE FROM push_suscripciones WHERE endpoint = $1 AND usuario_id = $2`, [endpoint, req.userId]);
  res.status(204).end();
});

import { Router } from 'express';
import { z } from 'zod';
import { autenticar, soloJwt } from '../auth/middleware';
import { query } from '../db';
import { AppError, noEncontrado } from '../errors';
import { resolverCategoria } from '../servicios/categorias';
import { type Frecuencia, generarRecurrentes, primeraFechaDesde } from '../servicios/recurrentes';
import { hoyBogota } from '../util/fecha';
import { categoriaId, categoriaNombre, esUuid, fecha, monto, nota } from '../validacion';

export const recurrentesRouter = Router();
recurrentesRouter.use(autenticar, soloJwt);

const MAX_RECURRENTES = 30;
const frecuencia = z.enum(['diaria', 'semanal', 'mensual']);

const SELECT = `r.id, r.monto, r.categoria_id, c.nombre AS categoria, c.icono, r.nota,
  r.frecuencia, r.inicio, r.proxima_fecha, r.activo`;

async function uno(id: string, usuarioId: string) {
  const r = await query(
    `SELECT ${SELECT} FROM gastos_recurrentes r JOIN categorias c ON c.id = r.categoria_id
      WHERE r.id = $1 AND r.usuario_id = $2`,
    [id, usuarioId],
  );
  return r.rows[0];
}

recurrentesRouter.get('/', async (req, res) => {
  const r = await query(
    `SELECT ${SELECT} FROM gastos_recurrentes r JOIN categorias c ON c.id = r.categoria_id
      WHERE r.usuario_id = $1 ORDER BY r.activo DESC, r.proxima_fecha, r.creado_en`,
    [req.userId],
  );
  res.json(r.rows);
});

const crearSchema = z
  .object({
    monto,
    categoria_id: categoriaId,
    categoria: categoriaNombre,
    frecuencia,
    inicio: fecha, // primera vez que se cobra; por defecto hoy
    nota: nota.default(''),
  })
  .refine((d) => d.categoria_id || d.categoria, { message: 'envía categoria_id o categoria', path: ['categoria'] });

recurrentesRouter.post('/', async (req, res) => {
  const d = crearSchema.parse(req.body);
  const hoy = hoyBogota();
  const inicio = d.inicio ?? hoy;
  // No se crean gastos hacia atrás: los días pasados se anotan a mano.
  if (inicio < hoy) throw new AppError(400, 'VALIDACION', 'inicio: no puede ser una fecha pasada');

  const cuantos = await query(`SELECT count(*)::int AS n FROM gastos_recurrentes WHERE usuario_id = $1`, [req.userId]);
  if (cuantos.rows[0].n >= MAX_RECURRENTES) {
    throw new AppError(409, 'LIMITE_RECURRENTES', `Puedes tener hasta ${MAX_RECURRENTES} gastos recurrentes`);
  }
  const catId = await resolverCategoria(req.userId!, d.categoria_id, d.categoria);
  const r = await query<{ id: string }>(
    `INSERT INTO gastos_recurrentes (usuario_id, categoria_id, monto, nota, frecuencia, inicio, proxima_fecha)
     VALUES ($1, $2, $3, $4, $5, $6, $6) RETURNING id`,
    [req.userId, catId, d.monto, d.nota, d.frecuencia, inicio],
  );
  await generarRecurrentes(req.userId); // si empieza hoy, el primer gasto queda creado ya
  res.status(201).json(await uno(r.rows[0].id, req.userId!));
});

const editarSchema = z.object({
  monto: monto.optional(),
  categoria_id: categoriaId,
  categoria: categoriaNombre,
  nota: nota.optional(),
  activo: z.boolean().optional(),
});

recurrentesRouter.patch('/:id', async (req, res) => {
  const id = String(req.params.id);
  if (!esUuid(id)) throw noEncontrado('Gasto recurrente no encontrado');
  const d = editarSchema.parse(req.body);
  const actual = await query<{ frecuencia: Frecuencia; inicio: string; activo: boolean }>(
    `SELECT frecuencia, inicio, activo FROM gastos_recurrentes WHERE id = $1 AND usuario_id = $2`,
    [id, req.userId],
  );
  if (!actual.rows[0]) throw noEncontrado('Gasto recurrente no encontrado');

  const sets: string[] = [];
  const params: unknown[] = [];
  const agregar = (col: string, valor: unknown) => {
    params.push(valor);
    sets.push(`${col} = $${params.length}`);
  };
  if (d.monto !== undefined) agregar('monto', d.monto);
  if (d.categoria_id || d.categoria) {
    agregar('categoria_id', await resolverCategoria(req.userId!, d.categoria_id, d.categoria));
  }
  if (d.nota !== undefined) agregar('nota', d.nota);
  if (d.activo !== undefined) {
    agregar('activo', d.activo);
    // Al reanudar se salta lo que quedó en pausa: sigue desde la próxima fecha que toque.
    if (d.activo && !actual.rows[0].activo) {
      agregar('proxima_fecha', primeraFechaDesde(actual.rows[0].frecuencia, actual.rows[0].inicio, hoyBogota()));
    }
  }
  if (sets.length === 0) throw new AppError(400, 'VALIDACION', 'No enviaste ningún campo para actualizar');

  params.push(id, req.userId);
  await query(
    `UPDATE gastos_recurrentes SET ${sets.join(', ')} WHERE id = $${params.length - 1} AND usuario_id = $${params.length}`,
    params,
  );
  await generarRecurrentes(req.userId);
  res.json(await uno(id, req.userId!));
});

// Los gastos que ya generó se conservan; solo deja de crear nuevos.
recurrentesRouter.delete('/:id', async (req, res) => {
  const id = String(req.params.id);
  if (!esUuid(id)) throw noEncontrado('Gasto recurrente no encontrado');
  const r = await query(`DELETE FROM gastos_recurrentes WHERE id = $1 AND usuario_id = $2`, [id, req.userId]);
  if (!r.rowCount) throw noEncontrado('Gasto recurrente no encontrado');
  res.status(204).end();
});

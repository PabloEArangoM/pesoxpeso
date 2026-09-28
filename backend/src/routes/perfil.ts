import { Router } from 'express';
import { z } from 'zod';
import { autenticar, soloJwt } from '../auth/middleware';
import { query } from '../db';
import { AppError, noEncontrado } from '../errors';

export const perfilRouter = Router();
perfilRouter.use(autenticar, soloJwt);

const base = z.object({
  ocupacion: z.enum(['estudiante', 'medio_tiempo', 'freelance', 'otro']),
  tipo_ingreso: z.enum(['mesada', 'salario', 'mixto', 'variable']),
  ingreso_estimado: z.number().int().min(0).max(1_000_000_000).nullable().optional(),
  gastos_fijos: z.record(z.string().min(1).max(60), z.number().int().min(0).max(1_000_000_000)),
});
// El default va solo al crear; en PATCH un campo ausente no debe pisar lo guardado.
const crearSchema = base.extend({ gastos_fijos: base.shape.gastos_fijos.default({}) });
const editarSchema = base.partial();

const COLUMNAS = `id, usuario_id, ocupacion, tipo_ingreso, ingreso_estimado, gastos_fijos`;

perfilRouter.post('/', async (req, res) => {
  const p = crearSchema.parse(req.body);
  try {
    const r = await query(
      `INSERT INTO perfil_financiero (usuario_id, ocupacion, tipo_ingreso, ingreso_estimado, gastos_fijos)
       VALUES ($1, $2, $3, $4, $5) RETURNING ${COLUMNAS}`,
      [req.userId, p.ocupacion, p.tipo_ingreso, p.ingreso_estimado ?? null, JSON.stringify(p.gastos_fijos)],
    );
    res.status(201).json(r.rows[0]);
  } catch (e: any) {
    if (e?.code === '23505') throw new AppError(409, 'PERFIL_EXISTENTE', 'El perfil ya existe; usa PATCH para actualizarlo');
    throw e;
  }
});

perfilRouter.get('/', async (req, res) => {
  const r = await query(`SELECT ${COLUMNAS} FROM perfil_financiero WHERE usuario_id = $1`, [req.userId]);
  if (!r.rows[0]) throw noEncontrado('Aún no has creado tu perfil');
  res.json(r.rows[0]);
});

perfilRouter.patch('/', async (req, res) => {
  const cambios = editarSchema.parse(req.body);
  if (Object.keys(cambios).length === 0) throw new AppError(400, 'VALIDACION', 'No enviaste ningún campo para actualizar');

  const sets: string[] = [];
  const params: unknown[] = [];
  const agregar = (col: string, valor: unknown) => {
    params.push(valor);
    sets.push(`${col} = $${params.length}`);
  };
  if (cambios.ocupacion !== undefined) agregar('ocupacion', cambios.ocupacion);
  if (cambios.tipo_ingreso !== undefined) agregar('tipo_ingreso', cambios.tipo_ingreso);
  if (cambios.ingreso_estimado !== undefined) agregar('ingreso_estimado', cambios.ingreso_estimado);
  if (cambios.gastos_fijos !== undefined) agregar('gastos_fijos', JSON.stringify(cambios.gastos_fijos));

  params.push(req.userId);
  const r = await query(
    `UPDATE perfil_financiero SET ${sets.join(', ')} WHERE usuario_id = $${params.length} RETURNING ${COLUMNAS}`,
    params,
  );
  if (!r.rows[0]) throw noEncontrado('Aún no has creado tu perfil');
  res.json(r.rows[0]);
});

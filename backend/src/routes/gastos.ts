import { Router } from 'express';
import { z } from 'zod';
import { autenticar, soloJwt } from '../auth/middleware';
import { query } from '../db';
import { AppError, noEncontrado } from '../errors';
import { diasEntre, esFechaValida, horaBogota, hoyBogota, rangoDeFechas } from '../util/fecha';

export const gastosRouter = Router();
gastosRouter.use(autenticar);

// ---------- Validación ----------

const vacioAUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v);

/**
 * Acepta 18000, "18000", "18.000", "$18.000" o "18,000" (el Atajo de iPhone manda texto).
 * COP no usa decimales, así que los puntos y comas se tratan como separador de miles.
 */
const monto = z.preprocess((v) => {
  if (typeof v === 'string') {
    const limpio = v.replace(/[\s$.,]/g, '');
    return limpio === '' ? Number.NaN : Number(limpio);
  }
  return v;
}, z.number().int('el monto debe ser un número entero de pesos').positive('el monto debe ser mayor a cero').max(100_000_000, 'monto demasiado alto'));

const fecha = z.preprocess(
  vacioAUndefined,
  z.string().refine(esFechaValida, 'formato inválido, usa YYYY-MM-DD').optional(),
);
const hora = z.preprocess(
  vacioAUndefined,
  z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, 'formato inválido, usa HH:MM')
    .optional(),
);
const categoriaId = z.preprocess(vacioAUndefined, z.string().uuid('categoria_id inválido').optional());
const categoriaNombre = z.preprocess(vacioAUndefined, z.string().trim().max(60).optional());
const nota = z.string().trim().max(200);

const crearSchema = z
  .object({
    monto,
    categoria_id: categoriaId,
    categoria: categoriaNombre,
    fecha,
    hora,
    nota: nota.default(''),
  })
  .refine((d) => d.categoria_id || d.categoria, { message: 'envía categoria_id o categoria', path: ['categoria'] });

// Sin defaults: en PATCH solo se actualiza lo que llega.
const editarSchema = z.object({
  monto: monto.optional(),
  categoria_id: categoriaId,
  categoria: categoriaNombre,
  fecha,
  hora,
  nota: nota.optional(),
});

const consultaSchema = z.object({
  fecha,
  desde: fecha,
  hasta: fecha,
});

// ---------- Utilidades ----------

const normalizar = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

async function resolverCategoria(id?: string, nombre?: string): Promise<string> {
  const r = await query<{ id: string; nombre: string }>(`SELECT id, nombre FROM categorias`);
  if (id) {
    if (!r.rows.some((c) => c.id === id)) throw new AppError(400, 'CATEGORIA_INVALIDA', 'La categoría no existe');
    return id;
  }
  const buscada = normalizar(nombre ?? '');
  const c = r.rows.find((x) => normalizar(x.nombre) === buscada);
  if (!c) {
    throw new AppError(
      400,
      'CATEGORIA_INVALIDA',
      `Categoría desconocida. Opciones: ${r.rows.map((x) => x.nombre).join(', ')}`,
    );
  }
  return c.id;
}

const SELECT_GASTO = `g.id, g.monto, g.categoria_id, c.nombre AS categoria, c.icono, g.fecha, g.hora, g.nota`;

function formatear(fila: any) {
  return { ...fila, hora: String(fila.hora).slice(0, 5) };
}

async function resumen(usuarioId: string, dia: string) {
  const r = await query<{ total_dia: number; total_semana: number }>(
    `SELECT
       COALESCE(SUM(monto) FILTER (WHERE fecha = $2::date), 0)::int AS total_dia,
       COALESCE(SUM(monto) FILTER (
         WHERE fecha >= date_trunc('week', $2::date)::date
           AND fecha <  date_trunc('week', $2::date)::date + 7), 0)::int AS total_semana
     FROM gastos WHERE usuario_id = $1`,
    [usuarioId, dia],
  );
  return r.rows[0];
}

const idValido = (v: string) => z.string().uuid().safeParse(v).success;

// ---------- Endpoints ----------

// Lo consume el Atajo de iPhone: devuelve también el resumen para mostrarlo en la notificación.
gastosRouter.post('/', async (req, res) => {
  const d = crearSchema.parse(req.body);
  const catId = await resolverCategoria(d.categoria_id, d.categoria);
  const dia = d.fecha ?? hoyBogota();
  const h = d.hora ?? horaBogota();

  const r = await query(
    `WITH ins AS (
       INSERT INTO gastos (usuario_id, categoria_id, monto, fecha, hora, nota)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
     )
     SELECT ${SELECT_GASTO} FROM ins g JOIN categorias c ON c.id = g.categoria_id`,
    [req.userId, catId, d.monto, dia, h, d.nota],
  );
  res.status(201).json({ ...formatear(r.rows[0]), resumen: await resumen(req.userId!, dia) });
});

// ?fecha=YYYY-MM-DD  |  ?desde=...&hasta=...  |  sin parámetros = hoy (Colombia)
gastosRouter.get('/', async (req, res) => {
  const q = consultaSchema.parse(req.query);
  let desde: string;
  let hasta: string;
  if (q.fecha) {
    desde = hasta = q.fecha;
  } else if (q.desde && q.hasta) {
    desde = q.desde;
    hasta = q.hasta;
  } else if (!q.desde && !q.hasta) {
    desde = hasta = hoyBogota();
  } else {
    throw new AppError(400, 'VALIDACION', 'Para un rango envía desde y hasta juntos');
  }
  if (desde > hasta) throw new AppError(400, 'VALIDACION', 'desde no puede ser posterior a hasta');
  if (diasEntre(desde, hasta) > 366) throw new AppError(400, 'VALIDACION', 'El rango máximo es de 366 días');

  const r = await query(
    `SELECT ${SELECT_GASTO}
       FROM gastos g JOIN categorias c ON c.id = g.categoria_id
      WHERE g.usuario_id = $1 AND g.fecha BETWEEN $2 AND $3
      ORDER BY g.fecha DESC, g.hora DESC, g.creado_en DESC`,
    [req.userId, desde, hasta],
  );
  const gastos = r.rows.map(formatear);

  const por_dia: Record<string, number> = Object.fromEntries(rangoDeFechas(desde, hasta).map((f) => [f, 0]));
  const por_categoria: Record<string, number> = {};
  let total = 0;
  for (const g of gastos) {
    total += g.monto;
    por_dia[g.fecha] += g.monto;
    por_categoria[g.categoria] = (por_categoria[g.categoria] ?? 0) + g.monto;
  }
  res.json({ desde, hasta, total, por_dia, por_categoria, gastos });
});

gastosRouter.patch('/:id', soloJwt, async (req, res) => {
  if (!idValido(String(req.params.id))) throw noEncontrado('Gasto no encontrado');
  const d = editarSchema.parse(req.body);

  const sets: string[] = [];
  const params: unknown[] = [];
  const agregar = (col: string, valor: unknown) => {
    params.push(valor);
    sets.push(`${col} = $${params.length}`);
  };
  if (d.monto !== undefined) agregar('monto', d.monto);
  if (d.categoria_id || d.categoria) agregar('categoria_id', await resolverCategoria(d.categoria_id, d.categoria));
  if (d.fecha !== undefined) agregar('fecha', d.fecha);
  if (d.hora !== undefined) agregar('hora', d.hora);
  if (d.nota !== undefined) agregar('nota', d.nota);
  if (sets.length === 0) throw new AppError(400, 'VALIDACION', 'No enviaste ningún campo para actualizar');

  params.push(req.params.id, req.userId);
  const r = await query(
    `WITH upd AS (
       UPDATE gastos SET ${sets.join(', ')}
        WHERE id = $${params.length - 1} AND usuario_id = $${params.length} RETURNING *
     )
     SELECT ${SELECT_GASTO} FROM upd g JOIN categorias c ON c.id = g.categoria_id`,
    params,
  );
  if (!r.rows[0]) throw noEncontrado('Gasto no encontrado');
  res.json(formatear(r.rows[0]));
});

gastosRouter.delete('/:id', soloJwt, async (req, res) => {
  if (!idValido(String(req.params.id))) throw noEncontrado('Gasto no encontrado');
  const r = await query(`DELETE FROM gastos WHERE id = $1 AND usuario_id = $2`, [req.params.id, req.userId]);
  if (!r.rowCount) throw noEncontrado('Gasto no encontrado');
  res.status(204).end();
});

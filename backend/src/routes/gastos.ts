import { Router } from 'express';
import { z } from 'zod';
import { autenticar, soloJwt } from '../auth/middleware';
import { query } from '../db';
import { AppError, noEncontrado } from '../errors';
import { resolverCategoria } from '../servicios/categorias';
import { alertasDePresupuesto, estadoPresupuesto } from '../servicios/presupuesto';
import { generarRecurrentes } from '../servicios/recurrentes';
import { totales } from '../servicios/totales';
import { diasEntre, horaBogota, hoyBogota, limitesDelMes, rangoDeFechas } from '../util/fecha';
import { categoriaId, categoriaNombre, esUuid, fecha, hora, monto, nota } from '../validacion';

export const gastosRouter = Router();
gastosRouter.use(autenticar);

// ---------- Validación ----------

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

const consultaSchema = z.object({ fecha, desde: fecha, hasta: fecha });

// ---------- Utilidades ----------

const SELECT_GASTO = `g.id, g.monto, g.categoria_id, c.nombre AS categoria, c.icono, g.fecha, g.hora, g.nota,
  (g.recurrente_id IS NOT NULL) AS recurrente`;

function formatear(fila: any) {
  return { ...fila, hora: String(fila.hora).slice(0, 5) };
}

/** Totales y avisos de presupuesto: es lo que el Atajo muestra en la notificación. */
async function resumen(usuarioId: string, dia: string) {
  const t = await totales(usuarioId, dia);
  return { ...t, alertas: alertasDePresupuesto(await estadoPresupuesto(usuarioId, t)) };
}

function rango(q: z.infer<typeof consultaSchema>, maxDias: number, porDefecto: () => { desde: string; hasta: string }) {
  let desde: string;
  let hasta: string;
  if (q.fecha) {
    desde = hasta = q.fecha;
  } else if (q.desde && q.hasta) {
    desde = q.desde;
    hasta = q.hasta;
  } else if (!q.desde && !q.hasta) {
    ({ desde, hasta } = porDefecto());
  } else {
    throw new AppError(400, 'VALIDACION', 'Para un rango envía desde y hasta juntos');
  }
  if (desde > hasta) throw new AppError(400, 'VALIDACION', 'desde no puede ser posterior a hasta');
  if (diasEntre(desde, hasta) > maxDias) throw new AppError(400, 'VALIDACION', `El rango máximo es de ${maxDias} días`);
  return { desde, hasta };
}

async function listar(usuarioId: string, desde: string, hasta: string) {
  await generarRecurrentes(usuarioId);
  const r = await query(
    `SELECT ${SELECT_GASTO}
       FROM gastos g JOIN categorias c ON c.id = g.categoria_id
      WHERE g.usuario_id = $1 AND g.fecha BETWEEN $2 AND $3
      ORDER BY g.fecha DESC, g.hora DESC, g.creado_en DESC`,
    [usuarioId, desde, hasta],
  );
  return r.rows.map(formatear);
}

// ---------- Endpoints ----------

// Lo consume el Atajo: devuelve también el resumen para mostrarlo en la notificación.
gastosRouter.post('/', async (req, res) => {
  const d = crearSchema.parse(req.body);
  const catId = await resolverCategoria(req.userId!, d.categoria_id, d.categoria);
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
  const { desde, hasta } = rango(consultaSchema.parse(req.query), 366, () => {
    const hoy = hoyBogota();
    return { desde: hoy, hasta: hoy };
  });
  const gastos = await listar(req.userId!, desde, hasta);

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

// ---------- Exportar a CSV ----------

/**
 * Una celda que empieza por = + - @ puede ejecutarse como fórmula al abrir el archivo
 * en Excel o Sheets; la comilla simple inicial la deja como texto.
 */
function celda(v: unknown): string {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// ?desde&hasta (máx. 5 años); sin parámetros = el mes en curso.
gastosRouter.get('/exportar', soloJwt, async (req, res) => {
  const { desde, hasta } = rango(consultaSchema.parse(req.query), 1830, () => limitesDelMes(hoyBogota()));
  const gastos = await listar(req.userId!, desde, hasta);
  const filas = [
    ['Fecha', 'Hora', 'Categoría', 'Monto', 'Nota', 'Recurrente'],
    ...gastos
      .reverse() // cronológico
      .map((g) => [g.fecha, g.hora, g.categoria, g.monto, g.nota, g.recurrente ? 'sí' : 'no']),
  ];
  // Punto y coma y BOM: así Excel en español lo abre bien, con tildes y columnas separadas.
  const csv = `\uFEFF${filas.map((f) => f.map(celda).join(';')).join('\r\n')}\r\n`;
  res
    .status(200)
    .set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="pesoxpeso_${desde}_${hasta}.csv"`,
    })
    .send(csv);
});

gastosRouter.patch('/:id', soloJwt, async (req, res) => {
  if (!esUuid(req.params.id)) throw noEncontrado('Gasto no encontrado');
  const d = editarSchema.parse(req.body);

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
  if (!esUuid(req.params.id)) throw noEncontrado('Gasto no encontrado');
  const r = await query(`DELETE FROM gastos WHERE id = $1 AND usuario_id = $2`, [req.params.id, req.userId]);
  if (!r.rowCount) throw noEncontrado('Gasto no encontrado');
  res.status(204).end();
});

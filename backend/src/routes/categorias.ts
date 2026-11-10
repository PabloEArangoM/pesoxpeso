import { Router } from 'express';
import { z } from 'zod';
import { autenticar, soloJwt } from '../auth/middleware';
import { query, withTx } from '../db';
import { AppError, noEncontrado } from '../errors';
import { categoriasDe, normalizar } from '../servicios/categorias';
import { esUuid } from '../validacion';

export const categoriasRouter = Router();
categoriasRouter.use(autenticar);

const MAX_PROPIAS = 20;

const nombre = z.string().trim().min(1, 'escribe un nombre').max(30, 'máximo 30 caracteres');
// Un emoji puede ocupar varios caracteres (banderas, tonos de piel), por eso el margen.
const icono = z.string().trim().min(1).max(16);

// La usa también el Atajo para mostrar la lista.
categoriasRouter.get('/', async (req, res) => {
  res.json(await categoriasDe(req.userId!));
});

async function exigirNombreLibre(usuarioId: string, nuevo: string, excepto?: string) {
  const existentes = await categoriasDe(usuarioId);
  if (existentes.some((c) => c.id !== excepto && normalizar(c.nombre) === normalizar(nuevo))) {
    throw new AppError(409, 'CATEGORIA_EXISTENTE', 'Ya tienes una categoría con ese nombre');
  }
  return existentes;
}

categoriasRouter.post('/', soloJwt, async (req, res) => {
  const d = z.object({ nombre, icono: icono.default('🏷️') }).parse(req.body);
  const existentes = await exigirNombreLibre(req.userId!, d.nombre);
  if (existentes.filter((c) => c.propia).length >= MAX_PROPIAS) {
    throw new AppError(409, 'LIMITE_CATEGORIAS', `Puedes crear hasta ${MAX_PROPIAS} categorías propias`);
  }
  const r = await query(
    `INSERT INTO categorias (nombre, icono, es_default, orden, usuario_id) VALUES ($1, $2, false, 100, $3)
     RETURNING id, nombre, icono, true AS propia`,
    [d.nombre, d.icono, req.userId],
  );
  res.status(201).json(r.rows[0]);
});

categoriasRouter.patch('/:id', soloJwt, async (req, res) => {
  const id = String(req.params.id);
  if (!esUuid(id)) throw noEncontrado('Categoría no encontrada');
  const d = z.object({ nombre: nombre.optional(), icono: icono.optional() }).parse(req.body);
  if (d.nombre === undefined && d.icono === undefined) {
    throw new AppError(400, 'VALIDACION', 'No enviaste ningún campo para actualizar');
  }
  if (d.nombre !== undefined) await exigirNombreLibre(req.userId!, d.nombre, id);
  // Solo las propias: las categorías por defecto (usuario_id NULL) no se pueden tocar.
  const r = await query(
    `UPDATE categorias SET nombre = COALESCE($1, nombre), icono = COALESCE($2, icono)
      WHERE id = $3 AND usuario_id = $4
      RETURNING id, nombre, icono, true AS propia`,
    [d.nombre ?? null, d.icono ?? null, id, req.userId],
  );
  if (!r.rows[0]) throw noEncontrado('Categoría no encontrada');
  res.json(r.rows[0]);
});

// Los gastos que tenía la categoría no se pierden: pasan a "Otro".
categoriasRouter.delete('/:id', soloJwt, async (req, res) => {
  const id = String(req.params.id);
  if (!esUuid(id)) throw noEncontrado('Categoría no encontrada');
  const borrada = await withTx(async (client) => {
    const propia = await client.query(`SELECT 1 FROM categorias WHERE id = $1 AND usuario_id = $2 FOR UPDATE`, [
      id,
      req.userId,
    ]);
    if (!propia.rowCount) return false;
    const otro = await client.query<{ id: string }>(
      `SELECT id FROM categorias WHERE usuario_id IS NULL AND nombre = 'Otro'`,
    );
    await client.query(`UPDATE gastos SET categoria_id = $1 WHERE categoria_id = $2`, [otro.rows[0].id, id]);
    await client.query(`UPDATE gastos_recurrentes SET categoria_id = $1 WHERE categoria_id = $2`, [otro.rows[0].id, id]);
    await client.query(`DELETE FROM categorias WHERE id = $1`, [id]);
    return true;
  });
  if (!borrada) throw noEncontrado('Categoría no encontrada');
  res.status(204).end();
});

import { Router } from 'express';
import { z } from 'zod';
import { autenticar, soloJwt } from '../auth/middleware';
import { withTx } from '../db';
import { AppError } from '../errors';
import { estadoPresupuesto, type Periodo } from '../servicios/presupuesto';
import { totales } from '../servicios/totales';
import { hoyBogota } from '../util/fecha';
import { monto } from '../validacion';

export const presupuestoRouter = Router();
presupuestoRouter.use(autenticar, soloJwt);

async function estado(usuarioId: string) {
  return estadoPresupuesto(usuarioId, await totales(usuarioId, hoyBogota()));
}

// { semanal: {monto, gastado, restante, porcentaje, estado} | null, mensual: ... }
presupuestoRouter.get('/', async (req, res) => {
  res.json(await estado(req.userId!));
});

// Un número fija el tope, null lo quita y un campo ausente no cambia nada.
const montoONull = z.union([z.null(), monto]).optional();
const schema = z.object({ semanal: montoONull, mensual: montoONull });

presupuestoRouter.put('/', async (req, res) => {
  const d = schema.parse(req.body);
  if (d.semanal === undefined && d.mensual === undefined) {
    throw new AppError(400, 'VALIDACION', 'Envía semanal o mensual');
  }
  await withTx(async (client) => {
    for (const periodo of ['semanal', 'mensual'] as Periodo[]) {
      const valor = d[periodo];
      if (valor === undefined) continue;
      if (valor === null) {
        await client.query(`DELETE FROM presupuestos WHERE usuario_id = $1 AND periodo = $2`, [req.userId, periodo]);
      } else {
        await client.query(
          `INSERT INTO presupuestos (usuario_id, periodo, monto) VALUES ($1, $2, $3)
           ON CONFLICT (usuario_id, periodo) DO UPDATE SET monto = EXCLUDED.monto`,
          [req.userId, periodo, valor],
        );
      }
    }
  });
  res.json(await estado(req.userId!));
});

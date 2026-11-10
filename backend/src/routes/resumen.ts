import { Router } from 'express';
import { autenticar, soloJwt } from '../auth/middleware';
import { estadoPresupuesto } from '../servicios/presupuesto';
import { calcularRacha } from '../servicios/racha';
import { generarRecurrentes } from '../servicios/recurrentes';
import { totales } from '../servicios/totales';
import { hoyBogota } from '../util/fecha';

export const resumenRouter = Router();
resumenRouter.use(autenticar, soloJwt);

// Todo lo que necesita la pantalla de inicio en una sola llamada.
resumenRouter.get('/', async (req, res) => {
  const hoy = hoyBogota();
  await generarRecurrentes(req.userId);
  const t = await totales(req.userId!, hoy);
  const [presupuesto, racha] = await Promise.all([estadoPresupuesto(req.userId!, t), calcularRacha(req.userId!, hoy)]);
  res.json({ fecha: hoy, ...t, presupuesto, racha });
});

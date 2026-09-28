import { Router } from 'express';
import { autenticar } from '../auth/middleware';
import { query } from '../db';

export const categoriasRouter = Router();

categoriasRouter.get('/', autenticar, async (_req, res) => {
  const r = await query(`SELECT id, nombre, icono FROM categorias ORDER BY orden, nombre`);
  res.json(r.rows);
});

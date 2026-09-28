import bcrypt from 'bcryptjs';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { autenticar, soloJwt } from '../auth/middleware';
import { firmarAcceso, firmarRefresh, generarApiToken, verificarRefresh } from '../auth/tokens';
import { config } from '../config';
import { query } from '../db';
import { AppError, noEncontrado } from '../errors';

export const authRouter = Router();

const limitador = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: config.rateLimitAuthMax,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (_req, res) =>
    res.status(429).json({ error: { codigo: 'DEMASIADOS_INTENTOS', mensaje: 'Demasiados intentos, espera unos minutos' } }),
});

const credenciales = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(8, 'mínimo 8 caracteres').max(200),
});
const registroSchema = credenciales.extend({ nombre: z.string().trim().min(1).max(80).optional() });

// Hash de relleno para que login tarde igual exista o no el correo
const HASH_FALSO = bcrypt.hashSync('no-es-una-clave-real', 10);

function sesion(usuarioId: string) {
  return { token: firmarAcceso(usuarioId), refresh_token: firmarRefresh(usuarioId) };
}

authRouter.post('/registro', limitador, async (req, res) => {
  const { email, password, nombre } = registroSchema.parse(req.body);
  const hash = await bcrypt.hash(password, 10);
  try {
    const r = await query<{ id: string }>(
      `INSERT INTO usuarios (nombre, email, password_hash) VALUES ($1, $2, $3) RETURNING id`,
      [nombre ?? null, email, hash],
    );
    const id = r.rows[0].id;
    res.status(201).json({ id, email, ...sesion(id) });
  } catch (e: any) {
    if (e?.code === '23505') throw new AppError(409, 'EMAIL_EN_USO', 'Ya existe una cuenta con ese correo');
    throw e;
  }
});

authRouter.post('/login', limitador, async (req, res) => {
  const { email, password } = credenciales.parse(req.body);
  const r = await query<{ id: string; password_hash: string }>(
    `SELECT id, password_hash FROM usuarios WHERE lower(email) = $1`,
    [email],
  );
  const usuario = r.rows[0];
  const ok = await bcrypt.compare(password, usuario?.password_hash ?? HASH_FALSO);
  if (!usuario || !ok) throw new AppError(401, 'CREDENCIALES_INVALIDAS', 'Correo o contraseña incorrectos');
  res.json({ usuario_id: usuario.id, ...sesion(usuario.id) });
});

authRouter.post('/refresh', async (req, res) => {
  const { refresh_token } = z.object({ refresh_token: z.string().min(10) }).parse(req.body);
  let usuarioId: string;
  try {
    usuarioId = verificarRefresh(refresh_token);
  } catch {
    throw new AppError(401, 'REFRESH_INVALIDO', 'Refresh token inválido o vencido');
  }
  const existe = await query(`SELECT 1 FROM usuarios WHERE id = $1`, [usuarioId]);
  if (!existe.rowCount) throw new AppError(401, 'REFRESH_INVALIDO', 'Refresh token inválido o vencido');
  res.json(sesion(usuarioId));
});

// ---- Tokens personales (Atajo de iPhone) ----

authRouter.post('/api-tokens', autenticar, soloJwt, async (req, res) => {
  const { nombre } = z.object({ nombre: z.string().trim().min(1).max(60).default('Atajo iPhone') }).parse(req.body ?? {});
  const { token, hash } = generarApiToken();
  const r = await query<{ id: string; creado_en: string }>(
    `INSERT INTO api_tokens (usuario_id, token_hash, nombre) VALUES ($1, $2, $3) RETURNING id, creado_en`,
    [req.userId, hash, nombre],
  );
  // El token solo se muestra esta vez; en la base queda únicamente el hash.
  res.status(201).json({ id: r.rows[0].id, nombre, token, creado_en: r.rows[0].creado_en });
});

authRouter.get('/api-tokens', autenticar, soloJwt, async (req, res) => {
  const r = await query(
    `SELECT id, nombre, creado_en, ultimo_uso FROM api_tokens WHERE usuario_id = $1 ORDER BY creado_en DESC`,
    [req.userId],
  );
  res.json(r.rows);
});

authRouter.delete('/api-tokens/:id', autenticar, soloJwt, async (req, res) => {
  const id = z.string().uuid().safeParse(req.params.id);
  if (!id.success) throw noEncontrado('Token no encontrado');
  const r = await query(`DELETE FROM api_tokens WHERE id = $1 AND usuario_id = $2`, [id.data, req.userId]);
  if (!r.rowCount) throw noEncontrado('Token no encontrado');
  res.status(204).end();
});

import bcrypt from 'bcryptjs';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { autenticar, soloJwt } from '../auth/middleware';
import { firmarAcceso, firmarRefresh, generarApiToken, verificarRefresh } from '../auth/tokens';
import { consumirTokenEmail, crearTokenEmail } from '../auth/tokensEmail';
import { config } from '../config';
import { query } from '../db';
import { enviarCorreoSinEsperar } from '../email';
import { AppError, noEncontrado } from '../errors';

export const authRouter = Router();

const limite = (max: number) =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_req, res) =>
      res
        .status(429)
        .json({ error: { codigo: 'DEMASIADOS_INTENTOS', mensaje: 'Demasiados intentos, espera unos minutos' } }),
  });
const limitador = limite(config.rateLimitAuthMax);
// El refresh se usa a menudo (cada 15 min por sesión), así que su límite es más holgado.
const limitadorRefresh = limite(config.rateLimitAuthMax * 5);

const password = z.string().min(8, 'mínimo 8 caracteres').max(200);
const credenciales = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password,
});
const registroSchema = credenciales.extend({ nombre: z.string().trim().min(1).max(80).optional() });

// Hash de relleno para que login tarde igual exista o no el correo
const HASH_FALSO = bcrypt.hashSync('no-es-una-clave-real', 10);

function sesion(usuarioId: string, version: number) {
  return { token: firmarAcceso(usuarioId), refresh_token: firmarRefresh(usuarioId, version) };
}

async function enviarVerificacion(usuarioId: string, email: string) {
  const token = await crearTokenEmail(usuarioId, 'verificacion');
  enviarCorreoSinEsperar({
    para: email,
    asunto: 'Confirma tu correo en PesoXPeso',
    texto:
      `Hola,\n\nConfirma tu correo abriendo este enlace (vale 48 horas):\n\n` +
      `${config.appUrl}/verificar?token=${token}\n\n` +
      `Si no creaste una cuenta en PesoXPeso, ignora este mensaje.`,
  });
}

authRouter.post('/registro', limitador, async (req, res) => {
  const { email, password, nombre } = registroSchema.parse(req.body);
  const hash = await bcrypt.hash(password, 10);
  try {
    const r = await query<{ id: string; sesion_version: number }>(
      `INSERT INTO usuarios (nombre, email, password_hash) VALUES ($1, $2, $3) RETURNING id, sesion_version`,
      [nombre ?? null, email, hash],
    );
    const { id, sesion_version } = r.rows[0];
    await enviarVerificacion(id, email);
    res.status(201).json({ id, email, ...sesion(id, sesion_version) });
  } catch (e: any) {
    if (e?.code === '23505') throw new AppError(409, 'EMAIL_EN_USO', 'Ya existe una cuenta con ese correo');
    throw e;
  }
});

authRouter.post('/login', limitador, async (req, res) => {
  const { email, password } = credenciales.parse(req.body);
  const r = await query<{ id: string; password_hash: string; sesion_version: number }>(
    `SELECT id, password_hash, sesion_version FROM usuarios WHERE lower(email) = $1`,
    [email],
  );
  const usuario = r.rows[0];
  const ok = await bcrypt.compare(password, usuario?.password_hash ?? HASH_FALSO);
  if (!usuario || !ok) throw new AppError(401, 'CREDENCIALES_INVALIDAS', 'Correo o contraseña incorrectos');
  res.json({ usuario_id: usuario.id, ...sesion(usuario.id, usuario.sesion_version) });
});

authRouter.post('/refresh', limitadorRefresh, async (req, res) => {
  const { refresh_token } = z.object({ refresh_token: z.string().min(10) }).parse(req.body);
  const invalido = () => new AppError(401, 'REFRESH_INVALIDO', 'Refresh token inválido o vencido');
  let datos: { usuarioId: string; version: number };
  try {
    datos = verificarRefresh(refresh_token);
  } catch {
    throw invalido();
  }
  const r = await query<{ sesion_version: number }>(`SELECT sesion_version FROM usuarios WHERE id = $1`, [
    datos.usuarioId,
  ]);
  // Usuario borrado, o sesión revocada (cambio de contraseña / cerrar sesiones).
  if (!r.rows[0] || r.rows[0].sesion_version !== datos.version) throw invalido();
  res.json(sesion(datos.usuarioId, datos.version));
});

// ---- Correo: verificación y contraseña olvidada ----

const TOKEN_INVALIDO = () =>
  new AppError(400, 'TOKEN_INVALIDO', 'El enlace no es válido o ya venció. Pide uno nuevo.');
const tokenSchema = z.string().min(20).max(200);

authRouter.post('/verificar-email', limitador, async (req, res) => {
  const { token } = z.object({ token: tokenSchema }).parse(req.body);
  const usuarioId = await consumirTokenEmail(token, 'verificacion');
  if (!usuarioId) throw TOKEN_INVALIDO();
  await query(`UPDATE usuarios SET email_verificado = true WHERE id = $1`, [usuarioId]);
  res.status(204).end();
});

authRouter.post('/reenviar-verificacion', limitador, autenticar, soloJwt, async (req, res) => {
  const r = await query<{ email: string; email_verificado: boolean }>(
    `SELECT email, email_verificado FROM usuarios WHERE id = $1`,
    [req.userId],
  );
  if (!r.rows[0]) throw new AppError(401, 'NO_AUTENTICADO', 'Falta o es inválido el token de autenticación');
  if (!r.rows[0].email_verificado) await enviarVerificacion(req.userId!, r.rows[0].email);
  res.status(204).end();
});

// Siempre responde 204: no revela si el correo tiene cuenta o no.
authRouter.post('/recuperar', limitador, async (req, res) => {
  const { email } = z.object({ email: credenciales.shape.email }).parse(req.body);
  const r = await query<{ id: string; email: string }>(`SELECT id, email FROM usuarios WHERE lower(email) = $1`, [
    email,
  ]);
  if (r.rows[0]) {
    const token = await crearTokenEmail(r.rows[0].id, 'recuperacion');
    enviarCorreoSinEsperar({
      para: r.rows[0].email,
      asunto: 'Restablece tu contraseña de PesoXPeso',
      texto:
        `Hola,\n\nPara elegir una contraseña nueva abre este enlace (vale 1 hora):\n\n` +
        `${config.appUrl}/restablecer?token=${token}\n\n` +
        `Si no lo pediste, ignora este mensaje: tu contraseña sigue igual.`,
    });
  }
  res.status(204).end();
});

// Pone la contraseña nueva y cierra todas las sesiones abiertas.
authRouter.post('/restablecer', limitador, async (req, res) => {
  const { token, password_nueva } = z.object({ token: tokenSchema, password_nueva: password }).parse(req.body);
  const usuarioId = await consumirTokenEmail(token, 'recuperacion');
  if (!usuarioId) throw TOKEN_INVALIDO();
  const hash = await bcrypt.hash(password_nueva, 10);
  // Abrir el enlace prueba que el correo es suyo, así que también queda verificado.
  await query(
    `UPDATE usuarios SET password_hash = $1, sesion_version = sesion_version + 1, email_verificado = true WHERE id = $2`,
    [hash, usuarioId],
  );
  res.status(204).end();
});

// ---- Cuenta (solo sesión normal) ----

/** Comprueba la contraseña actual del usuario autenticado; 401 si no coincide. */
async function exigirPassword(usuarioId: string, clave: string) {
  const r = await query<{ password_hash: string }>(`SELECT password_hash FROM usuarios WHERE id = $1`, [usuarioId]);
  const ok = await bcrypt.compare(clave, r.rows[0]?.password_hash ?? HASH_FALSO);
  if (!r.rows[0] || !ok) throw new AppError(401, 'CREDENCIALES_INVALIDAS', 'La contraseña actual no es correcta');
}

// Cambia la contraseña y revoca todas las sesiones anteriores; devuelve una sesión nueva.
authRouter.patch('/password', limitador, autenticar, soloJwt, async (req, res) => {
  const { password_actual, password_nueva } = z
    .object({ password_actual: z.string().min(1).max(200), password_nueva: password })
    .parse(req.body);
  await exigirPassword(req.userId!, password_actual);
  const hash = await bcrypt.hash(password_nueva, 10);
  const r = await query<{ sesion_version: number }>(
    `UPDATE usuarios SET password_hash = $1, sesion_version = sesion_version + 1 WHERE id = $2 RETURNING sesion_version`,
    [hash, req.userId],
  );
  res.json(sesion(req.userId!, r.rows[0].sesion_version));
});

// Cierra todas las sesiones: los refresh tokens emitidos hasta ahora dejan de servir.
authRouter.post('/cerrar-sesiones', autenticar, soloJwt, async (req, res) => {
  await query(`UPDATE usuarios SET sesion_version = sesion_version + 1 WHERE id = $1`, [req.userId]);
  res.status(204).end();
});

// Borra la cuenta y todos sus datos (lo demás cae por ON DELETE CASCADE).
authRouter.delete('/cuenta', limitador, autenticar, soloJwt, async (req, res) => {
  const { password: clave } = z.object({ password: z.string().min(1).max(200) }).parse(req.body ?? {});
  await exigirPassword(req.userId!, clave);
  await query(`DELETE FROM usuarios WHERE id = $1`, [req.userId]);
  res.status(204).end();
});

// ---- Tokens personales (Atajo de iPhone / Android) ----

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

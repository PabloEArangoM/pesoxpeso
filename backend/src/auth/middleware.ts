import { NextFunction, Request, Response } from 'express';
import { AppError } from '../errors';
import { query } from '../db';
import { hashApiToken, PREFIJO_API_TOKEN, verificarAcceso } from './tokens';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
      authKind?: 'jwt' | 'api_token';
    }
  }
}

const noAutenticado = () => new AppError(401, 'NO_AUTENTICADO', 'Falta o es inválido el token de autenticación');

/**
 * Acepta JWT de acceso (web/app) o token personal `pxp_...` (Atajo de iPhone).
 */
export async function autenticar(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.header('authorization') ?? '';
    const [esquema, token] = header.split(' ');
    if (esquema?.toLowerCase() !== 'bearer' || !token) throw noAutenticado();

    if (token.startsWith(PREFIJO_API_TOKEN)) {
      const r = await query<{ usuario_id: string }>(
        `UPDATE api_tokens SET ultimo_uso = now() WHERE token_hash = $1 RETURNING usuario_id`,
        [hashApiToken(token)],
      );
      if (!r.rows[0]) throw noAutenticado();
      req.userId = r.rows[0].usuario_id;
      req.authKind = 'api_token';
    } else {
      try {
        req.userId = verificarAcceso(token);
      } catch {
        throw noAutenticado();
      }
      req.authKind = 'jwt';
    }
    next();
  } catch (e) {
    next(e);
  }
}

/**
 * Los tokens personales del Atajo solo sirven para registrar/consultar gastos.
 * Perfil, edición/borrado y gestión de tokens exigen sesión normal (JWT).
 */
export function soloJwt(req: Request, _res: Response, next: NextFunction) {
  if (req.authKind !== 'jwt') {
    return next(new AppError(403, 'PROHIBIDO', 'Este token personal no puede usarse en este endpoint'));
  }
  next();
}

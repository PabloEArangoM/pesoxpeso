import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config';

export const PREFIJO_API_TOKEN = 'pxp_';

export function firmarAcceso(usuarioId: string): string {
  return jwt.sign({ typ: 'access' }, config.jwtSecret, { subject: usuarioId, expiresIn: config.accessTtl as any });
}

export function firmarRefresh(usuarioId: string): string {
  return jwt.sign({ typ: 'refresh' }, config.jwtRefreshSecret, {
    subject: usuarioId,
    expiresIn: config.refreshTtl as any,
  });
}

export function verificarAcceso(token: string): string {
  const p = jwt.verify(token, config.jwtSecret) as jwt.JwtPayload;
  if (p.typ !== 'access' || !p.sub) throw new Error('token de acceso inválido');
  return p.sub;
}

export function verificarRefresh(token: string): string {
  const p = jwt.verify(token, config.jwtRefreshSecret) as jwt.JwtPayload;
  if (p.typ !== 'refresh' || !p.sub) throw new Error('refresh token inválido');
  return p.sub;
}

export function generarApiToken(): { token: string; hash: string } {
  const token = PREFIJO_API_TOKEN + crypto.randomBytes(24).toString('base64url');
  return { token, hash: hashApiToken(token) };
}

export function hashApiToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

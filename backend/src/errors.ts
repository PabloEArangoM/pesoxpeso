import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { log } from './log';

export class AppError extends Error {
  constructor(
    public status: number,
    public codigo: string,
    public mensaje: string,
  ) {
    super(mensaje);
  }
}

export const noEncontrado = (mensaje = 'Recurso no encontrado') =>
  new AppError(404, 'NO_ENCONTRADO', mensaje);

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: { codigo: 'RUTA_NO_ENCONTRADA', mensaje: 'La ruta no existe' } });
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: { codigo: err.codigo, mensaje: err.mensaje } });
  }
  if (err instanceof ZodError) {
    const primero = err.issues[0];
    const campo = primero?.path.join('.') || 'body';
    return res.status(400).json({
      error: {
        codigo: 'VALIDACION',
        mensaje: `${campo}: ${primero?.message ?? 'dato inválido'}`,
        detalles: err.issues.map((i) => ({ campo: i.path.join('.'), mensaje: i.message })),
      },
    });
  }
  // Token de acceso aún vigente de una cuenta ya borrada: la FK a usuarios falla al insertar.
  if ((err as any)?.code === '23503' && String((err as any)?.constraint ?? '').includes('usuario_id')) {
    return res
      .status(401)
      .json({ error: { codigo: 'NO_AUTENTICADO', mensaje: 'Falta o es inválido el token de autenticación' } });
  }
  // JSON mal formado, body muy grande, etc.
  const status = (err as any)?.status ?? (err as any)?.statusCode;
  if (status && status >= 400 && status < 500) {
    return res.status(status).json({ error: { codigo: 'PETICION_INVALIDA', mensaje: 'Petición inválida' } });
  }
  log.error({ err, metodo: req.method, ruta: req.originalUrl }, 'error no controlado');
  return res.status(500).json({ error: { codigo: 'ERROR_INTERNO', mensaje: 'Error interno del servidor' } });
}

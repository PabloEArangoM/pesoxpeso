import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

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

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
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
  // JSON mal formado, body muy grande, etc.
  const status = (err as any)?.status ?? (err as any)?.statusCode;
  if (status && status >= 400 && status < 500) {
    return res.status(status).json({ error: { codigo: 'PETICION_INVALIDA', mensaje: 'Petición inválida' } });
  }
  console.error(err);
  return res.status(500).json({ error: { codigo: 'ERROR_INTERNO', mensaje: 'Error interno del servidor' } });
}

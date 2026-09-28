import 'dotenv/config';

function required(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor) throw new Error(`Falta la variable de entorno ${nombre}`);
  return valor;
}

export const config = {
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: required('DATABASE_URL'),
  jwtSecret: required('JWT_SECRET'),
  jwtRefreshSecret: required('JWT_REFRESH_SECRET'),
  accessTtl: '15m',
  refreshTtl: '30d',
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
  rateLimitAuthMax: Number(process.env.RATE_LIMIT_AUTH_MAX ?? 20),
  isTest: process.env.NODE_ENV === 'test',
};

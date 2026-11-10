import 'dotenv/config';

function required(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor) throw new Error(`Falta la variable de entorno ${nombre}`);
  return valor;
}
const opcional = (nombre: string) => process.env[nombre]?.trim() || undefined;

const isTest = process.env.NODE_ENV === 'test';
const isProd = process.env.NODE_ENV === 'production';

const corsOrigin = process.env.CORS_ORIGIN ?? '*';
if (isProd && corsOrigin === '*') {
  throw new Error('En producción CORS_ORIGIN debe ser el dominio del frontend, no "*"');
}

export const config = {
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: required('DATABASE_URL'),
  jwtSecret: required('JWT_SECRET'),
  jwtRefreshSecret: required('JWT_REFRESH_SECRET'),
  accessTtl: '15m',
  refreshTtl: '30d',
  corsOrigin,
  rateLimitAuthMax: Number(process.env.RATE_LIMIT_AUTH_MAX ?? 20),
  isTest,
  isProd,
  logLevel: process.env.LOG_LEVEL ?? (isTest ? 'silent' : 'info'),

  /** URL pública del frontend; con ella se arman los enlaces de los correos. */
  appUrl: (process.env.APP_URL ?? 'http://localhost:5173').replace(/\/+$/, ''),

  /** Correo. Sin SMTP_URL los mensajes no se envían: se escriben en el log (útil en desarrollo). */
  smtpUrl: opcional('SMTP_URL'),
  emailFrom: process.env.EMAIL_FROM ?? 'PesoXPeso <no-responder@localhost>',

  /** Web Push (recordatorios). Sin las dos llaves VAPID los recordatorios quedan desactivados. */
  vapidPublicKey: opcional('VAPID_PUBLIC_KEY'),
  vapidPrivateKey: opcional('VAPID_PRIVATE_KEY'),
  vapidSubject: process.env.VAPID_SUBJECT ?? 'mailto:soporte@localhost',
};

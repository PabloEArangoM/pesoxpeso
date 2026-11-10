import pino from 'pino';
import { config } from './config';

/** Log estructurado (JSON). Nunca se registran tokens ni contraseñas. */
export const log = pino({
  level: config.logLevel,
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.token', '*.refresh_token'],
    censor: '[oculto]',
  },
});

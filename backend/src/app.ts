import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { config } from './config';
import { pool } from './db';
import { errorHandler, notFoundHandler } from './errors';
import { log } from './log';
import { authRouter } from './routes/auth';
import { categoriasRouter } from './routes/categorias';
import { cuentaRouter } from './routes/cuenta';
import { gastosRouter } from './routes/gastos';
import { perfilRouter } from './routes/perfil';
import { presupuestoRouter } from './routes/presupuesto';
import { recurrentesRouter } from './routes/recurrentes';
import { resumenRouter } from './routes/resumen';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1); // detrás del proxy de Render/Railway/Fly para rate limit por IP real
  app.use(helmet());
  app.use(
    cors({
      origin: config.corsOrigin === '*' ? true : config.corsOrigin.split(',').map((o) => o.trim()),
      exposedHeaders: ['Content-Disposition'], // para que la app lea el nombre del CSV
    }),
  );
  if (!config.isTest) {
    app.use(
      pinoHttp({
        logger: log,
        autoLogging: { ignore: (req) => req.url === '/health' },
        // Solo lo necesario: nada de cuerpos, encabezados ni tokens.
        serializers: {
          req: (req) => ({ metodo: req.method, ruta: req.url }),
          res: (res) => ({ estado: res.statusCode }),
        },
      }),
    );
  }
  app.use(express.json({ limit: '50kb' }));

  app.get('/health', async (_req, res) => {
    try {
      await pool.query('SELECT 1');
      res.json({ estado: 'ok' });
    } catch {
      res.status(503).json({ estado: 'sin_base_de_datos' });
    }
  });

  const v1 = express.Router();
  v1.use('/auth', authRouter);
  v1.use('/cuenta', cuentaRouter);
  v1.use('/perfil', perfilRouter);
  v1.use('/categorias', categoriasRouter);
  v1.use('/gastos', gastosRouter);
  v1.use('/presupuesto', presupuestoRouter);
  v1.use('/recurrentes', recurrentesRouter);
  v1.use('/resumen', resumenRouter);
  app.use('/v1', v1);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

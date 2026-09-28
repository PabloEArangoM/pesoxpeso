import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { config } from './config';
import { errorHandler, notFoundHandler } from './errors';
import { authRouter } from './routes/auth';
import { categoriasRouter } from './routes/categorias';
import { gastosRouter } from './routes/gastos';
import { perfilRouter } from './routes/perfil';
import { pool } from './db';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1); // detrás del proxy de Render/Railway/Fly para rate limit por IP real
  app.use(helmet());
  app.use(cors({ origin: config.corsOrigin === '*' ? true : config.corsOrigin.split(',') }));
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
  v1.use('/perfil', perfilRouter);
  v1.use('/categorias', categoriasRouter);
  v1.use('/gastos', gastosRouter);
  app.use('/v1', v1);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

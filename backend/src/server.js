// Punto de entrada de la API REST de MACAI Autopartes
import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { db } from './db/index.js';
import { errorHandler } from './utils/errors.js';
import { UPLOAD_DIR, FRONTEND_DIST } from './paths.js';
import authRoutes from './routes/auth.js';
import catalogRoutes from './routes/catalog.js';
import accountRoutes from './routes/account.js';
import orderRoutes from './routes/orders.js';
import adminRoutes from './routes/admin/index.js';
import seoRoutes from './routes/seo.js';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

// Cabeceras de seguridad básicas
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});
app.use(cors({ origin: [config.publicUrl, /^http:\/\/(localhost|127\.0\.0\.1):\d+$/] }));
app.use(express.json({ limit: '1mb' }));
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d' }));

// ---------- API ----------
app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/account', accountRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', orderRoutes);
app.use('/api', catalogRoutes);
app.use('/api', (_req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));
app.use(seoRoutes); // sitemap.xml y robots.txt

// ---------- Frontend compilado (modo producción) ----------
if (fs.existsSync(FRONTEND_DIST)) {
  app.use(express.static(FRONTEND_DIST, { index: false, maxAge: '1h' }));
  // Cualquier ruta que no sea API devuelve la SPA (React Router la resuelve)
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(FRONTEND_DIST, 'index.html')));
}

app.use(errorHandler);

await db.init();
app.listen(config.port, () => {
  console.log(`MACAI API escuchando en http://localhost:${config.port}`);
});

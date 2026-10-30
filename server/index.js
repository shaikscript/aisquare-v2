import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import zlib from 'node:zlib';
import express from 'express';
import cookieParser from 'cookie-parser';
import { ROOT_DIR } from './db/database.js';
import { SESSION_COOKIE_NAME, attachSessionUser } from './middleware/auth.js';
import publicRouter from './routes/public.js';
import authRouter from './routes/auth.js';
import portalRouter from './routes/portal.js';
import adminRouter from './routes/admin.js';
import adminPlatformRouter from './routes/adminPlatform.js';

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const isProd = process.env.NODE_ENV === 'production';

async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);

  app.set('trust proxy', 1);
  app.set('etag', false);
  app.disable('x-powered-by');

  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
  });

  app.use(cookieParser());
  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true, limit: '5mb' }));
  app.use(attachSessionUser);

  // Concise request telemetry (never logs sensitive values or tokens)
  app.use((req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/admin') || req.path.startsWith('/assets')) {
      res.on('finish', () => {
        const cleanPath = req.path;
        const hasCookie = Boolean(req.cookies?.[SESSION_COOKIE_NAME]);
        const hasX = Boolean(req.headers['x-aisquare-session']);
        const hasSid = Boolean(req.query?._sid || req.query?.sid);
        const hasAuth = Boolean(req.headers.authorization);
        const uid = req.user ? `${req.user.role}:${req.user.id}` : 'anon';
        console.log(
          `[HTTP] ${req.method} ${cleanPath} -> ${res.statusCode} [u=${uid} c=${hasCookie ? 1 : 0} x=${hasX ? 1 : 0} s=${hasSid ? 1 : 0} a=${hasAuth ? 1 : 0} host=${req.headers.host || '-'}]`
        );
      });
    }
    next();
  });

  // Health endpoint
  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      mode: isProd ? 'production-bundle' : 'development',
      service: 'AI Square IT Solutions Platform',
      timestamp: new Date().toISOString(),
    });
  });

  // Mount API routes
  app.use('/api/public', publicRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/portal', portalRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/admin', adminPlatformRouter);

  // Explicit JSON 404 for unknown /api routes
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  // Global API / Express error safety net
  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    if (req.path.startsWith('/api')) {
      return res.status(err.status || 500).json({
        error: err.message || 'Internal server error.',
      });
    }
    return next(err);
  });

  const bundleDir = path.join(ROOT_DIR, 'client_bundle');

  if (isProd && fs.existsSync(bundleDir)) {
    // Serve gzip-compressed JS/CSS bundles; if an older hashed JS bundle is requested, serve current JS bundle seamlessly
    app.get('/assets/:file', (req, res, next) => {
      const safeName = path.basename(req.params.file);
      const assetsDir = path.join(bundleDir, 'assets');
      let filePath = path.join(assetsDir, safeName);
      const ext = path.extname(safeName).toLowerCase();

      if (!fs.existsSync(filePath) && (ext === '.js' || ext === '.css') && fs.existsSync(assetsDir)) {
        const fallback = fs
          .readdirSync(assetsDir)
          .find((f) => f.startsWith('index-') && f.endsWith(ext));
        if (fallback) {
          filePath = path.join(assetsDir, fallback);
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        }
      }

      if (!fs.existsSync(filePath)) return next();

      const acceptEncoding = String(req.headers['accept-encoding'] || '');
      if ((ext === '.js' || ext === '.css') && acceptEncoding.includes('gzip')) {
        const raw = fs.readFileSync(filePath);
        const gz = zlib.gzipSync(raw);
        res.setHeader(
          'Content-Type',
          ext === '.js' ? 'application/javascript; charset=utf-8' : 'text/css; charset=utf-8'
        );
        res.setHeader('Content-Encoding', 'gzip');
        res.setHeader('Vary', 'Accept-Encoding');
        if (!res.getHeader('Cache-Control')) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
        return res.send(gz);
      }
      return next();
    });

    app.use(
      express.static(bundleDir, {
        index: false,
        etag: false,
        lastModified: false,
        maxAge: '1h',
      })
    );

    const indexHtmlPath = path.join(bundleDir, 'index.html');
    app.get('*', (_req, res) => {
      const html = fs.readFileSync(indexHtmlPath, 'utf8');
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.send(html);
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      root: ROOT_DIR,
      server: {
        middlewareMode: true,
        allowedHosts: true,
        hmr: {
          server: httpServer,
        },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  httpServer.listen(PORT, HOST, () => {
    console.log(
      `AI Square IT Solutions server listening on http://${HOST}:${PORT} (${isProd ? 'production-bundle' : 'dev'})`
    );
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

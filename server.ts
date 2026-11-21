import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { processScanNota, type ScanNotaRequestBody } from './api/_lib/scanNotaCore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolveServerPort(): number {
  const portFlagIdx = process.argv.indexOf('--port');
  if (portFlagIdx !== -1 && process.argv[portFlagIdx + 1]) {
    const cliPort = Number(process.argv[portFlagIdx + 1]);
    if (Number.isFinite(cliPort) && cliPort > 0) return cliPort;
  }
  const envPort = Number(process.env.PORT);
  const nginxPort = Number(process.env.NGINX_PORT);
  const defaultAppPort = Number(process.env.DEFAULT_APP_PORT) || 3000;
  // In container environments where nginx listens on NGINX_PORT (e.g. 8080) and proxies
  // to DEFAULT_APP_PORT (3000), avoid binding Express to NGINX_PORT when PORT === NGINX_PORT.
  if (Number.isFinite(nginxPort) && nginxPort > 0 && envPort === nginxPort) {
    return defaultAppPort;
  }
  return (Number.isFinite(envPort) && envPort > 0 ? envPort : defaultAppPort);
}

const PORT = resolveServerPort();
const distPath = path.resolve(__dirname, 'dist');
const distIndexPath = path.join(distPath, 'index.html');
const isProd =
  process.env.NODE_ENV === 'production' ||
  (process.env.NODE_ENV !== 'development' && fs.existsSync(distIndexPath));

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'proyekkas-absensi' });
  });

  app.post('/api/scan-nota', async (req, res) => {
    const result = await processScanNota(req.body as ScanNotaRequestBody);
    res.status(result.status).json(result.body);
  });

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Endpoint API tidak ditemukan.' });
  });

  if (isProd && fs.existsSync(distIndexPath)) {
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(distIndexPath);
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false, ws: false },
      appType: 'spa',
      plugins: [
        {
          name: 'proyekkas-disable-hmr-ws-client',
          enforce: 'post',
          transform(code, id) {
            const cleanId = id.split('?')[0].replace(/\\/g, '/');
            if (cleanId.endsWith('/vite/dist/client/client.mjs')) {
              return {
                code: code
                  .replace(
                    'transport.connect(createHMRHandler(handleMessage));',
                    '/* HMR WebSocket disabled in AI Studio middleware mode */',
                  )
                  .replace(
                    'else throw new SendBeforeConnectError("send was called before connect");',
                    'else return;',
                  )
                  .replace(
                    'else throw new SendBeforeConnectError("invoke was called before connect");',
                    'else return;',
                  ),
                map: null,
              };
            }
          },
        },
      ],
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ProyekKas & Absensi server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

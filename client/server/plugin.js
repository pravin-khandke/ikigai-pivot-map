import { handleMap } from './api.js';

/** Vite plugin that registers POST /api/map as dev middleware */
export default function ikigaiApi() {
  return {
    name: 'ikigai-api',
    configureServer(server) {
      server.middlewares.use('/api/map', (req, res, next) => {
        handleMap(req, res).catch(() => {
          res.writeHead(500, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ error: 'Internal server error' }));
        });
      });
    },
  };
}

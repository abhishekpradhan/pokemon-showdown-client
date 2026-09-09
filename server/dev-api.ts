import type { IncomingMessage } from 'node:http';
import type { Connect, Plugin } from 'vite';
import login from '../api/action';
import replay from '../api/replay';
import deployment from '../vercel.json';

function requestBody(req: IncomingMessage) {
  let data: (chunk: Buffer) => void;
  let end: () => void;
  let error: (failure: Error) => void;
  const cleanup = () => {
    req.off('data', data);
    req.off('end', end);
    req.off('error', error);
  };
  return new ReadableStream<Uint8Array>({
    start(controller) {
      data = chunk => {
        controller.enqueue(new Uint8Array(chunk));
        if ((controller.desiredSize ?? 0) <= 0) req.pause();
      };
      end = () => {
        cleanup();
        controller.close();
      };
      error = failure => {
        cleanup();
        controller.error(failure);
      };
      req.on('data', data);
      req.on('end', end);
      req.on('error', error);
    },
    pull() {
      req.resume();
    },
    cancel() {
      cleanup();
      req.resume();
    },
  });
}

/** The dev/preview server uses the same Request handlers and headers as deployment. */
export function productionBoundary(): Plugin {
  const install = (middlewares: Connect.Server, development: boolean) => {
    middlewares.use(async (req, res, next) => {
      const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
      for (const rule of deployment.headers) {
        if (!new RegExp(`^${rule.source}$`).test(url.pathname)) continue;
        for (const header of rule.headers) {
          // Vite's development refresh preamble is inline. Built pages stay strict.
          const value =
            development && header.key === 'Content-Security-Policy'
              ? header.value.replace("script-src 'self'", "script-src 'self' 'unsafe-inline'")
              : header.value;
          res.setHeader(header.key, value);
        }
      }
      const handler = url.pathname === '/api/action' ? login : url.pathname === '/api/replay' ? replay : null;
      if (!handler) {
        next();
        return;
      }
      try {
        const headers = new Headers();
        for (const [key, value] of Object.entries(req.headers)) {
          for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value])
            headers.append(key, item);
        }
        const method = req.method || 'GET';
        const init: RequestInit & { duplex?: string } = { method, headers };
        if (!['GET', 'HEAD'].includes(method)) {
          init.body = requestBody(req);
          init.duplex = 'half';
        }
        const response = await handler(new Request(url, init));
        res.statusCode = response.status;
        response.headers.forEach((value, key) => res.setHeader(key, value));
        res.end(Buffer.from(await response.arrayBuffer()));
      } catch {
        res.statusCode = 500;
        res.setHeader('Cache-Control', 'no-store');
        res.end('The local API could not process the request.');
      }
    });
  };
  return {
    name: 'arena-production-boundary',
    configureServer(server) {
      install(server.middlewares, true);
    },
    configurePreviewServer(server) {
      install(server.middlewares, false);
    },
  };
}

import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Readable } from 'node:stream';
import type { MediaManager } from './api';

type Handler = (request: Request) => Promise<Response>;

/** Adapt a Web-standard handler to `node:http` (Express, Connect, Vite middleware, …). */
export function toNodeHandler(handler: Handler) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value === undefined) continue;
      for (const item of Array.isArray(value) ? value : [value]) headers.append(key, item);
    }
    const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
    const request = new Request(`http://${req.headers.host ?? 'localhost'}${req.url ?? '/'}`, {
      method: req.method,
      headers,
      body: hasBody ? (Readable.toWeb(req) as ReadableStream) : undefined,
      duplex: hasBody ? 'half' : undefined,
    } as RequestInit);

    const response = await handler(request);
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  };
}

export interface DevServer {
  port: number;
  url: string;
  close(): Promise<void>;
}

/**
 * Serve the API on 127.0.0.1 only. Frameworks proxy their `basePath` to it in development.
 */
export function startDevServer(
  manager: Pick<MediaManager, 'handler'>,
  port = 0,
): Promise<DevServer> {
  const server: Server = createServer(toNodeHandler(manager.handler));
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      const { port: actual } = server.address() as AddressInfo;
      server.unref();
      resolve({
        port: actual,
        url: `http://127.0.0.1:${actual}`,
        close: () => new Promise((done) => server.close(() => done())),
      });
    });
  });
}

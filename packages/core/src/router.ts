/**
 * A minimal Web-standard router: one `handler(Request) → Response` that any framework can mount
 * (Next.js route handlers, TanStack Start server routes, Node, Bun, …).
 */

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export interface RouteContext {
  request: Request;
  /** Parsed JSON, or a FormData for multipart requests */
  body: unknown;
}

export interface Route {
  method: 'GET' | 'POST';
  /** Return data (sent as JSON) or a Response */
  handle(ctx: RouteContext): Promise<unknown>;
}

export interface RouterOptions {
  basePath: string;
  routes: Record<string, Route>;
  /** Runs before the body is read; return a Response to stop the request */
  onRequest?: (request: Request) => Response | undefined;
  /** Map thrown errors to HttpError; anything else becomes a 500 */
  mapError?: (error: unknown) => unknown;
}

export function json(status: number, data: unknown): Response {
  return Response.json(data, { status, headers: { 'cache-control': 'no-store' } });
}

async function readBody(request: Request): Promise<unknown> {
  if (request.method === 'GET') return undefined;
  const type = request.headers.get('content-type') ?? '';
  if (type.includes('multipart/form-data')) return request.formData();
  if (type.includes('application/json')) return request.json();
  throw new HttpError(415, 'INVALID', 'Expected JSON or multipart/form-data.');
}

export function createRouter({ basePath, routes, onRequest, mapError }: RouterOptions) {
  return async function handler(request: Request): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (!pathname.startsWith(`${basePath}/`))
      return json(404, { code: 'NOT_FOUND', message: 'Not found.' });

    const route = routes[pathname.slice(basePath.length)];
    if (!route) return json(404, { code: 'NOT_FOUND', message: 'Not found.' });
    if (route.method !== request.method)
      return json(405, { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed.' });

    const early = onRequest?.(request);
    if (early) return early;

    try {
      const result = await route.handle({ request, body: await readBody(request) });
      return result instanceof Response ? result : json(200, result);
    } catch (error) {
      const mapped = mapError ? mapError(error) : error;
      if (mapped instanceof HttpError)
        return json(mapped.status, { code: mapped.code, message: mapped.message });
      console.error('[mdx-media-manager]', error);
      return json(500, { code: 'INTERNAL', message: 'Internal error, see the dev server log.' });
    }
  };
}

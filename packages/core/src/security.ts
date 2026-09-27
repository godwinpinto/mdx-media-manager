/** Every request from the overlay carries this header. Cross-site pages cannot set it without a
 * CORS preflight, which the API never approves. */
export const CLIENT_HEADER = 'x-mdx-media-manager';

const localHost = /^(localhost|127(?:\.\d{1,3}){3}|\[?::1\]?|[a-z0-9-]+\.localhost)$/i;

function hostnameOf(value: string): string | undefined {
  try {
    return new URL(value.includes('://') ? value : `http://${value}`).hostname;
  } catch {
    return undefined;
  }
}

function isAllowedHost(hostname: string | undefined, allowedHosts: string[]): boolean {
  return !!hostname && (localHost.test(hostname) || allowedHosts.includes(hostname));
}

/**
 * Only the local developer's browser may use the API: the host must be local (defeats DNS
 * rebinding), a browser Origin must be local (defeats cross-site requests) and the custom
 * header must be present (defeats simple-request CSRF).
 *
 * @returns an error message, or `undefined` when the request is allowed
 */
export function checkRequest(request: Request, allowedHosts: string[] = []): string | undefined {
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? '';
  if (!isAllowedHost(hostnameOf(host.split(',')[0]!.trim()), allowedHosts)) {
    return `Host "${host}" is not allowed.`;
  }

  const origin = request.headers.get('origin');
  if (
    origin !== null &&
    !isAllowedHost(origin === 'null' ? undefined : hostnameOf(origin), allowedHosts)
  ) {
    return `Origin "${origin}" is not allowed.`;
  }

  if (request.method !== 'GET' && request.headers.get(CLIENT_HEADER) !== '1') {
    return `Missing ${CLIENT_HEADER} header.`;
  }
}

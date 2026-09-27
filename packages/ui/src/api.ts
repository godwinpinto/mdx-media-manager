import type { SourceTag } from './dom';

export interface Crop {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Output {
  format?: 'webp' | 'avif' | 'png' | 'jpeg';
  quality?: number;
  maxWidth?: number;
  width?: number;
  height?: number;
}

export interface Status {
  ok: true;
  image: Required<Pick<Output, 'format' | 'quality' | 'maxWidth'>>;
  maxUploadSize: number;
}

export interface EditResponse {
  file: string;
  hash: string;
  url?: string;
  removed?: string;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const target = (tag: SourceTag) => ({
  line: tag.line,
  column: tag.column,
  element: tag.element,
  sibling: tag.sibling,
});

export function createApi(basePath: string) {
  async function call<T>(path: string, init?: RequestInit): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${basePath}${path}`, {
        ...init,
        headers: { 'x-mdx-media-manager': '1', ...init?.headers },
      });
    } catch {
      throw new ApiError(
        0,
        'NETWORK',
        'Could not reach the media manager. Is the dev server running?',
      );
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok)
      throw new ApiError(res.status, data.code ?? 'ERROR', data.message ?? res.statusText);
    return data as T;
  }

  function upload<T>(path: string, file: File, meta: object) {
    const body = new FormData();
    body.set('file', file);
    body.set('meta', JSON.stringify(meta));
    return call<T>(path, { method: 'POST', body });
  }

  return {
    status: () => call<Status>('/status'),

    insert: (
      tag: SourceTag,
      position: 'before' | 'after',
      file: File,
      options: { alt: string; crop?: Crop; output?: Output },
    ) =>
      upload<EditResponse>('/images/insert', file, {
        file: tag.file,
        hash: tag.hash,
        target: target(tag),
        position,
        ...options,
      }),

    replace: (
      tag: SourceTag,
      url: string,
      file: File,
      options: { alt?: string; crop?: Crop; output?: Output },
    ) =>
      upload<EditResponse>('/images/replace', file, {
        file: tag.file,
        hash: tag.hash,
        image: { target: target(tag), url },
        ...options,
      }),

    remove: (tag: SourceTag, url: string) =>
      call<EditResponse>('/images/delete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          file: tag.file,
          hash: tag.hash,
          image: { target: target(tag), url },
        }),
      }),
  };
}

export type Api = ReturnType<typeof createApi>;

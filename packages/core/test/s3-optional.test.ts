import { describe, expect, it } from 'vitest';
import { createS3Store, MISSING_SDK, resolveS3Options } from '../src/s3';

describe('S3 without the AWS SDK installed', () => {
  const options = resolveS3Options({ bucket: 'b', cdnUrl: 'https://cdn.test' });
  const missing = () =>
    Promise.reject(
      Object.assign(new Error("Cannot find package '@aws-sdk/client-s3'"), {
        code: 'ERR_MODULE_NOT_FOUND',
      }),
    );

  it('explains how to install it', async () => {
    const store = createS3Store(options, missing);
    await expect(store.connect()).rejects.toThrow(MISSING_SDK);
    await expect(store.head('images/a.webp')).rejects.toThrow(MISSING_SDK);
    // URLs don't need the SDK
    expect(store.urlOf('images/a.webp')).toBe('https://cdn.test/images/a.webp');
  });

  it('picks the SDK up once it is installed, without a restart', async () => {
    let installed = false;
    const store = createS3Store(options, () =>
      installed ? import('@aws-sdk/client-s3') : missing(),
    );
    await expect(store.connect()).rejects.toThrow(MISSING_SDK);
    installed = true;
    await expect(store.connect()).resolves.toBeUndefined();
  });

  it('passes other load errors through', async () => {
    const store = createS3Store(options, () => Promise.reject(new Error('boom')));
    await expect(store.connect()).rejects.toThrow('boom');
  });
});

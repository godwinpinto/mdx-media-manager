import { createHash } from 'node:crypto';

/**
 * Identifies one revision of a source file. The page embeds it at compile time; edits are
 * rejected when the file on disk no longer has the same hash.
 */
export function hashSource(source: string): string {
  return createHash('sha256').update(source).digest('hex').slice(0, 16);
}

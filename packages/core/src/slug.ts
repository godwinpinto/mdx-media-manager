/**
 * File-name rules shared by the server and the overlay (browser-safe, no Node APIs).
 * Names become URL- and file-system-friendly slugs; a content hash and extension are appended
 * separately, so reserved names like `con` or `nul` never form a whole file name.
 */

export const MAX_NAME_LENGTH = 60;

/** Letters that Unicode normalization doesn't reduce to ASCII */
const transliterations: Record<string, string> = {
  ß: 'ss',
  æ: 'ae',
  œ: 'oe',
  ø: 'o',
  đ: 'd',
  ð: 'd',
  þ: 'th',
  ł: 'l',
  ı: 'i',
};

/** The slug before shortening */
function fullSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[ßæœøđðþłı]/g, (c) => transliterations[c] ?? c)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** `Café Überstraße (v2)` → `cafe-uberstrasse-v2`. Empty when nothing usable is left. */
export function toSlug(text: string): string {
  return fullSlug(text).slice(0, MAX_NAME_LENGTH).replace(/-+$/, '');
}

/** Like `toSlug`, but never empty */
export function slugify(text: string): string {
  return toSlug(text) || 'image';
}

export interface NameCheck {
  /** What will be written */
  slug: string;
  /** No letters or digits left: the name can't be used */
  error?: string;
  /** Adjustments that will be made, for the user to see */
  notes: string[];
}

export function checkName(input: string): NameCheck {
  const value = input.trim();
  const slug = toSlug(value);
  if (!value) return { slug: '', error: 'Enter a file name.', notes: [] };
  if (!slug) {
    return { slug: '', error: 'Use at least one letter (a–z) or number.', notes: [] };
  }

  const notes: string[] = [];
  if (slug !== value) notes.push('Only lowercase letters, numbers and hyphens are kept.');
  if (fullSlug(value).length > MAX_NAME_LENGTH) {
    notes.push(`Names are shortened to ${MAX_NAME_LENGTH} characters.`);
  }
  if (/[^\p{Script=Latin}\p{N}\p{P}\p{Z}\p{S}]/u.test(value)) {
    notes.push('Characters outside the Latin alphabet are removed.');
  }
  return { slug, notes };
}

import { describe, expect, it } from 'vitest';
import { checkName, slugify } from '../src/slug';

describe('slugify', () => {
  it.each([
    ['System Diagram (v2)', 'system-diagram-v2'],
    ['Café Überstraße', 'cafe-uberstrasse'],
    ['Æsir øl', 'aesir-ol'],
    ['../../etc/passwd', 'etc-passwd'],
    ['C:\\Windows\\win.ini', 'c-windows-win-ini'],
    ['  --weird__name--  ', 'weird-name'],
    ['CON', 'con'],
    ['日本語', 'image'],
    ['a'.repeat(80), 'a'.repeat(60)],
    [`${'word-'.repeat(12)}end`, 'word-word-word-word-word-word-word-word-word-word-word-word'],
  ])('%s → %s', (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });
});

describe('checkName', () => {
  it('accepts clean names silently', () => {
    expect(checkName('team-photo-2024')).toEqual({ slug: 'team-photo-2024', notes: [] });
  });

  it('explains adjustments', () => {
    const check = checkName('Team Photo!');
    expect(check.slug).toBe('team-photo');
    expect(check.error).toBeUndefined();
    expect(check.notes).toContain('Only lowercase letters, numbers and hyphens are kept.');
  });

  it('flags removed scripts and shortening', () => {
    expect(checkName('ロゴ logo').notes).toContain(
      'Characters outside the Latin alphabet are removed.',
    );
    expect(checkName('x'.repeat(70)).notes).toContain('Names are shortened to 60 characters.');
  });

  it('rejects names with nothing usable', () => {
    expect(checkName('').error).toBeDefined();
    expect(checkName('!!!').error).toBeDefined();
    expect(checkName('日本語').error).toBeDefined();
  });
});

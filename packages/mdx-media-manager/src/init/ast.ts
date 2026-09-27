import { parseSync } from 'oxc-parser';

export class InitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InitError';
  }
}

export interface AstNode {
  type: string;
  start: number;
  end: number;
  [key: string]: unknown;
}

export function parseProgram(filename: string, code: string): AstNode[] {
  const result = parseSync(filename, code);
  if (result.errors.length > 0) {
    throw new InitError(`Could not parse ${filename}: ${result.errors[0]!.message}`);
  }
  return result.program.body as unknown as AstNode[];
}

/** Match the file's quote and semicolon style when inserting code. */
export function styleOf(code: string): { quote: string; semi: string } {
  const firstImport = /^\s*import\s[^\n]*?(['"])[^'"\n]+\1(;?)/m.exec(code);
  const quote = firstImport?.[1] ?? "'";
  const semi = firstImport ? firstImport[2]! : /;\s*$/m.test(code) ? ';' : '';
  return { quote, semi };
}

export function indentOf(code: string, offset: number): string {
  const lineStart = code.lastIndexOf('\n', offset - 1) + 1;
  return /^[ \t]*/.exec(code.slice(lineStart))![0];
}

export const isTypeScript = (filename: string) => /\.[cm]?tsx?$/.test(filename);

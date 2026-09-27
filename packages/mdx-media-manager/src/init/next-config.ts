import MagicString from 'magic-string';
import { InitError, isTypeScript, parseProgram, styleOf, type AstNode } from './ast';

export type EditResult = { status: 'updated'; code: string } | { status: 'already-configured' };

function helper(ts: boolean, quote: string, semi: string): string {
  const q = (s: string) => `${quote}${s}${quote}`;
  const types = ts
    ? `type MediaManagerInput = Parameters<typeof import(${q('mdx-media-manager/next')}).withMdxMediaManager>[0]${semi}\n\n`
    : '';
  const params = ts
    ? `(input: MediaManagerInput) =>\n  async (phase: string, context: { defaultConfig: import(${q('next')}).NextConfig }) =>`
    : `(input) =>\n  async (phase, context) =>`;

  return `// mdx-media-manager: edit images from the rendered page. Loaded only by \`next dev\`,
// so production builds and \`next start\` never need the package.
${types}const withMediaManager =
  ${params} {
    if (phase === ${q('phase-development-server')}) {
      const { withMdxMediaManager } = await import(${q('mdx-media-manager/next')})${semi}
      return withMdxMediaManager(input)(phase, context)${semi}
    }
    return typeof input === ${q('function')} ? input(phase, context) : input${semi}
  }${semi}

`;
}

/** `export default X` / `module.exports = X` → the statement and the expression X */
function findExport(body: AstNode[]): { statement: AstNode; value: AstNode } | undefined {
  for (const statement of body) {
    if (statement.type === 'ExportDefaultDeclaration') {
      return { statement, value: statement.declaration as AstNode };
    }
    if (statement.type === 'ExpressionStatement') {
      const expression = statement.expression as AstNode;
      const left = expression.left as AstNode | undefined;
      if (
        expression.type === 'AssignmentExpression' &&
        left?.type === 'MemberExpression' &&
        (left.object as AstNode).type === 'Identifier' &&
        (left.object as { name: string }).name === 'module' &&
        (left.property as { name?: string }).name === 'exports'
      ) {
        return { statement, value: expression.right as AstNode };
      }
    }
  }
}

/**
 * Wrap the exported Next.js config with a dev-only `withMediaManager()` helper. The helper is
 * written into the file (instead of imported) so production never resolves the package.
 */
export function addToNextConfig(code: string, filename: string): EditResult {
  if (code.includes('mdx-media-manager')) return { status: 'already-configured' };

  const found = findExport(parseProgram(filename, code));
  if (!found) {
    throw new InitError(`No \`export default\` or \`module.exports\` found in ${filename}.`);
  }

  const { quote, semi } = styleOf(code);
  const s = new MagicString(code);
  s.appendLeft(found.value.start, 'withMediaManager(');
  s.prependRight(found.value.end, ')');
  s.prependLeft(found.statement.start, helper(isTypeScript(filename), quote, semi));
  return { status: 'updated', code: s.toString() };
}

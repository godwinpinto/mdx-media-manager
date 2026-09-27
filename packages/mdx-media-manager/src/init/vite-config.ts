import MagicString from 'magic-string';
import { InitError, indentOf, parseProgram, styleOf, type AstNode } from './ast';
import type { EditResult } from './next-config';

const manualSteps = `Add it manually:

  import { mdxMediaManager } from 'mdx-media-manager/vite';
  // …
  plugins: [mdxMediaManager(), /* your other plugins */],`;

/** The object literal holding the config: `export default defineConfig({…})`, `export default {…}` or `() => ({…})` */
function configObject(value: AstNode | undefined): AstNode | undefined {
  if (!value) return;
  if (value.type === 'ObjectExpression') return value;
  if (value.type === 'CallExpression') return configObject((value.arguments as AstNode[])[0]);
  if (
    value.type === 'TSSatisfiesExpression' ||
    value.type === 'TSAsExpression' ||
    value.type === 'ParenthesizedExpression'
  ) {
    return configObject(value.expression as AstNode);
  }
  if (value.type === 'ArrowFunctionExpression' || value.type === 'FunctionExpression') {
    const body = value.body as AstNode;
    if (body.type !== 'BlockStatement') return configObject(body);
    const returned = (body.body as AstNode[]).find((s) => s.type === 'ReturnStatement');
    return configObject(returned?.argument as AstNode | undefined);
  }
}

function propertyNamed(object: AstNode, name: string): AstNode | undefined {
  return (object.properties as AstNode[]).find((p) => {
    const key = p.key as { type: string; name?: string; value?: unknown } | undefined;
    return p.type === 'Property' && (key?.name === name || key?.value === name);
  });
}

/** Add `mdxMediaManager()` as the first Vite plugin and import it. */
export function addToViteConfig(code: string, filename: string): EditResult {
  if (code.includes('mdx-media-manager')) return { status: 'already-configured' };

  const body = parseProgram(filename, code);
  const exported = body.find((s) => s.type === 'ExportDefaultDeclaration');
  const object = configObject(exported?.declaration as AstNode | undefined);
  if (!object)
    throw new InitError(`Could not find the config object in ${filename}. ${manualSteps}`);

  const { quote, semi } = styleOf(code);
  const s = new MagicString(code);

  const plugins = propertyNamed(object, 'plugins')?.value as AstNode | undefined;
  if (plugins && plugins.type !== 'ArrayExpression') {
    throw new InitError(`\`plugins\` in ${filename} is not an array literal. ${manualSteps}`);
  }

  if (plugins) {
    const first = (plugins.elements as (AstNode | null)[]).find(Boolean);
    if (!first) {
      s.appendLeft(plugins.start + 1, 'mdxMediaManager()');
    } else {
      const multiline = code.slice(plugins.start, first.start).includes('\n');
      s.appendLeft(
        first.start,
        multiline ? `mdxMediaManager(),\n${indentOf(code, first.start)}` : 'mdxMediaManager(), ',
      );
    }
  } else {
    const first = (object.properties as AstNode[])[0];
    if (first) {
      s.appendLeft(first.start, `plugins: [mdxMediaManager()],\n${indentOf(code, first.start)}`);
    } else {
      s.appendLeft(object.start + 1, ' plugins: [mdxMediaManager()] ');
    }
  }

  const lastImport = body.filter((st) => st.type === 'ImportDeclaration').at(-1);
  const importLine = `import { mdxMediaManager } from ${quote}mdx-media-manager/vite${quote}${semi}`;
  if (lastImport) s.appendRight(lastImport.end, `\n${importLine}`);
  else s.prepend(`${importLine}\n\n`);

  return { status: 'updated', code: s.toString() };
}

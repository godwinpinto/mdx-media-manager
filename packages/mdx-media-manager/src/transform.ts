import { readFileSync } from 'node:fs';
import path from 'node:path';
import { hashSource } from '@mdx-media-manager/core/mdx';
import { Parser, type Node } from 'acorn';
import MagicString from 'magic-string';

/**
 * `<file>|<hash>|<line>:<column>|<element>[|<sibling>]` — where a rendered element came from.
 * `sibling` is set on generated blocks without a position (e.g. highlighted code): the element is
 * that many blocks after (or before, when negative) the positioned one.
 */
export const SOURCE_ATTR = 'data-mmm';
/** The image URL as written in source, on rendered images */
export const IMAGE_ATTR = 'data-mmm-img';
/**
 * `<line>:<column>|<Component>;…`: the components (outermost first, same file) an element is
 * rendered inside. Lets the overlay find components that don't pass `data-mmm` through to the DOM.
 */
export const WITHIN_ATTR = 'data-mmm-in';
/** Set on images whose file doesn't exist (rendered as a placeholder) */
export const MISSING_ATTR = 'data-mmm-missing';

export interface TransformOptions {
  /** Absolute path of the MDX file being compiled */
  resourcePath: string;
  /** Raw content of that file, as on disk */
  source: string;
  /** Project root; file paths in the page are relative to it */
  root: string;
  /** Static folder, used to turn image imports back into URLs */
  publicDir: string;
  /** Module that exports `MediaManagerOverlay`: a package specifier, or an absolute file path */
  clientModule: string;
  basePath: string;
  /** Original URLs of images replaced by `placeholderFile`, in document order */
  missing?: string[];
  placeholderFile?: string;
}

interface AnyNode extends Node {
  [key: string]: unknown;
}

const skippedElements = new Set(['_Fragment', 'MDXLayout', '_createMdxContent']);

function isNode(value: unknown): value is AnyNode {
  return typeof value === 'object' && value !== null && typeof (value as AnyNode).type === 'string';
}

function propertyValue(object: AnyNode, key: string): AnyNode | undefined {
  for (const property of object.properties as AnyNode[]) {
    if (property.type !== 'Property') continue;
    const k = property.key as AnyNode;
    if ((k.type === 'Identifier' && k.name === key) || (k.type === 'Literal' && k.value === key)) {
      return property.value as AnyNode;
    }
  }
}

function literal<T extends string | number>(
  node: AnyNode | undefined,
  type: 'string' | 'number',
): T | undefined {
  return node?.type === 'Literal' && typeof node.value === type ? (node.value as T) : undefined;
}

/** `_components.p` → `p`, `Callout` → `Callout`, `"div"` → `div` */
function elementName(node: AnyNode): string | undefined {
  if (node.type === 'MemberExpression' && (node.object as AnyNode).type === 'Identifier') {
    const property = node.property as AnyNode;
    if (property.type === 'Identifier') return property.name as string;
  }
  if (node.type === 'Identifier' && !skippedElements.has(node.name as string))
    return node.name as string;
  if (node.type === 'Literal' && typeof node.value === 'string') return node.value;
}

/**
 * Rewrite compiled development-mode MDX so the page can be edited from the browser:
 *
 * - every `jsxDEV(el, props, …, { fileName, lineNumber, columnNumber })` call gets a
 *   `data-mmm` prop with its source location and the file's revision hash;
 * - images get `data-mmm-img` with their URL as written in source (Fumadocs turns
 *   `![](/a.png)` into a static import, so the rendered `src` is a hashed asset URL);
 * - the default export also renders the overlay.
 */
export function transformCompiledMdx(code: string, options: TransformOptions): string {
  const ast = Parser.parse(code, {
    ecmaVersion: 'latest',
    sourceType: 'module',
  }) as unknown as AnyNode;
  const s = new MagicString(code);

  const hashes = new Map<string, string>([[options.resourcePath, hashSource(options.source)]]);
  const hashOf = (file: string) => {
    let hash = hashes.get(file);
    if (hash === undefined) {
      try {
        hash = hashSource(readFileSync(file, 'utf8'));
      } catch {
        hash = '';
      }
      hashes.set(file, hash);
    }
    return hash;
  };
  const relative = (file: string) => path.relative(options.root, file).split(path.sep).join('/');

  // Default imports of files (`import __img0 from "../../public/a.png"`) → public URLs
  const importedUrls = new Map<string, string>();
  /** Imports of the missing-image placeholder */
  const placeholderIds = new Set<string>();
  const missing = [...(options.missing ?? [])];
  for (const statement of ast.body as AnyNode[]) {
    if (statement.type !== 'ImportDeclaration') continue;
    const specifier = (statement.specifiers as AnyNode[]).find(
      (s) => s.type === 'ImportDefaultSpecifier',
    );
    const from = literal<string>(statement.source as AnyNode, 'string');
    if (!specifier || !from || !from.startsWith('.')) continue;
    const file = path.resolve(path.dirname(options.resourcePath), from.split('?')[0]!);
    if (options.placeholderFile && file === options.placeholderFile) {
      placeholderIds.add((specifier.local as AnyNode).name as string);
      continue;
    }
    const inPublic = path.relative(options.publicDir, file);
    if (!inPublic.startsWith('..') && !path.isAbsolute(inPublic)) {
      importedUrls.set(
        (specifier.local as AnyNode).name as string,
        `/${inPublic.split(path.sep).join('/')}`,
      );
    }
  }

  const addProp = (props: AnyNode, key: string, value: string) => {
    s.appendLeft(props.start + 1, `${JSON.stringify(key)}: ${JSON.stringify(value)}, `);
  };

  const imageUrlOf = (props: AnyNode): string | undefined => {
    const src = propertyValue(props, 'src');
    if (!src) return;
    if (src.type === 'Identifier') return importedUrls.get(src.name as string);
    return literal<string>(src, 'string');
  };

  /** The `data-mmm` value of a `jsxDEV(…)` call that carries a source position */
  const positionTag = (node: AnyNode): string | undefined => {
    if (node.type !== 'CallExpression') return;
    const args = node.arguments as AnyNode[];
    const location = args[4];
    const element = args[0] && elementName(args[0]);
    if (!element || location?.type !== 'ObjectExpression') return;
    const fileName = literal<string>(propertyValue(location, 'fileName'), 'string');
    const line = literal<number>(propertyValue(location, 'lineNumber'), 'number');
    const column = literal<number>(propertyValue(location, 'columnNumber'), 'number');
    if (fileName && line && column)
      return `${relative(fileName)}|${hashOf(fileName)}|${line}:${column}|${element}`;
  };

  const isElementCall = (node: AnyNode) =>
    node.type === 'CallExpression' &&
    !!(node.arguments as AnyNode[])[0] &&
    !!elementName((node.arguments as AnyNode[])[0]!);

  /** Generated siblings (no position) → tag relative to the nearest positioned sibling */
  const siblingTags = new Map<AnyNode, string>();
  /** `jsxDEV(_Fragment, { children: jsxDEV(el, …) })` counts as `el` (e.g. highlighted code) */
  const unwrapFragment = (node: AnyNode): AnyNode => {
    if (node.type !== 'CallExpression') return node;
    const [type, props] = node.arguments as AnyNode[];
    if (
      type?.type !== 'Identifier' ||
      type.name !== '_Fragment' ||
      props?.type !== 'ObjectExpression'
    )
      return node;
    const child = propertyValue(props, 'children');
    return child?.type === 'CallExpression' ? unwrapFragment(child) : node;
  };

  const tagSiblings = (items: AnyNode[]) => {
    const calls = items.map(unwrapFragment).filter(isElementCall);
    calls.forEach((call, i) => {
      if (positionTag(call) || elementName((call.arguments as AnyNode[])[0]!) === 'img') return;
      for (let d = 1; d < calls.length; d++) {
        const before = calls[i - d] && positionTag(calls[i - d]!);
        if (before) return void siblingTags.set(call, `${before}|${d}`);
        const after = calls[i + d] && positionTag(calls[i + d]!);
        if (after) return void siblingTags.set(call, `${after}|${-d}`);
      }
    });
  };

  const isComponent = (element: string) => /^[A-Z]/.test(element);

  const walk = (node: AnyNode, parentTag: string | undefined, within: string[]): void => {
    let tag = parentTag;
    let inner = within;

    if (node.type === 'ArrayExpression')
      tagSiblings((node.elements as (AnyNode | null)[]).filter((e): e is AnyNode => !!e));

    if (node.type === 'CallExpression') {
      const args = node.arguments as AnyNode[];
      const props = args[1];
      const element = args[0] && elementName(args[0]);
      if (element && props?.type === 'ObjectExpression') {
        const own = positionTag(node);
        const sibling = siblingTags.get(node);
        const written = own ?? sibling ?? (element === 'img' ? parentTag : undefined);
        if (written) {
          // Generated image nodes have no position: they point at the block that contains them.
          addProp(props, SOURCE_ATTR, written);
          const file = written.split('|')[0];
          const chain = within
            .filter((entry) => entry.startsWith(`${file}|`))
            .map((entry) => entry.slice(file!.length + 1));
          if (chain.length) addProp(props, WITHIN_ATTR, chain.join(';'));
        }
        if (own) {
          tag = own;
          if (isComponent(element)) {
            // `file|line:column|Component` for descendants; the hash is the file's, not needed twice.
            const [file, , position] = own.split('|');
            inner = [...within, `${file}|${position}|${element}`];
          }
        }

        if (element === 'img' || element === 'Image') {
          const src = propertyValue(props, 'src');
          if (src?.type === 'Identifier' && placeholderIds.has(src.name as string)) {
            // Images are compiled in document order, the same order they were substituted in.
            const original = missing.shift();
            if (original) addProp(props, IMAGE_ATTR, original);
            addProp(props, MISSING_ATTR, 'true');
          } else {
            const url = imageUrlOf(props);
            if (url) addProp(props, IMAGE_ATTR, url);
          }
        }
      }
    }

    for (const key in node) {
      if (key === 'type' || key === 'start' || key === 'end') continue;
      const value = node[key];
      if (Array.isArray(value)) {
        for (const child of value) if (isNode(child)) walk(child, tag, inner);
      } else if (isNode(value)) {
        walk(value, tag, inner);
      }
    }
  };
  walk(ast, undefined, []);

  injectOverlay(ast, s, options);
  return s.toString();
}

function injectOverlay(ast: AnyNode, s: MagicString, options: TransformOptions): void {
  const statement = (ast.body as AnyNode[]).find(
    (node) => node.type === 'ExportDefaultDeclaration',
  );
  if (!statement) return;

  const declaration = statement.declaration as AnyNode;
  let content: string;
  if (declaration.type === 'FunctionDeclaration' && declaration.id) {
    // `export default function MDXContent` → `function MDXContent`
    s.remove(statement.start, declaration.start);
    content = (declaration.id as AnyNode).name as string;
  } else {
    s.overwrite(statement.start, declaration.start, 'const __mmm_Content = ');
    content = '__mmm_Content';
  }

  const props = JSON.stringify({ basePath: options.basePath });
  // A file path becomes relative to the MDX file (bundlers treat `/abs` as project-relative).
  let clientModule = options.clientModule;
  if (path.isAbsolute(clientModule)) {
    clientModule = path
      .relative(path.dirname(options.resourcePath), clientModule)
      .split(path.sep)
      .join('/');
    if (!clientModule.startsWith('.')) clientModule = `./${clientModule}`;
  }
  s.append(`
import { createElement as __mmm_h, Fragment as __mmm_Fragment } from "react";
import { MediaManagerOverlay as __mmm_Overlay } from ${JSON.stringify(clientModule)};
export default function MDXContentWithMediaManager(props) {
  return __mmm_h(__mmm_Fragment, null, __mmm_h(${content}, props), __mmm_h(__mmm_Overlay, ${props}));
}
`);
}

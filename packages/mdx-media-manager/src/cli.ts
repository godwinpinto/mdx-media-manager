#!/usr/bin/env node
import { parseArgs, styleText } from 'node:util';
import type { Framework } from './init/detect';
import { init, InitError } from './init';

const help = `Usage: mdx-media-manager init [options]

Set up in-page image editing for your MDX docs (development only).

Options:
  --cwd <dir>             App folder (default: current directory)
  --framework <name>      next | vite (default: detected from config files)
  --no-install            Don't add the package to devDependencies
  --dry-run               Show what would change without writing anything
  -h, --help              Show this help
`;

const symbols = {
  ok: styleText('green', '✔'),
  info: styleText('cyan', '›'),
  warn: styleText('yellow', '!'),
};

function main(argv: string[]): number {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      cwd: { type: 'string' },
      framework: { type: 'string' },
      install: { type: 'boolean', default: true },
      'no-install': { type: 'boolean' },
      'dry-run': { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
    },
  });

  const [command] = positionals;
  if (values.help || !command) {
    process.stdout.write(help);
    return values.help ? 0 : 1;
  }
  if (command !== 'init') {
    process.stderr.write(`Unknown command: ${command}\n\n${help}`);
    return 1;
  }
  if (values.framework && values.framework !== 'next' && values.framework !== 'vite') {
    process.stderr.write(`--framework must be "next" or "vite".\n`);
    return 1;
  }

  try {
    init({
      cwd: values.cwd ?? process.cwd(),
      framework: values.framework as Framework | undefined,
      install: values.install !== false && !values['no-install'],
      dryRun: !!values['dry-run'],
      log: (kind, message) => console.log(`${symbols[kind]} ${message}`),
    });
    return 0;
  } catch (error) {
    console.error(
      `${styleText('red', '✖')} ${error instanceof Error ? error.message : String(error)}`,
    );
    if (!(error instanceof InitError) && error instanceof Error && process.env.DEBUG)
      console.error(error.stack);
    return 1;
  }
}

process.exitCode = main(process.argv.slice(2));

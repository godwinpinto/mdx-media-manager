# mdx-media-manager monorepo

Add, edit and delete images in your MDX docs from the rendered page, during development.
Repository: https://github.com/godwinpinto/mdx-media-manager

| Path                         | Package                   | What                                                                                         |
| ---------------------------- | ------------------------- | -------------------------------------------------------------------------------------------- |
| `packages/mdx-media-manager` | `mdx-media-manager`       | Public entry: Next.js and Vite integrations, MDX loader, `init` CLI, client + server exports |
| `packages/core`              | `@mdx-media-manager/core` | Framework-agnostic API, MDX source editing, image processing, library, S3 storage            |
| `packages/ui`                | `@mdx-media-manager/ui`   | In-page overlay and library (React, shadow DOM)                                              |
| `packages/tsconfig`          | —                         | Shared TypeScript configs                                                                    |
| `apps/docs`                  | `docs`                    | The documentation site (Next.js + Fumadocs), port 3002                                       |
| `apps/next`                  | `next-app`                | Next.js + Fumadocs example: docs, blog and handbook collections, port 3000                   |
| `apps/tanstack-start`        | `tanstack-start-app`      | TanStack Start + Fumadocs example: docs and blog, port 3001                                  |
| `shared/handbook`            | —                         | Content outside the apps (monorepo case), rendered by `apps/next` at `/handbook`             |

```bash
pnpm install
pnpm build          # build packages (turbo)
pnpm test           # vitest
pnpm --filter docs dev                 # Documentation  → http://localhost:3002
pnpm --filter next-app dev             # Next.js        → http://localhost:3000/docs
pnpm --filter tanstack-start-app dev   # TanStack Start → http://localhost:3001/docs
```

Hover the docs content. See
[packages/mdx-media-manager/README.md](packages/mdx-media-manager/README.md).

## License

[MIT](LICENSE) © Godwin Pinto

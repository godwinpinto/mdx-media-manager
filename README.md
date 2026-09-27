# mdx-media-manager monorepo

| Path                         | Package                   | What                                                                   |
| ---------------------------- | ------------------------- | ---------------------------------------------------------------------- |
| `packages/mdx-media-manager` | `mdx-media-manager`       | Public entry: Next.js integration, MDX loader, client + server exports |
| `packages/core`              | `@mdx-media-manager/core` | Framework-agnostic API, MDX source editing, image processing           |
| `packages/ui`                | `@mdx-media-manager/ui`   | In-page overlay (React, shadow DOM)                                    |
| `packages/tsconfig`          | —                         | Shared TypeScript configs                                              |
| `apps/docs`                  | —                         | Next.js + Fumadocs example (home page + lorem ipsum docs)              |

```bash
pnpm install
pnpm build          # build packages (turbo)
pnpm test           # vitest
pnpm --filter docs dev       # Next.js      → http://localhost:3000/docs
pnpm --filter tanstack dev   # TanStack     → http://localhost:3001/docs
```

Hover the docs content. See
[packages/mdx-media-manager/README.md](packages/mdx-media-manager/README.md).

# mdx-media-manager monorepo

| Path | Package | What |
| --- | --- | --- |
| `packages/mdx-media-manager` | `mdx-media-manager` | Public entry: Next.js integration, MDX loader, client + server exports |
| `packages/core` | `@mdx-media-manager/core` | Framework-agnostic API, MDX source editing, image processing |
| `packages/ui` | `@mdx-media-manager/ui` | In-page overlay (React, shadow DOM) |
| `packages/tsconfig` | — | Shared TypeScript configs |
| `apps/docs` | — | Next.js + Fumadocs example (home page + lorem ipsum docs) |

```bash
pnpm install
pnpm build          # build packages (turbo)
pnpm test           # vitest
pnpm --filter docs dev
```

Open http://localhost:3000/docs and hover the content. See
[packages/mdx-media-manager/README.md](packages/mdx-media-manager/README.md).

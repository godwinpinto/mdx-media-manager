# shared

Content that lives outside the example apps, like a shared docs package in a monorepo.
`apps/docs` renders `shared/handbook` at `/handbook`; mdx-media-manager finds it from the
Fumadocs config (`defineDocs({ dir: '../../shared/handbook' })`) and allows editing it.

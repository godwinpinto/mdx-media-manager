# Releasing

One package is published: `mdx-media-manager` (`packages/mdx-media-manager`). `packages/core`
and `packages/ui` are internal and bundled into it.

## Everyday flow

1. With each change worth releasing, add a changeset: `pnpm changeset` (pick `mdx-media-manager`,
   patch / minor / major, one line for the changelog). Commit it with the change.
2. On every push to `main`, the Release workflow opens (or updates) a **Version packages** PR that
   bumps the version and writes `CHANGELOG.md`.
3. Merge that PR. The workflow publishes to npm with provenance, tags the release and creates a
   GitHub release.

## Beta releases (current)

Changesets is in pre-release mode (`.changeset/pre.json`, tag `beta`): versions come out as
`0.1.0-beta.0`, `0.1.0-beta.1`, … and are published under npm's `beta` tag
(`npm install -D mdx-media-manager@beta`). When the beta is done:

```bash
pnpm changeset pre exit
pnpm changeset version   # 0.1.0, published as `latest`
```

## One-time setup

npm can only trust GitHub Actions for a package that already exists, so the first release is
published by hand.

1. **npm account.** Sign in at npmjs.com with two-factor authentication on, then on this machine:

   ```bash
   npm login
   ```

2. **First publish (0.1.0-beta.0).** From the repository root, on an up-to-date `main`:

   ```bash
   pnpm install
   pnpm release
   git push --follow-tags
   ```

   `pnpm release` builds the packages and publishes `mdx-media-manager@0.1.0-beta.0` under the
   `beta` tag (npm asks for a one-time password). It also creates the tag
   `mdx-media-manager@0.1.0-beta.0`, which the push sends to GitHub.

3. **Trusted publisher.** On npmjs.com, open the package's **Settings → Trusted publishing** and
   add a GitHub Actions publisher:
   - Organization or user: `godwinpinto`
   - Repository: `mdx-media-manager`
   - Workflow filename: `release.yml`
   - Allow **direct publishing** (`npm publish`). Publishers created after 3 September 2026
     only allow staged publishing by default, and the workflow publishes directly.

   Then, under **Publishing access**, choose "Require two-factor authentication and disallow
   tokens", so only the workflow (and you, with 2FA) can publish.

4. **GitHub settings** for `godwinpinto/mdx-media-manager`:
   - **Settings → Actions → General → Workflow permissions:** tick "Allow GitHub Actions to
     create and approve pull requests" (for the Version packages PR).
   - **Settings → Secrets and variables → Actions → Variables:** add
     `NPM_TRUSTED_PUBLISHING` = `true`. The Release workflow is skipped until this is set.

From then on, releases need no npm tokens: merging the Version packages PR is the release.

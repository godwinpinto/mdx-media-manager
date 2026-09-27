import { checkName } from '@mdx-media-manager/core/slug';
import { useEffect, useMemo, useState } from 'react';
import { ApiError, type Api, type LibraryImage, type LibraryScan, type LibraryUsage } from './api';

type Filter = 'all' | 'unused' | 'missing-alt' | 'broken';

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export const isUnused = (image: LibraryImage) =>
  image.usages.length === 0 && image.mentions.length === 0;
export const hasMissingAlt = (image: LibraryImage) =>
  image.usages.some((usage) => !usage.alt.trim());

/** The alt text used most often for an image, as a starting point */
export function commonAlt(image: LibraryImage): string {
  const counts = new Map<string, number>();
  for (const { alt } of image.usages) if (alt.trim()) counts.set(alt, (counts.get(alt) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
}

/** Link to the page, with a hash the overlay uses to scroll to and highlight the spot */
export function openHref(
  usage: Pick<LibraryUsage, 'file' | 'line' | 'pageUrl'>,
): string | undefined {
  if (!usage.pageUrl) return;
  return `${usage.pageUrl}#mmm=${encodeURIComponent(usage.file)}:${usage.line}`;
}

function matches(image: LibraryImage, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    image.url.toLowerCase().includes(q) ||
    image.usages.some((u) => u.alt.toLowerCase().includes(q) || u.file.toLowerCase().includes(q))
  );
}

export function useLibrary(api: Api) {
  const [scan, setScan] = useState<LibraryScan>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);

  const reload = () => {
    setLoading(true);
    return api
      .library()
      .then((result) => {
        setScan(result);
        setError(undefined);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  };

  // oxlint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => void reload(), [api]);
  return { scan, error, loading, reload };
}

export function ImageGrid({
  images,
  selected,
  onSelect,
  compact,
}: {
  images: LibraryImage[];
  selected?: string;
  onSelect(image: LibraryImage): void;
  compact?: boolean;
}) {
  if (images.length === 0) return <p className="muted empty">No images match.</p>;
  return (
    <div className={`grid ${compact ? 'compact' : ''}`} role="listbox" aria-label="Images">
      {images.map((image) => {
        const unused = isUnused(image);
        const missingAlt = hasMissingAlt(image);
        return (
          <button
            type="button"
            key={image.url}
            role="option"
            aria-selected={selected === image.url}
            className={`card ${selected === image.url ? 'selected' : ''}`}
            onClick={() => onSelect(image)}
            title={image.url}
          >
            <span className="thumb">
              <img src={image.url} alt="" loading="lazy" decoding="async" />
            </span>
            <span className="card-name">{image.label}</span>
            <span className="card-meta muted">
              {image.width && image.height ? `${image.width}×${image.height} · ` : ''}
              {formatBytes(image.size)}
            </span>
            <span className="badges">
              <span className="badge">
                {image.usages.length} use{image.usages.length === 1 ? '' : 's'}
              </span>
              {unused && <span className="badge warn">unused</span>}
              {missingAlt && <span className="badge warn">no alt</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Image grid with search, for picking an existing image to insert */
export function LibraryPicker({
  api,
  selected,
  onSelect,
}: {
  api: Api;
  selected?: string;
  onSelect(image: LibraryImage): void;
}) {
  const { scan, error, loading } = useLibrary(api);
  const [query, setQuery] = useState('');
  const images = (scan?.images ?? []).filter((image) => matches(image, query));

  return (
    <div className="picker">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.currentTarget.value)}
        placeholder="Search images by name or alt text"
        aria-label="Search images"
      />
      {error ? (
        <p className="error">{error}</p>
      ) : loading && !scan ? (
        <p className="muted empty">Loading images…</p>
      ) : (
        <ImageGrid images={images} selected={selected} onSelect={onSelect} compact />
      )}
    </div>
  );
}

function UsageList({ usages }: { usages: LibraryUsage[] }) {
  return (
    <ul className="usages">
      {usages.map((usage) => {
        const href = openHref(usage);
        const label = `${usage.pageUrl ?? usage.file} · line ${usage.line}`;
        return (
          <li key={`${usage.file}:${usage.line}:${usage.column}`}>
            {href ? <a href={href}>{label}</a> : <span>{label}</span>}
            <span className="muted">
              {usage.element === 'markdown' ? 'Markdown' : `<${usage.element}>`}
              {' · '}
              {usage.alt.trim() ? (
                `alt “${usage.alt}”`
              ) : (
                <span className="warn-text">no alt text</span>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function Details({
  api,
  image,
  onChanged,
}: {
  api: Api;
  image: LibraryImage;
  onChanged(message: string, selectUrl?: string): Promise<void>;
}) {
  const initialName = image.name.replace(/\.[^.]+$/, '').replace(/-[0-9a-f]{8}$/, '');
  const [name, setName] = useState(initialName);
  const [alt, setAlt] = useState(commonAlt(image));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [similar, setSimilar] = useState<string[]>([]);

  const nameCheck = checkName(name);
  const nameChanged = !nameCheck.error && nameCheck.slug !== initialName;
  const codeOnly = image.usages.length === 0 && image.mentions.length > 0;
  const canRename = image.managed && !codeOnly;
  const unused = isUnused(image);

  useEffect(() => {
    setSimilar([]);
    if (!nameChanged) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      api.similarNames(undefined, nameCheck.slug, image.url).then(
        (found) => !cancelled && setSimilar(found),
        () => undefined,
      );
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [nameCheck.slug, nameChanged, image.url]);

  async function run(action: () => Promise<{ message: string; selectUrl?: string }>) {
    setBusy(true);
    setError(undefined);
    try {
      const { message, selectUrl } = await action();
      await onChanged(message, selectUrl);
    } catch (e) {
      setError(e instanceof ApiError || e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const pages = (files: string[]) => `${files.length} page${files.length === 1 ? '' : 's'}`;

  return (
    <aside className="details" aria-label="Image details">
      <div className="preview">
        <img src={image.url} alt="" />
      </div>
      <dl className="facts">
        <dt>File</dt>
        <dd>
          <code>{image.url}</code>
        </dd>
        <dt>Size</dt>
        <dd>
          {image.width && image.height ? `${image.width} × ${image.height} px · ` : ''}
          {formatBytes(image.size)}
          {image.format ? ` · ${image.format.toUpperCase()}` : ''}
        </dd>
      </dl>

      <label className="field">
        <span className="label">Name</span>
        <span className="inline-form">
          <input
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            onBlur={() => nameCheck.slug && setName(nameCheck.slug)}
            disabled={!canRename || busy}
            aria-invalid={!!nameCheck.error}
            spellCheck={false}
          />
          <button
            type="button"
            disabled={!canRename || !nameChanged || busy}
            onClick={() =>
              run(async () => {
                const result = await api.renameEverywhere(image.url, nameCheck.slug);
                const kept = result.kept.length
                  ? ` Old file kept: still used in ${result.kept.join(', ')}.`
                  : '';
                return {
                  message: `Renamed on ${pages(result.updated)}.${kept}`,
                  selectUrl: result.url,
                };
              })
            }
          >
            Rename everywhere
          </button>
        </span>
        {!image.managed ? (
          <span className="field-note">Only images in the images folder can be renamed here.</span>
        ) : codeOnly ? (
          <span className="field-note">
            Used only in code ({image.mentions.join(', ')}); rename it there.
          </span>
        ) : nameCheck.error ? (
          <span className="field-error">{nameCheck.error}</span>
        ) : nameCheck.notes.length > 0 ? (
          <span className="field-note">
            Saved as <code>{nameCheck.slug}</code>. {nameCheck.notes.join(' ')}
          </span>
        ) : null}
        {similar.length > 0 && (
          <span className="field-warn">
            Already in this folder: {similar.map((url) => url.split('/').pop()).join(', ')}. Both
            files are kept.
          </span>
        )}
      </label>

      {image.usages.length > 0 && (
        <label className="field">
          <span className="label">Alt text on every use</span>
          <span className="inline-form">
            <input
              value={alt}
              onChange={(e) => setAlt(e.currentTarget.value)}
              placeholder="Describe the image"
              disabled={busy}
            />
            <button
              type="button"
              disabled={busy || image.usages.every((usage) => usage.alt === alt.trim())}
              onClick={() =>
                run(async () => {
                  const result = await api.setAltEverywhere(image.url, alt.trim());
                  return {
                    message: `Alt text updated on ${pages(result.updated)}.`,
                    selectUrl: image.url,
                  };
                })
              }
            >
              Apply to all {image.usages.length}
            </button>
          </span>
        </label>
      )}

      <section>
        <h3>
          Used on {image.usages.length} {image.usages.length === 1 ? 'page spot' : 'page spots'}
        </h3>
        {image.usages.length ? (
          <UsageList usages={image.usages} />
        ) : (
          <p className="muted">Not used in any page.</p>
        )}
        {image.mentions.length > 0 && (
          <p className="muted">
            Also mentioned in code:{' '}
            {image.mentions.map((file) => (
              <code key={file}>{file} </code>
            ))}
          </p>
        )}
      </section>

      {error && <p className="error">{error}</p>}

      <div className="detail-actions">
        <button type="button" onClick={() => navigator.clipboard?.writeText(image.url)}>
          Copy URL
        </button>
        {unused && image.managed && (
          <button
            type="button"
            className={confirmDelete ? 'danger' : ''}
            disabled={busy}
            onClick={() =>
              confirmDelete
                ? run(async () => {
                    const result = await api.deleteUnused([image.url]);
                    if (!result.deleted.length)
                      throw new Error(result.skipped[0]?.reason ?? 'Not deleted.');
                    return { message: `Deleted ${image.name}.` };
                  })
                : setConfirmDelete(true)
            }
          >
            {confirmDelete ? 'Confirm delete' : 'Delete file'}
          </button>
        )}
      </div>
    </aside>
  );
}

export function LibraryPanel({
  api,
  onClose,
  currentFile,
}: {
  api: Api;
  onClose(): void;
  currentFile?: string;
}) {
  const { scan, error, loading, reload } = useLibrary(api);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [page, setPage] = useState('');
  const [selected, setSelected] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const images = scan?.images ?? [];
  const counts = useMemo(
    () => ({
      all: images.length,
      unused: images.filter(isUnused).length,
      'missing-alt': images.filter(hasMissingAlt).length,
      broken: scan?.broken.length ?? 0,
    }),
    [images, scan],
  );

  const visible = images.filter(
    (image) =>
      matches(image, query) &&
      (!page || image.usages.some((usage) => usage.file === page)) &&
      (filter === 'all' ||
        (filter === 'unused'
          ? isUnused(image)
          : filter === 'missing-alt'
            ? hasMissingAlt(image)
            : false)),
  );
  const broken = (scan?.broken ?? []).filter(
    (usage) =>
      (!page || usage.file === page) &&
      (!query || usage.url.toLowerCase().includes(query.toLowerCase())),
  );
  const selectedImage = images.find((image) => image.url === selected);
  const deletable = visible.filter((image) => isUnused(image) && image.managed);

  async function onChanged(text: string, selectUrl?: string) {
    setMessage(text);
    await reload();
    setSelected(selectUrl);
  }

  async function deleteAllUnused() {
    if (!confirmBulk) return setConfirmBulk(true);
    setConfirmBulk(false);
    setBulkBusy(true);
    try {
      const result = await api.deleteUnused(deletable.map((image) => image.url));
      setMessage(
        `Deleted ${result.deleted.length} image${result.deleted.length === 1 ? '' : 's'}.` +
          (result.skipped.length ? ` Skipped ${result.skipped.length} still in use.` : ''),
      );
      await reload();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBulkBusy(false);
    }
  }

  const filters: { id: Filter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'unused', label: 'Unused' },
    { id: 'missing-alt', label: 'Missing alt' },
    { id: 'broken', label: 'Broken' },
  ];

  return (
    <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="library" role="dialog" aria-modal="true" aria-label="Image library">
        <header>
          <h2>Image library</h2>
          <button
            type="button"
            className="icon"
            onClick={() => void reload()}
            title="Rescan"
            aria-label="Rescan"
          >
            ↻
          </button>
          <span className="spacer" />
          <button type="button" className="icon" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <div className="library-toolbar">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
            placeholder="Search by name, alt text or page"
            aria-label="Search images"
          />
          <div className="segmented" role="tablist">
            {filters.map((f) => (
              <button
                type="button"
                role="tab"
                key={f.id}
                aria-selected={filter === f.id}
                className={filter === f.id ? 'on' : ''}
                onClick={() => {
                  setFilter(f.id);
                  setConfirmBulk(false);
                }}
              >
                {f.label}
                <span className={`count ${f.id !== 'all' && counts[f.id] > 0 ? 'attention' : ''}`}>
                  {counts[f.id]}
                </span>
              </button>
            ))}
          </div>
          <select
            value={page}
            onChange={(e) => setPage(e.currentTarget.value)}
            aria-label="Filter by page"
          >
            <option value="">All pages</option>
            {scan?.pages.map((p) => (
              <option key={p.file} value={p.file}>
                {p.pageUrl ?? p.file}
                {p.file === currentFile ? ' (this page)' : ''}
              </option>
            ))}
          </select>
        </div>

        {message && (
          <p className="library-message" role="status">
            {message}
          </p>
        )}
        {scan?.errors.length ? (
          <p className="error">
            Could not read {scan.errors.map((e) => e.file).join(', ')}: {scan.errors[0]!.message}
          </p>
        ) : null}

        <div className="library-body">
          <div className="library-main">
            {error ? (
              <p className="error">{error}</p>
            ) : loading && !scan ? (
              <p className="muted empty">Scanning your project…</p>
            ) : filter === 'broken' ? (
              broken.length === 0 ? (
                <p className="muted empty">No broken image references.</p>
              ) : (
                <>
                  <p className="muted">
                    These images are referenced but don't exist. Pages that use them may fail to
                    build.
                  </p>
                  <ul className="usages broken">
                    {broken.map((usage) => {
                      const href = openHref(usage);
                      return (
                        <li key={`${usage.file}:${usage.line}:${usage.column}`}>
                          <code>{usage.url}</code>
                          <span className="muted">
                            {href ? <a href={href}>{usage.pageUrl}</a> : usage.file} · {usage.file}:
                            {usage.line}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )
            ) : (
              <ImageGrid
                images={visible}
                selected={selected}
                onSelect={(image) => setSelected(image.url)}
              />
            )}
          </div>
          {selectedImage && filter !== 'broken' && (
            <Details
              key={selectedImage.url}
              api={api}
              image={selectedImage}
              onChanged={onChanged}
            />
          )}
        </div>

        {filter === 'unused' && deletable.length > 0 && (
          <footer>
            <span className="muted">
              Unused images are not referenced by any page or code file.
            </span>
            <button
              type="button"
              className={confirmBulk ? 'danger' : ''}
              disabled={bulkBusy}
              onClick={deleteAllUnused}
            >
              {confirmBulk
                ? `Confirm: delete ${deletable.length}`
                : `Delete ${deletable.length} unused`}
            </button>
          </footer>
        )}
      </div>
    </div>
  );
}

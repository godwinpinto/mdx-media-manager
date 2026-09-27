import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
} from 'react';
import ReactCrop, { centerCrop, makeAspectCrop, type PercentCrop } from 'react-image-crop';
import { checkName, slugify } from '@mdx-media-manager/core/slug';
import type { Api, Crop, LibraryImage, Output, Status } from './api';
import { commonAlt, LibraryPicker } from './library';

export interface DialogResult {
  /** Image to process. In edit mode it is absent when only the name/alt text changed. */
  file?: File;
  /** Alt text. In edit mode it is absent when unchanged. */
  alt?: string;
  /** File name (slug, without hash/extension). In edit mode it is absent when unchanged. */
  name?: string;
  crop?: Crop;
  output: Output;
  /** Insert an image already in the library (by URL) instead of uploading */
  existing?: string;
}

export interface ImageDialogProps {
  mode: 'insert' | 'edit';
  defaults: Status['image'];
  /** The image being edited: its URL as written in source, and its alt text */
  current?: { url: string; alt: string; missing?: boolean };
  /** Existing images in the destination folder that already use a name */
  findSimilar?: (name: string) => Promise<string[]>;
  /** Enables the "Library" tab when inserting */
  api?: Api;
  busy: boolean;
  error?: string;
  onSubmit(result: DialogResult): void;
  onCancel(): void;
}

const ratios: { label: string; value?: number | 'original' }[] = [
  { label: 'Free' },
  { label: 'Original', value: 'original' },
  { label: '16:9', value: 16 / 9 },
  { label: '4:3', value: 4 / 3 },
  { label: '1:1', value: 1 },
];

const fullCrop: PercentCrop = { unit: '%', x: 0, y: 0, width: 100, height: 100 };

const isMac =
  typeof navigator !== 'undefined' &&
  /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
const pasteKey = isMac ? '⌘V' : 'Ctrl+V';
const canReadClipboard =
  typeof navigator !== 'undefined' && typeof navigator.clipboard?.read === 'function';

/** `/images/x/team-photo-1a2b3c4d.webp` → `team-photo` */
function nameOfUrl(url: string): string {
  const file = decodeURIComponent(url.split(/[?#]/)[0]!.split('/').pop() ?? '');
  return slugify(file.replace(/\.[^.]+$/, '').replace(/-[0-9a-f]{8}$/, ''));
}

function extensionOfUrl(url: string): string {
  return /\.([a-z0-9]+)(?:[?#].*)?$/i.exec(url)?.[1]?.toLowerCase() ?? '';
}

const outputFormats: Record<string, Output['format']> = {
  webp: 'webp',
  avif: 'avif',
  png: 'png',
  jpg: 'jpeg',
  jpeg: 'jpeg',
};

/** `team-photo_2024.png` → `team photo 2024`; generic names (clipboard, screenshots) give nothing */
function altFromName(name: string): string {
  const base = name.replace(/\.[^.]+$/, '');
  if (/^(image|pasted-image|clipboard|screenshot|screen shot|img_?\d*)\b/i.test(base)) return '';
  return base.replace(/[-_]+/g, ' ').trim();
}

/** The first image in a paste: screenshots and copied images arrive as files or file items. */
function imageFromClipboard(data: DataTransfer | null): File | undefined {
  if (!data) return;
  const file = Array.from(data.files).find((f) => f.type.startsWith('image/'));
  if (file) return file;
  for (const item of Array.from(data.items)) {
    if (item.kind === 'file' && item.type.startsWith('image/'))
      return item.getAsFile() ?? undefined;
  }
}

export function ImageDialog({
  mode,
  defaults,
  current,
  findSimilar,
  api,
  busy,
  error,
  onSubmit,
  onCancel,
}: ImageDialogProps) {
  const initialAlt = current?.alt ?? '';
  const initialName = current ? nameOfUrl(current.url) : '';
  const currentExtension = current ? extensionOfUrl(current.url) : '';
  const initialFormat = (current && outputFormats[currentExtension]) || defaults.format!;

  const [source, setSource] = useState<'upload' | 'library'>('upload');
  const [picked, setPicked] = useState<LibraryImage>();
  const [file, setFile] = useState<File>();
  /** Edit mode: the current image, loaded so it can be cropped or converted */
  const original = useRef<File>(undefined);
  const [loading, setLoading] = useState(mode === 'edit');
  /** A name the user typed; otherwise it is derived (insert) or kept (edit) */
  const [customName, setCustomName] = useState<string>();
  const [preview, setPreview] = useState<string>();
  const [natural, setNatural] = useState<{ width: number; height: number }>();
  const [crop, setCrop] = useState<PercentCrop>(fullCrop);
  const [ratio, setRatio] = useState<number | 'original' | undefined>();
  const [alt, setAlt] = useState(initialAlt);
  /** Alt text still derived from a file name (not typed), so a new file may replace it */
  const altIsAuto = useRef(!initialAlt);
  const [format, setFormat] = useState(initialFormat);
  const [quality, setQuality] = useState(defaults.quality);
  const [maxWidth, setMaxWidth] = useState(defaults.maxWidth);
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState<string>();
  const input = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLFormElement>(null);
  /** dragenter/dragleave fire for every child element; count them to know when the drag leaves */
  const dragDepth = useRef(0);

  // Move focus into the dialog so keyboard shortcuts (Esc, Tab) apply to it right away.
  useEffect(() => dialog.current?.focus(), []);

  // Paste works wherever focus is while the dialog is open (the page, the dialog, a field).
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const image = imageFromClipboard(e.clipboardData);
      if (!image) return; // plain text, e.g. into the alt text field
      e.preventDefault();
      choose(image);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  });

  // Edit mode starts from the current image, so it can be cropped or converted as is.
  const currentUrl = current?.url;
  useEffect(() => {
    if (!currentUrl) return;
    let cancelled = false;
    // Through the dev server: works for CDN URLs without CORS.
    (api
      ? api.source(currentUrl)
      : fetch(currentUrl).then((res) =>
          res.ok ? res.blob() : Promise.reject(new Error(String(res.status))),
        )
    )
      .then((blob) => {
        if (cancelled || !blob.type.startsWith('image/')) return;
        const loaded = new File([blob], currentUrl.split('/').pop() || 'image', {
          type: blob.type,
        });
        original.current = loaded;
        setFile((existing) => existing ?? loaded);
      })
      .catch(() => {
        if (!cancelled) {
          setNotice(
            current?.missing
              ? "This image's file is missing. Drop, paste or choose a replacement."
              : 'Could not load the current image. Drop or choose a new one, or just rename it.',
          );
        }
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [currentUrl, api]);

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onCancel]);

  const aspect =
    ratio === 'original' && natural
      ? natural.width / natural.height
      : typeof ratio === 'number'
        ? ratio
        : undefined;

  function choose(next: File | undefined) {
    if (!next) return;
    setSource('upload');
    if (!next.type.startsWith('image/')) {
      setNotice(`"${next.name}" is not an image.`);
      return;
    }
    setNotice(undefined);
    setFile(next);
    setNatural(undefined);
    setCrop(fullCrop);
    if (altIsAuto.current) setAlt(altFromName(next.name));
  }

  function applyRatio(value: number | 'original' | undefined) {
    setRatio(value);
    if (!natural) return;
    const a = value === 'original' ? natural.width / natural.height : value;
    if (!a) return;
    setCrop(
      centerCrop(
        makeAspectCrop({ unit: '%', width: 90 }, a, natural.width, natural.height),
        natural.width,
        natural.height,
      ),
    );
  }

  /** Crop in pixels of the original image */
  const pixels = natural
    ? {
        x: Math.round((crop.x / 100) * natural.width),
        y: Math.round((crop.y / 100) * natural.height),
        width: Math.round((crop.width / 100) * natural.width),
        height: Math.round((crop.height / 100) * natural.height),
      }
    : undefined;

  function setPixelSize(side: 'width' | 'height', value: number) {
    if (!natural || !pixels || !(value > 0)) return;
    const size = {
      ...pixels,
      [side]: Math.min(
        value,
        side === 'width' ? natural.width - pixels.x : natural.height - pixels.y,
      ),
    };
    setRatio(undefined);
    setCrop({
      unit: '%',
      x: crop.x,
      y: crop.y,
      width: (size.width / natural.width) * 100,
      height: (size.height / natural.height) * 100,
    });
  }

  const isFull = crop.x <= 0.01 && crop.y <= 0.01 && crop.width >= 99.99 && crop.height >= 99.99;

  const autoName =
    mode === 'insert' ? slugify(alt || altFromName(file?.name ?? '') || 'image') : initialName;
  const nameValue = customName ?? autoName;
  // Same rules as the server, so what's shown is what gets written.
  const nameCheck = checkName(nameValue);
  const finalName = nameCheck.slug;

  /** Whether the image itself must be (re)processed, as opposed to a rename / alt change */
  const imageChanged =
    mode === 'insert' ||
    (!!file &&
      (file !== original.current ||
        !isFull ||
        format !== initialFormat ||
        quality !== defaults.quality ||
        maxWidth !== defaults.maxWidth));
  // Look-alike names: files never collide (the content hash is part of the name), but two
  // `hero-…` images in one folder are easy to mix up, so say so.
  const [similar, setSimilar] = useState<string[]>([]);
  const checkSimilar = !nameCheck.error && (mode === 'insert' || finalName !== initialName);
  useEffect(() => {
    setSimilar([]);
    if (!checkSimilar || !findSimilar) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      findSimilar(finalName).then(
        (matches) => !cancelled && setSimilar(matches),
        () => undefined,
      );
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // findSimilar is recreated on every render of the parent
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finalName, checkSimilar]);

  const altChanged = alt.trim() !== initialAlt.trim();
  const nameChanged = finalName !== initialName;
  const outputExtension = imageChanged ? (format === 'jpeg' ? 'jpg' : format) : currentExtension;

  const fromLibrary = mode === 'insert' && source === 'library';

  const canSubmit = fromLibrary
    ? !busy && !!picked && !!alt.trim()
    : !busy &&
      !nameCheck.error &&
      (mode === 'insert'
        ? !!file && !!alt.trim()
        : // A missing file can't be renamed, only replaced (or its alt text changed).
          imageChanged || altChanged || (nameChanged && !current?.missing));

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    const output = { format, quality, maxWidth };
    if (fromLibrary) {
      onSubmit({ existing: picked!.url, alt: alt.trim(), output });
      return;
    }
    if (mode === 'insert') {
      onSubmit({
        file,
        alt: alt.trim(),
        name: finalName,
        crop: isFull ? undefined : pixels,
        output,
      });
      return;
    }
    onSubmit({
      file: imageChanged ? file : undefined,
      alt: altChanged ? alt.trim() : undefined,
      // A re-processed image keeps its name unless it was changed.
      name: nameChanged || imageChanged ? finalName : undefined,
      crop: imageChanged && !isFull ? pixels : undefined,
      output,
    });
  }

  async function pasteFromClipboard() {
    try {
      for (const item of await navigator.clipboard.read()) {
        const type = item.types.find((t) => t.startsWith('image/'));
        if (!type) continue;
        const blob = await item.getType(type);
        return choose(new File([blob], `pasted-image.${type.split('/')[1] ?? 'png'}`, { type }));
      }
      setNotice('The clipboard has no image. Copy an image or take a screenshot first.');
    } catch {
      setNotice(`Clipboard access was blocked. Press ${pasteKey} instead.`);
    }
  }

  const hasFiles = (e: DragEvent) => e.dataTransfer.types.includes('Files');
  const drag = {
    onDragEnter(e: DragEvent) {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragDepth.current++;
      setDragging(true);
    },
    onDragOver(e: DragEvent) {
      if (!hasFiles(e)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    },
    onDragLeave(e: DragEvent) {
      if (!hasFiles(e)) return;
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0) setDragging(false);
    },
    onDrop(e: DragEvent) {
      if (!hasFiles(e)) return;
      // Anywhere on the dialog or backdrop; never let the browser open the file instead.
      e.preventDefault();
      dragDepth.current = 0;
      setDragging(false);
      if (!busy) choose(e.dataTransfer.files[0]);
    },
  };

  return (
    <div
      className="backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && !busy && onCancel()}
      {...drag}
    >
      <form
        ref={dialog}
        tabIndex={-1}
        className={`dialog ${dragging ? 'dragging' : ''}`}
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-label={mode === 'insert' ? 'Insert image' : 'Edit image'}
      >
        <header>
          <h2>{mode === 'insert' ? 'Insert image' : 'Edit image'}</h2>
          <button
            type="button"
            className="icon"
            onClick={onCancel}
            disabled={busy}
            aria-label="Close"
          >
            ×
          </button>
        </header>

        {mode === 'insert' && api && (
          <div className="segmented tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={source === 'upload'}
              className={source === 'upload' ? 'on' : ''}
              onClick={() => setSource('upload')}
            >
              Upload
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={source === 'library'}
              className={source === 'library' ? 'on' : ''}
              onClick={() => setSource('library')}
            >
              From library
            </button>
          </div>
        )}

        {fromLibrary && api ? (
          <>
            <LibraryPicker
              api={api}
              selected={picked?.url}
              onSelect={(image) => {
                setPicked(image);
                if (altIsAuto.current)
                  setAlt(
                    commonAlt(image) ||
                      altFromName(image.name.replace(/-[0-9a-f]{8}(\.[^.]+)$/, '$1')),
                  );
              }}
            />
            {picked && (
              <label className="field">
                <span className="label">
                  Alt text <em>(required)</em>
                </span>
                <input
                  value={alt}
                  onChange={(e) => {
                    altIsAuto.current = e.currentTarget.value === '';
                    setAlt(e.currentTarget.value);
                  }}
                  placeholder="Describe the image"
                  maxLength={500}
                />
                <span className="field-note">
                  Inserts <code>{picked.url}</code>. The file is reused, not copied.
                </span>
              </label>
            )}
          </>
        ) : !file && loading ? (
          <div className="drop">
            <strong>Loading current image…</strong>
          </div>
        ) : !file ? (
          <div className={`drop ${dragging ? 'active' : ''}`}>
            <strong>Drop, paste ({pasteKey}) or choose an image</strong>
            <div className="drop-actions">
              <button type="button" className="primary" onClick={() => input.current?.click()}>
                Choose file
              </button>
              {canReadClipboard && (
                <button type="button" onClick={pasteFromClipboard}>
                  Paste from clipboard
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="crop-area">
              <ReactCrop
                crop={crop}
                aspect={aspect}
                onChange={(_, percent) => setCrop(percent)}
                keepSelection
                ruleOfThirds
              >
                <img
                  src={preview}
                  alt=""
                  onLoad={(e) =>
                    setNatural({
                      width: e.currentTarget.naturalWidth,
                      height: e.currentTarget.naturalHeight,
                    })
                  }
                />
              </ReactCrop>
            </div>

            <div className="row">
              <span className="label">Ratio</span>
              <div className="segmented">
                {ratios.map((r) => (
                  <button
                    type="button"
                    key={r.label}
                    className={ratio === r.value ? 'on' : ''}
                    onClick={() => applyRatio(r.value)}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="row">
              <span className="label">Crop</span>
              <label className="inline">
                W
                <input
                  type="number"
                  min={1}
                  value={pixels?.width ?? ''}
                  onChange={(e) => setPixelSize('width', e.currentTarget.valueAsNumber)}
                />
              </label>
              <label className="inline">
                H
                <input
                  type="number"
                  min={1}
                  value={pixels?.height ?? ''}
                  onChange={(e) => setPixelSize('height', e.currentTarget.valueAsNumber)}
                />
              </label>
              <span className="muted">
                of {natural?.width ?? '…'} × {natural?.height ?? '…'} px
              </span>
              <button
                type="button"
                className="link"
                onClick={() => (setRatio(undefined), setCrop(fullCrop))}
              >
                Reset
              </button>
            </div>

            <div className="row">
              <span className="label">Output</span>
              <select
                value={format}
                onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                  setFormat(e.currentTarget.value as typeof format)
                }
              >
                <option value="webp">WebP</option>
                <option value="avif">AVIF</option>
                <option value="jpeg">JPEG</option>
                <option value="png">PNG</option>
              </select>
              {format !== 'png' && (
                <label className="inline">
                  Quality
                  <input
                    type="range"
                    min={40}
                    max={100}
                    value={quality}
                    onChange={(e) => setQuality(e.currentTarget.valueAsNumber)}
                  />
                  <span className="muted num">{quality}</span>
                </label>
              )}
              <label className="inline">
                Max width
                <input
                  type="number"
                  min={0}
                  step={100}
                  value={maxWidth}
                  onChange={(e) => setMaxWidth(Math.max(0, e.currentTarget.valueAsNumber || 0))}
                />
              </label>
            </div>

            <p className="muted hint">
              To use a different image, drop or paste it ({pasteKey}), or{' '}
              <button type="button" className="link" onClick={() => input.current?.click()}>
                choose a file
              </button>
              .
            </p>
          </>
        )}

        {!fromLibrary && (file || mode === 'edit') && !loading && (
          <>
            <label className="field">
              <span className="label">File name</span>
              <span className="name-input">
                <input
                  value={nameValue}
                  onChange={(e) => setCustomName(e.currentTarget.value)}
                  onBlur={() => {
                    if (customName === undefined) return;
                    // Empty → back to the suggested name; otherwise show the cleaned-up name.
                    if (!customName.trim()) setCustomName(undefined);
                    else if (nameCheck.slug) setCustomName(nameCheck.slug);
                  }}
                  aria-invalid={!!nameCheck.error}
                  aria-describedby="mmm-name-help"
                  placeholder={autoName}
                  maxLength={100}
                  spellCheck={false}
                />
                <span
                  className="muted suffix"
                  title="A short content hash is added so browsers never show an outdated copy and different images never collide."
                >
                  -‹hash›.{outputExtension || 'webp'}
                </span>
              </span>
              {nameCheck.error ? (
                <span id="mmm-name-help" className="field-error">
                  {nameCheck.error}
                </span>
              ) : nameCheck.notes.length > 0 ? (
                <span id="mmm-name-help" className="field-note">
                  Saved as <code>{finalName}</code>. {nameCheck.notes.join(' ')}
                </span>
              ) : (
                <span id="mmm-name-help" className="field-note">
                  Lowercase letters, numbers and hyphens.
                </span>
              )}
              {similar.length > 0 && (
                <span className="field-warn" role="status">
                  An image named <code>{finalName}</code> already exists here:{' '}
                  {similar.map((url, i) => (
                    <span key={url}>
                      {i > 0 && ', '}
                      <code>{url.split('/').pop()}</code>
                    </span>
                  ))}
                  . Saving keeps both (unless it is the same image). Choose another name to tell
                  them apart.
                </span>
              )}
            </label>
            <label className="field">
              <span className="label">Alt text{mode === 'insert' && <em> (required)</em>}</span>
              <input
                value={alt}
                onChange={(e) => {
                  altIsAuto.current = e.currentTarget.value === '';
                  setAlt(e.currentTarget.value);
                }}
                placeholder="Describe the image"
                maxLength={500}
              />
            </label>
          </>
        )}

        <input
          ref={input}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => choose(e.currentTarget.files?.[0])}
        />

        {dragging && (
          <div className="drop-overlay" aria-hidden="true">
            Drop to use this image
          </div>
        )}

        {notice && <p className="notice">{notice}</p>}
        {error && <p className="error">{error}</p>}

        <footer>
          <button type="button" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="primary" disabled={!canSubmit}>
            {busy ? 'Saving…' : mode === 'insert' ? 'Insert' : 'Save'}
          </button>
        </footer>
      </form>
    </div>
  );
}

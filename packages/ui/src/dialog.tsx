import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
} from 'react';
import ReactCrop, { centerCrop, makeAspectCrop, type PercentCrop } from 'react-image-crop';
import type { Crop, Output, Status } from './api';

export interface DialogResult {
  file: File;
  alt: string;
  crop?: Crop;
  output: Output;
}

export interface ImageDialogProps {
  mode: 'insert' | 'replace';
  defaults: Status['image'];
  /** Existing alt text, for replace */
  alt?: string;
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
  alt: initialAlt = '',
  busy,
  error,
  onSubmit,
  onCancel,
}: ImageDialogProps) {
  const [file, setFile] = useState<File>();
  const [preview, setPreview] = useState<string>();
  const [natural, setNatural] = useState<{ width: number; height: number }>();
  const [crop, setCrop] = useState<PercentCrop>(fullCrop);
  const [ratio, setRatio] = useState<number | 'original' | undefined>();
  const [alt, setAlt] = useState(initialAlt);
  /** Alt text still derived from a file name (not typed), so a new file may replace it */
  const altIsAuto = useRef(!initialAlt);
  const [format, setFormat] = useState(defaults.format);
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

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!file || busy) return;
    onSubmit({
      file,
      alt: alt.trim(),
      crop: isFull ? undefined : pixels,
      output: { format, quality, maxWidth },
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
        aria-label={mode === 'insert' ? 'Insert image' : 'Replace image'}
      >
        <header>
          <h2>{mode === 'insert' ? 'Insert image' : 'Replace image'}</h2>
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

        {!file ? (
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

            <p className="muted hint">
              To use a different image, drop or paste it ({pasteKey}), or{' '}
              <button type="button" className="link" onClick={() => input.current?.click()}>
                choose a file
              </button>
              .
            </p>
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
          <button
            type="submit"
            className="primary"
            disabled={!file || busy || (mode === 'insert' && !alt.trim())}
          >
            {busy ? 'Saving…' : mode === 'insert' ? 'Insert' : 'Replace'}
          </button>
        </footer>
      </form>
    </div>
  );
}

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
  const [format, setFormat] = useState(defaults.format);
  const [quality, setQuality] = useState(defaults.quality);
  const [maxWidth, setMaxWidth] = useState(defaults.maxWidth);
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);

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
    if (!next || !next.type.startsWith('image/')) return;
    setFile(next);
    setNatural(undefined);
    setCrop(fullCrop);
    if (!alt) setAlt(next.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '));
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

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    choose(e.dataTransfer.files[0]);
  };

  return (
    <div
      className="backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && !busy && onCancel()}
    >
      <form
        className="dialog"
        onSubmit={submit}
        onPaste={(e) => choose(e.clipboardData.files[0])}
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
          <button
            type="button"
            className={`drop ${dragging ? 'active' : ''}`}
            onClick={() => input.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
          >
            <strong>Choose an image</strong>
            <span>or drop / paste it here</span>
          </button>
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
                onChange={(e) => setAlt(e.currentTarget.value)}
                placeholder="Describe the image"
                maxLength={500}
              />
            </label>

            <button type="button" className="link" onClick={() => input.current?.click()}>
              Choose a different file
            </button>
          </>
        )}

        <input
          ref={input}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => choose(e.currentTarget.files?.[0])}
        />

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

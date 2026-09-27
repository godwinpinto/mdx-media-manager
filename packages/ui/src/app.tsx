import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, createApi, type Status } from './api';
import { ImageDialog, type DialogResult } from './dialog';
import { blockAt, imageAt, type Block, type ImageTarget, type SourceTag } from './dom';

const STORAGE_KEY = 'mdx-media-manager:enabled';

function readEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'false';
  } catch {
    return true;
  }
}

function writeEnabled(value: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(value));
  } catch {
    // Storage can be unavailable (private mode); the toggle then lasts for this page only.
  }
}

type Task =
  | { kind: 'insert'; tag: SourceTag; position: 'before' | 'after' }
  | { kind: 'replace'; image: ImageTarget };

interface Toast {
  tone: 'ok' | 'error';
  text: string;
}

function messageOf(error: unknown): string {
  if (error instanceof ApiError && error.status === 409) {
    return 'This page changed on disk. Wait for it to refresh, then try again.';
  }
  return error instanceof Error ? error.message : String(error);
}

export function App({ basePath, host }: { basePath: string; host: HTMLElement }) {
  const api = useMemo(() => createApi(basePath), [basePath]);
  const [enabled, setEnabled] = useState(readEnabled);
  const [status, setStatus] = useState<Status>();
  const [offline, setOffline] = useState<string>();
  const [block, setBlock] = useState<Block>();
  const [side, setSide] = useState<'before' | 'after'>('after');
  const [image, setImage] = useState<ImageTarget>();
  const [task, setTask] = useState<Task>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [toast, setToast] = useState<Toast>();
  const [, setFrame] = useState(0);
  const pending = useRef(0);

  useEffect(() => {
    api.status().then(setStatus, (e) => setOffline(messageOf(e)));
  }, [api]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(undefined), toast.tone === 'ok' ? 3000 : 6000);
    return () => clearTimeout(timer);
  }, [toast]);

  // Track what's under the pointer.
  useEffect(() => {
    if (!enabled || task) return;
    let x = 0;
    let y = 0;
    const update = () => {
      pending.current = 0;
      const target = document.elementFromPoint(x, y);
      if (!target || target === host) return; // pointer is on the overlay's own controls
      const nextBlock = blockAt(target);
      setBlock(nextBlock);
      setImage(imageAt(target));
      if (nextBlock) {
        const rect = nextBlock.element.getBoundingClientRect();
        setSide(y < rect.top + rect.height / 2 ? 'before' : 'after');
      }
    };
    const onMove = (e: PointerEvent) => {
      x = e.clientX;
      y = e.clientY;
      if (!pending.current) pending.current = requestAnimationFrame(update);
    };
    const onLeave = (e: PointerEvent) => {
      if (!e.relatedTarget) {
        setBlock(undefined);
        setImage(undefined);
      }
    };
    // Re-measure while scrolling so outlines stay attached to their elements.
    const onScroll = () => setFrame((n) => n + 1);
    document.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerout', onLeave);
    window.addEventListener('scroll', onScroll, { passive: true, capture: true });
    window.addEventListener('resize', onScroll);
    return () => {
      cancelAnimationFrame(pending.current);
      pending.current = 0;
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerout', onLeave);
      window.removeEventListener('scroll', onScroll, { capture: true });
      window.removeEventListener('resize', onScroll);
    };
  }, [enabled, task, host]);

  useEffect(() => setConfirmDelete(false), [image?.element]);

  const toggle = () => {
    const next = !enabled;
    setEnabled(next);
    writeEnabled(next);
    if (!next) {
      setBlock(undefined);
      setImage(undefined);
    }
  };

  const close = useCallback(() => {
    setTask(undefined);
    setError(undefined);
  }, []);

  async function run(action: () => Promise<unknown>, done: string) {
    setBusy(true);
    setError(undefined);
    try {
      await action();
      setTask(undefined);
      setBlock(undefined);
      setImage(undefined);
      setToast({ tone: 'ok', text: `${done} Updating page…` });
    } catch (e) {
      if (task) setError(messageOf(e));
      else setToast({ tone: 'error', text: messageOf(e) });
    } finally {
      setBusy(false);
    }
  }

  function submit(result: DialogResult) {
    if (!task) return;
    const options = { alt: result.alt, crop: result.crop, output: result.output };
    if (task.kind === 'insert') {
      void run(() => api.insert(task.tag, task.position, result.file, options), 'Image inserted.');
    } else {
      void run(
        () =>
          api.replace(task.image.tag, task.image.url, result.file, {
            ...options,
            alt: result.alt || undefined,
          }),
        'Image replaced.',
      );
    }
  }

  function remove(target: ImageTarget) {
    if (!confirmDelete) return setConfirmDelete(true);
    setConfirmDelete(false);
    void run(() => api.remove(target.tag, target.url), 'Image removed.');
  }

  const blockRect = enabled && !task ? block?.element.getBoundingClientRect() : undefined;
  const imageRect = enabled && !task ? image?.element.getBoundingClientRect() : undefined;

  return (
    <>
      {blockRect && block && (
        <>
          <div
            className="outline"
            style={{
              top: blockRect.top,
              left: blockRect.left,
              width: blockRect.width,
              height: blockRect.height,
            }}
          />
          <div
            className="insert-bar"
            style={{
              top: side === 'before' ? blockRect.top - 3 : blockRect.bottom + 1,
              left: blockRect.left,
              width: blockRect.width,
            }}
          >
            <button
              type="button"
              className="insert-button"
              disabled={!status}
              onClick={() => setTask({ kind: 'insert', tag: block.tag, position: side })}
              title={`Insert an image ${side} this block (${block.tag.file}:${block.tag.line})`}
            >
              + Image {side === 'before' ? 'above' : 'below'}
            </button>
          </div>
        </>
      )}

      {imageRect && image && (
        <div
          className="toolbar"
          style={{ top: Math.max(8, imageRect.top + 8), left: imageRect.right - 8 }}
        >
          <button
            type="button"
            disabled={!status || busy}
            onClick={() => setTask({ kind: 'replace', image })}
          >
            Replace
          </button>
          <button
            type="button"
            className={confirmDelete ? 'danger' : ''}
            disabled={busy}
            onClick={() => remove(image)}
          >
            {confirmDelete ? 'Confirm delete' : 'Delete'}
          </button>
        </div>
      )}

      {task && status && (
        <ImageDialog
          mode={task.kind}
          defaults={status.image}
          alt={task.kind === 'replace' ? (task.image.element.alt ?? '') : ''}
          busy={busy}
          error={error}
          onSubmit={submit}
          onCancel={close}
        />
      )}

      {toast && <div className={`toast ${toast.tone}`}>{toast.text}</div>}

      <button
        type="button"
        className={`toggle ${enabled ? 'on' : ''} ${offline ? 'offline' : ''}`}
        onClick={toggle}
        title={
          offline ??
          (enabled ? 'Hover content to add, replace or delete images' : 'Image manager is off')
        }
      >
        <span className="dot" />
        Images {enabled ? 'on' : 'off'}
      </button>
    </>
  );
}

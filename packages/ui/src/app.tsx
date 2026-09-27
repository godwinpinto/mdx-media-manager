import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, createApi, type Status } from './api';
import { ImageDialog, type DialogResult } from './dialog';
import {
  blockAt,
  imageAt,
  parseTag,
  SOURCE_ATTR,
  type Block,
  type ImageTarget,
  type SourceTag,
} from './dom';
import { LibraryPanel } from './library';

/** `#mmm=<file>:<line>`: set by the library's "open" links */
const JUMP_PREFIX = '#mmm=';

/** The rendered element for `file:line`: an exact match (preferring an image), else the closest block above it. */
function findSourceElement(file: string, line: number): HTMLElement | undefined {
  let best: { element: HTMLElement; line: number } | undefined;
  for (const element of document.querySelectorAll<HTMLElement>(`[${SOURCE_ATTR}]`)) {
    const tag = parseTag(element.getAttribute(SOURCE_ATTR));
    if (!tag || tag.file !== file || tag.line > line) continue;
    const better =
      !best ||
      tag.line > best.line ||
      (tag.line === best.line && element.tagName === 'IMG' && best.element.tagName !== 'IMG');
    if (better && element.getBoundingClientRect().height > 0) best = { element, line: tag.line };
  }
  return best?.element;
}

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
  | { kind: 'edit'; image: ImageTarget };

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
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [flash, setFlash] = useState<HTMLElement>();
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
  // Library "open" links land here: scroll to the spot and highlight it.
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    const jump = () => {
      if (!location.hash.startsWith(JUMP_PREFIX)) return;
      const raw = decodeURIComponent(location.hash.slice(JUMP_PREFIX.length));
      const separator = raw.lastIndexOf(':');
      const file = raw.slice(0, separator);
      const line = Number(raw.slice(separator + 1));
      history.replaceState(null, '', location.pathname + location.search);
      setLibraryOpen(false);
      let tries = 0;
      clearInterval(timer);
      // Content can render after the overlay (streaming, client-side MDX): retry briefly.
      timer = setInterval(() => {
        const element = findSourceElement(file, line);
        if (element || ++tries > 30) clearInterval(timer);
        if (!element) return;
        element.scrollIntoView({ block: 'center', behavior: 'smooth' });
        setFlash(element);
        setTimeout(() => setFlash((current) => (current === element ? undefined : current)), 2500);
      }, 100);
    };
    jump();
    window.addEventListener('hashchange', jump);
    return () => {
      clearInterval(timer);
      window.removeEventListener('hashchange', jump);
    };
  }, []);

  // Keep the highlight attached while the page scrolls to it.
  useEffect(() => {
    if (!flash) return;
    let frame = requestAnimationFrame(function tick() {
      setFrame((n) => n + 1);
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [flash]);

  useEffect(() => {
    if (!enabled || task || libraryOpen) return;
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
  }, [enabled, task, host, libraryOpen]);

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
    const { tag, url } = task.kind === 'edit' ? task.image : { tag: task.tag, url: '' };
    if (task.kind === 'insert' && result.existing) {
      const existing = result.existing;
      void run(
        () => api.insertExisting(tag, task.position, existing, result.alt ?? ''),
        'Image inserted.',
      );
    } else if (task.kind === 'insert') {
      const options = {
        alt: result.alt ?? '',
        name: result.name,
        crop: result.crop,
        output: result.output,
      };
      void run(() => api.insert(tag, task.position, result.file!, options), 'Image inserted.');
    } else if (result.file) {
      const options = {
        alt: result.alt,
        name: result.name,
        crop: result.crop,
        output: result.output,
      };
      void run(() => api.replace(tag, url, result.file!, options), 'Image updated.');
    } else {
      // Only the name and/or alt text changed: no re-encoding.
      void run(
        () => api.update(tag, url, { alt: result.alt, name: result.name }),
        'Image updated.',
      );
    }
  }

  function remove(target: ImageTarget) {
    if (!confirmDelete) return setConfirmDelete(true);
    setConfirmDelete(false);
    void run(() => api.remove(target.tag, target.url), 'Image removed.');
  }

  const idle = enabled && !task && !libraryOpen;
  const blockRect = idle ? block?.element.getBoundingClientRect() : undefined;
  const imageRect = idle ? image?.element.getBoundingClientRect() : undefined;
  const flashRect = flash?.getBoundingClientRect();
  const currentFile = parseTag(
    document.querySelector(`[${SOURCE_ATTR}]`)?.getAttribute(SOURCE_ATTR) ?? null,
  )?.file;

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
          {image.missing && (
            <span className="missing-label" title={image.url}>
              Missing: <code>{image.url}</code>
            </span>
          )}
          <button
            type="button"
            disabled={!status || busy}
            onClick={() => setTask({ kind: 'edit', image })}
          >
            Edit
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
          findSimilar={(name) =>
            task.kind === 'edit'
              ? api.similarNames(task.image.tag, name, task.image.url)
              : api.similarNames(task.tag, name)
          }
          current={
            task.kind === 'edit'
              ? {
                  url: task.image.url,
                  alt: task.image.element.getAttribute('alt') ?? '',
                  missing: task.image.missing,
                }
              : undefined
          }
          api={api}
          busy={busy}
          error={error}
          onSubmit={submit}
          onCancel={close}
        />
      )}

      {libraryOpen && (
        <LibraryPanel
          api={api}
          currentFile={currentFile}
          storage={status?.storage}
          onClose={() => setLibraryOpen(false)}
        />
      )}

      {flashRect && (
        <div
          className="flash"
          style={{
            top: flashRect.top,
            left: flashRect.left,
            width: flashRect.width,
            height: flashRect.height,
          }}
        />
      )}

      {toast && <div className={`toast ${toast.tone}`}>{toast.text}</div>}

      <div className="dock">
        <button
          type="button"
          className="library-button"
          disabled={!status}
          onClick={() => {
            setBlock(undefined);
            setImage(undefined);
            setLibraryOpen(true);
          }}
          title="Browse, rename and clean up images"
        >
          Library
        </button>
        <button
          type="button"
          className={`toggle ${enabled ? 'on' : ''} ${offline ? 'offline' : ''}`}
          onClick={toggle}
          title={
            offline ??
            (enabled ? 'Hover content to add, edit or delete images' : 'Image manager is off')
          }
        >
          <span className="dot" />
          Images {enabled ? 'on' : 'off'}
        </button>
      </div>
    </>
  );
}

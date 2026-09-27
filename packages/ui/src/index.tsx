import { useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import cropStyles from 'react-image-crop/dist/ReactCrop.css?text';
import { App } from './app';
import { styles } from './styles';

export interface MediaManagerOverlayProps {
  /** Where the API is mounted @defaultValue '/__mdx-media' */
  basePath?: string;
}

let mounted: { root: Root; host: HTMLElement; observer: MutationObserver } | undefined;
let users = 0;

function isDark(): boolean {
  const html = document.documentElement;
  return html.classList.contains('dark') || html.dataset.theme === 'dark';
}

function mount(basePath: string) {
  const host = document.createElement('mdx-media-manager');
  document.body.append(host);
  const shadow = host.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = cropStyles + styles;
  const layer = document.createElement('div');
  layer.className = 'layer';
  shadow.append(style, layer);

  const syncTheme = () => (layer.dataset.theme = isDark() ? 'dark' : 'light');
  syncTheme();
  const observer = new MutationObserver(syncTheme);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class', 'data-theme'],
  });

  const root = createRoot(layer);
  root.render(<App basePath={basePath} host={host} />);
  return { root, host, observer };
}

/**
 * Renders nothing in place; mounts one shared overlay (in a shadow root on `<body>`) while at
 * least one instance is on the page. Injected into MDX pages during development.
 */
export function MediaManagerOverlay({ basePath = '/__mdx-media' }: MediaManagerOverlayProps) {
  useEffect(() => {
    users++;
    mounted ??= mount(basePath);
    return () => {
      users--;
      // Deferred so a remount (Strict Mode, client navigation between pages) keeps the overlay.
      setTimeout(() => {
        if (users > 0 || !mounted) return;
        mounted.observer.disconnect();
        mounted.root.unmount();
        mounted.host.remove();
        mounted = undefined;
      }, 100);
    };
  }, [basePath]);

  return null;
}

import type { CSSProperties, ReactNode } from 'react';

/** Text split into `.ch` spans for typing reveals; words never break across lines */
export function Chars({ text, className }: { text: string; className?: string }) {
  let n = 0;
  return (
    <span className={className}>
      {text.split(/( )/).map((word, i) =>
        word === ' ' ? (
          <span className="ch" key={i}>
            {' '}
          </span>
        ) : (
          <span className="word" key={i}>
            {[...word].map((c) => (
              <span className="ch" key={n++}>
                {c}
              </span>
            ))}
          </span>
        ),
      )}
    </span>
  );
}

/** A caption split into `.w` word spans; wrap words in `*…*` to accent them */
export function Words({
  text,
  id,
  className = 'caption',
  mask = false,
}: {
  text: string;
  id: string;
  className?: string;
  /** Wrap each word in a clipping box, so it can slide up from behind a mask */
  mask?: boolean;
}) {
  const parts = text.split(/(\*[^*]+\*)/).filter(Boolean);
  return (
    <div id={id} className={className}>
      {parts.flatMap((part, i) => {
        const accent = part.startsWith('*');
        return part
          .replace(/\*/g, '')
          .split(/(\s+)/)
          .filter((w) => w.trim())
          .map((w, j) => {
            const word = (
              <span key={`${i}-${j}`} className={`w ${accent ? 'accent' : ''}`}>
                {w}
              </span>
            );
            return mask ? (
              <span key={`${i}-${j}`} className="wm">
                {word}
              </span>
            ) : (
              word
            );
          });
      })}
    </div>
  );
}

/** A grey skeleton bar standing in for a line of text */
export function Skel({
  w,
  h = 14,
  className = '',
  style,
}: {
  w: number | string;
  h?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return <span className={`skel ${className}`} style={{ width: w, height: h, ...style }} />;
}

/** Lines of skeleton text with ragged last line */
export function Para({ lines, className = '' }: { lines: number[]; className?: string }) {
  return (
    <div className={`para ${className}`}>
      {lines.map((w, i) => (
        <Skel key={i} w={`${w}%`} />
      ))}
    </div>
  );
}

export function Browser({
  id,
  url,
  children,
  className = '',
}: {
  id: string;
  url: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div id={id} className={`browser card ${className}`}>
      <div className="chrome">
        <i />
        <i />
        <i />
        <span className="address">{url}</span>
        <span className="devbadge">next dev</span>
      </div>
      <div className="viewport">{children}</div>
    </div>
  );
}

/** A miniature docs home page, drawn from boxes: the "screenshot" that gets pasted */
export function Shot({
  tone = 'light',
  accent = '#4f46e5',
  className = '',
  id,
}: {
  tone?: 'light' | 'dark';
  accent?: string;
  className?: string;
  id?: string;
}) {
  return (
    <div
      id={id}
      className={`shot ${tone} ${className}`}
      style={{ '--shot-accent': accent } as CSSProperties}
    >
      <div className="shot-nav">
        <span className="shot-logo" />
        <span className="shot-search" />
      </div>
      <div className="shot-hero">
        <span className="shot-kicker" />
        <span className="shot-title" />
        <span className="shot-title short" />
        <span className="shot-sub" />
        <span className="shot-buttons">
          <span className="shot-btn primary" />
          <span className="shot-btn" />
        </span>
      </div>
      <div className="shot-cards">
        {[0, 1, 2, 3].map((i) => (
          <span className="shot-card" key={i}>
            <span />
            <span />
          </span>
        ))}
      </div>
    </div>
  );
}

/** Rolling digits: one column per digit, animated by moving each strip */
export function Odometer({
  id,
  value,
  className = '',
}: {
  id: string;
  value: string;
  className?: string;
}) {
  return (
    <span id={id} className={`odo ${className}`}>
      {[...value].map((d, i) => (
        <span className="odo-col" key={i}>
          <span className="odo-strip" data-i={i}>
            {'0123456789'.split('').map((n) => (
              <span key={n}>{n}</span>
            ))}
          </span>
        </span>
      ))}
    </span>
  );
}

export function Cursor() {
  return (
    <>
      <div id="ripple" />
      <div id="cursor">
        <svg className="arrow" viewBox="0 0 32 32" width="40" height="40">
          <path
            d="M6 3 L6 25 L12 19.5 L16 28.5 L20.2 26.6 L16.3 17.8 L24.5 17.8 Z"
            fill="#18181b"
            stroke="#fff"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </>
  );
}

export function Keycap({ id, keys }: { id: string; keys: string[] }) {
  return (
    <div id={id} className="keys">
      {keys.map((k) => (
        <kbd key={k}>{k}</kbd>
      ))}
    </div>
  );
}

export const Icon = {
  image: (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <circle cx="9" cy="10" r="1.8" />
      <path d="M21 16.5 15.5 11 6 20" />
    </svg>
  ),
  check: (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12.5 10 17.5 19 7.5" />
    </svg>
  ),
  file: (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
    </svg>
  ),
  folder: (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
    >
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </svg>
  ),
  crop: (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    >
      <path d="M6 2v14a2 2 0 0 0 2 2h14" />
      <path d="M18 22V8a2 2 0 0 0-2-2H2" />
    </svg>
  ),
  pencil: (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 20h4L19 9l-4-4L4 16z" />
    </svg>
  ),
  camera: (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
    >
      <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  ),
  keyboard: (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    >
      <rect x="2.5" y="6" width="19" height="12" rx="2" />
      <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10" />
    </svg>
  ),
  refresh: (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 11a8 8 0 1 0-2.3 5.7" />
      <path d="M20 4v7h-7" />
    </svg>
  ),
  cloud: (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
    >
      <path d="M7 18h10.5a4 4 0 0 0 .6-7.96A6 6 0 0 0 6.3 9.5 4.3 4.3 0 0 0 7 18z" />
    </svg>
  ),
  globe: (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18" />
    </svg>
  ),
  git: (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    >
      <circle cx="6" cy="6" r="2.4" />
      <circle cx="6" cy="18" r="2.4" />
      <circle cx="18" cy="9" r="2.4" />
      <path d="M6 8.4v7.2M18 11.4c0 3-3 4-9.6 5.4" />
    </svg>
  ),
};

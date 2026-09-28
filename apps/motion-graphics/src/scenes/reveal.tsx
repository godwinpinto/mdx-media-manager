import { createDrawable, stagger } from 'animejs';
import { wordsIn, type TL } from '../anim';
import { Words } from '../ui/parts';

export function Wordmark({ id }: { id: string }) {
  return (
    <div id={id} className="mark">
      {[...'mdx-media-manager'].map((c, i) => (
        <span key={i} className={`ch ${c === '-' ? 'dash' : ''}`}>
          {c}
        </span>
      ))}
    </div>
  );
}

export function Reveal() {
  return (
    <section className="scene" id="reveal">
      <Wordmark id="reveal-mark" />
      <svg id="reveal-line" width="760" height="24" viewBox="0 0 760 24">
        <path
          d="M4 14 C 180 4, 380 22, 756 8"
          fill="none"
          stroke="#4f46e5"
          strokeWidth="5"
          strokeLinecap="round"
        />
      </svg>
      <Words
        id="reveal-sub"
        text="Add, replace and delete images *right on the page.*"
        className="tagline"
      />
    </section>
  );
}

/** ~3.6s: the name, drawn in */
export function buildReveal(tl: TL, t0: number) {
  let t = t0;
  tl.set('#reveal', { opacity: 1 }, t);
  tl.add(
    '#reveal-mark .ch',
    {
      opacity: [0, 1],
      y: [50, 0],
      filter: ['blur(12px)', 'blur(0px)'],
      duration: 800,
      delay: stagger(35, { from: 'center' }),
    },
    t,
  );
  tl.add('#reveal-mark .dash', { color: ['#18181b', '#4f46e5'], duration: 400 }, t + 600);
  tl.add(
    createDrawable('#reveal-line path'),
    { draw: ['0 0', '0 1'], duration: 900, ease: 'inOutCubic' },
    t + 650,
  );
  wordsIn(tl, '#reveal-sub', t + 1000);
  t += 2900;
  tl.add(
    '#reveal',
    {
      opacity: [1, 0],
      scale: [1, 1.06],
      filter: ['blur(0px)', 'blur(8px)'],
      duration: 450,
      ease: 'inQuad',
    },
    t,
  );
  t += 450;
  tl.set('#reveal', { opacity: 0 }, t);
  return t;
}

import { createDrawable, spring, stagger } from 'animejs';
import { type TL } from '../anim';
import { BEAT, setMusic, sfx } from '../audio';
import { Icon } from '../ui/parts';

/**
 * The opening, one continuous shot:
 * letters fly in and assemble → they dissolve into particles that form a doc page → the camera
 * pulls back over a grid of pages → pushes into an empty image slot → "But the images? Still by
 * hand." → the manual steps, one by one → implode → the name explodes out.
 */

/** Seeded random, so every render is identical */
function rng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

const line1 = 'AI writes your docs';
const line2 = 'in seconds.';
/** The manual routine, one step at a time */
const chores = [
  { icon: Icon.camera, text: <>Take a screenshot</> },
  { icon: Icon.crop, text: <>Crop it in another app</> },
  {
    icon: Icon.pencil,
    text: (
      <>
        Rename <code>Screenshot 2026-09-27 at 10.42.17.png</code>
      </>
    ),
  },
  {
    icon: Icon.folder,
    text: (
      <>
        Move it to <code>public/images/docs/…</code>
      </>
    ),
  },
  {
    icon: Icon.keyboard,
    text: (
      <>
        Type <code>![…](/images/docs/…)</code> into the MDX
      </>
    ),
  },
  { icon: Icon.refresh, text: <>Refresh the page to check it</> },
];
const mark = 'mdx-media-manager';

/** 3×3 pages; the middle one is where the story happens */
const grid = [-1, 0, 1].flatMap((gy) => [-1, 0, 1].map((gx) => ({ gx, gy })));

function Letters({ text, className }: { text: string; className: string }) {
  return (
    <div className={className}>
      {text.split(' ').map((word, w) => (
        <span className="lw" key={w}>
          {[...word].map((c, i) => (
            <span className="lt" key={i}>
              {c}
            </span>
          ))}
        </span>
      ))}
    </div>
  );
}

function Page({ main }: { main?: boolean }) {
  return (
    <>
      <svg className="page-frame" width="820" height="780" viewBox="0 0 820 780">
        <rect x="1.5" y="1.5" width="817" height="777" rx="22" />
      </svg>
      <div className="page-fill" />
      <div className="page-tab">
        <span className="tab-dot" />
        <span className="tab-dot" />
        <span className="tab-dot" />
        <span className="bar tab-bar" />
      </div>
      <div className="page-body">
        <span className="bar b-title" />
        <span className="bar b-desc" />
        <span className="bar b-h2" />
        <span className="bar b-text" style={{ width: '96%' }} />
        <span className="bar b-text" style={{ width: '90%' }} />
        <span className="bar b-text" style={{ width: '58%' }} />
        <div className={`slot ${main ? 'slot-main' : ''}`}>
          <svg className="ants" width="100%" height="100%">
            <rect x="2" y="2" width="99.4%" height="97.6%" rx="16" />
          </svg>
          <span className="slot-icon">{Icon.image}</span>
        </div>
        <span className="bar b-h2" style={{ width: '28%' }} />
        <span className="code-block">
          <span className="bar b-code" />
        </span>
        <span className="bar b-text" style={{ width: '92%' }} />
        <span className="bar b-text" style={{ width: '70%' }} />
      </div>
    </>
  );
}

export function Intro() {
  const firstLine = line1.replace(/ /g, '').length;
  return (
    <section className="scene" id="intro">
      <div id="world">
        {grid.map(({ gx, gy }) => (
          <div
            key={`${gx},${gy}`}
            className={`page ${gx === 0 && gy === 0 ? 'main' : 'other'}`}
            style={{ left: 550 + gx * 900, top: 150 + gy * 860 }}
          >
            <Page main={gx === 0 && gy === 0} />
          </div>
        ))}
        <div id="headline">
          <Letters text={line1} className="hl hl-1" />
          <Letters text={line2} className="hl hl-2" />
        </div>
        <div id="dots">
          {[...(line1 + line2).replace(/ /g, '')].map((_, i) => (
            <span key={i} className={`dot ${i >= firstLine ? 'accent' : ''}`} data-i={i} />
          ))}
        </div>
      </div>

      <div id="question">
        <Letters text="But the images?" className="q q-1" />
        <Letters text="Still by hand." className="q q-2" />
      </div>

      <ol id="steps">
        {chores.map((c, i) => (
          <li key={i} className="card step" data-i={i}>
            <span className="step-n">{i + 1}</span>
            <span className="step-icon">{c.icon}</span>
            <span className="step-text">{c.text}</span>
            <span className="step-tick">{Icon.check}</span>
            <span className="step-progress" />
          </li>
        ))}
        <li className="steps-foot" id="steps-foot">
          <span className="loop-icon">{Icon.refresh}</span>
          <span className="w">Repeat</span> <span className="w">for</span>{' '}
          <span className="w">every</span> <span className="w">image,</span>{' '}
          <span className="w">on</span> <span className="w">every</span>{' '}
          <span className="w">page.</span>
        </li>
      </ol>

      <div id="burst">
        <span id="flash" />
        {Array.from({ length: 18 }, (_, i) => (
          <span key={i} className="shard-arm" style={{ transform: `rotate(${i * 20}deg)` }}>
            <i className="shard" />
          </span>
        ))}
      </div>

      <div id="brand">
        <div className="mark" id="brand-mark">
          {[...mark].map((c, i) => (
            <span key={i} className={`mk ${c === '-' ? 'dash' : ''}`}>
              {c}
            </span>
          ))}
        </div>
        <svg id="brand-line" width="820" height="30" viewBox="0 0 820 30">
          <path
            d="M6 18 C 200 4, 420 28, 814 10"
            fill="none"
            stroke="#4f46e5"
            strokeWidth="6"
            strokeLinecap="round"
          />
        </svg>
        <div className="brand-sub">
          {'Add, replace and delete images'.split(' ').map((w, i) => (
            <span className="wm" key={i}>
              <span className="w">{w}</span>
            </span>
          ))}
          {'right on the page.'.split(' ').map((w, i) => (
            <span className="wm" key={`a${i}`}>
              <span className="w accent">{w}</span>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------------------------

const $ = (s: string) => document.querySelector<HTMLElement>(s)!;
const $$ = (s: string) => [...document.querySelectorAll<HTMLElement>(s)];

/** Position of an element inside a container, ignoring transforms (layout at rest) */
function pos(el: HTMLElement, root: HTMLElement) {
  let x = 0;
  let y = 0;
  for (let n: HTMLElement | null = el; n && n !== root; n = n.offsetParent as HTMLElement | null) {
    x += n.offsetLeft;
    y += n.offsetTop;
  }
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  return { x, y, w, h, cx: x + w / 2, cy: y + h / 2 };
}

/** Camera: how far to move the world so world point `p` lands on screen point `to` at `scale` */
function aim(p: { x: number; y: number }, scale: number, to = { x: 960, y: 540 }) {
  return { x: to.x - 960 - (p.x - 960) * scale, y: to.y - 540 - (p.y - 540) * scale };
}

export function buildIntro(tl: TL, t0: number) {
  const r = rng(11);
  const world = $('#world');
  const t = t0;
  tl.set('#intro', { opacity: 1 }, t);

  // --- 1. Letters fly in from everywhere and assemble ------------------------------------------
  const letters1 = $$('#headline .hl-1 .lt');
  letters1.forEach((el) => {
    tl.add(
      el,
      {
        opacity: [0, 1],
        x: [(r() - 0.5) * 1800, 0],
        y: [(r() - 0.5) * 1000, 0],
        z: [-1400 + r() * 1800, 0],
        rotateX: [(r() - 0.5) * 360, 0],
        rotateY: [(r() - 0.5) * 360, 0],
        rotate: [(r() - 0.5) * 180, 0],
        filter: ['blur(18px)', 'blur(0px)'],
        duration: 1300,
        ease: 'outExpo',
      },
      t + 80 + r() * 520,
    );
  });
  sfx.whoosh(t + 60, { length: 1.1, gain: 0.8 });
  letters1.forEach(
    (_, i) =>
      i % 3 === 0 &&
      sfx.tick(t + 500 + i * 35, { gain: 1.5, pan: (i / letters1.length) * 1.4 - 0.7 }),
  );

  // "in seconds." slams in on the beat
  const slam = t + 3 * BEAT;
  tl.add(
    '#headline .hl-2 .lt',
    {
      opacity: [0, 1],
      scale: [3.2, 1],
      z: [500, 0],
      filter: ['blur(14px)', 'blur(0px)'],
      duration: 520,
      ease: 'outExpo',
      delay: stagger(28),
    },
    slam,
  );
  tl.add(
    '#world',
    { x: [0, 14, -10, 6, -3, 0], y: [0, -8, 6, -3, 0], duration: 380, ease: 'linear' },
    slam + 60,
  );
  sfx.thud(slam + 40, { gain: 1 });
  setMusic({ kickFrom: slam });

  // --- 2. The headline dissolves into dots, which fly and form a page ---------------------------
  const dissolve = slam + 4 * BEAT;
  // A slow push while the page forms
  tl.add('#world', { scale: [1, 1.05], duration: dissolve + 2600 - t, ease: 'inOutSine' }, t);
  const allLetters = $$('#headline .lt');
  const bars = $$('#world .page.main .bar');
  const targets = bars.map((b) => pos(b, world));
  const perBar = Math.ceil(allLetters.length / targets.length);
  allLetters.forEach((el, i) => {
    const p = pos(el, world);
    const dot = `#dots .dot[data-i="${i}"]`;
    const bar = targets[i % targets.length]!;
    const share = Math.floor(i / targets.length);
    const tx = bar.x + 8 + (bar.w - 16) * (share / Math.max(1, perBar - 1)) * 0.9;
    const ty = bar.cy;
    const at = dissolve + 200 + (i % 9) * 40 + r() * 200;
    tl.set(dot, { x: p.cx, y: p.cy }, t);
    tl.add(
      el,
      { scale: [1, 0.2], opacity: [1, 0], duration: 260, ease: 'inQuad' },
      dissolve + i * 14,
    );
    tl.add(dot, { opacity: [0, 1], scale: [2.2, 1], duration: 260 }, dissolve + i * 14);
    tl.add(dot, { x: [p.cx, tx], duration: 900, ease: 'inOutQuart' }, at);
    tl.add(dot, { y: [p.cy, ty], duration: 900, ease: 'inOutBack(1.6)' }, at);
    tl.add(dot, { scale: [1, 0.4], opacity: [1, 0], duration: 250, ease: 'inQuad' }, at + 850);
  });
  sfx.whoosh(dissolve + 150, { length: 1.2, gain: 0.9 });

  // The page draws itself around the arriving dots
  const formed = dissolve + 1100;
  tl.add('#world .page.main .page-frame rect', { opacity: [0, 1], duration: 1 }, dissolve + 300);
  tl.add(
    createDrawable('#world .page.main .page-frame rect'),
    { draw: ['0 0', '0 1'], duration: 1100, ease: 'inOutCubic' },
    dissolve + 300,
  );
  tl.add('#world .page.main .page-fill', { opacity: [0, 1], duration: 500 }, formed);
  tl.add('#world .page.main .page-tab', { opacity: [0, 1], y: [-12, 0], duration: 500 }, formed);
  tl.add(
    '#world .page.main .bar',
    { scaleX: [0, 1], duration: 650, ease: 'outExpo', delay: stagger(55) },
    formed,
  );
  tl.add(
    '#world .page.main .code-block',
    { opacity: [0, 1], scale: [0.9, 1], duration: 500 },
    formed + 300,
  );
  [0, 3, 6, 9].forEach((k) => sfx.pop(formed + k * 55, { gain: 0.6, pan: k / 12 - 0.4 }));

  // --- 3. Pull back: pages everywhere ---------------------------------------------------------
  const pull = formed + 1500;
  tl.add('#world', { scale: [1.05, 0.36], duration: 1500, ease: 'inOutCubic' }, pull);
  sfx.whoosh(pull, { length: 1.5, gain: 0.7 });
  $$('#world .page.other').forEach((pg, i) => {
    const at = pull + 350 + i * 70;
    const frame = pg.querySelector<SVGRectElement>('.page-frame rect')!;
    tl.add(frame, { opacity: [0, 1], duration: 1 }, at);
    tl.add(createDrawable(frame), { draw: ['0 0', '0 1'], duration: 700, ease: 'inOutCubic' }, at);
    tl.add(pg.querySelector('.page-fill')!, { opacity: [0, 1], duration: 400 }, at + 500);
    tl.add(pg.querySelector('.page-tab')!, { opacity: [0, 1], duration: 400 }, at + 500);
    tl.add(
      pg.querySelectorAll('.bar'),
      { scaleX: [0, 1], duration: 500, ease: 'outExpo', delay: stagger(30) },
      at + 550,
    );
    tl.add(pg.querySelector('.code-block')!, { opacity: [0, 1], duration: 400 }, at + 700);
  });
  sfx.shimmer(pull + 900, { gain: 0.7 });

  // Every page has an empty image slot
  const slots = pull + 1800;
  tl.add(
    '#world .slot',
    {
      opacity: [0, 1],
      scale: [0.85, 1],
      ease: spring({ bounce: 0.4, duration: 600 }),
      delay: stagger(60),
    },
    slots,
  );
  tl.add(
    '#world .ants rect',
    { strokeDashoffset: [0, -420], duration: 9000, ease: 'linear' },
    slots,
  );
  [0, 2, 4, 6, 8].forEach((k) => sfx.pop(slots + k * 60, { gain: 0.35, pan: k / 8 - 0.5 }));

  // --- 4. Push into the main page's empty slot ------------------------------------------------
  const push = slots + 1000;
  const slot = pos($('#world .slot-main'), world);
  const zoom = 1.6;
  const cam = aim({ x: slot.cx, y: slot.cy }, zoom, { x: 960, y: 800 });
  tl.add(
    '#world',
    { scale: [0.36, zoom], x: [0, cam.x], y: [0, cam.y], duration: 1400, ease: 'inOutQuart' },
    push,
  );
  tl.add('#world .page.other', { opacity: [1, 0], duration: 600, ease: 'inQuad' }, push + 400);
  sfx.whoosh(push, { length: 1.3, gain: 0.8, pan: 0.2 });

  // "But the images?" drops in with gravity
  const ask = push + 1300;
  $$('#question .q-1 .lt').forEach((el, i) => {
    tl.add(
      el,
      {
        opacity: [0, 1],
        y: [-700, 0],
        rotate: [(r() - 0.5) * 40, 0],
        duration: 900,
        ease: 'outBounce',
      },
      ask + i * 38,
    );
  });
  [0, 4, 8].forEach((k) => sfx.thud(ask + 520 + k * 38, { gain: 0.45 }));

  // "Still by hand." stamps down on the beat
  const stamp = ask + 3 * BEAT;
  tl.add(
    '#question .q-2 .lt',
    {
      opacity: [0, 1],
      scale: [2.6, 1],
      filter: ['blur(10px)', 'blur(0px)'],
      duration: 420,
      ease: 'outExpo',
      delay: stagger(22),
    },
    stamp,
  );
  tl.add(
    '#world',
    { x: [cam.x, cam.x + 12, cam.x - 9, cam.x + 4, cam.x], duration: 320, ease: 'linear' },
    stamp + 80,
  );
  sfx.thud(stamp + 60, { gain: 1 });

  // --- 5. The routine, step by step: each one lands, gets done, and is ticked off -------------
  const steps0 = stamp + 2 * BEAT;
  const STEP = 3 * BEAT;
  tl.add(
    '#world',
    { opacity: [1, 0.2], filter: ['blur(0px)', 'blur(4px)'], duration: 700 },
    steps0,
  );
  chores.forEach((_, i) => {
    const row = `#steps .step[data-i="${i}"]`;
    const at = steps0 + 200 + i * STEP;
    tl.add(
      row,
      {
        opacity: [0, 1],
        x: [180, 0],
        scale: [0.92, 1],
        filter: ['blur(8px)', 'blur(0px)'],
        duration: 650,
        ease: 'outExpo',
      },
      at,
    );
    tl.add(
      `${row} .step-n`,
      { scale: [0.3, 1], rotate: [-90, 0], ease: spring({ bounce: 0.45, duration: 600 }) },
      at + 60,
    );
    sfx.swish(at, { length: 0.4, gain: 0.4, pan: 0.5 });
    // Doing it by hand takes a while
    tl.add(
      `${row} .step-progress`,
      { scaleX: [0, 1], duration: STEP - 700, ease: 'inOutSine' },
      at + 250,
    );
    tl.add(
      `${row} .step-tick`,
      { opacity: [0, 1], scale: [0.2, 1], ease: spring({ bounce: 0.5, duration: 500 }) },
      at + STEP - 420,
    );
    tl.add(
      `${row} .step-n`,
      { backgroundColor: ['#18181b', '#059669'], duration: 250 },
      at + STEP - 420,
    );
    tl.add(`${row} .step-progress`, { opacity: [1, 0], duration: 250 }, at + STEP - 300);
    tl.add(row, { opacity: [1, 0.55], duration: 300 }, at + STEP - 100);
    sfx.pop(at + STEP - 420, { gain: 0.5 });
  });
  const foot = steps0 + 200 + chores.length * STEP;
  tl.add('#steps-foot', { opacity: [0, 1], duration: 1 }, foot);
  tl.add(
    '#steps-foot .w',
    { opacity: [0, 1], y: [30, 0], duration: 600, ease: 'outExpo', delay: stagger(60) },
    foot,
  );
  tl.add(
    '#steps-foot .loop-icon',
    { opacity: [0, 1], rotate: [-180, 360], duration: 1600, ease: 'outCubic' },
    foot,
  );
  tl.add('#steps .step', { opacity: [0.55, 1], duration: 300 }, foot + 300);
  sfx.riser(foot, { length: 1.8, gain: 0.8 });

  // --- 6. Implode, then the name explodes out of the flash ------------------------------------
  const implode = foot + 3 * BEAT;
  tl.add(
    '#steps',
    { scale: [1, 0], filter: ['blur(0px)', 'blur(12px)'], duration: 450, ease: 'inBack(1.4)' },
    implode,
  );
  tl.add(
    '#question',
    { scale: [1, 0], opacity: [1, 0], rotate: [0, -20], duration: 450, ease: 'inBack(1.4)' },
    implode,
  );
  tl.add(
    '#world',
    { scale: [zoom, 0.05], opacity: [0.2, 0], duration: 500, ease: 'inBack(1.2)' },
    implode,
  );
  const boom = implode + 480;
  setMusic({ dropAt: boom });
  sfx.impact(boom, { gain: 1 });
  tl.add(
    '#flash',
    { opacity: [0.9, 0], scale: [0.05, 4.5], duration: 900, ease: 'outCubic' },
    boom,
  );
  tl.add(
    '#burst .shard',
    { opacity: [1, 0], x: [30, 520], scaleX: [1.6, 0.2], duration: 800, ease: 'outExpo' },
    boom,
  );

  const brand = $('#brand');
  $$('#brand-mark .mk').forEach((el) => {
    const p = pos(el, brand);
    tl.add(
      el,
      {
        opacity: [0, 1],
        x: [960 - p.cx, 0],
        y: [470 - p.cy, 0],
        scale: [0, 1],
        rotate: [(r() - 0.5) * 540, 0],
        filter: ['blur(14px)', 'blur(0px)'],
        duration: 1100,
        ease: 'outExpo',
      },
      boom + 30 + r() * 120,
    );
  });
  tl.add(
    '#brand-mark .dash',
    { color: ['#18181b', '#4f46e5'], scale: [1, 1.35, 1], duration: 500, ease: 'outBack(2)' },
    boom + 900,
  );
  tl.add('#brand-line path', { opacity: [0, 1], duration: 1 }, boom + 800);
  tl.add(
    createDrawable('#brand-line path'),
    { draw: ['0 0', '0 1'], duration: 800, ease: 'inOutCubic' },
    boom + 800,
  );
  tl.add('#brand .w', { opacity: [0, 1], duration: 1 }, boom + 1100);
  tl.add(
    '#brand .w',
    { y: ['110%', '0%'], duration: 800, ease: 'outExpo', delay: stagger(60) },
    boom + 1100,
  );
  sfx.shimmer(boom + 900, { gain: 0.8 });

  // Hold, then clear for the product
  const out = boom + 3600;
  tl.add(
    '#brand',
    {
      opacity: [1, 0],
      scale: [1, 0.92],
      y: [0, -40],
      filter: ['blur(0px)', 'blur(8px)'],
      duration: 500,
      ease: 'inQuad',
    },
    out,
  );
  sfx.whoosh(out, { length: 0.7, gain: 0.6 });
  const end = out + 500;
  tl.set('#intro', { opacity: 0 }, end);
  return end;
}

import { createDrawable, spring, stagger } from 'animejs';
import { enter, pop, type, wordsIn, type TL } from '../anim';
import { sfx } from '../audio';
import { Chars, Icon, Skel, Words } from '../ui/parts';
import { Wordmark } from './reveal';

const cdnUrl = 'https://cdn.example.com/docs/index/docs-home-9f3c2a1b.webp';

export function Storage() {
  return (
    <section className="scene" id="storage">
      <Words id="cap-storage" text="Your media stays in *git* or *S3.*" className="title" />
      <div className="store-row">
        <div className="card store" id="store-git">
          <div className="store-head">
            <span className="store-icon">{Icon.git}</span>
            <b>Git</b>
            <span className="muted">default</span>
          </div>
          <svg className="graph" width="60" height="230" viewBox="0 0 60 230">
            <path
              d="M30 10 V 220"
              stroke="#d4d4d8"
              strokeWidth="4"
              fill="none"
              strokeLinecap="round"
            />
          </svg>
          <div className="commits">
            <div className="commit new">
              <span className="node" />
              <div>
                <b>docs: add home page screenshot</b>
                <span className="mono file">M content/docs/index.mdx</span>
                <span className="mono file add">
                  A public/images/docs/index/docs-home-9f3c2a1b.webp
                </span>
              </div>
            </div>
            <div className="commit">
              <span className="node" />
              <div>
                <b>docs: installation guide</b>
                <Skel w={220} h={10} />
              </div>
            </div>
          </div>
        </div>
        <div className="card store" id="store-s3">
          <div className="store-head">
            <span className="store-icon">{Icon.cloud}</span>
            <b>S3 + CDN</b>
            <span className="muted">optional</span>
          </div>
          <div className="env mono">
            MDX_MEDIA_S3_BUCKET=<b>docs-media</b>
          </div>
          <div className="flow">
            <span className="flow-node">{Icon.image}</span>
            <span className="flow-line">
              <span className="bar" />
              <span className="packet" />
            </span>
            <span className="flow-node">{Icon.cloud}</span>
            <span className="flow-line">
              <span className="bar" />
              <span className="packet" />
            </span>
            <span className="flow-node">{Icon.globe}</span>
          </div>
          <div className="cdn-url mono">
            <Chars text={cdnUrl} />
          </div>
        </div>
      </div>
      <Words id="cap-nodb" text="No database. Just files." className="subtitle" />
    </section>
  );
}

export function Dev() {
  return (
    <section className="scene" id="dev">
      <Words id="cap-dev" text="Only in *development.*" className="title" />
      <div className="switch-row">
        <span className="mono cmd" id="cmd-dev">
          next dev
        </span>
        <span id="switch">
          <span id="knob" />
        </span>
        <span className="mono cmd" id="cmd-build">
          next build
        </span>
      </div>
      <div className="card mini" id="mini">
        <div className="mini-page">
          <Skel w="46%" h={22} />
          <Skel w="92%" />
          <Skel w="86%" />
          <div className="mini-img" />
          <Skel w="90%" />
          <Skel w="60%" />
        </div>
        <span className="mini-o" id="mini-outline" />
        <span className="mini-o" id="mini-pill">
          + Image below
        </span>
        <span className="mini-o" id="mini-tools">
          <i>Edit</i>
          <i>Delete</i>
        </span>
        <span className="mini-o" id="mini-dock">
          <i>Library</i>
          <i className="on">Images on</i>
        </span>
      </div>
      <Words
        id="cap-dev-sub"
        text="Nothing ships to production: no routes, no components, no runtime code."
        className="subtitle"
      />
    </section>
  );
}

export function Outro() {
  return (
    <section className="scene" id="outro">
      <Wordmark id="outro-mark" />
      <div className="card terminal-pill mono" id="outro-cmd">
        <span className="muted">$</span> <Chars text="npx mdx-media-manager init" />
      </div>
      <Words
        id="outro-sub"
        text="For Fumadocs on Next.js and TanStack Start"
        className="subtitle"
      />
      <div id="outro-url" className="url">
        {Icon.git} github.com/godwinpinto/mdx-media-manager
      </div>
    </section>
  );
}

/** ~5.2s */
export function buildStorage(tl: TL, t0: number) {
  let t = t0;
  tl.set('#storage', { opacity: 1 }, t);
  sfx.whoosh(t, { length: 0.9, gain: 0.7 });
  sfx.swish(t + 1800, { length: 0.7, gain: 0.4, pan: 0.5 });
  sfx.swish(t + 3300, { length: 0.7, gain: 0.4, pan: 0.5 });
  wordsIn(tl, '#cap-storage', t);
  enter(tl, '#store-git', t + 300, { y: 50 });
  enter(tl, '#store-s3', t + 450, { y: 50 });
  tl.add(
    createDrawable('#store-git .graph path'),
    { draw: ['0 0', '0 1'], duration: 900, ease: 'inOutCubic' },
    t + 700,
  );
  pop(tl, '#store-git .node', t + 900, { each: 250 });
  tl.add(
    '#store-git .commit',
    { opacity: [0, 1], x: [-16, 0], duration: 500, delay: stagger(250) },
    t + 950,
  );
  tl.add('#store-git .file', { opacity: [0, 1], duration: 400, delay: stagger(150) }, t + 1300);
  tl.add('#store-s3 .env', { opacity: [0, 1], y: [10, 0], duration: 500 }, t + 900);
  pop(tl, '#store-s3 .flow-node', t + 1100, { each: 300 });
  tl.add(
    '#store-s3 .flow-line .bar',
    { scaleX: [0, 1], duration: 500, ease: 'inOutCubic', delay: stagger(300) },
    t + 1250,
  );
  // The image travels: file → bucket → CDN, twice
  for (const k of [0, 1]) {
    tl.add(
      '#store-s3 .flow-line .packet',
      { opacity: [0, 1, 1, 0], x: [0, 132], duration: 700, ease: 'inOutSine', delay: stagger(700) },
      t + 1800 + k * 1500,
    );
  }
  type(tl, '#store-s3 .cdn-url', t + 1900, 16);
  wordsIn(tl, '#cap-nodb', t + 2500);
  t += 4700;
  tl.add('#storage', { opacity: [1, 0], y: [0, -30], duration: 450, ease: 'inQuad' }, t);
  t += 450;
  tl.set('#storage', { opacity: 0 }, t);
  return t;
}

/** ~5s */
export function buildDev(tl: TL, t0: number) {
  let t = t0;
  tl.set('#dev', { opacity: 1 }, t);
  sfx.whoosh(t, { length: 0.8, gain: 0.6 });
  sfx.click(t + 2000, { gain: 1 });
  sfx.swish(t + 2150, { length: 0.5, gain: 0.5 });
  wordsIn(tl, '#cap-dev', t);
  enter(tl, '.switch-row', t + 250, { y: 20 });
  enter(tl, '#mini', t + 400, { y: 40 });
  tl.add(
    '#mini .skel, #mini .mini-img',
    { scaleX: [0, 1], duration: 500, delay: stagger(40) },
    t + 600,
  );
  pop(tl, '#mini .mini-o', t + 900, { each: 120 });
  t += 2000;
  // Flip to a production build: the overlay is simply not there
  tl.add('#knob', { x: [0, 56], duration: 450, ease: spring({ bounce: 0.3, duration: 450 }) }, t);
  tl.add('#switch', { backgroundColor: ['#059669', '#a1a1aa'], duration: 300 }, t);
  tl.add('#cmd-dev', { color: ['#18181b', '#a1a1aa'], duration: 300 }, t);
  tl.add('#cmd-build', { color: ['#a1a1aa', '#18181b'], duration: 300 }, t);
  tl.add(
    '#mini .mini-o',
    {
      opacity: [1, 0],
      scale: [1, 0.4],
      filter: ['blur(0px)', 'blur(4px)'],
      duration: 380,
      ease: 'inBack',
      delay: stagger(60),
    },
    t + 150,
  );
  wordsIn(tl, '#cap-dev-sub', t + 500);
  t += 2900;
  tl.add('#dev', { opacity: [1, 0], scale: [1, 0.97], duration: 400, ease: 'inQuad' }, t);
  t += 400;
  tl.set('#dev', { opacity: 0 }, t);
  return t;
}

/** ~4.5s, holds on the last frame */
export function buildOutro(tl: TL, t0: number) {
  let t = t0;
  tl.set('#outro', { opacity: 1 }, t);
  sfx.whoosh(t, { length: 0.8, gain: 0.6 });
  sfx.thud(t + 450, { gain: 0.7 });
  sfx.shimmer(t + 700, { gain: 0.7 });
  tl.add(
    '#outro-mark .ch',
    {
      opacity: [0, 1],
      y: [40, 0],
      filter: ['blur(10px)', 'blur(0px)'],
      duration: 700,
      delay: stagger(28),
    },
    t,
  );
  tl.add('#outro-mark .dash', { color: ['#18181b', '#4f46e5'], duration: 400 }, t + 500);
  enter(tl, '#outro-cmd', t + 600, { y: 24 });
  type(tl, '#outro-cmd', t + 900, 30);
  wordsIn(tl, '#outro-sub', t + 1700);
  enter(tl, '#outro-url', t + 2000, { y: 14 });
  t += 4500;
  return t;
}

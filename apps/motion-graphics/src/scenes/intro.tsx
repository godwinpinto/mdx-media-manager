import { createDrawable, createMotionPath, spring, stagger } from 'animejs';
import { maskIn, maskOut, type TL } from '../anim';
import { Chars, Icon, Skel, Words } from '../ui/parts';

const prompt = 'Write the installation guide for our docs';

/** Chores around the doc, clockwise from the top left. `x`/`y` are card centres on the stage. */
const chores = [
  { icon: Icon.camera, text: <>Take a screenshot</>, x: 300, y: 390, r: -3 },
  { icon: Icon.crop, text: <>Crop it in another app</>, x: 1630, y: 390, r: 2.5 },
  {
    icon: Icon.pencil,
    text: (
      <>
        Rename <code>Screenshot 2026-09-27 at 10.42.17.png</code>
      </>
    ),
    x: 1630,
    y: 640,
    r: -2,
  },
  {
    icon: Icon.folder,
    text: (
      <>
        Move it into <code>public/images/docs/…</code>
      </>
    ),
    x: 1630,
    y: 890,
    r: 3,
  },
  {
    icon: Icon.keyboard,
    text: (
      <>
        Type <code>![…](/images/docs/…)</code> by hand
      </>
    ),
    x: 300,
    y: 890,
    r: -2.5,
  },
  { icon: Icon.refresh, text: <>Refresh and check</>, x: 300, y: 640, r: 2 },
];

/** Skeleton lines that fly from the Generate button into the doc: [width, target x, target y] */
const packets = [
  [120, 1010, 430],
  [220, 1060, 470],
  [90, 1000, 540],
  [180, 1100, 580],
  [140, 1040, 650],
  [240, 1120, 700],
  [100, 1010, 760],
  [200, 1080, 820],
  [160, 1150, 880],
  [110, 1030, 930],
];

/** Faint outlined shapes drifting behind everything: [kind, x, y, size] */
const shapes: [string, number, number, number][] = [
  ['ring', 120, 160, 90],
  ['square', 1720, 130, 70],
  ['plus', 1580, 960, 44],
  ['ring', 820, 980, 50],
  ['square', 90, 820, 56],
  ['plus', 520, 120, 36],
  ['ring', 1840, 560, 40],
  ['square', 1180, 70, 38],
];

const deck = [
  { id: '#deck-1', r: -9, x: -130, y: 40 },
  { id: '#deck-2', r: 6, x: 90, y: -36 },
  { id: '#deck-3', r: 13, x: 210, y: 56 },
];

function Placeholder({ id }: { id: string }) {
  return (
    <div className="dl ph" id={id}>
      <span className="ph-box">
        <svg className="ants" width="100%" height="100%">
          <rect x="2" y="2" width="99%" height="96%" rx="14" />
        </svg>
        {Icon.image}
      </span>
    </div>
  );
}

export function Intro() {
  return (
    <section className="scene" id="intro">
      <div id="intro-world">
        <div className="shapes">
          {shapes.map(([kind, x, y, size], i) => (
            <span
              key={i}
              className={`shape ${kind}`}
              style={{ left: x, top: y, width: size, height: size }}
            />
          ))}
        </div>

        {/* The loop through the chores, behind the doc */}
        <svg id="loop" width="1920" height="1080" viewBox="0 0 1920 1080">
          <path
            d="M 390 390 H 1540 A 90 90 0 0 1 1630 480 V 800 A 90 90 0 0 1 1540 890 H 390 A 90 90 0 0 1 300 800 V 480 A 90 90 0 0 1 390 390 Z"
            fill="none"
            stroke="#c7c9f5"
            strokeWidth="4"
            strokeLinecap="round"
          />
        </svg>
        <span id="loop-dot" />

        <div id="prompt" className="card prompt">
          <div className="prompt-head">
            <span className="ai-dot" />
            Prompt
          </div>
          <div className="prompt-text">
            <Chars text={prompt} />
          </div>
          <div className="prompt-send">
            Generate
            <span className="burst">
              {Array.from({ length: 12 }, (_, i) => (
                <span key={i} className="ray" style={{ transform: `rotate(${i * 30}deg)` }}>
                  <i />
                </span>
              ))}
            </span>
          </div>
        </div>

        {packets.map(([w], i) => (
          <span key={i} className="packet" data-i={i} style={{ width: w }} />
        ))}

        {['nextjs.mdx', 'library.mdx', 's3.mdx'].map((name, i) => (
          <div key={name} className="card doc deck" id={`deck-${i + 1}`}>
            <div className="doc-tab">
              {Icon.file}
              <b>{name}</b>
            </div>
          </div>
        ))}

        <div id="doc" className="card doc">
          <div className="doc-tab">
            {Icon.file}
            <b>installation.mdx</b>
            <span>content/docs</span>
          </div>
          <div className="doc-body">
            <div className="dl mono muted">---</div>
            <div className="dl mono">
              <span className="muted">title:</span>&nbsp;Installation
            </div>
            <div className="dl mono muted">---</div>
            <div className="dl mono h">## Automatic setup</div>
            <div className="dl">
              <Skel w="92%" />
            </div>
            <div className="dl">
              <Skel w="64%" />
            </div>
            <Placeholder id="ph1" />
            <div className="dl code-line mono">npx mdx-media-manager init</div>
            <div className="dl mono h">## Configure</div>
            <div className="dl">
              <Skel w="88%" />
            </div>
            <div className="dl">
              <Skel w="95%" />
            </div>
            <Placeholder id="ph2" />
            <div className="dl">
              <Skel w="72%" />
            </div>
            <div className="dl">
              <Skel w="40%" />
            </div>
          </div>
        </div>

        {chores.map((c, i) => (
          <div className="card chore" key={i} data-i={i} style={{ left: c.x, top: c.y }}>
            <span className="chore-n">{c.icon}</span>
            <span className="chore-text">{c.text}</span>
            <span className="chore-tick">{Icon.check}</span>
          </div>
        ))}
      </div>

      <div id="hook-head">
        <Words id="cap-hook" text="AI writes your docs *in seconds.*" className="title" mask />
      </div>
      <Words id="cap-problem" text="The images? *Still by hand.*" className="title" mask />
      <Words id="chore-note" text="…for every image, on every page." className="subtitle" />
      <span id="flash" />
    </section>
  );
}

/** ~13.5s: kinetic opening, the page writes itself, then the manual routine collapses */
export function buildIntro(tl: TL, t0: number) {
  const t = t0;
  tl.set('#intro', { opacity: 1 }, t);

  // Background shapes drift the whole time
  tl.add(
    '#intro .shape',
    { opacity: [0, 1], scale: [0.4, 1], duration: 900, delay: stagger(80) },
    t,
  );
  tl.add(
    '#intro .shape',
    {
      x: stagger([-40, 40]),
      y: stagger([30, -30]),
      rotate: stagger([-35, 35]),
      duration: 12_500,
      ease: 'inOutSine',
    },
    t + 300,
  );

  // 1. Kinetic headline: big in the middle, then it takes its place at the top
  tl.set('#hook-head', { y: 330, scale: 1.4 }, t);
  maskIn(tl, '#cap-hook', t + 150, 110);
  tl.add(
    '#hook-head',
    { y: [330, 0], scale: [1.4, 1], duration: 900, ease: 'inOutCubic' },
    t + 1500,
  );

  // 2. The prompt swings in and types itself
  tl.add(
    '#prompt',
    {
      opacity: [0, 1],
      rotateY: [42, 12],
      rotateX: [8, 3],
      x: [-160, 0],
      scale: [0.82, 1],
      duration: 1100,
      ease: 'outExpo',
    },
    t + 1750,
  );
  tl.add(
    '#prompt .ch',
    { opacity: [0, 1], y: [10, 0], duration: 180, ease: 'outCubic', delay: stagger(24) },
    t + 2250,
  );
  const pressed = t + 2250 + prompt.length * 24 + 200;
  tl.add(
    '#prompt .prompt-send',
    { scale: [1, 0.9, 1.04, 1], duration: 420, ease: 'inOutQuad' },
    pressed,
  );
  tl.add(
    '#prompt .ray i',
    { opacity: [0, 1, 0], x: [18, 70], scaleX: [0.3, 1, 0.2], duration: 520, ease: 'outCubic' },
    pressed + 120,
  );

  // 3. Lines fly from the button into the doc, which swings in from the side
  const origin = { x: 330, y: 690 };
  packets.forEach(([, x, y], i) => {
    const el = `.packet[data-i="${i}"]`;
    const at = pressed + 180 + i * 70;
    tl.set(el, { x: origin.x, y: origin.y }, t);
    tl.add(
      el,
      { opacity: [0, 1, 1, 0], scale: [0.4, 1, 1, 0.6], duration: 820, ease: 'linear' },
      at,
    );
    tl.add(el, { x: [origin.x, x], duration: 820, ease: 'inOutQuad' }, at);
    tl.add(el, { y: [origin.y, y], duration: 820, ease: 'outBack(1.4)' }, at);
  });
  tl.add(
    '#doc',
    {
      opacity: [0, 1],
      rotateY: [-42, -11],
      rotateX: [14, 4],
      x: [160, 0],
      scale: [0.74, 1],
      duration: 1200,
      ease: 'outExpo',
    },
    pressed + 150,
  );
  tl.add(
    '#doc .dl:not(.ph)',
    {
      opacity: [0, 1],
      rotateX: [-90, 0],
      duration: 600,
      ease: 'outBack(1.2)',
      delay: stagger(60),
    },
    pressed + 500,
  );
  tl.add(
    '#doc .skel',
    { scaleX: [0, 1], duration: 700, ease: 'outExpo', delay: stagger(60) },
    pressed + 600,
  );

  // 4. More pages fan out behind it
  const fanned = pressed + 1900;
  deck.forEach((d, i) => {
    tl.add(
      d.id,
      {
        opacity: [0, 1],
        rotate: [0, d.r],
        x: [0, d.x],
        y: [0, d.y],
        rotateY: [-11, -11],
        rotateX: [4, 4],
        // Behind the doc: in 3D, depth decides what is in front, not the order in the page
        z: [-90 * (i + 1), -90 * (i + 1)],
        ease: spring({ bounce: 0.35, duration: 800 }),
      },
      fanned + i * 90,
    );
  });

  // 5. Turn to the images: the rest leaves, the doc comes to the middle
  const turn = fanned + 1500;
  maskOut(tl, '#cap-hook', turn);
  tl.add(
    '#prompt',
    {
      opacity: [1, 0],
      x: [0, -260],
      rotateY: [12, 50],
      filter: ['blur(0px)', 'blur(8px)'],
      duration: 500,
      ease: 'inQuad',
    },
    turn,
  );
  deck.forEach((d, i) => {
    tl.add(
      d.id,
      {
        opacity: [1, 0],
        rotate: [d.r, 0],
        x: [d.x, 0],
        y: [d.y, 0],
        z: [-90 * (i + 1), -90 * (i + 1)],
        duration: 450,
        ease: 'inQuad',
      },
      turn,
    );
  });
  tl.add(
    '#doc',
    {
      x: [0, -410],
      rotateY: [-11, 0],
      rotateX: [4, 0],
      scale: [1, 0.94],
      duration: 1000,
      ease: 'inOutCubic',
    },
    turn + 150,
  );
  maskIn(tl, '#cap-problem', turn + 600, 100);
  tl.add(
    '#doc .ph',
    {
      height: [0, 118],
      marginBottom: [0, 14],
      duration: 700,
      ease: 'inOutCubic',
      delay: stagger(220),
    },
    turn + 700,
  );
  tl.add(
    '#doc .ph-box',
    {
      opacity: [0, 1],
      scale: [0.7, 1],
      ease: spring({ bounce: 0.45, duration: 600 }),
      delay: stagger(220),
    },
    turn + 1000,
  );
  // Marching ants around the empty slots
  tl.add(
    '#doc .ants rect',
    { strokeDashoffset: [0, -360], duration: 6000, ease: 'linear' },
    turn + 1000,
  );

  // 6. The routine: chores fly in around the doc and a loop runs through them
  const chores0 = turn + 1500;
  tl.set('#loop', { opacity: 1 }, chores0);
  tl.add(
    createDrawable('#loop path'),
    { draw: ['0 0', '0 1'], duration: 1400, ease: 'inOutCubic' },
    chores0,
  );
  chores.forEach((c, i) => {
    const el = `#intro .chore[data-i="${i}"]`;
    const from = c.x < 960 ? -560 : 560;
    const at = chores0 + 200 + i * 360;
    tl.add(
      el,
      {
        opacity: [0, 1],
        x: [from, 0],
        rotate: [from < 0 ? -28 : 28, c.r],
        scale: [0.8, 1],
        ease: spring({ bounce: 0.3, duration: 900 }),
      },
      at,
    );
    tl.add(
      `${el} .chore-tick`,
      {
        opacity: [0, 1],
        scale: [0.2, 1],
        rotate: [-40, 0],
        ease: spring({ bounce: 0.5, duration: 500 }),
      },
      at + 450,
    );
  });
  // Idle breathing while the loop runs
  tl.add(
    '#intro .chore',
    { y: [0, -7, 0, 5, 0], duration: 3200, ease: 'inOutSine', delay: stagger(140) },
    chores0 + 2600,
  );
  tl.add('#loop-dot', { opacity: [0, 1], scale: [0, 1], duration: 300 }, chores0 + 900);
  for (const lap of [0, 1]) {
    tl.add(
      '#loop-dot',
      { ...createMotionPath('#loop path'), duration: 1900, ease: 'inOutSine' },
      chores0 + 900 + lap * 1900,
    );
  }
  tl.add('#chore-note', { opacity: [0, 1], duration: 1 }, chores0 + 2700);
  tl.add(
    '#chore-note .w',
    { opacity: [0, 1], y: [20, 0], duration: 600, delay: stagger(50) },
    chores0 + 2700,
  );
  tl.add(
    '#doc .ph-box',
    { rotate: [0, -5, 5, -3, 0], duration: 600, ease: 'inOutSine', delay: stagger(120) },
    chores0 + 3300,
  );

  // 7. Everything collapses into the middle; the name bursts out of it next
  const collapse = chores0 + 4500;
  maskOut(tl, '#cap-problem', collapse);
  tl.add('#chore-note', { opacity: [1, 0], duration: 250, ease: 'inQuad' }, collapse);
  tl.add(
    '#intro-world',
    {
      scale: [1, 0.04],
      rotate: [0, 14],
      filter: ['blur(0px)', 'blur(10px)'],
      opacity: [1, 0],
      duration: 750,
      ease: 'inBack(1.3)',
    },
    collapse + 100,
  );
  tl.add(
    '#flash',
    { opacity: [0, 1, 0], scale: [0.1, 3.2], duration: 700, ease: 'outCubic' },
    collapse + 700,
  );
  const end = collapse + 1000;
  tl.set('#intro', { opacity: 0 }, end);
  return end;
}

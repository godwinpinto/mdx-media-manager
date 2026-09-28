import { scrambleText, spring, stagger } from 'animejs';
import { cursor, pop, type, wordsIn, wordsOut, type TL } from '../anim';
import { Browser, Chars, Icon, Keycap, Odometer, Para, Shot, Skel, Words } from '../ui/parts';

/**
 * Measured, not made up: a 1440×900 PNG screenshot of the docs home page (82,509 bytes), cropped
 * to 1316×817 and encoded as WebP at quality 71 with sharp (30,106 bytes).
 */
const sizes = { before: '81 KB', after: '29 KB' };
const hash = '9f3c2a1b';
const alt = 'The docs home page';
const imageUrl = `/images/docs/index/docs-home-${hash}.webp`;

const library = [
  { name: 'docs-home', page: 'index', accent: '#4f46e5', badges: [] },
  { name: 'init-output', page: 'installation', accent: '#0891b2', badges: [] },
  { name: 'bucket-settings', page: 's3', accent: '#d97706', badges: ['no alt'] },
  { name: 'old-diagram', page: '—', accent: '#db2777', badges: ['unused'] },
  { name: 'library-panel', page: 'library', accent: '#059669', badges: [] },
  { name: 'hero-draft', page: '—', accent: '#7c3aed', badges: ['unused'] },
];

export function App() {
  return (
    <section className="scene" id="app">
      <Words id="cap-hover" text="Hover any block to *add an image*" />
      <Words id="cap-paste" text="Paste a screenshot" />
      <Words id="cap-edit" text="Crop, compress and rename, *without leaving your site*" />
      <Words id="cap-saved" text="Saved to *public/* and written into your *MDX*" />
      <Words id="cap-replace" text="*Replace* it…" />
      <Words id="cap-delete" text="…or *delete* it, right on the page" />
      <Words id="cap-library" text="Find *unused* images and *missing alt* text" />

      <Browser id="browser" url="localhost:3000/docs">
        <div className="page">
          <aside className="sidebar">
            <div className="side-logo">
              <span className="logo-dot" />
              <Skel w={120} h={14} />
            </div>
            <Skel w="100%" h={34} className="side-search" />
            {[62, 78, 54, 70, 48, 66, 58, 74, 50].map((w, i) => (
              <Skel key={i} w={`${w}%`} h={12} className={`side-item ${i === 0 ? 'on' : ''}`} />
            ))}
          </aside>
          <main className="content">
            <h1 className="page-h1">Introduction</h1>
            <Skel w="74%" h={16} className="page-desc" />
            <div id="p1" className="block">
              <Para lines={[100, 97, 99, 58]} />
            </div>
            <div id="slot">
              <div id="slot-img">
                <Shot id="img-a" />
                <Shot id="img-b" tone="dark" />
              </div>
            </div>
            <div id="p2" className="block">
              <Para lines={[100, 64]} />
            </div>
            <h2 className="page-h2">What you get</h2>
            <Para lines={[90, 76, 84]} className="bullets" />
          </main>
          <aside className="toc">
            <Skel w={90} h={11} />
            {[80, 64, 72, 56].map((w, i) => (
              <Skel key={i} w={`${w}%`} h={10} />
            ))}
          </aside>
        </div>

        {/* The overlay */}
        <div id="outline" />
        <div id="insert-pill">+ Image below</div>
        <div id="toolbar">
          <span className="tb-btn">Edit</span>
          <span className="tb-btn" id="tb-delete">
            <span className="tb-a">Delete</span>
            <span className="tb-b">Confirm delete</span>
          </span>
        </div>
        <div id="dock">
          <span className="dock-btn" id="dock-library">
            Library
          </span>
          <span className="dock-btn on">
            <span className="dot" />
            Images on
          </span>
        </div>
        <div id="toast" className="toast">
          {Icon.check} <span className="toast-a">Image inserted</span>
          <span className="toast-b">Image removed</span>
        </div>

        <div id="backdrop" />
        <div id="dialog" className="card">
          <header className="dlg-head">
            <b>Insert image</b>
            <span className="x">×</span>
          </header>
          <div className="crop-area">
            <div className="drop-hint">
              {Icon.image}
              <span>Drop, paste (⌘V) or choose an image</span>
            </div>
            <div id="dlg-shot-wrap">
              <Shot id="dlg-shot" />
              <div id="crop-box">
                <i className="h nw" />
                <i className="h ne" />
                <i className="h sw" />
                <i className="h se" />
              </div>
            </div>
          </div>
          <div className="dlg-row">
            <span className="lbl">Ratio</span>
            <span className="seg">
              <span className="on">Free</span>
              <span>Original</span>
              <span>16:9</span>
              <span>4:3</span>
              <span>1:1</span>
            </span>
            <span className="lbl">Crop</span>
            <span className="num-box">
              <Odometer id="odo-w" value="1440" />
            </span>
            <span className="times">×</span>
            <span className="num-box">
              <Odometer id="odo-h" value="0900" className="lead0" />
            </span>
          </div>
          <div className="dlg-row">
            <span className="lbl">Output</span>
            <span className="select">WebP ▾</span>
            <span className="lbl">Quality</span>
            <span id="slider">
              <span id="slider-fill" />
              <span id="slider-thumb" />
            </span>
            <Odometer id="odo-q" value="82" className="q" />
            <span id="size-chip">
              PNG {sizes.before} <span className="arrow-r">→</span> <b>WebP {sizes.after}</b>
            </span>
          </div>
          <label className="dlg-field">
            <span className="lbl">File name</span>
            <span className="input" id="name-input">
              <Chars text="docs-home" className="typed" />
              <span className="suffix">
                -<span id="hash">‹hash›</span>.webp
              </span>
            </span>
          </label>
          <label className="dlg-field">
            <span className="lbl">
              Alt text <em>(required)</em>
            </span>
            <span className="input" id="alt-input">
              <Chars text={alt} className="typed" />
            </span>
          </label>
          <footer className="dlg-foot">
            <span className="btn">Cancel</span>
            <span className="btn primary" id="insert-btn">
              Insert
            </span>
          </footer>
        </div>

        <div id="library" className="card">
          <header className="lib-head">
            <b>Image library</b>
            <span className="lib-tabs">
              <span id="tab-pill" />
              <span className="tab" id="tab-all">
                All <i>6</i>
              </span>
              <span className="tab" id="tab-unused">
                Unused <i className="warn">2</i>
              </span>
              <span className="tab" id="tab-alt">
                Missing alt <i className="warn">1</i>
              </span>
            </span>
          </header>
          <div className="lib-grid">
            {library.map((img) => (
              <div
                className={`lib-card ${img.badges.includes('unused') ? 'is-unused' : ''} ${img.badges.includes('no alt') ? 'is-noalt' : ''}`}
                key={img.name}
              >
                <Shot accent={img.accent} tone={img.name === 'hero-draft' ? 'dark' : 'light'} />
                <span className="lib-name">{img.name}.webp</span>
                <span className="lib-meta">
                  {img.page === '—'
                    ? 'Not used on any page'
                    : `Used on /docs/${img.page === 'index' ? '' : img.page}`}
                </span>
                <span className="lib-badges">
                  {img.badges.map((b) => (
                    <span className="badge" key={b}>
                      {b}
                    </span>
                  ))}
                </span>
              </div>
            ))}
          </div>
        </div>
      </Browser>

      {/* The source, beside the page */}
      <div id="code" className="card">
        <div className="doc-tab">
          {Icon.file}
          <b>index.mdx</b>
          <span>content/docs</span>
        </div>
        <div className="code-body mono">
          {[
            ['1', '---'],
            ['2', 'title: Introduction'],
            ['3', 'description: Add, edit and delete images…'],
            ['4', '---'],
            ['5', ''],
            ['6', 'MDX Media Manager adds an editing overlay to'],
            ['7', 'your documentation site in development…'],
            ['8', ''],
          ].map(([n, text]) => (
            <div className="cl" key={n}>
              <span className="ln">{n}</span>
              <span>{text}</span>
            </div>
          ))}
          <div className="cl added" id="added-line">
            <span className="ln">9</span>
            <span className="plus">+</span>
            <Chars text={`![${alt}](${imageUrl})`} />
          </div>
          {[
            ['10', ''],
            ['11', 'It is built for [Fumadocs](https://fumadocs.dev)…'],
          ].map(([n, text]) => (
            <div className="cl" key={n}>
              <span className="ln">{n}</span>
              <span>{text}</span>
            </div>
          ))}
        </div>
      </div>
      <div id="tree" className="card">
        {['public', 'images', 'docs', 'index'].map((dir, i) => (
          <div className="tree-row" key={dir} style={{ paddingLeft: 22 + i * 26 }}>
            {Icon.folder} {dir}/
          </div>
        ))}
        <div className="tree-row new" style={{ paddingLeft: 22 + 4 * 26 }}>
          {Icon.image} docs-home-{hash}.webp <span className="new-badge">new</span>
        </div>
      </div>

      <Keycap id="keys-paste" keys={['⌘', 'V']} />
      <Keycap id="keys-paste2" keys={['⌘', 'V']} />
    </section>
  );
}

// ---------------------------------------------------------------------------------------------

const BROWSER = { x: 210, y: 190, chrome: 52 };

/** Position of an element inside the browser viewport (ignores transforms) */
function rel(el: HTMLElement) {
  const root = document.querySelector('#browser .viewport')!;
  let x = 0;
  let y = 0;
  for (
    let node: HTMLElement | null = el;
    node && node !== root;
    node = node.offsetParent as HTMLElement | null
  ) {
    x += node.offsetLeft;
    y += node.offsetTop;
  }
  return { x, y, w: el.offsetWidth, h: el.offsetHeight };
}

/** Stage coordinates of a point in an element, while the browser sits at rest */
function at(selector: string, fx = 0.5, fy = 0.5, dy = 0) {
  const r = rel(document.querySelector<HTMLElement>(selector)!);
  return { x: BROWSER.x + r.x + r.w * fx, y: BROWSER.y + BROWSER.chrome + r.y + r.h * fy + dy };
}

const $ = (s: string) => document.querySelector<HTMLElement>(s)!;

/** Rolls an odometer from one number to another (same digit count) */
function roll(tl: TL, id: string, from: string, to: string, t: number, duration = 900) {
  [...to].forEach((d, i) => {
    tl.add(
      `#${id} .odo-strip[data-i="${i}"]`,
      { y: [`${-Number(from[i])}em`, `${-Number(d)}em`], duration, ease: 'inOutCubic' },
      t + i * 40,
    );
  });
}

/** Shows a value on an odometer without animating */
function show(tl: TL, id: string, value: string, t: number) {
  [...value].forEach((d, i) =>
    tl.set(`#${id} .odo-strip[data-i="${i}"]`, { y: `${-Number(d)}em` }, t),
  );
}

function caption(tl: TL, id: string, t: number, prev?: string) {
  if (prev) wordsOut(tl, prev, t - 250);
  wordsIn(tl, id, t);
}

/** Lays out the overlay pieces around the page blocks (static, before animating) */
function layout() {
  const p1 = rel($('#p1'));
  const pad = 12;
  Object.assign($('#outline').style, {
    left: `${p1.x - pad}px`,
    top: `${p1.y - pad}px`,
    width: `${p1.w + pad * 2}px`,
    height: `${p1.h + pad * 2}px`,
  });
  Object.assign($('#insert-pill').style, {
    left: `${p1.x + p1.w / 2}px`,
    top: `${p1.y + p1.h + pad}px`,
  });
  const slot = rel($('#slot'));
  Object.assign($('#toolbar').style, { left: `${slot.x + 640 - 14}px`, top: `${slot.y + 14}px` });
  $('#tab-pill').style.width = `${$('#tab-all').offsetWidth}px`;
  // Dialog grows out of the pill
  const dialog = rel($('#dialog'));
  $('#dialog').style.transformOrigin =
    `${p1.x + p1.w / 2 - dialog.x}px ${p1.y + p1.h + pad - dialog.y}px`;
}

/** ~31s: the product itself */
export function buildApp(tl: TL, t0: number) {
  layout();
  let t = t0;
  const c = cursor(tl, { x: 1500, y: 1000 });
  const IMG_H = 397;
  tl.set('#app', { opacity: 1 }, t);
  show(tl, 'odo-w', '1440', 0);
  show(tl, 'odo-h', '0900', 0);
  show(tl, 'odo-q', '82', 0);

  // Browser rises in with the page drawing itself
  tl.add(
    '#browser',
    {
      opacity: [0, 1],
      y: [160, 0],
      scale: [0.92, 1],
      rotateX: [14, 0],
      duration: 1100,
      ease: 'outExpo',
    },
    t,
  );
  tl.add(
    '#browser .skel',
    { scaleX: [0, 1], duration: 600, delay: stagger(18), ease: 'outExpo' },
    t + 300,
  );
  tl.add(
    '#browser h1, #browser h2',
    { opacity: [0, 1], x: [-16, 0], duration: 600, delay: stagger(120) },
    t + 400,
  );
  pop(tl, '#dock .dock-btn', t + 900, { each: 90 });
  caption(tl, '#cap-hover', t + 350);
  t += 1300;

  // Hover a paragraph: the outline and the insert button appear
  c.show(t);
  t = c.move(at('#p1', 0.62, 0.8), t, 900);
  tl.add(
    '#outline',
    { opacity: [0, 1], scale: [1.02, 1], duration: 350, ease: 'outCubic' },
    t - 150,
  );
  tl.add(
    '#insert-pill',
    {
      opacity: [0, 1],
      scaleX: [0.2, 1],
      scaleY: [0.6, 1],
      ease: spring({ bounce: 0.4, duration: 500 }),
    },
    t,
  );
  t += 650;
  const pill = { x: at('#p1').x, y: at('#p1', 0.5, 1, 12).y };
  t = c.move(pill, t, 450);
  t = c.click(t + 60);

  // The dialog grows out of the button
  tl.add('#backdrop', { opacity: [0, 1], duration: 400, ease: 'outCubic' }, t);
  tl.add('#outline, #insert-pill', { opacity: [1, 0], duration: 200, ease: 'inQuad' }, t);
  tl.add('#dialog', { opacity: [0, 1], scale: [0.15, 1], duration: 750, ease: 'outExpo' }, t);
  tl.add(
    '#dialog > *',
    { opacity: [0, 1], y: [14, 0], duration: 500, delay: stagger(45) },
    t + 200,
  );
  caption(tl, '#cap-paste', t + 150, '#cap-hover');
  t += 900;

  // ⌘V: the screenshot flies in and lands in the cropper
  t = c.move(at('#dialog', 0.72, 0.28), t, 500);
  tl.add(
    '#keys-paste',
    { opacity: [0, 1], y: [30, 0], scale: [0.8, 1], ease: spring({ bounce: 0.35, duration: 500 }) },
    t,
  );
  tl.add(
    '#keys-paste kbd',
    { y: [0, 6, 0], duration: 260, delay: stagger(90), ease: 'inOutQuad' },
    t + 350,
  );
  tl.add(
    '#dialog .drop-hint',
    { opacity: [1, 0], scale: [1, 0.9], duration: 250, ease: 'inQuad' },
    t + 500,
  );
  tl.add(
    '#dlg-shot-wrap',
    {
      opacity: [0, 1],
      x: [620, 0],
      y: [-260, 0],
      rotate: [14, 0],
      scale: [0.55, 1],
      ease: spring({ bounce: 0.25, duration: 900 }),
    },
    t + 520,
  );
  tl.add('#crop-box', { opacity: [0, 1], duration: 300 }, t + 1250);
  pop(tl, '#crop-box .h', t + 1300, { each: 50 });
  tl.add('#keys-paste', { opacity: [1, 0], y: [0, 20], duration: 250, ease: 'inQuad' }, t + 1300);
  t += 1700;

  // Crop
  caption(tl, '#cap-edit', t, '#cap-paste');
  t += 500;
  const se = at('#crop-box', 1, 1);
  t = c.move({ x: se.x - 4, y: se.y - 4 }, t, 550);
  tl.add(
    '#crop-box',
    { right: ['0%', '8.6%'], bottom: ['0%', '9.2%'], duration: 900, ease: 'inOutCubic' },
    t + 80,
  );
  c.move({ x: se.x - 4 - 38, y: se.y - 4 - 25 }, t + 80, 900);
  roll(tl, 'odo-w', '1440', '1316', t + 80);
  roll(tl, 'odo-h', '0900', '0817', t + 80);
  t += 1150;

  // Compress
  const thumb = at('#slider-thumb');
  const track = rel($('#slider'));
  t = c.move(thumb, t, 550);
  tl.add('#slider-thumb', { x: [0, -track.w * 0.183], duration: 800, ease: 'inOutCubic' }, t + 60);
  tl.add('#slider-fill', { width: ['70%', '51.7%'], duration: 800, ease: 'inOutCubic' }, t + 60);
  c.move({ x: thumb.x - track.w * 0.183, y: thumb.y }, t + 60, 800);
  roll(tl, 'odo-q', '82', '71', t + 60, 800);
  tl.add(
    '#size-chip',
    {
      opacity: [0, 1],
      x: [-14, 0],
      scale: [0.9, 1],
      ease: spring({ bounce: 0.35, duration: 550 }),
    },
    t + 700,
  );
  t += 1250;

  // Rename
  t = c.move(at('#name-input', 0.18, 0.5), t, 550);
  t = c.click(t);
  tl.add('#name-input', { borderColor: ['#e4e4e7', '#4f46e5'], duration: 200 }, t);
  type(tl, '#name-input', t + 100, 55);
  t += 100 + 9 * 55 + 150;
  tl.add(
    '#hash',
    {
      innerHTML: scrambleText({ text: hash, chars: '0-9a-f', seed: 7, from: 'left' }),
      duration: 700,
    },
    t,
  );
  tl.add('#name-input .suffix', { color: ['#a1a1aa', '#18181b'], duration: 500 }, t + 300);
  t += 800;

  // Alt text
  t = c.move(at('#alt-input', 0.2, 0.5), t, 450);
  t = c.click(t);
  tl.add('#name-input', { borderColor: ['#4f46e5', '#e4e4e7'], duration: 200 }, t);
  tl.add('#alt-input', { borderColor: ['#e4e4e7', '#4f46e5'], duration: 200 }, t);
  type(tl, '#alt-input', t + 100, 40);
  t += 100 + alt.length * 40 + 250;

  // Insert: the dialog folds into the page
  t = c.move(at('#insert-btn'), t, 550);
  t = c.click(t);
  tl.add('#insert-btn', { scale: [1, 0.94, 1], duration: 260, ease: 'inOutQuad' }, t - 260);
  tl.add(
    '#dialog',
    { opacity: [1, 0], scale: [1, 0.7], y: [0, 60], duration: 450, ease: 'inQuad' },
    t + 60,
  );
  tl.add('#backdrop', { opacity: [1, 0], duration: 450, ease: 'inQuad' }, t + 150);
  tl.add('#slot', { height: [0, IMG_H + 44], duration: 800, ease: 'inOutCubic' }, t + 300);
  tl.add(
    '#slot-img',
    { opacity: [0, 1], scale: [0.9, 1], y: [30, 0], duration: 800, ease: 'outExpo' },
    t + 500,
  );
  tl.add('#toast', { opacity: [0, 1], y: [20, 0], duration: 500 }, t + 600);
  c.move({ x: 1500, y: 780 }, t + 300, 700);
  caption(tl, '#cap-saved', t + 500, '#cap-edit');
  t += 1500;

  // Beside it, the MDX file and the image file
  tl.add('#toast', { opacity: [1, 0], duration: 250, ease: 'inQuad' }, t);
  c.hide(t);
  tl.add(
    '#browser',
    { scale: [1, 0.58], x: [0, -130], y: [0, 40], duration: 1000, ease: 'inOutCubic' },
    t,
  );
  tl.add('#code', { opacity: [0, 1], x: [220, 0], duration: 900, ease: 'outExpo' }, t + 350);
  tl.add(
    '#code .cl:not(.added)',
    { opacity: [0, 1], x: [-10, 0], duration: 400, delay: stagger(35) },
    t + 600,
  );
  tl.add(
    '#added-line',
    {
      height: [0, 48],
      opacity: [0, 1],
      backgroundColor: ['#ffffff', '#ecfdf5'],
      duration: 600,
      ease: 'inOutCubic',
    },
    t + 1100,
  );
  type(tl, '#added-line', t + 1500, 14);
  const lineChars = `![${alt}](${imageUrl})`.length;
  tl.add('#tree', { opacity: [0, 1], y: [40, 0], duration: 800 }, t + 1500);
  tl.add(
    '#tree .tree-row',
    { opacity: [0, 1], x: [-14, 0], duration: 400, delay: stagger(110) },
    t + 1700,
  );
  pop(tl, '#tree .new-badge', t + 2400);
  t += Math.max(1500 + lineChars * 14, 2400) + 1500;

  tl.add(
    '#code, #tree',
    { opacity: [1, 0], x: [0, 160], duration: 450, ease: 'inQuad', delay: stagger(60) },
    t,
  );
  tl.add(
    '#browser',
    { scale: [0.58, 1], x: [-130, 0], y: [40, 0], duration: 900, ease: 'inOutCubic' },
    t + 150,
  );
  caption(tl, '#cap-replace', t + 500, '#cap-saved');
  t += 1100;

  // Replace
  const img = at('#slot-img', 0.55, 0.45, 0);
  c.place({ x: img.x + 260, y: img.y + 240 }, t - 10);
  c.show(t);
  t = c.move(img, t, 600);
  pop(tl, '#toolbar', t - 100);
  const edit = at('#toolbar .tb-btn', 0.5, 0.5);
  t = c.move(edit, t + 200, 450);
  t = c.click(t);
  tl.add(
    '#keys-paste2',
    { opacity: [0, 1], y: [30, 0], scale: [0.8, 1], ease: spring({ bounce: 0.35, duration: 500 }) },
    t + 100,
  );
  tl.add(
    '#keys-paste2 kbd',
    { y: [0, 6, 0], duration: 260, delay: stagger(90), ease: 'inOutQuad' },
    t + 400,
  );
  tl.add(
    '#img-b',
    { clipPath: ['inset(0% 100% 0% 0%)', 'inset(0% 0% 0% 0%)'], duration: 900, ease: 'inOutCubic' },
    t + 700,
  );
  tl.add('#keys-paste2', { opacity: [1, 0], y: [0, 20], duration: 250, ease: 'inQuad' }, t + 1400);
  t += 1900;

  // Delete
  caption(tl, '#cap-delete', t, '#cap-replace');
  const del = at('#tb-delete', 0.5, 0.5);
  t = c.move(del, t + 150, 400);
  t = c.click(t);
  tl.add(
    '#tb-delete',
    { backgroundColor: ['#ffffff', '#dc2626'], color: ['#18181b', '#ffffff'], duration: 250 },
    t,
  );
  tl.add('#tb-delete .tb-a', { opacity: [1, 0], y: [0, -10], duration: 200 }, t);
  tl.add('#tb-delete .tb-b', { opacity: [0, 1], y: [10, 0], duration: 250 }, t + 80);
  t += 600;
  t = c.click(t);
  tl.add('#toolbar', { opacity: [1, 0], scale: [1, 0.8], duration: 200, ease: 'inQuad' }, t);
  tl.add(
    '#slot-img',
    {
      opacity: [1, 0],
      scale: [1, 0.85],
      filter: ['blur(0px)', 'blur(6px)'],
      duration: 450,
      ease: 'inQuad',
    },
    t + 50,
  );
  tl.add('#slot', { height: [IMG_H + 44, 0], duration: 700, ease: 'inOutCubic' }, t + 350);
  tl.add('#toast .toast-a', { opacity: [1, 0], duration: 1 }, t + 300);
  tl.add('#toast .toast-b', { opacity: [0, 1], duration: 1 }, t + 300);
  tl.add('#toast', { opacity: [0, 1], y: [20, 0], duration: 500 }, t + 350);
  t += 1500;

  // Library
  tl.add('#toast', { opacity: [1, 0], duration: 250, ease: 'inQuad' }, t);
  caption(tl, '#cap-library', t + 100, '#cap-delete');
  t = c.move(at('#dock-library'), t, 700);
  t = c.click(t);
  tl.add('#backdrop', { opacity: [0, 1], duration: 400 }, t);
  tl.add('#library', { opacity: [0, 1], scale: [0.2, 1], duration: 800, ease: 'outExpo' }, t);
  tl.add(
    '#library .lib-card',
    {
      opacity: [0, 1],
      scale: [0.85, 1],
      y: [24, 0],
      duration: 600,
      delay: stagger(70, { grid: [3, 2], from: 'center' }),
    },
    t + 250,
  );
  pop(tl, '#library .badge', t + 800, { each: 120 });
  t += 1300;
  const unused = at('#tab-unused');
  const all = rel($('#tab-all'));
  const u = rel($('#tab-unused'));
  const a = rel($('#tab-alt'));
  t = c.move(unused, t, 600);
  t = c.click(t);
  tl.add(
    '#tab-pill',
    { x: [0, u.x - all.x], width: [all.w, u.w], duration: 450, ease: 'inOutCubic' },
    t,
  );
  tl.add(
    '#library .lib-card:not(.is-unused)',
    { opacity: [1, 0.22], scale: [1, 0.96], duration: 400 },
    t + 100,
  );
  tl.add(
    '#library .lib-card.is-unused',
    { borderColor: ['#e4e4e7', '#f59e0b'], duration: 300 },
    t + 150,
  );
  t += 1300;
  t = c.move(at('#tab-alt'), t, 500);
  t = c.click(t);
  tl.add(
    '#tab-pill',
    { x: [u.x - all.x, a.x - all.x], width: [u.w, a.w], duration: 450, ease: 'inOutCubic' },
    t,
  );
  tl.add(
    '#library .lib-card.is-unused',
    { opacity: [1, 0.22], scale: [1, 0.96], borderColor: ['#f59e0b', '#e4e4e7'], duration: 400 },
    t + 100,
  );
  tl.add(
    '#library .lib-card.is-noalt',
    { opacity: [0.22, 1], scale: [0.96, 1], borderColor: ['#e4e4e7', '#f59e0b'], duration: 400 },
    t + 100,
  );
  t += 1500;

  // Out
  c.hide(t);
  wordsOut(tl, '#cap-library', t);
  tl.add(
    '#browser',
    { opacity: [1, 0], scale: [1, 0.9], y: [0, 40], duration: 500, ease: 'inQuad' },
    t + 100,
  );
  t += 650;
  tl.set('#app', { opacity: 0 }, t);
  return t;
}

import '@fontsource-variable/inter';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/600.css';
import './styles.css';
import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { film, type TL } from './anim';
import { App, buildApp } from './scenes/app';
import { buildDev, buildOutro, buildStorage, Dev, Outro, Storage } from './scenes/finale';
import { buildIntro, Intro } from './scenes/intro';
import { buildReveal, Reveal } from './scenes/reveal';
import { HEIGHT, SPEED, WIDTH } from './theme';
import { Cursor } from './ui/parts';

declare global {
  interface Window {
    /** Driven by scripts/render.ts */
    __film?: { duration: number; seek(ms: number): Promise<void> };
  }
}

const params = new URLSearchParams(location.search);
const rendering = params.has('render');
/** `?speed=1.5` overrides the theme's playback speed (the renderer's `--speed`) */
const speed = Number(params.get('speed')) || SPEED;

/** Scenes in order; each returns when it ends, and the next starts there */
function build(): { tl: TL; marks: { name: string; at: number }[] } {
  const tl = film();
  const marks: { name: string; at: number }[] = [];
  let t = 0;
  for (const [name, scene] of [
    ['Intro', buildIntro],
    ['Name', buildReveal],
    ['Product', buildApp],
    ['Storage', buildStorage],
    ['Dev only', buildDev],
    ['Outro', buildOutro],
  ] as const) {
    marks.push({ name, at: t });
    t = scene(tl, t);
  }
  return { tl, marks };
}

function Stage() {
  return (
    <div id="stage" style={{ width: WIDTH, height: HEIGHT }}>
      <Intro />
      <Reveal />
      <App />
      <Storage />
      <Dev />
      <Outro />
      <Cursor />
    </div>
  );
}

function Film() {
  const [state, setState] = useState<{ tl: TL; marks: { name: string; at: number }[] }>();
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [scale, setScale] = useState(1);
  const clock = useRef<{ start: number; from: number }>(undefined);

  useEffect(() => {
    let cancelled = false;
    document.fonts.ready.then(() => {
      if (cancelled) return;
      const built = build();
      built.tl.seek(0);
      setState(built);
      window.__film = {
        duration: built.tl.duration / speed,
        seek: (ms) =>
          new Promise((resolve) => {
            built.tl.seek(ms * speed);
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
          }),
      };
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Preview: play in real time, scrub with the slider
  useEffect(() => {
    if (!state || !playing) return;
    let raf = 0;
    clock.current = { start: performance.now(), from: time >= state.tl.duration ? 0 : time };
    const tick = () => {
      const t = Math.min(
        state.tl.duration,
        clock.current!.from + (performance.now() - clock.current!.start) * speed,
      );
      state.tl.seek(t);
      setTime(t);
      if (t >= state.tl.duration) setPlaying(false);
      else raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, playing]);

  useEffect(() => {
    if (rendering) return;
    const fit = () => setScale(Math.min((innerWidth - 48) / WIDTH, (innerHeight - 120) / HEIGHT));
    fit();
    addEventListener('resize', fit);
    return () => removeEventListener('resize', fit);
  }, []);

  if (rendering) return <Stage />;

  const seek = (t: number) => {
    setPlaying(false);
    setTime(t);
    state?.tl.seek(t);
  };

  return (
    <div className="preview">
      <div className="frame" style={{ width: WIDTH * scale, height: HEIGHT * scale }}>
        <div style={{ transform: `scale(${scale})`, transformOrigin: '0 0' }}>
          <Stage />
        </div>
      </div>
      <div className="controls">
        <button onClick={() => setPlaying((p) => !p)} disabled={!state}>
          {playing ? 'Pause' : 'Play'}
        </button>
        <input
          type="range"
          min={0}
          max={state?.tl.duration ?? 1}
          step={1000 / 60}
          value={time}
          onChange={(e) => seek(e.currentTarget.valueAsNumber)}
        />
        <span className="time">
          {(time / speed / 1000).toFixed(2)}s / {((state?.tl.duration ?? 0) / speed / 1000).toFixed(1)}s
        </span>
        {state?.marks.map((m) => (
          <button key={m.name} onClick={() => seek(m.at)}>
            {m.name}
          </button>
        ))}
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<Film />);

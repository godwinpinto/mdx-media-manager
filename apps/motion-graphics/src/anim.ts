import { createTimeline, spring, stagger, type Timeline } from 'animejs';
import { dur, ease } from './theme';

export type TL = Timeline;

export const film = () =>
  createTimeline({ autoplay: false, defaults: { ease: ease.enter, duration: dur.enter } });

/** Every animated value is written as [from, to], so scrubbing backwards is exact. */

/** Fade + rise + slight scale, optionally staggered */
export function enter(
  tl: TL,
  targets: string,
  at: number,
  o: { y?: number; scale?: number; each?: number; duration?: number } = {},
) {
  tl.add(
    targets,
    {
      opacity: [0, 1],
      y: [o.y ?? 28, 0],
      scale: [o.scale ?? 0.97, 1],
      duration: o.duration ?? dur.enter,
      delay: o.each ? stagger(o.each) : 0,
    },
    at,
  );
}

export function exit(tl: TL, targets: string, at: number, o: { y?: number; each?: number } = {}) {
  tl.add(
    targets,
    {
      opacity: [1, 0],
      y: [0, o.y ?? -18],
      duration: dur.exit,
      ease: ease.exit,
      delay: o.each ? stagger(o.each) : 0,
    },
    at,
  );
}

/** Springy scale-in for chips, buttons and badges */
export function pop(tl: TL, targets: string, at: number, o: { each?: number; from?: number } = {}) {
  tl.add(
    targets,
    {
      opacity: [0, 1],
      scale: [o.from ?? 0.6, 1],
      ease: spring({ bounce: 0.35, duration: dur.pop }),
      delay: o.each ? stagger(o.each) : 0,
    },
    at,
  );
}

/** Reveal pre-split characters (`.ch` spans) one by one, like typing */
export function type(tl: TL, container: string, at: number, perChar = dur.char) {
  tl.add(
    `${container} .ch`,
    { opacity: [0, 1], duration: 1, ease: 'linear', delay: stagger(perChar) },
    at,
  );
}

/** Words of a kinetic caption rise in, blurred to sharp */
export function wordsIn(tl: TL, container: string, at: number) {
  tl.add(container, { opacity: [0, 1], duration: 1 }, at);
  tl.add(
    `${container} .w`,
    {
      opacity: [0, 1],
      y: [36, 0],
      filter: ['blur(10px)', 'blur(0px)'],
      duration: 800,
      delay: stagger(55),
    },
    at,
  );
}

export function wordsOut(tl: TL, container: string, at: number) {
  tl.add(
    `${container} .w`,
    {
      opacity: [1, 0],
      y: [0, -24],
      filter: ['blur(0px)', 'blur(6px)'],
      duration: 300,
      ease: ease.exit,
      delay: stagger(20),
    },
    at,
  );
  tl.add(container, { opacity: [1, 0], duration: 1 }, at + 400);
}

/** A cursor that remembers where it is, so each move starts from the right place */
export function cursor(tl: TL, start: { x: number; y: number }) {
  let pos = { ...start };
  tl.set('#cursor', { x: pos.x, y: pos.y }, 0);
  return {
    get pos() {
      return pos;
    },
    show(at: number) {
      tl.add('#cursor', { opacity: [0, 1], scale: [0.6, 1], duration: 300 }, at);
    },
    hide(at: number) {
      tl.add('#cursor', { opacity: [1, 0], duration: 250, ease: ease.exit }, at);
    },
    /** Jump without animating (while hidden) */
    place(to: { x: number; y: number }, at: number) {
      tl.set('#cursor', { x: to.x, y: to.y }, at);
      pos = { ...to };
    },
    move(to: { x: number; y: number }, at: number, duration = dur.move) {
      tl.add('#cursor', { x: [pos.x, to.x], y: [pos.y, to.y], duration, ease: ease.move }, at);
      pos = { ...to };
      return at + duration;
    },
    click(at: number) {
      tl.add('#cursor .arrow', { scale: [1, 0.82, 1], duration: 260, ease: 'inOutQuad' }, at);
      tl.set('#ripple', { x: pos.x, y: pos.y }, at);
      tl.add(
        '#ripple',
        { scale: [0.2, 1.6], opacity: [0.9, 0], duration: 600, ease: 'outCubic' },
        at,
      );
      return at + 260;
    },
  };
}

/** Words slide up from behind their masks (needs `<Words mask>`) */
export function maskIn(tl: TL, container: string, at: number, each = 90) {
  tl.add(container, { opacity: [0, 1], duration: 1 }, at);
  tl.add(`${container} .w`, { opacity: [0, 1], duration: 1, delay: stagger(each) }, at);
  tl.add(
    `${container} .w`,
    { y: ['115%', '0%'], rotate: [6, 0], duration: 900, ease: 'outExpo', delay: stagger(each) },
    at,
  );
}

export function maskOut(tl: TL, container: string, at: number) {
  tl.add(
    `${container} .w`,
    { y: ['0%', '-115%'], duration: 420, ease: 'inCubic', delay: stagger(35) },
    at,
  );
  tl.add(container, { opacity: [1, 0], duration: 1 }, at + 600);
}

/** One place for the film's colours, sizes and motion. Scenes never hard-code these. */

export const WIDTH = 1920;
export const HEIGHT = 1080;
export const FPS = 60;
/** Playback speed: the timeline is authored at 1×, the film plays it this much faster */
export const SPEED = 2;

export const color = {
  bg: '#f7f7f8',
  ink: '#18181b',
  muted: '#71717a',
  faint: '#a1a1aa',
  line: '#e4e4e7',
  skeleton: '#ececef',
  card: '#ffffff',
  accent: '#4f46e5',
  accentSoft: '#eef2ff',
  ok: '#059669',
  okSoft: '#ecfdf5',
  warn: '#b45309',
  warnSoft: '#fffbeb',
  danger: '#dc2626',
  dangerSoft: '#fef2f2',
};

/** Durations in ms. Exits are faster than entrances. */
export const dur = {
  enter: 700,
  exit: 320,
  pop: 550,
  move: 750,
  char: 32,
};

export const ease = {
  enter: 'outExpo',
  exit: 'inQuad',
  move: 'inOutCubic',
  soft: 'outCubic',
} as const;

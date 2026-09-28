/**
 * Sound, synthesized in code: a music bed plus effects cued from the same timeline as the
 * pictures. Everything is scheduled in film time (ms at 1×) and rendered offline, so the audio
 * lines up with every frame at any playback speed.
 */

export const BPM = 100;
/** One beat in film time (ms) */
export const BEAT = 60_000 / BPM;

type Kind = 'whoosh' | 'pop' | 'click' | 'tick' | 'impact' | 'riser' | 'thud' | 'shimmer' | 'swish';
interface Cue {
  t: number;
  kind: Kind;
  /** 0–1 */
  gain: number;
  /** Seconds (film time), for sweeps */
  length: number;
  /** -1 (left) to 1 (right) */
  pan: number;
}

let cues: Cue[] = [];
/** Film-time markers that shape the music */
const music = { kickFrom: 0, dropAt: 0, end: 0 };

export function resetAudio() {
  cues = [];
}

export function setMusic(m: Partial<typeof music>) {
  Object.assign(music, m);
}

const cue =
  (kind: Kind) =>
  (t: number, o: { gain?: number; length?: number; pan?: number } = {}) => {
    cues.push({ t, kind, gain: o.gain ?? 1, length: o.length ?? 0.5, pan: o.pan ?? 0 });
  };

export const sfx = {
  whoosh: cue('whoosh'),
  swish: cue('swish'),
  pop: cue('pop'),
  click: cue('click'),
  tick: cue('tick'),
  impact: cue('impact'),
  riser: cue('riser'),
  thud: cue('thud'),
  shimmer: cue('shimmer'),
};

// ---------------------------------------------------------------------------------------------

/** Seeded random, so noise is the same on every render */
function random(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function noiseBuffer(ctx: BaseAudioContext, seconds: number, seed: number) {
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * seconds), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  const rnd = random(seed);
  for (let i = 0; i < data.length; i++) data[i] = rnd() * 2 - 1;
  return buffer;
}

const chords = [
  // C, G/B, Am, F: bass root and pad voicing (Hz)
  { bass: 65.41, pad: [261.63, 329.63, 392.0] },
  { bass: 61.74, pad: [246.94, 293.66, 392.0] },
  { bass: 55.0, pad: [220.0, 261.63, 329.63] },
  { bass: 43.65, pad: [220.0, 261.63, 349.23] },
];

/** Renders the whole soundtrack. `speed` compresses film time like the pictures. */
export async function renderAudio(durationMs: number, speed: number): Promise<AudioBuffer> {
  const rate = 48_000;
  const seconds = durationMs / 1000 / speed + 0.5;
  const ctx = new OfflineAudioContext(2, Math.ceil(rate * seconds), rate);
  const at = (filmMs: number) => filmMs / 1000 / speed;
  const noise = noiseBuffer(ctx, 3, 7);

  const master = ctx.createGain();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.ratio.value = 4;
  comp.attack.value = 0.004;
  comp.release.value = 0.2;
  master.connect(comp).connect(ctx.destination);
  // Fade in and out
  master.gain.setValueAtTime(0, 0);
  master.gain.linearRampToValueAtTime(0.9, 0.3);
  master.gain.setValueAtTime(0.9, Math.max(0.3, seconds - 2));
  master.gain.linearRampToValueAtTime(0, seconds - 0.4);

  const musicBus = ctx.createGain();
  musicBus.gain.value = 0.55;
  musicBus.connect(master);
  const fxBus = ctx.createGain();
  fxBus.gain.value = 0.9;
  fxBus.connect(master);

  const out = (node: AudioNode, bus: AudioNode, pan = 0) => {
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    node.connect(p).connect(bus);
  };

  function noiseSource(start: number, length: number) {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    src.start(start, (start * 7.3) % 2);
    src.stop(start + length + 0.05);
    return src;
  }

  // --- Music ---------------------------------------------------------------------------------
  const end = music.end || durationMs;
  const beats = Math.floor(end / BEAT);
  for (let b = 0; b < beats; b++) {
    const t = at(b * BEAT);
    const film = b * BEAT;
    const bar = Math.floor(b / 4);
    const chord = chords[bar % chords.length]!;
    const drop = music.dropAt > 0 && film >= music.dropAt;

    // Pad: one chord per bar
    if (b % 4 === 0) {
      const barLen = at(4 * BEAT);
      for (const f of chord.pad) {
        for (const detune of [-8, 8]) {
          const o = ctx.createOscillator();
          o.type = 'sawtooth';
          o.frequency.value = f;
          o.detune.value = detune;
          const lp = ctx.createBiquadFilter();
          lp.type = 'lowpass';
          lp.frequency.value = drop ? 1400 : 900;
          const g = ctx.createGain();
          g.gain.setValueAtTime(0, t);
          g.gain.linearRampToValueAtTime(0.022, t + 0.25);
          g.gain.setValueAtTime(0.022, t + barLen - 0.25);
          g.gain.linearRampToValueAtTime(0, t + barLen + 0.1);
          o.connect(lp).connect(g);
          out(g, musicBus, detune < 0 ? -0.3 : 0.3);
          o.start(t);
          o.stop(t + barLen + 0.2);
        }
      }
    }

    // Kick on every beat, once it comes in
    if (music.kickFrom > 0 && film >= music.kickFrom) {
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(140, t);
      o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
      const g = ctx.createGain();
      g.gain.setValueAtTime(drop ? 0.9 : 0.6, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
      o.connect(g);
      out(g, musicBus);
      o.start(t);
      o.stop(t + 0.4);

      // Bass on the eighths
      for (const half of [0, 0.5]) {
        const bt = at((b + half) * BEAT);
        const bo = ctx.createOscillator();
        bo.type = 'triangle';
        bo.frequency.value = chord.bass * (half ? 2 : 1);
        const bg = ctx.createGain();
        bg.gain.setValueAtTime(0.0001, bt);
        bg.gain.exponentialRampToValueAtTime(drop ? 0.32 : 0.22, bt + 0.01);
        bg.gain.exponentialRampToValueAtTime(0.001, bt + at(BEAT * 0.45));
        bo.connect(bg);
        out(bg, musicBus);
        bo.start(bt);
        bo.stop(bt + at(BEAT * 0.5));
      }
    }

    // Hats on the off-beats, claps on 2 and 4 after the drop
    if (film >= (music.kickFrom || Infinity) - 4 * BEAT) {
      const ht = at((b + 0.5) * BEAT);
      const src = noiseSource(ht, 0.06);
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 7500;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.16, ht);
      g.gain.exponentialRampToValueAtTime(0.001, ht + 0.05);
      src.connect(hp).connect(g);
      out(g, musicBus, 0.25);
    }
    if (drop && b % 2 === 1) {
      const src = noiseSource(t, 0.18);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1800;
      bp.Q.value = 0.8;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.38, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      src.connect(bp).connect(g);
      out(g, musicBus, -0.1);
    }
  }

  // --- Effects -------------------------------------------------------------------------------
  for (const c of cues) {
    const t = at(c.t);
    const len = c.length / speed;
    switch (c.kind) {
      case 'whoosh':
      case 'swish': {
        // Filtered noise sweeping up then down, swelling in and out
        const src = noiseSource(t, len);
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.Q.value = c.kind === 'swish' ? 2.5 : 1.2;
        const lo = c.kind === 'swish' ? 1800 : 350;
        const hi = c.kind === 'swish' ? 7000 : 2600;
        bp.frequency.setValueAtTime(lo, t);
        bp.frequency.exponentialRampToValueAtTime(hi, t + len * 0.6);
        bp.frequency.exponentialRampToValueAtTime(lo * 1.4, t + len);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.5 * c.gain, t + len * 0.55);
        g.gain.exponentialRampToValueAtTime(0.001, t + len);
        src.connect(bp).connect(g);
        out(g, fxBus, c.pan);
        break;
      }
      case 'pop': {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(520, t);
        o.frequency.exponentialRampToValueAtTime(1100, t + 0.05);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.28 * c.gain, t + 0.008);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        o.connect(g);
        out(g, fxBus, c.pan);
        o.start(t);
        o.stop(t + 0.15);
        break;
      }
      case 'click':
      case 'tick': {
        const src = noiseSource(t, 0.03);
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = c.kind === 'click' ? 2600 : 4200;
        bp.Q.value = 3;
        const g = ctx.createGain();
        g.gain.setValueAtTime((c.kind === 'click' ? 0.7 : 0.18) * c.gain, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + (c.kind === 'click' ? 0.045 : 0.02));
        src.connect(bp).connect(g);
        out(g, fxBus, c.pan);
        break;
      }
      case 'thud': {
        const o = ctx.createOscillator();
        o.frequency.setValueAtTime(110, t);
        o.frequency.exponentialRampToValueAtTime(48, t + 0.18);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.7 * c.gain, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        o.connect(g);
        out(g, fxBus, c.pan);
        o.start(t);
        o.stop(t + 0.35);
        break;
      }
      case 'impact': {
        const o = ctx.createOscillator();
        o.frequency.setValueAtTime(90, t);
        o.frequency.exponentialRampToValueAtTime(32, t + 0.9);
        const g = ctx.createGain();
        g.gain.setValueAtTime(1.0 * c.gain, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 1.4);
        o.connect(g);
        out(g, fxBus);
        o.start(t);
        o.stop(t + 1.5);
        const src = noiseSource(t, 1.2);
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(5000, t);
        lp.frequency.exponentialRampToValueAtTime(300, t + 1.1);
        const ng = ctx.createGain();
        ng.gain.setValueAtTime(0.45 * c.gain, t);
        ng.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
        src.connect(lp).connect(ng);
        out(ng, fxBus);
        break;
      }
      case 'riser': {
        const src = noiseSource(t, len);
        const hp = ctx.createBiquadFilter();
        hp.type = 'bandpass';
        hp.Q.value = 1.5;
        hp.frequency.setValueAtTime(300, t);
        hp.frequency.exponentialRampToValueAtTime(6000, t + len);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.45 * c.gain, t + len * 0.95);
        g.gain.exponentialRampToValueAtTime(0.001, t + len + 0.05);
        src.connect(hp).connect(g);
        out(g, fxBus);
        break;
      }
      case 'shimmer': {
        // A quick bright arpeggio
        [1046.5, 1318.5, 1568, 2093].forEach((f, i) => {
          const nt = t + i * 0.06;
          const o = ctx.createOscillator();
          o.type = 'sine';
          o.frequency.value = f;
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.0001, nt);
          g.gain.exponentialRampToValueAtTime(0.12 * c.gain, nt + 0.01);
          g.gain.exponentialRampToValueAtTime(0.001, nt + 0.5);
          o.connect(g);
          out(g, fxBus, (i - 1.5) * 0.3);
          o.start(nt);
          o.stop(nt + 0.55);
        });
        break;
      }
    }
  }

  return ctx.startRendering();
}

/** 16-bit PCM WAV */
export function toWav(buffer: AudioBuffer): Uint8Array {
  const channels = buffer.numberOfChannels;
  const length = buffer.length;
  const bytes = new Uint8Array(44 + length * channels * 2);
  const view = new DataView(bytes.buffer);
  const text = (offset: number, s: string) =>
    [...s].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  text(0, 'RIFF');
  view.setUint32(4, 36 + length * channels * 2, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, length * channels * 2, true);
  const data = Array.from({ length: channels }, (_, c) => buffer.getChannelData(c));
  let offset = 44;
  for (let i = 0; i < length; i++) {
    for (let c = 0; c < channels; c++) {
      const s = Math.max(-1, Math.min(1, data[c]![i]!));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }
  }
  return bytes;
}

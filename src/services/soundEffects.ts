/**
 * Tactical UI sound effects.
 * App.tsx expects `sfx.playLockSound()`.
 * Uses WebAudio so no asset files are required.
 *
 * NOTE: browsers suspend AudioContext until the first user gesture, so boot
 * log beeps may be silent until the user clicks/taps. `unlockAudio()` (wired
 * to a one-time pointerdown in BootSequence) warms a shared context so later
 * sounds are audible.
 */

let sharedCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    if (!sharedCtx) sharedCtx = new Ctx();
    // Resume in case the browser suspended it pre-gesture
    if (sharedCtx.state === 'suspended') {
      void sharedCtx.resume().catch(() => undefined);
    }
    return sharedCtx;
  } catch {
    return null;
  }
}

/** Call once on first user gesture so subsequent sounds are audible. */
export function unlockAudio(): void {
  getCtx();
}

function tone(
  frequency: number,
  opts: { type?: OscillatorType; durationSec?: number; delaySec?: number; gain?: number } = {}
): void {
  const ctx = getCtx();
  if (!ctx) return;
  try {
    const { type = 'sine', durationSec = 0.06, delaySec = 0, gain = 0.07 } = opts;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    // Tiny envelope to avoid clicks
    const start = ctx.currentTime + delaySec;
    amp.gain.setValueAtTime(0.0001, start);
    amp.gain.exponentialRampToValueAtTime(Math.max(gain, 0.0002), start + 0.008);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + durationSec);
    osc.connect(amp);
    amp.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + durationSec + 0.02);
  } catch {
    // Audio unavailable — silently ignore so UI never crashes
  }
}

function beep(frequency: number, durationMs: number, delayMs = 0, gainValue = 0.08): void {
  tone(frequency, {
    type: 'square',
    durationSec: durationMs / 1000,
    delaySec: delayMs / 1000,
    gain: gainValue,
  });
}

export const sfx = {
  playBeep(frequency: number, type: OscillatorType = 'sine', durationSec = 0.05): void {
    tone(frequency, { type, durationSec });
  },
  /** One distinct blip per diagnostic console line — rising pitch ladder. */
  playBootStep(index: number, total: number): void {
    const steps = Math.max(total, 1);
    const base = 520 + (index / steps) * 620;
    // Alternate timbres so each line is audibly distinct
    const type: OscillatorType = index % 3 === 1 ? 'triangle' : index % 3 === 2 ? 'square' : 'sine';
    tone(base, { type, durationSec: 0.07, gain: type === 'square' ? 0.04 : 0.07 });
    // Final line gets a brighter confirm chirp on top
    if (index === steps - 1) {
      tone(base * 1.5, { type: 'sine', durationSec: 0.12, delaySec: 0.09 });
    }
  },
  /** Triumphant 3-note chime when the system comes online. */
  playSystemOnline(): void {
    tone(659.25, { type: 'sine', durationSec: 0.12 }); // E5
    tone(880, { type: 'sine', durationSec: 0.12, delaySec: 0.11 }); // A5
    tone(1318.5, { type: 'sine', durationSec: 0.22, delaySec: 0.22 }); // E6
  },
  playLockSound(): void {
    // Two-step batcomputer lock chirp
    beep(880, 90, 0);
    beep(1320, 120, 100);
  },
};

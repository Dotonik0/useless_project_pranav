/**
 * Batcomputer text-to-speech adapter.
 * App.tsx expects `batTTS.speakCustom(text)` and `batTTS.speakManeuver(type, modifier)`.
 */

function speak(text: string): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return;
  }
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 0.6;
    utterance.volume = 1;
    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.warn('batTTS failed:', err);
  }
}

function pickRandom<T>(options: T[]): T {
  return options[Math.floor(Math.random() * options.length)];
}

function maneuverPhrase(type: string, modifier?: string): string {
  const t = (type || '').toLowerCase();
  const mod = (modifier || '').toLowerCase();

  const isUturn = t.includes('uturn') || mod.includes('uturn');
  const isArrive = t === 'arrive' || t.includes('arriv');
  const isLeft = mod.includes('left');
  const isRight = mod.includes('right');

  // Alfred chaos lines — requested dialogue
  if (isArrive) {
    return pickRandom([
      'Finally we here boysssss. Uh, I mean Master Wayne.',
      'Yesss, we are here.',
      'Destination reached, Master Wayne.',
    ]);
  }
  if (isUturn) {
    return "Sir, we're going the wrong way. Oh never mind, just take a U-turn.";
  }
  if (isLeft) {
    return 'Right? No, left. Left, sir.';
  }
  if (isRight) {
    return pickRandom([
      'Master Wayne, I think its a right.',
      'Right, right, right.',
    ]);
  }
  if (t === 'depart') return 'Departing. Pursuit vector established.';
  if (modifier) {
    const cleanMod = modifier.replace('-', ' ');
    return `${type} ${cleanMod}.`;
  }
  return `${type}.`;
}

export const batTTS = {
  speakCustom(text: string): void {
    speak(text);
  },
  speakManeuver(type: string, modifier?: string): void {
    speak(maneuverPhrase(type, modifier));
  },
};

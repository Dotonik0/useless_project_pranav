import { getCustomAudio, type CustomSoundKey } from './audioDb';
import { settingsManager, type VoiceMode, type Personality } from './settingsManager';

export class AudioManager {
  private currentAudioElement: HTMLAudioElement | null = null;
  private onErrorCallback?: (message: string) => void;

  public setOnError(callback: (message: string) => void): void {
    this.onErrorCallback = callback;
  }

  public getMode(): VoiceMode {
    return settingsManager.getSettings().voiceMode;
  }

  public setMode(mode: VoiceMode): void {
    settingsManager.updateSettings({ voiceMode: mode });
  }

  /**
   * Speaks text using SpeechSynthesis configured with user settings
   */
  public speakInstruction(text: string): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      this.onErrorCallback?.('TEXT-TO-SPEECH UNAVAILABLE');
      return;
    }

    try {
      window.speechSynthesis.cancel();
      const settings = settingsManager.getSettings();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = settings.ttsRate;
      utterance.pitch = settings.ttsPitch;
      utterance.volume = settings.ttsVolume;

      // Select specific voice if configured
      if (settings.ttsVoiceURI) {
        const voices = window.speechSynthesis.getVoices();
        const found = voices.find((v) => v.voiceURI === settings.ttsVoiceURI);
        if (found) utterance.voice = found;
      }

      utterance.onerror = (e) => {
        console.warn('SpeechSynthesis error:', e);
        this.onErrorCallback?.('TEXT-TO-SPEECH UNAVAILABLE');
      };

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn('TTS execution error:', err);
      this.onErrorCallback?.('TEXT-TO-SPEECH UNAVAILABLE');
    }
  }

  /**
   * Plays corresponding custom audio file from IndexedDB
   */
  public async playCustomSound(key: CustomSoundKey): Promise<boolean> {
    try {
      const blob = await getCustomAudio(key);
      if (!blob) {
        this.onErrorCallback?.('AUDIO FILE NOT FOUND');
        return false;
      }

      if (this.currentAudioElement) {
        this.currentAudioElement.pause();
        this.currentAudioElement = null;
      }

      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      const settings = settingsManager.getSettings();
      audio.volume = settings.ttsVolume;
      this.currentAudioElement = audio;

      audio.onended = () => {
        URL.revokeObjectURL(url);
        this.currentAudioElement = null;
      };

      audio.onerror = () => {
        URL.revokeObjectURL(url);
        this.onErrorCallback?.('AUDIO FILE NOT FOUND');
      };

      await audio.play();
      return true;
    } catch (err) {
      console.warn('Custom audio playback error:', err);
      this.onErrorCallback?.('AUDIO FILE NOT FOUND');
      return false;
    }
  }

  /**
   * Generates tactical phrasing tailored by selected personality
   */
  private generatePersonalityPhrase(
    personality: Personality,
    instruction: string,
    threshold: '500M' | '300M' | '200M' | '100M' | '50M' | 'ARRIVAL',
    roadName?: string
  ): string {
    const road = roadName ? ` onto ${roadName}` : '';

    if (threshold === 'ARRIVAL') {
      switch (personality) {
        case 'BATCOMPUTER':
          return 'Tactical arrival confirmed. Target vector reached. Entering surveillance mode.';
        case 'DARK':
          return 'We have arrived. Keep moving. Gotham never sleeps.';
        case 'ALFRED':
          return 'Sir, you have arrived at your destination safely. I trust everything went smoothly.';
        default:
          return 'You have arrived at your destination.';
      }
    }

    const distText = threshold === '500M' ? 'five hundred metres' : threshold === '300M' ? 'three hundred metres' : threshold === '200M' ? 'two hundred metres' : threshold === '100M' ? 'one hundred metres' : 'now';

    switch (personality) {
      case 'BATCOMPUTER':
        if (threshold === '50M') return `Execute ${instruction}${road}.`;
        return `Vector update: In ${distText}, execute ${instruction}${road}.`;

      case 'DARK':
        if (threshold === '50M') return `${instruction}. Stay out of the light.`;
        return `In ${distText}, ${instruction}. Watch your perimeter.`;

      case 'ALFRED':
        if (threshold === '50M') return `Do ${instruction.toLowerCase()}${road}, if you please.`;
        return `In ${distText}, sir, kindly ${instruction.toLowerCase()}${road}.`;

      case 'STANDARD':
      default:
        if (threshold === '50M') return `${instruction}${road}.`;
        return `In ${distText}, ${instruction.toLowerCase()}${road}.`;
    }
  }

  private mapToCustomSoundKey(maneuverType: string, modifier?: string): CustomSoundKey {
    if (maneuverType === 'arrive') return 'arrival';
    if (modifier === 'uturn') return 'uturn';
    if (modifier?.includes('left')) return 'turn-left';
    if (modifier?.includes('right')) return 'turn-right';
    return 'straight';
  }

  /**
   * Main announcement handler connecting mode, personality, and audio playback
   */
  public async announceManeuver(
    maneuverType: string,
    modifier: string | undefined,
    threshold: '500M' | '300M' | '200M' | '100M' | '50M' | 'ARRIVAL',
    instruction: string,
    roadName?: string
  ): Promise<void> {
    const settings = settingsManager.getSettings();
    if (!settings.turnAnnouncementsEnabled) return;

    const phrase = this.generatePersonalityPhrase(
      settings.personality,
      instruction,
      threshold,
      roadName
    );

    const soundKey = threshold === 'ARRIVAL' ? 'arrival' : this.mapToCustomSoundKey(maneuverType, modifier);

    if (settings.voiceMode === 'TTS') {
      this.speakInstruction(phrase);
    } else if (settings.voiceMode === 'CUSTOM') {
      await this.playCustomSound(soundKey);
    } else if (settings.voiceMode === 'HYBRID') {
      // Hybrid mode: Play custom sound prompt first, then speak personality instruction
      const played = await this.playCustomSound(soundKey);
      if (played) {
        setTimeout(() => {
          this.speakInstruction(phrase);
        }, 600);
      } else {
        this.speakInstruction(phrase);
      }
    }
  }
}

export const audioManager = new AudioManager();

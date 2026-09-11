export type VoiceMode = 'TTS' | 'CUSTOM' | 'HYBRID';
export type Personality = 'STANDARD' | 'BATCOMPUTER' | 'DARK' | 'ALFRED';

export interface UserSettings {
  voiceMode: VoiceMode;
  personality: Personality;
  ttsVoiceURI: string;
  ttsRate: number; // 0.5 - 2.0
  ttsPitch: number; // 0.5 - 1.5
  ttsVolume: number; // 0 - 1.0
  announcementDistances: {
    d500: boolean;
    d300: boolean;
    d200: boolean;
    d100: boolean;
  };
  turnAnnouncementsEnabled: boolean;
  bootAnimationEnabled: boolean;
}

const STORAGE_KEY = 'batmap_user_settings';

export const DEFAULT_SETTINGS: UserSettings = {
  voiceMode: 'TTS',
  personality: 'BATCOMPUTER',
  ttsVoiceURI: '',
  ttsRate: 1.0,
  ttsPitch: 0.9,
  ttsVolume: 1.0,
  announcementDistances: {
    d500: true,
    d300: false,
    d200: true,
    d100: true,
  },
  turnAnnouncementsEnabled: true,
  bootAnimationEnabled: true,
};

class SettingsManager {
  private settings: UserSettings = DEFAULT_SETTINGS;
  private listeners: Set<(s: UserSettings) => void> = new Set();

  constructor() {
    this.load();
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        this.settings = { ...DEFAULT_SETTINGS, ...parsed };
      }
    } catch (e) {
      console.warn('Failed to load settings from localStorage:', e);
      this.settings = DEFAULT_SETTINGS;
    }
  }

  public getSettings(): UserSettings {
    return { ...this.settings };
  }

  public updateSettings(partial: Partial<UserSettings>): void {
    this.settings = { ...this.settings, ...partial };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    } catch (e) {
      console.warn('Failed to save settings:', e);
    }
    this.listeners.forEach((listener) => listener(this.settings));
  }

  public subscribe(callback: (s: UserSettings) => void): () => void {
    this.listeners.add(callback);
    callback(this.settings);
    return () => {
      this.listeners.delete(callback);
    };
  }

  public resetToDefaults(): void {
    this.settings = { ...DEFAULT_SETTINGS };
    localStorage.removeItem(STORAGE_KEY);
    this.listeners.forEach((listener) => listener(this.settings));
  }
}

export const settingsManager = new SettingsManager();

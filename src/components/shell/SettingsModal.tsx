import React, { useState, useEffect } from 'react';
import {
  X,
  Sliders,
  RefreshCw,
  Volume2,
  Navigation,
  Sparkles,
  Trash2,
  CheckCircle,
  Play,
  Database,
  Radio,
} from 'lucide-react';
import {
  settingsManager,
  type UserSettings,
  type VoiceMode,
  type Personality,
} from '../../services/settingsManager';
import { audioManager } from '../../services/audioManager';
import { AudioSettingsPanel } from '../audio/AudioSettingsPanel';
import { deleteCustomAudio, type CustomSoundKey } from '../../services/audioDb';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReplayBoot: () => void;
}

type SettingsTab = 'voice' | 'nav' | 'boot' | 'audio' | 'data';

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onReplayBoot,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('voice');
  const [settings, setSettings] = useState<UserSettings>(settingsManager.getSettings());
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  // Load available system TTS voices
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const loadVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        setAvailableVoices(voices);
      };
      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  // Sync settings
  useEffect(() => {
    const unsub = settingsManager.subscribe((s) => setSettings(s));
    return () => unsub();
  }, []);

  if (!isOpen) return null;

  const showNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3000);
  };

  const handleVoiceModeChange = (mode: VoiceMode) => {
    settingsManager.updateSettings({ voiceMode: mode });
    showNotice(`VOICE MODE: ${mode}`);
  };

  const handlePersonalityChange = (pers: Personality) => {
    settingsManager.updateSettings({ personality: pers });
    showNotice(`PERSONALITY: ${pers}`);
    audioManager.announceManeuver('turn', 'right', '200M', 'TURN RIGHT', 'WAYNE BOULEVARD');
  };

  const handleDistanceToggle = (key: keyof UserSettings['announcementDistances']) => {
    settingsManager.updateSettings({
      announcementDistances: {
        ...settings.announcementDistances,
        [key]: !settings.announcementDistances[key],
      },
    });
  };

  const handleResetCustomAudio = async () => {
    const keys: CustomSoundKey[] = ['turn-left', 'turn-right', 'straight', 'uturn', 'arrival'];
    for (const k of keys) {
      await deleteCustomAudio(k);
    }
    showNotice('CUSTOM AUDIO DATABASE RESET');
  };

  const handleResetAll = () => {
    settingsManager.resetToDefaults();
    showNotice('ALL SETTINGS RESET TO SYSTEM DEFAULTS');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md select-none font-mono">
      <div className="relative w-full max-w-2xl hud-panel rounded bg-[#090b10] border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 p-4 bg-[#0d0f16]">
          <div className="flex items-center gap-2.5">
            <Sliders className="w-4 h-4 text-red-500" />
            <span className="font-heading font-bold text-sm tracking-widest text-slate-100">
              BATCOMPUTER SYSTEM SETTINGS
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800/80 bg-[#07080c] overflow-x-auto text-xs scrollbar-none">
          <button
            onClick={() => setActiveTab('voice')}
            className={`px-4 py-2.5 font-bold tracking-wider whitespace-nowrap flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'voice'
                ? 'border-b-2 border-red-500 text-red-400 bg-red-950/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span>VOICE & TTS</span>
          </button>

          <button
            onClick={() => setActiveTab('nav')}
            className={`px-4 py-2.5 font-bold tracking-wider whitespace-nowrap flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'nav'
                ? 'border-b-2 border-red-500 text-red-400 bg-red-950/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Navigation className="w-3.5 h-3.5" />
            <span>NAVIGATION</span>
          </button>

          <button
            onClick={() => setActiveTab('audio')}
            className={`px-4 py-2.5 font-bold tracking-wider whitespace-nowrap flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'audio'
                ? 'border-b-2 border-red-500 text-red-400 bg-red-950/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>CUSTOM AUDIO</span>
          </button>

          <button
            onClick={() => setActiveTab('boot')}
            className={`px-4 py-2.5 font-bold tracking-wider whitespace-nowrap flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'boot'
                ? 'border-b-2 border-red-500 text-red-400 bg-red-950/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>BOOT</span>
          </button>

          <button
            onClick={() => setActiveTab('data')}
            className={`px-4 py-2.5 font-bold tracking-wider whitespace-nowrap flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'data'
                ? 'border-b-2 border-red-500 text-red-400 bg-red-950/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>DATA</span>
          </button>
        </div>

        {/* Feedback Notice */}
        {notice && (
          <div className="px-4 py-1.5 bg-red-950/40 border-b border-red-900/40 text-red-300 text-[11px] flex items-center gap-2">
            <CheckCircle className="w-3.5 h-3.5 text-red-400" />
            <span>{notice}</span>
          </div>
        )}

        {/* Tab Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4 text-xs">
          {/* TAB 1: VOICE & PERSONALITY */}
          {activeTab === 'voice' && (
            <div className="space-y-4">
              {/* Voice Mode */}
              <div className="p-3.5 rounded bg-slate-950/70 border border-slate-900">
                <div className="text-[11px] font-bold text-red-400 uppercase tracking-wider mb-2">
                  AUDIO OUTPUT MODE
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(['TTS', 'CUSTOM', 'HYBRID'] as VoiceMode[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => handleVoiceModeChange(mode)}
                      className={`py-2 px-3 rounded border font-bold text-xs transition-all cursor-pointer ${
                        settings.voiceMode === mode
                          ? 'border-red-600 bg-red-950/40 text-red-300 shadow-[0_0_8px_rgba(220,38,38,0.3)]'
                          : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {mode === 'TTS' ? 'TEXT-TO-SPEECH' : mode === 'CUSTOM' ? 'CUSTOM AUDIO' : 'HYBRID MODE'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Personality */}
              <div className="p-3.5 rounded bg-slate-950/70 border border-slate-900">
                <div className="text-[11px] font-bold text-red-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>VOICE PERSONALITY</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(['BATCOMPUTER', 'DARK', 'ALFRED', 'STANDARD'] as Personality[]).map((pers) => (
                    <button
                      key={pers}
                      type="button"
                      onClick={() => handlePersonalityChange(pers)}
                      className={`p-2.5 rounded border text-left transition-all cursor-pointer ${
                        settings.personality === pers
                          ? 'border-red-600 bg-red-950/40 text-red-200'
                          : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <div className="font-bold text-[11px]">{pers}</div>
                      <div className="text-[9px] text-slate-400 mt-0.5">
                        {pers === 'BATCOMPUTER'
                          ? 'Tactical AI'
                          : pers === 'DARK'
                          ? 'Vigilante'
                          : pers === 'ALFRED'
                          ? 'Butler'
                          : 'Standard'}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* TTS Controls */}
              <div className="p-3.5 rounded bg-slate-950/70 border border-slate-900 space-y-3">
                <div className="text-[11px] font-bold text-red-400 uppercase tracking-wider">
                  SPEECH SYNTHESIS CALIBRATION
                </div>

                {/* Voice Selection */}
                {availableVoices.length > 0 && (
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">SYNTHESIZER VOICE</label>
                    <select
                      value={settings.ttsVoiceURI}
                      onChange={(e) =>
                        settingsManager.updateSettings({ ttsVoiceURI: e.target.value })
                      }
                      className="w-full p-2 rounded bg-slate-900 border border-slate-800 text-xs text-slate-200 outline-none focus:border-red-600"
                    >
                      <option value="">SYSTEM DEFAULT</option>
                      {availableVoices.map((v) => (
                        <option key={v.voiceURI} value={v.voiceURI}>
                          {v.name} ({v.lang})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Rate Slider */}
                <div>
                  <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                    <span>SPEECH RATE</span>
                    <span className="text-slate-200 font-bold">{settings.ttsRate.toFixed(1)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.6"
                    max="1.6"
                    step="0.1"
                    value={settings.ttsRate}
                    onChange={(e) =>
                      settingsManager.updateSettings({ ttsRate: parseFloat(e.target.value) })
                    }
                    className="w-full accent-red-600 cursor-pointer"
                  />
                </div>

                {/* Pitch Slider */}
                <div>
                  <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                    <span>SPEECH PITCH</span>
                    <span className="text-slate-200 font-bold">{settings.ttsPitch.toFixed(1)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="1.5"
                    step="0.1"
                    value={settings.ttsPitch}
                    onChange={(e) =>
                      settingsManager.updateSettings({ ttsPitch: parseFloat(e.target.value) })
                    }
                    className="w-full accent-red-600 cursor-pointer"
                  />
                </div>

                {/* Volume Slider */}
                <div>
                  <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                    <span>OUTPUT VOLUME</span>
                    <span className="text-slate-200 font-bold">{Math.round(settings.ttsVolume * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1.0"
                    step="0.05"
                    value={settings.ttsVolume}
                    onChange={(e) =>
                      settingsManager.updateSettings({ ttsVolume: parseFloat(e.target.value) })
                    }
                    className="w-full accent-red-600 cursor-pointer"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() =>
                      audioManager.announceManeuver(
                        'turn',
                        'left',
                        '200M',
                        'TURN LEFT',
                        'WAYNE ENTERPRISES TOWER'
                      )
                    }
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-red-900 bg-red-950/40 hover:bg-red-900/60 text-red-300 text-xs font-bold transition-colors cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>TEST CURRENT VOICE</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: NAVIGATION */}
          {activeTab === 'nav' && (
            <div className="space-y-4">
              {/* Turn Announcements Toggle */}
              <div className="p-3.5 rounded bg-slate-950/70 border border-slate-900 flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-100">AUDIO TURN ANNOUNCEMENTS</div>
                  <div className="text-[10px] text-slate-400">Speak directions as maneuvers approach</div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    settingsManager.updateSettings({
                      turnAnnouncementsEnabled: !settings.turnAnnouncementsEnabled,
                    })
                  }
                  className={`px-3 py-1 rounded text-xs font-bold border transition-colors cursor-pointer ${
                    settings.turnAnnouncementsEnabled
                      ? 'border-red-600 bg-red-950/60 text-red-300'
                      : 'border-slate-800 bg-slate-900 text-slate-400'
                  }`}
                >
                  {settings.turnAnnouncementsEnabled ? 'ENABLED' : 'MUTED'}
                </button>
              </div>

              {/* Announcement Distances */}
              <div className="p-3.5 rounded bg-slate-950/70 border border-slate-900 space-y-2.5">
                <div className="text-[11px] font-bold text-red-400 uppercase tracking-wider">
                  ANNOUNCEMENT DISTANCE THRESHOLDS
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: 'd500' as const, label: '500 METRES' },
                    { key: 'd300' as const, label: '300 METRES' },
                    { key: 'd200' as const, label: '200 METRES' },
                    { key: 'd100' as const, label: '100 METRES' },
                  ].map((dist) => (
                    <label
                      key={dist.key}
                      className="p-2.5 rounded bg-slate-900/60 border border-slate-800 flex items-center justify-between cursor-pointer hover:border-slate-700"
                    >
                      <span className="text-xs text-slate-300 font-bold">{dist.label}</span>
                      <input
                        type="checkbox"
                        checked={settings.announcementDistances[dist.key]}
                        onChange={() => handleDistanceToggle(dist.key)}
                        className="accent-red-600 cursor-pointer"
                      />
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: CUSTOM AUDIO */}
          {activeTab === 'audio' && (
            <div className="space-y-4">
              <AudioSettingsPanel />
              <div className="p-3 rounded bg-slate-950/70 border border-slate-900 flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-200">RESET CUSTOM AUDIO</div>
                  <div className="text-[10px] text-slate-400">Clear uploaded files from IndexedDB</div>
                </div>
                <button
                  type="button"
                  onClick={handleResetCustomAudio}
                  className="px-3 py-1.5 rounded border border-red-900 bg-red-950/40 hover:bg-red-900/60 text-red-300 text-xs font-bold transition-colors cursor-pointer"
                >
                  RESET AUDIO
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: BOOT */}
          {activeTab === 'boot' && (
            <div className="space-y-4">
              {/* Boot Animation Toggle */}
              <div className="p-3.5 rounded bg-slate-950/70 border border-slate-900 flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-100">STARTUP BOOT SEQUENCE</div>
                  <div className="text-[10px] text-slate-400">Play cinematic Batcomputer terminal initialization</div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    settingsManager.updateSettings({
                      bootAnimationEnabled: !settings.bootAnimationEnabled,
                    })
                  }
                  className={`px-3 py-1 rounded text-xs font-bold border transition-colors cursor-pointer ${
                    settings.bootAnimationEnabled
                      ? 'border-red-600 bg-red-950/60 text-red-300'
                      : 'border-slate-800 bg-slate-900 text-slate-400'
                  }`}
                >
                  {settings.bootAnimationEnabled ? 'ENABLED' : 'DISABLED'}
                </button>
              </div>

              {/* Replay Trigger */}
              <div className="p-3.5 rounded bg-slate-950/70 border border-slate-900 flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-100">REPLAY BOOT STREAM</div>
                  <div className="text-[10px] text-slate-400">Immediately run full cinematic diagnostic animation</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onReplayBoot();
                  }}
                  className="px-3 py-1.5 rounded border border-red-900 bg-red-950/60 hover:bg-red-900 text-red-200 text-xs font-bold tracking-wider transition-colors cursor-pointer"
                >
                  REPLAY
                </button>
              </div>
            </div>
          )}

          {/* TAB 5: DATA */}
          {activeTab === 'data' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded bg-slate-950/70 border border-slate-900 flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-100">RESET SAVED SETTINGS</div>
                  <div className="text-[10px] text-slate-400">Clear localStorage and restore default configuration</div>
                </div>
                <button
                  type="button"
                  onClick={handleResetAll}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-red-900 bg-red-950/60 hover:bg-red-900 text-red-200 text-xs font-bold transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>CLEAR SETTINGS</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 border-t border-slate-800 bg-[#0d0f16] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold tracking-wider transition-colors cursor-pointer"
          >
            DISMISS
          </button>
        </div>
      </div>
    </div>
  );
};

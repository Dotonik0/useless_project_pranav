import React, { useState, useEffect, useRef } from 'react';
import { Volume2, Upload, Play, CheckCircle, AlertCircle } from 'lucide-react';
import { audioManager } from '../../services/audioManager';
import type { VoiceMode as AudioMode } from '../../services/settingsManager';
import { saveCustomAudio, getAllCustomAudioKeys, type CustomSoundKey } from '../../services/audioDb';

const CUSTOM_AUDIO_SLOTS: Array<{ key: CustomSoundKey; label: string; samplePhrase: string }> = [
  { key: 'turn-left', label: 'TURN LEFT', samplePhrase: 'Turn left.' },
  { key: 'turn-right', label: 'TURN RIGHT', samplePhrase: 'Turn right.' },
  { key: 'straight', label: 'STRAIGHT', samplePhrase: 'Continue straight.' },
  { key: 'uturn', label: 'U-TURN', samplePhrase: 'Make a U-turn.' },
  { key: 'arrival', label: 'ARRIVAL', samplePhrase: 'You have arrived at your destination.' },
];

export const AudioSettingsPanel: React.FC = () => {
  const [audioMode, setAudioMode] = useState<AudioMode>(audioManager.getMode());
  const [loadedKeys, setLoadedKeys] = useState<Set<CustomSoundKey>>(new Set());
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeUploadSlotRef = useRef<CustomSoundKey | null>(null);

  const refreshKeys = async () => {
    const keys = await getAllCustomAudioKeys();
    setLoadedKeys(new Set(keys));
  };

  useEffect(() => {
    let isMounted = true;
    getAllCustomAudioKeys().then((keys) => {
      if (isMounted) {
        setLoadedKeys(new Set(keys));
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const handleModeChange = (mode: AudioMode) => {
    setAudioMode(mode);
    audioManager.setMode(mode);
    setStatusFeedback(`AUDIO MODE SET: ${mode}`);
    setTimeout(() => setStatusFeedback(null), 3000);
  };

  const handleTriggerUpload = (key: CustomSoundKey) => {
    activeUploadSlotRef.current = key;
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const key = activeUploadSlotRef.current;
    if (!file || !key) return;

    try {
      await saveCustomAudio(key, file);
      await refreshKeys();
      setStatusFeedback(`SAVED AUDIO FOR: ${key.toUpperCase()}`);
    } catch (err) {
      console.error('Failed to store audio file:', err);
      setStatusFeedback('AUDIO STORAGE FAILED');
    } finally {
      setTimeout(() => setStatusFeedback(null), 3500);
    }
  };

  const handleTestSound = (slot: (typeof CUSTOM_AUDIO_SLOTS)[0]) => {
    if (audioMode === 'TTS') {
      audioManager.speakInstruction(slot.samplePhrase);
      setStatusFeedback(`TTS TEST: "${slot.samplePhrase}"`);
    } else {
      audioManager.playCustomSound(slot.key);
      setStatusFeedback(`PLAYING CUSTOM AUDIO: ${slot.label}`);
    }
    setTimeout(() => setStatusFeedback(null), 3500);
  };

  return (
    <div className="space-y-4 font-mono text-xs text-slate-200">
      {/* Hidden file input for custom audio uploads */}
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,.mp3,.wav,.ogg,.m4a,.webm"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Navigation Audio Header */}
      <div className="p-3 rounded bg-slate-950/70 border border-slate-900">
        <div className="text-[11px] font-bold text-red-400 tracking-wider flex items-center gap-1.5 mb-2.5">
          <Volume2 className="w-4 h-4 text-red-500" />
          <span>NAVIGATION AUDIO METHOD</span>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="radio"
              name="audio_method"
              checked={audioMode === 'TTS'}
              onChange={() => handleModeChange('TTS')}
              className="accent-red-600"
            />
            <span className={audioMode === 'TTS' ? 'text-red-400 font-bold' : 'text-slate-400'}>
              TEXT TO SPEECH
            </span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="radio"
              name="audio_method"
              checked={audioMode === 'CUSTOM'}
              onChange={() => handleModeChange('CUSTOM')}
              className="accent-red-600"
            />
            <span className={audioMode === 'CUSTOM' ? 'text-red-400 font-bold' : 'text-slate-400'}>
              CUSTOM AUDIO
            </span>
          </label>
        </div>
      </div>

      {/* Feedback Banner */}
      {statusFeedback && (
        <div className="px-3 py-1.5 rounded bg-red-950/40 border border-red-800/60 text-red-300 text-[10px] flex items-center gap-1.5 animate-in fade-in">
          <CheckCircle className="w-3 h-3 text-red-400" />
          <span>{statusFeedback}</span>
        </div>
      )}

      {/* Custom Audio Slot Table */}
      <div className="p-3 rounded bg-slate-950/70 border border-slate-900">
        <div className="flex items-center justify-between border-b border-slate-900 pb-2 mb-3 text-[10px] text-slate-400">
          <span>MANEUVER SOUND</span>
          <span>STORAGE & ACTIONS</span>
        </div>

        <div className="space-y-2">
          {CUSTOM_AUDIO_SLOTS.map((slot) => {
            const hasCustomFile = loadedKeys.has(slot.key);

            return (
              <div
                key={slot.key}
                className="p-2 rounded bg-slate-900/40 border border-slate-800/80 flex items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2">
                  {hasCustomFile ? (
                    <span title="Custom Audio Uploaded">
                      <CheckCircle className="w-3.5 h-3.5 text-red-500" />
                    </span>
                  ) : (
                    <span title="Default / Unassigned">
                      <AlertCircle className="w-3.5 h-3.5 text-slate-400" />
                    </span>
                  )}
                  <span className="font-bold text-[11px] text-slate-200 tracking-wider">
                    {slot.label}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleTriggerUpload(slot.key)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded border border-slate-800 bg-slate-950 hover:border-red-900 hover:bg-red-950/30 text-slate-300 hover:text-red-300 text-[10px] font-bold tracking-wider transition-colors cursor-pointer"
                  >
                    <Upload className="w-3 h-3" />
                    <span>UPLOAD</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleTestSound(slot)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded border border-slate-800 bg-slate-950 hover:border-red-900 hover:bg-red-950/30 text-slate-300 hover:text-red-300 text-[10px] font-bold tracking-wider transition-colors cursor-pointer"
                  >
                    <Play className="w-3 h-3" />
                    <span>TEST</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

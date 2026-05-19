// ===================================================================
// VOICE ENGINE
// ===================================================================
// Handles:
// - ElevenLabs TTS for prospect (and closer when in prospect-role)
// - Web Speech API STT for closer mic input
// - Key storage (browser localStorage only — never committed to repo)
// - Voice selection (5 preloaded voices, user-selectable)
// - Emotional tone variation (Type A vs Type B vs named-fear delivery)
// - iOS audio unlock (first-tap gesture required for autoplay)
// ===================================================================

const VoiceEngine = (function() {

  const KEY_STORAGE = 'iceberg-v5-elevenlabs-key';
  const VOICE_STORAGE = 'iceberg-v5-voice-prefs';

  // Preloaded voices (user-provided)
  const VOICES = [
    { id: 'IDHS58OMlK9jZvRdhEVy', name: 'Jennifer', defaultFor: null },
    { id: 'pFZP5JQG7iQjIQuC4Bku', name: 'Lily',     defaultFor: 'B' },
    { id: '8fcyCHOzlKDlxh1InJSf', name: 'Joseph',   defaultFor: null },
    { id: 'oPpICG0hjJA583hT8dtk', name: 'Neville',  defaultFor: null },
    { id: 'nysiR7V9jE5aIxeTs7DA', name: 'Daniel',   defaultFor: 'A' }
  ];

  // ElevenLabs model + endpoint
  const TTS_ENDPOINT = 'https://api.elevenlabs.io/v1/text-to-speech/';
  const TTS_MODEL = 'eleven_turbo_v2_5'; // low latency, good quality

  // Audio unlock state (iOS)
  let audioUnlocked = false;

  // Currently playing audio element (for stop/replay/cancel)
  let currentAudio = null;
  let onCurrentAudioEnd = null;

  // Speech recognition instance
  let recognition = null;
  let isListening = false;
  let onTranscriptCallback = null;

  // -----------------------------------------------------------------
  // KEY STORAGE
  // -----------------------------------------------------------------

  function setApiKey(key) {
    if (!key || typeof key !== 'string') return false;
    const trimmed = key.trim();
    localStorage.setItem(KEY_STORAGE, trimmed);
    return true;
  }

  function getApiKey() {
    try { return localStorage.getItem(KEY_STORAGE) || ''; }
    catch { return ''; }
  }

  function hasApiKey() {
    return !!getApiKey();
  }

  function clearApiKey() {
    try { localStorage.removeItem(KEY_STORAGE); }
    catch {}
  }

  // -----------------------------------------------------------------
  // VOICE PREFERENCES
  // -----------------------------------------------------------------

  function getVoicePrefs() {
    try {
      const raw = localStorage.getItem(VOICE_STORAGE);
      if (!raw) return defaultVoicePrefs();
      return JSON.parse(raw);
    } catch { return defaultVoicePrefs(); }
  }

  function defaultVoicePrefs() {
    return {
      enabled: false,
      voiceForA: VOICES.find(v => v.defaultFor === 'A').id,
      voiceForB: VOICES.find(v => v.defaultFor === 'B').id,
      voiceForCloser: VOICES.find(v => v.defaultFor === 'A').id,
      gateAdvance: true  // disable Continue button until TTS finishes
    };
  }

  function saveVoicePrefs(prefs) {
    try { localStorage.setItem(VOICE_STORAGE, JSON.stringify(prefs)); }
    catch {}
  }

  function setEnabled(enabled) {
    const prefs = getVoicePrefs();
    prefs.enabled = !!enabled;
    saveVoicePrefs(prefs);
    return prefs.enabled;
  }

  function isEnabled() {
    return getVoicePrefs().enabled;
  }

  function getVoices() { return VOICES.slice(); }

  function getVoiceById(id) { return VOICES.find(v => v.id === id) || null; }

  // -----------------------------------------------------------------
  // AUDIO UNLOCK (iOS requirement)
  // -----------------------------------------------------------------

  function unlockAudio() {
    if (audioUnlocked) return Promise.resolve(true);
    // Play a 1ms silent buffer to satisfy iOS user-gesture requirement
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const buffer = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(ctx.destination);
      src.start(0);
      audioUnlocked = true;
      return Promise.resolve(true);
    } catch (err) {
      console.warn('Audio unlock failed:', err);
      return Promise.resolve(false);
    }
  }

  // -----------------------------------------------------------------
  // TTS — Generate + play
  // -----------------------------------------------------------------

  // Voice settings based on role + delivery type
  function getVoiceSettings(deliveryMode) {
    // deliveryMode: 'typeA' | 'typeB' | 'fear' | 'closer'
    switch (deliveryMode) {
      case 'typeA':
        // Controlled, steady operator energy
        return { stability: 0.65, similarity_boost: 0.75, style: 0.20, use_speaker_boost: true };
      case 'typeB':
        // More expressive, varied, vulnerable
        return { stability: 0.40, similarity_boost: 0.75, style: 0.55, use_speaker_boost: true };
      case 'fear':
        // Slow, low, weighted — the somatic delivery
        return { stability: 0.55, similarity_boost: 0.80, style: 0.65, use_speaker_boost: true };
      case 'closer':
        // Professional, deliberate
        return { stability: 0.60, similarity_boost: 0.75, style: 0.25, use_speaker_boost: true };
      default:
        return { stability: 0.50, similarity_boost: 0.75, style: 0.30, use_speaker_boost: true };
    }
  }

  // Speak the given text. Returns a Promise that resolves when playback ends
  // (or rejects if generation/playback fails).
  // options: { voiceId, deliveryMode, onProgress: (cur, dur) => void }
  async function speak(text, options) {
    options = options || {};
    const key = getApiKey();
    if (!key) throw new Error('No ElevenLabs API key set. Open settings to add one.');
    if (!text || !text.trim()) throw new Error('Nothing to speak.');

    const voiceId = options.voiceId;
    if (!voiceId) throw new Error('No voice selected.');

    // Stop any currently playing audio
    stopCurrent();

    const settings = getVoiceSettings(options.deliveryMode || 'typeA');

    let response;
    try {
      response = await fetch(TTS_ENDPOINT + voiceId, {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': key
        },
        body: JSON.stringify({
          text: text,
          model_id: TTS_MODEL,
          voice_settings: settings
        })
      });
    } catch (err) {
      throw new Error('Network error reaching ElevenLabs: ' + err.message);
    }

    if (!response.ok) {
      let errText = 'HTTP ' + response.status;
      try {
        const errBody = await response.text();
        errText += ' — ' + errBody.substring(0, 200);
      } catch {}
      if (response.status === 401) errText = 'Invalid API key. Open settings to update.';
      else if (response.status === 429) errText = 'Rate limited or quota exceeded.';
      throw new Error(errText);
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.preload = 'auto';
    currentAudio = audio;

    return new Promise((resolve, reject) => {
      let resolved = false;

      audio.addEventListener('timeupdate', () => {
        if (options.onProgress && audio.duration) {
          options.onProgress(audio.currentTime, audio.duration);
        }
      });

      audio.addEventListener('ended', () => {
        if (resolved) return;
        resolved = true;
        URL.revokeObjectURL(url);
        currentAudio = null;
        if (onCurrentAudioEnd) { const cb = onCurrentAudioEnd; onCurrentAudioEnd = null; cb(); }
        resolve();
      });

      audio.addEventListener('error', (e) => {
        if (resolved) return;
        resolved = true;
        URL.revokeObjectURL(url);
        currentAudio = null;
        reject(new Error('Audio playback failed'));
      });

      // Save onEnd hook for external cancel/replay flows
      onCurrentAudioEnd = null;

      audio.play().catch(err => {
        if (resolved) return;
        resolved = true;
        URL.revokeObjectURL(url);
        currentAudio = null;
        reject(new Error('Audio play blocked (iOS requires a tap first): ' + err.message));
      });
    });
  }

  function stopCurrent() {
    if (currentAudio) {
      try {
        currentAudio.pause();
        currentAudio.src = '';
      } catch {}
      currentAudio = null;
    }
  }

  function isPlaying() {
    return currentAudio !== null && !currentAudio.paused;
  }

  // -----------------------------------------------------------------
  // MIC — Web Speech API
  // -----------------------------------------------------------------

  function getRecognition() {
    if (recognition) return recognition;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return null;
    recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    return recognition;
  }

  function micSupported() {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  // Start listening. onTranscript called repeatedly with { transcript, isFinal }.
  // Returns true if started, false if not supported.
  function startListening(onTranscript) {
    const r = getRecognition();
    if (!r) return false;
    if (isListening) stopListening();

    onTranscriptCallback = onTranscript;
    let lastFinalTranscript = '';

    r.onresult = (event) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      if (final) lastFinalTranscript += final;
      if (onTranscriptCallback) {
        onTranscriptCallback({
          transcript: lastFinalTranscript + interim,
          isFinal: !!final && !interim
        });
      }
    };

    r.onerror = (event) => {
      console.warn('Speech recognition error:', event.error);
      isListening = false;
      if (onTranscriptCallback) {
        onTranscriptCallback({ transcript: lastFinalTranscript, isFinal: true, error: event.error });
      }
    };

    r.onend = () => {
      isListening = false;
      if (onTranscriptCallback) {
        onTranscriptCallback({ transcript: lastFinalTranscript, isFinal: true });
      }
    };

    try {
      r.start();
      isListening = true;
      return true;
    } catch (err) {
      console.warn('Failed to start recognition:', err);
      isListening = false;
      return false;
    }
  }

  function stopListening() {
    if (!recognition) return;
    try { recognition.stop(); } catch {}
    isListening = false;
  }

  function isMicListening() { return isListening; }

  // -----------------------------------------------------------------
  // KEY TEST
  // -----------------------------------------------------------------

  async function testKey() {
    if (!hasApiKey()) throw new Error('No API key to test');
    // Simple test: fetch user info from ElevenLabs
    const response = await fetch('https://api.elevenlabs.io/v1/user', {
      headers: { 'xi-api-key': getApiKey() }
    });
    if (!response.ok) throw new Error('Key invalid (HTTP ' + response.status + ')');
    const data = await response.json();
    return data;
  }

  return {
    // Keys
    setApiKey, getApiKey, hasApiKey, clearApiKey, testKey,
    // Prefs
    getVoicePrefs, saveVoicePrefs, setEnabled, isEnabled,
    getVoices, getVoiceById,
    // Audio
    unlockAudio, speak, stopCurrent, isPlaying,
    // Mic
    micSupported, startListening, stopListening, isMicListening,
    // Constants
    VOICES
  };
})();

// ===================================================================
// VOICE UI
// ===================================================================
// Renders:
// - Settings panel (gear icon, API key, voice picks, voice toggle)
// - Role selector (closer / prospect) at call start
// - TTS playback controls embedded in cards (auto-play, replay, progress)
// - Mic input UI on cards (record button, transcript preview, confirm/retry)
// ===================================================================

const VoiceUI = (function() {

  function esc(t) {
    if (t == null) return '';
    return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  // -----------------------------------------------------------------
  // SETTINGS PANEL
  // -----------------------------------------------------------------

  function renderSettingsPanel() {
    const prefs = VoiceEngine.getVoicePrefs();
    const hasKey = VoiceEngine.hasApiKey();
    const voices = VoiceEngine.getVoices();

    let html = '<div class="voice-settings-panel" id="voice-settings-panel">';
    html += '<div class="panel-header">';
    html += '<h3>🔊 Voice settings</h3>';
    html += '<button class="panel-close" onclick="VoiceUI.closeSettings()">×</button>';
    html += '</div>';

    // API key section
    html += '<div class="panel-section">';
    html += '<div class="panel-label">ElevenLabs API key</div>';
    html += '<div class="panel-help">Stored in this browser only. Never sent to GitHub.</div>';
    html += '<div class="key-row">';
    html += '<input type="password" id="voice-key-input" class="panel-input" placeholder="' + (hasKey ? '••••••••• (saved)' : 'sk_...') + '" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false">';
    html += '<button class="panel-btn" onclick="VoiceUI.saveKey()">Save</button>';
    html += '</div>';
    html += '<div class="key-actions">';
    if (hasKey) {
      html += '<button class="panel-btn small" onclick="VoiceUI.testKey()">🧪 Test key</button>';
      html += '<button class="panel-btn small danger" onclick="VoiceUI.clearKey()">🗑 Clear key</button>';
    }
    html += '</div>';
    html += '<div class="key-status" id="key-status"></div>';
    html += '</div>';

    // Voice selection
    html += '<div class="panel-section">';
    html += '<div class="panel-label">Voices</div>';
    html += '<div class="panel-help">Pick which voice plays for each prospect type and for the closer (when you play the prospect).</div>';

    html += '<div class="voice-pick-row">';
    html += '<label>Type A prospect voice</label>';
    html += '<select class="panel-select" id="voice-pick-a">';
    voices.forEach(v => {
      const sel = v.id === prefs.voiceForA ? ' selected' : '';
      html += '<option value="' + v.id + '"' + sel + '>' + esc(v.name) + '</option>';
    });
    html += '</select>';
    html += '<button class="panel-btn small" onclick="VoiceUI.previewVoice(\'a\')">▶ Preview</button>';
    html += '</div>';

    html += '<div class="voice-pick-row">';
    html += '<label>Type B prospect voice</label>';
    html += '<select class="panel-select" id="voice-pick-b">';
    voices.forEach(v => {
      const sel = v.id === prefs.voiceForB ? ' selected' : '';
      html += '<option value="' + v.id + '"' + sel + '>' + esc(v.name) + '</option>';
    });
    html += '</select>';
    html += '<button class="panel-btn small" onclick="VoiceUI.previewVoice(\'b\')">▶ Preview</button>';
    html += '</div>';

    html += '<div class="voice-pick-row">';
    html += '<label>Closer voice (when you play prospect)</label>';
    html += '<select class="panel-select" id="voice-pick-closer">';
    voices.forEach(v => {
      const sel = v.id === prefs.voiceForCloser ? ' selected' : '';
      html += '<option value="' + v.id + '"' + sel + '>' + esc(v.name) + '</option>';
    });
    html += '</select>';
    html += '<button class="panel-btn small" onclick="VoiceUI.previewVoice(\'closer\')">▶ Preview</button>';
    html += '</div>';
    html += '</div>';

    // Behavior options
    html += '<div class="panel-section">';
    html += '<div class="panel-label">Behavior</div>';
    html += '<label class="panel-checkbox">';
    html += '<input type="checkbox" id="voice-gate-advance"' + (prefs.gateAdvance ? ' checked' : '') + '>';
    html += '<span>Disable Continue button until voice finishes</span>';
    html += '</label>';
    html += '<div class="panel-help">Recommended ON — forces listening, not skimming.</div>';
    html += '</div>';

    html += '<div class="panel-actions">';
    html += '<button class="panel-btn primary" onclick="VoiceUI.savePrefsAndClose()">Save & close</button>';
    html += '</div>';
    html += '</div>';

    return html;
  }

  function openSettings() {
    const existing = document.getElementById('voice-settings-overlay');
    if (existing) existing.remove();
    const overlay = document.createElement('div');
    overlay.id = 'voice-settings-overlay';
    overlay.className = 'voice-settings-overlay';
    overlay.innerHTML = renderSettingsPanel();
    overlay.onclick = (e) => {
      if (e.target === overlay) closeSettings();
    };
    document.body.appendChild(overlay);
  }

  function closeSettings() {
    const overlay = document.getElementById('voice-settings-overlay');
    if (overlay) overlay.remove();
  }

  function saveKey() {
    const input = document.getElementById('voice-key-input');
    if (!input) return;
    const val = (input.value || '').trim();
    if (!val) {
      showKeyStatus('Empty — paste your key first', 'warn');
      return;
    }
    VoiceEngine.setApiKey(val);
    showKeyStatus('✓ Key saved to this browser', 'ok');
    input.value = '';
    // Refresh panel to show test/clear buttons
    setTimeout(() => {
      const panel = document.getElementById('voice-settings-panel');
      if (panel) panel.outerHTML = renderSettingsPanel();
    }, 800);
  }

  async function testKey() {
    showKeyStatus('Testing key...', 'pending');
    try {
      const data = await VoiceEngine.testKey();
      const charsLeft = data?.subscription?.character_count
        ? (data.subscription.character_limit - data.subscription.character_count)
        : null;
      let msg = '✓ Key works';
      if (charsLeft !== null) msg += ' · ' + charsLeft.toLocaleString() + ' characters remaining';
      showKeyStatus(msg, 'ok');
    } catch (err) {
      showKeyStatus('✗ ' + err.message, 'error');
    }
  }

  function clearKey() {
    if (!confirm('Clear the saved API key? You\'ll need to paste it again.')) return;
    VoiceEngine.clearApiKey();
    const panel = document.getElementById('voice-settings-panel');
    if (panel) panel.outerHTML = renderSettingsPanel();
  }

  function showKeyStatus(msg, type) {
    const el = document.getElementById('key-status');
    if (!el) return;
    el.textContent = msg;
    el.className = 'key-status ' + (type || '');
  }

  async function previewVoice(slot) {
    const prefs = VoiceEngine.getVoicePrefs();
    let voiceId, deliveryMode, sampleText;
    if (slot === 'a') {
      const sel = document.getElementById('voice-pick-a');
      voiceId = sel ? sel.value : prefs.voiceForA;
      deliveryMode = 'typeA';
      sampleText = "I had a clear strategic justification for the time I was spending. We were scaling.";
    } else if (slot === 'b') {
      const sel = document.getElementById('voice-pick-b');
      voiceId = sel ? sel.value : prefs.voiceForB;
      deliveryMode = 'typeB';
      sampleText = "I just felt like I was drowning. Every day there was something.";
    } else {
      const sel = document.getElementById('voice-pick-closer');
      voiceId = sel ? sel.value : prefs.voiceForCloser;
      deliveryMode = 'closer';
      sampleText = "When you say you were busy — what specifically was on your plate then?";
    }
    try {
      await VoiceEngine.unlockAudio();
      showKeyStatus('Playing preview...', 'pending');
      await VoiceEngine.speak(sampleText, { voiceId, deliveryMode });
      showKeyStatus('✓ Preview done', 'ok');
    } catch (err) {
      showKeyStatus('Preview failed: ' + err.message, 'error');
    }
  }

  function savePrefsAndClose() {
    const prefs = VoiceEngine.getVoicePrefs();
    const aSel = document.getElementById('voice-pick-a');
    const bSel = document.getElementById('voice-pick-b');
    const cSel = document.getElementById('voice-pick-closer');
    const gateCb = document.getElementById('voice-gate-advance');
    if (aSel) prefs.voiceForA = aSel.value;
    if (bSel) prefs.voiceForB = bSel.value;
    if (cSel) prefs.voiceForCloser = cSel.value;
    if (gateCb) prefs.gateAdvance = gateCb.checked;
    VoiceEngine.saveVoicePrefs(prefs);
    closeSettings();
  }

  // -----------------------------------------------------------------
  // TTS playback widget — embedded in cards
  // -----------------------------------------------------------------

  // Renders the speaker controls. Caller injects this HTML into a card and
  // then calls startCardPlayback() to begin.
  function renderPlaybackControls(id) {
    let html = '<div class="tts-player" id="tts-' + id + '">';
    html += '<button class="tts-replay-btn" onclick="VoiceUI.replayCardAudio(\'' + id + '\')" title="Replay">🔊</button>';
    html += '<div class="tts-progress-wrap">';
    html += '<div class="tts-progress" id="tts-progress-' + id + '"><div class="tts-progress-bar" id="tts-bar-' + id + '"></div></div>';
    html += '<div class="tts-progress-text" id="tts-text-' + id + '">Ready</div>';
    html += '</div>';
    html += '</div>';
    return html;
  }

  // Stored playback contexts keyed by widget id
  const playbackContexts = {};

  // Start playback for a widget. Returns a Promise that resolves when done.
  async function startCardPlayback(id, text, options) {
    options = options || {};
    if (!VoiceEngine.isEnabled() || !VoiceEngine.hasApiKey()) return;

    const onDone = options.onDone || (() => {});
    const ctx = { text, options, onDone };
    playbackContexts[id] = ctx;

    const textEl = document.getElementById('tts-text-' + id);
    const barEl = document.getElementById('tts-bar-' + id);

    if (textEl) textEl.textContent = 'Loading voice...';

    try {
      await VoiceEngine.unlockAudio();
      await VoiceEngine.speak(text, {
        voiceId: options.voiceId,
        deliveryMode: options.deliveryMode,
        onProgress: (cur, dur) => {
          if (textEl) textEl.textContent = Math.floor(cur) + 's / ' + Math.floor(dur) + 's';
          if (barEl && dur) barEl.style.width = ((cur / dur) * 100) + '%';
        }
      });
      if (textEl) textEl.textContent = '✓ Done';
      if (barEl) barEl.style.width = '100%';
      ctx.completed = true;
      onDone();
    } catch (err) {
      if (textEl) textEl.textContent = '⚠ ' + err.message.substring(0, 60);
      console.error('Playback error:', err);
    }
  }

  function replayCardAudio(id) {
    const ctx = playbackContexts[id];
    if (!ctx) return;
    startCardPlayback(id, ctx.text, ctx.options);
  }

  // -----------------------------------------------------------------
  // MIC widget
  // -----------------------------------------------------------------

  function renderMicWidget(id, options) {
    options = options || {};
    if (!VoiceEngine.micSupported()) {
      return '<div class="mic-widget unsupported">⚠ Mic not supported in this browser</div>';
    }
    let html = '<div class="mic-widget" id="mic-' + id + '">';
    html += '<button class="mic-btn-large" id="mic-btn-' + id + '" onclick="VoiceUI.toggleMic(\'' + id + '\')">🎤<span class="mic-btn-label">Tap to record</span></button>';
    html += '<div class="mic-transcript" id="mic-trans-' + id + '"></div>';
    html += '<div class="mic-actions" id="mic-actions-' + id + '" style="display:none;">';
    html += '<button class="card-btn primary" onclick="VoiceUI.confirmMic(\'' + id + '\')">✓ Confirm — advance</button>';
    html += '<button class="card-btn secondary" onclick="VoiceUI.retryMic(\'' + id + '\')">🔄 Re-record</button>';
    html += '</div>';
    html += '</div>';
    return html;
  }

  // Stored mic contexts
  const micContexts = {};

  function toggleMic(id) {
    const ctx = micContexts[id] || { id };
    micContexts[id] = ctx;

    if (VoiceEngine.isMicListening()) {
      VoiceEngine.stopListening();
      const btn = document.getElementById('mic-btn-' + id);
      if (btn) btn.classList.remove('listening');
      return;
    }

    const transEl = document.getElementById('mic-trans-' + id);
    const btn = document.getElementById('mic-btn-' + id);
    const actions = document.getElementById('mic-actions-' + id);

    if (transEl) transEl.textContent = 'Listening...';
    if (btn) btn.classList.add('listening');
    if (actions) actions.style.display = 'none';

    const started = VoiceEngine.startListening((result) => {
      ctx.transcript = result.transcript;
      if (transEl) transEl.textContent = result.transcript || 'Listening...';
      if (result.isFinal) {
        if (btn) btn.classList.remove('listening');
        if (actions) actions.style.display = 'flex';
      }
    });

    if (!started) {
      if (transEl) transEl.textContent = '⚠ Could not start mic';
      if (btn) btn.classList.remove('listening');
    }
  }

  function confirmMic(id) {
    const ctx = micContexts[id];
    if (!ctx) return;
    if (ctx.onConfirm) ctx.onConfirm(ctx.transcript || '');
  }

  function retryMic(id) {
    const ctx = micContexts[id];
    if (!ctx) return;
    ctx.transcript = '';
    const transEl = document.getElementById('mic-trans-' + id);
    const actions = document.getElementById('mic-actions-' + id);
    if (transEl) transEl.textContent = '';
    if (actions) actions.style.display = 'none';
    toggleMic(id);
  }

  function attachMicHandler(id, onConfirm) {
    micContexts[id] = micContexts[id] || { id };
    micContexts[id].onConfirm = onConfirm;
  }

  // -----------------------------------------------------------------
  // Header voice toggle
  // -----------------------------------------------------------------

  function updateHeaderToggle() {
    const btn = document.getElementById('voice-toggle-btn');
    if (!btn) return;
    const enabled = VoiceEngine.isEnabled();
    btn.textContent = enabled ? '🔊 Voice' : '🔇 Voice';
    btn.className = 'voice-toggle-btn ' + (enabled ? 'on' : 'off');
  }

  function toggleVoice() {
    const newState = !VoiceEngine.isEnabled();
    if (newState && !VoiceEngine.hasApiKey()) {
      alert('Add your ElevenLabs API key first. Tap the ⚙ settings button.');
      openSettings();
      return;
    }
    VoiceEngine.setEnabled(newState);
    updateHeaderToggle();
  }

  return {
    // Settings panel
    openSettings, closeSettings, saveKey, testKey, clearKey,
    previewVoice, savePrefsAndClose,
    // TTS widget
    renderPlaybackControls, startCardPlayback, replayCardAudio,
    // Mic widget
    renderMicWidget, toggleMic, confirmMic, retryMic, attachMicHandler,
    // Header toggle
    updateHeaderToggle, toggleVoice
  };
})();

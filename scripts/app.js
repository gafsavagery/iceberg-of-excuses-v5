// ===================================================================
// APP — main wiring (Phase 1B + Scoop + Session Save)
// ===================================================================
// Coordinates: session → picker → drill stages → sweep → scoop → fear
// Plus: auto-save to localStorage on significant events, restore on load,
// manual MD export, archive on full reset.
// ===================================================================

const STAGE_PICK = 'stage-pick';
const STAGE_DRILL = 'stage-drill';

// Per-drill card logs, keyed by chip id (for the markdown export)
// We track these across drills in the session so the export has detail.
let drillCardLogs = {};

// ===================================================================
// PICKER
// ===================================================================
function renderPicker() {
  ['A', 'B', 'C', 'D', 'E'].forEach(cat => {
    const row = document.getElementById('chip-row-' + cat);
    if (!row) return;
    row.innerHTML = '';
    const chips = getChipsByCategory(cat);
    chips.forEach(chip => {
      const btn = document.createElement('button');
      btn.className = 'ice-chip' + (cat !== 'A' ? ' cat-' + cat + '-chip' : '');
      btn.textContent = chip.label;
      btn.onclick = () => onChipTap(chip);
      row.appendChild(btn);
    });
  });
  updateProspectTypeUI();
  renderPickerBanner();
}

function renderPickerBanner() {
  const banner = document.getElementById('call-start-banner');
  if (!banner) return;
  if (SessionState.getClearedCount() > 0) {
    let html = CardRenderer.renderSessionBreadcrumb(SessionState);
    html += '<div class="card card-call-continue">';
    html += '<div class="card-tag tag-purple">📞 Continuing this call</div>';
    html += '<div class="card-title">Type ' + SessionState.getProspectType() + ' prospect · session in progress</div>';
    if (SessionState.isScoopGateUnlocked() || SessionState.isOverridden()) {
      html += '<div class="card-subtitle"><strong>Scoop gate unlocked.</strong> When you tap a chip, finish that drill, then SCOOP from the sweep card. Or tap "Scoop now" below to scoop without another excuse.</div>';
      html += '<div class="card-action-row">';
      html += '<button class="card-btn primary" onclick="DrillFlow.advanceToScoopFromPicker()">🎯 Scoop now (skip more excuses)</button>';
      html += '</div>';
    } else {
      html += '<div class="card-subtitle">Tap the next excuse the prospect raised. Scoop unlocks after 2 cleared.</div>';
    }
    html += '</div>';
    banner.innerHTML = html;
  } else {
    banner.innerHTML = CardRenderer.renderCallStartCard(SessionState.getProspectType());
  }
}

function updateProspectTypeUI() {
  const toggle = document.getElementById('prospect-type-toggle');
  const type = SessionState.getProspectType();
  if (toggle) {
    toggle.textContent = 'Type ' + type;
    toggle.className = 'prospect-toggle type-' + type.toLowerCase();
  }
}

function toggleProspectType() {
  const current = SessionState.getProspectType();
  SessionState.setProspectType(current === 'A' ? 'B' : 'A');
  updateProspectTypeUI();
  renderPickerBanner();
  triggerAutoSave();
}

// ===================================================================
// AUTOSAVE TRIGGER (called at significant events)
// ===================================================================
function triggerAutoSave() {
  try {
    SessionSave.autoSave(SessionState, DrillState);
  } catch (err) {
    console.warn('Autosave failed:', err);
  }
}

// Capture into per-chip card log so the .md export has detail
function appendToDrillLog(chipId, cardType, data) {
  if (!chipId) return;
  if (!drillCardLogs[chipId]) drillCardLogs[chipId] = [];
  drillCardLogs[chipId].push({
    type: cardType,
    data: data,
    timestamp: new Date().toISOString()
  });
}

// ===================================================================
// CHIP TAP — START DRILL
// ===================================================================
async function onChipTap(chip) {
  showStage(STAGE_DRILL);
  const drillContent = document.getElementById('drill-stack');
  drillContent.innerHTML = '<div class="card card-loading">Loading ' + chip.label + '...</div>';
  scrollTop();

  try {
    const resp = await fetch('lexicon/' + chip.file);
    if (!resp.ok) throw new Error('Failed to fetch lexicon file: HTTP ' + resp.status);
    const md = await resp.text();
    const parsed = LexiconParser.parse(md, chip.file);

    DrillState.init(chip, parsed, SessionState.getProspectType());

    drillContent.innerHTML = '';
    const breadcrumb = CardRenderer.renderSessionBreadcrumb(SessionState);
    if (breadcrumb) drillContent.insertAdjacentHTML('beforeend', breadcrumb);
    appendCard(CardRenderer.renderLayer1Card(parsed, chip.label));
    DrillState.logCard('layer1', { excuse: chip.id });
    DrillState.setStage('layer1');
    appendToDrillLog(chip.id, 'layer1', { excuse: chip.id });
    triggerAutoSave();
  } catch (err) {
    drillContent.innerHTML = '<div class="card card-error">⚠️ Error loading ' + chip.file + ': ' + escapeHtml(err.message) + '</div>';
  }
}

// ===================================================================
// DRILL FLOW
// ===================================================================
const DrillFlow = {

  advanceToScriptSelect() {
    const state = DrillState.getState();
    if (!state) return;
    appendCard(CardRenderer.renderScriptSelectCard(state.lexicon));
    DrillState.setStage('script-select');
    scrollToBottom();
  },

  selectScriptLetter(letter) {
    const state = DrillState.getState();
    if (!state) return;
    DrillState.recordScriptLetter(letter);
    appendCard(CardRenderer.renderScriptQuestionCard(state.lexicon, letter));
    DrillState.setStage('script-question');
    appendToDrillLog(state.chip.id, 'script-question', { letter: letter });
    scrollToBottom();
  },

  askedScriptQuestion() {
    const state = DrillState.getState();
    if (!state) return;
    const response = ProspectEngine.pickResponse(
      state.lexicon,
      state.prospectType,
      state.choices.prospectSamplesUsed
    );
    if (response && response.sampleIndex >= 0) {
      DrillState.recordProspectSample(response.sampleIndex);
    }
    appendCard(CardRenderer.renderProspectResponseCard(response, state.prospectType));
    DrillState.setStage('prospect-response');
    appendToDrillLog(state.chip.id, 'prospect-response', { response: response });
    scrollToBottom();
  },

  skipScriptQuestion() {
    const state = DrillState.getState();
    if (!state) return;
    appendCard(CardRenderer.renderScriptSelectCard(state.lexicon));
    DrillState.setStage('script-select');
    scrollToBottom();
  },

  tryAnotherScriptLetter() {
    const state = DrillState.getState();
    if (!state) return;
    appendCard(CardRenderer.renderScriptSelectCard(state.lexicon));
    DrillState.setStage('script-select');
    scrollToBottom();
  },

  advanceToPathDiagnosis() {
    const state = DrillState.getState();
    if (!state) return;
    appendCard(CardRenderer.renderPathDiagnosisCard(state.lexicon));
    DrillState.setStage('path-diagnosis');
    scrollToBottom();
  },

  pickPath(pathLabel) {
    const state = DrillState.getState();
    if (!state) return;
    DrillState.recordPath(pathLabel);
    const path = DrillState.getCurrentPath();
    if (!path) return;
    appendCard(CardRenderer.renderReframeCard(path));
    DrillState.setStage('reframe');
    appendToDrillLog(state.chip.id, 'path', { path: pathLabel });
    scrollToBottom();
  },

  advanceToAnalogy() {
    const state = DrillState.getState();
    if (!state) return;
    const path = DrillState.getCurrentPath();
    if (!path) return;
    appendCard(CardRenderer.renderAnalogyCard(path));
    DrillState.setStage('analogy-select');
    scrollToBottom();
  },

  pickAnalogy(analogyNumber) {
    const state = DrillState.getState();
    if (!state) return;
    DrillState.recordAnalogy(analogyNumber);
    const analogy = DrillState.getCurrentAnalogy();
    if (!analogy) return;
    appendCard(CardRenderer.renderAnalogyDisplayCard(analogy));
    DrillState.setStage('analogy-show');
    appendToDrillLog(state.chip.id, 'analogy', { analogy: analogyNumber });
    scrollToBottom();
  },

  pickDifferentAnalogy() {
    const state = DrillState.getState();
    if (!state) return;
    const path = DrillState.getCurrentPath();
    appendCard(CardRenderer.renderAnalogyCard(path));
    DrillState.setStage('analogy-select');
    scrollToBottom();
  },

  skipAnalogyToConcession() {
    appendCard(CardRenderer.renderConcessionCard());
    DrillState.setStage('concession');
    scrollToBottom();
  },

  advanceToConcession() {
    appendCard(CardRenderer.renderConcessionCard());
    DrillState.setStage('concession');
    scrollToBottom();
  },

  markConcession(verdict) {
    const state = DrillState.getState();
    if (!state) return;
    DrillState.recordConcession(verdict);
    appendToDrillLog(state.chip.id, 'concession', { verdict: verdict });

    if (verdict === 'yes') {
      SessionState.recordExcuseCleared(
        state.chip,
        DrillState.getCurrentPath(),
        state.choices.analogyChosen,
        verdict
      );
      appendCard(CardRenderer.renderSweepCard(state.lexicon, SessionState));
      DrillState.setStage('sweep');
      triggerAutoSave();  // Significant event
    } else {
      appendCard(CardRenderer.renderResistanceCard(verdict));
      DrillState.setStage('resistance');
    }
    scrollToBottom();
  },

  tryDifferentAnalogyOnSamePath() {
    const state = DrillState.getState();
    if (!state) return;
    const path = DrillState.getCurrentPath();
    appendCard(CardRenderer.renderAnalogyCard(path));
    DrillState.setStage('analogy-select');
    scrollToBottom();
  },

  rediagnosePath() {
    const state = DrillState.getState();
    if (!state) return;
    appendCard(CardRenderer.renderPathDiagnosisCard(state.lexicon));
    DrillState.setStage('path-diagnosis');
    scrollToBottom();
  },

  sweepAnyway() {
    const state = DrillState.getState();
    if (!state) return;
    appendCard(CardRenderer.renderSweepCard(state.lexicon, SessionState));
    DrillState.setStage('sweep');
    scrollToBottom();
  },

  // ===== SCOOP FLOW =====

  advanceToScoop() {
    const state = DrillState.getState();
    if (!state) return;
    appendCard(CardRenderer.renderScoopDeployCard(state.lexicon, SessionState));
    DrillState.setStage('scoop-deploy');
    scrollToBottom();
  },

  scoopOverride() {
    SessionState.setScoopOverride();
    const state = DrillState.getState();
    if (!state) return;
    appendCard(CardRenderer.renderSweepCard(state.lexicon, SessionState));
    triggerAutoSave();
    scrollToBottom();
  },

  async advanceToScoopFromPicker() {
    const cleared = SessionState.getClearedExcuses();
    if (cleared.length === 0 && !SessionState.isOverridden()) {
      alert('No excuses cleared yet. Sweep first or override the gate.');
      return;
    }
    let file = '01-time.md';
    if (cleared.length > 0) {
      const lastChip = getChipById(cleared[cleared.length - 1].chipId);
      if (lastChip) file = lastChip.file;
    }

    showStage(STAGE_DRILL);
    const drillContent = document.getElementById('drill-stack');
    drillContent.innerHTML = '';
    const breadcrumb = CardRenderer.renderSessionBreadcrumb(SessionState);
    if (breadcrumb) drillContent.insertAdjacentHTML('beforeend', breadcrumb);

    try {
      const resp = await fetch('lexicon/' + file);
      const md = await resp.text();
      const parsed = LexiconParser.parse(md, file);
      const lastChip = cleared.length > 0 ? getChipById(cleared[cleared.length - 1].chipId) : getChipById('time');
      DrillState.init(lastChip, parsed, SessionState.getProspectType());
      appendCard(CardRenderer.renderScoopDeployCard(parsed, SessionState));
      DrillState.setStage('scoop-deploy');
      scrollToBottom();
    } catch (err) {
      drillContent.innerHTML = '<div class="card card-error">⚠️ Failed to load lexicon for scoop: ' + escapeHtml(err.message) + '</div>';
    }
  },

  scoopAsked() {
    SessionState.markScoopDeployed();
    appendCard(CardRenderer.renderSilenceCard());
    DrillState.setStage('scoop-silence');
    triggerAutoSave();
    scrollToBottom();
    // Start the timer AFTER the card is in the DOM
    setTimeout(() => {
      CardRenderer.startSilenceTimer();
    }, 100);
  },

  silenceBroke() {
    const state = DrillState.getState();
    if (!state) return;
    appendCard(CardRenderer.renderNamedFearCard(state.lexicon, SessionState));
    DrillState.setStage('scoop-named-fear');
    triggerAutoSave();
    scrollToBottom();
  },

  // Re-render the named fear card with a different fear pick.
  // We pick a NEW random index that differs from the current one.
  pickAnotherFear() {
    const state = DrillState.getState();
    if (!state) return;
    const current = SessionState.getNamedFear();
    const prospectType = SessionState.getProspectType();
    const fears = prospectType === 'A'
      ? (state.lexicon?.scoop?.typeAFears || [])
      : (state.lexicon?.scoop?.typeBFears || []);
    const total = fears.length > 0 ? fears.length : 5;  // 5 generic fallbacks
    // Pick a different index than current
    let newIdx;
    if (total <= 1) {
      newIdx = 0;
    } else {
      do { newIdx = Math.floor(Math.random() * total); } while (newIdx === (current ? current.index : -1));
    }
    // Remove the existing named-fear card and replace with new one
    const stack = document.getElementById('drill-stack');
    if (!stack) return;
    const existing = stack.querySelector('.card-named-fear');
    if (existing) existing.remove();
    appendCard(CardRenderer.renderNamedFearCard(state.lexicon, SessionState, newIdx));
    scrollToBottom();
  },

  advanceToAhaCheck() {
    const state = DrillState.getState();
    if (!state) return;
    appendCard(CardRenderer.renderAhaCheckCard(state.lexicon));
    DrillState.setStage('scoop-aha-check');
    scrollToBottom();
  },

  markAha(type) {
    SessionState.recordAhaType(type);
    const state = DrillState.getState();
    if (!state) return;
    if (type === 'somatic') {
      appendCard(CardRenderer.renderStage1CompleteCard(state.lexicon, SessionState));
      DrillState.setStage('stage1-complete');
    } else {
      appendCard(CardRenderer.renderKeepDiggingCard(SessionState));
      DrillState.setStage('scoop-keep-digging');
    }
    triggerAutoSave();
    scrollToBottom();
  },

  // ===== NAVIGATION =====

  backToPicker() {
    DrillState.reset();
    showStage(STAGE_PICK);
    renderPickerBanner();
    scrollTop();
  },

  restartDrill() {
    const state = DrillState.getState();
    if (!state) return;
    const chip = state.chip;
    onChipTap(chip);
  },

  fullSessionReset() {
    if (confirm('End this call and start a new one? Your current session data will be archived to history; in-progress data will be cleared.')) {
      // Archive before reset
      try {
        SessionSave.archiveCompletedSession(SessionState);
      } catch (err) {
        console.warn('Archive failed:', err);
      }
      SessionSave.clearAutoSaved();
      drillCardLogs = {};
      DrillState.reset();
      SessionState.reset();
      SessionState.init('A');
      showStage(STAGE_PICK);
      renderPickerBanner();
      scrollTop();
    }
  }
};

// ===================================================================
// SESSION SAVE — UI handlers
// ===================================================================
async function exportSessionAsMarkdown() {
  if (!SessionState.get() || SessionState.getClearedCount() === 0) {
    alert('No session data to export yet. Clear at least one excuse first.');
    return;
  }
  try {
    const result = await SessionSave.exportAsMarkdown(SessionState, drillCardLogs);
    if (result.cancelled) {
      showToast('Save cancelled');
      return;
    }
    if (result.method === 'failed') {
      alert('Save failed: ' + (result.error || 'unknown error'));
      return;
    }
    let msg = '';
    if (result.method === 'share-api') {
      msg = '📁 ' + result.filename + ' — saved via share sheet';
    } else if (result.method === 'blob-download') {
      msg = '📁 Downloaded: ' + result.filename;
    } else if (result.method === 'data-uri-fallback') {
      msg = '📁 Opened in new tab — long-press to save';
    } else {
      msg = '📁 ' + result.filename;
    }
    showToast(msg);
  } catch (err) {
    alert('Export failed: ' + err.message);
  }
}

function showToast(message) {
  const existing = document.getElementById('toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.id = 'toast';
  toast.textContent = message;
  toast.style.cssText = 'position:fixed;bottom:30px;left:50%;transform:translateX(-50%);background:#14532D;color:#FFFFFF;padding:14px 20px;border-radius:10px;font-size:14px;font-weight:600;z-index:9999;border:2px solid #4ADE80;box-shadow:0 4px 16px rgba(0,0,0,0.5);max-width:90%;text-align:center;';
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4500);
}

// ===================================================================
// RESTORE ON LOAD
// ===================================================================
function tryRestoreSession() {
  if (!SessionSave.hasAutoSaved()) return false;
  const snapshot = SessionSave.loadAutoSaved();
  if (!snapshot || !snapshot.session) return false;

  // Only restore if it has at least 1 cleared excuse — otherwise pointless
  if (!snapshot.session.excusesCleared || snapshot.session.excusesCleared.length === 0) {
    SessionSave.clearAutoSaved();
    return false;
  }

  // Ask user
  const summary = snapshot.session.excusesCleared.map(e => e.chipLabel).join(', ');
  const ageMin = Math.round((Date.now() - new Date(snapshot.savedAt).getTime()) / 60000);
  const restoreMsg = `Resume the previous session?\n\nLast saved ${ageMin} min ago.\nType ${snapshot.session.prospectType} · Cleared: ${summary}\n\nTap OK to restore, Cancel to start fresh.`;
  if (!confirm(restoreMsg)) {
    SessionSave.clearAutoSaved();
    return false;
  }

  // Reconstruct session state
  SessionState.init(snapshot.session.prospectType);
  const restored = SessionState.get();
  // Replay cleared excuses
  snapshot.session.excusesCleared.forEach(ex => {
    const chip = getChipById(ex.chipId);
    if (chip) {
      SessionState.recordExcuseCleared(
        chip,
        ex.pathLabel ? { label: ex.pathLabel } : null,
        ex.analogyNumber,
        ex.concession
      );
    }
  });
  if (snapshot.session.scoopOverride) SessionState.setScoopOverride();
  if (snapshot.session.scoopDeployed) SessionState.markScoopDeployed();
  if (snapshot.session.namedFear) {
    SessionState.recordNamedFear(
      snapshot.session.namedFear.text,
      snapshot.session.namedFear.index,
      snapshot.session.namedFear.type
    );
  }
  if (snapshot.session.ahaType) SessionState.recordAhaType(snapshot.session.ahaType);

  return true;
}

// ===================================================================
// UTILITIES
// ===================================================================
function appendCard(html) {
  const stack = document.getElementById('drill-stack');
  if (stack) stack.insertAdjacentHTML('beforeend', html);
}

function scrollToBottom() {
  setTimeout(() => {
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  }, 50);
}

function scrollTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showStage(id) {
  document.querySelectorAll('.stage').forEach(s => s.classList.remove('active'));
  const stage = document.getElementById(id);
  if (stage) stage.classList.add('active');
}

function escapeHtml(text) {
  if (text == null) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function resetAll() {
  DrillFlow.fullSessionReset();
}

// Expose for inline onclick handlers
window.DrillFlow = DrillFlow;
window.resetAll = resetAll;
window.toggleProspectType = toggleProspectType;
window.exportSessionAsMarkdown = exportSessionAsMarkdown;

// Init
function initApp() {
  if (!SessionState.get()) {
    SessionState.init('A');
  }
  // Try to restore previous session
  tryRestoreSession();
  renderPicker();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

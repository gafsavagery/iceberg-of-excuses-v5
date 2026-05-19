// ===================================================================
// APP — main wiring for Phase 1B + Scoop
// ===================================================================
// Coordinates: session → picker → drill stages → sweep → scoop → fear
//
// Key changes from earlier 1B:
// - SessionState persists across drills (back-to-picker does NOT reset session)
// - Sweep card is scoop-aware (offers scoop when gate unlocked)
// - Scoop flow added: deploy → silence → named fear → aha check → stage 1 complete
// ===================================================================

const STAGE_PICK = 'stage-pick';
const STAGE_DRILL = 'stage-drill';

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
  // If session has cleared excuses, show breadcrumb instead of fresh call-start banner
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
    // Session breadcrumb above the drill if anything was cleared previously
    const breadcrumb = CardRenderer.renderSessionBreadcrumb(SessionState);
    if (breadcrumb) drillContent.insertAdjacentHTML('beforeend', breadcrumb);
    appendCard(CardRenderer.renderLayer1Card(parsed, chip.label));
    DrillState.logCard('layer1', { excuse: chip.id });
    DrillState.setStage('layer1');
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

    if (verdict === 'yes') {
      // Record this excuse as cleared in the SESSION
      SessionState.recordExcuseCleared(
        state.chip,
        DrillState.getCurrentPath(),
        state.choices.analogyChosen,
        verdict
      );
      appendCard(CardRenderer.renderSweepCard(state.lexicon, SessionState));
      DrillState.setStage('sweep');
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
    // Note: did NOT record as cleared since they didn't concede.
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
    // Re-render the sweep card to reflect override
    const state = DrillState.getState();
    if (!state) return;
    appendCard(CardRenderer.renderSweepCard(state.lexicon, SessionState));
    scrollToBottom();
  },

  // Called from picker banner when user wants to scoop without a fresh drill
  async advanceToScoopFromPicker() {
    // We need a parsed lexicon — use the last cleared excuse's file
    const cleared = SessionState.getClearedExcuses();
    if (cleared.length === 0 && !SessionState.isOverridden()) {
      alert('No excuses cleared yet. Sweep first or override the gate.');
      return;
    }
    // Pick lexicon from most recent cleared excuse, or fall back to time.md
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

      // Use a phantom drill state so DrillFlow.* methods work
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
    scrollToBottom();
  },

  silenceBroke() {
    const state = DrillState.getState();
    if (!state) return;
    appendCard(CardRenderer.renderNamedFearCard(state.lexicon, SessionState));
    DrillState.setStage('scoop-named-fear');
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
    scrollToBottom();
  },

  // ===== NAVIGATION =====

  backToPicker() {
    // Session persists. Only DrillState resets per chip.
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
    if (confirm('End this call and start a new one? Session data will be cleared.')) {
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

// Expose for onclick handlers
window.DrillFlow = DrillFlow;
window.resetAll = resetAll;
window.toggleProspectType = toggleProspectType;

// Init
function initApp() {
  // Start a new session if none exists
  if (!SessionState.get()) {
    SessionState.init('A');
  }
  renderPicker();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

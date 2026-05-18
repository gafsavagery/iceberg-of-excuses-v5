// ===================================================================
// APP — main wiring for Phase 1B
// ===================================================================
// Coordinates: picker → call start → chip-tap → drill stages
//
// Drill flow stages handled here by DrillFlow:
//   layer1 → script-select → script-question → prospect-response
//   → path-diagnosis → reframe → analogy-select → analogy-show
//   → concession → sweep
// ===================================================================

const STAGE_PICK = 'stage-pick';
const STAGE_DRILL = 'stage-drill';

// Prospect type — defaults to A, toggleable in header
let prospectType = 'A';

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
  renderCallStartBanner();
}

function renderCallStartBanner() {
  const banner = document.getElementById('call-start-banner');
  if (!banner) return;
  banner.innerHTML = CardRenderer.renderCallStartCard(prospectType);
}

function updateProspectTypeUI() {
  const toggle = document.getElementById('prospect-type-toggle');
  if (toggle) {
    toggle.textContent = 'Type ' + prospectType;
    toggle.className = 'prospect-toggle type-' + prospectType.toLowerCase();
  }
}

function toggleProspectType() {
  prospectType = (prospectType === 'A') ? 'B' : 'A';
  updateProspectTypeUI();
  renderCallStartBanner();
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
    if (!resp.ok) {
      throw new Error('Failed to fetch lexicon file: HTTP ' + resp.status);
    }
    const md = await resp.text();
    const parsed = LexiconParser.parse(md, chip.file);

    // Init drill state
    DrillState.init(chip, parsed, prospectType);

    // Clear loading, render first card (Layer 1)
    drillContent.innerHTML = '';
    appendCard(CardRenderer.renderLayer1Card(parsed, chip.label));
    DrillState.logCard('layer1', { excuse: chip.id });
    DrillState.setStage('layer1');
  } catch (err) {
    drillContent.innerHTML = '<div class="card card-error">⚠️ Error loading ' + chip.file + ': ' + escapeHtml(err.message) + '</div>';
  }
}

// ===================================================================
// DRILL FLOW — exposed via window.DrillFlow for onclick handlers
// ===================================================================
const DrillFlow = {

  advanceToScriptSelect() {
    const state = DrillState.getState();
    if (!state) return;
    appendCard(CardRenderer.renderScriptSelectCard(state.lexicon));
    DrillState.setStage('script-select');
    DrillState.logCard('script-select', {});
    scrollToBottom();
  },

  selectScriptLetter(letter) {
    const state = DrillState.getState();
    if (!state) return;
    DrillState.recordScriptLetter(letter);
    appendCard(CardRenderer.renderScriptQuestionCard(state.lexicon, letter));
    DrillState.setStage('script-question');
    DrillState.logCard('script-question', { letter: letter });
    scrollToBottom();
  },

  askedScriptQuestion() {
    const state = DrillState.getState();
    if (!state) return;
    // Generate a prospect response
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
    DrillState.logCard('prospect-response', { response: response });
    scrollToBottom();
  },

  skipScriptQuestion() {
    // Render another script select card so closer can pick a different letter
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
    DrillState.logCard('path-diagnosis', {});
    scrollToBottom();
  },

  pickPath(pathLabel) {
    const state = DrillState.getState();
    if (!state) return;
    DrillState.recordPath(pathLabel);
    const path = DrillState.getCurrentPath();
    if (!path) {
      console.error('Path not found:', pathLabel);
      return;
    }
    appendCard(CardRenderer.renderReframeCard(path));
    DrillState.setStage('reframe');
    DrillState.logCard('reframe', { path: pathLabel });
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
    DrillState.logCard('analogy-show', { analogy: analogyNumber });
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
    DrillState.logCard('concession', { verdict: verdict });

    if (verdict === 'yes') {
      // Advance to sweep
      appendCard(CardRenderer.renderSweepCard(state.lexicon));
      DrillState.setStage('sweep');
    } else {
      // Show resistance handling card
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
    appendCard(CardRenderer.renderSweepCard(state.lexicon));
    DrillState.setStage('sweep');
    scrollToBottom();
  },

  backToPicker() {
    DrillState.reset();
    showStage(STAGE_PICK);
    scrollTop();
  },

  restartDrill() {
    const state = DrillState.getState();
    if (!state) return;
    const chip = state.chip;
    onChipTap(chip);
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
  DrillState.reset();
  showStage(STAGE_PICK);
  scrollTop();
}

// Expose for onclick handlers
window.DrillFlow = DrillFlow;
window.resetAll = resetAll;
window.toggleProspectType = toggleProspectType;

// Init
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', renderPicker);
} else {
  renderPicker();
}

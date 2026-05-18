// ===================================================================
// DRILL STATE
// ===================================================================
// Tracks the state of a single excuse drill from chip-tap to sweep.
//
// Stages:
//   1. layer1            - showing the Layer 1 phrasings card
//   2. script-select     - choosing which SCRIPT letter to deploy
//   3. script-question   - showing the verbatim question for the chosen letter
//   4. prospect-response - showing the prospect's reaction
//   5. path-diagnosis    - choosing Path A/B/C/Type1/etc
//   6. reframe           - showing reframe questions for the diagnosed path
//   7. analogy-select    - choosing which analogy to deploy
//   8. analogy-show      - displaying the chosen analogy with required question
//   9. concession        - did the prospect concede?
//   10. sweep            - sweep transition to next excuse
//
// Each transition is logged so the closer can review their drill.
// ===================================================================

const DrillState = (function() {

  let state = null;

  function init(chip, parsedLexicon, prospectType) {
    state = {
      chip: chip,
      lexicon: parsedLexicon,
      prospectType: prospectType,  // 'A' or 'B'
      stage: 'layer1',
      cards: [],                    // Ordered list of cards shown
      choices: {
        scriptLettersDeployed: [],  // Which letters were used
        prospectSamplesUsed: [],    // Indexes of samples shown (so we don't repeat)
        pathDiagnosed: null,        // 'PATH A' | 'PATH B' | 'PATH C' | 'TYPE 1' etc
        analogyChosen: null,        // analogy number
        concession: null            // 'yes' | 'partial' | 'no'
      },
      startedAt: new Date().toISOString()
    };
    return state;
  }

  function getState() { return state; }
  function setStage(stage) { if (state) state.stage = stage; }
  function getStage() { return state ? state.stage : null; }

  function logCard(cardType, cardData) {
    if (!state) return;
    state.cards.push({
      type: cardType,
      data: cardData,
      timestamp: new Date().toISOString()
    });
  }

  function recordScriptLetter(letter) {
    if (!state) return;
    if (!state.choices.scriptLettersDeployed.includes(letter)) {
      state.choices.scriptLettersDeployed.push(letter);
    }
  }

  function recordProspectSample(sampleIndex) {
    if (!state || sampleIndex < 0) return;
    if (!state.choices.prospectSamplesUsed.includes(sampleIndex)) {
      state.choices.prospectSamplesUsed.push(sampleIndex);
    }
  }

  function recordPath(pathLabel) {
    if (!state) return;
    state.choices.pathDiagnosed = pathLabel;
  }

  function recordAnalogy(analogyNumber) {
    if (!state) return;
    state.choices.analogyChosen = analogyNumber;
  }

  function recordConcession(verdict) {
    if (!state) return;
    state.choices.concession = verdict;
  }

  function reset() {
    state = null;
  }

  function getCurrentPath() {
    if (!state || !state.choices.pathDiagnosed || !state.lexicon.paths) return null;
    return state.lexicon.paths.find(p => p.label === state.choices.pathDiagnosed);
  }

  function getCurrentAnalogy() {
    const path = getCurrentPath();
    if (!path || state.choices.analogyChosen === null) return null;
    return path.analogies.find(a => a.number === state.choices.analogyChosen);
  }

  return {
    init,
    getState,
    setStage,
    getStage,
    logCard,
    recordScriptLetter,
    recordProspectSample,
    recordPath,
    recordAnalogy,
    recordConcession,
    reset,
    getCurrentPath,
    getCurrentAnalogy
  };
})();

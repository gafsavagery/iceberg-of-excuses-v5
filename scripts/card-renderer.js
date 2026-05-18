// ===================================================================
// CARD RENDERER
// ===================================================================
// Renders each card type for the drill flow. Each function returns an
// HTML string that gets appended to the drill stack.
//
// Cards are stacked in scroll order. As the closer progresses, new
// cards append below; old cards stay visible for review.
// ===================================================================

const CardRenderer = (function() {

  // Utility: HTML-escape any user-visible content
  function esc(text) {
    if (text == null) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Utility: light markdown rendering (bold, italic, blockquotes) for setup text
  function mdLite(text) {
    if (!text) return '';
    let h = esc(text);
    h = h.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    h = h.replace(/(^|[^*])\*([^*\n]+)\*([^*]|$)/g, '$1<em>$2</em>$3');
    h = h.replace(/^&gt;\s+(.+)$/gm, '<blockquote class="card-blockquote">$1</blockquote>');
    return h.replace(/\n/g, '<br>');
  }

  // =================================================================
  // CARD 1 — LAYER 1 STATEMENT CARD
  // =================================================================
  // Shows the surface excuse phrasings.
  function renderLayer1Card(parsed, chipLabel) {
    const layer1 = parsed.layer1;
    let html = '<div class="card card-layer1" id="card-layer1">';
    html += '<div class="card-tag tag-red">🔴 Layer 1 · Surface excuse</div>';
    html += '<div class="card-title">' + esc(chipLabel) + '</div>';
    html += '<div class="card-subtitle">Past + present phrasings — use whichever matches what the prospect said.</div>';

    if (layer1 && layer1.past && layer1.past.length) {
      html += '<div class="card-section-label">Past-tense phrasings</div>';
      html += '<ul class="card-list">';
      layer1.past.forEach(p => html += '<li>' + esc(p) + '</li>');
      html += '</ul>';
    }
    if (layer1 && layer1.present && layer1.present.length) {
      html += '<div class="card-section-label">Present-tense phrasings</div>';
      html += '<ul class="card-list">';
      layer1.present.forEach(p => html += '<li>' + esc(p) + '</li>');
      html += '</ul>';
    }

    // Critical framing if present (collapsed by default)
    if (parsed.criticalFraming) {
      html += '<details class="card-details">';
      html += '<summary>⚠️ Critical framing note (closer reminder)</summary>';
      html += '<div class="card-details-body">' + mdLite(parsed.criticalFraming) + '</div>';
      html += '</details>';
    }

    html += '<div class="card-action-row">';
    html += '<button class="card-btn primary" onclick="DrillFlow.advanceToScriptSelect()">Got it → choose SCRIPT letter ▼</button>';
    html += '</div>';
    html += '</div>';
    return html;
  }

  // =================================================================
  // CARD 2 — SCRIPT SELECTION CARD
  // =================================================================
  function renderScriptSelectCard(parsed) {
    const script = parsed.script;
    const primary = script.primaryLetters || [];
    const lettersInFile = script.letters ? Object.keys(script.letters) : [];

    let html = '<div class="card card-script-select" id="card-script-' + Date.now() + '">';
    html += '<div class="card-tag tag-green">🟢 SCRIPT · clarity questions</div>';
    html += '<div class="card-title">Choose which letter to deploy</div>';
    html += '<div class="card-subtitle">Primary letters for this excuse are highlighted. S leads always. Deploy minimum needed — over-questioning breaks rapport.</div>';

    html += '<div class="script-grid">';
    ['S', 'C', 'R', 'I', 'P', 'T'].forEach(letter => {
      const inFile = lettersInFile.includes(letter);
      const isPrimary = primary.includes(letter);
      const name = {
        S: 'Specifically', C: 'Compared to what', R: 'Roots',
        I: 'Involved', P: 'Point in time', T: 'Tell me the story'
      }[letter];
      let cls = 'script-letter-btn';
      if (isPrimary) cls += ' primary';
      if (!inFile) cls += ' unavailable';

      const disabledAttr = inFile ? '' : 'disabled';
      const onclick = inFile ? `onclick="DrillFlow.selectScriptLetter('${letter}')"` : '';
      html += '<button class="' + cls + '" ' + onclick + ' ' + disabledAttr + '>';
      html += '<div class="script-letter">' + letter + '</div>';
      html += '<div class="script-letter-name">' + name + '</div>';
      if (isPrimary) html += '<div class="script-letter-badge">PRIMARY</div>';
      html += '</button>';
    });
    html += '</div>';
    html += '</div>';
    return html;
  }

  // =================================================================
  // CARD 3 — SCRIPT QUESTION CARD
  // =================================================================
  function renderScriptQuestionCard(parsed, letterKey) {
    const letterData = parsed.script.letters[letterKey];
    if (!letterData) return '';

    let html = '<div class="card card-script-q" id="card-scriptq-' + letterKey + '-' + Date.now() + '">';
    html += '<div class="card-tag tag-green">🟢 ' + letterKey + ' — ' + esc(letterData.rawHeader.replace(/^[SCRIPT]\s*[—–-]\s*/i, '')) + '</div>';
    html += '<div class="card-title">Ask this question</div>';

    if (letterData.past) {
      html += '<div class="card-section-label">Past-tense version</div>';
      html += '<blockquote class="card-script-question">' + esc(letterData.past) + '</blockquote>';
    }
    if (letterData.present) {
      html += '<div class="card-section-label">Present-tense version</div>';
      html += '<blockquote class="card-script-question">' + esc(letterData.present) + '</blockquote>';
    }
    if (letterData.either) {
      html += '<div class="card-section-label">Use either tense</div>';
      html += '<blockquote class="card-script-question">' + esc(letterData.either) + '</blockquote>';
    }

    if (letterData.listenFor) {
      html += '<div class="card-section-label">What you\'re listening for</div>';
      html += '<div class="card-listen-for">' + esc(letterData.listenFor) + '</div>';
    }

    html += '<div class="card-action-row">';
    html += '<button class="card-btn primary" onclick="DrillFlow.askedScriptQuestion()">Asked it → see prospect response ▼</button>';
    html += '<button class="card-btn secondary" onclick="DrillFlow.skipScriptQuestion()">Skip & try different letter</button>';
    html += '</div>';
    html += '</div>';
    return html;
  }

  // =================================================================
  // CARD 4 — PROSPECT RESPONSE CARD
  // =================================================================
  function renderProspectResponseCard(response, prospectType) {
    let html = '<div class="card card-prospect" id="card-prospect-' + Date.now() + '">';
    html += '<div class="card-tag tag-prospect">👤 Prospect (Type ' + prospectType + ')</div>';
    if (response.isRepeat) {
      html += '<div class="card-tag tag-warn">↻ You\'ve heard this sample before</div>';
    }
    if (response.isFallback) {
      html += '<div class="card-tag tag-warn">⚠ Fallback: no clean samples in file</div>';
    }

    html += '<blockquote class="card-prospect-quote">' + mdLite(response.text) + '</blockquote>';
    if (!response.isFallback && response.totalSamples) {
      html += '<div class="card-meta">Sample ' + (response.sampleIndex + 1) + ' of ' + response.totalSamples + ' from this Type ' + prospectType + ' variation</div>';
    }

    html += '<div class="card-action-row">';
    html += '<button class="card-btn primary" onclick="DrillFlow.advanceToPathDiagnosis()">Continue → diagnose path ▼</button>';
    html += '<button class="card-btn secondary" onclick="DrillFlow.tryAnotherScriptLetter()">Try another SCRIPT letter first</button>';
    html += '</div>';
    html += '</div>';
    return html;
  }

  // =================================================================
  // CARD 5 — PATH DIAGNOSIS CARD
  // =================================================================
  function renderPathDiagnosisCard(parsed) {
    if (!parsed.paths || parsed.paths.length === 0) return '';

    let html = '<div class="card card-path-diag" id="card-pathdiag-' + Date.now() + '">';
    html += '<div class="card-tag tag-blue">🔵 Diagnose · path A/B/C</div>';
    html += '<div class="card-title">Which path does the prospect\'s answer fit?</div>';
    html += '<div class="card-subtitle">Read the criteria. Pick the path that matches. (Wrong picks will produce resistance — that\'s feedback, not failure.)</div>';

    parsed.paths.forEach(p => {
      html += '<div class="path-option">';
      html += '<div class="path-option-header">' + esc(p.label) + '</div>';
      if (p.description) {
        html += '<div class="path-option-desc">' + mdLite(p.description) + '</div>';
      }
      if (p.recognition && p.recognition.length) {
        html += '<div class="path-option-sublabel">How to recognize:</div>';
        html += '<ul class="path-option-list">';
        p.recognition.forEach(r => html += '<li>' + esc(r) + '</li>');
        html += '</ul>';
      }
      html += '<button class="card-btn primary path-pick-btn" onclick="DrillFlow.pickPath(' + JSON.stringify(p.label).replace(/"/g, '&quot;') + ')">Pick this path →</button>';
      html += '</div>';
    });
    html += '</div>';
    return html;
  }

  // =================================================================
  // CARD 6 — REFRAME QUESTION CARD
  // =================================================================
  function renderReframeCard(path) {
    if (!path) return '';

    let html = '<div class="card card-reframe" id="card-reframe-' + Date.now() + '">';
    html += '<div class="card-tag tag-green">🟢 Reframe · ' + esc(path.label) + '</div>';
    html += '<div class="card-title">Reframe questions for this path</div>';

    if (path.followups && path.followups.length) {
      html += '<div class="card-section-label">First, confirm the diagnosis (follow-up questions):</div>';
      html += '<ul class="card-list">';
      path.followups.forEach(f => html += '<li>' + esc(f) + '</li>');
      html += '</ul>';
    }

    if (path.reframeQs && path.reframeQs.length) {
      html += '<div class="card-section-label">Then deploy reframe questions (participatory — ask, don\'t lecture):</div>';
      path.reframeQs.forEach(r => {
        html += '<blockquote class="card-reframe-q">' + esc(r) + '</blockquote>';
      });
    }

    if (path.analogies && path.analogies.length) {
      html += '<div class="card-action-row">';
      html += '<button class="card-btn primary" onclick="DrillFlow.advanceToAnalogy()">Choose an analogy ▼</button>';
      html += '<button class="card-btn secondary" onclick="DrillFlow.skipAnalogyToConcession()">Skip analogy → check concession</button>';
      html += '</div>';
    } else {
      html += '<div class="card-action-row">';
      html += '<button class="card-btn primary" onclick="DrillFlow.skipAnalogyToConcession()">Continue → check concession ▼</button>';
      html += '</div>';
    }

    html += '</div>';
    return html;
  }

  // =================================================================
  // CARD 7 — ANALOGY SELECTION CARD
  // =================================================================
  function renderAnalogyCard(path) {
    if (!path || !path.analogies || path.analogies.length === 0) return '';

    let html = '<div class="card card-analogy-select" id="card-analogy-' + Date.now() + '">';
    html += '<div class="card-tag tag-green">🎯 Analogies · ' + esc(path.label) + '</div>';
    html += '<div class="card-title">Pick an analogy to deploy</div>';
    html += '<div class="card-subtitle">Higher-graded analogies land harder for your ICP. Tap to see the setup + required question.</div>';

    path.analogies.forEach(a => {
      html += '<div class="analogy-option">';
      html += '<div class="analogy-option-header">';
      html += '<span class="analogy-num">#' + esc(a.number) + '</span>';
      html += '<span class="analogy-title">' + esc(a.title) + '</span>';
      html += '<span class="analogy-grade">' + esc(a.grade) + '</span>';
      html += '</div>';
      html += '<button class="card-btn primary analogy-pick-btn" onclick="DrillFlow.pickAnalogy(' + JSON.stringify(a.number).replace(/"/g, '&quot;') + ')">Deploy this →</button>';
      html += '</div>';
    });
    html += '</div>';
    return html;
  }

  // =================================================================
  // CARD 8 — ANALOGY DISPLAY CARD (with required question highlighted)
  // =================================================================
  function renderAnalogyDisplayCard(analogy) {
    if (!analogy) return '';

    let html = '<div class="card card-analogy-show" id="card-anashow-' + Date.now() + '">';
    html += '<div class="card-tag tag-green">🎯 Analogy #' + esc(analogy.number) + ' — ' + esc(analogy.title) + '</div>';
    html += '<div class="card-grade-display">Grade: ' + esc(analogy.grade) + '</div>';

    if (analogy.setup) {
      html += '<div class="card-section-label">Setup — speak this:</div>';
      html += '<blockquote class="card-analogy-setup">' + mdLite(analogy.setup) + '</blockquote>';
    }

    // The required question — extracted from setup or after-they-answer
    // The setup itself usually contains the question. Highlight if we can detect.
    html += '<div class="card-required-question-banner">⚠️ Ask the question. Do NOT deliver the conclusion. Let them construct it.</div>';

    if (analogy.afterTheyAnswer) {
      html += '<div class="card-section-label">After they answer:</div>';
      html += '<div class="card-after-answer">' + mdLite(analogy.afterTheyAnswer) + '</div>';
    }

    if (analogy.whyItLands) {
      html += '<details class="card-details">';
      html += '<summary>Why this lands</summary>';
      html += '<div class="card-details-body">' + mdLite(analogy.whyItLands) + '</div>';
      html += '</details>';
    }

    html += '<div class="card-action-row">';
    html += '<button class="card-btn primary" onclick="DrillFlow.advanceToConcession()">Deployed → check concession ▼</button>';
    html += '<button class="card-btn secondary" onclick="DrillFlow.pickDifferentAnalogy()">Pick a different analogy</button>';
    html += '</div>';
    html += '</div>';
    return html;
  }

  // =================================================================
  // CARD 9 — CONCESSION CHECK CARD
  // =================================================================
  function renderConcessionCard() {
    let html = '<div class="card card-concession" id="card-concession-' + Date.now() + '">';
    html += '<div class="card-tag tag-blue">🔵 Concession check</div>';
    html += '<div class="card-title">Did the prospect concede?</div>';
    html += '<div class="card-subtitle">Watch for: "Yeah, I guess that\'s true." / "I never thought about it that way." / pause + softer voice / "Honestly..."</div>';

    html += '<div class="concession-options">';
    html += '<button class="card-btn concession-btn yes" onclick="DrillFlow.markConcession(\'yes\')">';
    html += '<div class="concession-label">✓ Yes — clear concession</div>';
    html += '<div class="concession-desc">Move to sweep, queue next excuse</div>';
    html += '</button>';

    html += '<button class="card-btn concession-btn partial" onclick="DrillFlow.markConcession(\'partial\')">';
    html += '<div class="concession-label">~ Partial — softening but resisting</div>';
    html += '<div class="concession-desc">Try a different analogy or follow-up reframe</div>';
    html += '</button>';

    html += '<button class="card-btn concession-btn no" onclick="DrillFlow.markConcession(\'no\')">';
    html += '<div class="concession-label">✗ No — porcupining</div>';
    html += '<div class="concession-desc">Loop back: different path? different analogy? Or sweep anyway?</div>';
    html += '</button>';
    html += '</div>';
    html += '</div>';
    return html;
  }

  // =================================================================
  // CARD 10 — SWEEP CARD
  // =================================================================
  function renderSweepCard(parsed) {
    let html = '<div class="card card-sweep" id="card-sweep-' + Date.now() + '">';
    html += '<div class="card-tag tag-orange">🟠 Sweep · transition to next external</div>';
    html += '<div class="card-title">Lateral sweep — ask what else has been in the way</div>';
    html += '<div class="card-subtitle">Do NOT dive vertical yet. Even if you sense the fear, sweep first.</div>';

    if (parsed.sweepTransition) {
      html += '<div class="card-section-label">Sweep transition language:</div>';
      html += '<blockquote class="card-sweep-quote">' + mdLite(parsed.sweepTransition) + '</blockquote>';
    }

    html += '<div class="card-section-label">Externals cleared this call:</div>';
    html += '<div class="sweep-counter">1 / 3 needed before scoop</div>';
    html += '<div class="sweep-counter-note">(Scoop card unlocks at 2-3. Coming in Phase 3.)</div>';

    html += '<div class="card-action-row">';
    html += '<button class="card-btn primary" onclick="DrillFlow.backToPicker()">→ Back to picker (queue next excuse)</button>';
    html += '<button class="card-btn secondary" onclick="DrillFlow.restartDrill()">Restart this drill</button>';
    html += '</div>';
    html += '</div>';
    return html;
  }

  // =================================================================
  // RESISTANCE LOOP CARDS (when concession is partial/no)
  // =================================================================
  function renderResistanceCard(verdict) {
    let html = '<div class="card card-resistance" id="card-resist-' + Date.now() + '">';
    html += '<div class="card-tag tag-red">🔴 Resistance · ' + (verdict === 'partial' ? 'partial concession' : 'porcupining') + '</div>';
    html += '<div class="card-title">';
    html += verdict === 'partial' ? 'Softening but not yet there.' : 'They pushed back. Recalibrate.';
    html += '</div>';
    html += '<div class="card-subtitle">';
    html += verdict === 'partial'
      ? 'Often means the reframe is close but not the right path. Try a different analogy on the same path, or re-diagnose.'
      : 'Often means wrong path diagnosis OR they\'re using this excuse as armor. Try a different path, or sweep anyway — the accumulation does the work.';
    html += '</div>';

    html += '<div class="card-action-row">';
    html += '<button class="card-btn primary" onclick="DrillFlow.tryDifferentAnalogyOnSamePath()">Try a different analogy on this path</button>';
    html += '<button class="card-btn secondary" onclick="DrillFlow.rediagnosePath()">Re-diagnose path</button>';
    html += '<button class="card-btn secondary" onclick="DrillFlow.sweepAnyway()">Sweep anyway → next excuse</button>';
    html += '</div>';
    html += '</div>';
    return html;
  }

  // =================================================================
  // CALL START — Type A/B selector + opener
  // =================================================================
  function renderCallStartCard(prospectType) {
    let html = '<div class="card card-call-start" id="card-callstart">';
    html += '<div class="card-tag tag-purple">📞 Call start</div>';
    html += '<div class="card-title">You\'re drilling against a Type ' + prospectType + ' prospect</div>';

    if (prospectType === 'A') {
      html += '<div class="card-subtitle"><strong>Type A — high-performing operator.</strong> Articulate. Defends with logic. Hides fear behind sophistication. Responds to rigor & counter-evidence from their own data. Breaks at being shown their own contradictions.</div>';
    } else {
      html += '<div class="card-subtitle"><strong>Type B — stuck or stalled.</strong> Less articulate. Defends with emotion or external blame. Hides fear behind victimhood. Responds to warmth + validation + then challenge. Breaks at seeing peers in the same situation succeed.</div>';
    }

    html += '<div class="card-section-label">Your opening question:</div>';
    html += '<blockquote class="card-opener">"Why hasn\'t this happened yet?"</blockquote>';
    html += '<div class="card-meta">When they raise an excuse, tap the matching chip in the picker.</div>';
    html += '</div>';
    return html;
  }

  return {
    renderCallStartCard,
    renderLayer1Card,
    renderScriptSelectCard,
    renderScriptQuestionCard,
    renderProspectResponseCard,
    renderPathDiagnosisCard,
    renderReframeCard,
    renderAnalogyCard,
    renderAnalogyDisplayCard,
    renderConcessionCard,
    renderSweepCard,
    renderResistanceCard
  };
})();

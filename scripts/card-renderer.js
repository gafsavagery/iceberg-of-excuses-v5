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
    // Variant-based phrasings (mechanism files use these instead of past/present)
    if (layer1 && layer1.variants && layer1.variants.length) {
      layer1.variants.forEach(v => {
        html += '<div class="card-section-label">' + esc(v.label) + '</div>';
        html += '<ul class="card-list">';
        v.phrasings.forEach(p => html += '<li>' + esc(p) + '</li>');
        html += '</ul>';
      });
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
  // CARD 10 — SWEEP CARD (scoop-aware)
  // =================================================================
  function renderSweepCard(parsed, sessionState) {
    const clearedCount = sessionState ? sessionState.getClearedCount() : 1;
    const scoopReady = sessionState ? sessionState.isScoopGateUnlocked() : false;
    const scoopOverridden = sessionState ? sessionState.isOverridden() : false;
    const scoopAvailable = scoopReady || scoopOverridden;

    let html = '<div class="card card-sweep" id="card-sweep-' + Date.now() + '">';
    html += '<div class="card-tag tag-orange">🟠 Sweep · transition to next external</div>';
    html += '<div class="card-title">Lateral sweep — ' + (scoopAvailable ? 'or scoop now' : 'ask what else has been in the way') + '</div>';
    html += '<div class="card-subtitle">' + (scoopAvailable
      ? 'You have enough externals cleared to scoop. You can keep sweeping for more, OR scoop now to get to the fear.'
      : 'Do NOT dive vertical yet. Even if you sense the fear, sweep first. Scoop unlocks at 2 cleared externals.') + '</div>';

    if (parsed.sweepTransition) {
      html += '<div class="card-section-label">Sweep transition language:</div>';
      html += '<blockquote class="card-sweep-quote">' + mdLite(parsed.sweepTransition) + '</blockquote>';
    }

    html += '<div class="card-section-label">Externals cleared this call:</div>';
    html += '<div class="sweep-counter">' + clearedCount + ' / 2 needed before scoop</div>';
    if (scoopReady) {
      html += '<div class="sweep-counter-note" style="color:#4ADE80;">✓ Scoop gate unlocked</div>';
    } else if (scoopOverridden) {
      html += '<div class="sweep-counter-note" style="color:#FCD34D;">⚠ Override active (you bypassed the gate)</div>';
    } else {
      html += '<div class="sweep-counter-note">Sweep ' + (2 - clearedCount) + ' more before scoop unlocks (or override)</div>';
    }

    html += '<div class="card-action-row">';
    html += '<button class="card-btn primary" onclick="DrillFlow.backToPicker()">→ Back to picker (queue next excuse)</button>';
    if (scoopAvailable) {
      html += '<button class="card-btn primary scoop-now-btn" onclick="DrillFlow.advanceToScoop()">🎯 Scoop now → dig for the fear</button>';
    } else {
      html += '<button class="card-btn secondary" onclick="DrillFlow.scoopOverride()">⚠ Override gate — they\'re cracking open</button>';
    }
    html += '</div>';
    html += '</div>';
    return html;
  }

  // =================================================================
  // CARD: SESSION BREADCRUMB (shown at top of each drill + picker)
  // =================================================================
  function renderSessionBreadcrumb(sessionState) {
    if (!sessionState) return '';
    const labels = sessionState.getClearedExcuseLabels();
    const scoopReady = sessionState.isScoopGateUnlocked();
    const scoopOverridden = sessionState.isOverridden();

    if (labels.length === 0) return '';

    let html = '<div class="session-breadcrumb">';
    html += '<div class="breadcrumb-label">Cleared this call:</div>';
    html += '<div class="breadcrumb-chips">';
    labels.forEach(l => {
      html += '<span class="breadcrumb-chip">' + esc(l) + ' ✓</span>';
    });
    html += '</div>';
    if (scoopReady || scoopOverridden) {
      html += '<div class="breadcrumb-status ready">🎯 Scoop ready' + (scoopOverridden ? ' (override)' : '') + '</div>';
    } else if (labels.length === 1) {
      html += '<div class="breadcrumb-status">Sweep 1 more before scoop unlocks</div>';
    }
    html += '</div>';
    return html;
  }

  // =================================================================
  // CARD: SCOOP DEPLOY CARD
  // =================================================================
  // Shows the scoop language with cleared excuses parroted back in brackets.
  function renderScoopDeployCard(parsed, sessionState, statedGoal) {
    const labels = sessionState.getClearedExcuseLabels();
    const isOverride = sessionState.isOverridden() && !sessionState.isScoopGateUnlocked();

    // Build parroted list (e.g., "time, debt, and money")
    let parrotList = '';
    if (labels.length === 1) {
      parrotList = labels[0].toLowerCase();
    } else if (labels.length === 2) {
      parrotList = labels[0].toLowerCase() + ' and ' + labels[1].toLowerCase();
    } else if (labels.length >= 3) {
      const allButLast = labels.slice(0, -1).map(l => l.toLowerCase()).join(', ');
      parrotList = allButLast + ', and ' + labels[labels.length - 1].toLowerCase();
    } else {
      parrotList = '<em>(no excuses raised yet — override active)</em>';
    }

    let html = '<div class="card card-scoop-deploy" id="card-scoop-' + Date.now() + '">';
    html += '<div class="card-tag tag-purple">🎯 SCOOP · the door to the fear</div>';
    html += '<div class="card-title">Deploy the scoop with the cleared excuses</div>';

    if (isOverride) {
      html += '<div class="card-warn-banner">⚠ Override active. Normally you\'d sweep more externals first. Make sure they\'re actually opening up — not just trying to please you.</div>';
    }

    html += '<div class="card-section-label">Say this — parrot back what they raised:</div>';
    html += '<blockquote class="card-scoop-question">';
    html += '"So aside from <span class="parrot-pill">' + esc(parrotList) + '</span> — what do you feel has actually been in the way of you having your goal?"';
    html += '</blockquote>';

    if (parsed.scoop && parsed.scoop.permissionPreamble) {
      html += '<details class="card-details">';
      html += '<summary>Use permission preamble if they\'re intellectualizing or shutting down</summary>';
      html += '<div class="card-details-body">' + mdLite(parsed.scoop.permissionPreamble) + '</div>';
      html += '</details>';
    }

    html += '<div class="card-required-question-banner">⚠️ NOW SHUT UP. Wait 5-10 seconds. Do NOT fill the silence. The discomfort produces the answer.</div>';

    html += '<div class="card-action-row">';
    html += '<button class="card-btn primary" onclick="DrillFlow.scoopAsked()">Asked it · waiting in silence ▼</button>';
    html += '</div>';
    html += '</div>';
    return html;
  }

  // =================================================================
  // CARD: SILENCE / PAUSE TIMER
  // =================================================================
  function renderSilenceCard() {
    let html = '<div class="card card-silence" id="card-silence-' + Date.now() + '">';
    html += '<div class="card-tag tag-purple">🤫 Silence · let the discomfort do the work</div>';
    html += '<div class="card-title">Wait. Do not speak.</div>';
    html += '<div class="card-subtitle">The prospect is processing. The first 5 seconds will feel awkward — that\'s the point. By 8-10 seconds they will speak.</div>';
    html += '<div class="silence-timer" id="silence-timer">0s</div>';
    html += '<div class="silence-instructions">Tap "They spoke" when they break the silence.</div>';
    html += '<div class="card-action-row">';
    html += '<button class="card-btn primary" onclick="DrillFlow.silenceBroke()">They spoke → see what they said ▼</button>';
    html += '</div>';
    html += '<script>(function() { var start = Date.now(); var t = document.getElementById("silence-timer"); var iv = setInterval(function() { if (!t || !t.isConnected) { clearInterval(iv); return; } var s = Math.floor((Date.now() - start)/1000); t.textContent = s + "s"; if (s >= 5) t.className = "silence-timer ready"; if (s >= 10) t.className = "silence-timer overdue"; }, 250); })();</script>';
    html += '</div>';
    return html;
  }

  // =================================================================
  // CARD: NAMED FEAR RESPONSE (prospect says what the fear is)
  // =================================================================
  function renderNamedFearCard(parsed, sessionState) {
    const prospectType = sessionState.getProspectType();
    const fears = prospectType === 'A'
      ? (parsed.scoop?.typeAFears || [])
      : (parsed.scoop?.typeBFears || []);

    let fearText, fearIndex;
    if (fears.length > 0) {
      fearIndex = Math.floor(Math.random() * fears.length);
      fearText = fears[fearIndex];
    } else {
      // Generic fallback if file has no scoop fears
      const generic = prospectType === 'A'
        ? ["I think... honestly, I think I'm afraid of finding out I'm not as capable as everyone thinks I am.",
           "I don't know who I am if I'm not the one carrying it all.",
           "I think I'm afraid of letting go of the control."]
        : ["I'm scared that if I really try and it doesn't work, I'll have to accept I can't do this.",
           "I just don't trust myself to follow through. Not after last time.",
           "Honestly? I'm afraid of disappointing the people who believed in me."];
      fearIndex = Math.floor(Math.random() * generic.length);
      fearText = generic[fearIndex];
    }

    // Save to session
    sessionState.recordNamedFear(fearText, fearIndex, prospectType);

    let html = '<div class="card card-named-fear" id="card-namedfear-' + Date.now() + '">';
    html += '<div class="card-tag tag-prospect">👤 Prospect named the fear · Type ' + prospectType + '</div>';
    html += '<blockquote class="card-named-fear-quote">' + esc(fearText) + '</blockquote>';
    html += '<div class="card-meta">From Type ' + prospectType + ' fear menu' + (fears.length > 0 ? ' (' + fears.length + ' available in this lexicon)' : ' (generic fallback)') + '</div>';
    html += '<div class="card-action-row">';
    html += '<button class="card-btn primary" onclick="DrillFlow.advanceToAhaCheck()">Continue → check aha type ▼</button>';
    html += '</div>';
    html += '</div>';
    return html;
  }

  // =================================================================
  // CARD: AHA TYPE CHECK
  // =================================================================
  function renderAhaCheckCard(parsed) {
    const somatic = parsed.scoop?.somaticSignals || [];
    const intellectual = parsed.scoop?.intellectualSignals || [];

    let html = '<div class="card card-aha-check" id="card-aha-' + Date.now() + '">';
    html += '<div class="card-tag tag-purple">🎯 Aha detection · was it a holy-shit moment?</div>';
    html += '<div class="card-title">How did they name the fear?</div>';
    html += '<div class="card-subtitle">The discovery call\'s entire value lives in this question. If they named it conversationally — keep digging. If they named it with weight — you\'ve earned the door to Stage 2.</div>';

    html += '<div class="aha-grid">';

    // Somatic option
    html += '<button class="aha-option somatic" onclick="DrillFlow.markAha(\'somatic\')">';
    html += '<div class="aha-label">✓ Somatic — the holy-shit moment</div>';
    html += '<div class="aha-desc">Voice dropped, pause before answering, body shifted, "wow" or "huh", they look down, sentences got short and broken</div>';
    if (somatic.length) {
      html += '<details class="aha-details"><summary>Specific signals to watch for</summary><ul>';
      somatic.forEach(s => html += '<li>' + esc(s) + '</li>');
      html += '</ul></details>';
    }
    html += '</button>';

    // Intellectual option
    html += '<button class="aha-option intellectual" onclick="DrillFlow.markAha(\'intellectual\')">';
    html += '<div class="aha-label">~ Intellectual — they named it but no weight</div>';
    html += '<div class="aha-desc">Same voice tone, listed it like a thought experiment, no pause, "maybe it\'s X or Y"</div>';
    if (intellectual.length) {
      html += '<details class="aha-details"><summary>Specific signals to watch for</summary><ul>';
      intellectual.forEach(s => html += '<li>' + esc(s) + '</li>');
      html += '</ul></details>';
    }
    html += '</button>';

    html += '</div>';
    html += '</div>';
    return html;
  }

  // =================================================================
  // CARD: STAGE 1 COMPLETE — handoff to Stage 2
  // =================================================================
  function renderStage1CompleteCard(parsed, sessionState) {
    const namedFear = sessionState.getNamedFear();
    const labels = sessionState.getClearedExcuseLabels();

    let html = '<div class="card card-stage-complete" id="card-complete-' + Date.now() + '">';
    html += '<div class="card-tag tag-success">🟢 STAGE 1 COMPLETE · fear named with somatic aha</div>';
    html += '<div class="card-title">You\'ve earned the door to Stage 2.</div>';
    html += '<div class="card-subtitle">The prospect has named the fear and you felt the shift. They are vulnerable, present, and listening differently. Do not waste this moment.</div>';

    html += '<div class="stage-summary">';
    html += '<div class="card-section-label">What happened this call:</div>';
    html += '<div class="stage-summary-item"><strong>Prospect type:</strong> ' + esc(sessionState.getProspectType()) + '</div>';
    html += '<div class="stage-summary-item"><strong>Externals cleared:</strong> ' + labels.map(l => esc(l)).join(', ') + '</div>';
    if (namedFear) {
      html += '<div class="stage-summary-item"><strong>Named fear:</strong></div>';
      html += '<blockquote class="card-named-fear-quote" style="margin-top:6px;">' + esc(namedFear.text) + '</blockquote>';
    }
    html += '</div>';

    if (parsed.scoop && parsed.scoop.stage2Handoff) {
      html += '<div class="card-section-label">Stage 2 next steps (NOT in this sim):</div>';
      html += '<div class="stage-2-instructions">' + mdLite(parsed.scoop.stage2Handoff) + '</div>';
    } else {
      html += '<div class="card-section-label">Stage 2 next steps (NOT in this sim):</div>';
      html += '<div class="stage-2-instructions">';
      html += '<ol><li><strong>Past cost of the fear</strong> — "How long has this fear been controlling how you operate? What has it already cost you?"</li>';
      html += '<li><strong>Future consequence</strong> — "If this fear keeps running the show for 3-5 more years, where does that put you?"</li>';
      html += '<li><strong>Visualize future self</strong> — "Imagine the version of you who has moved through this. What\'s different?"</li>';
      html += '<li><strong>"What do we need to let go of?"</strong> — only after all above</li></ol>';
      html += '</div>';
    }

    html += '<div class="card-action-row">';
    html += '<button class="card-btn primary" onclick="DrillFlow.fullSessionReset()">🔄 Start a new call</button>';
    html += '<button class="card-btn secondary" onclick="DrillFlow.backToPicker()">Back to picker (continue same prospect)</button>';
    html += '</div>';
    html += '</div>';
    return html;
  }

  // =================================================================
  // CARD: KEEP DIGGING (intellectual aha — needs deeper work)
  // =================================================================
  function renderKeepDiggingCard(sessionState) {
    const namedFear = sessionState.getNamedFear();

    let html = '<div class="card card-keep-digging" id="card-digging-' + Date.now() + '">';
    html += '<div class="card-tag tag-warn">~ Intellectual aha · keep digging</div>';
    html += '<div class="card-title">They named it but didn\'t feel it.</div>';
    html += '<div class="card-subtitle">They gave you words. You need them to give you the body. Re-deploy with permission preamble and ask for the ONE driver.</div>';

    if (namedFear) {
      html += '<div class="card-section-label">What they said:</div>';
      html += '<blockquote class="card-named-fear-quote">' + esc(namedFear.text) + '</blockquote>';
    }

    html += '<div class="card-section-label">Re-deploy script:</div>';
    html += '<blockquote class="card-scoop-question">"Can I push on this a bit? If you had to pick the one fear that\'s actually been driving the others — which one is it?"</blockquote>';

    html += '<div class="card-action-row">';
    html += '<button class="card-btn primary" onclick="DrillFlow.scoopAsked()">Re-deploy · wait in silence again ▼</button>';
    html += '<button class="card-btn secondary" onclick="DrillFlow.fullSessionReset()">End this call (no aha)</button>';
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
    renderResistanceCard,
    renderSessionBreadcrumb,
    renderScoopDeployCard,
    renderSilenceCard,
    renderNamedFearCard,
    renderAhaCheckCard,
    renderStage1CompleteCard,
    renderKeepDiggingCard
  };
})();

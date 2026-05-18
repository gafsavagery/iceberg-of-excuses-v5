// ===================================================================
// APP — main wiring
// ===================================================================
// Phase 1A responsibilities:
// 1. Render the picker with all 17 chips
// 2. On chip tap: fetch the lexicon file, parse it, render debug view
// 3. Render the debug view as structured HTML so a human can verify
//    the parse captured everything correctly.
// ===================================================================

(function() {

  const STAGE_PICK = 'stage-pick';
  const STAGE_DEBUG = 'stage-debug';

  // ----- Render picker chips on load -----
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
  }

  // ----- On chip tap: fetch → parse → render -----
  async function onChipTap(chip) {
    showStage(STAGE_DEBUG);
    const output = document.getElementById('debug-output');
    output.innerHTML = '<div class="debug-header"><div class="debug-title">Loading ' + escapeHtml(chip.label) + '…</div><div class="debug-meta">Fetching lexicon/' + chip.file + '</div></div>';
    scrollTop();

    try {
      const resp = await fetch('lexicon/' + chip.file);
      if (!resp.ok) {
        throw new Error('Failed to fetch lexicon file: HTTP ' + resp.status + ' (' + resp.statusText + ')');
      }
      const md = await resp.text();
      const parsed = LexiconParser.parse(md, chip.file);
      const report = LexiconParser.validate(parsed);
      renderDebugView(chip, parsed, report);
    } catch (err) {
      output.innerHTML = '<div class="debug-error">⚠️ Error loading ' + escapeHtml(chip.file) + ': ' + escapeHtml(err.message) + '<br><br><em>Note: if you\'re opening this file directly (file://), browsers block fetch(). This sim must be served via HTTP — use GitHub Pages or a local server.</em></div>';
    }
  }

  // ----- Render the parsed output as debug HTML -----
  function renderDebugView(chip, parsed, report) {
    const output = document.getElementById('debug-output');
    const html = [];

    // Header
    html.push('<div class="debug-header">');
    html.push('<h2 class="debug-title">' + escapeHtml(parsed.title || chip.label) + '</h2>');
    html.push('<div class="debug-meta">File: lexicon/' + escapeHtml(chip.file) + ' · Chip: ' + escapeHtml(chip.id) + ' · Category: ' + escapeHtml(chip.cat) + '</div>');
    html.push('<button class="reset-btn" style="margin-top: 12px;" onclick="window.__app.backToPicker()">← Back to picker</button>');
    html.push('</div>');

    // Validation summary
    html.push('<div class="debug-summary">');
    html.push('<div class="debug-summary-title">📋 Parse validation report</div>');
    html.push('<div class="debug-summary-grid">');
    html.push(summaryRow('Title', report.hasTitle));
    html.push(summaryRow('Category letter', report.hasCategoryLetter, parsed.category ? parsed.category.letter : null));
    html.push(summaryRow('Layer 1 (past)', report.hasLayer1Past, parsed.layer1 ? parsed.layer1.past.length + ' phrases' : null));
    html.push(summaryRow('Layer 1 (present)', report.hasLayer1Present, parsed.layer1 ? parsed.layer1.present.length + ' phrases' : null));
    html.push(summaryRow('Layer 2 patterns', report.hasLayer2Patterns, parsed.layer1 ? parsed.layer1.layer2Patterns.length + ' patterns' : null));
    html.push(summaryRow('Critical framing', report.hasCriticalFraming));
    html.push(summaryRow('SCRIPT letters', report.scriptLetterCount > 0, report.scriptLetterCount + ' letters, primary: ' + (report.primaryLetters.join(', ') || 'none')));
    html.push(summaryRow('Diagnostic paths', report.hasDiagnosticPaths, report.pathCount + ' paths, ' + report.totalAnalogies + ' analogies total'));
    html.push(summaryRow('Sweep transition', report.hasSweepTransition));
    html.push(summaryRow('Type A variation', report.hasTypeAVariation));
    html.push(summaryRow('Type B variation', report.hasTypeBVariation));
    if (report.hasSpecialDiagnostic) html.push(summaryRow('Special diagnostic Q', true));
    if (report.hasGapQuestion) html.push(summaryRow('Gap question', true));
    html.push('</div>');
    html.push('</div>');

    // === SECTION: CATEGORY ===
    html.push(sectionCard('Category', report.hasCategoryLetter, () => {
      if (!parsed.category) return '<em>not found</em>';
      let s = '<p><strong>' + escapeHtml(parsed.category.raw) + '</strong></p>';
      s += '<p>Letter: <strong>' + escapeHtml(parsed.category.letter || '?') + '</strong>';
      if (parsed.category.hasOverlap) s += ' <em>(has overlap with other category)</em>';
      s += '</p>';
      return s;
    }));

    // === SECTION: LAYER 1 ===
    html.push(sectionCard('Layer 1 — surface excuse phrasings', report.hasLayer1, () => {
      if (!parsed.layer1) return '<em>not found</em>';
      let s = '';
      if (parsed.layer1.past.length) {
        s += '<p><strong>Past-tense (' + parsed.layer1.past.length + '):</strong></p><ul>';
        parsed.layer1.past.forEach(p => s += '<li>' + escapeHtml(p) + '</li>');
        s += '</ul>';
      }
      if (parsed.layer1.present.length) {
        s += '<p><strong>Present-tense (' + parsed.layer1.present.length + '):</strong></p><ul>';
        parsed.layer1.present.forEach(p => s += '<li>' + escapeHtml(p) + '</li>');
        s += '</ul>';
      }
      if (parsed.layer1.layer2Patterns.length) {
        s += '<p><strong>Layer 2 patterns to listen for (' + parsed.layer1.layer2Patterns.length + '):</strong></p><ul>';
        parsed.layer1.layer2Patterns.forEach(p => s += '<li>' + escapeHtml(p) + '</li>');
        s += '</ul>';
      }
      return s;
    }));

    // === SECTION: CRITICAL FRAMING ===
    if (parsed.criticalFraming) {
      html.push(sectionCard('Critical framing note', true, () => {
        return '<div>' + simpleMarkdownToHtml(parsed.criticalFraming) + '</div>';
      }));
    }

    // === SECTION: SPECIAL DIAGNOSTIC (self-doubt) ===
    if (parsed.diagnosticQuestion) {
      html.push(sectionCard('Special: diagnostic question (deploys BEFORE SCRIPT)', true, () => {
        return '<div>' + simpleMarkdownToHtml(parsed.diagnosticQuestion) + '</div>';
      }));
    }

    // === SECTION: SPECIAL GAP QUESTION (life-is-okay) ===
    if (parsed.gapQuestion) {
      html.push(sectionCard('Special: gap question (unique to this excuse)', true, () => {
        return '<div>' + simpleMarkdownToHtml(parsed.gapQuestion) + '</div>';
      }));
    }

    // === SECTION: SCRIPT PATH ===
    html.push(sectionCard('SCRIPT path', report.hasScript, () => {
      if (!parsed.script) return '<em>not found</em>';
      let s = '<p><strong>Primary letters:</strong> ' + (parsed.script.primaryLetters.join(', ') || '<em>not specified in intro</em>') + '</p>';
      const letterKeys = Object.keys(parsed.script.letters);
      if (letterKeys.length === 0) {
        s += '<em>No SCRIPT letters parsed.</em>';
      } else {
        letterKeys.forEach(key => {
          const L = parsed.script.letters[key];
          s += '<div class="debug-script-letter">';
          s += '<div class="debug-script-letter-header">' + escapeHtml(L.rawHeader) + (L.isPrimary ? ' <span class="debug-analogy-grade">PRIMARY</span>' : '') + '</div>';
          if (L.past) s += '<div class="debug-script-letter-q"><strong>Past:</strong> ' + escapeHtml(L.past) + '</div>';
          if (L.present) s += '<div class="debug-script-letter-q"><strong>Present:</strong> ' + escapeHtml(L.present) + '</div>';
          if (L.either) s += '<div class="debug-script-letter-q"><strong>Either tense:</strong> ' + escapeHtml(L.either) + '</div>';
          if (L.listenFor) s += '<div class="debug-script-letter-q"><em>Listen for:</em> ' + escapeHtml(L.listenFor) + '</div>';
          if (L.whenToDeploy) s += '<div class="debug-script-letter-q"><em>When to deploy:</em> ' + escapeHtml(L.whenToDeploy) + '</div>';
          s += '</div>';
        });
      }
      return s;
    }));

    // === SECTION: DIAGNOSTIC PATHS ===
    html.push(sectionCard('Diagnostic paths', report.hasDiagnosticPaths, () => {
      if (!parsed.paths || parsed.paths.length === 0) return '<em>not found</em>';
      let s = '';
      parsed.paths.forEach(p => {
        s += '<div class="debug-path">';
        s += '<div class="debug-path-header">' + escapeHtml(p.label) + '</div>';
        if (p.description) s += '<div class="debug-section-content">' + simpleMarkdownToHtml(p.description) + '</div>';
        if (p.recognition.length) {
          s += '<div class="debug-path-sub">How to recognize (' + p.recognition.length + ')</div><ul>';
          p.recognition.forEach(r => s += '<li>' + escapeHtml(r) + '</li>');
          s += '</ul>';
        }
        if (p.followups.length) {
          s += '<div class="debug-path-sub">Follow-up questions (' + p.followups.length + ')</div><ul>';
          p.followups.forEach(r => s += '<li>' + escapeHtml(r) + '</li>');
          s += '</ul>';
        }
        if (p.reframeQs.length) {
          s += '<div class="debug-path-sub">Reframe questions (' + p.reframeQs.length + ')</div><ul>';
          p.reframeQs.forEach(r => s += '<li>' + escapeHtml(r) + '</li>');
          s += '</ul>';
        }
        if (p.analogies.length) {
          s += '<div class="debug-path-sub">Analogies (' + p.analogies.length + ')</div>';
          p.analogies.forEach(a => {
            s += '<div class="debug-analogy">';
            s += '<div><strong>Analogy ' + escapeHtml(a.number) + ' — ' + escapeHtml(a.title) + '</strong><span class="debug-analogy-grade">Grade: ' + escapeHtml(a.grade) + '</span></div>';
            if (a.setup) s += '<div style="margin: 6px 0; font-style: italic; color: #FCD34D;">Setup: "' + escapeHtml(a.setup) + '"</div>';
            if (a.afterTheyAnswer) s += '<div style="margin: 4px 0; font-size: 12px;"><strong>After they answer:</strong> ' + escapeHtml(a.afterTheyAnswer) + '</div>';
            if (a.whyItLands) s += '<div style="margin: 4px 0; font-size: 12px; color: #94A3B8;">' + escapeHtml(a.whyItLands) + '</div>';
            s += '</div>';
          });
        }
        if (p.transition) {
          s += '<div class="debug-path-sub">Transition language</div>';
          s += '<div class="debug-section-content"><em>' + escapeHtml(p.transition) + '</em></div>';
        }
        s += '</div>';
      });
      return s;
    }));

    // === SECTION: SWEEP TRANSITION ===
    html.push(sectionCard('Sweep transition (to next external)', report.hasSweepTransition, () => {
      if (!parsed.sweepTransition) return '<em>not found</em>';
      return '<div>' + simpleMarkdownToHtml(parsed.sweepTransition) + '</div>';
    }));

    // === SECTION: SIM BEHAVIOR NOTES ===
    html.push(sectionCard('Sim behavior notes', report.hasSimBehavior, () => {
      if (!parsed.simBehavior) return '<em>not found</em>';
      let s = '';
      if (parsed.simBehavior.typeA) {
        s += '<div class="debug-path-sub">Type A prospect variation</div>';
        s += '<div class="debug-section-content">' + simpleMarkdownToHtml(parsed.simBehavior.typeA) + '</div>';
      }
      if (parsed.simBehavior.typeB) {
        s += '<div class="debug-path-sub">Type B prospect variation</div>';
        s += '<div class="debug-section-content">' + simpleMarkdownToHtml(parsed.simBehavior.typeB) + '</div>';
      }
      if (parsed.simBehavior.voiceTone) {
        s += '<div class="debug-path-sub">Voice tone notes</div>';
        s += '<div class="debug-section-content">' + simpleMarkdownToHtml(parsed.simBehavior.voiceTone) + '</div>';
      }
      if (parsed.simBehavior.frictionBudget) {
        s += '<div class="debug-path-sub">Friction budget notes</div>';
        s += '<div class="debug-section-content">' + simpleMarkdownToHtml(parsed.simBehavior.frictionBudget) + '</div>';
      }
      if (parsed.simBehavior.special) {
        s += '<div class="debug-path-sub">Special handling</div>';
        s += '<div class="debug-section-content">' + simpleMarkdownToHtml(parsed.simBehavior.special) + '</div>';
      }
      if (parsed.simBehavior.otherSections && parsed.simBehavior.otherSections.length) {
        s += '<div class="debug-path-sub">All H3 sections in Sim Behavior</div><ul>';
        parsed.simBehavior.otherSections.forEach(t => s += '<li>' + escapeHtml(t) + '</li>');
        s += '</ul>';
      }
      return s;
    }));

    output.innerHTML = html.join('');
    scrollTop();
  }

  // ----- Helpers -----
  function sectionCard(title, status, contentFn) {
    return '<div class="debug-section">'
      + '<div class="debug-section-title">' + escapeHtml(title)
      + ' <span class="debug-section-status ' + (status ? 'found' : 'missing') + '">' + (status ? '✓ FOUND' : '✗ MISSING') + '</span></div>'
      + '<div class="debug-section-content">' + contentFn() + '</div>'
      + '</div>';
  }

  function summaryRow(label, status, detail) {
    return '<div class="debug-summary-item">'
      + (status ? '<span style="color:#4ADE80;">✓</span> ' : '<span style="color:#F87171;">✗</span> ')
      + escapeHtml(label)
      + (detail ? ' <em style="color:#94A3B8;font-size:11px;">— ' + escapeHtml(String(detail)) + '</em>' : '')
      + '</div>';
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

  // Tiny markdown-to-HTML for display purposes only (bullets, bold, italic, paragraphs)
  function simpleMarkdownToHtml(md) {
    if (!md) return '';
    let html = escapeHtml(md);
    // bold
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    // italic
    html = html.replace(/(^|[^*])\*([^*\n]+)\*([^*]|$)/g, '$1<em>$2</em>$3');
    // blockquotes
    html = html.replace(/^&gt;\s+(.+)$/gm, '<blockquote style="margin: 6px 0; padding: 8px 12px; border-left: 3px solid #4ADE80; background: rgba(74,222,128,0.05); font-style: italic;">$1</blockquote>');
    // bullets — group consecutive ones
    const lines = html.split('\n');
    const result = [];
    let inList = false;
    for (const line of lines) {
      const m = line.match(/^\s*[-*]\s+(.+)$/);
      if (m) {
        if (!inList) { result.push('<ul>'); inList = true; }
        result.push('<li>' + m[1] + '</li>');
      } else {
        if (inList) { result.push('</ul>'); inList = false; }
        if (line.trim()) result.push('<p>' + line + '</p>');
      }
    }
    if (inList) result.push('</ul>');
    return result.join('');
  }

  function showStage(id) {
    document.querySelectorAll('.stage').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
  }

  function scrollTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function backToPicker() {
    showStage(STAGE_PICK);
    scrollTop();
  }

  function resetAll() {
    backToPicker();
  }

  // Expose for inline onclick handlers in HTML
  window.__app = { backToPicker, resetAll };
  window.resetAll = resetAll;

  // Init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderPicker);
  } else {
    renderPicker();
  }

})();

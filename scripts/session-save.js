// ===================================================================
// SESSION SAVE
// ===================================================================
// Two-part system:
//
// 1. AUTO-SAVE — writes session state to localStorage on significant
//    events (concession Yes, scoop deployed, named fear, aha marked).
//    Survives tab close. Auto-restored on page load.
//
// 2. MANUAL EXPORT — generates a detailed .md file and triggers the
//    browser's download flow. On iOS, this opens the Files save sheet.
//    The user picks a folder once; iOS remembers for next time.
//
// Storage key: 'iceberg-v5-session'
// MD filename: 'gaf-drill-YYYY-MM-DD-HHMM.md'
// ===================================================================

const SessionSave = (function() {

  const STORAGE_KEY = 'iceberg-v5-session';
  const HISTORY_KEY = 'iceberg-v5-history';

  // -----------------------------------------------------------------
  // AUTO-SAVE TO LOCALSTORAGE
  // -----------------------------------------------------------------

  function autoSave(sessionState, drillState) {
    try {
      const session = sessionState.get();
      if (!session) return;
      // Build a complete restorable snapshot
      const snapshot = {
        savedAt: new Date().toISOString(),
        session: session,
        drillCardLog: drillState && drillState.getState() ? {
          chipId: drillState.getState().chip ? drillState.getState().chip.id : null,
          choices: drillState.getState().choices,
          stage: drillState.getState().stage,
          cardLog: drillState.getState().cards.map(c => ({
            type: c.type,
            data: simplifyCardData(c.data),
            timestamp: c.timestamp
          }))
        } : null
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    } catch (err) {
      console.warn('SessionSave.autoSave failed:', err);
    }
  }

  // Strip non-serializable / huge data from card log entries.
  // Specifically: don't store entire parsed lexicon, just key strings.
  function simplifyCardData(data) {
    if (!data) return null;
    const clean = {};
    if (data.letter) clean.letter = data.letter;
    if (data.path) clean.path = data.path;
    if (data.analogy) clean.analogy = data.analogy;
    if (data.verdict) clean.verdict = data.verdict;
    if (data.response) {
      clean.response = {
        text: data.response.text,
        sampleIndex: data.response.sampleIndex,
        type: data.response.type
      };
    }
    if (data.excuse) clean.excuse = data.excuse;
    return clean;
  }

  function loadAutoSaved() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (err) {
      console.warn('SessionSave.loadAutoSaved failed:', err);
      return null;
    }
  }

  function clearAutoSaved() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      console.warn('SessionSave.clearAutoSaved failed:', err);
    }
  }

  function hasAutoSaved() {
    try {
      return !!localStorage.getItem(STORAGE_KEY);
    } catch (err) {
      return false;
    }
  }

  // -----------------------------------------------------------------
  // HISTORY (keep last N completed sessions)
  // -----------------------------------------------------------------

  function archiveCompletedSession(sessionState) {
    try {
      const summary = sessionState.getSummary();
      if (summary.excuseCount === 0) return; // nothing to archive
      const raw = localStorage.getItem(HISTORY_KEY);
      const history = raw ? JSON.parse(raw) : [];
      history.unshift({
        archivedAt: new Date().toISOString(),
        summary: summary,
        excuses: sessionState.getClearedExcuses(),
        namedFear: sessionState.getNamedFear()
      });
      // Keep last 25
      if (history.length > 25) history.length = 25;
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch (err) {
      console.warn('SessionSave.archive failed:', err);
    }
  }

  function getHistory() {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (err) {
      return [];
    }
  }

  // -----------------------------------------------------------------
  // MANUAL MARKDOWN EXPORT
  // -----------------------------------------------------------------

  function exportAsMarkdown(sessionState, drillCardLogs) {
    const md = buildMarkdownReport(sessionState, drillCardLogs);
    const filename = buildFilename();
    triggerDownload(md, filename);
    return { filename, size: md.length };
  }

  function buildFilename() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const h = String(now.getHours()).padStart(2, '0');
    const mn = String(now.getMinutes()).padStart(2, '0');
    return `gaf-drill-${y}-${m}-${d}-${h}${mn}.md`;
  }

  function buildMarkdownReport(sessionState, drillCardLogs) {
    const summary = sessionState.getSummary();
    const excuses = sessionState.getClearedExcuses();
    const namedFear = sessionState.getNamedFear();
    const ahaType = sessionState.getAhaType();
    const now = new Date();
    const dateStr = now.toISOString().substring(0, 10);

    const lines = [];
    lines.push(`# Drill Session — ${dateStr}`);
    lines.push('');
    lines.push(`**Generated by:** Iceberg of Excuses v5`);
    lines.push(`**Saved at:** ${now.toLocaleString()}`);
    lines.push('');
    lines.push('---');
    lines.push('');

    // ===== HIGH-LEVEL SUMMARY =====
    lines.push('## Call summary');
    lines.push('');
    lines.push(`- **Prospect type:** ${summary.prospectType}`);
    lines.push(`- **Duration:** ${summary.durationMin} min`);
    lines.push(`- **Externals cleared:** ${summary.excuseLabels.join(', ') || '(none)'}`);
    lines.push(`- **Scoop deployed:** ${summary.scoopDeployed ? 'Yes' : 'No'}` + (summary.scoopOverride ? ' (override used)' : ''));
    lines.push(`- **Named fear:** ${summary.namedFear || '(not yet reached)'}`);
    lines.push(`- **Aha type:** ${summary.ahaType || '(not yet marked)'}`);
    lines.push('');
    lines.push('---');
    lines.push('');

    // ===== PER-DRILL DETAIL =====
    lines.push('## Per-drill detail');
    lines.push('');

    if (excuses.length === 0) {
      lines.push('*(No excuses cleared yet.)*');
      lines.push('');
    } else {
      excuses.forEach((ex, idx) => {
        lines.push(`### Drill ${idx + 1} — ${ex.chipLabel}`);
        lines.push('');
        lines.push(`- **Concession:** ${ex.concession === 'yes' ? '✓ Yes' : ex.concession}`);
        if (ex.pathLabel) lines.push(`- **Path diagnosed:** ${ex.pathLabel}`);
        if (ex.analogyNumber) lines.push(`- **Analogy used:** #${ex.analogyNumber}`);

        // Pull more detail from drillCardLogs if available
        const log = drillCardLogs && drillCardLogs[ex.chipId];
        if (log) {
          // SCRIPT letters deployed
          const scriptLetters = log
            .filter(c => c.type === 'script-question')
            .map(c => c.data && c.data.letter)
            .filter(Boolean);
          if (scriptLetters.length) {
            lines.push(`- **SCRIPT letters deployed:** ${scriptLetters.join(', ')}`);
          }
          // Prospect responses heard
          const responses = log
            .filter(c => c.type === 'prospect-response')
            .map(c => c.data && c.data.response && c.data.response.text)
            .filter(Boolean);
          if (responses.length) {
            lines.push('');
            lines.push('**Prospect responses (verbatim):**');
            responses.forEach(r => lines.push(`  > "${r}"`));
          }
        }
        lines.push('');
        lines.push(`- **Completed at:** ${new Date(ex.completedAt).toLocaleTimeString()}`);
        lines.push('');
      });
    }

    lines.push('---');
    lines.push('');

    // ===== SCOOP DETAIL =====
    lines.push('## Scoop (Stage 1 → Stage 2 bridge)');
    lines.push('');

    if (!summary.scoopDeployed) {
      lines.push('*Scoop not yet deployed in this session.*');
      lines.push('');
    } else {
      const parrotList = excuses.map(e => e.chipLabel.toLowerCase()).join(', ');
      lines.push(`- **Excuses parroted back to prospect:** ${parrotList}`);
      lines.push(`- **Override used:** ${summary.scoopOverride ? 'Yes' : 'No'}`);
      lines.push('');
      if (namedFear) {
        lines.push('**Named fear (verbatim):**');
        lines.push('');
        lines.push(`> "${namedFear.text}"`);
        lines.push('');
        lines.push(`*Drawn from Type ${namedFear.type} fear samples in lexicon.*`);
        lines.push('');
      }
      lines.push(`- **Aha type:** ${ahaType || '(not marked)'}`);
      if (ahaType === 'somatic') {
        lines.push(`  - ✓ Holy-shit moment achieved. Earned Stage 2.`);
      } else if (ahaType === 'intellectual') {
        lines.push(`  - ⚠ Named but no weight. Need to re-deploy and dig deeper.`);
      }
      lines.push('');
    }

    lines.push('---');
    lines.push('');

    // ===== STAGE 2 PLACEHOLDER =====
    lines.push('## Stage 2 — Cost, consequence, future-self, let go');
    lines.push('');
    lines.push('*Not yet executed in this sim. Stage 2 happens outside the sim, in real conversation.*');
    lines.push('');
    lines.push('### To execute next:');
    lines.push('');
    lines.push('1. **Past cost of the fear** — "How long has this fear been controlling how you operate? What has it already cost you?"');
    lines.push('2. **Future consequence** — "If this fear keeps running the show for 3-5 more years, where does that put you?"');
    lines.push('3. **Visualize future self** — "Imagine the version of you who has moved through this. What\'s different?"');
    lines.push('4. **"What do we need to let go of?"** — only after all above');
    lines.push('');
    lines.push('---');
    lines.push('');

    // ===== REVIEW NOTES (empty section for you to add later) =====
    lines.push('## Your review notes');
    lines.push('');
    lines.push('*(Add what you observed, what worked, what to adjust.)*');
    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push('*End of session report.*');
    lines.push('');

    return lines.join('\n');
  }

  function triggerDownload(content, filename) {
    try {
      const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
    } catch (err) {
      console.error('Download failed:', err);
      alert('Failed to generate file. Error: ' + err.message);
    }
  }

  return {
    autoSave,
    loadAutoSaved,
    clearAutoSaved,
    hasAutoSaved,
    archiveCompletedSession,
    getHistory,
    exportAsMarkdown,
    buildMarkdownReport // exposed for testing
  };
})();

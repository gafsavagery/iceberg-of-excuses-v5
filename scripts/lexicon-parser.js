// ===================================================================
// LEXICON PARSER
// ===================================================================
// Parses an excuse file (markdown) into a structured object.
//
// Strategy: split by H2 headers into known sections, then parse each
// section's substructure (H3 sub-sections, bullets, blockquotes, etc).
//
// The parser does NOT validate content. It surfaces what's there.
// validate() returns a separate report of what was found vs missing.
// ===================================================================

const LexiconParser = (function() {

  // Section header recognition. Each section can have variant headers.
  // Match is prefix-based and case-insensitive.
  const SECTIONS = {
    category: ['## CATEGORY'],
    layer1: ['## LAYER 1'],
    criticalFraming: ['## CRITICAL FRAMING'],
    scriptPath: ['## SCRIPT PATH'],
    diagnosticPaths: ['## DIAGNOSTIC PATHS'],
    sweepTransition: ['## SWEEP TRANSITION'],
    simBehavior: ['## SIM BEHAVIOR NOTES'],
    diagnosticQuestion: ['## THE DIAGNOSTIC QUESTION'],
    gapQuestion: ['## THE GAP QUESTION'],
    scoop: ['## SCOOP / LAYER 3 FEARS', '## SCOOP', '## LAYER 3 FEARS']
  };

  function normalizeHeader(text) {
    return text.trim().toUpperCase().replace(/\s+/g, ' ');
  }

  function classifyHeader(headerText) {
    const norm = normalizeHeader(headerText);
    for (const [key, patterns] of Object.entries(SECTIONS)) {
      for (const pat of patterns) {
        if (norm.startsWith(normalizeHeader(pat))) {
          return key;
        }
      }
    }
    return null;
  }

  // Split markdown into known sections by H2 headers.
  function splitIntoSections(markdown) {
    const sections = { _title: null, _raw: {} };
    const lines = markdown.split('\n');

    for (const line of lines) {
      if (line.startsWith('# ') && !line.startsWith('## ')) {
        sections._title = line.replace(/^#\s+/, '').trim();
        break;
      }
    }

    let currentKey = null;
    let currentBuf = [];

    for (const line of lines) {
      if (line.startsWith('## ')) {
        if (currentKey) {
          sections._raw[currentKey] = currentBuf.join('\n').trim();
        }
        const matched = classifyHeader(line);
        currentKey = matched || ('_unknown_' + line.replace(/^##\s+/, '').trim().substring(0, 50));
        currentBuf = [];
      } else if (currentKey) {
        currentBuf.push(line);
      }
    }
    if (currentKey) {
      sections._raw[currentKey] = currentBuf.join('\n').trim();
    }

    return sections;
  }

  function extractBullets(md) {
    if (!md) return [];
    const bullets = [];
    md.split('\n').forEach(line => {
      const m = line.match(/^\s*[-*]\s+(.+)$/);
      if (m) bullets.push(m[1].trim());
    });
    return bullets;
  }

  // Get text under an H3 header until the next H3 (or end).
  function extractH3Block(md, h3TitlePrefix) {
    if (!md) return '';
    const normPrefix = normalizeHeader(h3TitlePrefix);
    const lines = md.split('\n');
    let inBlock = false;
    const buf = [];
    for (const line of lines) {
      if (line.startsWith('### ')) {
        const headerNorm = normalizeHeader(line.replace(/^###\s+/, ''));
        if (inBlock) break;
        if (headerNorm.startsWith(normPrefix)) {
          inBlock = true;
          continue;
        }
      } else if (line.startsWith('## ')) {
        if (inBlock) break;
      } else if (inBlock) {
        buf.push(line);
      }
    }
    return buf.join('\n').trim();
  }

  function getH3Titles(md) {
    if (!md) return [];
    const out = [];
    md.split('\n').forEach(line => {
      if (line.startsWith('### ')) {
        out.push(line.replace(/^###\s+/, '').trim());
      }
    });
    return out;
  }

  // Extract text after a bold-italic label like **Past:** or **Either tense:**
  function extractFieldValue(body, labelRegex) {
    if (!body) return null;
    const lines = body.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (labelRegex.test(lines[i])) {
        const after = lines[i].replace(labelRegex, '').trim();
        if (after) return after.replace(/^["']|["']$/g, '');
        for (let j = i + 1; j < lines.length; j++) {
          if (lines[j].trim()) return lines[j].trim().replace(/^["']|["']$/g, '');
        }
      }
    }
    return null;
  }

  function parseCategory(raw) {
    if (!raw) return null;
    const lines = raw.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('---'));
    if (!lines.length) return null;
    const first = lines[0];
    const letterMatch = first.match(/^([A-E])\s*—/);
    return {
      raw: first,
      letter: letterMatch ? letterMatch[1] : null,
      hasOverlap: first.toLowerCase().includes('overlap')
    };
  }

  function parseLayer1(raw) {
    if (!raw) return null;
    const result = {
      past: extractBullets(extractH3Block(raw, 'Past-tense')),
      present: extractBullets(extractH3Block(raw, 'Present-tense')),
      layer2Patterns: extractBullets(extractH3Block(raw, "What's underneath")),
      variants: []
    };
    // If the file doesn't use Past/Present structure, collect bullets from
    // all H3 subsections as named variants (e.g. mechanism files do this).
    if (result.past.length === 0 && result.present.length === 0) {
      const h3Titles = getH3Titles(raw);
      h3Titles.forEach(title => {
        const bullets = extractBullets(extractH3Block(raw, title));
        if (bullets.length > 0) {
          result.variants.push({ label: title, phrasings: bullets });
        }
      });
    }
    return result;
  }

  function parseScriptPath(raw) {
    if (!raw) return null;
    const result = { intro: '', letters: {}, primaryLetters: [] };

    const introLines = [];
    for (const line of raw.split('\n')) {
      if (line.startsWith('### ')) break;
      introLines.push(line);
    }
    result.intro = introLines.join('\n').trim();

    const primaryMatch = result.intro.match(/most leveraged letters?\s+(?:are|is)\s+\*\*([^*]+)\*\*/i);
    if (primaryMatch) {
      const found = primaryMatch[1].match(/\b[SCRIPT]\b/gi);
      if (found) result.primaryLetters = found.map(l => l.toUpperCase());
    }

    const lines = raw.split('\n');
    let currentLetter = null;
    let currentBuf = [];

    function flush() {
      if (!currentLetter) return;
      const body = currentBuf.join('\n').trim();
      result.letters[currentLetter.key] = {
        rawHeader: currentLetter.rawHeader,
        body: body,
        past: extractFieldValue(body, /\*\*Past:\*\*/),
        present: extractFieldValue(body, /\*\*Present:\*\*/),
        either: extractFieldValue(body, /\*\*Either tense:\*\*/),
        listenFor: extractFieldValue(body, /\*\*What you're listening for:\*\*/),
        whenToDeploy: extractFieldValue(body, /\*\*When to deploy:\*\*/),
        isPrimary: result.primaryLetters.includes(currentLetter.key)
      };
    }

    for (const line of lines) {
      if (line.startsWith('### ')) {
        flush();
        const h3 = line.replace(/^###\s+/, '').trim();
        const letterMatch = h3.match(/^([SCRIPT])\s*[—–-]/i);
        if (letterMatch) {
          currentLetter = { key: letterMatch[1].toUpperCase(), rawHeader: h3 };
          currentBuf = [];
        } else {
          currentLetter = null;
          currentBuf = [];
        }
      } else if (currentLetter) {
        currentBuf.push(line);
      }
    }
    flush();
    return result;
  }

  function parseDiagnosticPaths(raw) {
    if (!raw) return null;
    const paths = [];
    const lines = raw.split('\n');
    let currentPath = null;
    let currentBuf = [];

    function flush() {
      if (!currentPath) return;
      const body = currentBuf.join('\n').trim();
      paths.push({
        label: currentPath.label,
        rawHeader: currentPath.rawHeader,
        description: extractPathDescription(body),
        recognition: extractBoldLabelBullets(body, 'How to recognize'),
        followups: extractBoldLabelBullets(body, 'Follow-up questions'),
        reframeQs: extractBoldLabelBullets(body, 'Reframe questions'),
        analogies: extractAnalogies(body),
        transition: extractBoldLabelBlock(body, 'Transition language')
      });
    }

    for (const line of lines) {
      if (line.startsWith('### ')) {
        flush();
        const h3 = line.replace(/^###\s+/, '').trim();
        currentPath = { label: h3, rawHeader: h3 };
        currentBuf = [];
      } else if (currentPath) {
        currentBuf.push(line);
      }
    }
    flush();
    return paths;
  }

  function extractPathDescription(body) {
    if (!body) return '';
    const desc = [];
    for (const line of body.split('\n')) {
      if (line.startsWith('####') || line.startsWith('### ')) break;
      if (/^\*\*(How to recognize|Follow-up|Reframe|Participatory|Transition)/i.test(line)) break;
      desc.push(line);
    }
    return desc.join('\n').trim();
  }

  // Bullets following a **Label:** marker
  function extractBoldLabelBullets(body, label) {
    if (!body) return [];
    const lines = body.split('\n');
    const labelRegex = new RegExp('\\*\\*' + label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    let inSection = false;
    const bullets = [];
    for (const line of lines) {
      if (labelRegex.test(line)) {
        inSection = true;
        continue;
      }
      if (inSection) {
        if (/^\*\*(How to recognize|Follow-up|Reframe|Participatory|Transition|ANALOGY)/i.test(line)) break;
        if (line.startsWith('### ') || line.startsWith('## ')) break;
        const m = line.match(/^\s*[-*]\s+(.+)$/);
        if (m) bullets.push(m[1].trim());
        // Blockquote-style follow-ups
        const q = line.match(/^>\s+(.+)$/);
        if (q) bullets.push(q[1].trim());
      }
    }
    return bullets;
  }

  function extractBoldLabelBlock(body, label) {
    if (!body) return '';
    const lines = body.split('\n');
    const labelRegex = new RegExp('\\*\\*' + label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    let inSection = false;
    const buf = [];
    for (const line of lines) {
      if (labelRegex.test(line)) {
        inSection = true;
        continue;
      }
      if (inSection) {
        if (/^\*\*(How to recognize|Follow-up|Reframe|Participatory|Transition|ANALOGY)/i.test(line)) break;
        if (line.startsWith('### ') || line.startsWith('## ')) break;
        buf.push(line);
      }
    }
    return buf.join('\n').trim();
  }

  function extractAnalogies(body) {
    if (!body) return [];
    const analogies = [];
    const lines = body.split('\n');
    let current = null;
    let buf = [];

    function flush() {
      if (!current) return;
      const fullBody = buf.join('\n').trim();
      analogies.push({
        number: current.number,
        title: current.title,
        grade: current.grade,
        setup: extractFirstBlockquote(fullBody),
        afterTheyAnswer: extractMarkerBlock(fullBody, /^After they (answer|react|list)/i, [/^Why this lands/i, /^Why the/i, /^\*\*ANALOGY/i]),
        whyItLands: extractMarkerBlock(fullBody, /^Why (this|the).+lands/i, [/^\*\*ANALOGY/i, /^### /, /^## /]),
        rawBody: fullBody
      });
    }

    for (const line of lines) {
      const header = line.match(/^\*\*ANALOGY\s+(\d+)\s*[—–-]\s+([^*]+?)\*\*\s*[—–-]?\s*\*\*Grade:\s*([^*]+?)\*\*/i);
      if (header) {
        flush();
        current = {
          number: header[1],
          title: header[2].trim(),
          grade: header[3].trim()
        };
        buf = [];
      } else if (current) {
        buf.push(line);
      }
    }
    flush();
    return analogies;
  }

  function extractFirstBlockquote(body) {
    if (!body) return '';
    const lines = body.split('\n');
    const quote = [];
    let inQuote = false;
    for (const line of lines) {
      if (line.startsWith('> ')) {
        inQuote = true;
        quote.push(line.substring(2));
      } else if (inQuote && line.trim() === '') {
        if (quote.length) break;
      } else if (inQuote) {
        break;
      }
    }
    return quote.join('\n').trim();
  }

  function extractMarkerBlock(body, startRegex, stopRegexes) {
    if (!body) return '';
    const lines = body.split('\n');
    const result = [];
    let inSection = false;
    for (const line of lines) {
      if (!inSection && startRegex.test(line)) {
        inSection = true;
        continue;
      }
      if (inSection) {
        let shouldStop = false;
        for (const stopRe of stopRegexes) {
          if (stopRe.test(line)) { shouldStop = true; break; }
        }
        if (shouldStop) break;
        result.push(line);
      }
    }
    return result.join('\n').trim();
  }

  function parseSimBehavior(raw) {
    if (!raw) return null;
    return {
      typeA: extractH3Block(raw, 'Type A prospect variation'),
      typeB: extractH3Block(raw, 'Type B prospect variation'),
      voiceTone: extractH3Block(raw, 'Voice tone'),
      frictionBudget: extractH3Block(raw, 'Friction budget'),
      special: extractH3Block(raw, 'Special'),
      otherSections: getH3Titles(raw)
    };
  }

  // Parse the SCOOP / LAYER 3 FEARS section
  function parseScoop(raw) {
    if (!raw) return null;
    const result = {
      deployLanguage: extractH3Block(raw, 'Scoop deployment'),
      permissionPreamble: extractH3Block(raw, 'Permission preamble'),
      typeAFears: [],
      typeBFears: [],
      somaticSignals: [],
      intellectualSignals: [],
      toneNotes: extractH3Block(raw, 'Tone notes'),
      stage2Handoff: extractH3Block(raw, 'Stage 2 handoff')
    };

    // Type A fears
    const typeAblock = extractH3Block(raw, 'Type A');
    if (typeAblock) {
      // Extract quoted bullet samples (reuse pattern from prospect engine)
      typeAblock.split('\n').forEach(line => {
        let m = line.match(/^\s*-\s+"(.+)"\s*$/);
        if (m) { result.typeAFears.push(m[1].trim()); return; }
        m = line.match(/^\s*-\s+\u201C(.+)\u201D\s*$/);
        if (m) result.typeAFears.push(m[1].trim());
      });
    }

    // Type B fears
    const typeBblock = extractH3Block(raw, 'Type B');
    if (typeBblock) {
      typeBblock.split('\n').forEach(line => {
        let m = line.match(/^\s*-\s+"(.+)"\s*$/);
        if (m) { result.typeBFears.push(m[1].trim()); return; }
        m = line.match(/^\s*-\s+\u201C(.+)\u201D\s*$/);
        if (m) result.typeBFears.push(m[1].trim());
      });
    }

    // Aha detection signals
    const ahaBlock = extractH3Block(raw, 'Aha detection');
    if (ahaBlock) {
      // Look for "Somatic aha" and "Intellectual aha" markers
      const lines = ahaBlock.split('\n');
      let mode = null;
      lines.forEach(line => {
        if (/somatic aha/i.test(line)) { mode = 'somatic'; return; }
        if (/intellectual aha/i.test(line)) { mode = 'intellectual'; return; }
        const m = line.match(/^\s*-\s+(.+)$/);
        if (m && mode) {
          if (mode === 'somatic') result.somaticSignals.push(m[1].trim());
          else result.intellectualSignals.push(m[1].trim());
        }
      });
    }

    return result;
  }

  // ===================================================================
  // MAIN
  // ===================================================================
  function parse(markdown, filename) {
    if (!markdown || typeof markdown !== 'string') {
      throw new Error('LexiconParser.parse() requires markdown string');
    }
    const sections = splitIntoSections(markdown);
    return {
      filename: filename || null,
      title: sections._title,
      category: parseCategory(sections._raw.category),
      layer1: parseLayer1(sections._raw.layer1),
      criticalFraming: sections._raw.criticalFraming || null,
      diagnosticQuestion: sections._raw.diagnosticQuestion || null,
      gapQuestion: sections._raw.gapQuestion || null,
      script: parseScriptPath(sections._raw.scriptPath),
      paths: parseDiagnosticPaths(sections._raw.diagnosticPaths),
      sweepTransition: sections._raw.sweepTransition ? sections._raw.sweepTransition.trim() : null,
      simBehavior: parseSimBehavior(sections._raw.simBehavior),
      scoop: parseScoop(sections._raw.scoop),
      _rawSections: sections._raw
    };
  }

  function validate(parsed) {
    return {
      hasTitle: !!parsed.title,
      hasCategory: !!parsed.category,
      hasCategoryLetter: !!(parsed.category && parsed.category.letter),
      hasLayer1: !!parsed.layer1,
      hasLayer1Past: !!(parsed.layer1 && parsed.layer1.past.length > 0),
      hasLayer1Present: !!(parsed.layer1 && parsed.layer1.present.length > 0),
      hasLayer2Patterns: !!(parsed.layer1 && parsed.layer1.layer2Patterns.length > 0),
      hasCriticalFraming: !!parsed.criticalFraming,
      hasScript: !!parsed.script,
      scriptLetterCount: parsed.script ? Object.keys(parsed.script.letters).length : 0,
      primaryLetters: parsed.script ? parsed.script.primaryLetters : [],
      hasDiagnosticPaths: !!(parsed.paths && parsed.paths.length > 0),
      pathCount: parsed.paths ? parsed.paths.length : 0,
      totalAnalogies: parsed.paths ? parsed.paths.reduce((s, p) => s + (p.analogies ? p.analogies.length : 0), 0) : 0,
      hasSweepTransition: !!parsed.sweepTransition,
      hasSimBehavior: !!parsed.simBehavior,
      hasTypeAVariation: !!(parsed.simBehavior && parsed.simBehavior.typeA),
      hasTypeBVariation: !!(parsed.simBehavior && parsed.simBehavior.typeB),
      hasSpecialDiagnostic: !!parsed.diagnosticQuestion,
      hasGapQuestion: !!parsed.gapQuestion
    };
  }

  return { parse, validate };
})();

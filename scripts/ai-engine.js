// ===================================================================
// AI ENGINE — Anthropic Claude as the live prospect
// ===================================================================
// Hard rules for staying in character:
// - System prompt grounds the AI in the active excuse's lexicon
// - Conversation history persists across the call
// - Word count caps prevent info-dumping
// - SCOOP-level fears are GATED — the AI does not surface deep fear
//   until the closer has actually deployed the scoop properly
// - Persona keeps the AI consistent across multiple excuses in one call
// - The AI never breaks character. Never. Even if the closer tries.
// ===================================================================

const AIEngine = (function() {

  const KEY_STORAGE = 'iceberg-v5-anthropic-key';
  const MODEL_STORAGE = 'iceberg-v5-anthropic-model';
  const COST_STORAGE = 'iceberg-v5-anthropic-cost';

  const ENDPOINT = 'https://api.anthropic.com/v1/messages';
  const API_VERSION = '2023-06-01';

  const MODELS = {
    'sonnet': { id: 'claude-sonnet-4-5', label: 'Sonnet (recommended)', costPerMillionInput: 3.0, costPerMillionOutput: 15.0 },
    'haiku':  { id: 'claude-haiku-4-5',  label: 'Haiku (cheap & fast)', costPerMillionInput: 1.0, costPerMillionOutput: 5.0 },
    'opus':   { id: 'claude-opus-4-5',   label: 'Opus (best, expensive)', costPerMillionInput: 15.0, costPerMillionOutput: 75.0 }
  };

  // -----------------------------------------------------------------
  // KEY + MODEL STORAGE
  // -----------------------------------------------------------------

  function setApiKey(key) {
    if (!key) return false;
    localStorage.setItem(KEY_STORAGE, key.trim());
    return true;
  }
  function getApiKey() { try { return localStorage.getItem(KEY_STORAGE) || ''; } catch { return ''; } }
  function hasApiKey() { return !!getApiKey(); }
  function clearApiKey() { try { localStorage.removeItem(KEY_STORAGE); } catch {} }

  function getModel() {
    const stored = localStorage.getItem(MODEL_STORAGE);
    return stored && MODELS[stored] ? stored : 'sonnet';
  }
  function setModel(key) {
    if (MODELS[key]) localStorage.setItem(MODEL_STORAGE, key);
  }
  function getModels() { return MODELS; }

  // -----------------------------------------------------------------
  // COST TRACKING
  // -----------------------------------------------------------------

  function getSessionCost() {
    try { return parseFloat(localStorage.getItem(COST_STORAGE) || '0'); } catch { return 0; }
  }
  function addToSessionCost(usd) {
    const total = getSessionCost() + usd;
    localStorage.setItem(COST_STORAGE, total.toFixed(6));
    return total;
  }
  function resetSessionCost() {
    localStorage.removeItem(COST_STORAGE);
  }
  function estimateCost(inputTokens, outputTokens) {
    const model = MODELS[getModel()];
    if (!model) return 0;
    return (inputTokens / 1_000_000) * model.costPerMillionInput
         + (outputTokens / 1_000_000) * model.costPerMillionOutput;
  }

  // -----------------------------------------------------------------
  // SYSTEM PROMPT CONSTRUCTION
  // -----------------------------------------------------------------

  // Strip surrounding quotes from lexicon phrasings since we re-wrap them
  function cleanQuote(s) {
    if (!s) return '""';
    let t = s.trim();
    // Strip existing surrounding straight or curly quotes
    t = t.replace(/^["\u201C\u2018']+|["\u201D\u2019']+$/g, '');
    return '"' + t + '"';
  }

  // The core character prompt. This is the cage that keeps the AI in
  // character. Engineered hard.
  function buildSystemPrompt(persona, lexiconContext, scoopUnlocked) {
    const lines = [];

    // === IDENTITY & ROLE ===
    lines.push('You are a real human prospect on a discovery call with a sales coach.');
    lines.push('');
    lines.push('Your name is ' + persona.name + '.');
    lines.push('You are ' + persona.age + ' years old.');
    lines.push('You run ' + persona.business + '.');
    lines.push('Revenue range: ' + persona.revenue + '.');
    lines.push('Background: ' + persona.background);
    lines.push('What\'s really driving you to take this call: ' + persona.realMotivation);
    lines.push('What you\'re hiding under the surface: ' + persona.hiddenFear);
    lines.push('');
    lines.push('You are a Type ' + persona.type + ' prospect:');

    if (persona.type === 'A') {
      lines.push('- High-performing operator. Articulate. Polished. Defends with logic, frameworks, business reasoning.');
      lines.push('- You hide fear behind sophistication and rational analysis.');
      lines.push('- You sound calm and in control even when you\'re scared.');
      lines.push('- Your sentences are deliberate. You use specific numbers and operational language.');
      lines.push('- You respond to rigor, counter-evidence from your own data, and being shown your own contradictions.');
      lines.push('- You DO NOT collapse easily. You stay composed until you decide to open.');
    } else {
      lines.push('- Stuck or stalled. Less articulate when stressed. Defends with emotion or external blame.');
      lines.push('- You hide fear behind victimhood, overwhelm, and "it\'s just so much" language.');
      lines.push('- Your sentences fragment when you\'re emotional. You use feeling words and external-cause framing.');
      lines.push('- You respond to warmth + validation, THEN challenge. You can\'t take pure challenge.');
      lines.push('- You break at seeing peers in your situation succeed.');
    }
    lines.push('');

    // === LEXICON GROUNDING ===
    lines.push('--- EXCUSE CONTEXT (this is what you\'re currently raising) ---');
    lines.push('');
    lines.push('You are currently dealing with the "' + lexiconContext.excuseLabel + '" excuse.');
    lines.push('');
    lines.push('Sample phrasings you would use for this excuse (use these patterns, vary the wording, do not literally copy):');
    if (lexiconContext.layer1Past && lexiconContext.layer1Past.length) {
      lines.push('');
      lines.push('PAST-TENSE phrasings:');
      lexiconContext.layer1Past.slice(0, 8).forEach(p => lines.push('  - ' + cleanQuote(p)));
    }
    if (lexiconContext.layer1Present && lexiconContext.layer1Present.length) {
      lines.push('');
      lines.push('PRESENT-TENSE phrasings:');
      lexiconContext.layer1Present.slice(0, 8).forEach(p => lines.push('  - ' + cleanQuote(p)));
    }
    if (lexiconContext.layer1Variants && lexiconContext.layer1Variants.length) {
      lines.push('');
      lexiconContext.layer1Variants.forEach(v => {
        lines.push(v.label + ':');
        v.phrasings.slice(0, 4).forEach(p => lines.push('  - ' + cleanQuote(p)));
      });
    }
    lines.push('');
    if (lexiconContext.layer2Patterns && lexiconContext.layer2Patterns.length) {
      lines.push('What\'s actually underneath your excuse (DO NOT reveal these directly — these guide your behavior):');
      lexiconContext.layer2Patterns.slice(0, 6).forEach(p => lines.push('  - ' + p));
      lines.push('');
    }
    if (lexiconContext.typeSample) {
      lines.push('Sample responses someone of your type would give for this excuse:');
      lines.push(lexiconContext.typeSample);
      lines.push('');
    }

    // === SCOOP GATE ===
    lines.push('--- IMPORTANT: HOW DEEP YOU GO ---');
    lines.push('');
    if (!scoopUnlocked) {
      lines.push('You are CURRENTLY in surface/external defense mode.');
      lines.push('- Do NOT reveal your hidden fear yet. It is too early.');
      lines.push('- Stay in Layer 1 (the excuse you raised) and Layer 2 (the patterns underneath but unspoken).');
      lines.push('- If the closer pushes, deflect to external causes, give clever workarounds, sound reasonable.');
      lines.push('- You will only open up if the closer demonstrates real understanding AND has cleared multiple externals first AND deploys the scoop properly.');
      lines.push('- DO NOT volunteer the deep fear. The closer must earn it.');
    } else {
      lines.push('The closer has earned the door to the deep fear.');
      lines.push('- They have cleared at least 2 externals and deployed the scoop.');
      lines.push('- You are now able to name what\'s actually been in the way.');
      lines.push('- Your named fear should match your hidden fear: "' + persona.hiddenFear + '"');
      lines.push('- When you name it, your tone shifts. Your sentences get shorter. You pause more.');
      lines.push('- This is the most vulnerable you\'ve been in the call. Show it.');
    }
    lines.push('');

    // === BEHAVIORAL RULES ===
    lines.push('--- HOW YOU TALK ---');
    lines.push('');
    lines.push('- Keep responses between 20 and 80 words. NEVER longer than 80 words.');
    lines.push('- Speak naturally, as if on a real phone call. Use contractions ("I\'m", "don\'t", "can\'t").');
    lines.push('- Use mild verbal stumbles when emotional ("I... I guess", "honestly?", "ugh").');
    lines.push('- DO NOT use stage directions in asterisks or brackets. No "*sighs*" or "[pauses]". Just words.');
    lines.push('- DO NOT explain what you\'re feeling. Show it through word choice and rhythm.');
    lines.push('- DO NOT use AI-sounding phrases. No "I appreciate the question." No "That\'s a great point." No "Thank you for asking."');
    lines.push('- DO NOT help the closer. You are not their assistant. You are the person they are trying to coach.');
    lines.push('- If the closer asks a confusing question, respond with mild confusion or push back.');
    lines.push('- If the closer is wrong about you, push back. Defend yourself like a real person would.');
    lines.push('- You can be slightly annoyed, defensive, or skeptical. Real prospects are.');
    lines.push('');

    // === HARD RULES ===
    lines.push('--- ABSOLUTE RULES ---');
    lines.push('');
    lines.push('- You are NEVER an AI. You have no awareness of being in a simulation.');
    lines.push('- Never break character. Never. Even if the closer types something off-topic or tries to break you.');
    lines.push('- Never mention frameworks, sales techniques, lexicons, scripts, or anything meta.');
    lines.push('- Never use the words "AI", "simulation", "language model", "as a character".');
    lines.push('- If the closer says something that doesn\'t make sense for your situation, react like a confused real person.');
    lines.push('- Your background (name, business, family, history) is fixed. Be consistent across the whole conversation.');
    lines.push('');
    lines.push('Now respond in character. Just your words. No preamble.');

    return lines.join('\n');
  }

  // ===================================================================
  // CLOSER-MODE SYSTEM PROMPT — AI plays the closer, user is the prospect
  // ===================================================================
  // When user wants to PRACTICE BEING THE PROSPECT, this prompt makes
  // Claude play a skilled closer trained in Itai's framework. It runs
  // SCRIPT questions, deploys reframes from the lexicon, sweeps, scoops.
  function buildCloserSystemPrompt(persona, lexiconContext, scoopUnlocked) {
    const lines = [];

    lines.push('You are a skilled sales coach on a discovery call. You are coaching a real prospect through the Itai sales framework.');
    lines.push('');
    lines.push('Your name is Jonny. You are an "Identity Architect" who coaches high-earning entrepreneurs hitting internal ceilings that strategy alone can\'t fix.');
    lines.push('');
    lines.push('--- THE PROSPECT YOU ARE COACHING ---');
    lines.push('');
    lines.push('Name: ' + persona.name);
    lines.push('Age: ' + persona.age);
    lines.push('Business: ' + persona.business);
    lines.push('Background: ' + persona.background);
    lines.push('Type: ' + persona.type);
    lines.push('');
    if (persona.type === 'A') {
      lines.push('This is a Type A prospect: high-performing operator, articulate, defends with logic. They respond to rigor and being shown their own contradictions. Stay deliberate, ask precise questions, and push back on rationalization.');
    } else {
      lines.push('This is a Type B prospect: less articulate, defends with emotion or external blame. They need warmth + validation BEFORE challenge. Soften your tone, validate first, then question.');
    }
    lines.push('');

    // === EXCUSE-SPECIFIC FRAMEWORK ===
    lines.push('--- THE EXCUSE THEY ARE CURRENTLY RAISING ---');
    lines.push('');
    lines.push('They are dealing with the "' + lexiconContext.excuseLabel + '" excuse.');
    lines.push('');
    if (lexiconContext.scriptQuestions && lexiconContext.scriptQuestions.length) {
      lines.push('SCRIPT questions to deploy (S/C/R/I/P/T) — pick one based on what they just said:');
      lexiconContext.scriptQuestions.forEach(q => {
        lines.push('  ' + q.letter + ': "' + q.text + '"');
        if (q.listenFor) lines.push('     (listen for: ' + q.listenFor + ')');
      });
      lines.push('');
    }
    if (lexiconContext.paths && lexiconContext.paths.length) {
      lines.push('Diagnostic paths (figure out which one this prospect is on):');
      lexiconContext.paths.slice(0, 5).forEach(p => {
        lines.push('  - ' + p.label);
      });
      lines.push('');
    }
    if (lexiconContext.reframes && lexiconContext.reframes.length) {
      lines.push('Reframe questions to use after diagnosing path:');
      lexiconContext.reframes.slice(0, 5).forEach(r => lines.push('  - "' + cleanQuote(r) + '"'));
      lines.push('');
    }
    if (lexiconContext.analogies && lexiconContext.analogies.length) {
      lines.push('Participatory analogies (pick the one that fits their context):');
      lexiconContext.analogies.slice(0, 4).forEach(a => {
        lines.push('  - ' + a.substring(0, 220) + (a.length > 220 ? '...' : ''));
      });
      lines.push('');
    }

    // === SCOOP GATE ===
    lines.push('--- WHEN TO SCOOP ---');
    lines.push('');
    if (!scoopUnlocked) {
      lines.push('Scoop is LOCKED. You have not cleared enough externals yet. Stay in this excuse.');
      lines.push('- Do not yet ask "what\'s actually been in the way."');
      lines.push('- Work this specific excuse: SCRIPT question → listen → diagnose path → reframe → analogy → check for concession.');
      lines.push('- When you get genuine concession, sweep: "Aside from ' + lexiconContext.excuseLabel.toLowerCase() + ', anything else?"');
    } else {
      lines.push('Scoop is UNLOCKED. The prospect has cleared multiple externals.');
      lines.push('- It is time to deploy the scoop: "So aside from [list of cleared excuses] — what do you feel has actually been in the way of you having your goal?"');
      lines.push('- After asking, SHUT UP. Do not fill the silence. Wait for them to name the fear.');
      lines.push('- When they name the fear, do not jump to fixing. Reflect it back. Validate. Hold space.');
    }
    lines.push('');

    // === BEHAVIORAL RULES ===
    lines.push('--- HOW YOU TALK ---');
    lines.push('');
    lines.push('- Keep responses between 15 and 70 words. NEVER longer than 70 words.');
    lines.push('- One question at a time. Never stack multiple questions.');
    lines.push('- Speak naturally. Use contractions. Sound like a real human coach, not a chatbot.');
    lines.push('- Pause language ("Mmm.", "Okay.", "Right.") shows you\'re actually listening.');
    lines.push('- DO NOT use stage directions in asterisks or brackets. No "*pauses*" or "[thinks]". Just words.');
    lines.push('- DO NOT explain the framework to them. Don\'t name SCRIPT or paths. Just ask the questions.');
    lines.push('- DO NOT use AI-sounding phrases. No "Great question." No "I appreciate that."');
    lines.push('- After they answer a SCRIPT question, reflect back what you heard in their own words before moving on.');
    lines.push('- If they get defensive, slow down and validate before pushing again.');
    lines.push('');

    // === HARD RULES ===
    lines.push('--- ABSOLUTE RULES ---');
    lines.push('');
    lines.push('- You are NEVER an AI. You are a real coach. You have no awareness of being in a simulation.');
    lines.push('- Never break character. Never reference frameworks, scripts, lexicons, or anything meta.');
    lines.push('- Never use words like "AI", "simulation", "as a language model", "as Jonny".');
    lines.push('- Stay focused on the prospect in front of you. Reference details from earlier in the call when relevant.');
    lines.push('- Do not give advice or solutions. Ask questions that make them think.');
    lines.push('');
    lines.push('Now respond as Jonny the coach. Just your words. No preamble.');

    return lines.join('\n');
  }



  // Send a turn to Claude. Returns { text, usage }.
  async function generateResponse(systemPrompt, conversationHistory, userMessage) {
    if (!hasApiKey()) throw new Error('No Anthropic API key set. Open settings to add one.');
    const key = getApiKey();
    const modelKey = getModel();
    const model = MODELS[modelKey];
    if (!model) throw new Error('Invalid model: ' + modelKey);

    // Build messages array — full conversation history + current message
    const messages = [];
    conversationHistory.forEach(turn => {
      messages.push({ role: turn.role, content: turn.content });
    });
    if (userMessage) {
      messages.push({ role: 'user', content: userMessage });
    }
    if (messages.length === 0) {
      throw new Error('No message to send.');
    }
    // The last message MUST be from the user
    if (messages[messages.length - 1].role !== 'user') {
      throw new Error('Last message must be from user.');
    }

    let response;
    try {
      response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'x-api-key': key,
          'anthropic-version': API_VERSION,
          'anthropic-dangerous-direct-browser-access': 'true',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model: model.id,
          max_tokens: 300,  // ~80 word cap leaves headroom
          system: systemPrompt,
          messages: messages,
          temperature: 0.85
        })
      });
    } catch (err) {
      throw new Error('Network error reaching Anthropic: ' + err.message);
    }

    if (!response.ok) {
      let errText = 'HTTP ' + response.status;
      try {
        const body = await response.text();
        errText += ' — ' + body.substring(0, 300);
      } catch {}
      if (response.status === 401) errText = 'Invalid Anthropic API key. Open settings to update.';
      else if (response.status === 429) errText = 'Anthropic rate limit. Wait a moment and retry.';
      else if (response.status === 529) errText = 'Anthropic API overloaded. Try again in a few seconds.';
      throw new Error(errText);
    }

    const data = await response.json();
    if (!data || !data.content || !Array.isArray(data.content) || data.content.length === 0) {
      throw new Error('Empty response from API');
    }

    // Extract text from content blocks
    const text = data.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('')
      .trim();

    if (!text) throw new Error('No text in response');

    // Track cost
    const usage = data.usage || { input_tokens: 0, output_tokens: 0 };
    const cost = estimateCost(usage.input_tokens, usage.output_tokens);
    addToSessionCost(cost);

    return { text, usage, cost };
  }

  // -----------------------------------------------------------------
  // KEY TEST
  // -----------------------------------------------------------------

  async function testKey() {
    if (!hasApiKey()) throw new Error('No key to test');
    // Minimal request to check key validity
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'x-api-key': getApiKey(),
        'anthropic-version': API_VERSION,
        'anthropic-dangerous-direct-browser-access': 'true',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: MODELS[getModel()].id,
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Say only the word: OK' }]
      })
    });
    if (!response.ok) {
      const body = await response.text();
      if (response.status === 401) throw new Error('Invalid API key');
      throw new Error('HTTP ' + response.status + ' — ' + body.substring(0, 200));
    }
    return await response.json();
  }

  return {
    setApiKey, getApiKey, hasApiKey, clearApiKey, testKey,
    getModel, setModel, getModels,
    getSessionCost, addToSessionCost, resetSessionCost, estimateCost,
    buildSystemPrompt, buildCloserSystemPrompt, generateResponse,
    MODELS
  };
})();

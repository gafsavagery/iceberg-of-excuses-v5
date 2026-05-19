// ===================================================================
// PERSONA GENERATOR
// ===================================================================
// Builds a prospect persona for the AI to play. Two modes:
//
// 1. AUTO — randomly generated persona matching Jonny's ICP
//    (high-earning entrepreneur, internal ceiling, not strategy-fixable)
//
// 2. BRIEF — the closer types/pastes a description and we parse it into
//    a structured persona. Supports replaying real botched calls.
// ===================================================================

const PersonaGenerator = (function() {

  // -----------------------------------------------------------------
  // AUTO-GENERATED PERSONAS
  // -----------------------------------------------------------------
  // Pool of components — randomly combined.

  const FIRST_NAMES_M = ['Marcus','David','Jordan','Ryan','Adam','Chris','Brandon','Mike','Tyler','Jason','Eric','Kevin'];
  const FIRST_NAMES_F = ['Sarah','Lauren','Jessica','Amanda','Rachel','Megan','Ashley','Brittany','Lindsay','Nicole','Erin','Kelly'];

  const BUSINESS_PROFILES = [
    { type: 'a SaaS company', revenue: '$3-5M ARR', staff: '15-25 employees' },
    { type: 'an e-commerce brand', revenue: '$8-12M annual', staff: '8-15 employees + agency' },
    { type: 'a real estate investment firm', revenue: '$50M AUM', staff: '4-8 people' },
    { type: 'a marketing agency', revenue: '$2-4M annual', staff: '12-20 employees' },
    { type: 'a private medical practice', revenue: '$4-7M annual', staff: '15-25 people' },
    { type: 'a coaching/consulting business', revenue: '$1-3M annual', staff: '3-8 contractors' },
    { type: 'an HVAC/contracting business', revenue: '$5-9M annual', staff: '20-35 employees' },
    { type: 'a fitness brand', revenue: '$2-5M annual', staff: '8-15 trainers + staff' },
    { type: 'a hospitality group', revenue: '$10-18M annual', staff: '40-80 employees' },
    { type: 'a financial advisory firm', revenue: '$200M AUM', staff: '5-10 people' }
  ];

  const BACKGROUNDS_M = [
    'Self-made. Built the business from scratch over the last 8-12 years. Used to grind 80-hour weeks. Now married with two kids.',
    'Took over the family business and 4x\'ed it. Father still around. Constant comparison to his legacy. Two kids in elementary school.',
    'Sold a previous business in his 30s, this is round two. Wife thinks he should retire. He doesn\'t want to.',
    'Climbed the corporate ladder, left at 38 to start this. Wife was the breadwinner during the gap. Still feels that pressure.',
    'Built it during the pandemic. Single dad. Stuff worked, scaled fast, now hitting walls he didn\'t see coming.'
  ];

  const BACKGROUNDS_F = [
    'Self-made. Started the business after leaving a corporate role. Married, two young kids. Husband supportive but doesn\'t fully get the entrepreneur grind.',
    'Single mom. Built the business while raising kids alone. Identity is wrapped up in being the one who carries everything.',
    'Took over a struggling family business and turned it around. Brothers stayed in corporate. She\'s "the entrepreneur" of the family.',
    'Left a high-earning W2 to start this 6 years ago. Has out-earned her old salary by 3x but never lets herself enjoy it.',
    'Was an executive at a big firm, broke out on her own. Husband stays at home with the kids now. She feels pressure to never let him down.'
  ];

  const REAL_MOTIVATIONS = [
    'You\'re burnt out and starting to resent the business you built. You haven\'t admitted it to anyone yet.',
    'You watched a peer sell their business for 8 figures and you felt sick about it. You want to grow but you\'re terrified of what growth requires.',
    'Your marriage is strained because you can\'t be present. You don\'t know how to fix that without losing what you\'ve built.',
    'You hit a revenue ceiling 2 years ago and nothing has worked. You\'re starting to wonder if YOU are the ceiling.',
    'You\'ve been the bottleneck of your own company for years. You don\'t trust anyone else to do it right. You\'re tired of that being your story.',
    'You saw a coach\'s content and something in it hit. But you don\'t want to admit that someone could see something you can\'t.',
    'Your kid said something recently that gutted you. You realized you don\'t actually know how to be different than you\'ve been.'
  ];

  const HIDDEN_FEARS_A = [
    'That you got lucky and you\'re not actually as good as everyone thinks. Fraud exposure.',
    'That if you let go of the control, the whole thing falls apart and proves you needed to grind all along.',
    'That without the grind, you don\'t know who you are. Identity dissolution.',
    'That you\'ve been performing competence for so long that you don\'t know what\'s real anymore.',
    'That asking for help means you weren\'t enough on your own.'
  ];

  const HIDDEN_FEARS_B = [
    'That you\'re fundamentally not capable of having what your peers have, and trying again will prove it.',
    'That if you really try and it doesn\'t work, you\'ll have to face that this is just who you are.',
    'That you\'ve disappointed the people who believed in you, and asking for help means admitting that.',
    'That you\'ve been lying to yourself for years about why you\'re stuck, and the truth is unbearable.',
    'That your stuckness is permanent and no investment will change it.'
  ];

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

  function generateAutoPersona(prospectType) {
    const isFemale = Math.random() < 0.45;
    const name = isFemale ? pick(FIRST_NAMES_F) : pick(FIRST_NAMES_M);
    const age = randInt(34, 52);
    const business = pick(BUSINESS_PROFILES);
    const background = isFemale ? pick(BACKGROUNDS_F) : pick(BACKGROUNDS_M);
    const motivation = pick(REAL_MOTIVATIONS);
    const fear = prospectType === 'A' ? pick(HIDDEN_FEARS_A) : pick(HIDDEN_FEARS_B);

    return {
      source: 'auto',
      type: prospectType,
      name: name,
      age: age,
      gender: isFemale ? 'female' : 'male',
      business: business.type + ' (' + business.revenue + ', ' + business.staff + ')',
      revenue: business.revenue,
      background: background,
      realMotivation: motivation,
      hiddenFear: fear,
      raw: null
    };
  }

  // -----------------------------------------------------------------
  // BRIEF-BASED PERSONA
  // -----------------------------------------------------------------
  // The closer types/pastes a description. We don't try to NLP-parse it
  // perfectly — we just embed the raw brief into the persona's metadata
  // and let the AI's system prompt use it.

  function generatePersonaFromBrief(briefText, prospectType) {
    if (!briefText || !briefText.trim()) {
      return generateAutoPersona(prospectType);
    }
    return {
      source: 'brief',
      type: prospectType,
      name: extractName(briefText) || pickRandomName(),
      age: extractAge(briefText) || randInt(35, 50),
      gender: extractGender(briefText),
      business: extractBusiness(briefText) || 'their business (mid-7 to 8-figure range)',
      revenue: extractRevenue(briefText) || 'mid-7 to low-8 figures',
      background: briefText.trim(),  // raw brief as background
      realMotivation: 'See background brief',
      hiddenFear: prospectType === 'A' ? pick(HIDDEN_FEARS_A) : pick(HIDDEN_FEARS_B),
      raw: briefText.trim()
    };
  }

  // Loose extractors — heuristic, not perfect
  function extractName(text) {
    // Match "named Marcus" or "called Marcus"
    let m = text.match(/(?:named|called)\s+([A-Z][a-z]+)/);
    if (m) return m[1];
    // Match a capitalized name at the start of the brief, before a comma
    m = text.match(/^([A-Z][a-z]+),/);
    if (m) return m[1];
    // Match "[Name] is" or "[Name] runs"
    m = text.match(/^([A-Z][a-z]+)\s+(?:is|runs|owns|started|built|founded)/);
    if (m) return m[1];
    return null;
  }
  function extractAge(text) {
    const m = text.match(/(\d{2})[\s-]?(?:year|yr|y\.o\.?)/i);
    return m ? parseInt(m[1]) : null;
  }
  function extractGender(text) {
    if (/\bshe\b|\bher\b|\bwoman\b|\bfemale\b|\bmother\b|\bmom\b/i.test(text)) return 'female';
    if (/\bhe\b|\bhim\b|\bman\b|\bmale\b|\bfather\b|\bdad\b/i.test(text)) return 'male';
    return Math.random() < 0.5 ? 'male' : 'female';
  }
  function extractRevenue(text) {
    const m = text.match(/\$?\d+[KMm]?(?:[\s-]+\$?\d+[KMm]?)?\s*(?:revenue|annual|ARR|MRR)/i);
    return m ? m[0] : null;
  }
  function extractBusiness(text) {
    // Look for common business descriptors
    const m = text.match(/(SaaS|agency|coach(?:ing)?|real estate|consulting|e-?commerce|brand|practice|firm|service|HVAC|hospitality|fitness|gym|restaurant)[^.,]*/i);
    return m ? m[0] : null;
  }
  function pickRandomName() {
    return Math.random() < 0.5 ? pick(FIRST_NAMES_M) : pick(FIRST_NAMES_F);
  }

  // -----------------------------------------------------------------
  // Render the persona as a summary card text
  // -----------------------------------------------------------------

  function renderSummary(persona) {
    if (!persona) return '';
    const lines = [];
    lines.push('**' + persona.name + '** · ' + persona.age + ' · Type ' + persona.type);
    lines.push('*' + persona.business + '*');
    if (persona.source === 'brief' && persona.raw) {
      lines.push('');
      lines.push('Brief: ' + persona.raw.substring(0, 200) + (persona.raw.length > 200 ? '...' : ''));
    } else {
      lines.push('');
      lines.push(persona.background);
    }
    return lines.join('\n');
  }

  return {
    generateAutoPersona,
    generatePersonaFromBrief,
    renderSummary
  };
})();

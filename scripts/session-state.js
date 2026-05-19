// ===================================================================
// SESSION STATE
// ===================================================================
// Tracks the WHOLE call across multiple excuse drills.
// Persists when "back to picker" is hit. Reset only on full session reset.
//
// Session contains:
// - prospectType: 'A' or 'B' (chosen at start, can toggle mid-session)
// - excusesCleared: ordered array of { chip, path, analogy, concession, completedAt }
// - currentDrill: id of drill in progress (or null between drills)
// - scoopUnlocked: boolean — true once 2+ externals cleared
// - scoopOverride: boolean — closer pressed "override gate"
// - namedFear: the fear once scooped (null until scoop completes)
// - ahaType: 'somatic' | 'intellectual' | null
// - callStartedAt: timestamp
// ===================================================================

const SessionState = (function() {

  let session = null;

  function init(prospectType) {
    session = {
      prospectType: prospectType || 'A',
      role: 'closer',
      mode: 'lexicon',
      aiPlays: 'prospect',  // 'prospect' (default — user is closer) | 'closer' (user is prospect)
      persona: null,
      excusesCleared: [],
      currentDrill: null,
      scoopUnlocked: false,
      scoopOverride: false,
      scoopDeployed: false,
      namedFear: null,
      ahaType: null,
      callStartedAt: new Date().toISOString()
    };
  }

  function ensureExists() {
    if (!session) init('A');
  }

  function get() {
    ensureExists();
    return session;
  }

  function setProspectType(type) {
    ensureExists();
    session.prospectType = type;
  }

  function getProspectType() {
    ensureExists();
    return session.prospectType;
  }

  function setRole(role) {
    ensureExists();
    session.role = role;
  }

  function getRole() {
    ensureExists();
    return session.role || 'closer';
  }

  function setMode(mode) {
    ensureExists();
    session.mode = mode;
  }

  function getMode() {
    ensureExists();
    return session.mode || 'lexicon';
  }

  function setPersona(persona) {
    ensureExists();
    session.persona = persona;
  }

  function getPersona() {
    ensureExists();
    return session.persona;
  }

  function setAiPlays(who) {
    ensureExists();
    session.aiPlays = who;
  }

  function getAiPlays() {
    ensureExists();
    return session.aiPlays || 'prospect';
  }

  function recordExcuseCleared(chip, path, analogyNumber, concession) {
    ensureExists();
    session.excusesCleared.push({
      chipId: chip.id,
      chipLabel: chip.label,
      pathLabel: path ? path.label : null,
      analogyNumber: analogyNumber,
      concession: concession,
      completedAt: new Date().toISOString()
    });
    // Auto-unlock scoop at 2 cleared externals
    if (session.excusesCleared.length >= 2) {
      session.scoopUnlocked = true;
    }
  }

  function getClearedCount() {
    ensureExists();
    return session.excusesCleared.length;
  }

  function getClearedExcuses() {
    ensureExists();
    return session.excusesCleared;
  }

  function getClearedExcuseLabels() {
    ensureExists();
    return session.excusesCleared.map(e => e.chipLabel);
  }

  function isScoopReady() {
    ensureExists();
    return session.scoopUnlocked || session.scoopOverride;
  }

  function isScoopGateUnlocked() {
    ensureExists();
    return session.scoopUnlocked;
  }

  function setScoopOverride() {
    ensureExists();
    session.scoopOverride = true;
  }

  function isOverridden() {
    ensureExists();
    return session.scoopOverride;
  }

  function markScoopDeployed() {
    ensureExists();
    session.scoopDeployed = true;
  }

  function isScoopDeployed() {
    ensureExists();
    return session.scoopDeployed;
  }

  function recordNamedFear(fearText, fearIndex, fearType) {
    ensureExists();
    session.namedFear = {
      text: fearText,
      index: fearIndex,
      type: fearType,
      recordedAt: new Date().toISOString()
    };
  }

  function getNamedFear() {
    ensureExists();
    return session.namedFear;
  }

  function recordAhaType(type) {
    ensureExists();
    session.ahaType = type;
  }

  function getAhaType() {
    ensureExists();
    return session.ahaType;
  }

  function reset() {
    session = null;
  }

  function getSummary() {
    ensureExists();
    return {
      prospectType: session.prospectType,
      excuseCount: session.excusesCleared.length,
      excuseLabels: session.excusesCleared.map(e => e.chipLabel),
      scoopUnlocked: session.scoopUnlocked,
      scoopOverride: session.scoopOverride,
      scoopDeployed: session.scoopDeployed,
      namedFear: session.namedFear ? session.namedFear.text : null,
      ahaType: session.ahaType,
      durationMin: Math.round((Date.now() - new Date(session.callStartedAt).getTime()) / 60000)
    };
  }

  return {
    init,
    get,
    setProspectType,
    getProspectType,
    setRole,
    getRole,
    setMode,
    getMode,
    setPersona,
    getPersona,
    setAiPlays,
    getAiPlays,
    recordExcuseCleared,
    getClearedCount,
    getClearedExcuses,
    getClearedExcuseLabels,
    isScoopReady,
    isScoopGateUnlocked,
    setScoopOverride,
    isOverridden,
    markScoopDeployed,
    isScoopDeployed,
    recordNamedFear,
    getNamedFear,
    recordAhaType,
    getAhaType,
    reset,
    getSummary
  };
})();

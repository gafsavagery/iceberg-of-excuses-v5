// ===================================================================
// CONVERSATION HISTORY
// ===================================================================
// Tracks every turn of the AI conversation across a full call session.
// One conversation per session (multi-excuse continuity).
// ===================================================================

const ConversationHistory = (function() {

  let turns = [];

  function reset() {
    turns = [];
  }

  function addUserTurn(text, meta) {
    turns.push({
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
      meta: meta || {}
    });
  }

  function addAssistantTurn(text, meta) {
    turns.push({
      role: 'assistant',
      content: text,
      timestamp: new Date().toISOString(),
      meta: meta || {}
    });
  }

  function getAll() {
    return turns.slice();
  }

  function getForAPI() {
    // Returns turns in the format Anthropic expects (role + content only).
    return turns.map(t => ({ role: t.role, content: t.content }));
  }

  function getLast(n) {
    return turns.slice(-n);
  }

  function getMostRecent() {
    if (turns.length === 0) return null;
    return turns[turns.length - 1];
  }

  function getMostRecentExchange() {
    // Returns up to last 2 turns (one user + one assistant)
    return turns.slice(-2);
  }

  function getLength() {
    return turns.length;
  }

  function removeLastAssistantTurn() {
    // Used for regenerate — remove the last AI response so we can retry
    if (turns.length === 0) return null;
    const last = turns[turns.length - 1];
    if (last.role === 'assistant') {
      return turns.pop();
    }
    return null;
  }

  // Build a markdown export of the conversation
  function exportAsMarkdown(persona) {
    const lines = [];
    lines.push('## Full conversation transcript');
    lines.push('');
    if (persona) {
      lines.push('**Prospect:** ' + persona.name + ' · Type ' + persona.type + ' · ' + persona.business);
      lines.push('');
      if (persona.raw) {
        lines.push('**Brief:** ' + persona.raw);
        lines.push('');
      }
    }
    if (turns.length === 0) {
      lines.push('*(No conversation captured.)*');
      return lines.join('\n');
    }
    turns.forEach(turn => {
      const speaker = turn.role === 'user' ? 'You (closer)' : (persona ? persona.name : 'Prospect');
      const time = new Date(turn.timestamp).toLocaleTimeString();
      lines.push('**' + speaker + '** · ' + time);
      lines.push('');
      lines.push('> ' + turn.content.replace(/\n/g, '\n> '));
      lines.push('');
    });
    return lines.join('\n');
  }

  return {
    reset, addUserTurn, addAssistantTurn,
    getAll, getForAPI, getLast, getMostRecent, getMostRecentExchange,
    getLength, removeLastAssistantTurn,
    exportAsMarkdown
  };
})();

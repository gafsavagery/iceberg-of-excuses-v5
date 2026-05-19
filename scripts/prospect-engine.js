// ===================================================================
// PROSPECT ENGINE
// ===================================================================
// Generates prospect responses by pulling from the lexicon file's
// Type A or Type B variation samples.
//
// Strategy: lexicon is the cage. We never improvise. We pick from
// the bullet-point samples in the typeA / typeB sections of the
// SIM BEHAVIOR NOTES.
//
// If a file has 3 sample responses, we pick one at random per turn.
// If we've used all 3 in a single drill, we cycle back (with a tag
// indicating "you've heard this one before").
// ===================================================================

const ProspectEngine = (function() {

  // Extract bulleted samples from a Type A or Type B variation block
  // Bullets look like:
  //   - "I'm running a $5M business..."
  //   - "Yeah, last year was rough..."
  //
  // Note: quoted strings may contain apostrophes inside, so we match
  // strictly on the OUTER quote character and accept anything between.
  function extractSamples(variationBlock) {
    if (!variationBlock) return [];
    const samples = [];
    const lines = variationBlock.split('\n');
    for (const line of lines) {
      // Straight double quotes
      let m = line.match(/^\s*-\s+"(.+)"\s*$/);
      if (m) { samples.push(m[1].trim()); continue; }
      // Straight single quotes (apostrophe used as quote)
      m = line.match(/^\s*-\s+'(.+)'\s*$/);
      if (m) { samples.push(m[1].trim()); continue; }
      // Curly double quotes (U+201C…U+201D)
      m = line.match(/^\s*-\s+\u201C(.+)\u201D\s*$/);
      if (m) { samples.push(m[1].trim()); continue; }
      // Curly single quotes (U+2018…U+2019)
      m = line.match(/^\s*-\s+\u2018(.+)\u2019\s*$/);
      if (m) { samples.push(m[1].trim()); continue; }
    }
    return samples;
  }

  // Pick a response for the prospect type, tracking which samples
  // have been used this drill to avoid repetition.
  function pickResponse(parsed, type, usedSamples) {
    if (!parsed || !parsed.simBehavior) return null;
    const block = type === 'A' ? parsed.simBehavior.typeA : parsed.simBehavior.typeB;
    const samples = extractSamples(block);
    if (samples.length === 0) {
      // Fallback: return the raw block text as one big "sample"
      return { text: block || '(no sample response available in lexicon)', isFallback: true, sampleIndex: -1 };
    }

    // Filter unused
    const unused = samples.map((s, i) => ({ s, i })).filter(x => !usedSamples.includes(x.i));
    let pick;
    if (unused.length > 0) {
      pick = unused[Math.floor(Math.random() * unused.length)];
    } else {
      // All used — cycle back
      const i = Math.floor(Math.random() * samples.length);
      pick = { s: samples[i], i: i, isRepeat: true };
    }

    return {
      text: pick.s,
      sampleIndex: pick.i,
      totalSamples: samples.length,
      isRepeat: !!pick.isRepeat,
      isFallback: false,
      type: type
    };
  }

  return { pickResponse, extractSamples };
})();

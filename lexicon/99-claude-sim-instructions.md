# CLAUDE INSTRUCTIONS — ICEBERG OF EXCUSES SIM v5.1 BUILD

**For Claude in the gafsavagery/iceberg-of-excuses repo chat. This document is the technical brief for implementing v5.1 of the sales training simulator based on the lexicon files in this package.**

---

## TABLE OF CONTENTS

1. Project Context
2. The Lexicon Files — What You're Working With
3. Current State (v4) vs. Target State (v5.1)
4. File Architecture — Folder Structure
5. The Core Interaction Model
6. Per-Card Render Specifications
7. Path Diagnosis Logic
8. Sweep-Before-Deep Enforcement
9. Somatic vs. Intellectual Aha Detection
10. Type A / Type B Prospect Selector
11. Voice Integration (ElevenLabs)
12. Role-Switching Mechanics
13. Past-Tense vs. Present-Tense Handling
14. What to Leave Alone in v4
15. What to Change in v4
16. Build Sequence Recommendations
17. Testing Criteria

---

## 1. PROJECT CONTEXT

The user is Jonny Crosby, founder of GratefulAF Coaching. He's an Identity Architect coaching high-earning entrepreneurs (6-9 figures). He's been drilling sales mechanics for months and is preparing to deploy real calls.

The Iceberg of Excuses sim is his primary practice tool. It teaches the Itai/Tristan Phase 2/3 framework — the work of moving a prospect from surface-level excuses (Layer 1) through behavioral patterns (Layer 2) to the actual fear underneath (Layer 3).

v4 is a chip-based interface with 20 chips across 5 categories. Each chip currently contains verbatim scripts from the Itai/Tristan transcripts. The sim works but doesn't enforce the framework's structural discipline (sweep-before-deep, SCRIPT labeling, participatory analogies, somatic aha detection).

**v5.1 is the upgrade to a diagnostic-based sim instead of a script-based one.** The closer should be making decisions at each step, not running through a fixed sequence. The sim's job is to surface the right card at the right moment based on what the prospect just said.

---

## 2. THE LEXICON FILES — WHAT YOU'RE WORKING WITH

This package contains 14 markdown files:

**Foundational (referenced by every excuse file):**
- `00-foundational-principles.md` — SCRIPT acronym, three layers, sweep rule, somatic aha, participatory analogies, Type A/B, friction budget

**13 excuse files (one per excuse):**
- `01-time.md`
- `02-wife-partner.md`
- `03-scam.md`
- `04-risk.md`
- `05-research.md`
- `06-death-kids-life-event.md`
- `07-debt.md`
- `08-do-it-myself.md`
- `09-self-doubt.md` (covers all 4 sub-types)
- `10-tried-before.md`
- `11-need-to-think.md`
- `12-overcommitment.md`
- `13-life-is-okay.md`

**Each excuse file follows the same internal structure:**

1. Header with category and reference to foundational principles
2. Layer 1 phrasings (past-tense + present-tense)
3. Critical framing notes
4. SCRIPT path (which letters apply for this excuse, with verbatim questions for each)
5. Diagnostic paths (typically 3: Path A, B, C)
6. For each path: follow-up questions, reframe questions, participatory analogies (graded A/B/C/D for ICP), transition language
7. Sweep transition language
8. Sim behavior notes (Type A vs Type B variations, voice tone, friction budget, special handling)

**The sim's job is to parse these files and render the right sections as cards based on the closer's progression through the call.**

---

## 3. CURRENT STATE (v4) VS. TARGET STATE (v5.1)

### v4 (Current)

- 20 chips across 5 categories (A through E)
- Tap chip → see content for that excuse
- Content is a flat block of transcript-sourced scripts
- No SCRIPT labeling on clarity questions
- No path diagnosis after initial question
- No sweep enforcement (closer can jump to fear extraction anytime)
- No somatic vs intellectual aha distinction
- No Type A / Type B variation
- No voice
- Mobile-first chip interface

### v5.1 (Target)

- 13 excuses (the lexicon files), loaded dynamically based on what the prospect raises
- Tap excuse → enter the full Phase 2/3 flow for that excuse
- Each flow has structured stages: Layer 1 → SCRIPT → Path Diagnosis → Reframe → Concession → Sweep
- SCRIPT letters labeled on each clarity question (S/C/R/I/P/T)
- Path A/B/C diagnosis card appears after SCRIPT, before reframe
- Sweep-before-deep enforced: scoop button locked until 2-3 externals cleared
- Somatic vs intellectual aha detection card appears after scoop
- Type A / Type B selector at sim start, affects prospect response patterns
- ElevenLabs voice integration for prospect TTS
- Role-switching: closer can play themselves OR play the prospect
- Past-tense / present-tense toggle on cards
- **Preserve** the mobile-first chip-based visual design

---

## 4. FILE ARCHITECTURE — FOLDER STRUCTURE

To avoid breaking the UI when updating content, separate the content layer from the rendering layer.

### Recommended folder structure

```
iceberg-of-excuses/
├── index.html                          # Main entry point (preserve from v4)
├── styles/
│   ├── main.css                        # Core styles (preserve from v4)
│   └── cards.css                       # New: card-specific styles
├── scripts/
│   ├── app.js                          # Main app logic
│   ├── card-renderer.js                # Renders cards from lexicon data
│   ├── path-diagnosis.js               # Path A/B/C logic
│   ├── sweep-tracker.js                # Tracks how many externals cleared
│   ├── aha-detector.js                 # Somatic vs intellectual logic
│   ├── voice-handler.js                # ElevenLabs integration
│   └── prospect-engine.js              # Type A/B response generation
├── lexicon/
│   ├── 00-foundational-principles.md   # Reference document
│   ├── 01-time.md
│   ├── 02-wife-partner.md
│   ├── 03-scam.md
│   ├── 04-risk.md
│   ├── 05-research.md
│   ├── 06-death-kids-life-event.md
│   ├── 07-debt.md
│   ├── 08-do-it-myself.md
│   ├── 09-self-doubt.md
│   ├── 10-tried-before.md
│   ├── 11-need-to-think.md
│   ├── 12-overcommitment.md
│   └── 13-life-is-okay.md
└── assets/
    └── voices/                         # ElevenLabs voice configs
```

### Critical separation principles

**Content (lexicon/) is independent of rendering (scripts/).** When Jonny wants to update a reframe question or add a new analogy, he edits the markdown file. The sim parses the markdown structure and renders cards accordingly. No JS changes required for content updates.

**Each excuse file is self-contained.** The sim loads one file at a time based on what the prospect surfaces. Don't merge files. Don't create dependencies between excuse files.

**The foundational principles file is reference-only.** It's not loaded as cards. It exists to define terms (SCRIPT, sweep, aha types, Type A/B) that the renderer uses. When Jonny updates foundational principles, the changes propagate through all interactions.

---

## 5. THE CORE INTERACTION MODEL

The sim simulates a sales call where Jonny (the closer) is talking to a prospect about a coaching offer. The flow is:

### At call start

1. Closer selects Type A or Type B prospect
2. Closer selects role: "I'll play closer" or "I'll play prospect"
3. Sim presents a starting prompt: "Why hasn't this happened yet?" (or equivalent opening to surface Layer 1 excuses)

### When prospect surfaces a Layer 1 excuse

1. Closer taps the chip for that excuse (or sim auto-detects via voice/text input)
2. Sim loads the corresponding lexicon file
3. Sim renders Layer 1 statement card showing the prospect's phrasing (past or present tense based on context)
4. Sim renders SCRIPT options card

### During SCRIPT deployment

1. Closer selects which SCRIPT letter to deploy (S/C/R/I/P/T)
2. Sim shows the verbatim question for that letter for THIS excuse
3. Closer asks the question
4. Sim's prospect responds (Type A or Type B variation)
5. Closer can deploy additional SCRIPT letters if needed

### After SCRIPT

1. Sim presents the path diagnosis card: "Path A, B, or C?"
2. Each path has criteria for recognition
3. Closer diagnoses based on prospect's response
4. Sim loads the matched reframe card

### During reframe

1. Sim displays the follow-up questions for that path
2. Closer deploys them
3. Sim displays the participatory analogies (graded)
4. Closer selects which analogy to deploy
5. Sim shows the verbatim setup and the required question
6. Closer delivers the analogy in participatory form (asks the question, doesn't deliver the conclusion)

### After reframe

1. Sim presents the concession check card: did the prospect concede?
2. If yes: sweep button appears
3. If no: option to loop with additional reframe questions or different analogy

### Sweep

1. Closer taps sweep button
2. Sim shows the sweep transition language for that excuse
3. Closer asks "aside from [X], what else has been in the way?"
4. Prospect surfaces next Layer 1 excuse
5. Loop begins again with new excuse file loaded

### Scoop (after 2-3 externals cleared)

1. Sweep tracker has counted 2-3 cleared externals
2. Scoop button activates (locked before this)
3. Closer taps scoop
4. Sim presents the scoop language with the cleared externals listed back
5. Closer asks the scoop question
6. Prospect names the fear (or attempts to)

### Aha detection

1. After prospect's response to scoop, sim presents aha detection card
2. Closer identifies: somatic or intellectual?
3. If intellectual: sim provides deepening questions, looping until somatic
4. If somatic: advance to Phase 3 second half (cost extraction, etc.)

---

## 6. PER-CARD RENDER SPECIFICATIONS

Each card type has a specific structure. The renderer parses the markdown files to produce these.

### Card Type 1: Layer 1 Statement Card

**Source:** "LAYER 1 — HOW PROSPECT PHRASES IT" section of the excuse file

**Renders:**
- Excuse category (A/B/C/D/E)
- Past-tense phrasings (list)
- Present-tense phrasings (list)
- Toggle button: closer selects which tense applies based on the prospect's framing

**Function:** Confirms what the prospect just said matches this excuse category. Allows closer to verify they're loading the right file.

### Card Type 2: SCRIPT Selection Card

**Source:** "SCRIPT PATH" section of the excuse file

**Renders:**
- Six letter buttons (S, C, R, I, P, T)
- Highlighted letters indicate which apply for this specific excuse (per the excuse file's notes)
- Greyed-out letters are still available but not primary
- Tapping a letter shows the verbatim question for that letter on this excuse

**Function:** Forces the closer to consciously select which clarity move to deploy. Builds the muscle of SCRIPT minimalism.

### Card Type 3: SCRIPT Question Card

**Source:** Specific letter's section within the excuse file

**Renders:**
- The verbatim question (past or present tense based on toggle)
- "What you're listening for" notes
- Button: "Asked it" → advances to prospect response card
- Button: "Skip and try different letter" → returns to SCRIPT selection

**Function:** Shows the closer what to ask and what to listen for.

### Card Type 4: Prospect Response Card

**Source:** Sim's prospect engine (Type A or Type B variations from each excuse file)

**Renders:**
- The prospect's response in their voice (text + voice if ElevenLabs active)
- Indicator of which type (A or B) is responding
- Button: "Continue" → advances to next SCRIPT letter or path diagnosis

**Function:** Provides the prospect's voice response so closer can practice handling.

### Card Type 5: Path Diagnosis Card

**Source:** "DIAGNOSTIC PATHS" section of the excuse file

**Renders:**
- Three path options (A, B, C) with their recognition criteria
- Closer selects which path the prospect's response matches
- Each path's criteria list ("How to recognize") shown for reference

**Function:** Forces the closer to diagnose before deploying a reframe. Builds the diagnostic instinct.

### Card Type 6: Reframe Question Card

**Source:** "Reframe questions (participatory)" subsection of the chosen path

**Renders:**
- The matched reframe questions for the diagnosed path (3 typical)
- Closer can deploy one or more
- Each question is shown with its setup context

**Function:** Provides the matched reframe questions for the specific path.

### Card Type 7: Analogy Card

**Source:** "Participatory analogies (graded for high-earning ICP)" subsection of the chosen path

**Renders:**
- Each analogy shown with its grade (A/B/B+/C/D)
- Higher-graded analogies appear first
- For each analogy:
  - The setup language (the closer's setup)
  - **THE REQUIRED QUESTION** (highlighted prominently — this is the participatory element)
  - "After they answer:" follow-up
  - "Why this lands" explanation
- Closer selects which analogy to deploy

**Critical:** The required question MUST be displayed prominently. Without it, the closer might deliver the conclusion instead of asking the participatory question, breaking the entire mechanism.

**Function:** Provides analogies with built-in participatory structure.

### Card Type 8: Concession Check Card

**Source:** Implicit in each excuse file's flow

**Renders:**
- "Did the prospect concede?"
- Three buttons: "Yes — clear concession", "Partial — needs more", "No — resistance"
- For "Partial" or "No": loops back to additional reframe questions or different analogy

**Function:** Gates the sweep behind actual concession.

### Card Type 9: Sweep Card

**Source:** "SWEEP TRANSITION (TO NEXT EXTERNAL)" section of the excuse file

**Renders:**
- The verbatim sweep transition language
- Counter showing how many externals cleared (1/3, 2/3, 3/3)
- Button: "Asked it" → returns to chip selection for next excuse
- After 2-3 cleared: scoop button activates

**Function:** Maintains the lateral sweep discipline.

### Card Type 10: Scoop Card

**Source:** Reference file `00-foundational-principles.md` section 5

**Renders:**
- The verbatim scoop language with the cleared externals dynamically inserted: "So aside from [excuse 1], [excuse 2], and [excuse 3], what do you feel has actually been in the way?"
- Silence timer (5-10 seconds — can be configured)
- The closer can't advance until the silence timer completes

**Function:** Forces the silence discipline. Most closers fill silence with another question; this prevents that.

### Card Type 11: Aha Detection Card

**Source:** Reference file `00-foundational-principles.md` section 9

**Renders:**
- After scoop response, two options: "Somatic aha" or "Intellectual aha"
- Each option has its criteria displayed (voice drop, pause, etc. for somatic; conversational tone, fast response for intellectual)
- If intellectual: provides deepening questions, loops until somatic
- If somatic: advances to Phase 3 second half

**Function:** Builds the muscle of detecting genuine vs. surface ahas.

---

## 7. PATH DIAGNOSIS LOGIC

After SCRIPT, the prospect's response determines which path applies. The sim should provide the closer with the criteria for each path and let the closer make the call (not auto-diagnose).

### Why human diagnosis matters

The purpose of the sim is to train the closer's instinct. Auto-diagnosis defeats the training. The closer should be reading the prospect's response and matching it to path criteria.

### Path diagnosis card behavior

1. After prospect response, sim displays path options for that excuse
2. Each path has 4-6 recognition criteria
3. Closer selects the path that fits
4. If closer selects wrong (which is fine for training), the reframe might not land — sim should let it play out and then offer feedback after the loop

### Wrong-path handling

If the closer diagnoses wrong, the sim's prospect should respond as if the wrong reframe was applied — usually with resistance or porcupining. After the closer notices it's not landing, sim should offer:

- "Try a different path?"
- "Deploy a different analogy from this path?"

This builds the diagnostic muscle through feedback rather than correction.

---

## 8. SWEEP-BEFORE-DEEP ENFORCEMENT

### The hard rule

The scoop button is locked until 2-3 externals have been cleared with concession. This is non-negotiable in the sim because the discipline of sweep-before-deep is one of the most commonly violated rules by inexperienced closers.

### Tracking logic

- Each time a closer completes the full flow for an excuse (SCRIPT → diagnosis → reframe → concession), the sweep counter increments
- After 2 cleared externals, scoop becomes available (greyed but accessible)
- After 3 cleared externals, scoop is fully available (highlighted)
- After 4-5 cleared externals, the sim displays a soft warning: "Friction budget is getting low. Consider scooping."
- After 5 cleared externals, the sim prompts the closer to scoop explicitly.

### Override allowed (with consequence)

The closer CAN scoop after just 1 cleared external by tapping a hidden override. But the sim should respond with prospect resistance — the scoop won't land because the stack wasn't built. The fear won't surface. This teaches the rule through failure rather than blocking it.

### Scoop card content

The scoop card dynamically inserts the cleared externals into the verbatim Itai language:

> "So aside from [excuse 1], [excuse 2], and [excuse 3], what do you feel has actually been in the way?"

After deployment, the silence timer (5-10 seconds, configurable) starts. The closer cannot advance the card during the silence. This builds the silence discipline.

---

## 9. SOMATIC VS INTELLECTUAL AHA DETECTION

After the scoop, the prospect names something. The sim presents the aha detection card.

### Sim's prospect responses come in two modes after scoop

**Somatic mode** (sim simulates):
- Long pause before the named fear
- Voice drop (in TTS, reduce volume + slow pace)
- Phrasing is slower, smaller
- Often includes involuntary acknowledgments ("oh god," "huh," "shit")
- Body shift cues (sim could display text indicators like "*pauses, eyes drop*")

**Intellectual mode** (sim simulates):
- Quick response
- Conversational tone (in TTS, normal pace)
- Therapy-talk phrasing
- No body shift cues
- Sounds rehearsed

### Closer's job

Identify which mode just occurred. The sim presents:
- Criteria for each
- "Somatic" or "Intellectual" buttons

### If closer selects somatic

Advance to Phase 3 second half (cost extraction).

### If closer selects intellectual

Sim provides deepening question options:
- "When you say [their phrase] — what's underneath that?"
- "Stay with that for a second. What does that actually feel like in your body?"
- "If you didn't have words for it — what's the actual thing?"
- "Take your time with it. What comes up when you really look at it?"

After deepening, sim's prospect responds again. Loop until somatic.

### Random variation

For training, the sim should randomly produce somatic vs intellectual responses (with somatic more common, but intellectual frequent enough to drill detection). The closer must practice both. If the sim ALWAYS produces somatic, the closer doesn't build the muscle of catching intellectual.

---

## 10. TYPE A / TYPE B PROSPECT SELECTOR

At call start, the closer selects which type of prospect they're practicing against.

### Type A — High-performing operator

**Characteristics in responses:**
- Articulate, structured language
- Defends with logic and rationalization
- Uses business-frame analogies in own speech
- Can name specific data/numbers
- Confidence in tone
- Often defensive about being seen as needing help

**Voice tone for ElevenLabs:** Confident, steady, mid-range pitch, controlled pace

### Type B — Stuck or stalled prospect

**Characteristics in responses:**
- More emotional language
- Defends with overwhelm or victim-positioning
- Less articulate about own patterns
- Vague rather than specific
- Quieter, sometimes resigned
- More openly admits struggle

**Voice tone for ElevenLabs:** Softer, slower, lower pitch, hesitant pace

### How each excuse file uses this

Every excuse file has a "Type A prospect variation" and "Type B prospect variation" section in the Sim Behavior Notes. The prospect engine should use those sample responses as the template for that type, then generate variations within that pattern.

### Why this matters

Same excuse, different texture. Type A and Type B require different reframe deployment even with same SCRIPT and same path. The closer practices adjusting tone, pacing, and analogy choice based on the prospect's archetype.

---

## 11. VOICE INTEGRATION (ELEVENLABS)

### Why voice matters

Jonny's primary practice mode is voice. He speaks as the closer (or prospect), the sim responds via TTS. This trains the muscle of real-time spoken response, which is fundamentally different from typed practice.

### ElevenLabs setup

- API integration via the standard ElevenLabs streaming endpoint
- Two voice IDs configured: one for Type A prospect, one for Type B prospect
- Voice characteristics:
  - **Type A voice:** Confident, mid-range, controlled — suggests a Voice ID like "Adam" or similar with stability around 0.7
  - **Type B voice:** Softer, slower, lower confidence — suggests a Voice ID like "Bella" or "Charlie" with stability around 0.5

### Streaming vs. non-streaming

Use streaming. The prospect's response needs to begin playing quickly to maintain the conversational rhythm. Latency over 1.5 seconds breaks the practice flow.

### Mic input handling

For closer voice input:
- Web Speech API for browser-based speech-to-text (or Whisper API if higher accuracy needed)
- The text version of the closer's speech triggers the card progression
- Don't require the closer to type — voice should fully drive the call

### Card-and-voice flow

When a prospect response card surfaces:
1. The text appears
2. Voice begins playing simultaneously
3. Closer can replay voice (button)
4. Closer can advance the card only after voice finishes (forces listening, not skimming)

### Voice for analogies

When the closer deploys an analogy, the analogy is meant to be SPOKEN by the closer, not read by the sim. The sim's job is to display the analogy text for the closer to reference and speak. No TTS on closer's lines.

### Voice for SCRIPT questions

Same as analogies — the closer speaks the question, the sim displays the text for reference. No TTS on closer's lines.

---

## 12. ROLE-SWITCHING MECHANICS

### Two roles the closer can play

**Role 1: Play the closer (default)**
- Sim plays the prospect (Type A or B)
- Closer speaks closer lines (SCRIPT questions, reframes, analogies)
- Sim responds as the prospect via ElevenLabs voice

**Role 2: Play the prospect**
- Sim plays the closer (using voice for closer lines)
- Closer speaks prospect lines (excuses, defenses, eventual fear)
- Sim guides the conversation through the Phase 2/3 flow

### Why role-switching matters

Playing the prospect builds empathy and improves diagnostic instinct. The closer learns what excuses feel like from the inside, which makes them better at recognizing them in real calls.

### Implementation

Role selector at call start:
- "I'll play the closer" (default)
- "I'll play the prospect"

When playing prospect:
- The cards now show prospect-side content (what excuses to deploy, what to resist, when to concede)
- The sim's closer-voice asks SCRIPT questions, presents reframes, deploys analogies
- The closer (as prospect) responds with the patterns shown on screen
- The closer learns when to concede, when to resist, when to deepen — from the prospect's perspective

### Card differences when playing prospect

The lexicon files contain the full Phase 2/3 framework from the closer's perspective. To support prospect-role play, the renderer needs to translate the cards:

- SCRIPT questions become "the closer is asking you X — how would [Type A or B prospect] respond?"
- Path diagnosis becomes "the closer is identifying you as Path A — how would Path A you sound?"
- Reframes become "the closer is deploying [analogy] — how would you receive it? Would you concede, partial concede, or resist?"

The prospect-role mode is more open-ended and exploratory. It's about feeling the experience, not executing the framework.

---

## 13. PAST-TENSE VS PRESENT-TENSE HANDLING

### The principle from foundational principles

Most discovery questions are past-tense (examining why the prospect hasn't acted yet). But some prospects are dealing with the excuse in active present. The sim must support both.

### Card behavior

Each excuse file's Layer 1 statements and SCRIPT questions have both past-tense and present-tense versions. The card displays both:

```
[Past-tense version]
- "When you say you were too busy — what specifically was on your plate then?"

[Present-tense version]
- "When you say busy — what specifically is on your plate right now?"

[Toggle: Past / Present]
```

The closer selects which tense applies based on the prospect's framing. Default is past-tense (it's more common in discovery).

### Why both

Discovery is usually past-tense. But some prospects (especially crisis-mode types) are in present-tense paralysis. The closer must adapt. The sim's job is to make both options visible and let the closer choose.

### Tense detection

If the sim's prospect engine has voice-input capability, it can attempt to detect tense from the closer's question (past tense verb forms vs present). For v5.1, manual toggle is sufficient — automatic detection can come in v5.2.

---

## 14. WHAT TO LEAVE ALONE IN v4

The following elements work well and should not be changed:

### Visual design
- The mobile-first interface (Apple web app manifest, viewport meta)
- The chip-based selection model
- The dark color palette
- The category color coding (A through E)

### Interaction model
- Tap-to-select chip behavior
- The "+ Aside from that..." button structure
- The Core Fears menu underneath excuses

### Branding
- "Iceberg of Excuses" name
- "v5.1 — full build" subtitle update
- "Built for GratefulAF" attribution

### What works mechanically
- The chip count of 20+ (we have 13 detailed excuse files; some chips can be additional sub-variants or "coming soon" markers)
- The 5-category structure (A through E)
- The reset functionality

---

## 15. WHAT TO CHANGE IN v4

### Content layer

- Replace flat scripts with structured cards (per Card Type specs in section 6)
- Add SCRIPT letter labels on every clarity question
- Add Path A/B/C diagnosis between SCRIPT and reframe
- Replace lecture-style analogies with participatory format (analogy setup + required question)
- Add grading on analogies (A/B/B+/C/D)
- Add past-tense and present-tense versions of each Layer 1 statement
- Replace existing chip content with content from lexicon files

### Flow logic

- Add sweep-before-deep enforcement (scoop locked until 2-3 externals cleared)
- Add silence timer after scoop card
- Add aha detection card after scoop response
- Add deepening question loop if intellectual aha detected

### New features

- Type A / Type B selector at call start
- Role selector (closer or prospect) at call start
- ElevenLabs voice integration
- Mic input for closer voice
- Past-tense / present-tense toggle on cards

### Architecture

- Implement the folder structure from section 4
- Separate content (lexicon/) from rendering (scripts/)
- Build the markdown parser that reads each excuse file and renders cards
- Build the prospect engine that generates Type A/B responses

---

## 16. BUILD SEQUENCE RECOMMENDATIONS

For a clean implementation that doesn't break partway through, build in this order:

### Phase 1: Architecture (do first)

1. Set up the folder structure
2. Move all 14 lexicon markdown files into `lexicon/`
3. Build the markdown parser that can read each excuse file and extract sections
4. Build the basic card renderer (renders cards from parsed data)

### Phase 2: Core flow (do second)

5. Implement the Layer 1 → SCRIPT → Path Diagnosis → Reframe → Concession → Sweep flow
6. Build the SCRIPT selection card with letter buttons
7. Build the path diagnosis card with A/B/C options
8. Build the reframe card with analogy grading
9. Test full flow with one excuse (recommend starting with Time — simplest)

### Phase 3: Enforcement logic (do third)

10. Build the sweep tracker (counter for cleared externals)
11. Build the scoop card with dynamic external insertion
12. Build the silence timer
13. Build the aha detection card with deepening loop

### Phase 4: Prospect engine (do fourth)

14. Build Type A response patterns from each excuse file's Type A notes
15. Build Type B response patterns from each excuse file's Type B notes
16. Implement the Type A/B selector at call start
17. Test that prospect responses match the type selected

### Phase 5: Voice integration (do fifth)

18. Integrate ElevenLabs API for prospect TTS
19. Set up two voice configurations (Type A voice, Type B voice)
20. Implement mic input (Web Speech API)
21. Test the voice-driven flow end-to-end

### Phase 6: Role switching (do sixth)

22. Build the role selector at call start
23. Implement prospect-role card flow (cards translate to prospect perspective)
24. Test playing as prospect

### Phase 7: Polish (do last)

25. Past-tense / present-tense toggle on relevant cards
26. Add the "porcupine permission preamble" option (for prospect resistance)
27. Add session save/restore (so closers can practice the same flow multiple times)
28. Add a session log (which paths the closer diagnosed, which analogies they chose, where they got stuck)

---

## 17. TESTING CRITERIA

For each excuse file, test the following:

### Functional tests
- The chip loads the correct lexicon file
- All SCRIPT letters from the file render as buttons
- The path diagnosis card shows all paths from the file
- The reframe questions match the diagnosed path
- The analogies are graded correctly and displayed in order
- The sweep transition language matches the file
- The Type A and Type B variations differ as specified

### Flow tests
- Closer cannot scoop until 2-3 externals cleared
- Silence timer functions after scoop
- Aha detection card appears after scoop response
- Deepening questions appear if intellectual aha selected
- Sim advances to Phase 3 second half after somatic aha

### Voice tests
- ElevenLabs voice differs between Type A and Type B
- Voice playback completes before card advances
- Mic input correctly captures closer's speech
- No latency over 1.5 seconds between closer speaking and prospect responding

### Edge case tests
- What happens if closer tries to scoop with 0 externals cleared (should be locked)
- What happens if closer diagnoses wrong path (sim should respond with resistance, not auto-correct)
- What happens if closer selects analogy graded D (sim should let them try it; outcome demonstrates the grade is honest)
- What happens if Path A reframe doesn't land for Type B prospect (sim should produce resistance signaling mismatch)

---

## 18. WHAT JONNY SHOULD KNOW (FOR THE OTHER CHAT)

When the other Claude builds this, Jonny should know:

### This is an upgrade, not a rebuild from scratch
v4's visual design and chip interface are preserved. The changes are content + flow logic + voice integration.

### The lexicon files are the source of truth
When he wants to change a reframe question, he edits the markdown file. The sim reflects the changes on next load.

### The framework discipline is now enforced
The sim won't let him cheat by jumping to fear extraction before sweeping. It teaches the discipline by gating progression.

### Voice changes everything
Once voice is integrated, the practice quality goes up significantly. The closer is using actual vocal cords, not typing. This builds muscle memory for real calls.

### Role-switching is unique
Most sales sims only let you play the salesperson. This sim lets him play the prospect too. That's a unique training advantage — he learns what each excuse FEELS like from the inside.

### The 13 excuses cover ~80% of real-call scenarios
Future versions can add more excuses (the original lexicon mapped 22+). v5.1 with 13 is a working production tool, not a draft.

---

## 19. FINAL NOTES TO THE OTHER CLAUDE

If you're reading this as the Claude implementing v5.1, a few things:

**Don't reinvent the lexicon.** The 13 excuse files contain dense, structured content. Your job is to render them, not to rewrite them. If something seems missing or unclear, flag it — don't fill it in.

**Preserve the participatory analogy structure.** This is the single most important mechanism in the framework. Every analogy MUST have a required question that the closer asks. If the closer just delivers the analogy's conclusion, the entire mechanism breaks. Make the required question visually prominent on every analogy card.

**Don't auto-diagnose.** The sim's training value depends on the closer making decisions. If the sim auto-detects path or auto-detects aha type, you've defeated the training. Let the closer choose; let them fail; let them learn through the loop.

**Honor the sales-vs-delivery distinction.** Some excuses (like overcommitment) are designed to be deferred to delivery, not resolved on the call. The cards should reflect this — they should make the closer name the deferral, not try to solve everything in Phase 2/3.

**Tone matters more than logic.** This is identity-level work. The cards should help the closer feel the human dimension, not just execute the framework. The "voice tone notes" sections in each excuse file are critical.

**Build in chunks, test often.** Don't build all of v5.1 at once. Build the core flow for one excuse, test it end-to-end with Jonny, refine, then propagate to other excuses. The first one done well teaches you what the rest need.

**Ask Jonny questions.** He has strong opinions about how this should feel. When in doubt, ask. He'd rather answer questions during the build than have you guess and rebuild later.

---

**End of Claude sim instructions doc. This document, combined with the 14 lexicon files, is the complete v5.1 build package.**

// ===================================================================
// CHIP REGISTRY
// ===================================================================
// Maps the 17 excuse chips to their lexicon files and picker categories.
// Order within each category determines display order in the picker.
//
// A chip's `category` here is the PRIMARY category for picker placement.
// Some chips have category overlaps noted in the file itself, but for
// the picker UI we pick one home.
//
// Phase 1A: all 17 chips visible & active (each loads its file for the
// parser debug view).
// ===================================================================

const CHIP_REGISTRY = [
  // ----- A · External / situational blame (9) -----
  { id: 'time',           file: '01-time.md',                  label: 'Time',                       cat: 'A' },
  { id: 'wife-partner',   file: '02-wife-partner.md',          label: 'Wife / Partner',             cat: 'A' },
  { id: 'life-event',     file: '06-death-kids-life-event.md', label: 'Death / Kids / Life Event',  cat: 'A' },
  { id: 'debt',           file: '07-debt.md',                  label: 'Debt',                       cat: 'A' },
  { id: 'money',          file: '14-money.md',                 label: 'Money',                      cat: 'A' },
  { id: 'timing-economy', file: '15-timing-economy.md',        label: 'Timing / Economy',           cat: 'A' },
  { id: 'dontknow-what',  file: '16-didnt-know-what.md',       label: "Didn't Know What",           cat: 'A' },
  { id: 'dontknow-opps',  file: '17-didnt-know-opps.md',       label: "Didn't Know Opps",           cat: 'A' },

  // ----- B · Risk / trust / past pain (4) -----
  { id: 'scam',           file: '03-scam.md',                  label: 'Scam',                       cat: 'B' },
  { id: 'risk',           file: '04-risk.md',                  label: 'Risk',                       cat: 'B' },
  { id: 'research',       file: '05-research.md',              label: 'Research',                   cat: 'B' },
  { id: 'tried-before',   file: '10-tried-before.md',          label: 'Tried Before',               cat: 'B' },

  // ----- C · Identity / self-concept (1, merges 4 v4 chips) -----
  { id: 'self-doubt',     file: '09-self-doubt.md',            label: 'Self-Doubt',                 cat: 'C' },

  // ----- D · Control / responsibility (3) -----
  { id: 'do-it-myself',   file: '08-do-it-myself.md',          label: 'Do It Myself',               cat: 'D' },
  { id: 'need-to-think',  file: '11-need-to-think.md',         label: 'Need to Think',              cat: 'D' },
  { id: 'overcommitment', file: '12-overcommitment.md',        label: 'Overcommitment',             cat: 'D' },

  // ----- E · Sophistication defense (1) -----
  { id: 'life-is-okay',   file: '13-life-is-okay.md',          label: 'Life Is Okay',               cat: 'E' }
];

// Helper: get a chip by id
function getChipById(id) {
  return CHIP_REGISTRY.find(c => c.id === id) || null;
}

// Helper: get chips for a category
function getChipsByCategory(cat) {
  return CHIP_REGISTRY.filter(c => c.cat === cat);
}

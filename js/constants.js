/* Interactive Iceberg — constants & tier definitions.
   @module-split  Former single app.js, divided into ordered classic scripts.
   Load order is set in index.html; this file shares global scope with the rest. */

const TIER_BOUNDARIES = [0, 195, 391, 621.5, 827.5, 1037.5, 1224.5, 1425.5, 1626.5, 1843.5, 2048];


const DEFAULT_TIERS = [
  ['Sky', '#13a9e8'],
  ['Surface', '#0051ff'],
  ['Shallow', '#0531e7'],
  ['Depths', '#0611b8'],
  ['Deep', '#04007c'],
  ['Abyss', '#02004d'],
  ['Lower Abyss', '#01002d'],
  ['Hadopelagic', '#000019'],
  ['Void', '#00000d'],
  ['Blackout', '#000000'],
];
const FIXED_TIER_COUNT = DEFAULT_TIERS.length;
const STATE_VERSION = 6;
const AUTOSAVE_KEY = 'interactiveIceberg.autosave.v1';
// Match `--quick-pop` in CSS (.12s = 120ms).
const QUICK_POP_MS = 120;
// Slow-fade-back transition after dismissing an entry-link hover.
const ENTRY_LINK_FADE_RETURN_MS = 2050;
const BG_BLUR_LABELS = ['none', 'some', 'more'];
const LOCK_LOTTIE_PATH = 'Lock.json';
const LOCK_LOTTIE_CLOSED_FRAME = 5;
const LOCK_LOTTIE_OPEN_FRAME = 26;
const LOCK_LOTTIE_LOCK_START_FRAME = 34;
const LOCK_LOTTIE_LOCK_END_FRAME = 50;
const LOCK_LOTTIE_UNLOCK_START_FRAME = 5;
const LOCK_LOTTIE_UNLOCK_END_FRAME = 18;

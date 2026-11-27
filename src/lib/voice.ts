// Web Speech Recognition typing (not in TS lib by default)
export interface SpeechRecognitionResultLike {
  0: { transcript: string };
  isFinal: boolean;
  length: number;
}

export interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: { length: number; [index: number]: SpeechRecognitionResultLike };
}

export interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

export function createRecognition(lang: 'hi' | 'en'): SpeechRecognitionLike | null {
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.lang = lang === 'hi' ? 'hi-IN' : 'en-IN';
  rec.continuous = false;
  rec.interimResults = false;
  return rec;
}

// Devanagari + English digit normalization
const DEV_DIGITS: Record<string, string> = {
  '०': '0', '१': '1', '२': '2', '३': '3', '४': '4',
  '५': '5', '६': '6', '७': '7', '८': '8', '९': '9',
};

function normalizeDigits(s: string): string {
  return s.replace(/[०-९]/g, (d) => DEV_DIGITS[d] ?? d);
}

// Map spoken Hindi/English words for prices into digits
const WORD_NUMBERS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30,
  forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80,
  ninety: 90, hundred: 100, 'एक': 1, 'दो': 2, 'तीन': 3, 'चार': 4,
  'पांच': 5, 'पाँच': 5, 'छह': 6, 'छः': 6, 'सात': 7, 'आठ': 8,
  'नौ': 9, 'दस': 10, 'बीस': 20, 'तीस': 30, 'चालीस': 40,
  'पचास': 50, 'सौ': 100,
};

function wordsToNumber(tokens: string[]): number | null {
  let total = 0;
  let current = 0;
  let foundAny = false;
  for (const raw of tokens) {
    const t = raw.toLowerCase();
    if (t === 'hundred' || t === 'सौ') {
      current = (current || 1) * 100;
      foundAny = true;
      continue;
    }
    if (WORD_NUMBERS[t] !== undefined) {
      const v = WORD_NUMBERS[t];
      if (v >= 100) {
        current = (current || 0) + v;
      } else {
        current = (current || 0) + v;
      }
      foundAny = true;
    }
  }
  total = current;
  return foundAny ? total : null;
}

export interface ParsedItem {
  name: string;
  price: number;
  qty: number;
}

// Parse a spoken phrase like "chini 50" or "चीनी 50 रुपये" or "rice two kg 40"
export function parseVoiceItem(text: string): ParsedItem | null {
  let t = normalizeDigits(text.trim());
  if (!t) return null;

  // Strip currency words/symbols
  t = t.replace(/रुपये|रु\.?|rupees?|rs\.?|₹/gi, ' ');
  // Strip filler words
  t = t.replace(/\b(ka|ki|ke|ka\u093c|of|for|per|the|a|an|please|hai|hain|ha\u093c)\b/gi, ' ');
  t = t.replace(/\b(का|की|के|है|हैं|की\s*कीमत|दाम|मूल्य)\b/g, ' ');
  t = t.replace(/[,\u0964\u0965!।]/g, ' ');

  // Find all numbers (digits) in the string
  const digitMatches = t.match(/\d+(?:\.\d+)?/g);
  let price = 0;
  let qty = 1;
  let remaining = t;

  if (digitMatches && digitMatches.length > 0) {
    const nums = digitMatches.map((n) => parseFloat(n));
    // Heuristic: last number is price, any earlier number is qty
    if (nums.length >= 2) {
      qty = nums[0];
      price = nums[nums.length - 1];
    } else {
      price = nums[0];
    }
    // Remove the digit numbers from the string to get the name
    remaining = t.replace(/\d+(?:\.\d+)?/g, ' ');
  } else {
    // No digits — try word-number parsing for price
    const tokens = t.split(/\s+/).filter(Boolean);
    const wordPrice = wordsToNumber(tokens);
    if (wordPrice !== null) {
      price = wordPrice;
      // remove word-number tokens from the name
      remaining = tokens
        .filter((tok) => WORD_NUMBERS[tok.toLowerCase()] === undefined)
        .join(' ');
    } else {
      return null; // no price found
    }
  }

  // Clean up the name
  let name = remaining
    .replace(/\b(kg|kilo|kilogram|gram|gm|litre|liter|ltr|piece|pcs|pc|dozen|दर्जन|किलो|किलोग्राम|ग्राम|लीटर|पीस)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Remove trailing/leading common filler
  name = name.replace(/^[\s-]+|[\s-]+$/g, '').trim();

  if (!name) name = text.trim();
  if (!price || price <= 0) return null;
  if (!qty || qty <= 0) qty = 1;

  return { name, price, qty };
}

export function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(n);
}

// Build a plain-text bill suitable for WhatsApp sharing
export function buildBillText(shopName: string, items: BillItemLike[], total: number): string {
  const lines = items.map(
    (it) => `• ${it.name} × ${it.qty} = ${formatCurrency(it.price * it.qty)}`
  );
  return [
    `*${shopName}*`,
    '------------------------',
    ...lines,
    '------------------------',
    `*Total: ${formatCurrency(total)}*`,
  ].join('\n');
}

interface BillItemLike {
  name: string;
  price: number;
  qty: number;
}

// Convert a number to Hindi words for the voice readout of the total.
const HI_UNITS = [
  '', 'एक', 'दो', 'तीन', 'चार', 'पाँच', 'छह', 'सात', 'आठ', 'नौ',
  'दस', 'ग्यारह', 'बारह', 'तेरह', 'चौदह', 'पंद्रह', 'सोलह', 'सत्रह', 'अठारह', 'उन्नीस',
];
const HI_TENS = [
  '', '', 'बीस', 'तीस', 'चालीस', 'पचास', 'साठ', 'सत्तर', 'अस्सी', 'नब्बे',
];

function twoDigitsToHindi(n: number): string {
  if (n < 20) return HI_UNITS[n];
  const tens = Math.floor(n / 10);
  const units = n % 10;
  if (units === 0) return HI_TENS[tens];
  // 21..29 etc: "इक्कीस" style isn't in our table; use tens+unit fallback
  return `${HI_TENS[tens]} ${HI_UNITS[units]}`;
}

function threeDigitsToHindi(n: number): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (hundreds > 0) parts.push(`${HI_UNITS[hundreds]} सौ`);
  if (rest > 0) parts.push(twoDigitsToHindi(rest));
  return parts.join(' ');
}

export function numberToHindiWords(n: number): string {
  const rupees = Math.floor(n);
  const paise = Math.round((n - rupees) * 100);
  if (rupees === 0 && paise === 0) return 'शून्य रुपये';

  const groups: { value: number; word: string }[] = [];
  let remaining = rupees;
  const scales: { factor: number; word: string }[] = [
    { factor: 10000000, word: 'करोड़' },
    { factor: 100000, word: 'लाख' },
    { factor: 1000, word: 'हज़ार' },
  ];
  for (const { factor, word } of scales) {
    const v = Math.floor(remaining / factor);
    if (v > 0) {
      groups.push({ value: v, word });
      remaining -= v * factor;
    }
  }
  if (remaining > 0) groups.push({ value: remaining, word: '' });

  const parts = groups.map((g) => {
    const w = threeDigitsToHindi(g.value);
    return g.word ? `${w} ${g.word}` : w;
  });

  let result = parts.join(' ').trim();
  result = `${result} रुपये`;
  if (paise > 0) {
    result = `${result} और ${twoDigitsToHindi(paise)} पैसे`;
  }
  return result;
}

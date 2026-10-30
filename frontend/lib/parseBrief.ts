// Reads a size and a budget out of the shopper's own sentence to fill in the brief's
// budget and size fields: "Silver-and-black concert look in size S, under $120."

const SIZE_WORDS: Record<string, string> = {
  "extra small": "XS",
  small: "S",
  medium: "M",
  large: "L",
  "extra large": "XL",
  xxs: "XS",
  xs: "XS",
  s: "S",
  m: "M",
  l: "L",
  xl: "XL",
  xxl: "XXL",
  "2xl": "XXL",
};

const WORD = "extra[- ]small|extra[- ]large|small|medium|large";
const CODE = "xxs|xxl|2xl|xs|xl|s|m|l";
// Checked in order. Words like "small" only count after "size" or "wear", so
// "a small bag" or "in medium wash denim" are not sizes; "in L.A." is not size L.
const SIZE_PATTERNS = [
  new RegExp(String.raw`\b(?:size:?|sized)\s+(${WORD}|${CODE})\b`, "i"),
  new RegExp(String.raw`\bwear(?:ing)?(?: a| an)?\s+(${WORD}|${CODE})\b`, "i"),
  new RegExp(String.raw`\bin(?: a| an)?\s+(${CODE})\b(?![.'’]?[A-Za-z])`, "i"),
  new RegExp(String.raw`\b(${CODE})\s+size\b`, "i"),
];

const AMOUNT = String.raw`(\d{1,3}(?:,\d{3})+|\d{1,5})`;
const KEYWORD = String.raw`(?:budget|under|below|max(?:imum)?|up to|less than|no more than)`;
// "$120", "120 dollars", "under 120", "budget of 100".
const BUDGET_RE = new RegExp(
  String.raw`(${KEYWORD})?\s*(?:of\s+|is\s+)?\$\s?${AMOUNT}\b|\b${AMOUNT}\s?(?:dollars|usd|bucks)\b|\b${KEYWORD}\s*(?:of\s+|is\s+)?${AMOUNT}\b`,
  "gi",
);

export type BriefDetails = { size?: string; budget?: number };

function readSize(text: string) {
  for (const re of SIZE_PATTERNS) {
    const match = text.match(re);
    if (match) return SIZE_WORDS[match[1].toLowerCase().replace(/[- ]+/, " ")];
  }
  return undefined;
}

function readBudget(text: string) {
  const found = [...text.matchAll(BUDGET_RE)].map((m) => ({
    amount: Number((m[2] ?? m[3] ?? m[4]).replace(/,/g, "")),
    // "under $120" beats a bare "$40 scarf" mentioned earlier in the sentence.
    keyword: Boolean(m[1]) || Boolean(m[4]),
  }));
  const best = found.find((f) => f.keyword) ?? found.at(-1);
  return best && best.amount > 0 ? best.amount : undefined;
}

export function parseBrief(text: string): BriefDetails {
  return { size: readSize(text), budget: readBudget(text) };
}

/** Rewrites the budget in the sentence ("under $120" → "under $180"), however it was written. */
export function replaceBudget(text: string, from: number, to: number): string {
  const amount = from.toLocaleString("en-US").replace(",", ",?");
  return text.replace(
    new RegExp(String.raw`(\$\s?)${amount}\b|\b${amount}(?=\s?(?:dollars|usd|bucks)\b)|(${KEYWORD}\s*(?:of\s+|is\s+)?)${amount}\b`, "i"),
    (_m, dollar?: string, keyword?: string) => `${dollar ?? keyword ?? ""}${to}`,
  );
}

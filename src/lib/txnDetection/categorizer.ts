// Merchant -> category. Maps to bucket name when a matching bucket exists.

const RULES: Array<{ pattern: RegExp; category: string }> = [
  { pattern: /\b(kfc|mcdonald|burger|pizza|dominos|hardees|nandos|cafe|coffee|starbucks|chai|food|restaurant|foodpanda|cheetay)\b/i, category: 'Food' },
  { pattern: /\b(uber|careem|indrive|bykea|yango|taxi|fuel|petrol|pso|shell|byco|total)\b/i, category: 'Transport' },
  { pattern: /\b(spotify|netflix|youtube|prime|disney|apple|icloud|hulu|hbo)\b/i, category: 'Subscription' },
  { pattern: /\b(steam|playstation|psn|xbox|nintendo|epic\s+games)\b/i, category: 'Gaming' },
  { pattern: /\b(k-?electric|lesco|iesco|gepco|wapda|ssgc|sngpl|ptcl|nayatel|stormfiber|jazz|zong|ufone|telenor|water\s+board)\b/i, category: 'Bills' },
  { pattern: /\b(amazon|daraz|aliexpress|temu|shein|outfitters|khaadi|gul\s+ahmed|sapphire)\b/i, category: 'Shopping' },
  { pattern: /\b(hospital|pharmacy|clinic|dvago|sehat|medstore)\b/i, category: 'Health' },
];

export function categorize(merchant: string | null, rawText: string): string {
  const hay = `${merchant || ''} ${rawText}`;
  for (const r of RULES) {
    if (r.pattern.test(hay)) return r.category;
  }
  return 'Miscellaneous';
}

export function findBucketIdForCategory(
  category: string,
  buckets: Array<{ id: string; name: string }>
): string | null {
  const c = category.toLowerCase();
  const exact = buckets.find(b => b.name.toLowerCase() === c);
  if (exact) return exact.id;
  const partial = buckets.find(b => b.name.toLowerCase().includes(c) || c.includes(b.name.toLowerCase()));
  return partial?.id || null;
}

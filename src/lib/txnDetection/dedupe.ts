// Dedupe + confidence scoring for txn signals.
import { offlineDb, LocalTxnSignal } from '@/lib/offline/db';
import type { ParsedTxn } from './parser';

const DEDUPE_WINDOW_MS = 5 * 60 * 1000;
const SIGNAL_TTL_MS = 24 * 60 * 60 * 1000;

function fingerprint(p: ParsedTxn): string {
  // amount + 5-min bucket; merchant intentionally excluded so SMS/app variants merge
  const bucket = Math.floor(p.timestamp / DEDUPE_WINDOW_MS);
  return `${p.amount?.toFixed(2) || 'x'}-${bucket}`;
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length || !b.length) return Math.max(a.length, b.length);
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1].toLowerCase() === b[j - 1].toLowerCase() ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[a.length][b.length];
}

export interface DedupeResult {
  isDuplicate: boolean;
  agreeingSources: number; // how many distinct sources have produced this fingerprint
  fingerprint: string;
}

export async function dedupeSignal(parsed: ParsedTxn): Promise<DedupeResult> {
  const fp = fingerprint(parsed);
  const ready = await offlineDb.ensureReady();
  if (!ready) return { isDuplicate: false, agreeingSources: 1, fingerprint: fp };

  // Purge stale
  try {
    const cutoff = Date.now() - SIGNAL_TTL_MS;
    await offlineDb.txnSignals.where('createdAt').below(cutoff).delete();
  } catch { /* ignore */ }

  // Find candidates within window
  const minTs = parsed.timestamp - DEDUPE_WINDOW_MS;
  const maxTs = parsed.timestamp + DEDUPE_WINDOW_MS;
  const candidates: LocalTxnSignal[] = await offlineDb.txnSignals
    .where('timestamp').between(minTs, maxTs, true, true).toArray();

  const matches = candidates.filter(c => {
    if (parsed.amount == null) return false;
    if (Math.abs(c.amount - parsed.amount) > 0.01) return false;
    // Match if same source OR merchants are close
    if (c.source && parsed.source && c.source === parsed.source) return true;
    if (c.merchant && parsed.merchant) {
      return levenshtein(c.merchant, parsed.merchant) <= 2;
    }
    return true; // amount+time alone is a strong signal
  });

  const sources = new Set(matches.map(m => m.source || '').filter(Boolean));
  if (parsed.source) sources.add(parsed.source);

  const isDuplicate = matches.length > 0;

  // Store this signal
  try {
    await offlineDb.txnSignals.put({
      id: `${fp}-${parsed.source || 'na'}-${parsed.timestamp}`,
      amount: parsed.amount || 0,
      merchant: parsed.merchant,
      source: parsed.source,
      timestamp: parsed.timestamp,
      rawText: parsed.rawText,
      createdAt: Date.now(),
    });
  } catch { /* ignore */ }

  return { isDuplicate, agreeingSources: Math.max(1, sources.size), fingerprint: fp };
}

const KNOWN_PACKAGES = new Set([
  'Meezan Bank', 'HBL', 'UBL', 'Bank Alfalah', 'EasyPaisa', 'JazzCash', 'Sadapay', 'Nayapay',
]);

export function scoreConfidence(parsed: ParsedTxn, agreeingSources: number): number {
  let score = 0;
  if (parsed.amount != null && parsed.amount > 0) score += 0.25;
  if (parsed.merchant && /^[A-Za-z][A-Za-z0-9&'\- ]{1,40}$/.test(parsed.merchant)) score += 0.2;
  if (parsed.source && KNOWN_PACKAGES.has(parsed.source)) score += 0.25;
  if (parsed.type === 'debit') score += 0.1;
  score += Math.min(0.3, (agreeingSources - 1) * 0.15);
  return Math.min(1, score);
}

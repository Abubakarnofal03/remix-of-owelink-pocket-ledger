import { offlineDb, LocalExpenseSuggestion } from '@/lib/offline/db';

export async function upsertSuggestion(s: LocalExpenseSuggestion): Promise<void> {
  const ready = await offlineDb.ensureReady();
  if (!ready) return;
  await offlineDb.expenseSuggestions.put(s);
}

export async function getSuggestion(id: string): Promise<LocalExpenseSuggestion | undefined> {
  const ready = await offlineDb.ensureReady();
  if (!ready) return undefined;
  return offlineDb.expenseSuggestions.get(id);
}

export async function listPendingSuggestions(): Promise<LocalExpenseSuggestion[]> {
  const ready = await offlineDb.ensureReady();
  if (!ready) return [];
  const all = await offlineDb.expenseSuggestions.where('status').equals('pending').toArray();
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

export async function setSuggestionStatus(
  id: string,
  status: LocalExpenseSuggestion['status']
): Promise<void> {
  const ready = await offlineDb.ensureReady();
  if (!ready) return;
  await offlineDb.expenseSuggestions.update(id, { status });
}

export async function countPendingSuggestions(): Promise<number> {
  const ready = await offlineDb.ensureReady();
  if (!ready) return 0;
  return offlineDb.expenseSuggestions.where('status').equals('pending').count();
}

// Muted merchants (simple localStorage list)
const MUTED_KEY = 'txn_muted_merchants';
export function getMutedMerchants(): string[] {
  try { return JSON.parse(localStorage.getItem(MUTED_KEY) || '[]'); } catch { return []; }
}
export function muteMerchant(name: string): void {
  if (!name) return;
  const list = new Set(getMutedMerchants().map(s => s.toLowerCase()));
  list.add(name.toLowerCase());
  localStorage.setItem(MUTED_KEY, JSON.stringify(Array.from(list)));
}
export function isMerchantMuted(name: string | null): boolean {
  if (!name) return false;
  return getMutedMerchants().map(s => s.toLowerCase()).includes(name.toLowerCase());
}

import { offlineDb, LocalAppContact, NicknameOverride } from './offline/db';
import { extractPhoneSuffix } from './phoneUtils';

/**
 * Local contacts database operations
 * These contacts are stored ONLY locally on the device, never synced to Supabase
 */

// Generate a local ID
function generateLocalId(): string {
  return `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Get all local app contacts
export async function getLocalContacts(): Promise<LocalAppContact[]> {
  return offlineDb.localAppContacts.toArray();
}

// Add a new local contact
export async function addLocalContact(
  phoneNumber: string,
  nickname: string | null
): Promise<LocalAppContact> {
  const phoneSuffix = extractPhoneSuffix(phoneNumber);
  
  // Check if already exists
  const existing = await offlineDb.localAppContacts
    .where('phone_suffix')
    .equals(phoneSuffix)
    .first();
  
  if (existing) {
    throw new Error('Contact with this phone number already exists');
  }
  
  const now = Date.now();
  const contact: LocalAppContact = {
    id: generateLocalId(),
    phone_number: phoneNumber,
    phone_suffix: phoneSuffix,
    nickname,
    created_at: now,
    updated_at: now,
  };
  
  await offlineDb.localAppContacts.add(contact);
  return contact;
}

// Update a local contact
export async function updateLocalContact(
  id: string,
  updates: { nickname?: string; phone_number?: string }
): Promise<LocalAppContact | null> {
  const contact = await offlineDb.localAppContacts.get(id);
  if (!contact) return null;
  
  const updateData: Partial<LocalAppContact> = {
    updated_at: Date.now(),
  };
  
  if (updates.nickname !== undefined) {
    updateData.nickname = updates.nickname;
  }
  
  if (updates.phone_number !== undefined) {
    updateData.phone_number = updates.phone_number;
    updateData.phone_suffix = extractPhoneSuffix(updates.phone_number);
  }
  
  await offlineDb.localAppContacts.update(id, updateData);
  return { ...contact, ...updateData };
}

// Delete a local contact
export async function deleteLocalContact(id: string): Promise<boolean> {
  const count = await offlineDb.localAppContacts.where('id').equals(id).delete();
  return count > 0;
}

// Search local contacts by nickname or phone
export function searchLocalContacts(
  contacts: LocalAppContact[],
  query: string
): LocalAppContact[] {
  if (!query.trim()) return contacts;
  const q = query.toLowerCase();
  return contacts.filter(
    c => c.nickname?.toLowerCase().includes(q) || c.phone_number.includes(q)
  );
}

// Get local contact by phone suffix
export async function getLocalContactBySuffix(
  phoneSuffix: string
): Promise<LocalAppContact | undefined> {
  return offlineDb.localAppContacts.where('phone_suffix').equals(phoneSuffix).first();
}

// ============= Nickname Overrides =============

// Get nickname for a phone suffix (device contact override)
export async function getNicknameOverride(
  phoneSuffix: string
): Promise<string | null> {
  const override = await offlineDb.nicknameOverrides.get(phoneSuffix);
  return override?.nickname || null;
}

// Set nickname override for a device contact
export async function setNicknameOverride(
  phoneSuffix: string,
  nickname: string
): Promise<void> {
  await offlineDb.nicknameOverrides.put({
    phone_suffix: phoneSuffix,
    nickname,
    updated_at: Date.now(),
  });
}

// Remove nickname override
export async function removeNicknameOverride(phoneSuffix: string): Promise<void> {
  await offlineDb.nicknameOverrides.delete(phoneSuffix);
}

// Get all nickname overrides
export async function getAllNicknameOverrides(): Promise<Map<string, string>> {
  const overrides = await offlineDb.nicknameOverrides.toArray();
  return new Map(overrides.map(o => [o.phone_suffix, o.nickname]));
}

// ============= Contact Name Resolution =============

/**
 * Get display name for a phone number
 * Priority: 1. Nickname override, 2. Local contact, 3. Device contact name, 4. Phone number
 */
export async function getContactDisplayName(
  phoneNumber: string,
  deviceContactName?: string | null
): Promise<string> {
  const phoneSuffix = extractPhoneSuffix(phoneNumber);
  
  // 1. Check nickname override
  const nicknameOverride = await getNicknameOverride(phoneSuffix);
  if (nicknameOverride) return nicknameOverride;
  
  // 2. Check local app contacts
  const localContact = await getLocalContactBySuffix(phoneSuffix);
  if (localContact?.nickname) return localContact.nickname;
  
  // 3. Use device contact name if provided
  if (deviceContactName) return deviceContactName;
  
  // 4. Fall back to phone number
  return phoneNumber;
}

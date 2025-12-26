/**
 * Phone number utility functions for normalization and matching.
 * 
 * Strategy:
 * - Store full E.164 format in phone_number (e.g., +923121729411)
 * - Store last 10 digits in phone_suffix for matching (e.g., 3121729411)
 * - Use phone_suffix for all matching operations to handle format variations
 */

/**
 * Normalizes a phone number to E.164 format.
 * @param phone - The phone number input (can be any format)
 * @param countryCode - The country code with + prefix (e.g., "+92")
 * @returns Full E.164 format phone number (e.g., "+923121729411")
 */
export function normalizeToE164(phone: string, countryCode: string = ""): string {
  // Extract only digits from the phone input
  const digits = phone.replace(/[^0-9]/g, "");
  
  // If already has country code in digits (e.g., 923121729411), just add +
  if (digits.length > 10) {
    return `+${digits}`;
  }
  
  // Remove leading zeros (common in local formats like 03121729411)
  const withoutLeadingZero = digits.replace(/^0+/, "");
  
  // Clean country code
  const cleanCountryCode = countryCode.replace(/[^0-9+]/g, "");
  
  // If country code provided, combine them
  if (cleanCountryCode) {
    const codeDigits = cleanCountryCode.replace(/[^0-9]/g, "");
    return `+${codeDigits}${withoutLeadingZero}`;
  }
  
  // Fallback: just return with + prefix
  return `+${withoutLeadingZero}`;
}

/**
 * Extracts the phone suffix (last 10 significant digits) for matching.
 * This handles format variations like +923121729411, 03121729411, 3121729411
 * by extracting a common suffix that will match across all formats.
 * 
 * @param phone - Any phone number format
 * @returns Last 10 digits of the phone number (e.g., "3121729411")
 */
export function extractPhoneSuffix(phone: string): string {
  // Extract only digits
  const digits = phone.replace(/[^0-9]/g, "");
  
  // Return last 10 digits (most phone numbers are 10 digits without country code)
  // This ensures matching works regardless of:
  // - Country code presence (+92, 92, or none)
  // - Leading zeros (0312 vs 312)
  return digits.slice(-10);
}

/**
 * Formats a phone number for display.
 * @param phone - The phone number to format
 * @returns Formatted phone number for display
 */
export function formatPhoneForDisplay(phone: string): string {
  if (!phone) return "";
  
  // If already has +, return as is
  if (phone.startsWith("+")) {
    return phone;
  }
  
  // If starts with country code digits (like 92, 1, 44), add +
  const digits = phone.replace(/[^0-9]/g, "");
  if (digits.length > 10) {
    return `+${digits}`;
  }
  
  // Otherwise return original
  return phone;
}

/**
 * Creates an email from phone number for Supabase auth.
 * Uses digits only to ensure consistency.
 * @param phone - Phone number
 * @returns Email address for auth
 */
export function phoneToEmail(phone: string): string {
  const digitsOnly = phone.replace(/[^0-9]/g, "");
  return `${digitsOnly}@owelink.app`;
}

/**
 * Compares two phone numbers using suffix matching.
 * @param phone1 - First phone number
 * @param phone2 - Second phone number
 * @returns True if the phone suffixes match
 */
export function phonesMatch(phone1: string, phone2: string): boolean {
  return extractPhoneSuffix(phone1) === extractPhoneSuffix(phone2);
}

/**
 * Formats a phone number for WhatsApp URLs.
 * Handles local numbers like 03121729411 by removing leading zeros.
 * 
 * @param phone - The phone number to format
 * @param defaultCountryCode - Default country code without + (e.g., "92" for Pakistan)
 * @returns Formatted phone number for wa.me URLs (digits only, no +)
 */
export function formatPhoneForWhatsApp(phone: string, defaultCountryCode?: string): string {
  if (!phone) return "";
  
  // Extract only digits
  let digits = phone.replace(/[^0-9]/g, "");
  
  // If the number is already long enough (has country code), just return digits
  // Most international numbers with country code are 11+ digits
  if (digits.length >= 11) {
    return digits;
  }
  
  // Remove leading zeros (convert 03121729411 → 3121729411)
  digits = digits.replace(/^0+/, "");
  
  // If we have a default country code and the number is short (no country code)
  // Prepend the country code
  if (defaultCountryCode && digits.length <= 10) {
    const cleanCountryCode = defaultCountryCode.replace(/[^0-9]/g, "");
    return `${cleanCountryCode}${digits}`;
  }
  
  // Return the cleaned digits
  return digits;
}

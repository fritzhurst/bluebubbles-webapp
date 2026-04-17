// Pure helpers for resolving an address to a contact display name.
// React-specific wiring lives in `ui/hooks/useContacts.tsx`.
//
// Phone numbers are the main headache here: the same person can appear in
// macOS Contacts as `(555) 123-4567` (10 digits, no country code) and in
// iMessage handles as `+15551234567` (11 digits, with leading 1). We
// generate multiple lookup keys per address so either side matches.

import type { StoredContact } from '@/db/schema';

/**
 * Return every lookup key we'll use for an address, in priority order.
 * The map indexes every contact by all of its keys, so lookups are O(1).
 *
 * - emails: identity (lowercase)
 * - phones: full digits, last-10 digits, and without-leading-1 if US-style
 */
export function lookupKeys(raw: string): string[] {
  if (!raw) return [];
  const trimmed = raw.trim();
  if (trimmed.includes('@')) return [trimmed.toLowerCase()];

  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return [trimmed];

  const keys = new Set<string>([trimmed, digits]);

  // Canonical 10-digit form (US) — derived from whatever format we were given.
  let tenDigit: string | null = null;
  if (digits.length === 10) {
    tenDigit = digits;
  } else if (digits.length === 11 && digits.startsWith('1')) {
    tenDigit = digits.slice(1);
  } else if (digits.length >= 10) {
    tenDigit = digits.slice(-10);
  }
  if (tenDigit) keys.add(tenDigit);

  // E.164 of whatever we were given.
  keys.add('+' + digits);

  // For any 10-digit form, also add the US country-code variants, because
  // macOS Contacts often stores numbers without country code
  // ("(555) 123-4567") while iMessage handles always use e.164
  // ("+15551234567"). Without these, the two sides never match on keys.
  if (tenDigit) {
    keys.add('1' + tenDigit);
    keys.add('+1' + tenDigit);
  }
  return Array.from(keys);
}

/**
 * Find the StoredContact whose address matches any of the keys we'd generate
 * for the given raw address. Returns undefined if no match.
 *
 * Use this instead of `map.get(raw)` whenever the caller needs the full
 * contact record (e.g. to read `contactId` for an avatar lookup) — a
 * direct get() misses across formatting differences like
 * `+1 (210) 838-2045` vs `+12108382045`.
 */
export function findContact(
  address: string | null | undefined,
  map: Map<string, StoredContact>,
): StoredContact | undefined {
  if (!address) return undefined;
  for (const key of lookupKeys(address)) {
    const hit = map.get(key);
    if (hit) return hit;
  }
  return undefined;
}

/**
 * Resolve an address to a display name, falling back to the address itself
 * so the UI never shows blank.
 */
export function resolveContactName(
  address: string | null | undefined,
  map: Map<string, StoredContact>,
): string {
  if (!address) return '';
  const hit = findContact(address, map);
  return hit?.displayName || address;
}

/**
 * Legacy alias retained for any callers that still want just the digits form.
 * @deprecated use `lookupKeys` instead.
 */
export function normalizePhone(raw: string): string {
  if (raw.includes('@')) return raw;
  return raw.replace(/\D/g, '');
}

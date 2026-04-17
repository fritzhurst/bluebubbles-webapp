// Contacts API.
//
// BlueBubbles Server surfaces the macOS Contacts.app via:
//   GET  /api/v1/contact?extraProperties=avatar — list all contacts with avatars
//   GET  /api/v1/contact                        — list all contacts, no extras
//   POST /api/v1/contact/query                  — { addresses, extraProperties } for targeted lookup
//
// Important: `extraProperties` on GET is a QUERY PARAMETER, not a body field.
// Passing `extraProperties: ['avatar']` as a POST body to /contact/query
// returns the macOS-API-sourced version of each contact (sourceType: 'api')
// which for many contacts has an empty avatar even when one exists — the
// avatars actually live on the db-sourced version, and those come back via
// GET /contact?extraProperties=avatar.

import { Endpoints } from './endpoints';
import { ApiError, apiGet, apiPost } from './rest';
import type { Contact } from '@/types/bluebubbles';

/**
 * Fetch all contacts. When `withAvatars` is true, add
 * `extraProperties=avatar` as a query param so the server returns each
 * contact's base64 photo inline.
 */
export async function getAllContacts(withAvatars = false): Promise<Contact[]> {
  // `extraProperties` on GET /contact is the magic param that makes the
  // server include base64 avatars. This hits the db-source version of each
  // contact which is where avatars actually live — the
  // api-source-via-POST-query path returns empty avatars for most people.
  const query: Record<string, string> = {};
  if (withAvatars) query.extraProperties = 'avatar';

  try {
    return await apiGet<Contact[]>(Endpoints.contacts, query);
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 405)) {
      // Older servers only expose POST; try that. Avatars may not come back
      // this way but at least the name resolution still works.
      return apiPost<Contact[]>(
        Endpoints.contacts,
        withAvatars ? { extraProperties: ['avatar'] } : {},
      );
    }
    throw err;
  }
}

/**
 * Lookup a specific batch of addresses, optionally including extra fields
 * like the base64 avatar. Cheaper than pulling the full book when you only
 * need to resolve a handful.
 */
export async function queryContactsByAddresses(
  addresses: string[],
  extraProperties: string[] = [],
): Promise<Contact[]> {
  if (addresses.length === 0) return [];
  const body: Record<string, unknown> = { addresses };
  if (extraProperties.length > 0) body.extraProperties = extraProperties;
  return apiPost<Contact[]>(Endpoints.contactQuery, body);
}

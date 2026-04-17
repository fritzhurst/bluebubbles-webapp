// Contact map context + hook.
//
// The whole contacts table lives in memory as a Map<address, StoredContact>
// so rendering can resolve names synchronously — no async calls in render.
// The map is kept in sync with Dexie via `useLiveQuery`, so contact edits
// propagate without a reload.
//
// Pure lookup logic lives in `utils/contacts.ts`; this file is just the
// React wiring.

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/db';
import type { StoredContact } from '@/db/schema';
import { lookupKeys } from '@/utils/contacts';

// Re-export the pure helper so existing imports (`from '@/ui/hooks/useContacts'`)
// keep working without a cascade of edits.
export { resolveContactName } from '@/utils/contacts';

const EMPTY_MAP: Map<string, StoredContact> = new Map();
const ContactMapContext = createContext<Map<string, StoredContact>>(EMPTY_MAP);

interface ProviderProps {
  children: ReactNode;
}

export function ContactMapProvider({ children }: ProviderProps) {
  const contacts = useLiveQuery(() => db.contacts.toArray(), [], [] as StoredContact[]);
  // Set of contactIds that have a stored avatar. Used to disambiguate when
  // the same phone/email appears on multiple contact entries (BB Server
  // returns both db-source and api-source versions of the same person).
  const avatarIds = useLiveQuery<Set<string>>(
    async () => {
      const rows = await db.contactAvatars.toArray();
      return new Set(rows.map((r) => String(r.contactId)));
    },
    [],
    new Set<string>(),
  );

  const map = useMemo(() => {
    const m = new Map<string, StoredContact>();
    const hasAvatar = (c: StoredContact) =>
      !!c.contactId && avatarIds.has(String(c.contactId));

    for (const c of contacts ?? []) {
      for (const key of lookupKeys(c.address)) {
        const existing = m.get(key);
        if (!existing) {
          m.set(key, c);
          continue;
        }
        // When two entries claim the same lookup key, prefer the one whose
        // contactId has a known avatar — that's the db-source entry on BB
        // servers, which is also the one with the most complete data.
        if (hasAvatar(c) && !hasAvatar(existing)) {
          m.set(key, c);
        }
      }
    }
    return m;
  }, [contacts, avatarIds]);

  return <ContactMapContext.Provider value={map}>{children}</ContactMapContext.Provider>;
}

/** Subscribe to the current address → contact map. Safe to call in any render. */
export function useContactMap(): Map<string, StoredContact> {
  return useContext(ContactMapContext);
}

// Live-read hook for the server info we captured during login.
//
// Used to gate features that depend on server capability (e.g. Private API,
// Helper connection) so we don't fire requests we know the server will
// reject. This avoids the browser's built-in "500 Internal Server Error"
// spam in the console.

import { useLiveQuery } from 'dexie-react-hooks';
import { db, SETTING_KEYS } from '@/db/db';
import type { ServerInfo } from '@/types/bluebubbles';

export function useServerInfo(): ServerInfo | undefined {
  const row = useLiveQuery(
    () => db.settings.get(SETTING_KEYS.SERVER_INFO),
    [],
    undefined,
  );
  return row?.value as ServerInfo | undefined;
}

/** True if the server has Private API enabled AND its helper is connected. */
export function useHasPrivateApi(): boolean {
  const info = useServerInfo();
  return !!info?.private_api;
}

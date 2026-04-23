// Auth / session management.
//
// There is no OAuth, no Firebase, no server-URL discovery. The user enters
// an HTTPS URL and the server password on the login screen. We validate by
// pinging the server, fetch server info for display, and persist both into
// IndexedDB. On subsequent loads the app auto-logs-in using the stored
// credentials.

import { useCallback, useEffect, useState } from 'react';
import { getSetting, setSetting, wipeDatabase, SETTING_KEYS } from '@/db/db';
import { pingWith, getServerInfoWith } from '@/api/server';
import { useUIStore } from '@/state/store';
import type { ServerInfo } from '@/types/bluebubbles';

export interface LoginResult {
  ok: boolean;
  error?: string;
  info?: ServerInfo;
}

/** Normalize the user-entered URL — trim, strip trailing slash, force https
 *  (except for loopback, where http is allowed for local development). */
export function normalizeServerUrl(raw: string): string {
  let url = raw.trim();
  if (!url) return '';
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  // Enforce HTTPS for anything that isn't localhost/loopback. Plaintext HTTP
  // would leak the server password and every message to network eavesdroppers.
  const isLoopback = /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i.test(url);
  if (/^http:\/\//i.test(url) && !isLoopback) {
    url = url.replace(/^http:\/\//i, 'https://');
  }
  // Drop any trailing slash to make URL construction predictable.
  return url.replace(/\/+$/, '');
}

export function useAuth() {
  const authed = useUIStore((s) => s.authed);
  const setAuthed = useUIStore((s) => s.setAuthed);
  const [checking, setChecking] = useState<boolean>(true);

  // On mount, see if we already have creds.
  useEffect(() => {
    (async () => {
      const [url, pw] = await Promise.all([
        getSetting<string>(SETTING_KEYS.SERVER_URL),
        getSetting<string>(SETTING_KEYS.SERVER_PASSWORD),
      ]);
      setAuthed(!!(url && pw));
      setChecking(false);
    })();
  }, [setAuthed]);

  const login = useCallback(
    async (rawUrl: string, password: string): Promise<LoginResult> => {
      const url = normalizeServerUrl(rawUrl);
      if (!url) return { ok: false, error: 'Please enter a server URL.' };
      if (!password) return { ok: false, error: 'Please enter the server password.' };

      const reachable = await pingWith(url, password);
      if (!reachable) {
        return {
          ok: false,
          error:
            'Could not reach the server with that URL + password. Check the URL, the password, ' +
            'and that the server is accessible from this browser (CORS/HTTPS).',
        };
      }

      let info: ServerInfo | undefined;
      try {
        info = await getServerInfoWith(url, password);
      } catch (err) {
        // Non-fatal; ping already worked. Just log the info step failure.
        console.warn('server/info failed but ping succeeded:', err);
      }

      await Promise.all([
        setSetting(SETTING_KEYS.SERVER_URL, url),
        setSetting(SETTING_KEYS.SERVER_PASSWORD, password),
        info ? setSetting(SETTING_KEYS.SERVER_INFO, info) : Promise.resolve(),
      ]);

      setAuthed(true);
      return { ok: true, info };
    },
    [setAuthed],
  );

  const logout = useCallback(async () => {
    await wipeDatabase();
    setAuthed(false);
    // Reload to clear in-memory sockets, timers, and caches cleanly.
    window.location.reload();
  }, [setAuthed]);

  return { authed, checking, login, logout };
}

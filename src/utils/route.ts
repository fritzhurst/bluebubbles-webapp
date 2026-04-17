// Minimal hash-based router. We don't need a full router library — the
// only "deep link" the app currently supports is the live-device page,
// opened in a new tab from the FindMy list.
//
// Route shape:
//   (no hash) → main app (login or chats view)
//   #/live-device/<urlencoded-device-id> → LiveDeviceMap

import { useEffect, useState } from 'react';

export type Route =
  | { type: 'main' }
  | { type: 'live-device'; deviceId: string };

export function parseHash(hash: string): Route {
  const cleaned = hash.replace(/^#\/?/, '');
  if (!cleaned) return { type: 'main' };
  const parts = cleaned.split('/');
  if (parts[0] === 'live-device' && parts[1]) {
    return { type: 'live-device', deviceId: decodeURIComponent(parts[1]) };
  }
  return { type: 'main' };
}

export function buildLiveDeviceUrl(deviceId: string): string {
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}#/live-device/${encodeURIComponent(deviceId)}`;
}

export function useHashRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));
  useEffect(() => {
    const onHashChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);
  return route;
}

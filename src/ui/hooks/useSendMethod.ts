// Live-read/write hook for the "how should we send messages" preference.
//
// BlueBubbles Server supports two paths:
//   - apple-script: drives Messages.app via AppleScript. Requires macOS
//     Accessibility + Automation permissions for BB Server.
//   - private-api: uses BlueBubbles' BundlePrivateAPI helper injected into
//     Messages.app. More reliable on modern macOS, but requires the helper
//     to be installed and SIP to allow it.
//
// If the user hasn't explicitly chosen a method, we fall back based on what
// the server reports in `server/info`: pick private-api only if the server
// says Private API is enabled. Otherwise apple-script. This avoids the
// trap where a brand-new browser (with no saved preference) tries to send
// via private-api against a server that doesn't support it, which returns
// "500 — Private API is not enabled".

import { useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, setSetting, SETTING_KEYS } from '@/db/db';
import type { SendMethod } from '@/db/schema';
import { useHasPrivateApi } from '@/ui/hooks/useServerInfo';

export function useSendMethod(): [SendMethod, (m: SendMethod) => Promise<void>] {
  const row = useLiveQuery(() => db.settings.get(SETTING_KEYS.SEND_METHOD), [], undefined);
  const hasPrivateApi = useHasPrivateApi();

  const stored = row?.value as SendMethod | undefined;
  const current: SendMethod =
    stored ?? (hasPrivateApi ? 'private-api' : 'apple-script');

  const update = useCallback(async (m: SendMethod) => {
    await setSetting(SETTING_KEYS.SEND_METHOD, m);
  }, []);

  return [current, update];
}

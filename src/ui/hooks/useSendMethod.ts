// Live-read/write hook for the "how should we send messages" preference.
//
// BlueBubbles Server supports two paths:
//   - apple-script: drives Messages.app via AppleScript. Requires macOS
//     Accessibility + Automation permissions for BB Server.
//   - private-api: uses BlueBubbles' BundlePrivateAPI helper injected into
//     Messages.app. More reliable on modern macOS, but requires the helper
//     to be installed and SIP to allow it.

import { useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, setSetting, SETTING_KEYS } from '@/db/db';
import { DEFAULT_SEND_METHOD, type SendMethod } from '@/db/schema';

export function useSendMethod(): [SendMethod, (m: SendMethod) => Promise<void>] {
  const row = useLiveQuery(() => db.settings.get(SETTING_KEYS.SEND_METHOD), [], undefined);
  const current = (row?.value as SendMethod | undefined) ?? DEFAULT_SEND_METHOD;

  const update = useCallback(async (m: SendMethod) => {
    await setSetting(SETTING_KEYS.SEND_METHOD, m);
  }, []);

  return [current, update];
}

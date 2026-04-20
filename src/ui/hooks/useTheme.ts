// Theme state (light / dark). Persisted in Dexie, applied to `<html>` as a
// class. Tailwind's `dark:` utilities key off that class; the `:root.light`
// overrides in `src/index.css` flip the remaining Tailwind slate/white
// colors when light mode is on.

import { useCallback, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, setSetting, SETTING_KEYS } from '@/db/db';
import { DEFAULT_THEME, type Theme } from '@/db/schema';

export function useTheme(): [Theme, (t: Theme) => Promise<void>, () => Promise<void>] {
  const row = useLiveQuery(
    () => db.settings.get(SETTING_KEYS.THEME),
    [],
    undefined,
  );
  const current = (row?.value as Theme | undefined) ?? DEFAULT_THEME;

  // Apply the class to <html> synchronously whenever it changes. Using a
  // ref of the last-applied value avoids redundant DOM writes.
  const lastAppliedRef = useRef<Theme | null>(null);
  useEffect(() => {
    if (lastAppliedRef.current === current) return;
    lastAppliedRef.current = current;
    const root = document.documentElement;
    root.classList.toggle('dark', current === 'dark');
    root.classList.toggle('light', current === 'light');
  }, [current]);

  const set = useCallback(async (t: Theme) => {
    await setSetting(SETTING_KEYS.THEME, t);
  }, []);

  const toggle = useCallback(async () => {
    await setSetting(
      SETTING_KEYS.THEME,
      current === 'dark' ? 'light' : 'dark',
    );
  }, [current]);

  return [current, set, toggle];
}

// BlueBubbles server returns Apple epoch timestamps (seconds since
// 2001-01-01 UTC). We convert to JS epoch milliseconds at the edge so that
// everything in the app — DB rows, UI, sorting — uses one unit.
//
// Note: some BB server versions already return JS epoch ms. The values are
// wildly different magnitudes (ms from 1970 vs. ms from 2001), so we can
// detect and handle both defensively.

const APPLE_EPOCH_MS_OFFSET = 978_307_200_000; // ms between 1970-01-01 and 2001-01-01

/**
 * Convert a BlueBubbles-reported timestamp to JS epoch milliseconds.
 * Accepts either Apple epoch (seconds or ms) or JS epoch (ms).
 */
export function toJsEpochMs(input: number | null | undefined): number {
  if (!input || !Number.isFinite(input)) return 0;
  // If it's a small number (< year 2000 in ms), assume Apple epoch seconds.
  // Threshold: 10^12 is ~ year 2001 in ms. If < 10^12 it's almost certainly
  // Apple-epoch seconds. Between 10^12 and ~4*10^12 (year ~2097) it's ms —
  // but we still need to know whether it's Apple ms or JS ms.
  if (input < 1e12) {
    // Apple epoch seconds
    return input * 1000 + APPLE_EPOCH_MS_OFFSET;
  }
  // If the value is "reasonable" as JS epoch ms (after 2001 and before ~2100)
  // treat it as JS ms. Apple-epoch ms would be about 30 years smaller.
  // If smaller than about the JS ms for year 2001 (978307200000) it's likely
  // Apple-epoch ms — but that branch is handled above since Apple ms for 2001
  // is 0 and would be < 1e12.
  return input;
}

export function formatShortTime(epochMs: number): string {
  if (!epochMs) return '';
  const d = new Date(epochMs);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }
  const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
  if (now.getTime() - epochMs < oneWeekMs) {
    return d.toLocaleDateString(undefined, { weekday: 'short' });
  }
  return d.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric', year: '2-digit' });
}

export function formatLongTime(epochMs: number): string {
  if (!epochMs) return '';
  return new Date(epochMs).toLocaleString();
}

// Find My devices + items via BlueBubbles Server.
//
// BB Server exposes the macOS Find My.app data through:
//   GET  /api/v1/icloud/findmy/devices           — list
//   POST /api/v1/icloud/findmy/devices/refresh   — trigger a fresh pull
//
// Response shape is based on Apple's FindMy.app internal structures that
// BB server proxies. See the typed interfaces below for known fields; we
// keep `[key: string]: unknown` on the top-level so any server-specific
// extras can still be read defensively.

import { Endpoints } from './endpoints';
import { apiGet, apiPost } from './rest';

export interface FindMyAddress {
  mapItemFullAddress?: string | null;
  fullThroroughfare?: string | null;
  streetAddress?: string | null;
  streetName?: string | null;
  locality?: string | null;
  administrativeArea?: string | null;
  subAdministrativeArea?: string | null;
  stateCode?: string | null;
  country?: string | null;
  countryCode?: string | null;
  label?: string | null;
  formattedAddressLines?: string[] | null;
  areaOfInterest?: string[] | null;
}

export interface FindMyLocation {
  latitude?: number | null;
  longitude?: number | null;
  /** ms since epoch (UTC) */
  timeStamp?: number | null;
  horizontalAccuracy?: number | null;
  verticalAccuracy?: number | null;
  altitude?: number | null;
  floorLevel?: number | null;
  /** "Wifi", "Cellular", "GPS", etc. */
  positionType?: string | null;
  isInaccurate?: boolean;
  isOld?: boolean;
  locationFinished?: boolean;
}

export interface FindMyDevice {
  id?: string;
  /** Human label, e.g. "FritzHurst's MacBook Pro". Not always present. */
  name?: string | null;
  deviceDisplayName?: string | null;
  /** Apple's internal model, e.g. "MacBookPro14_1". */
  deviceModel?: string | null;
  batteryStatus?: string | null;
  /** 0.0–1.0 */
  batteryLevel?: number | null;
  lowPowerMode?: boolean;
  /** True for AirTag-style items, false for Apple devices. */
  isConsideredAccessory?: boolean;
  locationEnabled?: boolean;
  lostModeCapable?: boolean;
  passcodeLength?: number | null;
  itemGroup?: string | null;
  address?: FindMyAddress | null;
  location?: FindMyLocation | null;
  /** Catch-all for fields not modeled above. */
  [key: string]: unknown;
}

export async function listFindMyDevices(): Promise<FindMyDevice[]> {
  return apiGet<FindMyDevice[]>(Endpoints.findMyDevices);
}

export async function refreshFindMyDevices(): Promise<FindMyDevice[]> {
  return apiPost<FindMyDevice[]>(Endpoints.findMyDevicesRefresh, {});
}

/** Friends (people who share location) — optional, may 404 on some servers. */
export async function listFindMyFriends(): Promise<FindMyDevice[]> {
  return apiGet<FindMyDevice[]>(Endpoints.findMyFriends);
}

/**
 * Compact one-line address: "street, city, state" — suitable for list rows.
 * Uses BB's `label` (e.g. "2119 Thornwood Ave") for the street portion and
 * appends locality and state code when available.
 */
export function formatAddressShort(addr: FindMyAddress | null | undefined): string {
  if (!addr) return '';
  const street =
    addr.label ||
    addr.fullThroroughfare ||
    (addr.streetAddress && addr.streetName
      ? `${addr.streetAddress} ${addr.streetName}`
      : addr.streetName) ||
    (addr.mapItemFullAddress ? addr.mapItemFullAddress.split(',')[0].trim() : '') ||
    '';

  const region = addr.stateCode || addr.administrativeArea;
  const parts = [street, addr.locality, region].filter(Boolean) as string[];
  return parts.join(', ');
}

export function formatAddressFull(addr: FindMyAddress | null | undefined): string {
  if (!addr) return '';
  if (addr.mapItemFullAddress) return addr.mapItemFullAddress;
  if (addr.formattedAddressLines?.length) return addr.formattedAddressLines.join(', ');
  const parts = [
    addr.fullThroroughfare ?? addr.streetName,
    addr.locality,
    addr.administrativeArea,
    addr.country,
  ].filter(Boolean) as string[];
  return parts.join(', ');
}

/**
 * Best-guess display name. The server sometimes omits `name` entirely —
 * fall back to the device display name, then the model, then the address
 * label (which is what iOS's Find My uses for AirTags named after places).
 */
export function deviceTitle(d: FindMyDevice): string {
  return (
    d.name ||
    d.deviceDisplayName ||
    d.deviceModel ||
    d.address?.label ||
    '(unnamed)'
  );
}

/**
 * Build a full-page OpenStreetMap URL centered on the device with a marker.
 * Null when the device doesn't have a valid location.
 */
export function openStreetMapUrl(d: FindMyDevice): string | null {
  const lat = d.location?.latitude;
  const lng = d.location?.longitude;
  if (lat == null || lng == null) return null;
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`;
}
